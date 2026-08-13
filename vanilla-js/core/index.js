import { initBrainEngine, validateBrainEngine } from './brain';
import { initSkinEngine, validateSkinEngine } from './skin';
import { initSpeechEngine } from './speech';
import {
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_AI_PROVIDER_MODEL,
  STATE_MAP,
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  GENDER_MAP,
  DEFAULT_GENDER,
  DEFAULT_TTS_ENDPOINT,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE
} from './constants';

import {
  initUi,
  renderHistory,
  renderSuggestions,
  bindTyping,
  bindUiEvent,
  initSkinModeChangeButton
} from './ui';
import { initToolsEngine, validateToolsEngine } from './tools';
import { createBaseStore } from './store';

import '../style/style.scss';

export * from './constants';

export { validateSkinEngine, validateToolsEngine, validateBrainEngine };

/**
 * @typedef {Object} CustomEnginesConfig
 * @property {Function|Object} [skin] - 自訂 Skin Engine 的建構函式或實例。
 * @property {Function|Object} [tools] - 自訂 Tools Engine 的建構函式或實例。
 * @property {Function|Object} [brain] - 自訂 Brain Engine 的建構函式或實例。
 * @property {Function|Object} [stt] - 自訂 STT (語音辨識) 引擎的建構函式或實例。
 * @property {Function|Object} [tts] - 自訂 TTS (語音合成) 引擎的建構函式或實例。
 */

/**
 * @typedef {Object} AvatarBotOptions
 * @property {HTMLElement} [container=null] - 綁定 Widget 的 HTML 容器元素
 * @property {string} [aiProviderBaseUrl=''] - AI 服務提供商的 API 基礎 URL
 * @property {string} [aiProviderModel=DEFAULT_AI_PROVIDER_MODEL] - 使用的 AI 服務模型名稱
 * @property {Function|RequestInit} [aiProviderCreatedFetchSetting] - 自訂 Fetch 設定的處理函式或設定物件
 * @property {Function|Record<string, any>} [aiProviderCreatedFetchPayload] - 自訂 Fetch 負載 (Payload) 的處理函式或負載物件
 * @property {number} [aiProviderMaxTokens] - AI 服務回應的最大 Token 數
 * @property {boolean} [aiProviderStream] - 是否啟用 AI 服務的串流 (Streaming) 回應
 * @property {string} [neuralVoice=''] - 指定使用的神經網路語音 (Neural Voice)
 * @property {string} [knowledgeUrl=''] - 助理模式知識庫資料的 URL
 * @property {string} [companionKnowledgeUrl=''] - 陪伴模式知識庫資料的 URL
 * @property {string} [modelUrl] - 3D 或 2D 模型的 URL
 * @property {string} [ttsEndpoint=DEFAULT_TTS_ENDPOINT] - 語音合成 (TTS) 服務端點 URL (沒設會試同站相對路徑)
 * @property {string} [llmModel=DEFAULT_LLM_MODEL] - 預設的本地/遠端語言模型 (LLM) 類型
 * @property {string} [avatarMode=DEFAULT_AVATAR_MODE] - Avatar 模式（例如：assistant, companion 等）
 * @property {Record<string, any>|string} [knowledge=null] - 預載的助理模式知識庫資料，可以是 JSON 物件或字串
 * @property {Record<string, any>|string} [companionKnowledge=null] - 預載的陪伴模式知識庫資料，可以是 JSON 物件或字串
 * @property {string} [startMode] - 初始啟動的模型模式 (2D 或 3D)
 * @property {string} [fitMode] - 模型適應容器的模式 (Fit Mode)
 * @property {string} [vrmUrl] - VRM 3D 模型檔案的 URL
 * @property {Record<string, any>} [gesture2D] - 2D 模型使用的姿態資料
 * @property {boolean} [isMinimal=false] - 是否以極簡模式 (Minimal UI) 啟動
 * @property {boolean} [isIframe=false] - 是否在 Iframe 中執行
 * @property {string} [locale='zh-TW'] - 語系設定 (例如 'zh-TW', 'en-US', 'ja-JP', 'ko-KR')
 * @property {string} [gender=''] - 預設性別設定
 * @property {Array<string|Record<string, any>>} [companionFallback=[]] - 陪伴模式的備用對話回覆 (Fallback) 清單
 * @property {CustomEnginesConfig} [customEngines={}] - 自訂引擎 (例如自訂 skin 引擎) 的設定物件
 * @property {string|Function} [systemContextTemplate] - 助理模式系統提示詞模板
 * @property {string|Function} [companionSystemContextTemplate] - 陪伴模式系統提示詞模板
 * @property {string|Function} [ragTemplate] - RAG 參考資料模板
 * @property {string|Function} [languageRule] - 多語系回答規則提示詞
 * @property {Function} [buildLLMMessages] - 自訂組裝 LLM 訊息格式的函式
 * @property {string} [welcomeText] - 通用歡迎詞文字
 * @property {string} [companionWelcomeText] - 陪伴模式專用歡迎詞文字
 * @property {string} [assistantWelcomeText] - 助理模式專用歡迎詞文字
 * @property {string} [greeting] - 通用問候語音文字
 * @property {string} [companionGreeting] - 陪伴模式專用問候語音文字
 * @property {string} [assistantGreeting] - 助理模式專用問候語音文字
 * @property {Function} [onReady] - Bot 初始化完成且掛載後的回呼函式
 * @property {Function} [onMinimalTrigger] - 切換極簡模式時的回呼函式
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
 * @property {Function} [onToolCall] - 觸發外部工具 (Tool Call) 時的回呼函式
 * @property {Function} [onSetHistoryOpen] - 開關歷史紀錄面板時的回呼函式
 * @property {Function} [onRenderHistory] - 歷史紀錄渲染更新時的回呼函式
 * @property {Function} [onSpokenAudioPlayNow] - 觸發發音時的回呼函式
 * @property {Function} [onSpokenDisplayTextChange] - 語音介面顯示文字的回呼函式
 * @property {Function} [onThreeDimensionalError] - 3D 引擎發生錯誤時的回呼函式
 * @property {Function} [onTwoDimensionalError] - 2D 引擎發生錯誤時的回呼函式
 * @property {Function} [VRMFileChangeFail] - 替換 VRM 模型檔案失敗時的回呼函式
 * @property {Function} [VRMFileChangeSuccess] - 替換 VRM 模型檔案成功時的回呼函式
 * @property {Function} [onModelChangeStart] - 2D/3D 模型切換開始時的回呼函式
 * @property {Function} [onModelChangeEnd] - 2D/3D 模型切換結束時的回呼函式
 */

/**
 * @typedef {Object} AiAvatarWidget
 * @property {AvatarBotOptions} optiopns - 傳入的初始化設定選項
 * @property {string} DEFAULT_LLM_MODEL - 預設的 LLM 模型名稱
 * @property {Record<string, string>} STATE_MAP - 狀態映射表
 * @property {Record<string, string>} ENGINE_MODE_MAP - 引擎模式映射表
 * @property {Record<string, string>} AVATAR_MODE_MAP - Avatar 模式映射表
 * @property {Record<string, string>} FIT_MODE_MAP - Fit 模式映射表
 * @property {HTMLElement} container - 綁定 Widget 的 HTML 容器元素
 * @property {any} uiDom - UI 相關的 DOM 元素與控制方法
 * @property {any} toolsEngine - 外部工具 (Tools) 引擎實例
 * @property {Function} buildLLMMessages - 組裝 LLM 訊息的函式
 * @property {Function} classifyEmotion - 情感分類函式
 * @property {Function} setEmotionFromText - 根據文字設定情感的函式
 * @property {boolean} isIframe - 是否在 Iframe 內
 * @property {boolean} isMinimal - 是否處於極簡模式
 * @property {Function} showMinimalEl - 顯示極簡模式元素的函式
 * @property {Function} hiddenMinimalEl - 隱藏極簡模式元素的函式
 * @property {string} gender - 目前性別
 * @property {string} avatarMode - 目前 Avatar 模式
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
 * @param {AvatarBotOptions} optiopns - 初始化設定選項
 * @returns {Promise<AiAvatarWidget|void>} 回傳初始化完成的 `AiAvatarWidget` 實例，包含操作介面、大腦、語音、皮膚等引擎的屬性與方法；如果在非瀏覽器環境下執行會回傳 undefined。
 * @throws {Error} 當傳入的 container 不是 HTMLElement 時拋出錯誤
 */
export async function initAvatarBot(optiopns = {}) {
  if (typeof window !== 'object') {
    return;
  }

  function callOptionEvent(eventName, ...args) {
    if (typeof optiopns[eventName] === 'function') {
      return optiopns[eventName].call(this, ...args);
    }
  }

  const {
    container = null,
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
    avatarMode = DEFAULT_AVATAR_MODE,
    knowledge = null,
    companionKnowledge = null,
    startMode,
    fitMode,
    vrmUrl,
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
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext,
    languageRule,
    genderRule
  } = optiopns;

  if (container instanceof HTMLElement === false) {
    throw new Error('container must be an HTMLElement');
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
    avatarMode: avatarMode || DEFAULT_AVATAR_MODE,
    locale: locale || 'zh-TW'
  });

  const aiAvatarWidget = {
    get optiopns() {
      return optiopns;
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

    get container() {
      return container;
    },

    get uiDom() {
      return uiDom;
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
      return rootStore.getState().locale;
    },
    set locale(newLocale = '') {
      if (typeof newLocale === 'string' && newLocale !== '') {
        rootStore.setState({ locale: newLocale });
      }
    },

    get avatarMode() {
      return rootStore.getState().avatarMode;
    },
    set avatarMode(newAvatarMode = '') {
      if (typeof newAvatarMode === 'string' && newAvatarMode !== '') {
        if (Object.values(AVATAR_MODE_MAP).includes(newAvatarMode)) {
          rootStore.setState({ avatarMode: newAvatarMode });
        } else {
          rootStore.setState({ avatarMode: AVATAR_MODE_MAP.assistant });
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

  const stageEl = document.createElement('div');
  stageEl.setAttribute('id', 'stage');
  uiDom = initUi(container, stageEl);

  let streamSpeechId = 0;
  const streamSpeechState = { buf: '' };

  function handleUser(text = '') {
    if (typeof text === 'string' && text !== '') {
      if (typeof speechEngine.stopSpeaking === 'function') {
        speechEngine.stopSpeaking();
      }
      brainEngine.addChatMessage('user', text);
      speechEngine.spokenDisplayText = '你：' + text;
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

    if (brainEngine.mem.isCompanion === true && text !== '') {
      if (/忘記我|清除記憶|forget me/i.test(text) === true) {
        brainEngine.mem.wipe();
        speechEngine.spokenAudioText = '好，我把記憶都清掉了，我們重新認識吧！';
        return;
      }
      brainEngine.mem.captureName(text);
      brainEngine.mem.addTurn('user', text);
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
        {}
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

    if (typeof optiopns.greeting === 'function') {
      greeting = optiopns.greeting({
        isCompanion: brainEngine.mem.isCompanion,
        visits: brainEngine.mem.data.visits,
        name: brainEngine.mem.data.name
      });
    } else if (typeof optiopns.greeting === 'string') {
      greeting = optiopns.greeting;
    } else if (avatarMode === AVATAR_MODE_MAP.companion) {
      greeting =
        (typeof brainEngine.mem.data.name === 'string' &&
        brainEngine.mem.data.name !== ''
          ? brainEngine.mem.data.name + '～'
          : '你好～') + '想聊什麼都可以，點 💬 我們就開始！';

      if (typeof optiopns.companionGreeting === 'function') {
        greeting = optiopns.companionGreeting({
          isCompanion: brainEngine.mem.isCompanion,
          visits: brainEngine.mem.data.visits,
          name: brainEngine.mem.data.name
        });
      } else if (typeof optiopns.companionGreeting === 'string') {
        greeting = optiopns.companionGreeting;
      }
    } else if (avatarMode === AVATAR_MODE_MAP.assistant) {
      greeting =
        '你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！';

      if (typeof optiopns.assistantGreeting === 'function') {
        greeting = optiopns.assistantGreeting({
          isCompanion: brainEngine.mem.isCompanion,
          visits: brainEngine.mem.data.visits,
          name: brainEngine.mem.data.name
        });
      } else if (typeof optiopns.assistantGreeting === 'string') {
        greeting = optiopns.assistantGreeting;
      }
    }

    speechEngine.spokenAudioText = greeting;
  }

  const brainOptions = {
    llmModel,
    avatarMode,
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
    buildLLMMessages: optiopns.buildLLMMessages,

    locale: rootStore.getState().locale,
    gender: rootStore.getState().brainGender || rootStore.getState().gender,
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext,
    languageRule,
    genderRule,

    welcomeText: optiopns.welcomeText,
    companionWelcomeText: optiopns.companionWelcomeText,
    assistantWelcomeText: optiopns.assistantWelcomeText,

    onLlmLoading() {
      aiAvatarWidget.speechEngine.spokenDisplayText =
        '開始下載 AI 大腦（約 1GB，只需第一次）…';
      callOptionEvent.call(this, 'onLlmLoading');
    },
    onLlmLoadProgress(p) {
      uiDom.btnLlmEl.textContent =
        '🧠 ' + Math.round((p.progress || 0) * 100) + '%';
      callOptionEvent.call(this, 'onLlmLoadProgress', p);
    },
    onLlmLoaded() {
      uiDom.btnLlmEl.textContent = '🧠✓';
      uiDom.btnLlmEl.setAttribute('css-llm-on', 'true');
      aiAvatarWidget.speechEngine.spokenAudioText =
        'AI 大腦啟用完成，現在我可以聊得更自然囉！';
      aiAvatarWidget.speechEngine.spokenDisplayText =
        'AI 大腦啟用完成，現在我可以聊得更自然囉！';
      callOptionEvent.call(this, 'onLlmLoaded');
    },
    onLlmLoadError(error) {
      uiDom.btnLlmEl.textContent = '🧠✗';
      aiAvatarWidget.speechEngine.spokenDisplayText =
        'AI 大腦載入失敗：' + (error?.message || error);
      callOptionEvent.call(this, 'onLlmLoadError', error);
    },
    onAiProviderConnecting() {
      const btnLlmEl = uiDom.btnLlmEl;
      if (btnLlmEl instanceof HTMLElement) {
        btnLlmEl.textContent = '🧠…';
        btnLlmEl.title = 'AI 伺服器大腦（連線中）';
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
          btnLlmEl.title = 'AI 伺服器：已連線 ' + aiProvider.model;
        } else {
          btnLlmEl.title = 'AI 伺服器連不上（檢查 AI 伺服器是否在跑 / CORS）';
        }
      }
      if (ok === true) {
        setTimeout(() => {
          aiAvatarWidget.speechEngine.spokenDisplayText =
            '已接上 AI 伺服器大腦（' +
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
      streamSpeechState.buf = '';
    },
    onStreamChunk(delta) {
      if (streamSpeechId !== 0) {
        if (streamSpeechId !== speechEngine.speakSeq) {
          return;
        }
        streamSpeechState.buf += delta;
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
        for (const sentence of speechEngine.drainSentences(
          streamSpeechState,
          true
        )) {
          speechEngine.pushSpeech(streamSpeechId, sentence);
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
        uiDom.updateMicState(isListening, convoOn, isCompanion);
      }
      callOptionEvent.call(this, 'onMicStateChanged', isListening, convoOn);
    },
    onVoiceStatusChanged(convoOn, text, state, level) {
      if (typeof uiDom.updateVoiceStatus === 'function') {
        uiDom.updateVoiceStatus(convoOn, text, state, level);
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
    onLanguageChanged(locale, localeLabel) {
      if (uiDom.langButtonEl instanceof HTMLButtonElement) {
        uiDom.langButtonEl.textContent = localeLabel;
      }
      callOptionEvent.call(this, 'onLanguageChanged', locale, localeLabel);
    },
    onSpeaking: (text) => {
      callOptionEvent.call(this, 'onSpeaking', text);
    },
    onSpeakingEnd: () => {
      callOptionEvent.call(this, 'onSpeakingEnd');
    }
  });

  const toolsOptions = {
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
    speechEngine.subscribe('isSpeaking', (val) => {
      if (skinEngine && typeof skinEngine.setIsSpeaking === 'function') {
        skinEngine.setIsSpeaking(val);
      }
    });
  }

  // 初始化 UI 語音狀態
  uiDom.updateVoiceStatus(
    aiAvatarWidget.speechEngine.convoOn,
    '即時語音待命',
    '',
    0
  );

  if (typeof optiopns.onReady === 'function') {
    aiAvatarWidget.onReady = optiopns.onReady.bind(aiAvatarWidget);
  }

  if (typeof optiopns.onMinimalTrigger === 'function') {
    aiAvatarWidget.onMinimalTrigger =
      optiopns.onMinimalTrigger.bind(aiAvatarWidget);
  }

  initSkinModeChangeButton(aiAvatarWidget, skinEngine.has2D, skinEngine.has3D);
  renderSuggestions(aiAvatarWidget);
  bindTyping(aiAvatarWidget);
  bindUiEvent(aiAvatarWidget);
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
