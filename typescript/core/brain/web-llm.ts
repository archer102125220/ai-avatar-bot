import {
  STATE_MAP,
  CHAT_ROLE_MAP,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_MAX_TOKENS,
  LLM_FINISH_REASON_MAP,
  BRAIN_ENGINE_TYPE_MAP,
  DEFAULT_MAX_AUTO_CONTINUATIONS,
  isWebLLMFunctionCallingSupported
} from '@/core/constants';
import { toOpenAiTools, type ToolDefinition } from '@/core/tools';
import type {
  BrainEngine,
  LLMEngineOptions,
  LLMEngine,
  LLMMessage,
  ParsedToolCall
} from './types';
import { extractToolCallsFromText, executeToolCallsLoop } from './tool-calling';
import {
  getBrainMessage,
  resolveAutoContinuePrompt,
  buildDefaultLLMMessages
} from './messages';

export type { LLMEngineOptions, LLMEngine };

interface MLCChatCompletionChoice {
  finish_reason?: string;
  delta?: {
    content?: string;
    tool_calls?: Array<{
      index?: number;
      id?: string;
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
  };
  message?: {
    content?: string;
    tool_calls?: unknown[];
  };
}

interface MLCChatCompletionResult {
  choices?: MLCChatCompletionChoice[];
}

interface MLCEngineInstance {
  chat: {
    completions: {
      create(
        options: Record<string, unknown>
      ): Promise<MLCChatCompletionResult | AsyncIterable<MLCChatCompletionResult>>;
    };
  };
}

/**
 * Initializes the WebLLM in-browser inference engine.
 *
 * @param setting - WebLLM options.
 * @param brain - Parent Brain engine instance.
 * @returns Initialized WebLLM engine controller.
 */
export function initWebLLM(
  setting: LLMEngineOptions = {},
  brain?: BrainEngine | Record<string, unknown>
): LLMEngine {
  const {
    llmModel,
    model,
    llmMaxTokens,
    maxTokens,
    llmIsStream,
    isStream,
    LLMIsStream = true,
    onLoading,
    onLoadProgress,
    onLoaded,
    onLoadError,
    onChatting,
    onStreamChatting
  } = setting;

  const resolvedModel = llmModel || model || DEFAULT_LLM_MODEL;
  const resolvedMaxTokens =
    typeof llmMaxTokens === 'number' &&
    Number.isFinite(llmMaxTokens) === true &&
    llmMaxTokens > 0
      ? llmMaxTokens
      : typeof maxTokens === 'number' &&
          Number.isFinite(maxTokens) === true &&
          maxTokens > 0
        ? maxTokens
        : DEFAULT_LLM_MAX_TOKENS;

  const resolvedIsStream =
    typeof llmIsStream === 'boolean'
      ? llmIsStream
      : typeof isStream === 'boolean'
        ? isStream
        : typeof LLMIsStream === 'boolean'
          ? LLMIsStream
          : true;

  let engine: MLCEngineInstance | null = null;
  let loadingPromise: Promise<MLCEngineInstance> | null = null;

  const llm: LLMEngine = {
    get supported(): boolean {
      return typeof navigator !== 'undefined' && 'gpu' in navigator;
    },
    state: STATE_MAP.IDLE,
    progress: 0,
    model: resolvedModel,

    get maxTokens(): number {
      return resolvedMaxTokens;
    },
    get isStream(): boolean {
      return resolvedIsStream;
    },
    get engine() {
      return engine;
    },

    get onLoading() {
      return function _onLoading(...args: unknown[]) {
        if (typeof onLoading === 'function') {
          return onLoading(...args);
        }
      };
    },
    get onLoadProgress() {
      return function _onLoadProgress(...args: unknown[]) {
        if (typeof onLoadProgress === 'function') {
          return onLoadProgress(...args);
        }
      };
    },
    get onLoaded() {
      return function _onLoaded(...args: unknown[]) {
        if (typeof onLoaded === 'function') {
          return onLoaded(...args);
        }
      };
    },
    get onLoadError() {
      return function _onLoadError(...args: unknown[]) {
        if (typeof onLoadError === 'function') {
          return onLoadError(...args);
        }
      };
    },
    get onChatting() {
      return function _onChatting(...args: unknown[]) {
        if (typeof onChatting === 'function') {
          return onChatting(...args);
        }
      };
    },
    get onStreamChatting() {
      return function _onStreamChatting(...args: unknown[]) {
        if (typeof onStreamChatting === 'function') {
          return onStreamChatting(...args);
        }
      };
    },
    async load(): Promise<unknown> {
      if (typeof engine === 'object' && engine !== null) {
        return engine;
      }
      if (loadingPromise instanceof Promise === true) {
        return loadingPromise;
      }
      this.state = STATE_MAP.LOADING;
      this.onLoading();

      loadingPromise = (async () => {
        try {
          const webllm = await import('@mlc-ai/web-llm');
          const createdEngine = await webllm.CreateMLCEngine(
            llmModel || resolvedModel,
            {
              initProgressCallback: (progressInfo: { progress?: number }) => {
                this.progress = progressInfo.progress || 0;
                this.onLoadProgress(progressInfo);
              }
            }
          );
          engine = createdEngine as unknown as MLCEngineInstance;

          this.state = STATE_MAP.READY;
          this.onLoaded(engine);
          return engine;
        } catch (error: unknown) {
          console.error('[WebLLM] 模型載入失敗:', error);
          this.state = STATE_MAP.ERROR;
          this.error = String(error);
          this.onLoadError(error, this);
          throw error;
        }
      })();

      return loadingPromise;
    },
    async chat(
      messages: LLMMessage[] | Array<Record<string, unknown>>,
      onDelta?:
        | ((
            chunkDelta: string,
            accumulatedText: string,
            llm?: unknown,
            brain?: unknown
          ) => void)
        | null,
      tools?: ToolDefinition[]
    ): Promise<unknown> {
      if (typeof engine !== 'object' || engine === null) {
        return null;
      }

      const createOptions: Record<string, unknown> = {
        messages,
        temperature: 0.4,
        max_tokens: this.maxTokens
      };

      const supportsFunctionCalling = isWebLLMFunctionCallingSupported(
        this.model
      );

      if (
        supportsFunctionCalling === true &&
        Array.isArray(tools) === true &&
        tools.length > 0
      ) {
        const openAiTools = toOpenAiTools(tools);
        if (openAiTools.length > 0) {
          createOptions.tools = openAiTools;

          if (Array.isArray(messages) === true) {
            const typedMessages = messages as LLMMessage[];
            const systemMsg = typedMessages.find(
              (messageItem) =>
                messageItem.role === CHAT_ROLE_MAP.SYSTEM ||
                messageItem.role === 'system'
            );
            const nonSystemMsgs = typedMessages.filter(
              (messageItem) =>
                messageItem.role !== CHAT_ROLE_MAP.SYSTEM &&
                messageItem.role !== 'system'
            );

            const systemInstruction =
              typeof systemMsg?.content === 'string'
                ? systemMsg.content.trim()
                : '';

            if (systemInstruction !== '') {
              const firstUserIndex = nonSystemMsgs.findIndex(
                (messageItem) =>
                  messageItem.role === CHAT_ROLE_MAP.USER ||
                  messageItem.role === 'user'
              );
              if (firstUserIndex !== -1) {
                createOptions.messages = nonSystemMsgs.map(
                  (messageItem, messageIndex) => {
                    if (messageIndex === firstUserIndex) {
                      return {
                        ...messageItem,
                        content: `[Instruction: ${systemInstruction}]\n\n${String(messageItem.content ?? '')}`
                      };
                    }
                    return messageItem;
                  }
                );
              } else {
                createOptions.messages = [
                  {
                    role: CHAT_ROLE_MAP.USER,
                    content: `[Instruction: ${systemInstruction}]`
                  },
                  ...nonSystemMsgs
                ];
              }
            } else {
              createOptions.messages = nonSystemMsgs;
            }
          }
        }
      }

      const executeChatCompletion = async (
        options: Record<string, unknown>
      ): Promise<unknown> => {
        const hasTools =
          Array.isArray(options.tools) === true && options.tools.length > 0;

        if (
          typeof onDelta !== 'function' ||
          this.isStream === false ||
          hasTools === true
        ) {
          const rawMessages = (options.messages as Array<Record<string, unknown>>) || [];
          const normalizedOptions = {
            ...options,
            messages: rawMessages.map(
              (messageItem: Record<string, unknown>) => ({
                ...messageItem,
                content:
                  typeof messageItem?.content === 'string'
                    ? messageItem.content
                    : ''
              })
            )
          };
          const rawResult =
            await engine!.chat.completions.create(normalizedOptions);
          const result = rawResult as MLCChatCompletionResult;
          const choice = result?.choices?.[0];
          const message = choice?.message;
          const finishReason =
            typeof choice?.finish_reason === 'string' &&
            choice.finish_reason !== ''
              ? choice.finish_reason
              : LLM_FINISH_REASON_MAP.STOP;

          if (
            Array.isArray(message?.tool_calls) === true &&
            message.tool_calls.length > 0
          ) {
            const normalizedAssistantMessage = {
              role: CHAT_ROLE_MAP.ASSISTANT,
              content:
                typeof message?.content === 'string' ? message.content : '',
              tool_calls: message.tool_calls
            };
            this.onChatting(result, messages, brain);
            return {
              type: 'tool_calls',
              toolCalls: message.tool_calls,
              message: normalizedAssistantMessage,
              finishReason
            };
          }

          const rawContent = message?.content || '';
          if (
            Array.isArray(message?.tool_calls) === false ||
            message.tool_calls.length === 0
          ) {
            const fallbackToolCalls = extractToolCallsFromText(rawContent);
            if (fallbackToolCalls.length > 0) {
              const normalizedAssistantMessage = {
                role: CHAT_ROLE_MAP.ASSISTANT,
                content: rawContent,
                tool_calls: fallbackToolCalls
              };
              this.onChatting(result, messages, brain);
              return {
                type: 'tool_calls',
                toolCalls: fallbackToolCalls,
                message: normalizedAssistantMessage,
                finishReason
              };
            }
          }

          this.onChatting(result, messages, brain);
          return {
            type: 'text',
            content: rawContent,
            finishReason
          };
        }

        const rawMessages = (options.messages as Array<Record<string, unknown>>) || [];
        const streamOptions = {
          ...options,
          stream: true,
          messages: rawMessages.map(
            (messageItem: Record<string, unknown>) => ({
              ...messageItem,
              content:
                typeof messageItem?.content === 'string'
                  ? messageItem.content
                  : ''
            })
          )
        };
        const stream = (await engine!.chat.completions.create(
          streamOptions
        )) as AsyncIterable<MLCChatCompletionResult>;
        let fullResponse = '';
        let streamFinishReason: string = LLM_FINISH_REASON_MAP.STOP;
        const toolCallsMap: Record<
          number,
          {
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }
        > = {};
        let hasToolCalls = false;

        for await (const chunk of stream) {
          const choice = chunk?.choices?.[0];
          const delta = choice?.delta;
          if (
            typeof choice?.finish_reason === 'string' &&
            choice.finish_reason !== ''
          ) {
            streamFinishReason = choice.finish_reason;
          }
          if (
            Array.isArray(delta?.tool_calls) === true &&
            delta.tool_calls.length > 0
          ) {
            hasToolCalls = true;
            delta.tool_calls.forEach((toolCallDelta) => {
              const callIndex =
                typeof toolCallDelta.index === 'number'
                  ? toolCallDelta.index
                  : 0;
              if (toolCallsMap[callIndex] === undefined) {
                toolCallsMap[callIndex] = {
                  id: toolCallDelta.id || `call_${callIndex}`,
                  type: 'function',
                  function: { name: '', arguments: '' }
                };
              }
              if (
                typeof toolCallDelta.id === 'string' &&
                toolCallDelta.id !== ''
              ) {
                toolCallsMap[callIndex].id = toolCallDelta.id;
              }
              if (typeof toolCallDelta.function?.name === 'string') {
                toolCallsMap[callIndex].function.name +=
                  toolCallDelta.function.name;
              }
              if (typeof toolCallDelta.function?.arguments === 'string') {
                toolCallsMap[callIndex].function.arguments +=
                  toolCallDelta.function.arguments;
              }
            });
          } else if (
            typeof delta?.content === 'string' &&
            delta.content !== ''
          ) {
            fullResponse += delta.content;
            onDelta(delta.content, fullResponse, llm, brain);
            this.onStreamChatting(delta.content, fullResponse, brain);
          }
        }

        if (hasToolCalls === true) {
          const toolCalls = Object.values(toolCallsMap);
          const toolMessage = {
            role: CHAT_ROLE_MAP.ASSISTANT,
            content: typeof fullResponse === 'string' ? fullResponse : '',
            tool_calls: toolCalls
          };
          this.onChatting(toolMessage, messages, brain);
          return {
            type: 'tool_calls',
            toolCalls,
            message: toolMessage,
            finishReason: streamFinishReason
          };
        }

        const fallbackStreamToolCalls = extractToolCallsFromText(fullResponse);
        if (fallbackStreamToolCalls.length > 0) {
          const toolMessage = {
            role: CHAT_ROLE_MAP.ASSISTANT,
            content: fullResponse,
            tool_calls: fallbackStreamToolCalls
          };
          this.onChatting(toolMessage, messages, brain);
          return {
            type: 'tool_calls',
            toolCalls: fallbackStreamToolCalls,
            message: toolMessage,
            finishReason: streamFinishReason
          };
        }

        this.onChatting(fullResponse, messages, brain);
        return {
            type: 'text',
          content: fullResponse,
          finishReason: streamFinishReason
        };
      };

      try {
        const response = (await executeChatCompletion(createOptions)) as
          | {
              type?: string;
              content?: string;
              toolCalls?: unknown[];
              message?: unknown;
              finishReason?: string;
            }
          | string
          | null
          | undefined;
        const textContent =
          typeof response === 'string'
            ? response
            : typeof response?.content === 'string'
              ? response.content
              : '';
        const responseType =
          typeof response === 'object' && response !== null
            ? response.type
            : undefined;
        if (
          createOptions.tools !== undefined &&
          responseType !== 'tool_calls' &&
          (response === null ||
            response === undefined ||
            textContent.trim() === '')
        ) {
          delete createOptions.tools;
          createOptions.messages = messages;
          return await executeChatCompletion(createOptions);
        }
        return response;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          createOptions.tools !== undefined &&
          /not supported for ChatCompletionRequest\.tools|UnsupportedModelIdError|CustomSystemPromptError/i.test(
            errorMessage
          )
        ) {
          console.warn(
            `[AvatarBot] 當前 WebLLM 模型 (${this.model}) 呼叫 Function Calling 發生錯誤，已自動降級為純對話模式。`,
            error
          );
          delete createOptions.tools;
          createOptions.messages = messages;
          return await executeChatCompletion(createOptions);
        }
        console.error('[WebLLM] executeChatCompletion 呼叫失敗:', error);
        throw error;
      }
    }
  };

  return llm;
}

/**
 * Executes a conversational query using the in-browser WebLLM engine with streaming and auto-continuation support.
 *
 * @param brainEngine - Brain engine instance.
 * @param question - User question text.
 */
export async function chatWithWebLLM(
  brainEngine: BrainEngine | Record<string, unknown>,
  question: string
): Promise<string | void> {
  const engine = brainEngine as Partial<BrainEngine>;
  try {
    if (typeof engine.onSpokenDisplayTextChange === 'function') {
      engine.onSpokenDisplayTextChange(
        getBrainMessage(engine, 'brain.thinking')
      );
    }
    if (typeof engine.onEmotionChange === 'function') {
      engine.onEmotionChange('thinking');
    }

    let messages: LLMMessage[];
    if (typeof engine.buildLLMMessages === 'function') {
      messages = await engine.buildLLMMessages(
        question,
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM
      );
    } else {
      messages = await buildDefaultLLMMessages(
        engine,
        question,
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM
      );
    }
    const tools =
      typeof engine.getTools === 'function' ? engine.getTools() : [];

    if (typeof engine.onStreamStart === 'function') {
      engine.onStreamStart();
    }

    const streamMessageId = 'stream-' + Date.now();
    const chatResponse = (await engine.llm?.chat(
      messages,
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
      tools
    )) as
      | {
          type?: string;
          toolCalls?: ParsedToolCall[];
          content?: string;
          finishReason?: string;
        }
      | string
      | null
      | undefined;

    if (
      typeof chatResponse === 'object' &&
      chatResponse !== null &&
      chatResponse.type === 'tool_calls'
    ) {
      if (typeof engine.updateChatMessage === 'function') {
        engine.updateChatMessage(streamMessageId, '', false);
      }
      return await executeToolCallsLoop(
        engine as BrainEngine,
        chatResponse,
        messages,
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM
      );
    }

    const initialText =
      typeof chatResponse === 'string'
        ? chatResponse
        : typeof chatResponse?.content === 'string'
          ? chatResponse.content
          : '';
    const chatResponseObj =
      typeof chatResponse === 'object' && chatResponse !== null
        ? chatResponse
        : null;
    let finishReason =
      typeof chatResponseObj?.finishReason === 'string'
        ? chatResponseObj.finishReason
        : LLM_FINISH_REASON_MAP.STOP;

    if (initialText.trim() === '') {
      console.warn('[WebLLM] 端側模型回應為空字串 (empty response)');
      if (typeof engine.onStreamEnd === 'function') {
        engine.onStreamEnd('');
      }
      throw new Error('WebLLM response is empty');
    }

    let accumulatedText = initialText.trim();
    const enableAutoContinue = engine.enableAutoContinue === true;
    const maxAutoContinuations =
      typeof engine.maxAutoContinuations === 'number' &&
      Number.isFinite(engine.maxAutoContinuations) === true &&
      engine.maxAutoContinuations > 0
        ? engine.maxAutoContinuations
        : DEFAULT_MAX_AUTO_CONTINUATIONS;

    let continuationIndex = 0;
    let currentMessages = [...messages];
    let currentAssistantContent = initialText.trim();

    if (
      enableAutoContinue === true &&
      finishReason === LLM_FINISH_REASON_MAP.LENGTH
    ) {
      while (
        finishReason === LLM_FINISH_REASON_MAP.LENGTH &&
        continuationIndex < maxAutoContinuations
      ) {
        continuationIndex++;
        const continuePrompt = resolveAutoContinuePrompt(
          engine,
          continuationIndex,
          accumulatedText
        );

        if (typeof engine.onAutoContinueStart === 'function') {
          engine.onAutoContinueStart({
            continuationIndex,
            maxContinuations: maxAutoContinuations,
            accumulatedText
          });
        }

        currentMessages = [
          ...currentMessages,
          {
            role: CHAT_ROLE_MAP.ASSISTANT,
            content: currentAssistantContent
          },
          {
            role: CHAT_ROLE_MAP.USER,
            content: continuePrompt
          }
        ];

        let chunkDeltaBuffer = '';
        const continueResponse = (await engine.llm?.chat(
          currentMessages,
          (chunkDelta: string, currentStreamText: string) => {
            chunkDeltaBuffer = currentStreamText;
            const combinedText = accumulatedText + '\n' + currentStreamText;
            if (typeof engine.onSpokenDisplayTextChange === 'function') {
              engine.onSpokenDisplayTextChange(combinedText);
            }
            if (typeof engine.updateChatMessage === 'function') {
              engine.updateChatMessage(streamMessageId, combinedText, true);
            }
            if (typeof engine.applyEmotionFromText === 'function') {
              engine.applyEmotionFromText(currentStreamText);
            }

            if (typeof engine.onStreamChunk === 'function') {
              engine.onStreamChunk(chunkDelta);
            }
          },
          []
        )) as
          | { content?: string; finishReason?: string }
          | string
          | null
          | undefined;

        const nextChunk =
          typeof continueResponse === 'string'
            ? continueResponse
            : typeof continueResponse?.content === 'string'
              ? continueResponse.content
              : chunkDeltaBuffer;
        const continueResponseObj =
          typeof continueResponse === 'object' && continueResponse !== null
            ? continueResponse
            : null;
        finishReason =
          typeof continueResponseObj?.finishReason === 'string'
            ? continueResponseObj.finishReason
            : LLM_FINISH_REASON_MAP.STOP;

        if (nextChunk.trim() === '') {
          break;
        }

        accumulatedText += '\n' + nextChunk.trim();
        currentAssistantContent = nextChunk.trim();

        if (typeof engine.onAutoContinueResume === 'function') {
          engine.onAutoContinueResume({
            continuationIndex,
            maxContinuations: maxAutoContinuations,
            accumulatedText,
            chunk: nextChunk.trim()
          });
        }
      }

      if (typeof engine.onAutoContinueEnd === 'function') {
        engine.onAutoContinueEnd({
          totalContinuations: continuationIndex,
          maxContinuations: maxAutoContinuations,
          accumulatedText,
          reason: finishReason
        });
      }
    }

    if (engine.memory?.enabled === true) {
      engine.memory.addTurn('assistant', accumulatedText);
    }
    if (typeof engine.updateChatMessage === 'function') {
      engine.updateChatMessage(streamMessageId, accumulatedText, false);
    }

    if (typeof engine.onStreamEnd === 'function') {
      engine.onStreamEnd(accumulatedText);
    }
    if (typeof engine.triggerRollingSummaryIfNeeded === 'function') {
      engine.triggerRollingSummaryIfNeeded();
    }
    return accumulatedText;
  } catch (error) {
    console.error('[WebLLM] chatWithWebLLM 執行錯誤:', error);
    throw error;
  }
}
