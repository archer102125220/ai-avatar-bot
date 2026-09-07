import {
  STATE_MAP,
  CHAT_ROLE_MAP,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_MAX_TOKENS,
  LLM_FINISH_REASON_MAP,
  BRAIN_ENGINE_TYPE_MAP,
  DEFAULT_MAX_AUTO_CONTINUATIONS,
  isWebLLMFunctionCallingSupported
} from '../constants.js';
import { toOpenAiTools } from '../tools.js';
import {
  extractToolCallsFromText,
  handleToolCallsLoop
} from './tool-calling.js';
import { getBrainMessage, resolveAutoContinuePrompt } from './messages.js';

/**
 * WebLLM 引擎設定
 * @typedef {Object} LLMEngineOptions
 * @property {string} [llmModel] - LLM 模型名稱
 * @property {number} [llmMaxTokens] - LLM 最大 token 數
 * @property {number} [LLMMaxTokens] - LLM 最大 token 數 (相容別名)
 * @property {boolean} [LLMIsStream] - 是否使用串流
 * @property {Function} [onLoading] - 載入中回呼
 * @property {Function} [onLoadProgress] - 載入進度回呼
 * @property {Function} [onLoaded] - 載入完成回呼
 * @property {Function} [onLoadError] - 載入錯誤回呼
 * @property {Function} [onChatting] - 對話回呼
 * @property {Function} [onStreamChatting] - 串流對話回呼
 */

/**
 * WebLLM 引擎實例
 * @typedef {Object} LLMEngine
 * @property {boolean} supported - 是否支援 GPU
 * @property {number} state - 引擎狀態
 * @property {number} progress - 載入進度
 * @property {string} model - 模型名稱
 * @property {string} [error] - 載入失敗時的錯誤訊息
 * @property {number} maxTokens - 最大 Token 數
 * @property {boolean} isStream - 是否為串流模式
 * @property {Function} onLoading - 載入中回呼
 * @property {Function} onLoadProgress - 載入進度回呼
 * @property {Function} onLoaded - 載入完成回呼
 * @property {Function} onLoadError - 載入錯誤回呼
 * @property {Function} onChatting - 對話回呼
 * @property {Function} onStreamChatting - 串流對話回呼
 * @property {() => Promise<any>} load - 載入模型方法
 * @property {(messages: Array<Object>, onStreamChunk?: Function, tools?: Array<Object>) => Promise<string|{type: string, toolCalls: Array, message: Object}|null>} chat - 對話方法
 */

/**
 * 初始化 WebLLM 引擎
 * @param {LLMEngineOptions} [setting={}] - LLM 設定
 * @param {Object} [brain] - 大腦引擎實例
 * @returns {LLMEngine} WebLLM 實例
 */
export function initLLM(setting = {}, brain) {
  const {
    llmModel = DEFAULT_LLM_MODEL,
    llmMaxTokens,
    LLMMaxTokens,
    LLMIsStream = true,
    onLoading,
    onLoadProgress,
    onLoaded,
    onLoadError,
    onChatting,
    onStreamChatting
  } = setting;

  const resolvedMaxTokens =
    typeof llmMaxTokens === 'number' &&
    Number.isFinite(llmMaxTokens) === true &&
    llmMaxTokens > 0
      ? llmMaxTokens
      : typeof LLMMaxTokens === 'number' &&
          Number.isFinite(LLMMaxTokens) === true &&
          LLMMaxTokens > 0
        ? LLMMaxTokens
        : DEFAULT_LLM_MAX_TOKENS;

  let engine = null;
  let loadingPromise = null;

  const llm = {
    get supported() {
      return 'gpu' in navigator;
    },
    state: STATE_MAP.IDLE, // idle | loading | ready | error
    progress: 0,
    model: llmModel || DEFAULT_LLM_MODEL,

    get maxTokens() {
      return resolvedMaxTokens;
    },
    get isStream() {
      return LLMIsStream;
    },

    get onLoading() {
      return function _onLoading(...args) {
        if (typeof onLoading === 'function') {
          onLoading(...args);
        }
      };
    },
    get onLoadProgress() {
      return function _onLoadProgress(...args) {
        if (typeof onLoadProgress === 'function') {
          onLoadProgress(...args);
        }
      };
    },
    get onLoaded() {
      return function _onLoaded(...args) {
        if (typeof onLoaded === 'function') {
          onLoaded(...args);
        }
      };
    },
    get onLoadError() {
      return function _onLoadError(...args) {
        if (typeof onLoadError === 'function') {
          onLoadError(...args);
        }
      };
    },
    get onChatting() {
      return function _onChatting(...args) {
        if (typeof onChatting === 'function') {
          onChatting(...args);
        }
      };
    },
    get onStreamChatting() {
      return function _onStreamChatting(...args) {
        if (typeof onStreamChatting === 'function') {
          onStreamChatting(...args);
        }
      };
    },
    async load() {
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
          const webllm = await import('@mlc-ai/web-llm'); // 動態載入：只有按下🧠才抓這包函式庫
          engine = await webllm.CreateMLCEngine(llmModel, {
            initProgressCallback: (progressInfo) => {
              this.progress = progressInfo.progress || 0;
              this.onLoadProgress(progressInfo);
            }
          });

          this.state = STATE_MAP.READY;

          this.onLoaded(engine);
        } catch (error) {
          this.state = STATE_MAP.ERROR;
          this.error = String(error);
          this.onLoadError(error, this);
          throw error;
        }
      })();

      return loadingPromise;
    },
    async chat(messages, onDelta, tools) {
      if (typeof engine !== 'object' || engine === null) {
        return null;
      }

      const createOptions = {
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

          // WebLLM 在 Hermes Function Calling 模式下，套件內部會自動注入專屬的 <tools> system prompt，
          // 若 request 帶有自訂的 { role: 'system' }，WebLLM 會拋出 CustomSystemPromptError。
          // 處理方式：將 system prompt 整合至第一則 user 訊息，避免傳遞獨立的 system 訊息。
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

      const executeChatCompletion = async (options) => {
        const hasTools =
          Array.isArray(options.tools) === true && options.tools.length > 0;

        if (
          typeof onDelta !== 'function' ||
          this.isStream === false ||
          hasTools === true
        ) {
          const normalizedOptions = {
            ...options,
            messages: (options.messages || []).map((messageItem) => ({
              ...messageItem,
              content:
                typeof messageItem?.content === 'string'
                  ? messageItem.content
                  : ''
            }))
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

        // 串流：邊生成邊回吐 token（逐句開講用）——首句不用等整段生成完
        const streamOptions = {
          ...options,
          stream: true,
          messages: (options.messages || []).map((messageItem) => ({
            ...messageItem,
            content:
              typeof messageItem?.content === 'string'
                ? messageItem.content
                : ''
          }))
        };
        const stream = await engine.chat.completions.create(streamOptions);
        let fullResponse = '';
        let streamFinishReason = LLM_FINISH_REASON_MAP.STOP;
        const toolCallsMap = {};
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
          (response === null ||
            response === undefined ||
            textContent.trim() === '')
        ) {
          delete createOptions.tools;
          createOptions.messages = messages;
          return await executeChatCompletion(createOptions);
        }
        return response;
      } catch (error) {
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
 * 透過瀏覽器端 WebLLM 引擎回答問題
 * @param {Object} brainEngine - 大腦引擎實例
 * @param {string} question - 使用者問題
 * @returns {Promise<void>}
 */
export async function webLLMBrain(brainEngine, question) {
  try {
    if (typeof brainEngine.onSpokenDisplayTextChange === 'function') {
      brainEngine.onSpokenDisplayTextChange(
        getBrainMessage(brainEngine, 'brain.thinking')
      );
    }
    if (typeof brainEngine.onEmotionChange === 'function') {
      brainEngine.onEmotionChange('thinking');
    }

    const messages = await brainEngine.buildLLMMessages(
      question,
      BRAIN_ENGINE_TYPE_MAP.WEB_LLM
    );
    const tools =
      typeof brainEngine.getTools === 'function' ? brainEngine.getTools() : [];

    if (typeof brainEngine.onStreamStart === 'function') {
      brainEngine.onStreamStart();
    }

    const streamMessageId = 'stream-' + Date.now();
    const chatResponse = await brainEngine.llm.chat(
      messages,
      (chunkDelta, accumulatedText) => {
        if (typeof brainEngine.onSpokenDisplayTextChange === 'function') {
          brainEngine.onSpokenDisplayTextChange(accumulatedText);
        }
        if (typeof brainEngine.updateChatMessage === 'function') {
          brainEngine.updateChatMessage(streamMessageId, accumulatedText, true);
        }
        if (typeof brainEngine.setEmotionFromText === 'function') {
          brainEngine.setEmotionFromText(accumulatedText);
        }

        if (typeof brainEngine.onStreamChunk === 'function') {
          brainEngine.onStreamChunk(chunkDelta);
        }
      },
      tools
    );

    if (
      typeof chatResponse === 'object' &&
      chatResponse !== null &&
      chatResponse.type === 'tool_calls'
    ) {
      if (typeof brainEngine.updateChatMessage === 'function') {
        brainEngine.updateChatMessage(streamMessageId, '', false);
      }
      return await handleToolCallsLoop(
        brainEngine,
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
      if (typeof brainEngine.onStreamEnd === 'function') {
        brainEngine.onStreamEnd('');
      }
      throw new Error('WebLLM response is empty');
    }

    let accumulatedText = initialText.trim();
    const enableAutoContinue = brainEngine.enableAutoContinue === true;
    const maxAutoContinuations =
      typeof brainEngine.maxAutoContinuations === 'number' &&
      Number.isFinite(brainEngine.maxAutoContinuations) === true &&
      brainEngine.maxAutoContinuations > 0
        ? brainEngine.maxAutoContinuations
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
          brainEngine,
          continuationIndex,
          accumulatedText
        );

        if (typeof brainEngine.onAutoContinueStart === 'function') {
          brainEngine.onAutoContinueStart({
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
        const continueResponse = await brainEngine.llm.chat(
          currentMessages,
          (chunkDelta, currentStreamText) => {
            chunkDeltaBuffer = currentStreamText;
            const combinedText = accumulatedText + '\n' + currentStreamText;
            if (typeof brainEngine.onSpokenDisplayTextChange === 'function') {
              brainEngine.onSpokenDisplayTextChange(combinedText);
            }
            if (typeof brainEngine.updateChatMessage === 'function') {
              brainEngine.updateChatMessage(
                streamMessageId,
                combinedText,
                true
              );
            }
            if (typeof brainEngine.setEmotionFromText === 'function') {
              brainEngine.setEmotionFromText(currentStreamText);
            }

            if (typeof brainEngine.onStreamChunk === 'function') {
              brainEngine.onStreamChunk(chunkDelta);
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

        if (typeof brainEngine.onAutoContinueResume === 'function') {
          brainEngine.onAutoContinueResume({
            continuationIndex,
            maxContinuations: maxAutoContinuations,
            accumulatedText,
            chunk: nextChunk.trim()
          });
        }
      }

      if (typeof brainEngine.onAutoContinueEnd === 'function') {
        brainEngine.onAutoContinueEnd({
          totalContinuations: continuationIndex,
          maxContinuations: maxAutoContinuations,
          accumulatedText,
          reason: finishReason
        });
      }
    }

    if (brainEngine.memory?.enabled === true) {
      brainEngine.memory.addTurn('assistant', accumulatedText);
    }
    if (typeof brainEngine.updateChatMessage === 'function') {
      brainEngine.updateChatMessage(streamMessageId, accumulatedText, false);
    }

    if (typeof brainEngine.onStreamEnd === 'function') {
      brainEngine.onStreamEnd(accumulatedText);
    }
    if (typeof brainEngine.maybeTriggerRollingSummary === 'function') {
      brainEngine.maybeTriggerRollingSummary();
    }
  } catch (error) {
    console.warn('llm error', error);
    throw error;
  }
}
