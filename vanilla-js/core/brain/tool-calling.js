import {
  CHAT_ROLE_MAP,
  CHAT_SOURCE_MAP,
  BRAIN_ENGINE_TYPE_MAP
} from '../constants.js';
import { getBrainMessage } from './messages.js';

/**
 * 從文字中解析 XML 格式的工具調用 (<tool_call>...</tool_call>)
 * @param {string} content - 模型產生的內容
 * @returns {Array<object>} 解析出的 toolCalls 陣列
 */
export function extractToolCallsFromText(content) {
  if (typeof content !== 'string' || content === '') {
    return [];
  }
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  const toolCalls = [];
  let match = regex.exec(content);
  while (match !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.name === 'string'
      ) {
        toolCalls.push({
          id: `call_${Date.now()}_${toolCalls.length}`,
          type: 'function',
          function: {
            name: parsed.name,
            arguments:
              typeof parsed.arguments === 'string'
                ? parsed.arguments
                : JSON.stringify(parsed.arguments || {})
          }
        });
      }
    } catch (_error) {}
    match = regex.exec(content);
  }
  return toolCalls;
}

/**
 * 處理模型發起的 tool_calls 迴圈 (執行工具 -> 確認/直接執行 -> 依 resultMode 決定是否發起第二輪總結)
 * @param {Object} brainEngine - 大腦引擎實例
 * @param {{type: string, toolCalls: Array, message: object}} toolCallResponse - 模型回傳的工具調用物件
 * @param {Array<object>} initialMessages - 初次發送給模型的對話訊息
 * @param {'aiProvider'|'webLLM'} providerType - 提供者類型
 * @returns {Promise<void>}
 */
export async function handleToolCallsLoop(
  brainEngine,
  toolCallResponse,
  initialMessages,
  providerType
) {
  const { toolCalls, message } = toolCallResponse;
  if (Array.isArray(toolCalls) === false || toolCalls.length === 0) {
    return;
  }

  const toolResults = [];
  let pendingConfirmation = null;

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name;
    let args;
    try {
      args =
        typeof toolCall.function?.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function?.arguments || {};
    } catch (_error) {
      args = {};
    }

    const tool =
      typeof brainEngine.getToolByName === 'function'
        ? brainEngine.getToolByName(toolName)
        : null;

    if (typeof tool !== 'object' || tool === null) {
      console.warn(`[AvatarBot] AI 請求呼叫未註冊的工具: ${toolName}`);
      let customResult;
      if (typeof brainEngine.onToolNotFound === 'function') {
        try {
          customResult = await brainEngine.onToolNotFound({
            toolName,
            args,
            toolCall
          });
        } catch (hookError) {
          console.error('[AvatarBot] onToolNotFound 回呼執行錯誤:', hookError);
        }
      }
      toolResults.push({
        toolCall,
        tool: null,
        args,
        result:
          customResult !== undefined
            ? customResult
            : {
                ok: false,
                error: `Tool "${toolName}" is not registered or not available. Please answer the user directly.`
              }
      });
      continue;
    }

    if (tool.requiresConfirmation === true) {
      pendingConfirmation = { tool, toolCall, args };
      break;
    }

    let toolResult = null;
    if (typeof brainEngine.executeTool === 'function') {
      try {
        toolResult = await brainEngine.executeTool(tool, args, {
          toolCallId: toolCall.id,
          source: CHAT_SOURCE_MAP.AI
        });
      } catch (execError) {
        console.error(
          `[AvatarBot] 工具「${toolName}」執行時發生錯誤:`,
          execError
        );
        let customErrorResult;
        if (typeof brainEngine.onToolError === 'function') {
          try {
            customErrorResult = await brainEngine.onToolError({
              tool,
              toolName,
              args,
              toolCall,
              error: execError
            });
          } catch (hookError) {
            console.error('[AvatarBot] onToolError 回呼執行錯誤:', hookError);
          }
        }
        toolResult =
          customErrorResult !== undefined
            ? customErrorResult
            : {
                ok: false,
                error: execError?.message || 'Tool execution failed'
              };
      }
    }
    toolResults.push({ toolCall, tool, args, result: toolResult });
  }

  const resumeAiSummary = async (executedResults) => {
    if (
      Array.isArray(executedResults) === false ||
      executedResults.length === 0
    ) {
      return;
    }

    const initialAssistantContent =
      typeof message?.content === 'string' ? message.content.trim() : '';

    const normalizedAssistantMessage = {
      role: CHAT_ROLE_MAP.ASSISTANT,
      content: typeof message?.content === 'string' ? message.content : '',
      ...(Array.isArray(message?.tool_calls)
        ? { tool_calls: message.tool_calls }
        : {})
    };

    const toolMessages = executedResults.map(({ toolCall, result }) => ({
      role: CHAT_ROLE_MAP.TOOL,
      tool_call_id: toolCall.id,
      content:
        typeof result === 'string'
          ? result
          : JSON.stringify(
              typeof result === 'object' && result !== null ? result : ''
            )
    }));

    const updatedMessages = [
      ...initialMessages,
      normalizedAssistantMessage,
      ...toolMessages
    ];

    if (providerType === BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER) {
      const toolSummaryResponse = await brainEngine.aiProvider.chat(
        updatedMessages,
        null,
        []
      );
      const toolSummaryResponseText =
        typeof toolSummaryResponse === 'string'
          ? toolSummaryResponse.trim()
          : typeof toolSummaryResponse?.content === 'string'
            ? toolSummaryResponse.content.trim()
            : '';
      let finalText =
        toolSummaryResponseText !== ''
          ? toolSummaryResponseText
          : initialAssistantContent;

      if (finalText === '') {
        const lastResult = executedResults[executedResults.length - 1]?.result;
        if (
          lastResult?.ok === false &&
          typeof lastResult?.error === 'string' &&
          lastResult.error !== ''
        ) {
          finalText = lastResult.error;
        } else if (typeof lastResult === 'string' && lastResult.trim() !== '') {
          finalText = lastResult.trim();
        } else if (
          typeof lastResult?.message === 'string' &&
          lastResult.message.trim() !== ''
        ) {
          finalText = lastResult.message.trim();
        } else {
          finalText = getBrainMessage(brainEngine, 'brain.toolExecutionError');
        }
      }

      if (finalText !== '') {
        if (typeof brainEngine.sayAnswer === 'function') {
          brainEngine.sayAnswer(finalText);
        }
      }
    } else if (
      providerType === BRAIN_ENGINE_TYPE_MAP.WEB_LLM ||
      providerType === 'webLLM'
    ) {
      if (typeof brainEngine.onStreamStart === 'function') {
        brainEngine.onStreamStart();
      }
      const streamMessageId = 'stream-' + Date.now();
      const toolSummaryResponse = await brainEngine.llm.chat(
        updatedMessages,
        (chunkDelta, accumulatedText) => {
          if (typeof brainEngine.onSpokenDisplayTextChange === 'function') {
            brainEngine.onSpokenDisplayTextChange(accumulatedText);
          }
          if (typeof brainEngine.updateChatMessage === 'function') {
            brainEngine.updateChatMessage(
              streamMessageId,
              accumulatedText,
              true
            );
          }
          if (typeof brainEngine.setEmotionFromText === 'function') {
            brainEngine.setEmotionFromText(accumulatedText);
          }
          if (typeof brainEngine.onStreamChunk === 'function') {
            brainEngine.onStreamChunk(chunkDelta);
          }
        },
        []
      );
      const toolSummaryResponseText =
        typeof toolSummaryResponse === 'string'
          ? toolSummaryResponse.trim()
          : typeof toolSummaryResponse?.content === 'string'
            ? toolSummaryResponse.content.trim()
            : '';
      let finalText =
        toolSummaryResponseText !== ''
          ? toolSummaryResponseText
          : initialAssistantContent;

      if (finalText === '') {
        const lastResult = executedResults[executedResults.length - 1]?.result;
        if (
          lastResult?.ok === false &&
          typeof lastResult?.error === 'string' &&
          lastResult.error !== ''
        ) {
          finalText = lastResult.error;
        } else if (typeof lastResult === 'string' && lastResult.trim() !== '') {
          finalText = lastResult.trim();
        } else if (
          typeof lastResult?.message === 'string' &&
          lastResult.message.trim() !== ''
        ) {
          finalText = lastResult.message.trim();
        } else {
          finalText = getBrainMessage(brainEngine, 'brain.toolExecutionError');
        }
      }

      if (finalText !== '') {
        if (brainEngine.memory?.enabled === true) {
          brainEngine.memory.addTurn('assistant', finalText);
        }
        if (typeof brainEngine.updateChatMessage === 'function') {
          brainEngine.updateChatMessage(streamMessageId, finalText, false);
        }
        if (typeof brainEngine.onStreamEnd === 'function') {
          brainEngine.onStreamEnd(finalText);
        }
        if (typeof brainEngine.maybeTriggerRollingSummary === 'function') {
          brainEngine.maybeTriggerRollingSummary();
        }
      }
    }
  };

  if (pendingConfirmation !== null) {
    const { tool, toolCall, args } = pendingConfirmation;
    if (typeof brainEngine.offerToolConfirmation === 'function') {
      brainEngine.offerToolConfirmation(tool, args, {
        toolCallId: toolCall.id,
        source: CHAT_SOURCE_MAP.AI,
        pendingMessages: initialMessages,
        onConfirmResume: async (confirmedResult) => {
          if (confirmedResult?.cancelled === true) {
            return;
          }
          await resumeAiSummary([
            ...toolResults,
            { toolCall, tool, args, result: confirmedResult }
          ]);
        }
      });
    }
  } else {
    await resumeAiSummary(toolResults);
  }
}
