import {
  CHAT_ROLE_MAP,
  DEFAULT_AI_PROVIDER_MODEL,
  DEFAULT_AI_PROVIDER_MAX_TOKENS,
  LLM_FINISH_REASON_MAP,
  BRAIN_ENGINE_TYPE_MAP,
  AUTO_CONTINUE_MODE_MAP,
  DEFAULT_AUTO_CONTINUE_MODE,
  DEFAULT_MAX_AUTO_CONTINUATIONS
} from '@/core/constants';
import { toOpenAiTools } from '@/core/tools';
import {
  extractToolCallsFromText,
  executeToolCallsLoop
} from './tool-calling.js';
import {
  getBrainMessage,
  resolveAutoContinuePrompt,
  buildDefaultLLMMessages
} from './messages.js';

/**
 * Configuration options for the server-side AI Provider engine.
 * @typedef {Object} AiProviderOptions
 * @property {boolean} [enableAiProvider] - Whether the AI provider module is enabled.
 * @property {string} [providerBaseUrl] - AI provider base URL endpoint.
 * @property {string} [providerPingUrl] - AI provider ping / health-check URL.
 * @property {string} [providerChatUrl] - AI provider chat completion URL.
 * @property {string} [providerModel] - Target AI model name.
 * @property {Function} [providerCreateFetchSetting] - Custom fetch settings factory callback.
 * @property {Function} [providerCreateFetchPayload] - Custom fetch body payload factory callback.
 * @property {Function} [providerResponseFormat] - Custom response parser callback.
 * @property {Function} [providerExtractToolCalls] - Custom tool calls extractor callback.
 * @property {number} [providerMaxTokens] - Maximum generation tokens.
 * @property {boolean} [providerIsStream] - Whether streaming mode is enabled.
 * @property {Function} [onConnecting] - Connecting state callback.
 * @property {Function} [onConnected] - Connected state callback.
 * @property {Function} [onError] - Connection error callback.
 * @property {Function} [onChatting] - Completion output callback.
 * @property {Function} [onStreamChatting] - Streaming chunk callback.
 */

/**
 * AI Provider engine instance interface.
 * @typedef {Object} AiProviderEngine
 * @property {string} baseUrl - Base URL.
 * @property {string} pingUrl - Ping health-check URL.
 * @property {string} chatUrl - Chat completion URL.
 * @property {Function} createFetchSetting - Fetch settings factory.
 * @property {Function} createFetchPayload - Fetch payload factory.
 * @property {Function} responseFormat - Response parser.
 * @property {Function} [extractToolCalls] - Tool calls extractor.
 * @property {number} maxTokens - Maximum tokens limit.
 * @property {boolean} isStream - Whether streaming mode is active.
 * @property {Function} onConnecting - Connecting state callback.
 * @property {Function} onConnected - Connected state callback.
 * @property {Function} onError - Error callback.
 * @property {Function} onChatting - Completion callback.
 * @property {Function} onStreamChatting - Stream chunk callback.
 * @property {string} model - Target model identifier.
 * @property {boolean} enabled - Whether provider is enabled.
 * @property {boolean} ready - Whether provider is connected and ready.
 * @property {(payload?: Object) => Promise<boolean>} ping - Tests connection health.
 * @property {(messages: Array<Object>, options?: Object, tools?: Array<Object>) => Promise<string | { type: string, toolCalls: Array<any>, message: Object }>} chat - Sends chat completion request.
 */

/**
 * Initializes the AI Provider backend connection and client interface.
 *
 * @param {AiProviderOptions} [setting={}] - AI Provider options.
 * @returns {Promise<AiProviderEngine>} Initialized AI Provider engine instance.
 */
export async function initAiProvider(setting = {}) {
  const {
    enableAiProvider,
    providerEnabled,
    enabled,
    providerBaseUrl = '',
    baseUrl = '',
    providerPingUrl = '',
    pingUrl = '',
    providerChatUrl = '',
    chatUrl = '',
    providerModel = DEFAULT_AI_PROVIDER_MODEL,
    model = '',
    providerCreateFetchSetting = null,
    createFetchSetting = null,
    providerCreateFetchPayload = null,
    createFetchPayload = null,
    providerResponseFormat = null,
    responseFormat = null,
    providerExtractToolCalls = null,
    extractToolCalls = null,

    providerMaxTokens = DEFAULT_AI_PROVIDER_MAX_TOKENS,
    maxTokens,
    providerIsStream = false,
    isStream,

    onConnecting = null,
    onConnected = null,
    onError = null,
    onChatting = null,
    onStreamChatting = null
  } = setting;

  const resolvedBaseUrl = providerBaseUrl || baseUrl || '';
  const resolvedPingUrl = providerPingUrl || pingUrl || '';
  const resolvedChatUrl = providerChatUrl || chatUrl || '';
  const resolvedModel = providerModel || model || DEFAULT_AI_PROVIDER_MODEL;
  const resolvedCreateFetchSetting =
    providerCreateFetchSetting || createFetchSetting || null;
  const resolvedCreateFetchPayload =
    providerCreateFetchPayload || createFetchPayload || null;
  const resolvedResponseFormat =
    providerResponseFormat || responseFormat || null;
  const resolvedExtractToolCalls =
    providerExtractToolCalls || extractToolCalls || null;
  const resolvedMaxTokens =
    typeof providerMaxTokens === 'number' &&
    Number.isFinite(providerMaxTokens) === true &&
    providerMaxTokens > 0
      ? providerMaxTokens
      : typeof maxTokens === 'number' &&
          Number.isFinite(maxTokens) === true &&
          maxTokens > 0
        ? maxTokens
        : DEFAULT_AI_PROVIDER_MAX_TOKENS;
  const resolvedIsStream =
    typeof providerIsStream === 'boolean'
      ? providerIsStream
      : typeof isStream === 'boolean'
        ? isStream
        : false;

  let isEnabled;
  if (typeof enableAiProvider === 'boolean') {
    isEnabled = enableAiProvider;
  } else if (typeof providerEnabled === 'boolean') {
    isEnabled = providerEnabled;
  } else if (typeof enabled === 'boolean') {
    isEnabled = enabled;
  } else {
    isEnabled = typeof resolvedBaseUrl === 'string' && resolvedBaseUrl !== '';
  }
  let _enabled = isEnabled;

  const aiProvider = {
    baseUrl: resolvedBaseUrl,
    pingUrl: resolvedPingUrl,
    chatUrl: resolvedChatUrl,

    get createFetchSetting() {
      return resolvedCreateFetchSetting;
    },
    get createFetchPayload() {
      return resolvedCreateFetchPayload;
    },
    get responseFormat() {
      return resolvedResponseFormat;
    },
    get extractToolCalls() {
      return resolvedExtractToolCalls;
    },
    get maxTokens() {
      return resolvedMaxTokens;
    },
    get isStream() {
      return resolvedIsStream;
    },

    get onConnecting() {
      return function _onConnecting(...args) {
        if (typeof onConnecting === 'function') {
          onConnecting(...args);
        }
      };
    },
    get onConnected() {
      return function _onConnected(...args) {
        if (typeof onConnected === 'function') {
          onConnected(...args);
        }
      };
    },
    get onError() {
      return function _onError(...args) {
        if (typeof onError === 'function') {
          onError(...args);
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

    model: resolvedModel,
    get enabled() {
      return _enabled;
    },
    set enabled(value) {
      if (typeof value === 'boolean') {
        _enabled = value;
      }
    },
    ready: false,
    async ping(fetchSetting = null) {
      if (this.enabled === false) {
        return false;
      }
      try {
        await this.onConnecting(fetchSetting, this);
        const response = await fetch(
          this.baseUrl + (this.pingUrl || '/api/tags'),
          fetchSetting
        );
        this.ready = response.ok;
        await this.onConnected(response, fetchSetting, this);
        return response.ok;
      } catch (error) {
        console.error(error);
        this.ready = false;
        await this.onError(error, fetchSetting, this);
        return false;
      }
    },
    async chat(messages, fetchSetting, tools) {
      try {
        const defaultFetchSetting = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };
        const sanitizedMessages =
          Array.isArray(messages) === true
            ? messages.map((messageItem) => {
                if (typeof messageItem !== 'object' || messageItem === null) {
                  return messageItem;
                }
                let safeContent = '';
                if (typeof messageItem.content === 'string') {
                  safeContent = messageItem.content;
                } else if (
                  typeof messageItem.content === 'object' &&
                  messageItem.content !== null
                ) {
                  if (typeof messageItem.content.text === 'string') {
                    safeContent = messageItem.content.text;
                  } else if (typeof messageItem.content.content === 'string') {
                    safeContent = messageItem.content.content;
                  } else {
                    safeContent = JSON.stringify(messageItem.content);
                  }
                } else if (
                  typeof messageItem.content !== 'undefined' &&
                  messageItem.content !== null
                ) {
                  safeContent = String(messageItem.content);
                }
                return {
                  ...messageItem,
                  content: safeContent
                };
              })
            : [];

        const defaultPayload = {
          model: this.model,
          messages: sanitizedMessages,
          temperature: 0.4,
          max_tokens: this.maxTokens,
          stream: this.isStream
        };

        if (Array.isArray(tools) === true && tools.length > 0) {
          const openAiTools = toOpenAiTools(tools);
          if (openAiTools.length > 0) {
            defaultPayload.tools = openAiTools;
          }
        }

        const createSettingFn = this.createFetchSetting;
        if (typeof createSettingFn === 'function') {
          const currentFetchSetting = await createSettingFn(
            messages,
            this.model,
            defaultFetchSetting,
            this
          );
          if (
            typeof currentFetchSetting === 'object' &&
            currentFetchSetting !== null
          ) {
            fetchSetting = currentFetchSetting;
          }
        }

        if (typeof fetchSetting !== 'object' || fetchSetting === null) {
          fetchSetting = defaultFetchSetting;
        }

        const createPayloadFn = this.createFetchPayload;
        if (typeof createPayloadFn === 'function') {
          const currentPayload = await createPayloadFn(
            messages,
            tools,
            this.model,
            defaultPayload,
            fetchSetting,
            this
          );
          if (typeof currentPayload !== 'undefined') {
            fetchSetting.body = currentPayload;
          }
        }

        if (typeof fetchSetting.body === 'undefined') {
          fetchSetting.body = JSON.stringify(defaultPayload);
        }

        const response = await fetch(
          this.baseUrl + (this.chatUrl || '/chat/completions'),
          fetchSetting
        );

        if (response.ok !== true) {
          let errorMsg = `HTTP ${response.status} ${response.statusText}`;
          try {
            const errorText = await response.text();
            if (typeof errorText === 'string' && errorText !== '') {
              errorMsg += ` - ${errorText}`;
            }
          } catch (_parseError) {}
          throw new Error(errorMsg);
        }

        const formatResponseFn = this.responseFormat;
        if (typeof formatResponseFn === 'function') {
          return await formatResponseFn(response, fetchSetting, messages, this);
        }

        const result = await response.json();
        let toolCalls = null;
        if (typeof this.extractToolCalls === 'function') {
          toolCalls = await this.extractToolCalls(result, this);
        } else {
          toolCalls = result?.choices?.[0]?.message?.tool_calls || null;
        }

        const choice = result?.choices?.[0];
        const finishReason =
          typeof choice?.finish_reason === 'string' &&
          choice.finish_reason !== ''
            ? choice.finish_reason
            : typeof result?.done_reason === 'string' &&
                result.done_reason !== ''
              ? result.done_reason
              : LLM_FINISH_REASON_MAP.STOP;

        const rawContent = choice?.message?.content || '';
        if (
          (toolCalls === null ||
            (Array.isArray(toolCalls) === true && toolCalls.length === 0)) &&
          typeof rawContent === 'string' &&
          rawContent !== ''
        ) {
          const fallbackToolCalls = extractToolCallsFromText(rawContent);
          if (fallbackToolCalls.length > 0) {
            toolCalls = fallbackToolCalls;
          }
        }

        if (Array.isArray(toolCalls) === true && toolCalls.length > 0) {
          return {
            type: 'tool_calls',
            toolCalls,
            message: choice?.message || {
              role: CHAT_ROLE_MAP.ASSISTANT,
              content: rawContent,
              tool_calls: toolCalls
            },
            finishReason
          };
        }

        return {
          type: 'text',
          content: rawContent,
          finishReason
        };
      } catch (error) {
        this.ready = false;
        throw error;
      }
    }
  };

  // 啟用本機 AI 伺服器時：開機 ping 一下，連上就把 🧠 切成「AI 伺服器大腦」狀態
  if (aiProvider?.enabled === true) {
    await aiProvider.ping();
  }

  return aiProvider;
}

/**
 * Executes a conversational query using the server-side AI Provider backend with auto-continuation support.
 *
 * @param {import('@types').BrainEngine} brainEngine - Brain engine instance.
 * @param {string} question - User question text.
 * @returns {Promise<void>}
 */
export async function chatWithAiProvider(brainEngine, question) {
  try {
    if (typeof brainEngine.onSpokenDisplayTextChange === 'function') {
      brainEngine.onSpokenDisplayTextChange(
        getBrainMessage(brainEngine, 'brain.thinking')
      );
    }
    if (typeof brainEngine.onEmotionChange === 'function') {
      brainEngine.onEmotionChange('thinking');
    }

    let messages;
    if (typeof brainEngine.buildLLMMessages === 'function') {
      messages = await brainEngine.buildLLMMessages(
        question,
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      );
    } else {
      messages = await buildDefaultLLMMessages(
        brainEngine,
        question,
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      );
    }
    const tools =
      typeof brainEngine.getTools === 'function' ? brainEngine.getTools() : [];

    const chatResponse = await brainEngine.aiProvider.chat(
      messages,
      null,
      tools
    );

    if (
      typeof chatResponse === 'object' &&
      chatResponse !== null &&
      chatResponse.type === 'tool_calls'
    ) {
      return await executeToolCallsLoop(
        brainEngine,
        chatResponse,
        messages,
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
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
      throw new Error(
        'AI Provider 回應為空或格式錯誤 (response is empty or malformed)'
      );
    }

    let accumulatedText = initialText.trim();
    const enableAutoContinue = brainEngine.enableAutoContinue === true;
    const maxAutoContinuations =
      typeof brainEngine.maxAutoContinuations === 'number' &&
      Number.isFinite(brainEngine.maxAutoContinuations) === true &&
      brainEngine.maxAutoContinuations > 0
        ? brainEngine.maxAutoContinuations
        : DEFAULT_MAX_AUTO_CONTINUATIONS;
    const autoContinueMode =
      brainEngine.autoContinueMode || DEFAULT_AUTO_CONTINUE_MODE;

    let continuationIndex = 0;
    let currentMessages = [...messages];
    let currentAssistantContent = initialText.trim();
    let chatMessageId = null;

    if (
      enableAutoContinue === true &&
      finishReason === LLM_FINISH_REASON_MAP.LENGTH
    ) {
      if (autoContinueMode === AUTO_CONTINUE_MODE_MAP.STREAM) {
        if (typeof brainEngine.addChatMessage === 'function') {
          chatMessageId = brainEngine.addChatMessage(
            'assistant',
            accumulatedText
          );
        }
        if (typeof brainEngine.applyEmotionFromText === 'function') {
          brainEngine.applyEmotionFromText(accumulatedText);
        }
        if (typeof brainEngine.onSpokenAudioPlayNow === 'function') {
          brainEngine.onSpokenAudioPlayNow(accumulatedText);
        }
      }

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

        const continueResponse = await brainEngine.aiProvider.chat(
          currentMessages,
          null,
          []
        );

        const nextChunk =
          typeof continueResponse === 'string'
            ? continueResponse
            : typeof continueResponse?.content === 'string'
              ? continueResponse.content
              : '';
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

        if (autoContinueMode === AUTO_CONTINUE_MODE_MAP.STREAM) {
          if (typeof brainEngine.updateChatMessage === 'function') {
            brainEngine.updateChatMessage(
              chatMessageId,
              accumulatedText,
              false
            );
          }
          if (typeof brainEngine.applyEmotionFromText === 'function') {
            brainEngine.applyEmotionFromText(nextChunk.trim());
          }
          if (typeof brainEngine.onSpokenAudioPlayNow === 'function') {
            brainEngine.onSpokenAudioPlayNow(nextChunk.trim());
          }
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

      if (autoContinueMode === AUTO_CONTINUE_MODE_MAP.BUFFERED) {
        if (typeof brainEngine.emitAnswer === 'function') {
          return brainEngine.emitAnswer(accumulatedText);
        }
        return;
      } else {
        if (brainEngine.memory?.enabled === true) {
          brainEngine.memory.addTurn('assistant', accumulatedText);
        }
        if (typeof brainEngine.triggerRollingSummaryIfNeeded === 'function') {
          brainEngine.triggerRollingSummaryIfNeeded();
        }
        return;
      }
    }

    if (typeof brainEngine.emitAnswer === 'function') {
      return brainEngine.emitAnswer(accumulatedText);
    }
  } catch (error) {
    console.warn('AI Provider error', error);
    throw error;
  }
}
