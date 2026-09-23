import {
  CHAT_ROLE_MAP,
  CHAT_SOURCE_MAP,
  BRAIN_ENGINE_TYPE_MAP
} from '@/core/constants';
import type { ToolDefinition } from '@/core/tools';
import type { BrainEngine, ParsedToolCall, LLMMessage } from './types';
import { getBrainMessage } from './messages';

/**
 * Extracts XML-formatted tool calls (`<tool_call>...</tool_call>`) from model output text.
 *
 * @param content - Model generation content.
 * @returns Array of parsed tool call descriptors.
 */
export function extractToolCallsFromText(
  content?: string | null
): ParsedToolCall[] {
  if (typeof content !== 'string' || content === '') {
    return [];
  }
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  const toolCalls: ParsedToolCall[] = [];
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
  brainEngine: BrainEngine | Record<string, unknown>,
  toolCallResponse: {
    type?: string;
    toolCalls?: Array<{
      id: string;
      function?: { name: string; arguments: string };
    }>;
    message?: Record<string, unknown>;
  },
  initialMessages: LLMMessage[],
  providerType: string
): Promise<string | void> {
  const engine = brainEngine as Partial<BrainEngine>;
  const { toolCalls, message } = toolCallResponse;
  if (Array.isArray(toolCalls) === false || toolCalls.length === 0) {
    return;
  }

  const toolResults: Array<{
    toolCall: { id: string; function?: { name: string; arguments: string } };
    tool: ToolDefinition | null;
    args: Record<string, unknown>;
    result: unknown;
  }> = [];
  let pendingConfirmation: {
    tool: ToolDefinition;
    toolCall: { id: string; function?: { name: string; arguments: string } };
    args: Record<string, unknown>;
  } | null = null;

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name || '';
    let args: Record<string, unknown>;
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
      let customResult: unknown;
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

    let toolResult: unknown = null;
    if (typeof engine.executeTool === 'function') {
      try {
        toolResult = await engine.executeTool(tool, args, {
          toolCallId: toolCall.id,
          source: CHAT_SOURCE_MAP.AI
        });
      } catch (execError: unknown) {
        console.error(
          `[AvatarBot] 工具「${toolName}」執行時發生錯誤:`,
          execError
        );
        let customErrorResult: unknown;
        if (typeof engine.onToolError === 'function') {
          try {
            const errorObj =
              execError instanceof Error
                ? execError
                : new Error(String(execError));
            customErrorResult = await engine.onToolError({
              tool,
              toolName,
              args,
              toolCall,
              error: errorObj
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
                error:
                  execError instanceof Error
                    ? execError.message
                    : 'Tool execution failed'
              };
      }
    }
    toolResults.push({ toolCall, tool, args, result: toolResult });
  }

  const resumeAiSummary = async (
    executedResults: Array<{
      toolCall: { id: string; function?: { name: string; arguments: string } };
      tool: ToolDefinition | null;
      args: Record<string, unknown>;
      result: unknown;
    }>
  ): Promise<string | void> => {
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
      if (!engine.aiProvider) {
        return;
      }
      const rawToolSummaryResponse: unknown = await engine.aiProvider.chat(
        updatedMessages,
        null,
        []
      );
      const toolSummaryResponse =
        typeof rawToolSummaryResponse === 'object' &&
        rawToolSummaryResponse !== null
          ? (rawToolSummaryResponse as { content?: string })
          : null;
      const toolSummaryResponseText =
        typeof rawToolSummaryResponse === 'string'
          ? rawToolSummaryResponse.trim()
          : typeof toolSummaryResponse?.content === 'string'
            ? toolSummaryResponse.content.trim()
            : '';
      let finalText =
        toolSummaryResponseText !== ''
          ? toolSummaryResponseText
          : initialAssistantContent;

      if (finalText === '') {
        const lastResult = executedResults[executedResults.length - 1]?.result;
        const lastResultObj =
          typeof lastResult === 'object' && lastResult !== null
            ? (lastResult as {
                ok?: boolean;
                error?: string;
                message?: string;
              })
            : null;
        if (
          lastResultObj?.ok === false &&
          typeof lastResultObj?.error === 'string' &&
          lastResultObj.error !== ''
        ) {
          finalText = lastResultObj.error;
        } else if (typeof lastResult === 'string' && lastResult.trim() !== '') {
          finalText = lastResult.trim();
        } else if (
          typeof lastResultObj?.message === 'string' &&
          lastResultObj.message.trim() !== ''
        ) {
          finalText = lastResultObj.message.trim();
        } else {
          finalText = getBrainMessage(engine, 'brain.toolExecutionError');
        }
      }

      if (finalText !== '') {
        if (typeof engine.emitAnswer === 'function') {
          return engine.emitAnswer(finalText);
        }
      }
    } else if (
      providerType === BRAIN_ENGINE_TYPE_MAP.WEB_LLM ||
      providerType === 'webLLM'
    ) {
      if (!engine.llm) {
        return;
      }
      if (typeof engine.onStreamStart === 'function') {
        engine.onStreamStart();
      }
      const streamMessageId = 'stream-' + Date.now();
      const rawToolSummaryResponse = await engine.llm.chat(
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
      const toolSummaryResponse =
        typeof rawToolSummaryResponse === 'object' &&
        rawToolSummaryResponse !== null
          ? (rawToolSummaryResponse as { content?: string })
          : null;
      const toolSummaryResponseText =
        typeof rawToolSummaryResponse === 'string'
          ? rawToolSummaryResponse.trim()
          : typeof toolSummaryResponse?.content === 'string'
            ? toolSummaryResponse.content.trim()
            : '';
      let finalText =
        toolSummaryResponseText !== ''
          ? toolSummaryResponseText
          : initialAssistantContent;

      if (finalText === '') {
        const lastResult = executedResults[executedResults.length - 1]?.result;
        const lastResultObj =
          typeof lastResult === 'object' && lastResult !== null
            ? (lastResult as {
                ok?: boolean;
                error?: string;
                message?: string;
              })
            : null;
        if (
          lastResultObj?.ok === false &&
          typeof lastResultObj?.error === 'string' &&
          lastResultObj.error !== ''
        ) {
          finalText = lastResultObj.error;
        } else if (typeof lastResult === 'string' && lastResult.trim() !== '') {
          finalText = lastResult.trim();
        } else if (
          typeof lastResultObj?.message === 'string' &&
          lastResultObj.message.trim() !== ''
        ) {
          finalText = lastResultObj.message.trim();
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
        return finalText;
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
        onConfirmResume: async (confirmedResult: unknown) => {
          if (
            typeof confirmedResult === 'object' &&
            confirmedResult !== null &&
            (confirmedResult as Record<string, unknown>).cancelled === true
          ) {
            return;
          }
          return await resumeAiSummary([
            ...toolResults,
            { toolCall, tool, args, result: confirmedResult }
          ]);
        }
      });
      return;
    }
  } else {
    return await resumeAiSummary(toolResults);
  }
}
