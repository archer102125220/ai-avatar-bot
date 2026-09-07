import { createBaseStore } from '../store.js';
import {
  resolveLocalized,
  defaultLocales,
  formatParams
} from '../i18n/index.js';
import {
  STATE_MAP,
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_MAX_TOKENS,
  DEFAULT_AI_PROVIDER_MODEL,
  DEFAULT_AI_PROVIDER_MAX_TOKENS,
  DEFAULT_ENABLE_MEMORY,
  DEFAULT_MAX_HISTORY_TURNS,
  DEFAULT_SUMMARY_THRESHOLD_TURNS,
  DEFAULT_MEMORY_KEY,
  CHAT_ROLE_MAP,
  CHAT_SOURCE_MAP,
  COMPRESSION_STRATEGY_MAP,
  BRAIN_ENGINE_TYPE_MAP,
  BRAIN_FALLBACK_TYPE_MAP,
  DEFAULT_ENABLE_AUTO_CONTINUE,
  DEFAULT_MAX_AUTO_CONTINUATIONS,
  AUTO_CONTINUE_MODE_MAP,
  DEFAULT_AUTO_CONTINUE_MODE,
  LLM_FINISH_REASON_MAP,
  FINISH_REASON_MAP,
  isWebLLMFunctionCallingSupported
} from '../constants.js';
import { toOpenAiTools } from '../tools.js';
import {
  compressContext
} from './compression.js';
import {
  handleGetKnowledge,
  bigrams,
  similarity,
  scoreEntry,
  topK,
  bestOf
} from './knowledge.js';
import { classifyEmotion, setEmotionFromText } from './emotion.js';
import { initMemory, maybeTriggerRollingSummary } from './memory.js';
import {
  getBrainMessage,
  getWelcomeText,
  resolveAutoContinuePrompt,
  defaultBuildLLMMessages
} from './messages.js';

export * from './compression.js';
export * from './knowledge.js';
export * from './emotion.js';
export * from './memory.js';
export * from './messages.js';

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
 * AI 供應商引擎設定
 * @typedef {Object} AiProviderOptions
 * @property {boolean} [enableAiProvider] - 是否啟用 AI 供應商模組（開關）
 * @property {boolean} [providerEnabled] - 是否啟用 AI 供應商模組（別名）
 * @property {boolean} [enabled] - 是否啟用 AI 供應商模組（別名）
 * @property {string} [providerBaseUrl] - AI 供應商 Base URL
 * @property {string} [providerPingUrl] - AI 供應商 Ping URL
 * @property {string} [providerChatUrl] - AI 供應商 Chat URL
 * @property {string} [providerModel] - AI 供應商模型名稱
 * @property {Function} [providerCreatedFetchSetting] - 建立 Fetch 設定回呼
 * @property {Function} [providerCreatedFetchPayload] - 建立 Fetch 負載回呼
 * @property {Function} [providerResponesFormat] - 回應格式化回呼
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
 * @property {string} base - Base URL
 * @property {string} pingUrl - Ping URL
 * @property {string} chatUrl - Chat URL
 * @property {Function} createdFetchSetting - 建立 Fetch 設定方法
 * @property {Function} createdFetchPayload - 建立 Fetch 負載方法
 * @property {Function} responesFormat - 回應格式化方法
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
 * 大腦引擎設定
 * @typedef {Object} BrainEngineOptions
 * @property {boolean} [enableMemory=DEFAULT_ENABLE_MEMORY] - 是否啟用記憶體模組
 * @property {number} [maxHistoryTurns=DEFAULT_MAX_HISTORY_TURNS] - 保留最大歷史對話輪數
 * @property {string} [memoryKey=DEFAULT_MEMORY_KEY] - 記憶體儲存鍵名
 * @property {Object} [memoryAdapter] - 自訂儲存轉接器實例
 * @property {Object} [compression] - 上下文壓縮設定
 * @property {Record<string, Object>} [modes] - 宣告式自訂模式註冊表
 * @property {string} [llmModel] - LLM 模型名稱
 * @property {boolean} [preloadWebLLM=false] - 是否在初始化時預先載入 WebLLM 模型
 * @property {boolean} [autoFallbackWebLLM=true] - 當 AI Provider 故障時是否自動在背景載入 WebLLM 備援
 * @property {Array} [knowledge] - 網站知識庫
 * @property {string} [knowledgeUrl] - 網站知識庫 URL
 * @property {Array} [companionKnowledge] - 陪伴模式知識庫
 * @property {string} [companionKnowledgeUrl] - 陪伴模式知識庫 URL
 * @property {Function} [companionFallback] - 陪伴模式後備處理
 * @property {string|Function} [companionFallbackContext] - 陪伴模式自訂兜底回覆內容/模板
 * @property {string|Function} [assistantFallbackContext] - 助理模式自訂兜底回覆內容/模板
 * @property {boolean} [enableAiProvider] - 是否啟用 AI 供應商模組（開關）
 * @property {string} [aiProviderModel] - AI 供應商模型
 * @property {string} [aiProviderBaseUrl] - AI 供應商 Base URL
 * @property {string|Function} [welcomeText] - 歡迎詞
 * @property {string|Function} [companionWelcomeText] - 陪伴模式歡迎詞
 * @property {string|Function} [assistantWelcomeText] - 助理模式歡迎詞
 * @property {number} [llmMaxTokens] - LLM 最大 token 數
 * @property {number} [LLMMaxTokens] - LLM 最大 token 數 (相容別名)
 * @property {boolean} [LLMIsStream] - LLM 是否串流
 * @property {Function} [onLlmLoading] - LLM 載入中回呼
 * @property {Function} [onLlmLoadProgress] - LLM 載入進度回呼
 * @property {Function} [onLlmLoaded] - LLM 載入完成回呼
 * @property {Function} [onLlmLoadError] - LLM 載入錯誤回呼
 * @property {Function} [onLlmChatting] - LLM 對話回呼
 * @property {Function} [onLlmStreamChatting] - LLM 串流對話回呼
 * @property {Function} [onAiProviderConnecting] - AI 連線中回呼
 * @property {Function} [onAiProviderConnected] - AI 連線完成回呼
 * @property {Function} [onAiProviderError] - AI 錯誤回呼
 * @property {Function} [onAiProviderChatting] - AI 對話回呼
 * @property {Function} [onAiProviderStreamChatting] - AI 串流對話回呼
 * @property {Function} [onAddChatMessage] - 新增訊息回呼
 * @property {Function} [onUpdateChatMessage] - 更新訊息回呼
 * @property {Function} [onChatHistoryChanged] - 歷史變更回呼
 * @property {Function} [onSpokenAudioPlayNow] - 播放文字回呼
 * @property {Function} [onSpokenDisplayTextChange] - 字幕變更回呼
 * @property {Function} [onSpokenAudioTextChange] - 語音錯誤提示回呼
 * @property {Function} [onEmotionChange] - 情緒變更回呼
 * @property {Function} [onStreamStart] - 串流開始回呼
 * @property {Function} [onStreamChunk] - 串流片段回呼
 * @property {Function} [onStreamEnd] - 串流結束回呼
 * @property {Function} [aiProviderCreatedFetchSetting] - AI 建立 Fetch 設定
 * @property {Function} [aiProviderCreatedFetchPayload] - AI 建立 Fetch 負載
 * @property {string} [aiProviderPingUrl] - AI Ping URL
 * @property {string} [aiProviderChatUrl] - AI Chat URL
 * @property {number} [aiProviderMaxTokens] - AI 最大 token 數
 * @property {boolean} [aiProviderIsStream] - AI 是否串流
 * @property {Function} [aiProviderExtractToolCalls] - AI 供應商提取 Tool Calls 回呼
 * @property {Function} [getTools] - 取得所有工具列表函式
 * @property {Function} [getToolByName] - 依名稱取得工具函式
 * @property {Function} [offerToolConfirmation] - 發起工具確認回呼
 * @property {Function} [executeTool] - 執行工具函式
 * @property {Object} [i18nEngine] - i18n 國際化引擎實例 (可選，若未提供則自動使用內建字典)
 * @property {string} [locale] - 語系設定 (例如 'zh-TW', 'en-US', 'ja-JP', 'ko-KR')
 * @property {string|Function} [systemContextTemplate] - 助理模式系統提示詞模板
 * @property {string|Function} [companionSystemContextTemplate] - 陪伴模式系統提示詞模板
 * @property {string|Function} [ragTemplate] - RAG 參考資料模板
 * @property {Object} [customContext] - 附加自訂上下文資訊
 * @property {string|Function} [languageRule] - 多語系回答規則提示詞
 * @property {string} [gender] - 虛擬人角色性別 ('male'|'female')
 * @property {string|Function} [genderRule] - 針對性別的額外提示詞規則
 * @property {boolean} [enableAutoContinue=DEFAULT_ENABLE_AUTO_CONTINUE] - 是否在模型回答達到 Token 上限被截斷時啟用自動接續機制
 * @property {number} [maxAutoContinuations=DEFAULT_MAX_AUTO_CONTINUATIONS] - 最大自動接續次數上限（防止無限接續）
 * @property {'stream'|'buffered'} [autoContinueMode=DEFAULT_AUTO_CONTINUE_MODE] - 自動接續輸出模式 ('stream' 即時串流接續 | 'buffered' 全生成完再輸出)
 * @property {string|Function} [autoContinuePrompt] - 自訂自動接續提示詞或生成函式
 * @property {Function} [onAutoContinueStart] - 自動接續開始回呼
 * @property {Function} [onAutoContinueWait] - 語音播完但接續內容仍在生成中（空窗期）回呼
 * @property {Function} [onAutoContinueResume] - 接續內容已抵達並恢復播放回呼
 * @property {Function} [onAutoContinueEnd] - 自動接續流程結束回呼
 * @property {Function} [buildLLMMessages] - 建立 LLM 訊息回呼
 * @property {Function} [onBrainFallback] - 當大腦引擎降級時觸發的回呼函式 (fromEngine, toEngine, error)
 */

/**
 * 大腦引擎實例
 * @typedef {Object} BrainEngine
 * @property {Object} STATE_MAP - 狀態映射表
 * @property {Object} AVATAR_MODE_MAP - 虛擬人模式映射表
 * @property {string} DEFAULT_AVATAR_MODE - 預設虛擬人模式
 * @property {string} DEFAULT_LLM_MODEL - 預設 LLM 模型
 * @property {string} DEFAULT_AI_PROVIDER_MODEL - 預設 AI 供應商模型
 * @property {string} [avatarMode] - 虛擬人模式 ('assistant'|'companion' 或自訂模式)
 * @property {Record<string, Object>} modes - 自訂模式設定表
 * @property {Array<string>} availableModes - 可用角色模式清單
 * @property {boolean} enableMemory - 是否啟用記憶體
 * @property {boolean} enableAiProvider - 是否啟用 AI 供應商
 * @property {boolean} preloadWebLLM - 是否預先載入 WebLLM 模型
 * @property {boolean} autoFallbackWebLLM - 當 AI Provider 故障時是否自動在背景載入 WebLLM 備援
 * @property {boolean} enableAutoContinue - 當前是否啟用自動接續
 * @property {number} maxAutoContinuations - 當前最大自動接續次數
 * @property {'stream'|'buffered'} autoContinueMode - 當前自動接續輸出模式
 * @property {string|Function|null} autoContinuePrompt - 自訂自動接續提示詞
 * @property {Function|null} onAutoContinueStart - 自動接續開始回呼
 * @property {Function|null} onAutoContinueWait - 接續等待回呼
 * @property {Function|null} onAutoContinueResume - 接續恢復回呼
 * @property {Function|null} onAutoContinueEnd - 自動接續結束回呼
 * @property {Function|null} onBrainFallback - 當大腦引擎降級時觸發的回呼函式
 * @property {string} knowledgeUrl - 知識庫 URL
 * @property {Array<KnowledgeEntry>} knowledge - 知識庫陣列
 * @property {string} companionKnowledgeUrl - 陪伴模式知識庫 URL
 * @property {Function} companionFallback - 陪伴模式兜底邏輯
 * @property {Array<KnowledgeEntry>} companionKnowledge - 陪伴模式知識庫
 * @property {number} companionFallbackIdx - 陪伴模式兜底索引
 * @property {string|Function} [companionFallbackContext] - 陪伴模式自訂兜底回覆內容/模板
 * @property {string|Function} [assistantFallbackContext] - 助理模式自訂兜底回覆內容/模板
 * @property {Function} getTools - 取得所有工具列表函式
 * @property {Function|null} getToolByName - 依名稱取得工具函式
 * @property {Function|null} offerToolConfirmation - 發起工具確認回呼
 * @property {Function|null} executeTool - 執行工具函式
 * @property {Function} onLlmLoading - LLM 載入中回呼
 * @property {Function} onLlmLoadProgress - LLM 載入進度回呼
 * @property {Function} onLlmLoaded - LLM 載入完成回呼
 * @property {Function} onLlmLoadError - LLM 載入錯誤回呼
 * @property {Function} onLlmChatting - LLM 對話回呼
 * @property {Function} onLlmStreamChatting - LLM 串流對話回呼
 * @property {Function} onAiProviderConnecting - AI 連線中回呼
 * @property {Function} onAiProviderConnected - AI 連線完成回呼
 * @property {Function} onAiProviderError - AI 錯誤回呼
 * @property {Function} onAiProviderChatting - AI 對話回呼
 * @property {Function} onAiProviderStreamChatting - AI 串流對話回呼
 * @property {Function} onAddChatMessage - 新增對話訊息回呼
 * @property {Function} onUpdateChatMessage - 更新對話訊息回呼
 * @property {Function} onChatHistoryChanged - 歷史對話變更回呼
 * @property {Function} onSpokenAudioPlayNow - 播放文字回呼
 * @property {Function} onSpokenDisplayTextChange - 字幕變更回呼
 * @property {Function} onSpokenAudioTextChange - 語音錯誤提示回呼
 * @property {Function} onEmotionChange - 情緒變更回呼
 * @property {Function} onStreamStart - 串流開始回呼
 * @property {Function} onStreamChunk - 串流片段回呼
 * @property {Function} onStreamEnd - 串流結束回呼
 * @property {Array} chatLog - 對話記錄
 * @property {number} chatSeq - 對話流水號
 * @property {string|Function} welcomeText - 歡迎詞
 * @property {string|Function} companionWelcomeText - 陪伴模式歡迎詞
 * @property {string|Function} assistantWelcomeText - 助理模式歡迎詞
 * @property {Function} buildLLMMessages - 建構 LLM 訊息方法
 * @property {Function} defaultBuildLLMMessages - 預設建構 LLM 訊息方法
 * @property {Function} getWelcomeText - 取得歡迎詞方法
 * @property {Function} classifyEmotion - 情緒分類方法
 * @property {string} locale - 語系設定
 * @property {Function} setLocale - 設定語系方法
 * @property {string|Function} systemContextTemplate - 助理模式系統提示詞模板
 * @property {string|Function} companionSystemContextTemplate - 陪伴模式系統提示詞模板
 * @property {string|Function} ragTemplate - RAG 參考資料模板
 * @property {Object} [customContext] - 附加自訂上下文資訊
 * @property {string|Function} languageRule - 多語系回答規則提示詞
 * @property {string} [gender] - 虛擬人角色性別
 * @property {Function} setGender - 設定性別方法
 * @property {string|Function} [genderRule] - 針對性別的額外提示詞規則
 * @property {Function} setEmotionFromText - 設定情緒方法
 * @property {Function} handleAnswer - 處理回答方法
 * @property {Function} addChatMessage - 新增對話訊息方法
 * @property {Function} updateChatMessage - 更新對話訊息方法
 * @property {Object} [i18nEngine] - i18n 國際化引擎實例
 * @property {LLMEngine} llm - LLM 引擎實例
 * @property {MemoryInstance} memory - 記憶模組實例
 * @property {AiProviderEngine} aiProvider - AI 供應商引擎實例
 * @property {Object} [compression] - 上下文壓縮設定
 */



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
 * 初始化 WebLLM 引擎
 * @param {LLMEngineOptions} [setting={}] - LLM 設定
 * @param {BrainEngine} [brain] - 大腦引擎實例
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
    providerCreatedFetchSetting = null,
    providerCreatedFetchPayload = null,
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
    base: providerBaseUrl,
    pingUrl: providerPingUrl,
    chatUrl: providerChatUrl,

    get createdFetchSetting() {
      return providerCreatedFetchSetting;
    },
    get createdFetchPayload() {
      return providerCreatedFetchPayload;
    },
    get responesFormat() {
      return providerResponesFormat;
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
          this.base + (this.pingUrl || '/api/tags'),
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
        // TODO: 調整成支援 stream 的模式
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

        if (typeof this.createdFetchSetting === 'function') {
          const currentFetchSetting = await this.createdFetchSetting(
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

        if (typeof this.createdFetchPayload === 'function') {
          const currentPayload = await this.createdFetchPayload(
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
          this.base + (this.chatUrl || '/chat/completions'),
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

        if (typeof this.responesFormat === 'function') {
          return await this.responesFormat(
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
 * 初始化大腦引擎核心
 * @param {BrainEngineOptions} [setting={}] - 大腦引擎設定
 * @returns {Promise<BrainEngine>} 大腦引擎實例
 */
export async function initBrainEngine(setting = {}) {
  const {
    llmModel,
    preloadWebLLM = false,
    autoFallbackWebLLM = true,
    enableAutoContinue = DEFAULT_ENABLE_AUTO_CONTINUE,
    maxAutoContinuations = DEFAULT_MAX_AUTO_CONTINUATIONS,
    autoContinueMode = DEFAULT_AUTO_CONTINUE_MODE,
    autoContinuePrompt = null,
    knowledge = [],
    knowledgeUrl,
    companionKnowledge = [],
    companionKnowledgeUrl,
    companionFallback,
    enableAiProvider,
    aiProviderModel,
    aiProviderBaseUrl,

    enableMemory = DEFAULT_ENABLE_MEMORY,
    maxHistoryTurns = DEFAULT_MAX_HISTORY_TURNS,
    memoryKey = DEFAULT_MEMORY_KEY,
    memoryAdapter = null,
    compression = {},
    modes = {},

    welcomeText = null,
    companionWelcomeText = null,
    assistantWelcomeText = null,

    llmMaxTokens,
    LLMMaxTokens,
    LLMIsStream,
    onLlmLoading,
    onLlmLoadProgress,
    onLlmLoaded,
    onLlmLoadError,
    onLlmChatting,
    onLlmStreamChatting,

    onAiProviderConnecting,
    onAiProviderConnected,
    onAiProviderError,
    onAiProviderChatting,
    onAiProviderStreamChatting,

    onAddChatMessage,
    onUpdateChatMessage,
    onChatHistoryChanged,
    onSpokenAudioPlayNow,
    onSpokenDisplayTextChange,
    onSpokenAudioTextChange,
    onEmotionChange,
    onSummaryUpdated,
    onStreamStart,
    onStreamChunk,
    onStreamEnd,
    onAutoContinueStart = null,
    onAutoContinueWait = null,
    onAutoContinueResume = null,
    onAutoContinueEnd = null,

    aiProviderCreatedFetchSetting,
    aiProviderCreatedFetchPayload,
    aiProviderPingUrl,
    aiProviderChatUrl,
    aiProviderMaxTokens,
    aiProviderIsStream,
    aiProviderExtractToolCalls,
    getTools,
    getToolByName,
    offerToolConfirmation,
    executeTool,
    buildLLMMessages,
    i18nEngine = null,
    locale = 'zh-TW',
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext,
    languageRule,
    gender,
    genderRule,
    onBrainFallback = null,
    onToolNotFound = null,
    onToolError = null
  } = setting;

  let llm = null;
  let memory = null;
  let aiProvider = null;

  const safeKnowledge =
    Array.isArray(knowledge) && knowledge.length > 0
      ? knowledge
      : await handleGetKnowledge(knowledgeUrl);
  const safeCompanionKnowledge =
    Array.isArray(companionKnowledge) && companionKnowledge.length > 0
      ? companionKnowledge
      : await handleGetKnowledge(companionKnowledgeUrl);

  const _store = createBaseStore({
    // Add states here if needed in the future
  });

  const brainEngine = {
    get STATE_MAP() {
      return STATE_MAP;
    },
    get AVATAR_MODE_MAP() {
      return AVATAR_MODE_MAP;
    },
    get DEFAULT_AVATAR_MODE() {
      return DEFAULT_AVATAR_MODE;
    },
    get DEFAULT_LLM_MODEL() {
      return DEFAULT_LLM_MODEL;
    },
    get DEFAULT_AI_PROVIDER_MODEL() {
      return DEFAULT_AI_PROVIDER_MODEL;
    },
    get BRAIN_ENGINE_TYPE_MAP() {
      return BRAIN_ENGINE_TYPE_MAP;
    },
    get BRAIN_FALLBACK_TYPE_MAP() {
      return BRAIN_FALLBACK_TYPE_MAP;
    },
    get LLM_FINISH_REASON_MAP() {
      return LLM_FINISH_REASON_MAP;
    },
    get FINISH_REASON_MAP() {
      return FINISH_REASON_MAP;
    },

    get knowledgeUrl() {
      return knowledgeUrl;
    },
    knowledge: safeKnowledge,
    get companionKnowledgeUrl() {
      return companionKnowledgeUrl;
    },
    get companionFallback() {
      return companionFallback;
    },
    companionKnowledge: safeCompanionKnowledge,
    companionFallbackIdx: 0,

    getTools: typeof getTools === 'function' ? getTools : () => [],
    getToolByName: typeof getToolByName === 'function' ? getToolByName : null,
    offerToolConfirmation:
      typeof offerToolConfirmation === 'function'
        ? offerToolConfirmation
        : null,
    executeTool: typeof executeTool === 'function' ? executeTool : null,

    onLlmLoading: null,
    onLlmLoadProgress: null,
    onLlmLoaded: null,
    onLlmLoadError: null,
    onLlmChatting: null,
    onLlmStreamChatting: null,

    onAiProviderConnecting: null,
    onAiProviderConnected: null,
    onAiProviderError: null,
    onAiProviderChatting: null,
    onAiProviderStreamChatting: null,

    onAddChatMessage: onAddChatMessage || null,
    onUpdateChatMessage: onUpdateChatMessage || null,
    onChatHistoryChanged: onChatHistoryChanged || null,
    onSpokenAudioPlayNow: onSpokenAudioPlayNow || null,
    onSpokenDisplayTextChange: onSpokenDisplayTextChange || null,
    onSpokenAudioTextChange: onSpokenAudioTextChange || null,
    onEmotionChange: onEmotionChange || null,
    onSummaryUpdated: onSummaryUpdated || null,
    onStreamStart: onStreamStart || null,
    onStreamChunk: onStreamChunk || null,
    onStreamEnd: onStreamEnd || null,
    onAutoContinueStart: onAutoContinueStart || null,
    onAutoContinueWait: onAutoContinueWait || null,
    onAutoContinueResume: onAutoContinueResume || null,
    onAutoContinueEnd: onAutoContinueEnd || null,
    onToolNotFound: onToolNotFound || null,
    onToolError: onToolError || null,

    enableAutoContinue:
      typeof enableAutoContinue === 'boolean'
        ? enableAutoContinue
        : DEFAULT_ENABLE_AUTO_CONTINUE,
    maxAutoContinuations:
      typeof maxAutoContinuations === 'number' &&
      Number.isFinite(maxAutoContinuations) === true &&
      maxAutoContinuations > 0
        ? maxAutoContinuations
        : DEFAULT_MAX_AUTO_CONTINUATIONS,
    autoContinueMode:
      autoContinueMode === AUTO_CONTINUE_MODE_MAP.BUFFERED
        ? AUTO_CONTINUE_MODE_MAP.BUFFERED
        : AUTO_CONTINUE_MODE_MAP.STREAM,
    autoContinuePrompt: autoContinuePrompt || null,

    chatLog: [],
    chatSeq: 0,

    i18nEngine: i18nEngine || null,
    locale,
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext: customContext || null,
    languageRule,
    gender,
    genderRule,
    compression:
      typeof compression === 'object' && compression !== null
        ? compression
        : {},

    setGender: (newGender) => {
      brainEngine.gender = newGender;
    },

    setLocale: (newLocale) => {
      brainEngine.locale = newLocale;
    },

    _welcomeText: null,
    get welcomeText() {
      return this._welcomeText;
    },
    set welcomeText(newWelcomeText) {
      this._welcomeText = newWelcomeText;
    },

    _companionWelcomeText: null,
    get companionWelcomeText() {
      return this._companionWelcomeText;
    },
    set companionWelcomeText(newCompanionWelcomeText) {
      this._companionWelcomeText = newCompanionWelcomeText;
    },

    _assistantWelcomeText: null,
    get assistantWelcomeText() {
      return this._assistantWelcomeText;
    },
    set assistantWelcomeText(newAssistantWelcomeText) {
      this._assistantWelcomeText = newAssistantWelcomeText;
    },

    buildLLMMessages:
      typeof buildLLMMessages === 'function'
        ? buildLLMMessages
        : (question, engineType) =>
            defaultBuildLLMMessages(brainEngine, question, engineType),

    defaultBuildLLMMessages: (question, engineType) =>
      defaultBuildLLMMessages(brainEngine, question, engineType),

    getWelcomeText: () => getWelcomeText(brainEngine),
    classifyEmotion: classifyEmotion,
    setEmotionFromText: (text) => setEmotionFromText(brainEngine, text),
    handleAnswer: (question) => handleAnswer(brainEngine, question),
    sayAnswer: (text) => sayAnswer(brainEngine, text),
    maybeTriggerRollingSummary: () => maybeTriggerRollingSummary(brainEngine),
    addChatMessage: (role, text, options) =>
      addChatMessage(brainEngine, role, text, options),
    updateChatMessage: (id, text, streaming) =>
      updateChatMessage(brainEngine, id, text, streaming),

    get llm() {
      return llm;
    },
    get memory() {
      return memory;
    },
    get enableMemory() {
      return memory?.enabled ?? DEFAULT_ENABLE_MEMORY;
    },
    set enableMemory(enabled) {
      if (typeof enabled === 'boolean' && memory !== null) {
        memory.enabled = enabled;
      }
    },
    get enableAiProvider() {
      return (
        aiProvider?.enabled ??
        (typeof enableAiProvider === 'boolean'
          ? enableAiProvider
          : typeof aiProviderBaseUrl === 'string' && aiProviderBaseUrl !== '')
      );
    },
    set enableAiProvider(enabled) {
      if (typeof enabled === 'boolean' && aiProvider !== null) {
        aiProvider.enabled = enabled;
      }
    },
    preloadWebLLM: typeof preloadWebLLM === 'boolean' ? preloadWebLLM : false,
    autoFallbackWebLLM:
      typeof autoFallbackWebLLM === 'boolean' ? autoFallbackWebLLM : true,
    onBrainFallback:
      typeof onBrainFallback === 'function' ? onBrainFallback : null,
    get aiProvider() {
      return aiProvider;
    },
    modes: typeof modes === 'object' && modes !== null ? modes : {},
    get availableModes() {
      const customModeKeys =
        typeof this.modes === 'object' && this.modes !== null
          ? Object.keys(this.modes)
          : [];
      return Array.from(
        new Set([...Object.values(AVATAR_MODE_MAP), ...customModeKeys])
      );
    }
  };

  if (typeof welcomeText === 'function') {
    brainEngine.welcomeText = welcomeText;
  } else if (typeof welcomeText === 'string') {
    brainEngine.welcomeText = welcomeText;
  }
  if (typeof companionWelcomeText === 'function') {
    brainEngine.companionWelcomeText = companionWelcomeText;
  } else if (typeof companionWelcomeText === 'string') {
    brainEngine.companionWelcomeText = companionWelcomeText;
  }
  if (typeof assistantWelcomeText === 'function') {
    brainEngine.assistantWelcomeText = assistantWelcomeText;
  } else if (typeof assistantWelcomeText === 'string') {
    brainEngine.assistantWelcomeText = assistantWelcomeText;
  }

  if (typeof onLlmLoading === 'function') {
    brainEngine.onLlmLoading = onLlmLoading.bind(brainEngine);
  }

  if (typeof onLlmLoadProgress === 'function') {
    brainEngine.onLlmLoadProgress = onLlmLoadProgress.bind(brainEngine);
  }

  if (typeof onLlmLoaded === 'function') {
    brainEngine.onLlmLoaded = onLlmLoaded.bind(brainEngine);
  }

  if (typeof onLlmLoadError === 'function') {
    brainEngine.onLlmLoadError = onLlmLoadError.bind(brainEngine);
  }

  if (typeof onLlmChatting === 'function') {
    brainEngine.onLlmChatting = onLlmChatting.bind(brainEngine);
  }

  if (typeof onLlmStreamChatting === 'function') {
    brainEngine.onLlmStreamChatting = onLlmStreamChatting.bind(brainEngine);
  }

  if (typeof onAiProviderConnecting === 'function') {
    brainEngine.onAiProviderConnecting =
      onAiProviderConnecting.bind(brainEngine);
  }

  if (typeof onAiProviderConnected === 'function') {
    brainEngine.onAiProviderConnected = onAiProviderConnected.bind(brainEngine);
  }

  if (typeof onAiProviderError === 'function') {
    brainEngine.onAiProviderError = onAiProviderError.bind(brainEngine);
  }

  if (typeof onAiProviderChatting === 'function') {
    brainEngine.onAiProviderChatting = onAiProviderChatting.bind(brainEngine);
  }

  if (typeof onAiProviderStreamChatting === 'function') {
    brainEngine.onAiProviderStreamChatting =
      onAiProviderStreamChatting.bind(brainEngine);
  }

  const resolvedLLMMaxTokens =
    typeof llmMaxTokens === 'number' &&
    Number.isFinite(llmMaxTokens) === true &&
    llmMaxTokens > 0
      ? llmMaxTokens
      : typeof LLMMaxTokens === 'number' &&
          Number.isFinite(LLMMaxTokens) === true &&
          LLMMaxTokens > 0
        ? LLMMaxTokens
        : DEFAULT_LLM_MAX_TOKENS;

  llm = initLLM(
    {
      llmModel,
      llmMaxTokens: resolvedLLMMaxTokens,
      LLMMaxTokens: resolvedLLMMaxTokens,
      LLMIsStream,
      onLoading(...args) {
        return brainEngine.onLlmLoading?.(...args);
      },
      onLoadProgress(...args) {
        return brainEngine.onLlmLoadProgress?.(...args);
      },
      onLoaded(...args) {
        return brainEngine.onLlmLoaded?.(...args);
      },
      onLoadError(...args) {
        return brainEngine.onLlmLoadError?.(...args);
      },
      onChatting(...args) {
        return brainEngine.onLlmChatting?.(...args);
      },
      onStreamChatting(...args) {
        return brainEngine.onLlmStreamChatting?.(...args);
      }
    },
    brainEngine
  );
  memory = initMemory({
    avatarMode: brainEngine.avatarMode,
    enableMemory:
      typeof enableMemory === 'boolean' ? enableMemory : DEFAULT_ENABLE_MEMORY,
    memoryKey,
    maxHistoryTurns,
    memoryAdapter
  });
  aiProvider = await initAiProvider({
    enableAiProvider,
    providerModel: aiProviderModel,
    providerBaseUrl: aiProviderBaseUrl,

    providerCreatedFetchSetting: aiProviderCreatedFetchSetting,
    providerCreatedFetchPayload: aiProviderCreatedFetchPayload,
    providerPingUrl: aiProviderPingUrl,
    providerChatUrl: aiProviderChatUrl,
    providerMaxTokens: aiProviderMaxTokens,
    providerIsStream: aiProviderIsStream,
    providerExtractToolCalls: aiProviderExtractToolCalls,

    onConnecting(...args) {
      return brainEngine.onAiProviderConnecting?.(...args);
    },
    onConnected(...args) {
      return brainEngine.onAiProviderConnected?.(...args);
    },
    onError(...args) {
      return brainEngine.onAiProviderError?.(...args);
    },
    onChatting(...args) {
      return brainEngine.onAiProviderChatting?.(...args);
    },
    onStreamChatting(...args) {
      return brainEngine.onAiProviderStreamChatting?.(...args);
    }
  });

  if (
    brainEngine.preloadWebLLM === true &&
    brainEngine.llm?.supported === true
  ) {
    brainEngine.llm.load().catch((error) => {
      console.warn('[initBrainEngine] Preload WebLLM failed:', error);
    });
  }

  return brainEngine;
}



/**
 * 陪伴模式的預設兜底回覆
 * @param {BrainEngine} brainEngine - 大腦引擎實例
 * @param {string} question - 使用者問題
 * @returns {string} 兜底回覆文字
 */
export function brainEngineCompanionFallback(brainEngine, question) {
  const locale = brainEngine?.locale || 'zh-TW';
  const name = brainEngine?.memory?.data?.name || '';
  const templateContext = { question, name, locale };

  if (
    typeof brainEngine?.companionFallbackContext !== 'undefined' &&
    brainEngine?.companionFallbackContext !== null
  ) {
    const resolvedFallbackText = resolveLocalized(
      brainEngine.companionFallbackContext,
      locale,
      undefined,
      templateContext
    );
    if (typeof resolvedFallbackText === 'string') {
      return resolvedFallbackText;
    }
  }

  const hasName = typeof name === 'string' && name !== '';
  let defaultList = [
    (hasName ? `${name}，` : '') + '這個我還不太會聊，但我想聽你說——多講一點？',
    '嗯嗯，我在聽。後來呢？',
    '哈，這題有點考倒我了，你怎麼看？',
    '我還在學著聊這個～對了，按 🧠 開 AI 大腦，我會聊得更順喔。'
  ];

  if (/en/i.test(locale)) {
    defaultList = [
      (hasName ? `${name}, ` : '') +
        'I am still learning to chat about this, but I would love to hear more from you!',
      'Mhm, I am listening. What happened next?',
      'Haha, this question stumped me a bit. What do you think?',
      'I am still getting the hang of this~ By the way, click 🧠 to enable AI Brain for smoother conversations.'
    ];
  } else if (/ja/i.test(locale)) {
    defaultList = [
      (hasName ? `${name}さん、` : '') +
        'それについてはまだ勉強中ですが、もっと詳しく聞かせてくれますか？',
      'うんうん、聞いていますよ。それからどうなりましたか？',
      'ふふ、ちょっと難しい質問ですね！あなたはどう思いますか？',
      'もっとスムーズに話せるよう練習中です〜 🧠 を押してAIブレインを有効にすると、より自然に会話できますよ！'
    ];
  } else if (/ko/i.test(locale)) {
    defaultList = [
      (hasName ? `${name}님, ` : '') +
        '그 부분은 아직 잘 모르지만, 더 자세히 이야기해 주실 수 있나요?',
      '네, 듣고 있어요. 그 다음엔 어떻게 되었나요?',
      '하하, 조금 어려운 질문이네요! 어떻게 생각하세요?',
      '더自然스럽게 대화하도록 배우는 중이에요~ 🧠를 눌러 AI 브레인을 켜면 더 매끄럽게 이야기할 수 있어요.'
    ];
  }

  const rawList = resolveLocalized(
    brainEngine?.companionFallback,
    locale,
    defaultList,
    templateContext
  );
  const companionFallbackList =
    Array.isArray(rawList) && rawList.length > 0 ? rawList : defaultList;

  return companionFallbackList[
    brainEngine.companionFallbackIdx++ % companionFallbackList.length
  ];
}

/**
 * 處理問題的檢索思考邏輯
 * @param {BrainEngine} brainEngine - 大腦引擎實例
 * @param {string} rawQuestion - 原始使用者問題
 * @returns {string} 回答文字
 */
export function handleThinking(brainEngine, rawQuestion) {
  const locale = brainEngine?.locale || 'zh-TW';
  const question = (rawQuestion || '').trim();
  if (question === '') {
    if (/en/i.test(locale)) {
      return "I didn't hear that clearly, could you say it again?";
    }
    if (/ja/i.test(locale)) {
      return 'うまく聞き取れませんでした。もう一度言っていただけますか？';
    }
    if (/ko/i.test(locale)) {
      return '잘 듣지 못했어요. 다시 한 번 말씀해 주시겠어요?';
    }
    return '我好像沒聽清楚，可以再說一次嗎？';
  }
  const currentAvatarMode = brainEngine?.avatarMode;
  const currentCustomMode = brainEngine?.modes?.[currentAvatarMode];

  const targetKnowledge =
    Array.isArray(currentCustomMode?.knowledge) &&
    currentCustomMode.knowledge.length > 0
      ? currentCustomMode.knowledge
      : brainEngine.knowledge;

  const site = bestOf(targetKnowledge, question);
  if (currentAvatarMode === AVATAR_MODE_MAP.companion) {
    // 陪伴模式：聊天題給陪聊腦、網站/產品題照答
    const chat = bestOf(brainEngine.companionKnowledge, question);
    if (
      chat.entry !== null &&
      chat.score >= 0.16 &&
      chat.score + 0.05 >= site.score
    ) {
      return chat.entry.a;
    }
    if (site.entry !== null && site.score >= 0.16) {
      return site.entry.a;
    }
    return brainEngineCompanionFallback(brainEngine, question);
  }
  if (site.entry !== null && site.score >= 0.16) {
    return site.entry.a;
  }

  if (
    typeof currentCustomMode?.fallback !== 'undefined' &&
    currentCustomMode?.fallback !== null
  ) {
    if (
      Array.isArray(currentCustomMode.fallback) &&
      currentCustomMode.fallback.length > 0
    ) {
      return (
        currentCustomMode.fallback[
          Math.floor(Math.random() * currentCustomMode.fallback.length)
        ] || ''
      );
    }
    const resolvedCustomFallback = resolveLocalized(
      currentCustomMode.fallback,
      locale,
      undefined,
      { question, locale }
    );
    if (typeof resolvedCustomFallback === 'string') {
      return resolvedCustomFallback;
    }
  }

  if (
    typeof brainEngine.assistantFallbackContext !== 'undefined' &&
    brainEngine.assistantFallbackContext !== null
  ) {
    const resolvedFallbackContext = resolveLocalized(
      brainEngine.assistantFallbackContext,
      locale,
      undefined,
      { question, locale }
    );
    if (typeof resolvedFallbackContext === 'string') {
      return resolvedFallbackContext;
    }
  }

  if (/en/i.test(locale)) {
    return (
      'You asked about "' +
      question +
      '", right? My knowledge base does not cover this yet. You can ask me questions like "What is this?", "How to install to project?", "Supports 3D & custom models?", or "How does the AI Brain work?".'
    );
  }
  if (/ja/i.test(locale)) {
    return (
      '「' +
      question +
      '」についてですね。知識ベースにまだ登録されていません。「これは何ですか？」「プロジェクトへの導入方法は？」「3D対応やアバター変更は？」「AIブレインの仕組みは？」などを聞いてみてください。'
    );
  }
  if (/ko/i.test(locale)) {
    return (
      '"' +
      question +
      '"에 대한 질문이시군요? 지식 베이스에 아직 등록되지 않았습니다. "이것은 무엇인가요?", "프로젝트에 어떻게 설치하나요?", "3D 지원 및 캐릭터 변경은?", "AI 브레인은 어떻게 작동하나요?" 등을 물어보실 수 있어요.'
    );
  }

  return (
    '你問的是「' +
    question +
    '」對吧？這題我的知識庫還沒收錄～你可以問我「這是什麼」「怎麼安裝到專案」「支援 3D 與換角色嗎」「AI 大腦是如何運作的」「怎麼使用工具調用」這些喔。'
  );
}

/**
 * 新增對話訊息至歷史紀錄
 * @param {BrainEngine} brainEngine - 大腦引擎實例
 * @param {string} role - 角色 ('user'|'assistant')
 * @param {string} text - 訊息內容
 * @param {Object} [options={}] - 額外選項設定
 * @param {string} [options.id] - 訊息 ID
 * @param {boolean} [options.streaming] - 是否為串流中
 * @param {Object} [options.pendingTool] - 待處理的工具
 * @param {Array} [options.pendingChoices] - 待處理的選項
 * @returns {string} 訊息 ID
 */
export function addChatMessage(brainEngine, role, text, options = {}) {
  const item = {
    id: options.id || 'm' + ++brainEngine.chatSeq,
    role: role === 'user' ? 'user' : 'assistant',
    text: String(text || '').slice(0, 4000),
    streaming: Boolean(options.streaming),
    pendingTool: options.pendingTool || null,
    pendingChoices: options.pendingChoices || null
  };
  brainEngine.chatLog.push(item);
  if (brainEngine.chatLog.length > 80) {
    brainEngine.chatLog.shift();
  }

  if (typeof brainEngine.onAddChatMessage === 'function') {
    brainEngine.onAddChatMessage(item);
  }
  if (typeof brainEngine.onChatHistoryChanged === 'function') {
    brainEngine.onChatHistoryChanged(brainEngine.chatLog);
  }
  return item.id;
}

/**
 * 更新歷史對話紀錄中的訊息
 * @param {BrainEngine} brainEngine - 大腦引擎實例
 * @param {string} id - 訊息 ID
 * @param {string} text - 更新後的文字
 * @param {boolean} streaming - 是否為串流狀態中
 * @returns {string} 訊息 ID
 */
export function updateChatMessage(brainEngine, id, text, streaming) {
  const item = brainEngine.chatLog.find((msg) => msg.id === id);
  if (item === undefined) {
    return addChatMessage(brainEngine, 'assistant', text, { id, streaming });
  }
  item.text = String(text || '').slice(0, 4000);
  item.streaming = Boolean(streaming);
  if (typeof brainEngine.onUpdateChatMessage === 'function') {
    brainEngine.onUpdateChatMessage(item);
  }
  if (typeof brainEngine.onChatHistoryChanged === 'function') {
    brainEngine.onChatHistoryChanged(brainEngine.chatLog);
  }
  return item.id;
}



/**
 * 處理模型發起的 tool_calls 迴圈 (執行工具 -> 確認/直接執行 -> 依 resultMode 決定是否發起第二輪總結)
 * @param {BrainEngine} brainEngine - 大腦引擎實例
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
        sayAnswer(brainEngine, finalText);
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
          updateChatMessage(
            brainEngine,
            streamMessageId,
            accumulatedText,
            true
          );
          brainEngine.setEmotionFromText(accumulatedText);
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
        brainEngine.memory.addTurn('assistant', finalText);
        updateChatMessage(brainEngine, streamMessageId, finalText, false);
        if (typeof brainEngine.onStreamEnd === 'function') {
          brainEngine.onStreamEnd(finalText);
        }
        maybeTriggerRollingSummary(brainEngine);
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

/**
 * 透過後端 AI 供應商回答問題
 * @param {BrainEngine} brainEngine - 大腦引擎實例
 * @param {string} question - 使用者問題
 * @returns {Promise<void>}
 */
export async function aiProviderLLMBrain(brainEngine, question) {
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
      return await handleToolCallsLoop(
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
        chatMessageId = addChatMessage(
          brainEngine,
          'assistant',
          accumulatedText
        );
        if (typeof brainEngine.setEmotionFromText === 'function') {
          brainEngine.setEmotionFromText(accumulatedText);
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
          updateChatMessage(brainEngine, chatMessageId, accumulatedText, false);
          if (typeof brainEngine.setEmotionFromText === 'function') {
            brainEngine.setEmotionFromText(nextChunk.trim());
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
        return sayAnswer(brainEngine, accumulatedText);
      } else {
        brainEngine.memory.addTurn('assistant', accumulatedText);
        maybeTriggerRollingSummary(brainEngine);
        return;
      }
    }

    return sayAnswer(brainEngine, accumulatedText);
  } catch (error) {
    console.warn('AI Provider error', error);
    throw error;
  }
}

/**
 * 透過瀏覽器端 WebLLM 引擎回答問題
 * @param {BrainEngine} brainEngine - 大腦引擎實例
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
        updateChatMessage(brainEngine, streamMessageId, accumulatedText, true);
        brainEngine.setEmotionFromText(accumulatedText);

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
      updateChatMessage(brainEngine, streamMessageId, '', false);
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
            updateChatMessage(brainEngine, streamMessageId, combinedText, true);
            brainEngine.setEmotionFromText(currentStreamText);

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

    brainEngine.memory.addTurn('assistant', accumulatedText);
    updateChatMessage(brainEngine, streamMessageId, accumulatedText, false);

    if (typeof brainEngine.onStreamEnd === 'function') {
      brainEngine.onStreamEnd(accumulatedText);
    }
    maybeTriggerRollingSummary(brainEngine);
  } catch (error) {
    console.warn('llm error', error);
    throw error;
  }
}



/**
 * 綜合處理回答流程 (AI Provider -> WebLLM -> 檢索後備)
 * @param {BrainEngine} brainEngine - 大腦引擎實例
 * @param {string} question - 使用者問題
 * @returns {Promise<void>}
 */
export async function handleAnswer(brainEngine, question) {
  const safeQuestion = (question || '').trim();
  if (safeQuestion === '') {
    if (typeof brainEngine.onSpokenAudioTextChange === 'function') {
      brainEngine.onSpokenAudioTextChange(
        getBrainMessage(brainEngine, 'brain.notClear')
      );
    }
    return;
  }

  function notifyFallback(fromEngine, toEngine, error) {
    if (typeof brainEngine.onBrainFallback === 'function') {
      try {
        brainEngine.onBrainFallback(fromEngine, toEngine, error);
      } catch (fallbackError) {
        console.error('[handleAnswer] onBrainFallback error:', fallbackError);
      }
    }
  }

  function triggerBackgroundWebLLMLoad() {
    if (
      brainEngine.autoFallbackWebLLM === true &&
      brainEngine.llm?.supported === true &&
      brainEngine.llm?.state === brainEngine.STATE_MAP.IDLE
    ) {
      brainEngine.llm.load().catch((loadError) => {
        console.warn(
          '[handleAnswer] Background WebLLM fallback loading failed:',
          loadError
        );
      });
    }
  }

  // 1) AI 伺服器大腦（最聰明，優先；整段生成後逐句講）
  if (
    brainEngine.aiProvider?.enabled === true &&
    brainEngine.aiProvider.ready === true
  ) {
    try {
      return await aiProviderLLMBrain(brainEngine, question);
    } catch (error) {
      console.warn(
        '[handleAnswer] AI Provider 呼叫失敗，嘗試降級至 WebLLM 或檢索式後備：',
        error
      );
      triggerBackgroundWebLLMLoad();
      const targetFallback =
        brainEngine.llm?.state === brainEngine.STATE_MAP.READY
          ? BRAIN_ENGINE_TYPE_MAP.WEB_LLM
          : BRAIN_ENGINE_TYPE_MAP.RETRIEVAL;
      notifyFallback(BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER, targetFallback, error);
    }
  } else if (
    brainEngine.aiProvider?.enabled === true &&
    brainEngine.aiProvider.ready === false
  ) {
    triggerBackgroundWebLLMLoad();
  }

  // 2) 瀏覽器內 WebLLM：串流 → 每切出一個完整句就丟進逐句佇列開講（首句延遲大幅縮短）
  if (brainEngine.llm?.state === brainEngine.STATE_MAP.READY) {
    try {
      return await webLLMBrain(brainEngine, question);
    } catch (error) {
      console.warn(
        '[handleAnswer] WebLLM 呼叫失敗，嘗試降級至檢索式後備：',
        error
      );
      notifyFallback(
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM,
        BRAIN_ENGINE_TYPE_MAP.RETRIEVAL,
        error
      );
    }
  }

  // 3) 檢索式後備（零金鑰、永遠可用）
  sayAnswer(brainEngine, handleThinking(brainEngine, safeQuestion));
}



/**
 * 輸出回答 (記錄、顯示、發聲)
 * @param {BrainEngine} brainEngine - 大腦引擎實例
 * @param {string} text - 回答內容
 */
export function sayAnswer(brainEngine, text) {
  if (typeof text !== 'string' || text === '') {
    return;
  }
  brainEngine.memory.addTurn('assistant', text);
  addChatMessage(brainEngine, 'assistant', text);
  if (typeof brainEngine.setEmotionFromText === 'function') {
    brainEngine.setEmotionFromText(text);
  }
  if (typeof brainEngine.onSpokenAudioPlayNow === 'function') {
    brainEngine.onSpokenAudioPlayNow(text);
  }
  maybeTriggerRollingSummary(brainEngine);
}

/**
 * 驗證自訂 Brain Engine 是否實作了必要的介面
 * @param {object} engine - 待驗證的引擎實例
 * @returns {{isValid: boolean, missing: string[]}} 驗證結果與缺少的實作名稱
 */
export function validateBrainEngine(engine) {
  if (typeof engine !== 'object' || engine === null) {
    return { isValid: false, missing: ['engine object'] };
  }
  const requiredMethods = [
    'addChatMessage',
    'updateChatMessage',
    'handleAnswer',
    'getWelcomeText',
    'buildLLMMessages',
    'classifyEmotion',
    'setEmotionFromText'
  ];
  const requiredProps = ['memory', 'llm', 'aiProvider', 'chatLog', 'chatSeq'];
  const missing = [];
  requiredMethods.forEach((methodName) => {
    if (typeof engine[methodName] !== 'function') {
      missing.push(`${methodName}()`);
    }
  });
  requiredProps.forEach((propName) => {
    if (engine[propName] === undefined) {
      missing.push(propName);
    }
  });
  return { isValid: missing.length === 0, missing };
}
