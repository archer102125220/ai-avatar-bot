import { initBrainEngine, validateBrainEngine } from './brain';
import { initSkinEngine, validateSkinEngine } from './skin';
import { initSpeechEngine, splitSentences } from './speech';
import { initI18nEngine, resolveLocalized } from './i18n';
import {
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_AI_PROVIDER_MODEL,
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
  BRAIN_FALLBACK_TYPE_MAP
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
 * @property {number} [aiProviderMaxTokens] - AI 服務回應的最大 Token 數
 * @property {boolean} [aiProviderStream] - 是否啟用 AI 服務的串流 (Streaming) 回應
 * @property {Function} [aiProviderExtractToolCalls] - AI 服務提供商自訂提取 Tool Calls 的回呼函式
 * @property {string} [neuralVoice=''] - 指定使用的神經網路語音 (Neural Voice)
 * @property {string} [knowledgeUrl=''] - 助理模式知識庫資料的 URL
 * @property {string} [companionKnowledgeUrl=''] - 陪伴模式知識庫資料的 URL
 * @property {string} [modelUrl] - 3D 或 2D 模型的 URL
 * @property {string} [ttsEndpoint=DEFAULT_TTS_ENDPOINT] - 語音合成 (TTS) 服務端點 URL (沒設會試同站相對路徑)
 * @property {string} [llmModel=DEFAULT_LLM_MODEL] - 預設的本地/遠端語言模型 (LLM) 類型
 * @property {boolean} [preloadWebLLM=false] - 是否在初始化時預先載入 WebLLM 模型
 * @property {boolean} [autoFallbackWebLLM=true] - 當 AI Provider 故障時是否自動在背景載入 WebLLM 備援
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
 * @property {Function} [onSummaryUpdated] - 滾動對話摘要更新時的回呼函式 (summary)
 * @property {Function} [onBrainFallback] - 大腦引擎降級時觸發的回呼函式 (fromEngine, toEngine, error)
 * @property {Function} [onToolCall] - 觸發外部工具 (Tool Call) 時的回呼函式
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
 * @property {Array<string>} availableModes - 目前可用角色模式清單
 * @property {boolean} enableMemory - 目前是否啟用記憶體
 * @property {boolean} enableAiProvider - 目前是否啟用 AI 服務提供商
 * @property {boolean} preloadWebLLM - 是否預先載入 WebLLM 模型
 * @property {boolean} autoFallbackWebLLM - 是否自動在背景載入 WebLLM 備援
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

  function callOptionEvent(eventName, ...args) {
    if (typeof options[eventName] === 'function') {
      return options[eventName].call(this, ...args);
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
    preloadWebLLM = false,
    autoFallbackWebLLM = true,
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

  const targetAvatarMode = avatarMode || DEFAULT_AVATAR_MODE;
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
            locale: locale || 'zh-TW',
            messages: options.i18nMessages
          })
        : customEngines.i18n;
  } else {
    i18nEngine = initI18nEngine({
      locale: locale || 'zh-TW',
      messages: options.i18nMessages
    });
  }

  const rootStore = createBaseStore({
    gender: safeGender,
    brainGender:
      brainGender && Object.values(GENDER_MAP).includes(brainGender)
        ? brainGender
        : null,
    speechGender:
      speechGender && Object.values(GENDER_MAP).includes(speechGender)
        ? speechGender
        : null,
    skinGender:
      skinGender && Object.values(GENDER_MAP).includes(skinGender)
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
    modes: typeof modes === 'object' && modes !== null ? modes : {},
    locale: i18nEngine?.locale || locale || 'zh-TW'
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

    handleUser: (text) => handleUser(text),

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
      if (Object.values(GENDER_MAP).includes(newGender)) {
        rootStore.setState({ gender: newGender });
      }
    },

    get brainGender() {
      return rootStore.getState().brainGender;
    },
    set brainGender(newGender = null) {
      if (newGender === null || Object.values(GENDER_MAP).includes(newGender)) {
        rootStore.setState({ brainGender: newGender });
      }
    },

    get speechGender() {
      return rootStore.getState().speechGender;
    },
    set speechGender(newGender = null) {
      if (newGender === null || Object.values(GENDER_MAP).includes(newGender)) {
        rootStore.setState({ speechGender: newGender });
      }
    },

    get skinGender() {
      return rootStore.getState().skinGender;
    },
    set skinGender(newGender = null) {
      if (newGender === null || Object.values(GENDER_MAP).includes(newGender)) {
        rootStore.setState({ skinGender: newGender });
      }
    },

    get locale() {
      return i18nEngine ? i18nEngine.locale : rootStore.getState().locale;
    },
    set locale(newLocale = '') {
      if (typeof newLocale === 'string' && newLocale !== '') {
        if (i18nEngine && typeof i18nEngine.setLocale === 'function') {
          i18nEngine.setLocale(newLocale);
        } else {
          rootStore.setState({ locale: newLocale });
        }
      }
    },

    get availableModes() {
      const currentModes = rootStore.getState().modes || {};
      return Array.from(
        new Set([...Object.values(AVATAR_MODE_MAP), ...Object.keys(currentModes)])
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
    set enableMemory(enabled) {
      if (typeof enabled === 'boolean') {
        rootStore.setState({ enableMemory: enabled });
        if (
          brainEngine?.memory !== null &&
          typeof brainEngine?.memory === 'object'
        ) {
          brainEngine.memory.enabled = enabled;
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
    set enableAiProvider(enabled) {
      if (typeof enabled === 'boolean') {
        rootStore.setState({ enableAiProvider: enabled });
        if (
          brainEngine !== null &&
          typeof brainEngine === 'object'
        ) {
          brainEngine.enableAiProvider = enabled;
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
    set preloadWebLLM(val) {
      if (typeof val === 'boolean') {
        rootStore.setState({ preloadWebLLM: val });
        if (brainEngine !== null && typeof brainEngine === 'object') {
          brainEngine.preloadWebLLM = val;
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
    set autoFallbackWebLLM(val) {
      if (typeof val === 'boolean') {
        rootStore.setState({ autoFallbackWebLLM: val });
        if (brainEngine !== null && typeof brainEngine === 'object') {
          brainEngine.autoFallbackWebLLM = val;
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
    const resolvedGender = newBrainGender || state.gender;
    if (typeof aiAvatarWidget.brainEngine?.setGender === 'function') {
      aiAvatarWidget.brainEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('speechGender', (newSpeechGender) => {
    const state = rootStore.getState();
    const resolvedGender = newSpeechGender || state.gender;
    if (typeof aiAvatarWidget.speechEngine?.setGender === 'function') {
      aiAvatarWidget.speechEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('skinGender', (newSkinGender) => {
    const state = rootStore.getState();
    const resolvedGender = newSkinGender || state.gender;
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

  if (i18nEngine && typeof i18nEngine.subscribe === 'function') {
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
          localeLabels?.shortLabel || localeLabels?.label || newLocale;
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
      text !== '' &&
      typeof toolsEngine.pendingToolConfirmation === 'string' &&
      toolsEngine.pendingToolConfirmation !== '' &&
      toolsEngine.continueToolConfirmation(text)
    ) {
      return;
    }
    if (
      text !== '' &&
      typeof toolsEngine.pendingToolChoice === 'object' &&
      toolsEngine.pendingToolChoice !== null &&
      toolsEngine.continueToolChoice(text)
    ) {
      return;
    }
    if (
      text !== '' &&
      typeof toolsEngine.pendingToolInput === 'object' &&
      toolsEngine.pendingToolInput !== null &&
      toolsEngine.continueToolInput(text)
    ) {
      return;
    }

    if (brainEngine?.memory?.enabled === true && text !== '') {
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
      i18nEngine?.locale || rootStore.getState().locale || 'zh-TW';
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
    } else if (typeof options.greeting !== 'undefined' && options.greeting !== null) {
      greeting = resolveLocalized(
        options.greeting,
        currentLocale,
        '你好～',
        templateContext
      );
    } else if (currentAvatarMode === AVATAR_MODE_MAP.companion) {
      let defaultCompGreeting;
      if (/en/i.test(currentLocale)) {
        defaultCompGreeting =
          (brainEngine?.memory?.data?.name
            ? brainEngine.memory.data.name + '~ '
            : 'Hello~ ') + 'We can chat about anything! Click 💬 to start.';
      } else if (/ja/i.test(currentLocale)) {
        defaultCompGreeting =
          (brainEngine?.memory?.data?.name
            ? brainEngine.memory.data.name + 'さん〜 '
            : 'こんにちは〜 ') +
          '何でもお話ししましょう！💬 を押してスタートです。';
      } else if (/ko/i.test(currentLocale)) {
        defaultCompGreeting =
          (brainEngine?.memory?.data?.name
            ? brainEngine.memory.data.name + '님~ '
            : '안녕하세요~ ') + '무엇이든 이야기해요! 💬를 누르면 시작해요.';
      } else {
        defaultCompGreeting =
          (typeof brainEngine?.memory?.data?.name === 'string' &&
          brainEngine.memory.data.name !== ''
            ? brainEngine.memory.data.name + '～'
            : '你好～') + '想聊什麼都可以，點 💬 我們就開始！';
      }

      greeting = resolveLocalized(
        options.companionGreeting,
        currentLocale,
        defaultCompGreeting,
        templateContext
      );
    } else if (currentAvatarMode === AVATAR_MODE_MAP.assistant) {
      let defaultAssistantGreeting =
        '你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！';
      if (/en/i.test(currentLocale)) {
        defaultAssistantGreeting =
          'Hello~ I am an embeddable voice AI avatar widget. Ask me how to install, or customize characters!';
      } else if (/ja/i.test(currentLocale)) {
        defaultAssistantGreeting =
          'こんにちは〜！Webサイトに埋め込み可能な音声AIアバターです。設置方法やキャラクター変更について何でも聞いてください！';
      } else if (/ko/i.test(currentLocale)) {
        defaultAssistantGreeting =
          '안녕하세요~ 웹사이트에 삽입 가능한 음성 AI 아바타입니다. 설치 방법이나 캐릭터 변경에 대해 무엇이든 물어보세요!';
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

  const brainOptions = {
    llmModel,
    preloadWebLLM: rootStore.getState().preloadWebLLM,
    autoFallbackWebLLM: rootStore.getState().autoFallbackWebLLM,
    avatarMode: rootStore.getState().avatarMode,
    enableMemory: rootStore.getState().enableMemory,
    enableAiProvider: rootStore.getState().enableAiProvider,
    onBrainFallback:
      options.onBrainFallback ||
      ((fromEngine, toEngine, error) =>
        callOptionEvent.call(
          aiAvatarWidget,
          'onBrainFallback',
          fromEngine,
          toEngine,
          error
        )),
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
    aiProviderMaxTokens,
    aiProviderStream,
    aiProviderExtractToolCalls: options.aiProviderExtractToolCalls,
    getTools: () =>
      toolsEngine && typeof toolsEngine.getAiAvailableTools === 'function'
        ? toolsEngine.getAiAvailableTools()
        : [],
    getToolByName: (name) =>
      toolsEngine && Array.isArray(toolsEngine.HOST_TOOLS)
        ? toolsEngine.HOST_TOOLS.find((t) => t.name === name)
        : null,
    offerToolConfirmation: (tool, args, toolOptions) => {
      if (toolsEngine && typeof toolsEngine.offerHostTool === 'function') {
        toolsEngine.offerHostTool(
          tool,
          '',
          { confidence: 1, reason: 'ai_tool_call' },
          args,
          toolOptions
        );
      }
    },
    executeTool: async (tool, args, toolOptions) => {
      if (
        toolsEngine &&
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
                    ...(toolOptions.input?.context || {})
                  },
                  query: toolOptions.input?.query || ''
                }
              }
            : { input: { context: defaultContext, query: '' } };

        return await toolsEngine.executeToolDirectly(
          tool,
          args,
          resolvedOptions
        );
      }
      return null;
    },
    buildLLMMessages: options.buildLLMMessages,

    i18nEngine,
    locale: i18nEngine?.locale || rootStore.getState().locale,
    gender: rootStore.getState().brainGender || rootStore.getState().gender,
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext,
    languageRule,
    genderRule,
    compression: options.compression || options.brain?.compression || compression,

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
      const ok = response?.ok || false;
      const btnLlmEl = uiDom.btnLlmEl;

      if (btnLlmEl instanceof HTMLElement) {
        btnLlmEl.textContent = ok === true ? '🧠✓' : '🧠✗';
        if (ok === true) {
          btnLlmEl.setAttribute('css-llm-on', 'true');
        } else {
          btnLlmEl.removeAttribute('css-llm-on');
        }
        btnLlmEl.setAttribute('aria-pressed', String(ok === true));
        if (ok === true) {
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
      if (ok === true) {
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
    onAddChatMessage(item) {
      if (
        aiAvatarWidget.uiDom.historyPanelEl?.getAttribute('css-is-open') ===
        'true'
      ) {
        renderHistory(aiAvatarWidget);
      }
      callOptionEvent.call(this, 'onAddChatMessage', item);
    },
    onUpdateChatMessage(item) {
      if (
        aiAvatarWidget.uiDom.historyPanelEl?.getAttribute('css-is-open') ===
        'true'
      ) {
        renderHistory(aiAvatarWidget);
      }
      callOptionEvent.call(this, 'onUpdateChatMessage', item);
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
      if (skinEngine && skinEngine.gestureName !== undefined) {
        skinEngine.gestureName = emotion;
      }
    },
    onStreamStart() {
      streamSpeechId = speechEngine.ttsMuted ? 0 : speechEngine.beginSpeech();
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
    onStreamEnd(fullText) {
      if (streamSpeechId !== 0 && streamSpeechId === speechEngine.speakSeq) {
        const remainingSentences = speechEngine.drainSentences(
          streamSpeechState,
          true
        );
        if (
          remainingSentences.length === 0 &&
          (!streamSpeechState.sentenceBuffer ||
            streamSpeechState.sentenceBuffer === '') &&
          typeof fullText === 'string' &&
          fullText !== ''
        ) {
          for (const s of splitSentences(fullText)) {
            speechEngine.pushSpeech(streamSpeechId, s);
          }
        } else {
          for (const sentence of remainingSentences) {
            speechEngine.pushSpeech(streamSpeechId, sentence);
          }
        }
        speechEngine.endSpeech(streamSpeechId);
      } else if (streamSpeechId === 0) {
        speechEngine.onUtteranceEnd();
      }

      callOptionEvent.call(this, 'onSpeakingEnd', fullText);
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
    ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    neuralVoice: safeNeuralVoice,
    locale: rootStore.getState().locale,
    getGender: () =>
      rootStore.getState().speechGender || rootStore.getState().gender,
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
        const isCompanion = avatarMode === AVATAR_MODE_MAP.companion;
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
    onUserInput: (text) => handleUser(text),
    onTapAvatar: () => onTapAvatar(),
    onInterrupt: () => {
      if (typeof brainEngine?.llm?.controller?.abort === 'function') {
        try {
          brainEngine.llm.controller.abort();
        } catch (_error) {}
      }
    },
    onLanguageChanged(locale, localeLabel, shortLabel) {
      if (uiDom.langButtonEl instanceof HTMLButtonElement) {
        uiDom.langButtonEl.textContent = shortLabel || localeLabel;
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
      if (skinEngine && typeof skinEngine.setEmotion === 'function') {
        skinEngine.setEmotion('neutral');
      }
      callOptionEvent.call(this, 'onSpeakingEnd');
    }
  });

  const toolsOptions = {
    confirmationTimeoutMs:
      options.confirmationTimeoutMs || options.toolConfirmationTimeoutMs,
    onToolCall: (pending) => {
      callOptionEvent.call(this, 'onToolCall', pending, aiAvatarWidget);
    },
    onAddChatMessage(role, text, options) {
      callOptionEvent.call(this, 'onAddChatMessage', role, text, options);
      return brainEngine.addChatMessage(role, text, options);
    },
    onUpdateChatMessage(id, text, append) {
      callOptionEvent.call(this, 'onUpdateChatMessage', id, text, append);
      return brainEngine.updateChatMessage(id, text, append);
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
      if (speechEngine) {
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

  const customTools = Array.isArray(options.tools)
    ? options.tools
    : Array.isArray(options.hostTools)
      ? options.hostTools
      : [];

  const emotionTools =
    options.enableEmotionTools !== false
      ? createEmotionToolsPlugin(options.emotionToolsOptions || {})
      : [];

  if (Array.isArray(toolsEngine?.HOST_TOOLS)) {
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

        skinEngine.avatarModel.on('hit', () => speechEngine.triggerTap());
        if (skinEngine.engineMode === ENGINE_MODE_MAP.threeDimensional) {
          skinEngine.renderer.canvas.addEventListener('pointerdown', () => {
            skinEngine.renderer.playGesture(
              skinEngine.renderer.TAP_GESTURES[
                Math.floor(
                  Math.random() * skinEngine.renderer.TAP_GESTURES.length
                )
              ]
            );
            speechEngine.triggerTap();
          });
        } else {
          skinEngine.renderer.canvas.addEventListener('pointerdown', () =>
            speechEngine.triggerTap()
          );
        }
        callOptionEvent.call(this, 'onModelChangeEnd');
      }
    });
  }

  if (typeof speechEngine.subscribe === 'function') {
    speechEngine.subscribe('isSpeaking', (isSpeaking) => {
      if (skinEngine && typeof skinEngine.setIsSpeaking === 'function') {
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
  if (uiDom?.langButtonEl instanceof HTMLButtonElement && i18nEngine) {
    uiDom.langButtonEl.textContent =
      i18nEngine.labels?.shortLabel || i18nEngine.labels?.label || '中文';
  }
  aiAvatarWidget.speechEngine.setMic(false); // 依模式套按鈕字樣（🎤 說話 / 💬 對話）

  ['dragenter', 'dragover'].forEach((eventName) =>
    container.addEventListener(eventName, (event) => {
      event.preventDefault();
    })
  );
  container.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event?.dataTransfer?.files?.[0];
    if (file instanceof window.File) {
      skinEngine.loadVRMFile(file);
    }
  });

  if (aiAvatarWidget.isIframe === true) {
    aiAvatarWidget.onMinimalTrigger(isMinimal, aiAvatarWidget);
    aiAvatarWidget.hiddenMinimalEl();
  } else {
    aiAvatarWidget.isMinimal = isMinimal;
  }

  return aiAvatarWidget;
}

export default initAvatarBot;
