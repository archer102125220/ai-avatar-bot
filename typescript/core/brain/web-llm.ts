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
import { toOpenAiTools } from '@/core/tools';
import type { BrainEngine, ToolDefinition } from '@types';
import { extractToolCallsFromText, executeToolCallsLoop } from './tool-calling';
import {
  getBrainMessage,
  resolveAutoContinuePrompt,
  buildDefaultLLMMessages
} from './messages';

/**
 * Configuration options for the in-browser WebLLM engine.
 */
export interface LLMEngineOptions {
  llmModel?: string;
  model?: string;
  llmMaxTokens?: number;
  maxTokens?: number;
  llmIsStream?: boolean;
  isStream?: boolean;
  LLMIsStream?: boolean;
  onLoading?: ((...args: any[]) => any) | null;
  onLoadProgress?: ((...args: any[]) => any) | null;
  onLoaded?: ((...args: any[]) => any) | null;
  onLoadError?: ((...args: any[]) => any) | null;
  onChatting?: ((...args: any[]) => any) | null;
  onStreamChatting?: ((...args: any[]) => any) | null;
}

/**
 * In-browser WebLLM engine instance interface.
 */
export interface LLMEngine {
  readonly supported: boolean;
  state: string | number;
  progress: number;
  model: string;
  error?: string;
  readonly maxTokens: number;
  readonly isStream: boolean;
  readonly onLoading: (...args: any[]) => any;
  readonly onLoadProgress: (...args: any[]) => any;
  readonly onLoaded: (...args: any[]) => any;
  readonly onLoadError: (...args: any[]) => any;
  readonly onChatting: (...args: any[]) => any;
  readonly onStreamChatting: (...args: any[]) => any;
  load(): Promise<any>;
  chat(
    messages: Array<Record<string, any>>,
    onDelta?:
      | ((
          chunkDelta: string,
          accumulatedText: string,
          llm?: any,
          brain?: any
        ) => void)
      | null,
    tools?: ToolDefinition[]
  ): Promise<any>;
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
  brain?: BrainEngine | Record<string, any>
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

  let engine: any = null;
  let loadingPromise: Promise<any> | null = null;

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

    get onLoading() {
      return function _onLoading(...args: any[]) {
        if (typeof onLoading === 'function') {
          onLoading(...args);
        }
      };
    },
    get onLoadProgress() {
      return function _onLoadProgress(...args: any[]) {
        if (typeof onLoadProgress === 'function') {
          onLoadProgress(...args);
        }
      };
    },
    get onLoaded() {
      return function _onLoaded(...args: any[]) {
        if (typeof onLoaded === 'function') {
          onLoaded(...args);
        }
      };
    },
    get onLoadError() {
      return function _onLoadError(...args: any[]) {
        if (typeof onLoadError === 'function') {
          onLoadError(...args);
        }
      };
    },
    get onChatting() {
      return function _onChatting(...args: any[]) {
        if (typeof onChatting === 'function') {
          onChatting(...args);
        }
      };
    },
    get onStreamChatting() {
      return function _onStreamChatting(...args: any[]) {
        if (typeof onStreamChatting === 'function') {
          onStreamChatting(...args);
        }
      };
    },
    async load(): Promise<any> {
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
          engine = await webllm.CreateMLCEngine(llmModel || resolvedModel, {
            initProgressCallback: (progressInfo: any) => {
              this.progress = progressInfo.progress || 0;
              this.onLoadProgress(progressInfo);
            }
          });

          this.state = STATE_MAP.READY;
          this.onLoaded(engine);
          return engine;
        } catch (error: any) {
          this.state = STATE_MAP.ERROR;
          this.error = String(error);
          this.onLoadError(error, this);
          throw error;
        }
      })();

      return loadingPromise;
    },
    async chat(
      messages: Array<Record<string, any>>,
      onDelta?:
        | ((
            chunkDelta: string,
            accumulatedText: string,
            llm?: any,
            brain?: any
          ) => void)
        | null,
      tools?: ToolDefinition[]
    ): Promise<any> {
      if (typeof engine !== 'object' || engine === null) {
        return null;
      }

      const createOptions: Record<string, any> = {
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
            const systemMsg = messages.find(
              (messageItem) =>
                messageItem.role === CHAT_ROLE_MAP.SYSTEM ||
                messageItem.role === 'system'
            );
            const nonSystemMsgs = messages.filter(
              (messageItem) =>
                messageItem.role !== CHAT_ROLE_MAP.SYSTEM &&
                messageItem.role !== 'system'
            );

            if (
              typeof systemMsg?.content === 'string' &&
              systemMsg.content.trim() !== ''
            ) {
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
                        content: `[Instruction: ${systemMsg.content.trim()}]\n\n${messageItem.content}`
                      };
                    }
                    return messageItem;
                  }
                );
              } else {
                createOptions.messages = [
                  {
                    role: CHAT_ROLE_MAP.USER,
                    content: `[Instruction: ${systemMsg.content.trim()}]`
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
        options: Record<string, any>
      ): Promise<any> => {
        const hasTools =
          Array.isArray(options.tools) === true && options.tools.length > 0;

        if (
          typeof onDelta !== 'function' ||
          this.isStream === false ||
          hasTools === true
        ) {
          const normalizedOptions = {
            ...options,
            messages: (options.messages || []).map(
              (messageItem: Record<string, any>) => ({
                ...messageItem,
                content:
                  typeof messageItem?.content === 'string'
                    ? messageItem.content
                    : ''
              })
            )
          };
          const result =
            await engine.chat.completions.create(normalizedOptions);
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

        const streamOptions = {
          ...options,
          stream: true,
          messages: (options.messages || []).map(
            (messageItem: Record<string, any>) => ({
              ...messageItem,
              content:
                typeof messageItem?.content === 'string'
                  ? messageItem.content
                  : ''
            })
          )
        };
        const stream = await engine.chat.completions.create(streamOptions);
        let fullResponse = '';
        let streamFinishReason = LLM_FINISH_REASON_MAP.STOP;
        const toolCallsMap: Record<number, any> = {};
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
            delta.tool_calls.forEach((toolCallDelta: any) => {
              const callIndex =
                typeof toolCallDelta.index === 'number'
                  ? toolCallDelta.index
                  : 0;
              if (typeof toolCallsMap[callIndex] === 'undefined') {
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
        const response = await executeChatCompletion(createOptions);
        const textContent =
          typeof response === 'string'
            ? response
            : typeof response?.content === 'string'
              ? response.content
              : '';
        if (
          createOptions.tools !== undefined &&
          response?.type !== 'tool_calls' &&
          (response === null ||
            response === undefined ||
            textContent.trim() === '')
        ) {
          delete createOptions.tools;
          createOptions.messages = messages;
          return await executeChatCompletion(createOptions);
        }
        return response;
      } catch (error: any) {
        if (
          createOptions.tools !== undefined &&
          /not supported for ChatCompletionRequest\.tools|UnsupportedModelIdError|CustomSystemPromptError/i.test(
            error?.message || String(error)
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
  brainEngine: BrainEngine | Record<string, any>,
  question: string
): Promise<void> {
  const engine = brainEngine as Record<string, any>;
  try {
    if (typeof engine.onSpokenDisplayTextChange === 'function') {
      engine.onSpokenDisplayTextChange(
        getBrainMessage(engine, 'brain.thinking')
      );
    }
    if (typeof engine.onEmotionChange === 'function') {
      engine.onEmotionChange('thinking');
    }

    let messages: Array<Record<string, any>>;
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
    const chatResponse = await engine.llm.chat(
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
    );

    if (
      typeof chatResponse === 'object' &&
      chatResponse !== null &&
      chatResponse.type === 'tool_calls'
    ) {
      if (typeof engine.updateChatMessage === 'function') {
        engine.updateChatMessage(streamMessageId, '', false);
      }
      return await executeToolCallsLoop(
        engine,
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
    let finishReason =
      typeof chatResponse?.finishReason === 'string'
        ? chatResponse.finishReason
        : LLM_FINISH_REASON_MAP.STOP;

    if (initialText.trim() === '') {
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
        const continueResponse = await engine.llm.chat(
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
        );

        const nextChunk =
          typeof continueResponse === 'string'
            ? continueResponse
            : typeof continueResponse?.content === 'string'
              ? continueResponse.content
              : chunkDeltaBuffer;
        finishReason =
          typeof continueResponse?.finishReason === 'string'
            ? continueResponse.finishReason
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
  } catch (error) {
    console.warn('llm error', error);
    throw error;
  }
}
