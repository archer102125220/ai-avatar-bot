import {
  CHAT_ROLE_MAP,
  DEFAULT_AI_PROVIDER_MODEL,
  DEFAULT_AI_PROVIDER_MAX_TOKENS,
  LLM_FINISH_REASON_MAP,
  BRAIN_ENGINE_TYPE_MAP,
  AUTO_CONTINUE_MODE_MAP,
  DEFAULT_AUTO_CONTINUE_MODE,
  DEFAULT_MAX_AUTO_CONTINUATIONS
} from '../constants.js';
import { toOpenAiTools } from '../tools.js';
import {
  extractToolCallsFromText,
  executeToolCallsLoop,
  handleToolCallsLoop
} from './tool-calling.js';
import { getBrainMessage, resolveAutoContinuePrompt } from './messages.js';

/**
 * AI 供應商引擎設定
 * @typedef {Object} AiProviderOptions
 * @property {boolean} [enableAiProvider] - 是否啟用 AI 供應商模組（開關）
 * @property {boolean} [providerEnabled] - 是否啟用 AI 供應商模組（別名）
 * @property {boolean} [enabled] - 是否啟用 AI 供應商模組（別名）
 * @property {string} [providerBaseUrl] - AI 供應商 Base URL
 * @property {string} [providerPingUrl] - AI 供應商 Ping URL
 * @property {string} [providerChatUrl] - AI 供應商 Chat URL
 * @property {string} [providerModel] - AI 供應商模型名稱
 * @property {Function} [providerCreateFetchSetting] - 建立 Fetch 設定回呼
 * @property {Function} [providerCreatedFetchSetting] - 建立 Fetch 設定回呼 (相容別名)
 * @property {Function} [providerCreateFetchPayload] - 建立 Fetch 負載回呼
 * @property {Function} [providerCreatedFetchPayload] - 建立 Fetch 負載回呼 (相容別名)
 * @property {Function} [providerResponseFormat] - 回應格式化回呼
 * @property {Function} [providerResponesFormat] - 回應格式化回呼 (相容別名)
 * @property {Function} [providerExtractToolCalls] - 提取 Tool Calls 回呼
 * @property {number} [providerMaxTokens] - AI 供應商最大 token 數
 * @property {boolean} [providerIsStream] - 是否使用串流
 * @property {Function} [onConnecting] - 連線中回呼
 * @property {Function} [onConnected] - 連線完成回呼
 * @property {Function} [onError] - 錯誤回呼
 * @property {Function} [onChatting] - 對話回呼
 * @property {Function} [onStreamChatting] - 串流對話回呼
 */

/**
 * AI 供應商引擎實例
 * @typedef {Object} AiProviderEngine
 * @property {string} baseUrl - Base URL
 * @property {string} base - Base URL (相容別名)
 * @property {string} pingUrl - Ping URL
 * @property {string} chatUrl - Chat URL
 * @property {Function} createFetchSetting - 建立 Fetch 設定方法
 * @property {Function} createdFetchSetting - 建立 Fetch 設定方法 (相容別名)
 * @property {Function} createFetchPayload - 建立 Fetch 負載方法
 * @property {Function} createdFetchPayload - 建立 Fetch 負載方法 (相容別名)
 * @property {Function} responseFormat - 回應格式化方法
 * @property {Function} responesFormat - 回應格式化方法 (相容別名)
 * @property {Function} [extractToolCalls] - 提取 Tool Calls 方法
 * @property {number} maxTokens - 最大 Token 數
 * @property {boolean} isStream - 是否為串流模式
 * @property {Function} onConnecting - 連線中回呼
 * @property {Function} onConnected - 連線完成回呼
 * @property {Function} onError - 錯誤回呼
 * @property {Function} onChatting - 對話回呼
 * @property {Function} onStreamChatting - 串流對話回呼
 * @property {string} model - 模型名稱
 * @property {boolean} enabled - 是否啟用
 * @property {boolean} ready - 是否準備就緒
 * @property {(payload?: Object) => Promise<boolean>} ping - 測試連線方法
 * @property {(messages: Array<Object>, options?: Object, tools?: Array<Object>) => Promise<string|{type: string, toolCalls: Array, message: Object}>} chat - 對話方法
 */

/**
 * 初始化 AI 供應商連線 (後端 API)
 * @param {AiProviderOptions} [setting={}] - AI 供應商設定
 * @returns {Promise<AiProviderEngine>} AI 供應商實例
 */
export async function initAiProvider(setting = {}) {
  const {
    enableAiProvider,
    providerEnabled,
    enabled,
    providerBaseUrl = '',
    providerPingUrl = '',
    providerChatUrl = '',
    providerModel = DEFAULT_AI_PROVIDER_MODEL,
    providerCreateFetchSetting = null,
    providerCreatedFetchSetting = null,
    providerCreateFetchPayload = null,
    providerCreatedFetchPayload = null,
    providerResponseFormat = null,
    providerResponesFormat = null,
    providerExtractToolCalls = null,

    providerMaxTokens = DEFAULT_AI_PROVIDER_MAX_TOKENS,
    providerIsStream = false,

    onConnecting = null,
    onConnected = null,
    onError = null,
    onChatting = null,
    onStreamChatting = null
  } = setting;

  const resolvedCreateFetchSetting =
    providerCreateFetchSetting || providerCreatedFetchSetting;
  const resolvedCreateFetchPayload =
    providerCreateFetchPayload || providerCreatedFetchPayload;
  const resolvedResponseFormat =
    providerResponseFormat || providerResponesFormat;

  let isEnabled;
  if (typeof enableAiProvider === 'boolean') {
    isEnabled = enableAiProvider;
  } else if (typeof providerEnabled === 'boolean') {
    isEnabled = providerEnabled;
  } else if (typeof enabled === 'boolean') {
    isEnabled = enabled;
  } else {
    isEnabled = typeof providerBaseUrl === 'string' && providerBaseUrl !== '';
  }
  let _enabled = isEnabled;

  const aiProvider = {
    baseUrl: providerBaseUrl,
    get base() {
      return this.baseUrl;
    },
    set base(newBase) {
      this.baseUrl = newBase;
    },
    pingUrl: providerPingUrl,
    chatUrl: providerChatUrl,

    get createFetchSetting() {
      return resolvedCreateFetchSetting;
    },
    get createdFetchSetting() {
      return resolvedCreateFetchSetting;
    },
    get createFetchPayload() {
      return resolvedCreateFetchPayload;
    },
    get createdFetchPayload() {
      return resolvedCreateFetchPayload;
    },
    get responseFormat() {
      return resolvedResponseFormat;
    },
    get responesFormat() {
      return resolvedResponseFormat;
    },
    get extractToolCalls() {
      return providerExtractToolCalls;
    },
    get maxTokens() {
      return providerMaxTokens;
    },
    get isStream() {
      return providerIsStream;
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

    model: providerModel || DEFAULT_AI_PROVIDER_MODEL,
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
        const defaultPayload = {
          model: this.model,
          messages,
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

        const createSettingFn =
          this.createFetchSetting || this.createdFetchSetting;
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

        const createPayloadFn =
          this.createFetchPayload || this.createdFetchPayload;
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

        const formatResponseFn = this.responseFormat || this.responesFormat;
        if (typeof formatResponseFn === 'function') {
          return await formatResponseFn(
            response,
            fetchSetting,
            messages,
            this
          );
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
 * 相容別名：createAiProvider -> initAiProvider
 */
export const createAiProvider = initAiProvider;

/**
 * 透過後端 AI 供應商回答問題
 * @param {Object} brainEngine - 大腦引擎實例
 * @param {string} question - 使用者問題
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

    const messages = await brainEngine.buildLLMMessages(
      question,
      BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
    );
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
      const toolLoopFn =
        executeToolCallsLoop || handleToolCallsLoop;
      return await toolLoopFn(
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
        const applyEmotionFn =
          brainEngine.applyEmotionFromText || brainEngine.setEmotionFromText;
        if (typeof applyEmotionFn === 'function') {
          applyEmotionFn(accumulatedText);
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
            brainEngine.updateChatMessage(chatMessageId, accumulatedText, false);
          }
          const applyEmotionFn =
            brainEngine.applyEmotionFromText || brainEngine.setEmotionFromText;
          if (typeof applyEmotionFn === 'function') {
            applyEmotionFn(nextChunk.trim());
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
        const emitAnswerFn =
          brainEngine.emitAnswer || brainEngine.sayAnswer;
        if (typeof emitAnswerFn === 'function') {
          return emitAnswerFn(accumulatedText);
        }
        return;
      } else {
        if (brainEngine.memory?.enabled === true) {
          brainEngine.memory.addTurn('assistant', accumulatedText);
        }
        const triggerSummaryFn =
          brainEngine.triggerRollingSummaryIfNeeded ||
          brainEngine.maybeTriggerRollingSummary;
        if (typeof triggerSummaryFn === 'function') {
          triggerSummaryFn();
        }
        return;
      }
    }

    const emitAnswerFn =
      brainEngine.emitAnswer || brainEngine.sayAnswer;
    if (typeof emitAnswerFn === 'function') {
      return emitAnswerFn(accumulatedText);
    }
  } catch (error) {
    console.warn('AI Provider error', error);
    throw error;
  }
}

/**
 * 相容別名：aiProviderLLMBrain -> chatWithAiProvider
 */
export const aiProviderLLMBrain = chatWithAiProvider;
