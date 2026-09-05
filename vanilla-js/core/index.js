import { initBrainEngine, validateBrainEngine } from './brain';
import { initSkinEngine, validateSkinEngine } from './skin';
import { initSpeechEngine } from './speech';
import { initI18nEngine, resolveLocalized } from './i18n';
import {
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_MAX_TOKENS,
  DEFAULT_AI_PROVIDER_MODEL,
  DEFAULT_AI_PROVIDER_MAX_TOKENS,
  DEFAULT_ENABLE_MEMORY,
  DEFAULT_MAX_HISTORY_TURNS,
  DEFAULT_MEMORY_KEY,
  STATE_MAP,
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  GENDER_MAP,
  DEFAULT_GENDER,
  DEFAULT_TTS_ENDPOINT,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE,
  BRAIN_ENGINE_TYPE_MAP,
  BRAIN_FALLBACK_TYPE_MAP,
  DEFAULT_ENABLE_MODEL_DROP,
  DEFAULT_ENABLE_AUTO_CONTINUE,
  DEFAULT_MAX_AUTO_CONTINUATIONS,
  AUTO_CONTINUE_MODE_MAP,
  DEFAULT_AUTO_CONTINUE_MODE
} from './constants';

import {
  initUi,
  renderHistory,
  renderSuggestions,
  bindTyping,
  bindUiEvent,
  initSkinModeChangeButton,
  updateUIStrings
} from './ui';
import { initToolsEngine, validateToolsEngine } from './tools';
import { createEmotionToolsPlugin } from './plugins';
import { createBaseStore } from './store';

import '../style/style.scss';

export * from './constants';
export * from './i18n';
export * from './brain';
export * from './speech';
export * from './skin';
export * from './tools';
export * from './plugins';

/**
 * @typedef {Object} CustomEnginesConfig
 * @property {Function|Object} [skin] - 自訂 Skin Engine 的建構函式或實例。
 * @property {Function|Object} [tools] - 自訂 Tools Engine 的建構函式或實例。
 * @property {Function|Object} [brain] - 自訂 Brain Engine 的建構函式或實例。
 * @property {Function|Object} [stt] - 自訂 STT (語音辨識) 引擎的建構函式或實例。
 * @property {Function|Object} [tts] - 自訂 TTS (語音合成) 引擎的建構函式或實例。
 * @property {Function|Object} [i18n] - 自訂 i18n 多語系引擎的建構函式或實例。
 */

/**
 * 角色模式型別：提供內建模式自動補全，同時允許自訂字串
 * @typedef {'assistant' | 'companion' | (string & {})} AvatarMode
 */

/**
 * @typedef {Object} AvatarBotOptions
 * @property {HTMLElement} [container=null] - 綁定 Widget 的 HTML 容器元素
 * @property {boolean} [enableAiProvider] - 是否啟用 AI 服務提供商
 * @property {string} [aiProviderBaseUrl=''] - AI 服務提供商的 API 基礎 URL
 * @property {string} [aiProviderModel=DEFAULT_AI_PROVIDER_MODEL] - 使用的 AI 服務模型名稱
 * @property {Function|RequestInit} [aiProviderCreatedFetchSetting] - 自訂 Fetch 設定的處理函式或設定物件
 * @property {Function|Record<string, any>} [aiProviderCreatedFetchPayload] - 自訂 Fetch 負載 (Payload) 的處理函式或負載物件
 * @property {number} [aiProviderMaxTokens=DEFAULT_AI_PROVIDER_MAX_TOKENS] - AI 服務回應的最大 Token 數
 * @property {boolean} [aiProviderStream] - 是否啟用 AI 服務的串流 (Streaming) 回應
 * @property {Function} [aiProviderExtractToolCalls] - AI 服務提供商自訂提取 Tool Calls 的回呼函式
 * @property {string} [neuralVoice=''] - 指定使用的神經網路語音 (Neural Voice)
 * @property {string} [knowledgeUrl=''] - 助理模式知識庫資料的 URL
 * @property {string} [companionKnowledgeUrl=''] - 陪伴模式知識庫資料的 URL
 * @property {string} [modelUrl] - 3D 或 2D 模型的 URL
 * @property {string} [ttsEndpoint=DEFAULT_TTS_ENDPOINT] - 語音合成 (TTS) 服務端點 URL (沒設會試同站相對路徑)
 * @property {string} [llmModel=DEFAULT_LLM_MODEL] - 預設的本地/遠端語言模型 (LLM) 類型
 * @property {number} [llmMaxTokens=DEFAULT_LLM_MAX_TOKENS] - WebLLM 本地模型回應的最大 Token 數
 * @property {number} [LLMMaxTokens] - WebLLM 本地模型回應的最大 Token 數 (相容別名)
 * @property {boolean} [preloadWebLLM=false] - 是否在初始化時預先載入 WebLLM 模型
 * @property {boolean} [autoFallbackWebLLM=true] - 當 AI Provider 故障時是否自動在背景載入 WebLLM 備援
 * @property {boolean} [enableAutoContinue=DEFAULT_ENABLE_AUTO_CONTINUE] - 是否在模型回答達到 Token 上限被截斷時啟用自動接續機制
 * @property {number} [maxAutoContinuations=DEFAULT_MAX_AUTO_CONTINUATIONS] - 最大自動接續次數上限（防止無限接續）
 * @property {'stream'|'buffered'} [autoContinueMode=DEFAULT_AUTO_CONTINUE_MODE] - 自動接續輸出模式 ('stream' 即時串流接續 | 'buffered' 全生成完再輸出)
 * @property {string|Function} [autoContinuePrompt] - 自訂自動接續提示詞或生成函式
 * @property {AvatarMode} [avatarMode=DEFAULT_AVATAR_MODE] - Avatar 模式（例如：assistant, companion 或自訂模式）
 * @property {boolean} [enableMemory=DEFAULT_ENABLE_MEMORY] - 是否啟用記憶體模組（多輪對話與上下文歷史）
 * @property {number} [maxHistoryTurns=DEFAULT_MAX_HISTORY_TURNS] - 保留最大歷史對話輪數
 * @property {string} [memoryKey=DEFAULT_MEMORY_KEY] - 本機儲存或識別鍵名
 * @property {Object} [memoryAdapter] - 自訂儲存轉接器實例
 * @property {Record<string, Object>} [modes] - 宣告式自訂模式註冊表
 * @property {Record<string, any>|string} [knowledge=null] - 預載的助理模式知識庫資料，可以是 JSON 物件或字串
 * @property {Record<string, any>|string} [companionKnowledge=null] - 預載的陪伴模式知識庫資料，可以是 JSON 物件或字串
 * @property {string} [startMode] - 初始啟動的模型模式 (2D 或 3D)
 * @property {string} [fitMode] - 模型適應容器的模式 (Fit Mode)
 * @property {string} [vrmUrl] - VRM 3D 模型檔案的 URL
 * @property {boolean} [enableModelDrop=DEFAULT_ENABLE_MODEL_DROP] - 是否允許使用者拖曳 VRM 模型檔案至畫布即時換裝（預設 false 關閉）
 * @property {boolean} [allowModelDrop] - 是否允許使用者拖曳 VRM 模型檔案至畫布即時換裝（enableModelDrop 的別名）
 * @property {Record<string, any>} [gesture3D] - 3D 模型使用的姿態/手勢設定資料
 * @property {Record<string, any>} [gesture2D] - 2D 模型使用的姿態資料
 * @property {boolean} [isMinimal=false] - 是否以極簡模式 (Minimal UI) 啟動
 * @property {boolean} [isIframe=false] - 是否在 Iframe 中執行
 * @property {string} [locale='zh-TW'] - 語系設定 (例如 'zh-TW', 'en-US', 'ja-JP', 'ko-KR')
 * @property {Record<string, Record<string, string>>} [i18nMessages] - 自訂的多語系翻譯字典訊息
 * @property {string} [gender=''] - 預設性別設定
 * @property {string} [brainGender=null] - 專屬大腦引擎（用語）的性別設定
 * @property {string} [speechGender=null] - 專屬語音引擎（音色）的性別設定
 * @property {string} [skinGender=null] - 專屬外觀引擎（模型外表）的性別設定
 * @property {Array<string|Record<string, any>>} [companionFallback=[]] - 陪伴模式的備用對話回覆 (Fallback) 清單
 * @property {CustomEnginesConfig} [customEngines={}] - 自訂引擎 (例如自訂 skin 引擎) 的設定物件
 * @property {Object} [compression={}] - 上下文壓縮設定 (包含 strategy, maxTurns, maxTotalChars, webLlm, aiProvider, customCompressor)
 * @property {string|Function} [systemContextTemplate] - 助理模式系統提示詞模板
 * @property {string|Function} [companionSystemContextTemplate] - 陪伴模式系統提示詞模板
 * @property {string|Function} [ragTemplate] - RAG 參考資料模板
 * @property {Record<string, any>} [customContext] - 附加自訂上下文資訊物件 (例如使用者資料、品牌背景等)
 * @property {string|Function} [languageRule] - 多語系回答規則提示詞
 * @property {string|Function} [genderRule] - 針對性別的額外系統提示詞規則
 * @property {Array<Object>} [tools] - 註冊至 Host 的工具清單 (與 hostTools 相同)
 * @property {Array<Object>} [hostTools] - 註冊至 Host 的工具清單
 * @property {boolean} [enableEmotionTools=true] - 是否啟用內建的情緒動作工具插件
 * @property {Object} [emotionToolsOptions] - 內建情緒工具插件的自訂選項
 * @property {number} [confirmationTimeoutMs] - 工具確認超時毫秒數
 * @property {number} [toolConfirmationTimeoutMs] - 工具確認超時毫秒數 (別名)
 * @property {Function} [buildLLMMessages] - 自訂組裝 LLM 訊息格式的函式
 * @property {string} [welcomeText] - 通用歡迎詞文字
 * @property {string} [companionWelcomeText] - 陪伴模式專用歡迎詞文字
 * @property {string} [assistantWelcomeText] - 助理模式專用歡迎詞文字
 * @property {string} [greeting] - 通用問候語音文字
 * @property {string} [companionGreeting] - 陪伴模式專用問候語音文字
 * @property {string} [assistantGreeting] - 助理模式專用問候語音文字
 * @property {Function} [onReady] - Bot 初始化完成且掛載後的回呼函式
 * @property {Function} [onMinimalTrigger] - 切換極簡模式時的回呼函式
 * @property {Function} [onError] - 發生錯誤時的回呼函式
 * @property {Function} [onLlmLoading] - LLM 模型開始載入時的回呼函式
 * @property {Function} [onLlmLoadProgress] - LLM 模型載入進度更新時的回呼函式
 * @property {Function} [onLlmLoaded] - LLM 模型載入完成時的回呼函式
 * @property {Function} [onLlmLoadError] - LLM 模型載入失敗時的回呼函式
 * @property {Function} [onAiProviderConnecting] - 遠端 AI 服務連線中回呼函式
 * @property {Function} [onAiProviderConnected] - 遠端 AI 服務連線成功回呼函式
 * @property {Function} [onAddChatMessage] - 新增對話訊息時的回呼函式
 * @property {Function} [onUpdateChatMessage] - 更新對話訊息時的回呼函式
 * @property {Function} [onChatHistoryChanged] - 對話歷史紀錄變更時的回呼函式
 * @property {Function} [onSpokenDisplayTextChange] - 語音文字氣泡內容變更時的回呼函式
 * @property {Function} [onSpokenDisplayTextTimeout] - 語音文字氣泡顯示逾時的回呼函式
 * @property {Function} [onMicStateChanged] - 麥克風狀態變更時的回呼函式
 * @property {Function} [onVoiceStatusChanged] - 語音對話狀態變更時的回呼函式
 * @property {Function} [onLanguageChanged] - 介面語言變更時的回呼函式
 * @property {Function} [onSpeaking] - 開始播放語音時的回呼函式
 * @property {Function} [onSpeakingEnd] - 語音播放結束時的回呼函式
 * @property {(fullText: string) => void} [onStreamEnd] - 大腦 LLM 串流文字回答生成完畢時的回呼函式 (fullText)
 * @property {Function} [onAutoContinueStart] - 自動接續開始時的回呼函式 (info: { continuationIndex: number, maxContinuations: number, accumulatedText: string })
 * @property {Function} [onAutoContinueWait] - 語音播完但接續內容仍在生成中（空窗期）時的回呼函式 (info: { continuationIndex: number, maxContinuations: number, accumulatedText: string })
 * @property {Function} [onAutoContinueResume] - 接續內容已抵達並恢復播放時的回呼函式 (info: { continuationIndex: number, maxContinuations: number, accumulatedText: string, chunk: string })
 * @property {Function} [onAutoContinueEnd] - 自動接續流程結束時的回呼函式 (info: { totalContinuations: number, maxContinuations: number, accumulatedText: string, reason: string })
 * @property {Function} [onSummaryUpdated] - 滾動對話摘要更新時的回呼函式 (summary)
 * @property {Function} [onBrainFallback] - 大腦引擎降級時觸發的回呼函式 (fromEngine, toEngine, error)
 * @property {Function} [onToolCall] - 觸發外部工具 (Tool Call) 時的回呼函式
 * @property {(info: { toolName: string, args: Object, toolCall: Object }, widget: AiAvatarWidget) => any} [onToolNotFound] - 當 AI 請求呼叫未註冊的工具時觸發的回呼函式（可回傳自訂結果供模型第二輪生成回答）
 * @property {(info: { tool: Object, toolName: string, args: Object, toolCall: Object, error: Error }, widget: AiAvatarWidget) => any} [onToolError] - 當工具執行發生錯誤時觸發的回呼函式（可回傳自訂錯誤結果供模型生成回答）
 * @property {Function} [onSetHistoryOpen] - 開關歷史紀錄面板時的回呼函式
 * @property {Function} [onRenderHistory] - 歷史紀錄渲染更新時的回呼函式
 * @property {Function} [onSpokenAudioPlayNow] - 觸發發音時的回呼函式
 * @property {Function} [onThreeDimensionalError] - 3D 引擎發生錯誤時的回呼函式
 * @property {Function} [onTwoDimensionalError] - 2D 引擎發生錯誤時的回呼函式
 * @property {Function} [VRMFileChangeFail] - 替換 VRM 模型檔案失敗時的回呼函式
 * @property {Function} [VRMFileChangeSuccess] - 替換 VRM 模型檔案成功時的回呼函式
 * @property {Function} [onModelChangeStart] - 2D/3D 模型切換開始時的回呼函式
 * @property {Function} [onModelChangeEnd] - 2D/3D 模型切換結束時的回呼函式
 */

/**
 * @typedef {Object} AiAvatarWidget
 * @property {AvatarBotOptions} options - 傳入的初始化設定選項
 * @property {string} DEFAULT_LLM_MODEL - 預設的 LLM 模型名稱
 * @property {Record<string, string>} STATE_MAP - 狀態映射表
 * @property {Record<string, string>} ENGINE_MODE_MAP - 引擎模式映射表
 * @property {Record<string, string>} AVATAR_MODE_MAP - Avatar 模式映射表
 * @property {Record<string, string>} FIT_MODE_MAP - Fit 模式映射表
 * @property {Record<string, string>} AUTO_CONTINUE_MODE_MAP - 自動接續模式映射表
 * @property {Array<string>} availableModes - 目前可用角色模式清單
 * @property {boolean} enableMemory - 目前是否啟用記憶體
 * @property {boolean} enableAiProvider - 目前是否啟用 AI 服務提供商
 * @property {boolean} preloadWebLLM - 是否預先載入 WebLLM 模型
 * @property {boolean} autoFallbackWebLLM - 是否自動在背景載入 WebLLM 備援
 * @property {boolean} enableAutoContinue - 當前是否啟用自動接續
 * @property {number} maxAutoContinuations - 當前最大自動接續次數
 * @property {'stream'|'buffered'} autoContinueMode - 當前自動接續輸出模式

 * @property {HTMLElement} container - 綁定 Widget 的 HTML 容器元素
 * @property {any} uiDom - UI 相關的 DOM 元素與控制方法
 * @property {any} i18nEngine - i18n 多語系引擎實例
 * @property {any} toolsEngine - 外部工具 (Tools) 引擎實例
 * @property {Function} buildLLMMessages - 組裝 LLM 訊息的函式
 * @property {Function} classifyEmotion - 情感分類函式
 * @property {Function} setEmotionFromText - 根據文字設定情感的函式
 * @property {(text: string) => Promise<void>|void} handleUser - 處理使用者輸入文字的主方法
 * @property {boolean} isIframe - 是否在 Iframe 內
 * @property {boolean} isMinimal - 是否處於極簡模式
 * @property {string} gender - 目前性別
 * @property {string|null} brainGender - 大腦引擎性別設定
 * @property {string|null} speechGender - 語音引擎性別設定
 * @property {string|null} skinGender - 外觀引擎性別設定
 * @property {string} locale - 當前語系代碼
 * @property {AvatarMode} avatarMode - 目前 Avatar 模式
 * @property {Function} showMinimalEl - 顯示極簡模式元素的函式
 * @property {Function} hiddenMinimalEl - 隱藏極簡模式元素的函式
 * @property {any} brainEngine - AI 大腦引擎實例
 * @property {any} speechEngine - 語音引擎實例
 * @property {any} skinEngine - Skin (模型與畫面) 引擎實例
 * @property {Function} [onReady] - Bot 初始化完成後掛載的回呼函式
 * @property {Function} [onMinimalTrigger] - 切換極簡模式的回呼函式
 * @property {Function} [onError] - 發生錯誤時的回呼函式
 */

/**
 * 初始化 AI Avatar Bot 實例
 *
 * @param {AvatarBotOptions} [options={}] - 初始化設定選項
 * @returns {Promise<AiAvatarWidget|void>} 回傳初始化完成的 `AiAvatarWidget` 實例，包含操作介面、大腦、語音、皮膚等引擎的屬性與方法；如果在非瀏覽器環境下執行會回傳 undefined。
 * @throws {Error} 當傳入的 container 不是 HTMLElement 時拋出錯誤
 */
export async function initAvatarBot(options = {}) {
  if (typeof window !== 'object') {
    return;
  }

  function callOptionEvent(eventName, ...eventArguments) {
    if (typeof options[eventName] === 'function') {
      return options[eventName].call(this, ...eventArguments);
    }
  }

  const {
    container = null,
    enableAiProvider,
    aiProviderBaseUrl = '',
    aiProviderModel = DEFAULT_AI_PROVIDER_MODEL,
    aiProviderCreatedFetchSetting,
    aiProviderCreatedFetchPayload,
    aiProviderMaxTokens,
    aiProviderStream,
    neuralVoice = '',
    knowledgeUrl = '',
    companionKnowledgeUrl = '',
    modelUrl,
    ttsEndpoint = DEFAULT_TTS_ENDPOINT, // 沒設→試同站相對路徑；抓不到→自動退回瀏覽器語音（純前端可用）
    llmModel = DEFAULT_LLM_MODEL,
    llmMaxTokens,
    LLMMaxTokens,
    preloadWebLLM = false,
    autoFallbackWebLLM = true,
    enableAutoContinue = DEFAULT_ENABLE_AUTO_CONTINUE,
    maxAutoContinuations = DEFAULT_MAX_AUTO_CONTINUATIONS,
    autoContinueMode = DEFAULT_AUTO_CONTINUE_MODE,
    autoContinuePrompt,
    avatarMode = DEFAULT_AVATAR_MODE,
    enableMemory = DEFAULT_ENABLE_MEMORY,
    maxHistoryTurns = DEFAULT_MAX_HISTORY_TURNS,
    memoryKey = DEFAULT_MEMORY_KEY,
    memoryAdapter = null,
    modes = null,
    knowledge = null,
    companionKnowledge = null,
    startMode,
    fitMode,
    vrmUrl,
    enableModelDrop = DEFAULT_ENABLE_MODEL_DROP,
    allowModelDrop,
    gesture3D,
    gesture2D,
    isMinimal = false,
    isIframe = false,
    locale = 'zh-TW',
    gender = '',
    brainGender = null,
    speechGender = null,
    skinGender = null,
    companionFallback = [],
    customEngines = {},
    compression = {},
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext,
    languageRule,
    genderRule
  } = options;

  if (container instanceof HTMLElement === false) {
    throw new Error('container must be an HTMLElement');
  }

  const customModeKeys =
    typeof modes === 'object' && modes !== null ? Object.keys(modes) : [];
  const initialAvailableModes = Array.from(
    new Set([...Object.values(AVATAR_MODE_MAP), ...customModeKeys])
  );

  const targetAvatarMode =
    typeof avatarMode === 'string' && avatarMode !== ''
      ? avatarMode
      : DEFAULT_AVATAR_MODE;
  if (initialAvailableModes.includes(targetAvatarMode) === false) {
    throw new TypeError(
      `[ai-avatar-bot] Invalid avatarMode "${targetAvatarMode}". Expected one of: [${initialAvailableModes.join(', ')}].`
    );
  }

  let safeGender = DEFAULT_GENDER;
  if (gender === GENDER_MAP.female || gender === GENDER_MAP.male) {
    safeGender = gender;
  }

  let safeNeuralVoice = neuralVoice;
  if (typeof neuralVoice !== 'string' || neuralVoice === '') {
    if (safeGender === GENDER_MAP.female) {
      safeNeuralVoice = DEFAULT_FEMALE_NEURAL_VOICE;
    } else {
      safeNeuralVoice = DEFAULT_MALE_NEURAL_VOICE;
    }
  }

  let initialMinimal = false;
  if (isIframe === true) {
    initialMinimal = false;
  } else if (isMinimal === true) {
    initialMinimal = true;
  }

  let uiDom = null;

  let brainEngine = null;
  let speechEngine = null;
  let skinEngine = null;
  let toolsEngine = null;

  let i18nEngine = null;
  if (
    typeof customEngines?.i18n === 'function' ||
    (typeof customEngines?.i18n === 'object' && customEngines?.i18n !== null)
  ) {
    i18nEngine =
      typeof customEngines.i18n === 'function'
        ? customEngines.i18n({
            locale:
              typeof locale === 'string' && locale !== '' ? locale : 'zh-TW',
            messages: options.i18nMessages
          })
        : customEngines.i18n;
  } else {
    i18nEngine = initI18nEngine({
      locale: typeof locale === 'string' && locale !== '' ? locale : 'zh-TW',
      messages: options.i18nMessages
    });
  }

  const isModelDropEnabled =
    typeof allowModelDrop === 'boolean'
      ? allowModelDrop
      : typeof enableModelDrop === 'boolean'
        ? enableModelDrop
        : DEFAULT_ENABLE_MODEL_DROP;

  const rootStore = createBaseStore({
    gender: safeGender,
    brainGender:
      typeof brainGender === 'string' &&
      brainGender !== '' &&
      Object.values(GENDER_MAP).includes(brainGender)
        ? brainGender
        : null,
    speechGender:
      typeof speechGender === 'string' &&
      speechGender !== '' &&
      Object.values(GENDER_MAP).includes(speechGender)
        ? speechGender
        : null,
    skinGender:
      typeof skinGender === 'string' &&
      skinGender !== '' &&
      Object.values(GENDER_MAP).includes(skinGender)
        ? skinGender
        : null,
    avatarMode: targetAvatarMode,
    enableMemory:
      typeof enableMemory === 'boolean' ? enableMemory : DEFAULT_ENABLE_MEMORY,
    enableAiProvider:
      typeof enableAiProvider === 'boolean'
        ? enableAiProvider
        : typeof aiProviderBaseUrl === 'string' && aiProviderBaseUrl !== '',
    preloadWebLLM: typeof preloadWebLLM === 'boolean' ? preloadWebLLM : false,
    autoFallbackWebLLM:
      typeof autoFallbackWebLLM === 'boolean' ? autoFallbackWebLLM : true,
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
      typeof autoContinueMode === 'string' &&
      Object.values(AUTO_CONTINUE_MODE_MAP).includes(autoContinueMode) === true
        ? autoContinueMode
        : DEFAULT_AUTO_CONTINUE_MODE,
    modes: typeof modes === 'object' && modes !== null ? modes : {},
    locale:
      typeof i18nEngine?.locale === 'string' && i18nEngine.locale !== ''
        ? i18nEngine.locale
        : typeof locale === 'string' && locale !== ''
          ? locale
          : 'zh-TW',
    enableModelDrop: isModelDropEnabled
  });

  const aiAvatarWidget = {
    get options() {
      return options;
    },
    get optiopns() {
      return options;
    },

    get DEFAULT_LLM_MODEL() {
      return DEFAULT_LLM_MODEL;
    },
    get STATE_MAP() {
      return STATE_MAP;
    },
    get ENGINE_MODE_MAP() {
      return ENGINE_MODE_MAP;
    },
    get AVATAR_MODE_MAP() {
      return AVATAR_MODE_MAP;
    },
    get FIT_MODE_MAP() {
      return FIT_MODE_MAP;
    },
    get BRAIN_ENGINE_TYPE_MAP() {
      return BRAIN_ENGINE_TYPE_MAP;
    },
    get BRAIN_FALLBACK_TYPE_MAP() {
      return BRAIN_FALLBACK_TYPE_MAP;
    },
    get AUTO_CONTINUE_MODE_MAP() {
      return AUTO_CONTINUE_MODE_MAP;
    },

    get container() {
      return container;
    },

    get uiDom() {
      return uiDom;
    },

    get i18nEngine() {
      return i18nEngine;
    },

    get toolsEngine() {
      return toolsEngine;
    },

    get buildLLMMessages() {
      return aiAvatarWidget.brainEngine.buildLLMMessages;
    },

    get classifyEmotion() {
      return aiAvatarWidget.brainEngine.classifyEmotion;
    },

    get setEmotionFromText() {
      return aiAvatarWidget.brainEngine.setEmotionFromText;
    },

    handleUser: (text) => {
      return handleUser(text);
    },

    get isIframe() {
      return isIframe;
    },

    _isMinimal: initialMinimal,
    get isMinimal() {
      return this._isMinimal;
    },
    set isMinimal(newIsMinimal) {
      if (typeof newIsMinimal === 'boolean') {
        this._isMinimal = newIsMinimal;

        if (typeof this.onMinimalTrigger === 'function') {
          this.onMinimalTrigger(newIsMinimal, this);
        }

        if (newIsMinimal === false) {
          this.hiddenMinimalEl();
        } else {
          this.showMinimalEl();
        }
      }
    },
    showMinimalEl() {
      this.skinEngine.stageEl.style.left = '100vw';
      this.skinEngine.stageEl.style.opacity = 0;
      this.skinEngine.stageEl.style.userSelect = 'none';
      // this.skinEngine.stageEl.style.display = "none";
      this.uiDom.minimalEl.style.display = 'flex';
    },
    hiddenMinimalEl() {
      this.skinEngine.stageEl.style.left = '';
      this.skinEngine.stageEl.style.opacity = 1;
      this.skinEngine.stageEl.style.userSelect = 'auto';
      // this.skinEngine.stageEl.style.display = "block";
      this.uiDom.minimalEl.style.display = 'none';
    },

    get gender() {
      return rootStore.getState().gender;
    },
    set gender(newGender = '') {
      if (
        typeof newGender === 'string' &&
        newGender !== '' &&
        Object.values(GENDER_MAP).includes(newGender)
      ) {
        rootStore.setState({ gender: newGender });
      }
    },

    get brainGender() {
      return rootStore.getState().brainGender;
    },
    set brainGender(newBrainGender = null) {
      if (
        newBrainGender === null ||
        (typeof newBrainGender === 'string' &&
          newBrainGender !== '' &&
          Object.values(GENDER_MAP).includes(newBrainGender))
      ) {
        rootStore.setState({ brainGender: newBrainGender });
      }
    },

    get speechGender() {
      return rootStore.getState().speechGender;
    },
    set speechGender(newSpeechGender = null) {
      if (
        newSpeechGender === null ||
        (typeof newSpeechGender === 'string' &&
          newSpeechGender !== '' &&
          Object.values(GENDER_MAP).includes(newSpeechGender))
      ) {
        rootStore.setState({ speechGender: newSpeechGender });
      }
    },

    get skinGender() {
      return rootStore.getState().skinGender;
    },
    set skinGender(newSkinGender = null) {
      if (
        newSkinGender === null ||
        (typeof newSkinGender === 'string' &&
          newSkinGender !== '' &&
          Object.values(GENDER_MAP).includes(newSkinGender))
      ) {
        rootStore.setState({ skinGender: newSkinGender });
      }
    },

    get locale() {
      return typeof i18nEngine?.locale === 'string' && i18nEngine.locale !== ''
        ? i18nEngine.locale
        : rootStore.getState().locale;
    },
    set locale(newLocale = '') {
      if (typeof newLocale === 'string' && newLocale !== '') {
        if (
          i18nEngine !== null &&
          typeof i18nEngine === 'object' &&
          typeof i18nEngine.setLocale === 'function'
        ) {
          i18nEngine.setLocale(newLocale);
        } else {
          rootStore.setState({ locale: newLocale });
        }
      }
    },

    get availableModes() {
      const currentModes = rootStore.getState().modes || {};
      return Array.from(
        new Set([
          ...Object.values(AVATAR_MODE_MAP),
          ...Object.keys(currentModes)
        ])
      );
    },

    get avatarMode() {
      return rootStore.getState().avatarMode;
    },
    set avatarMode(targetAvatarMode = '') {
      if (typeof targetAvatarMode === 'string' && targetAvatarMode !== '') {
        const currentAvailableModes = this.availableModes;
        if (currentAvailableModes.includes(targetAvatarMode) === false) {
          throw new TypeError(
            `[ai-avatar-bot] Invalid avatarMode "${targetAvatarMode}". Expected one of: [${currentAvailableModes.join(', ')}].`
          );
        }
        rootStore.setState({ avatarMode: targetAvatarMode });
      }
    },

    get enableMemory() {
      return (
        brainEngine?.memory?.enabled ??
        rootStore.getState().enableMemory ??
        DEFAULT_ENABLE_MEMORY
      );
    },
    set enableMemory(newEnableMemory) {
      if (typeof newEnableMemory === 'boolean') {
        rootStore.setState({ enableMemory: newEnableMemory });
        if (
          brainEngine?.memory !== null &&
          typeof brainEngine?.memory === 'object'
        ) {
          brainEngine.memory.enabled = newEnableMemory;
        }
      }
    },

    get enableAiProvider() {
      return (
        brainEngine?.enableAiProvider ??
        rootStore.getState().enableAiProvider ??
        false
      );
    },
    set enableAiProvider(newEnableAiProvider) {
      if (typeof newEnableAiProvider === 'boolean') {
        rootStore.setState({ enableAiProvider: newEnableAiProvider });
        if (brainEngine !== null && typeof brainEngine === 'object') {
          brainEngine.enableAiProvider = newEnableAiProvider;
        }
      }
    },

    get preloadWebLLM() {
      return (
        brainEngine?.preloadWebLLM ??
        rootStore.getState().preloadWebLLM ??
        false
      );
    },
    set preloadWebLLM(newPreloadWebLLM) {
      if (typeof newPreloadWebLLM === 'boolean') {
        rootStore.setState({ preloadWebLLM: newPreloadWebLLM });
        if (brainEngine !== null && typeof brainEngine === 'object') {
          brainEngine.preloadWebLLM = newPreloadWebLLM;
        }
      }
    },

    get autoFallbackWebLLM() {
      return (
        brainEngine?.autoFallbackWebLLM ??
        rootStore.getState().autoFallbackWebLLM ??
        true
      );
    },
    set autoFallbackWebLLM(newAutoFallbackWebLLM) {
      if (typeof newAutoFallbackWebLLM === 'boolean') {
        rootStore.setState({ autoFallbackWebLLM: newAutoFallbackWebLLM });
        if (brainEngine !== null && typeof brainEngine === 'object') {
          brainEngine.autoFallbackWebLLM = newAutoFallbackWebLLM;
        }
      }
    },

    get enableAutoContinue() {
      return (
        brainEngine?.enableAutoContinue ??
        rootStore.getState().enableAutoContinue ??
        DEFAULT_ENABLE_AUTO_CONTINUE
      );
    },
    set enableAutoContinue(newEnableAutoContinue) {
      if (typeof newEnableAutoContinue === 'boolean') {
        rootStore.setState({ enableAutoContinue: newEnableAutoContinue });
        if (brainEngine !== null && typeof brainEngine === 'object') {
          brainEngine.enableAutoContinue = newEnableAutoContinue;
        }
      }
    },

    get maxAutoContinuations() {
      return (
        brainEngine?.maxAutoContinuations ??
        rootStore.getState().maxAutoContinuations ??
        DEFAULT_MAX_AUTO_CONTINUATIONS
      );
    },
    set maxAutoContinuations(newMax) {
      if (
        typeof newMax === 'number' &&
        Number.isFinite(newMax) === true &&
        newMax > 0
      ) {
        rootStore.setState({ maxAutoContinuations: newMax });
        if (brainEngine !== null && typeof brainEngine === 'object') {
          brainEngine.maxAutoContinuations = newMax;
        }
      }
    },

    get autoContinueMode() {
      return (
        brainEngine?.autoContinueMode ??
        rootStore.getState().autoContinueMode ??
        DEFAULT_AUTO_CONTINUE_MODE
      );
    },
    set autoContinueMode(newMode) {
      if (
        typeof newMode === 'string' &&
        Object.values(AUTO_CONTINUE_MODE_MAP).includes(newMode) === true
      ) {
        rootStore.setState({ autoContinueMode: newMode });
        if (brainEngine !== null && typeof brainEngine === 'object') {
          brainEngine.autoContinueMode = newMode;
        }
      }
    },

    get enableModelDrop() {
      return rootStore.getState().enableModelDrop ?? DEFAULT_ENABLE_MODEL_DROP;
    },
    set enableModelDrop(newEnableModelDrop) {
      if (typeof newEnableModelDrop === 'boolean') {
        rootStore.setState({ enableModelDrop: newEnableModelDrop });
        if (typeof updateModelDropListeners === 'function') {
          updateModelDropListeners(newEnableModelDrop);
        }
      }
    },

    get brainEngine() {
      return brainEngine;
    },
    get speechEngine() {
      return speechEngine;
    },
    get skinEngine() {
      return skinEngine;
    },

    get suggestedQuestions() {
      return options.suggestedQuestions;
    },
    get companionSuggestedQuestions() {
      return options.companionSuggestedQuestions;
    },
    get assistantSuggestedQuestions() {
      return options.assistantSuggestedQuestions;
    },
    get suggestedTitle() {
      return options.suggestedTitle;
    },
    get companionSuggestedTitle() {
      return options.companionSuggestedTitle;
    },
    get assistantSuggestedTitle() {
      return options.assistantSuggestedTitle;
    }
  };

  rootStore.subscribe('avatarMode', (newAvatarMode) => {
    if (
      typeof aiAvatarWidget.brainEngine === 'object' &&
      aiAvatarWidget.brainEngine !== null
    ) {
      aiAvatarWidget.brainEngine.avatarMode = newAvatarMode;
    }
    renderSuggestions(aiAvatarWidget);
    if (typeof uiDom?.updateMicState === 'function') {
      const isCompanion = newAvatarMode === AVATAR_MODE_MAP.companion;
      uiDom.updateMicState(
        aiAvatarWidget.speechEngine?.isListening,
        aiAvatarWidget.speechEngine?.convoOn,
        isCompanion,
        i18nEngine
      );
    }
  });

  rootStore.subscribe('enableMemory', (newEnableMemory) => {
    if (
      typeof aiAvatarWidget.brainEngine?.memory === 'object' &&
      aiAvatarWidget.brainEngine?.memory !== null
    ) {
      aiAvatarWidget.brainEngine.memory.enabled = newEnableMemory;
    }
  });

  rootStore.subscribe('enableAiProvider', (newEnableAiProvider) => {
    if (
      typeof aiAvatarWidget.brainEngine === 'object' &&
      aiAvatarWidget.brainEngine !== null
    ) {
      aiAvatarWidget.brainEngine.enableAiProvider = newEnableAiProvider;
    }
  });

  rootStore.subscribe('preloadWebLLM', (newPreloadWebLLM) => {
    if (
      typeof aiAvatarWidget.brainEngine === 'object' &&
      aiAvatarWidget.brainEngine !== null
    ) {
      aiAvatarWidget.brainEngine.preloadWebLLM = newPreloadWebLLM;
    }
  });

  rootStore.subscribe('autoFallbackWebLLM', (newAutoFallbackWebLLM) => {
    if (
      typeof aiAvatarWidget.brainEngine === 'object' &&
      aiAvatarWidget.brainEngine !== null
    ) {
      aiAvatarWidget.brainEngine.autoFallbackWebLLM = newAutoFallbackWebLLM;
    }
  });

  rootStore.subscribe('enableAutoContinue', (newEnableAutoContinue) => {
    if (
      typeof aiAvatarWidget.brainEngine === 'object' &&
      aiAvatarWidget.brainEngine !== null
    ) {
      aiAvatarWidget.brainEngine.enableAutoContinue = newEnableAutoContinue;
    }
  });

  rootStore.subscribe('maxAutoContinuations', (newMaxAutoContinuations) => {
    if (
      typeof aiAvatarWidget.brainEngine === 'object' &&
      aiAvatarWidget.brainEngine !== null
    ) {
      aiAvatarWidget.brainEngine.maxAutoContinuations = newMaxAutoContinuations;
    }
  });

  rootStore.subscribe('autoContinueMode', (newAutoContinueMode) => {
    if (
      typeof aiAvatarWidget.brainEngine === 'object' &&
      aiAvatarWidget.brainEngine !== null
    ) {
      aiAvatarWidget.brainEngine.autoContinueMode = newAutoContinueMode;
    }
  });

  rootStore.subscribe('gender', (newGender) => {
    const state = rootStore.getState();
    if (
      state.brainGender === null &&
      typeof aiAvatarWidget.brainEngine?.setGender === 'function'
    ) {
      aiAvatarWidget.brainEngine.setGender(newGender);
    }
    if (
      state.speechGender === null &&
      typeof aiAvatarWidget.speechEngine?.setGender === 'function'
    ) {
      aiAvatarWidget.speechEngine.setGender(newGender);
    }
    if (
      state.skinGender === null &&
      typeof aiAvatarWidget.skinEngine?.setGender === 'function'
    ) {
      aiAvatarWidget.skinEngine.setGender(newGender);
    }
  });

  rootStore.subscribe('brainGender', (newBrainGender) => {
    const state = rootStore.getState();
    const resolvedGender =
      typeof newBrainGender === 'string' && newBrainGender !== ''
        ? newBrainGender
        : state.gender;
    if (typeof aiAvatarWidget.brainEngine?.setGender === 'function') {
      aiAvatarWidget.brainEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('speechGender', (newSpeechGender) => {
    const state = rootStore.getState();
    const resolvedGender =
      typeof newSpeechGender === 'string' && newSpeechGender !== ''
        ? newSpeechGender
        : state.gender;
    if (typeof aiAvatarWidget.speechEngine?.setGender === 'function') {
      aiAvatarWidget.speechEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('skinGender', (newSkinGender) => {
    const state = rootStore.getState();
    const resolvedGender =
      typeof newSkinGender === 'string' && newSkinGender !== ''
        ? newSkinGender
        : state.gender;
    if (typeof aiAvatarWidget.skinEngine?.setGender === 'function') {
      aiAvatarWidget.skinEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('locale', (newLocale) => {
    if (typeof aiAvatarWidget.brainEngine?.setLocale === 'function') {
      aiAvatarWidget.brainEngine.setLocale(newLocale);
    }
    if (typeof aiAvatarWidget.speechEngine?.setLocale === 'function') {
      aiAvatarWidget.speechEngine.setLocale(newLocale);
    }
  });

  if (
    typeof i18nEngine === 'object' &&
    i18nEngine !== null &&
    typeof i18nEngine.subscribe === 'function'
  ) {
    i18nEngine.subscribe('locale', (newLocale, localeLabels) => {
      rootStore.setState({ locale: newLocale });
      if (typeof aiAvatarWidget.brainEngine?.setLocale === 'function') {
        aiAvatarWidget.brainEngine.setLocale(newLocale);
      }
      if (typeof aiAvatarWidget.speechEngine?.setLocale === 'function') {
        aiAvatarWidget.speechEngine.setLocale(newLocale);
      }
      updateUIStrings(container, i18nEngine);
      if (typeof uiDom?.updateMicState === 'function') {
        const isCompanion =
          rootStore.getState().avatarMode === AVATAR_MODE_MAP.companion;
        uiDom.updateMicState(
          aiAvatarWidget.speechEngine?.isListening,
          aiAvatarWidget.speechEngine?.convoOn,
          isCompanion,
          i18nEngine
        );
      }
      if (typeof uiDom?.updateVoiceStatus === 'function') {
        uiDom.updateVoiceStatus(
          aiAvatarWidget.speechEngine?.convoOn,
          undefined,
          undefined,
          undefined,
          i18nEngine
        );
      }
      renderSuggestions(aiAvatarWidget);
      if (uiDom?.langButtonEl instanceof HTMLButtonElement) {
        uiDom.langButtonEl.textContent =
          typeof localeLabels?.shortLabel === 'string' &&
          localeLabels.shortLabel !== ''
            ? localeLabels.shortLabel
            : typeof localeLabels?.label === 'string' &&
                localeLabels.label !== ''
              ? localeLabels.label
              : newLocale;
      }
      callOptionEvent.call(
        aiAvatarWidget,
        'onLanguageChanged',
        newLocale,
        localeLabels?.label,
        localeLabels?.shortLabel
      );
    });
  }

  const stageEl = document.createElement('div');
  stageEl.setAttribute('id', 'stage');
  uiDom = initUi(container, stageEl, i18nEngine);

  let streamSpeechId = 0;
  const streamSpeechState = { sentenceBuffer: '', buf: '' };

  function handleUser(text = '') {
    if (typeof text === 'string' && text !== '') {
      if (typeof speechEngine.stopSpeaking === 'function') {
        speechEngine.stopSpeaking();
      }
      brainEngine.addChatMessage('user', text);
      speechEngine.spokenDisplayText =
        typeof i18nEngine?.t === 'function'
          ? i18nEngine.t('brain.userPrefix', { text })
          : '你：' + text;
    }

    if (
      typeof text === 'string' &&
      text !== '' &&
      typeof toolsEngine.pendingToolConfirmation === 'string' &&
      toolsEngine.pendingToolConfirmation !== '' &&
      toolsEngine.continueToolConfirmation(text) === true
    ) {
      return;
    }
    if (
      typeof text === 'string' &&
      text !== '' &&
      typeof toolsEngine.pendingToolChoice === 'object' &&
      toolsEngine.pendingToolChoice !== null &&
      toolsEngine.continueToolChoice(text) === true
    ) {
      return;
    }
    if (
      typeof text === 'string' &&
      text !== '' &&
      typeof toolsEngine.pendingToolInput === 'object' &&
      toolsEngine.pendingToolInput !== null &&
      toolsEngine.continueToolInput(text) === true
    ) {
      return;
    }

    if (
      brainEngine?.memory?.enabled === true &&
      typeof text === 'string' &&
      text !== ''
    ) {
      if (/忘記我|清除記憶|forget me/i.test(text) === true) {
        brainEngine.memory.wipe();
        speechEngine.spokenAudioText =
          typeof i18nEngine?.t === 'function'
            ? i18nEngine.t('brain.wipeMemory')
            : '好，我把記憶都清掉了，我們重新認識吧！';
        return;
      }
      brainEngine.memory.captureName(text);
      brainEngine.memory.addTurn('user', text);
    }

    const routedTool = toolsEngine.routeHostTool(text);
    if (
      Array.isArray(routedTool.ambiguous) === true &&
      routedTool.ambiguous.length > 0
    ) {
      speechEngine.isProcessing = false;
      toolsEngine.offerToolChoices(text, routedTool.ambiguous);
      return;
    }
    if (typeof routedTool.match === 'object' && routedTool.match !== null) {
      speechEngine.isProcessing = false;
      toolsEngine.prepareTool(
        routedTool.match.tool,
        text,
        { confidence: routedTool.match.score, reason: routedTool.match.reason },
        {
          skinEngine,
          brainEngine,
          speechEngine,
          aiAvatarWidget,
          store: rootStore,
          i18nEngine
        }
      );
      return;
    }

    speechEngine.isProcessing = true;

    if (
      typeof skinEngine === 'object' &&
      skinEngine !== null &&
      skinEngine.gestureName !== undefined
    ) {
      skinEngine.gestureName = 'thinking';
    }

    brainEngine.handleAnswer(text);
  }

  function onTapAvatar() {
    callOptionEvent.call(aiAvatarWidget, 'onTapAvatar');
    if (speechEngine.onTapTimer === true) {
      return;
    }
    speechEngine.onTapTimer = true;
    setTimeout(() => {
      speechEngine.onTapTimer = false;
    }, 400);

    if (
      typeof skinEngine.avatarModel === 'object' &&
      skinEngine.avatarModel !== null
    ) {
      try {
        skinEngine.avatarModel.motion('Tap');
      } catch (_error) {}
    }

    let greeting = '你好～';
    const currentLocale =
      typeof i18nEngine?.locale === 'string' && i18nEngine.locale !== ''
        ? i18nEngine.locale
        : typeof rootStore.getState().locale === 'string' &&
            rootStore.getState().locale !== ''
          ? rootStore.getState().locale
          : 'zh-TW';
    const currentAvatarMode = rootStore.getState().avatarMode;
    const templateContext = {
      isMemoryEnabled: brainEngine?.memory?.enabled,
      isCompanion: currentAvatarMode === AVATAR_MODE_MAP.companion,
      visits: brainEngine?.memory?.data?.visits,
      name: brainEngine?.memory?.data?.name,
      locale: currentLocale
    };

    const currentModeConfig = options.modes?.[currentAvatarMode];
    if (
      typeof currentModeConfig?.greeting !== 'undefined' &&
      currentModeConfig?.greeting !== null
    ) {
      greeting = resolveLocalized(
        currentModeConfig.greeting,
        currentLocale,
        '你好～',
        templateContext
      );
    } else if (
      typeof options.greeting !== 'undefined' &&
      options.greeting !== null
    ) {
      greeting = resolveLocalized(
        options.greeting,
        currentLocale,
        '你好～',
        templateContext
      );
    } else if (currentAvatarMode === AVATAR_MODE_MAP.companion) {
      let defaultCompanionGreeting;
      const userName =
        typeof brainEngine?.memory?.data?.name === 'string' &&
        brainEngine.memory.data.name !== ''
          ? brainEngine.memory.data.name
          : '';
      if (/en/i.test(currentLocale) === true) {
        defaultCompanionGreeting =
          (userName !== '' ? userName + '~ ' : 'Hello~ ') +
          'We can chat about anything! Click 💬 to start.';
      } else if (/ja/i.test(currentLocale) === true) {
        defaultCompanionGreeting =
          (userName !== '' ? userName + 'さん〜 ' : 'こんにちは〜 ') +
          '何でもお話ししましょう！💬 を押してスタートです。';
      } else if (/ko/i.test(currentLocale) === true) {
        defaultCompanionGreeting =
          (userName !== '' ? userName + '님~ ' : '안녕하세요~ ') +
          '무엇이든 이야기해요! 💬를 누르면開始해요.';
      } else {
        defaultCompanionGreeting =
          (userName !== '' ? userName + '～' : '你好～') +
          '想聊什麼都可以，點 💬 我們就開始！';
      }

      greeting = resolveLocalized(
        options.companionGreeting,
        currentLocale,
        defaultCompanionGreeting,
        templateContext
      );
    } else if (currentAvatarMode === AVATAR_MODE_MAP.assistant) {
      let defaultAssistantGreeting =
        '你好～我是 ai-avatar-bot-vanilla-js 虛擬人，問我怎麼安裝、切換 3D 或工具調用都行！';
      if (/en/i.test(currentLocale) === true) {
        defaultAssistantGreeting =
          'Hello~ I am the ai-avatar-bot-vanilla-js avatar. Ask me how to install, switch 3D, or use tools!';
      } else if (/ja/i.test(currentLocale) === true) {
        defaultAssistantGreeting =
          'こんにちは〜！ai-avatar-bot-vanilla-js アバターです。導入方法や3D切り替え、ツール機能について何でも聞いてください！';
      } else if (/ko/i.test(currentLocale) === true) {
        defaultAssistantGreeting =
          '안녕하세요~ ai-avatar-bot-vanilla-js 아바타입니다. 설치 방법, 3D 전환, 도구 기능 등을 편하게 물어보세요!';
      }

      greeting = resolveLocalized(
        options.assistantGreeting,
        currentLocale,
        defaultAssistantGreeting,
        templateContext
      );
    }

    speechEngine.spokenAudioText = greeting;
  }

  const resolvedLlmMaxTokens =
    typeof llmMaxTokens === 'number' &&
    Number.isFinite(llmMaxTokens) === true &&
    llmMaxTokens > 0
      ? llmMaxTokens
      : typeof LLMMaxTokens === 'number' &&
          Number.isFinite(LLMMaxTokens) === true &&
          LLMMaxTokens > 0
        ? LLMMaxTokens
        : DEFAULT_LLM_MAX_TOKENS;

  const brainOptions = {
    llmModel,
    llmMaxTokens: resolvedLlmMaxTokens,
    LLMMaxTokens: resolvedLlmMaxTokens,
    preloadWebLLM: rootStore.getState().preloadWebLLM,
    autoFallbackWebLLM: rootStore.getState().autoFallbackWebLLM,
    enableAutoContinue: rootStore.getState().enableAutoContinue,
    maxAutoContinuations: rootStore.getState().maxAutoContinuations,
    autoContinueMode: rootStore.getState().autoContinueMode,
    autoContinuePrompt,
    avatarMode: rootStore.getState().avatarMode,
    enableMemory: rootStore.getState().enableMemory,
    enableAiProvider: rootStore.getState().enableAiProvider,
    onBrainFallback:
      options.onBrainFallback ||
      ((fromEngine, toEngine, error) => {
        return callOptionEvent.call(
          aiAvatarWidget,
          'onBrainFallback',
          fromEngine,
          toEngine,
          error
        );
      }),
    maxHistoryTurns,
    memoryKey,
    memoryAdapter,
    modes: rootStore.getState().modes,
    knowledgeUrl,
    companionKnowledgeUrl,
    knowledge,
    companionKnowledge,
    companionFallback,
    aiProviderBaseUrl,
    aiProviderModel,
    aiProviderCreatedFetchSetting,
    aiProviderCreatedFetchPayload,
    aiProviderMaxTokens:
      typeof aiProviderMaxTokens === 'number' &&
      Number.isFinite(aiProviderMaxTokens) === true &&
      aiProviderMaxTokens > 0
        ? aiProviderMaxTokens
        : DEFAULT_AI_PROVIDER_MAX_TOKENS,
    aiProviderStream,
    aiProviderExtractToolCalls: options.aiProviderExtractToolCalls,
    getTools: () => {
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        typeof toolsEngine.getAiAvailableTools === 'function'
      ) {
        return toolsEngine.getAiAvailableTools();
      }
      return [];
    },
    getToolByName: (toolName) => {
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        Array.isArray(toolsEngine.HOST_TOOLS) === true &&
        toolsEngine.HOST_TOOLS.length > 0
      ) {
        return (
          toolsEngine.HOST_TOOLS.find(
            (toolItem) => toolItem.name === toolName
          ) || null
        );
      }
      return null;
    },
    offerToolConfirmation: (tool, toolArguments, toolOptions) => {
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        typeof toolsEngine.offerHostTool === 'function'
      ) {
        toolsEngine.offerHostTool(
          tool,
          '',
          { confidence: 1, reason: 'ai_tool_call' },
          toolArguments,
          toolOptions
        );
      }
    },
    executeTool: async (tool, toolArguments, toolOptions) => {
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        typeof toolsEngine.executeToolDirectly === 'function'
      ) {
        const defaultContext = {
          skinEngine,
          brainEngine,
          speechEngine,
          aiAvatarWidget,
          store: rootStore,
          i18nEngine
        };
        const resolvedOptions =
          typeof toolOptions === 'object' && toolOptions !== null
            ? {
                ...toolOptions,
                input: {
                  ...toolOptions.input,
                  context: {
                    ...defaultContext,
                    ...(typeof toolOptions.input?.context === 'object' &&
                    toolOptions.input.context !== null
                      ? toolOptions.input.context
                      : {})
                  },
                  query:
                    typeof toolOptions.input?.query === 'string'
                      ? toolOptions.input.query
                      : ''
                }
              }
            : { input: { context: defaultContext, query: '' } };

        return await toolsEngine.executeToolDirectly(
          tool,
          toolArguments,
          resolvedOptions
        );
      }
      return null;
    },
    buildLLMMessages: options.buildLLMMessages,

    i18nEngine,
    locale:
      typeof i18nEngine?.locale === 'string' && i18nEngine.locale !== ''
        ? i18nEngine.locale
        : rootStore.getState().locale,
    gender: rootStore.getState().brainGender || rootStore.getState().gender,
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext,
    languageRule,
    genderRule,
    compression:
      options.compression || options.brain?.compression || compression,

    welcomeText: options.welcomeText,
    companionWelcomeText: options.companionWelcomeText,
    assistantWelcomeText: options.assistantWelcomeText,

    onLlmLoading() {
      aiAvatarWidget.speechEngine.spokenDisplayText =
        typeof i18nEngine?.t === 'function'
          ? i18nEngine.t('brain.llm.loading')
          : '開始下載 AI 大腦（約 1GB，只需第一次）…';
      callOptionEvent.call(this, 'onLlmLoading');
    },
    onLlmLoadProgress(loadProgress) {
      uiDom.btnLlmEl.textContent =
        '🧠 ' + Math.round((loadProgress?.progress || 0) * 100) + '%';
      callOptionEvent.call(this, 'onLlmLoadProgress', loadProgress);
    },
    onLlmLoaded() {
      uiDom.btnLlmEl.textContent = '🧠✓';
      uiDom.btnLlmEl.setAttribute('css-llm-on', 'true');
      const loadedMsg =
        typeof i18nEngine?.t === 'function'
          ? i18nEngine.t('brain.llm.loaded')
          : 'AI 大腦啟用完成，現在我可以聊得更自然囉！';
      aiAvatarWidget.speechEngine.spokenAudioText = loadedMsg;
      aiAvatarWidget.speechEngine.spokenDisplayText = loadedMsg;
      callOptionEvent.call(this, 'onLlmLoaded');
    },
    onLlmLoadError(error) {
      uiDom.btnLlmEl.textContent = '🧠✗';
      aiAvatarWidget.speechEngine.spokenDisplayText =
        typeof i18nEngine?.t === 'function'
          ? i18nEngine.t('brain.llm.error', {
              error: error?.message || error
            })
          : 'AI 大腦載入失敗：' + (error?.message || error);
      callOptionEvent.call(this, 'onLlmLoadError', error);
    },
    onAiProviderConnecting() {
      const btnLlmEl = uiDom.btnLlmEl;
      if (btnLlmEl instanceof HTMLElement) {
        btnLlmEl.textContent = '🧠…';
        btnLlmEl.title =
          typeof i18nEngine?.t === 'function'
            ? i18nEngine.t('brain.aiProvider.connecting')
            : 'AI 伺服器大腦（連線中）';
      }
      callOptionEvent.call(this, 'onAiProviderConnecting');
    },
    onAiProviderConnected(response, _fetchSetting, aiProvider) {
      const isConnectionSuccessful = response?.ok === true;
      const btnLlmEl = uiDom.btnLlmEl;

      if (btnLlmEl instanceof HTMLElement) {
        btnLlmEl.textContent = isConnectionSuccessful === true ? '🧠✓' : '🧠✗';
        if (isConnectionSuccessful === true) {
          btnLlmEl.setAttribute('css-llm-on', 'true');
        } else {
          btnLlmEl.removeAttribute('css-llm-on');
        }
        btnLlmEl.setAttribute(
          'aria-pressed',
          String(isConnectionSuccessful === true)
        );
        if (isConnectionSuccessful === true) {
          btnLlmEl.title =
            typeof i18nEngine?.t === 'function'
              ? i18nEngine.t('brain.aiProvider.connected', {
                  model: aiProvider.model
                })
              : 'AI 伺服器：已連線 ' + aiProvider.model;
        } else {
          btnLlmEl.title =
            typeof i18nEngine?.t === 'function'
              ? i18nEngine.t('brain.aiProvider.error')
              : 'AI 伺服器連不上（檢查 AI 伺服器是否在跑 / CORS）';
        }
      }
      if (isConnectionSuccessful === true) {
        setTimeout(() => {
          aiAvatarWidget.speechEngine.spokenDisplayText =
            typeof i18nEngine?.t === 'function'
              ? i18nEngine.t('brain.aiProvider.connectedMsg', {
                  model: brainEngine.aiProvider.model
                })
              : '已接上 AI 伺服器大腦（' +
                brainEngine.aiProvider.model +
                '）🧠 問我問題吧！';
        }, 1300);
      }
      callOptionEvent.call(
        this,
        'onAiProviderConnected',
        response,
        _fetchSetting,
        aiProvider
      );
    },
    onSummaryUpdated(summary) {
      callOptionEvent.call(this, 'onSummaryUpdated', summary);
    },
    onAddChatMessage(chatMessageItem) {
      if (
        aiAvatarWidget.uiDom.historyPanelEl?.getAttribute('css-is-open') ===
        'true'
      ) {
        renderHistory(aiAvatarWidget);
      }
      callOptionEvent.call(this, 'onAddChatMessage', chatMessageItem);
    },
    onUpdateChatMessage(chatMessageItem) {
      if (
        aiAvatarWidget.uiDom.historyPanelEl?.getAttribute('css-is-open') ===
        'true'
      ) {
        renderHistory(aiAvatarWidget);
      }
      callOptionEvent.call(this, 'onUpdateChatMessage', chatMessageItem);
    },
    onChatHistoryChanged(chatLog) {
      // 這邊可以讓開發者自行註冊或給未來的全域事件處理用
      callOptionEvent.call(this, 'onChatHistoryChanged', chatLog);
    },
    onSpokenAudioPlayNow(text) {
      speechEngine.speak(text);
      callOptionEvent.call(this, 'onSpokenAudioPlayNow', text);
    },
    onSpokenDisplayTextChange(text) {
      speechEngine.spokenDisplayText = text;
    },
    onSpokenAudioTextChange(text) {
      speechEngine.spokenAudioText = text;
    },
    onEmotionChange(emotion) {
      if (typeof skinEngine === 'object' && skinEngine !== null) {
        if (typeof skinEngine.setEmotion === 'function') {
          skinEngine.setEmotion(emotion);
        } else if (skinEngine.gestureName !== undefined) {
          skinEngine.gestureName = emotion;
        }
      }
    },
    onStreamStart() {
      streamSpeechId =
        speechEngine.ttsMuted === true ? 0 : speechEngine.beginSpeech();
      streamSpeechState.sentenceBuffer = '';
      streamSpeechState.buf = '';
    },
    onStreamChunk(chunkDelta) {
      if (streamSpeechId !== 0) {
        if (streamSpeechId !== speechEngine.speakSeq) {
          return;
        }
        streamSpeechState.sentenceBuffer += chunkDelta;
        streamSpeechState.buf += chunkDelta;
        for (const sentence of speechEngine.drainSentences(
          streamSpeechState,
          false
        )) {
          speechEngine.pushSpeech(streamSpeechId, sentence);
        }
      }
    },
    /**
     * 大腦文字串流輸出結束時的回調。
     * 用於將殘餘字串送入語音合成佇列並宣告文字結尾，同時對外派發 onStreamEnd 事件通知開發者回答文字已生成完畢。
     * （註：語音全部播放完畢時會另外觸發 onSpeakingEnd）。
     *
     * @param {string} fullText - LLM 完整回答文字內容
     */
    onStreamEnd(fullText) {
      if (streamSpeechId !== 0 && streamSpeechId === speechEngine.speakSeq) {
        const remainingSentences = speechEngine.drainSentences(
          streamSpeechState,
          true
        );
        for (const sentence of remainingSentences) {
          speechEngine.pushSpeech(streamSpeechId, sentence);
        }
        speechEngine.endSpeech(streamSpeechId);
      } else if (streamSpeechId === 0) {
        speechEngine.onUtteranceEnd();
      }

      callOptionEvent.call(this, 'onStreamEnd', fullText);
    },
    onAutoContinueStart(info) {
      callOptionEvent.call(this, 'onAutoContinueStart', info);
    },
    onAutoContinueWait(info) {
      callOptionEvent.call(this, 'onAutoContinueWait', info);
    },
    onAutoContinueResume(info) {
      callOptionEvent.call(this, 'onAutoContinueResume', info);
    },
    onAutoContinueEnd(info) {
      callOptionEvent.call(this, 'onAutoContinueEnd', info);
    },
    onToolNotFound(info) {
      return callOptionEvent.call(this, 'onToolNotFound', info, aiAvatarWidget);
    },
    onToolError(info) {
      return callOptionEvent.call(this, 'onToolError', info, aiAvatarWidget);
    }
  };

  let useCustomBrainEngine = false;

  if (
    typeof customEngines.brain === 'function' ||
    (typeof customEngines.brain === 'object' && customEngines.brain !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.brain === 'function'
          ? await customEngines.brain(brainOptions)
          : customEngines.brain;

      const validation = validateBrainEngine(customInstance);
      if (validation.isValid === true) {
        brainEngine = customInstance;
        useCustomBrainEngine = true;
      } else {
        console.error(
          `[AvatarBot] 自訂 brainEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
        );
      }
    } catch (error) {
      console.error(
        `[AvatarBot] 初始化自訂 brainEngine 發生錯誤:`,
        error,
        `將退回使用預設引擎。`
      );
    }
  }

  if (useCustomBrainEngine === false) {
    brainEngine = await initBrainEngine(brainOptions);
  }

  // --- Orchestrator Setup ---
  speechEngine = await initSpeechEngine({
    customEngines: {
      tts: customEngines.tts,
      stt: customEngines.stt
    },
    ttsEndpoint:
      typeof ttsEndpoint === 'string' && ttsEndpoint !== ''
        ? ttsEndpoint
        : DEFAULT_TTS_ENDPOINT,
    neuralVoice: safeNeuralVoice,
    locale: rootStore.getState().locale,
    getGender: () => {
      return rootStore.getState().speechGender || rootStore.getState().gender;
    },
    onSpokenDisplayTextChange(newSpeakingLabel) {
      uiDom.bubbleEl.textContent = newSpeakingLabel;
      uiDom.bubbleEl.setAttribute('css-is-show', 'true');
      callOptionEvent.call(this, 'onSpokenDisplayTextChange', newSpeakingLabel);
    },
    onSpokenDisplayTextTimeout() {
      uiDom.bubbleEl.removeAttribute('css-is-show');
      callOptionEvent.call(this, 'onSpokenDisplayTextTimeout');
    },
    onMicStateChanged(isListening, convoOn) {
      if (typeof uiDom.updateMicState === 'function') {
        const currentAvatarMode = rootStore.getState().avatarMode || avatarMode;
        const isCompanion = currentAvatarMode === AVATAR_MODE_MAP.companion;
        uiDom.updateMicState(isListening, convoOn, isCompanion, i18nEngine);
      }
      callOptionEvent.call(this, 'onMicStateChanged', isListening, convoOn);
    },
    onVoiceStatusChanged(convoOn, text, state, level) {
      if (typeof uiDom.updateVoiceStatus === 'function') {
        uiDom.updateVoiceStatus(convoOn, text, state, level, i18nEngine);
      }
      callOptionEvent.call(
        this,
        'onVoiceStatusChanged',
        convoOn,
        text,
        state,
        level
      );
    },
    getContainer: () => container,
    onUserInput: (text) => {
      return handleUser(text);
    },
    onTapAvatar: () => {
      return onTapAvatar();
    },
    onInterrupt: () => {
      if (typeof brainEngine?.llm?.controller?.abort === 'function') {
        try {
          brainEngine.llm.controller.abort();
        } catch (_error) {}
      }
    },
    onLanguageChanged(locale, localeLabel, shortLabel) {
      if (uiDom.langButtonEl instanceof HTMLButtonElement) {
        uiDom.langButtonEl.textContent =
          typeof shortLabel === 'string' && shortLabel !== ''
            ? shortLabel
            : localeLabel;
      }
      callOptionEvent.call(
        this,
        'onLanguageChanged',
        locale,
        localeLabel,
        shortLabel
      );
    },
    onSpeaking: (text) => {
      callOptionEvent.call(this, 'onSpeaking', text);
    },
    onSpeakingEnd: () => {
      if (
        typeof skinEngine === 'object' &&
        skinEngine !== null &&
        typeof skinEngine.setEmotion === 'function'
      ) {
        skinEngine.setEmotion('neutral');
      }
      callOptionEvent.call(this, 'onSpeakingEnd');
    }
  });

  const toolsOptions = {
    confirmationTimeoutMs:
      typeof options.confirmationTimeoutMs === 'number'
        ? options.confirmationTimeoutMs
        : options.toolConfirmationTimeoutMs,
    onToolCall: (pendingToolCall) => {
      callOptionEvent.call(this, 'onToolCall', pendingToolCall, aiAvatarWidget);
    },
    onAddChatMessage(role, text, messageOptions) {
      callOptionEvent.call(
        this,
        'onAddChatMessage',
        role,
        text,
        messageOptions
      );
      return brainEngine.addChatMessage(role, text, messageOptions);
    },
    onUpdateChatMessage(messageId, text, append) {
      callOptionEvent.call(
        this,
        'onUpdateChatMessage',
        messageId,
        text,
        append
      );
      return brainEngine.updateChatMessage(messageId, text, append);
    },
    onSetHistoryOpen(isOpen) {
      if (uiDom.historyPanelEl instanceof HTMLElement) {
        if (isOpen === true) {
          uiDom.historyPanelEl.setAttribute('css-is-open', 'true');
        } else {
          uiDom.historyPanelEl.removeAttribute('css-is-open');
        }
        if (uiDom.historyPanelEl.getAttribute('css-is-open') === 'true') {
          renderHistory(aiAvatarWidget);
        }
      }
      callOptionEvent.call(this, 'onSetHistoryOpen', isOpen);
    },
    onRenderHistory() {
      renderHistory(aiAvatarWidget);
      callOptionEvent.call(this, 'onRenderHistory');
    },
    onSpokenAudioPlayNow(text) {
      if (
        typeof speechEngine === 'object' &&
        speechEngine !== null &&
        typeof speechEngine.speak === 'function'
      ) {
        speechEngine.speak(text);
      }
      callOptionEvent.call(this, 'onSpokenAudioPlayNow', text);
    },
    getChatLog: () => brainEngine?.chatLog || [],
    getChatSeq: () => brainEngine?.chatSeq || 0,
    isConvoOn: () => speechEngine?.convoOn || false
  };

  let useCustomToolsEngine = false;

  if (
    typeof customEngines.tools === 'function' ||
    (typeof customEngines.tools === 'object' && customEngines.tools !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.tools === 'function'
          ? await customEngines.tools(toolsOptions)
          : customEngines.tools;

      const validation = validateToolsEngine(customInstance);
      if (validation.isValid === true) {
        toolsEngine = customInstance;
        useCustomToolsEngine = true;
      } else {
        console.error(
          `[AvatarBot] 自訂 toolsEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
        );
      }
    } catch (error) {
      console.error(
        `[AvatarBot] 初始化自訂 toolsEngine 發生錯誤:`,
        error,
        `將退回使用預設引擎。`
      );
    }
  }

  if (useCustomToolsEngine === false) {
    toolsEngine = initToolsEngine(toolsOptions);
  }

  const customTools =
    Array.isArray(options.tools) && options.tools.length > 0
      ? options.tools
      : Array.isArray(options.hostTools) && options.hostTools.length > 0
        ? options.hostTools
        : [];

  const emotionTools =
    options.enableEmotionTools !== false
      ? createEmotionToolsPlugin(options.emotionToolsOptions || {})
      : [];

  if (Array.isArray(toolsEngine?.HOST_TOOLS) === true) {
    toolsEngine.HOST_TOOLS = [...customTools, ...emotionTools];
  }

  let useCustomSkinEngine = false;

  if (
    typeof customEngines.skin === 'function' ||
    (typeof customEngines.skin === 'object' && customEngines.skin !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.skin === 'function'
          ? await customEngines.skin({
              stageEl,
              aiAvatarWidget,
              speechEngine
            })
          : customEngines.skin;

      const validation = validateSkinEngine(customInstance);
      if (validation.isValid === true) {
        skinEngine = customInstance;
        useCustomSkinEngine = true;
      } else {
        console.error(
          `[AvatarBot] 自訂 skinEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
        );
      }
    } catch (error) {
      console.error(
        `[AvatarBot] 初始化自訂 skinEngine 發生錯誤:`,
        error,
        `將退回使用預設引擎。`
      );
    }
  }

  if (useCustomSkinEngine === false) {
    skinEngine = initSkinEngine({
      stageEl,
      modelUrl,
      startMode,
      fitMode,
      vrmUrl,
      gesture3D,
      gesture2D,
      get gender() {
        return rootStore.getState().skinGender || rootStore.getState().gender;
      },

      computeMouth() {
        return aiAvatarWidget.speechEngine.computeMouth();
      },
      async onMounted() {
        aiAvatarWidget.speechEngine.spokenDisplayText =
          await aiAvatarWidget.brainEngine.getWelcomeText();
        if (typeof aiAvatarWidget.onReady === 'function') {
          aiAvatarWidget.onReady(aiAvatarWidget);
        }
      },
      onThreeDimensionalError(error) {
        if (typeof aiAvatarWidget.onError === 'function') {
          aiAvatarWidget.onError(error, aiAvatarWidget);
        }
        callOptionEvent.call(this, 'onThreeDimensionalError', error);
      },
      onTwoDimensionalError(error) {
        const directWarnEl = aiAvatarWidget?.uiDom?.directWarnEl;
        if (
          directWarnEl instanceof HTMLParagraphElement ||
          directWarnEl instanceof HTMLDivElement
        ) {
          directWarnEl.textContent =
            '2D 啟動失敗：' + (error?.message || error);
          directWarnEl.style.display = 'flex';
        }
        if (typeof aiAvatarWidget.onError === 'function') {
          aiAvatarWidget.onError(error, aiAvatarWidget);
        }
        callOptionEvent.call(this, 'onTwoDimensionalError', error);
      },
      VRMFileChangeFail(error) {
        console.error(error);
        aiAvatarWidget.speechEngine.spokenDisplayText = error.message;
        if (typeof aiAvatarWidget.onError === 'function') {
          aiAvatarWidget.onError(error, aiAvatarWidget);
        }
        callOptionEvent.call(this, 'VRMFileChangeFail', error);
      },
      VRMFileChangeSuccess() {
        const engineButtonEl = aiAvatarWidget?.uiDom?.engineButtonEl;

        // 換上後也顯示 2D/3D 切換鈕
        if (engineButtonEl instanceof HTMLElement) {
          engineButtonEl.style.display = '';
          if (typeof engineButtonEl.onclick !== 'function') {
            engineButtonEl.onclick = () => {
              if (
                aiAvatarWidget.skinEngine.engineMode ===
                ENGINE_MODE_MAP.threeDimensional
              ) {
                aiAvatarWidget.skinEngine.engineMode =
                  ENGINE_MODE_MAP.twoDimensional;
              } else {
                aiAvatarWidget.skinEngine.engineMode =
                  ENGINE_MODE_MAP.threeDimensional;
              }
            };
          }
        }
        speechEngine.spokenDisplayText = '換上你的角色了！🎭';
        callOptionEvent.call(this, 'VRMFileChangeSuccess');
      },
      onModelChangeStart(newEngineMode) {
        if (uiDom.engineButtonEl instanceof HTMLElement) {
          if (newEngineMode === ENGINE_MODE_MAP.threeDimensional) {
            uiDom.engineButtonEl.textContent = '3D';
          } else {
            uiDom.engineButtonEl.textContent = '2D';
          }
        }
        callOptionEvent.call(this, 'onModelChangeStart', newEngineMode);
      },
      onModelChangeEnd() {
        if (skinEngine.engineMode === ENGINE_MODE_MAP.threeDimensional) {
          uiDom.engineButtonEl.textContent = '3D';
        } else {
          uiDom.engineButtonEl.textContent = '2D';
        }

        if (
          typeof skinEngine.avatarModel === 'object' &&
          skinEngine.avatarModel !== null &&
          typeof skinEngine.avatarModel.on === 'function'
        ) {
          skinEngine.avatarModel.on('hit', () => {
            speechEngine.triggerTap();
          });
        }
        if (skinEngine.engineMode === ENGINE_MODE_MAP.threeDimensional) {
          if (
            typeof skinEngine.renderer?.canvas?.addEventListener === 'function'
          ) {
            skinEngine.renderer.canvas.addEventListener('pointerdown', () => {
              if (
                Array.isArray(skinEngine.renderer?.TAP_GESTURES) === true &&
                skinEngine.renderer.TAP_GESTURES.length > 0 &&
                typeof skinEngine.renderer.playGesture === 'function'
              ) {
                skinEngine.renderer.playGesture(
                  skinEngine.renderer.TAP_GESTURES[
                    Math.floor(
                      Math.random() * skinEngine.renderer.TAP_GESTURES.length
                    )
                  ]
                );
              }
              speechEngine.triggerTap();
            });
          }
        } else {
          if (
            typeof skinEngine.renderer?.canvas?.addEventListener === 'function'
          ) {
            skinEngine.renderer.canvas.addEventListener('pointerdown', () => {
              speechEngine.triggerTap();
            });
          }
        }
        callOptionEvent.call(this, 'onModelChangeEnd');
      }
    });
  }

  if (
    typeof speechEngine === 'object' &&
    speechEngine !== null &&
    typeof speechEngine.subscribe === 'function'
  ) {
    speechEngine.subscribe('isSpeaking', (isSpeaking) => {
      if (
        typeof skinEngine === 'object' &&
        skinEngine !== null &&
        typeof skinEngine.setIsSpeaking === 'function'
      ) {
        skinEngine.setIsSpeaking(isSpeaking);
      }
    });
  }

  // 初始化 UI 語音狀態
  uiDom.updateVoiceStatus(
    aiAvatarWidget.speechEngine.convoOn,
    typeof i18nEngine?.t === 'function'
      ? i18nEngine.t('ui.voice.standby')
      : '即時語音待命',
    '',
    0,
    i18nEngine
  );

  if (typeof options.onReady === 'function') {
    aiAvatarWidget.onReady = options.onReady.bind(aiAvatarWidget);
  }

  if (typeof options.onMinimalTrigger === 'function') {
    aiAvatarWidget.onMinimalTrigger =
      options.onMinimalTrigger.bind(aiAvatarWidget);
  }

  initSkinModeChangeButton(aiAvatarWidget, skinEngine.has2D, skinEngine.has3D);
  renderSuggestions(aiAvatarWidget);
  bindTyping(aiAvatarWidget);
  bindUiEvent(aiAvatarWidget);
  updateUIStrings(container, i18nEngine);
  if (
    uiDom?.langButtonEl instanceof HTMLButtonElement &&
    typeof i18nEngine === 'object' &&
    i18nEngine !== null
  ) {
    uiDom.langButtonEl.textContent =
      typeof i18nEngine.labels?.shortLabel === 'string' &&
      i18nEngine.labels.shortLabel !== ''
        ? i18nEngine.labels.shortLabel
        : typeof i18nEngine.labels?.label === 'string' &&
            i18nEngine.labels.label !== ''
          ? i18nEngine.labels.label
          : '中文';
  }
  aiAvatarWidget.speechEngine.setMic(false); // 依模式套按鈕字樣（🎤 說話 / 💬 對話）

  function handleDragPrevent(event) {
    event.preventDefault();
  }

  function handleModelDrop(event) {
    event.preventDefault();
    const droppedFile = event?.dataTransfer?.files?.[0];
    if (droppedFile instanceof window.File) {
      skinEngine.loadVRMFile(droppedFile);
    }
  }

  function updateModelDropListeners(enabled) {
    if (enabled === true) {
      container.addEventListener('dragenter', handleDragPrevent);
      container.addEventListener('dragover', handleDragPrevent);
      container.addEventListener('drop', handleModelDrop);
    } else {
      container.removeEventListener('dragenter', handleDragPrevent);
      container.removeEventListener('dragover', handleDragPrevent);
      container.removeEventListener('drop', handleModelDrop);
    }
  }

  if (isModelDropEnabled === true) {
    updateModelDropListeners(true);
  }

  if (aiAvatarWidget.isIframe === true) {
    aiAvatarWidget.onMinimalTrigger(isMinimal, aiAvatarWidget);
    aiAvatarWidget.hiddenMinimalEl();
  } else {
    aiAvatarWidget.isMinimal = isMinimal;
  }

  return aiAvatarWidget;
}

export default initAvatarBot;
