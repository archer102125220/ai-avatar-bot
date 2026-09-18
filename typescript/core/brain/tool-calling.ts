import {
  CHAT_ROLE_MAP,
  CHAT_SOURCE_MAP,
  BRAIN_ENGINE_TYPE_MAP
} from '@/core/constants';
import type { BrainEngine, ToolDefinition } from '@types';
import { getBrainMessage } from './messages';

/**
 * Extracts XML-formatted tool calls (`<tool_call>...</tool_call>`) from model output text.
 *
 * @param content - Model generation content.
 * @returns Array of parsed tool call descriptors.
 */
export function extractToolCallsFromText(content?: string | null): Array<{
  id: string;
  type: string;
  function: { name: string; arguments: string };
}> {
  if (typeof content !== 'string' || content === '') {
    return [];
  }
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  const toolCalls: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }> = [];
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
    } catch (_error) {
      // Ignore JSON parse errors for non-matching XML content
    }
    match = regex.exec(content);
  }
  return toolCalls;
}

/**
 * Executes the LLM tool-calling cycle (execution -> user confirmation / direct execution -> follow-up synthesis).
 *
 * @param brainEngine - Brain engine instance.
 * @param toolCallResponse - Tool calls payload emitted by model.
 * @param initialMessages - Original prompt messages array sent to the model.
 * @param providerType - AI provider backend type.
 */
export async function executeToolCallsLoop(
  brainEngine: BrainEngine | Record<string, any>,
  toolCallResponse: {
    type: string;
    toolCalls: Array<{
      id: string;
      function?: { name: string; arguments: string };
    }>;
    message?: Record<string, any>;
  },
  initialMessages: Array<Record<string, any>>,
  providerType: string
): Promise<void> {
  const engine = brainEngine as Record<string, any>;
  const { toolCalls, message } = toolCallResponse;
  if (Array.isArray(toolCalls) === false || toolCalls.length === 0) {
    return;
  }

  const toolResults: Array<{
    toolCall: any;
    tool: ToolDefinition | null;
    args: Record<string, any>;
    result: any;
  }> = [];
  let pendingConfirmation: {
    tool: ToolDefinition;
    toolCall: any;
    args: Record<string, any>;
  } | null = null;

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name || '';
    let args: Record<string, any>;
    try {
      args =
        typeof toolCall.function?.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function?.arguments || {};
    } catch (_error) {
      args = {};
    }

    const tool =
      typeof engine.getToolByName === 'function'
        ? engine.getToolByName(toolName)
        : null;

    if (typeof tool !== 'object' || tool === null) {
      console.warn(`[AvatarBot] AI 請求呼叫未註冊的工具: ${toolName}`);
      let customResult: any;
      if (typeof engine.onToolNotFound === 'function') {
        try {
          customResult = await engine.onToolNotFound({
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

    let toolResult: any = null;
    if (typeof engine.executeTool === 'function') {
      try {
        toolResult = await engine.executeTool(tool, args, {
          toolCallId: toolCall.id,
          source: CHAT_SOURCE_MAP.AI
        });
      } catch (execError: any) {
        console.error(
          `[AvatarBot] 工具「${toolName}」執行時發生錯誤:`,
          execError
        );
        let customErrorResult: any;
        if (typeof engine.onToolError === 'function') {
          try {
            customErrorResult = await engine.onToolError({
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

  const resumeAiSummary = async (
    executedResults: Array<{
      toolCall: any;
      tool: ToolDefinition | null;
      args: Record<string, any>;
      result: any;
    }>
  ): Promise<void> => {
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
      const toolSummaryResponse = await engine.aiProvider.chat(
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
          finalText = getBrainMessage(engine, 'brain.toolExecutionError');
        }
      }

      if (finalText !== '') {
        if (typeof engine.emitAnswer === 'function') {
          engine.emitAnswer(finalText);
        }
      }
    } else if (
      providerType === BRAIN_ENGINE_TYPE_MAP.WEB_LLM ||
      providerType === 'webLLM'
    ) {
      if (typeof engine.onStreamStart === 'function') {
        engine.onStreamStart();
      }
      const streamMessageId = 'stream-' + Date.now();
      const toolSummaryResponse = await engine.llm.chat(
        updatedMessages,
        (chunkDelta: string, accumulatedText: string) => {
          if (typeof engine.onSpokenDisplayTextChange === 'function') {
            engine.onSpokenDisplayTextChange(accumulatedText);
          }
          if (typeof engine.updateChatMessage === 'function') {
            engine.updateChatMessage(streamMessageId, accumulatedText, true);
          }
          if (typeof engine.applyEmotionFromText === 'function') {
            engine.applyEmotionFromText(accumulatedText);
          }
          if (typeof engine.onStreamChunk === 'function') {
            engine.onStreamChunk(chunkDelta);
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
          finalText = getBrainMessage(engine, 'brain.toolExecutionError');
        }
      }

      if (finalText !== '') {
        if (engine.memory?.enabled === true) {
          engine.memory.addTurn('assistant', finalText);
        }
        if (typeof engine.updateChatMessage === 'function') {
          engine.updateChatMessage(streamMessageId, finalText, false);
        }
        if (typeof engine.onStreamEnd === 'function') {
          engine.onStreamEnd(finalText);
        }
        if (typeof engine.triggerRollingSummaryIfNeeded === 'function') {
          engine.triggerRollingSummaryIfNeeded();
        }
      }
    }
  };

  if (pendingConfirmation !== null) {
    const { tool, toolCall, args } = pendingConfirmation;
    if (typeof engine.offerToolConfirmation === 'function') {
      engine.offerToolConfirmation(tool, args, {
        toolCallId: toolCall.id,
        source: CHAT_SOURCE_MAP.AI,
        pendingMessages: initialMessages,
        onConfirmResume: async (confirmedResult: any) => {
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
