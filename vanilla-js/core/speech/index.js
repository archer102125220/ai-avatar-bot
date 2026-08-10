// TODO: 等到環境可以測試麥克風跟喇叭時，要徹底測過這份檔案內部的所有機制有沒有因為重構而出問題
import {
  DEFAULT_TTS_ENDPOINT,
  GENDER_MAP,
  AVATAR_MODE_MAP
} from '../constants';
import { createBaseStore } from '../store';
import { initDefaultSTTEngine, validateSTTEngine } from './stt';
import { splitSentences, initDefaultTTSEngine, validateTTSEngine } from './tts';

export { validateTTSEngine, validateSTTEngine };

/**
 * 語音引擎實例，作為 STT 與 TTS 的中央統籌，並負責整合事件與串接 LLM 回應。
 *
 * @typedef {Object} SpeechEngine
 * @property {function(string, function): function} subscribe - 訂閱狀態變更 (例如: 'spokenDisplayText', 'gender' 等)。
 * @property {function(): Object} getState - 取得當前所有內部狀態。
 * @property {function(Object): void} setState - 覆寫或更新部分狀態。
 * @property {Object|null} skin - 目前的 Skin (UI/視覺) 實例。
 * @property {Object|null} brain - 目前的 Brain (大腦/LLM) 實例。
 * @property {Object|null} avatarModel - 目前的 Avatar 3D 模型實例。
 * @property {Object|null} tools - 目前的 Tools (外部工具) 實例。
 * @property {string} gender - 目前設定的性別 (例如: 'female', 'male')。
 * @property {function(string): void} setGender - 設定語音性別。
 * @property {string|null} avatarMode - 目前的虛擬人模式 (Companion 或 Assistant)。
 * @property {function(string): void} [setEmotionFromText] - 從文字中分析並設定情感的函數。
 * @property {HTMLElement|null} container - 虛擬人的根容器 DOM 元素。
 * @property {function(boolean, string, string, number): void} [onVoiceStatusChanged] - 語音狀態變更回調。
 * @property {function(boolean, boolean): void} [onMicStateChanged] - 麥克風開關狀態變更回調。
 * @property {function(string, string): void} [onLanguageChanged] - 語言變更回調。
 * @property {string} ttsEndpoint - 神經網路語音合成的 API 端點。
 * @property {string} neuralVoice - 指定的神經網路語音模型名稱。
 * @property {number} speakSeq - 目前語音播放的序列號，用於追蹤最新的語音播放。
 * @property {boolean} isSpeaking - 目前是否正在播放語音 (TTS 說話中)。
 * @property {boolean} isListening - 目前是否正在接收麥克風音訊 (STT 聆聽中)。
 * @property {boolean} ttsMuted - 語音合成是否靜音。
 * @property {boolean} convoOn - 是否處於連續對話模式。
 * @property {boolean} isProcessing - 是否正在處理中 (例如等待 LLM 回應，此時不應聆聽)。
 * @property {number} assistantSpeechStartedAt - 助理開始說話的時間戳。
 * @property {string} spokenDisplayText - 目前在畫面上顯示的對話字幕。
 * @property {string} spokenAudioText - 最新準備或正在轉換為語音的純文字。
 * @property {function(string, Object=): void} speak - 將指定文字轉換為語音並播放。
 * @property {function(): void} stopSpeaking - 停止當前的語音播放。
 * @property {function(): void} interruptForVoice - 打斷當前助理的回應 (包含中斷 LLM) 並進入聆聽狀態。
 * @property {function(): Array<number>} computeMouth - 計算並回傳當前語音對應的嘴型資料 (Viseme)。
 * @property {function(): void} onTap - 處理使用者點擊虛擬人的互動事件。
 * @property {function(string=): void} stopVoiceSession - 停止即時語音對話工作階段。
 * @property {function(boolean): void} setMic - 設定並通知麥克風開關狀態變更。
 * @property {function(): void} startListening - 開始透過麥克風聆聽語音輸入。
 * @property {function(string): Promise<void>|void} preloadTapGreeting - 預載點擊時的問候語音。
 * @property {function(string): void} setLocale - 設定 STT/TTS 語言與地區 (例如 'zh-TW', 'en-US')。
 * @property {string} _speechBuf - [內部屬性] 語音文字緩衝區。
 * @property {Array<string>} _speechQueue - [內部屬性] 語音句子播放佇列。
 * @property {function(Object, boolean=): Array<string>} drainSentences - [內部方法] 從狀態緩衝區提取完整句子。
 * @property {function(): number} beginSpeech - 標記開始一段新的語音生成，回傳新的 speakSeq。
 * @property {function(number, string, Object=): void} pushSpeech - 將文字片段推入語音佇列並依序播放。
 * @property {function(number, Object=): void} _playNextQueue - [內部方法] 播放佇列中的下一段語音。
 * @property {function(): void} _onTTSSpeakEnd - [內部方法] TTS 單句播放結束的回調處理。
 * @property {boolean} _speechEndedFlag - [內部屬性] 標記目前文字流是否已全部生成完畢。
 * @property {function(number): void} endSpeech - 標記特定序號的語音流文字生成結束。
 * @property {function(): void} onUtteranceEnd - 整段語音完全結束的處理邏輯 (解除 processing 狀態)。
 * @property {function(string): Promise<void>} handleUser - 處理使用者輸入的文字。
 * @property {string|function} greeting - 預設問候語或動態生成問候語的函數。
 * @property {string|function} companionGreeting - 陪伴模式的問候語。
 * @property {string|function} assistantGreeting - 助理模式的問候語。
 */

/**
 * 處理使用者輸入的文字訊息。
 * 會檢查是否有等待中的工具操作 (Tool Confirmation/Choice/Input)，
 * 若有則轉交工具引擎處理。同時負責更新對話紀錄與觸發 LLM 大腦生成回應。
 *
 * @param {SpeechEngine} speechEngine - 語音引擎與狀態管理的實例。
 * @param {string} [text=''] - 使用者輸入的文字。
 * @returns {Promise<void>}
 */
export async function handleUser(speechEngine, text = '') {
  const rootContainer = speechEngine.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error('[aiAvatar handleUser] rootContainer is not an HTMLElement');
    return;
  }

  if (typeof text === 'string' && text !== '') {
    speechEngine.brain.addChatMessage('user', text);
    speechEngine.spokenDisplayText = '你：' + text;
  }

  if (
    text !== '' &&
    typeof speechEngine.tools.pendingToolConfirmation === 'string' &&
    speechEngine.tools.pendingToolConfirmation !== '' &&
    speechEngine.tools.continueToolConfirmation(text)
  ) {
    return;
  }
  if (
    text !== '' &&
    typeof speechEngine.tools.pendingToolChoice === 'object' &&
    speechEngine.tools.pendingToolChoice !== null &&
    speechEngine.tools.continueToolChoice(text)
  ) {
    return;
  }
  if (
    text !== '' &&
    typeof speechEngine.tools.pendingToolInput === 'object' &&
    speechEngine.tools.pendingToolInput !== null &&
    speechEngine.tools.continueToolInput(text)
  ) {
    return;
  }

  if (speechEngine.brain.mem.isCompanion === true && text !== '') {
    if (/忘記我|清除記憶|forget me/i.test(text) === true) {
      speechEngine.brain.mem.wipe();
      speechEngine.spokenAudioText = '好，我把記憶都清掉了，我們重新認識吧！';
      return;
    }
    speechEngine.brain.mem.captureName(text);
    speechEngine.brain.mem.addTurn('user', text);
  }

  const routedTool = speechEngine.tools.routeHostTool(text);
  if (
    Array.isArray(routedTool.ambiguous) === true &&
    routedTool.ambiguous.length > 0
  ) {
    speechEngine.isProcessing = false;
    speechEngine.tools.offerToolChoices(text, routedTool.ambiguous);
    return;
  }
  if (typeof routedTool.match === 'object' && routedTool.match !== null) {
    speechEngine.isProcessing = false;
    speechEngine.tools.prepareTool(
      routedTool.match.tool,
      text,
      { confidence: routedTool.match.score, reason: routedTool.match.reason },
      {}
    );
    return;
  }

  speechEngine.isProcessing = true;

  if (
    typeof speechEngine.skin === 'object' &&
    speechEngine.skin !== null &&
    speechEngine.skin.gestureName !== undefined
  ) {
    speechEngine.skin.gestureName = 'thinking';
  }

  speechEngine.brain.handleAnswer(text);
}

/**
 * 處理使用者點擊虛擬人 (Avatar) 的互動事件。
 * 包含點擊冷卻時間控制、觸發 3D 模型動作，以及根據目前模式生成並播放問候語。
 *
 * @param {SpeechEngine} speechEngine - 語音引擎與狀態管理的實例。
 */
export function onTap(speechEngine) {
  if (speechEngine.onTapTimer === true) {
    return;
  }
  speechEngine.onTapTimer = true;
  setTimeout(() => {
    speechEngine.onTapTimer = false;
  }, 400);
  if (
    typeof speechEngine.skin.avatarModel === 'object' &&
    speechEngine.skin.avatarModel !== null
  ) {
    try {
      speechEngine.skin.avatarModel.motion('Tap');
    } catch (_error) {}
  }

  let greeting = '你好～';

  if (typeof speechEngine.greeting === 'function') {
    greeting = speechEngine.greeting({
      isCompanion: speechEngine.brain.mem.isCompanion,
      visits: speechEngine.brain.mem.data.visits,
      name: speechEngine.brain.mem.data.name
    });
  } else if (typeof speechEngine.greeting === 'string') {
    greeting = speechEngine.greeting;
  } else if (speechEngine.avatarMode === AVATAR_MODE_MAP.companion) {
    greeting =
      (typeof speechEngine.brain.mem.data.name === 'string' &&
      speechEngine.brain.mem.data.name !== ''
        ? speechEngine.brain.mem.data.name + '～'
        : '你好～') + '想聊什麼都可以，點 💬 我們就開始！';

    if (typeof speechEngine.companionGreeting === 'function') {
      greeting = speechEngine.companionGreeting({
        isCompanion: speechEngine.brain.mem.isCompanion,
        visits: speechEngine.brain.mem.data.visits,
        name: speechEngine.brain.mem.data.name
      });
    } else if (typeof speechEngine.companionGreeting === 'string') {
      greeting = speechEngine.companionGreeting;
    }
  } else if (speechEngine.avatarMode === AVATAR_MODE_MAP.assistant) {
    greeting =
      '你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！';

    if (typeof speechEngine.assistantGreeting === 'function') {
      greeting = speechEngine.assistantGreeting({
        isCompanion: speechEngine.brain.mem.isCompanion,
        visits: speechEngine.brain.mem.data.visits,
        name: speechEngine.brain.mem.data.name
      });
    } else if (typeof speechEngine.assistantGreeting === 'string') {
      greeting = speechEngine.assistantGreeting;
    }
  }

  speechEngine.spokenAudioText = greeting;
}

/**
 * 語音引擎初始化選項。
 *
 * @typedef {Object} SpeechEngineOptions
 * @property {Object} [customEngines={}] - 開發者自訂注入的 STT 與 TTS 引擎實例。
 * @property {Object|function(Object): Object} [customEngines.stt] - 自訂的 STT 引擎或其初始化函數。
 * @property {Object|function(Object): Object} [customEngines.tts] - 自訂的 TTS 引擎或其初始化函數。
 * @property {string} [ttsEndpoint] - 神經網路語音合成的 API 端點。
 * @property {string} [neuralVoice] - 指定的神經網路語音模型名稱。
 * @property {function(): Object} [getSkin] - 取得目前的 Skin 實例。
 * @property {function(): Object} [getBrain] - 取得目前的 Brain (大腦/LLM) 實例。
 * @property {function(): Object} [getAvatarModel] - 取得目前的 AvatarModel (3D 虛擬人模型) 實例。
 * @property {function(): Object} [getTools] - 取得目前的 Tools (外部工具) 實例。
 * @property {function(): string} [getGender] - 取得目前的性別。
 * @property {function(): string} [getAvatarMode] - 取得目前的虛擬人模式 (Companion 或 Assistant)。
 * @property {function(string): void} [setEmotionFromText] - 從文字中分析並設定情感的函數。
 * @property {function(): HTMLElement} [getContainer] - 取得根容器元素。
 * @property {function(boolean, string, string, number): void} [onVoiceStatusChanged] - 語音狀態改變的回調。
 * @property {function(boolean, boolean): void} [onMicStateChanged] - 麥克風開關狀態改變的回調 (isListening, convoOn)。
 * @property {function(string, string): void} [onLanguageChanged] - 語言改變的回調 (locale, label)。
 * @property {function(string): void} [onSpokenDisplayTextChange] - 語音文字改變的回調。
 * @property {function(string): void} [onSpeaking] - 語音準備播放的回調。
 * @property {function(): void} [onSpeakingEnd] - 語音播放完全結束的回調。
 * @property {function|string} [greeting] - 預設問候語。
 * @property {function|string} [companionGreeting] - 陪伴模式的問候語。
 * @property {function|string} [assistantGreeting] - 助理模式的問候語。
 */

/**
 * 建立並初始化作為 STT 與 TTS 中央統籌的語音引擎 (Speech Orchestrator)。
 * 負責整合語音辨識、語音合成、事件派發以及串接 LLM 回應的斷句與佇列播放。
 * 支援透過 customEngines 動態抽換底層的語音轉文字 (STT) 與語音合成 (TTS) 引擎。
 *
 * @param {SpeechEngineOptions} [setting={}] - 初始化設定選項。
 * @returns {Promise<SpeechEngine>} 包含完整語音控制介面的 SpeechEngine 實例。
 */
export async function initSpeechEngine(setting = {}) {
  const { customEngines = {}, ttsEndpoint, neuralVoice } = setting;
  let sttEngine = null;
  let ttsEngine = null;

  const store = createBaseStore({
    isSpeaking: false,
    isListening: false,
    spokenDisplayText: '',
    spokenAudioText: '',
    gender: setting.getGender ? setting.getGender() : GENDER_MAP.female,
    ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    neuralVoice,
    speakSeq: 0,
    ttsMuted: false,
    convoOn: false,
    isProcessing: false,
    assistantSpeechStartedAt: 0,
    greeting: null,
    companionGreeting: null,
    assistantGreeting: null
  });

  store.subscribe('spokenDisplayText', (val) => {
    if (typeof setting.onSpokenDisplayTextChange === 'function') {
      setting.onSpokenDisplayTextChange(val);
    }
  });

  store.subscribe('gender', (val) => {
    ttsEngine.setGender(val);
  });

  store.subscribe('ttsMuted', (val) => {
    ttsEngine.isMuted = val;
  });

  store.subscribe('spokenAudioText', (val) => {
    store.setState({ spokenDisplayText: val });
    if (typeof setting.onSpeaking === 'function') {
      setting.onSpeaking(val);
    }
    speechEngine.speak(val);
  });

  const speechEngine = {
    subscribe: store.subscribe,
    getState: store.getState,
    setState: store.setState,

    get skin() {
      return setting.getSkin ? setting.getSkin() : null;
    },
    get brain() {
      return setting.getBrain ? setting.getBrain() : null;
    },
    get avatarModel() {
      return setting.getAvatarModel ? setting.getAvatarModel() : null;
    },
    get tools() {
      return setting.getTools ? setting.getTools() : null;
    },
    get gender() {
      return store.getState().gender;
    },
    setGender(newGender) {
      store.setState({ gender: newGender });
    },
    get avatarMode() {
      return setting.getAvatarMode ? setting.getAvatarMode() : null;
    },
    get setEmotionFromText() {
      return setting.setEmotionFromText;
    },
    get container() {
      return setting.getContainer ? setting.getContainer() : null;
    },

    onVoiceStatusChanged: setting.onVoiceStatusChanged,
    onMicStateChanged: setting.onMicStateChanged,
    onLanguageChanged: setting.onLanguageChanged,

    get ttsEndpoint() {
      return store.getState().ttsEndpoint;
    },
    set ttsEndpoint(val) {
      store.setState({ ttsEndpoint: val });
    },

    get neuralVoice() {
      return store.getState().neuralVoice;
    },
    set neuralVoice(val) {
      store.setState({ neuralVoice: val });
    },

    get speakSeq() {
      return store.getState().speakSeq;
    },
    set speakSeq(newSpeakSeq) {
      store.setState({ speakSeq: newSpeakSeq });
    },

    get isSpeaking() {
      return store.getState().isSpeaking;
    },
    get isListening() {
      return sttEngine.isListening;
    },

    get ttsMuted() {
      return store.getState().ttsMuted;
    },
    set ttsMuted(newTtsMuted) {
      store.setState({ ttsMuted: newTtsMuted });
    },

    get convoOn() {
      return store.getState().convoOn;
    },
    set convoOn(val) {
      store.setState({ convoOn: val });
    },
    get isProcessing() {
      return store.getState().isProcessing;
    },
    set isProcessing(val) {
      store.setState({ isProcessing: val });
    },
    get assistantSpeechStartedAt() {
      return store.getState().assistantSpeechStartedAt;
    },
    set assistantSpeechStartedAt(val) {
      store.setState({ assistantSpeechStartedAt: val });
    },

    get spokenDisplayText() {
      return store.getState().spokenDisplayText;
    },
    set spokenDisplayText(newSpeakingLabel) {
      store.setState({ spokenDisplayText: newSpeakingLabel });
    },

    speak: (text, options) => {
      speechEngine.assistantSpeechStartedAt = performance.now();
      ttsEngine.speak(text, options);
    },

    get spokenAudioText() {
      return store.getState().spokenAudioText;
    },
    set spokenAudioText(newSpeakingSounds) {
      store.setState({ spokenAudioText: newSpeakingSounds });
    },

    stopSpeaking: () => {
      speechEngine.speakSeq++;
      ttsEngine.stop();
    },

    interruptForVoice: () => {
      speechEngine.speakSeq++;
      if (typeof speechEngine.brain?.llm?.controller?.abort === 'function') {
        try {
          speechEngine.brain.llm.controller.abort();
        } catch (_error) {}
      }
      speechEngine.stopSpeaking();
      speechEngine.isProcessing = false;
      if (typeof speechEngine.onVoiceStatusChanged === 'function') {
        speechEngine.onVoiceStatusChanged(
          speechEngine.convoOn,
          '已停止回答，請繼續說…',
          'listening',
          0
        );
      }
      setTimeout(() => {
        if (speechEngine.convoOn === true && !speechEngine.isListening) {
          speechEngine.startListening();
        }
      }, 100);
    },

    computeMouth: () => ttsEngine.computeMouth(),

    onTap: () => onTap(speechEngine),

    stopVoiceSession: (message) => {
      speechEngine.convoOn = false;
      speechEngine.isProcessing = false;
      speechEngine.stopSpeaking();
      sttEngine.stopListening();
      if (typeof speechEngine.onVoiceStatusChanged === 'function') {
        speechEngine.onVoiceStatusChanged(false, '', '', 0);
      }
      if (typeof message === 'string' && message !== '') {
        speechEngine.spokenDisplayText = message;
      }
    },

    setMic: (isListening) => {
      if (typeof speechEngine.onMicStateChanged === 'function') {
        speechEngine.onMicStateChanged(isListening, speechEngine.convoOn);
      }
    },

    startListening: () => {
      if (speechEngine.isSpeaking || speechEngine.isProcessing) {
        speechEngine.stopSpeaking();
      }
      sttEngine.startListening();
    },

    preloadTapGreeting: (text) => {
      if (typeof ttsEngine.preloadTapGreeting === 'function') {
        return ttsEngine.preloadTapGreeting(text);
      }
    },

    setLocale: (locale) => {
      ttsEngine.setLocale(locale);
      if (typeof speechEngine.onLanguageChanged === 'function') {
        let label = '語音預設';
        if (/en/i.test(locale)) {
          label = '英文 (English)';
        } else if (/ja/i.test(locale)) {
          label = '日文 (日本語)';
        } else if (/ko/i.test(locale)) {
          label = '韓文 (한국어)';
        } else if (/zh/i.test(locale)) {
          label = '繁體中文';
        }
        speechEngine.onLanguageChanged(locale, label);
      }
    },

    _speechBuf: '',
    _speechQueue: [],

    drainSentences: (state, force) => {
      const parts = splitSentences(state.buf);
      if (parts.length > 1 || (force && parts.length > 0)) {
        const out = force ? parts : parts.slice(0, parts.length - 1);
        state.buf = force ? '' : parts[parts.length - 1];
        return out;
      }
      return [];
    },

    beginSpeech: () => {
      speechEngine.stopSpeaking();
      speechEngine._speechBuf = '';
      speechEngine._speechQueue = [];
      speechEngine.speakSeq++;
      return speechEngine.speakSeq;
    },

    pushSpeech: (sid, text, options) => {
      if (sid !== speechEngine.speakSeq) return;
      speechEngine._speechBuf += text;
      speechEngine._speechQueue.push(text);

      if (!ttsEngine.isSpeaking) {
        speechEngine._playNextQueue(sid, options);
      }
    },

    _playNextQueue: (sid, options) => {
      if (sid !== speechEngine.speakSeq) return;
      if (speechEngine._speechQueue.length > 0) {
        const sentence = speechEngine._speechQueue.shift();
        speechEngine.speak(sentence, options);
      } else {
        if (speechEngine._speechEndedFlag) {
          speechEngine.onUtteranceEnd();
        }
      }
    },

    _onTTSSpeakEnd: () => {
      if (speechEngine._speechQueue.length > 0) {
        speechEngine._playNextQueue(speechEngine.speakSeq, {});
      } else if (speechEngine._speechEndedFlag) {
        speechEngine.onUtteranceEnd();
      } else {
        if (typeof setting.onSpeakingEnd === 'function') {
          setting.onSpeakingEnd();
        }
      }
    },

    _speechEndedFlag: false,
    endSpeech: (sid) => {
      if (sid !== speechEngine.speakSeq) return;
      speechEngine._speechEndedFlag = true;
      if (!ttsEngine.isSpeaking && speechEngine._speechQueue.length === 0) {
        speechEngine.onUtteranceEnd();
      }
    },

    onUtteranceEnd: () => {
      speechEngine.isProcessing = false;
      speechEngine._speechEndedFlag = false;
      if (speechEngine.convoOn && !speechEngine.isListening) {
        speechEngine.startListening();
      }
    },

    handleUser: (text) => handleUser(speechEngine, text),

    get greeting() {
      return store.getState().greeting;
    },
    set greeting(val) {
      store.setState({ greeting: val });
    },

    get companionGreeting() {
      return store.getState().companionGreeting;
    },
    set companionGreeting(val) {
      store.setState({ companionGreeting: val });
    },

    get assistantGreeting() {
      return store.getState().assistantGreeting;
    },
    set assistantGreeting(val) {
      store.setState({ assistantGreeting: val });
    }
  };

  if (typeof setting.greeting === 'function')
    speechEngine.greeting = setting.greeting.bind();
  if (typeof setting.companionGreeting === 'function')
    speechEngine.companionGreeting = setting.companionGreeting.bind();
  else if (typeof setting.companionGreeting === 'string')
    speechEngine.companionGreeting = setting.companionGreeting;
  if (typeof setting.assistantGreeting === 'function')
    speechEngine.assistantGreeting = setting.assistantGreeting.bind();
  else if (typeof setting.assistantGreeting === 'string')
    speechEngine.assistantGreeting = setting.assistantGreeting;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden === true && speechEngine.convoOn === true) {
      speechEngine.stopVoiceSession('頁面進入背景，即時語音已停止。');
    }
  });

  // --- TTS Setup ---
  const ttsOptions = {
    ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    neuralVoice: neuralVoice,
    gender: speechEngine.gender,
    onSpeakStart: () => {
      // Tap motion trigger when speaking starts
      if (typeof speechEngine.skin?.avatarModel?.motion === 'function') {
        try {
          speechEngine.skin.avatarModel.motion('Tap');
        } catch (_e) {}
      }
    },
    onSpeakEnd: () => {
      if (typeof speechEngine._onTTSSpeakEnd === 'function') {
        speechEngine._onTTSSpeakEnd();
      }
    },
    onSpokenDisplayTextChange: (text) => {
      speechEngine.spokenDisplayText = text;
    }
  };

  if (typeof customEngines?.tts !== 'undefined' && customEngines.tts !== null) {
    try {
      const customInstance =
        typeof customEngines.tts === 'function'
          ? await customEngines.tts(ttsOptions)
          : customEngines.tts;
      const validation = validateTTSEngine(customInstance);
      if (validation.isValid) {
        ttsEngine = customInstance;
      } else {
        console.error(
          `[AvatarBot] 自訂 ttsEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
        );
      }
    } catch (e) {
      console.error('[AvatarBot] 初始化自訂 ttsEngine 發生錯誤:', e);
    }
  }
  if (!ttsEngine) {
    ttsEngine = initDefaultTTSEngine(ttsOptions);
  }

  if (typeof ttsEngine.subscribe === 'function') {
    ttsEngine.subscribe('isSpeaking', (val) => {
      store.setState({ isSpeaking: val });
    });
  }

  // --- STT Setup ---
  const sttOptions = {
    getAssistantActive: () =>
      speechEngine.isSpeaking || speechEngine.isProcessing,
    getSpeechDuration: () =>
      performance.now() -
      (speechEngine.assistantSpeechStartedAt || performance.now()),
    getConvoOn: () => speechEngine.convoOn,
    onResult: (text, isFinal) => {
      if (isFinal) {
        speechEngine.handleUser(text);
      } else {
        speechEngine.spokenDisplayText = '你：' + text + '…';
        if (typeof speechEngine.onVoiceStatusChanged === 'function') {
          speechEngine.onVoiceStatusChanged(
            speechEngine.convoOn,
            '正在辨識：' + text,
            'listening',
            0
          );
        }
      }
    },
    onMicLevel: (rms, showVoiceUI, stateString, levelAmp) => {
      if (typeof speechEngine.onVoiceStatusChanged === 'function') {
        speechEngine.onVoiceStatusChanged(
          showVoiceUI,
          undefined,
          stateString,
          levelAmp
        );
      }
    },
    onBargeIn: () => {
      if (typeof speechEngine.interruptForVoice === 'function') {
        speechEngine.interruptForVoice();
      }
    },
    onError: (errorMessage, isNotAllowed) => {
      if (isNotAllowed) {
        speechEngine.convoOn = false;
        speechEngine.spokenDisplayText = errorMessage;
        if (typeof speechEngine.onVoiceStatusChanged === 'function') {
          speechEngine.onVoiceStatusChanged(
            speechEngine.convoOn,
            '麥克風權限被拒絕',
            '',
            0
          );
        }
      } else {
        speechEngine.spokenDisplayText = errorMessage;
      }
    },
    onStatusChange: (isListening, statusMessage) => {
      if (typeof speechEngine.onMicStateChanged === 'function') {
        speechEngine.onMicStateChanged(isListening, speechEngine.convoOn);
      }
      if (
        statusMessage &&
        typeof speechEngine.onVoiceStatusChanged === 'function'
      ) {
        speechEngine.onVoiceStatusChanged(
          speechEngine.convoOn,
          statusMessage,
          isListening ? 'listening' : 'thinking',
          0
        );
      }
    },
    onNoSpeechAbort: () => {
      speechEngine.stopVoiceSession('連續幾次沒有聽到聲音，即時對話已暫停。');
    }
  };

  if (typeof customEngines?.stt !== 'undefined' && customEngines.stt !== null) {
    try {
      const customInstance =
        typeof customEngines.stt === 'function'
          ? await customEngines.stt(sttOptions)
          : customEngines.stt;
      const validation = validateSTTEngine(customInstance);
      if (validation.isValid) {
        sttEngine = customInstance;
      } else {
        console.error(
          `[AvatarBot] 自訂 sttEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
        );
      }
    } catch (e) {
      console.error('[AvatarBot] 初始化自訂 sttEngine 發生錯誤:', e);
    }
  }
  if (!sttEngine) {
    sttEngine = initDefaultSTTEngine(sttOptions);
  }

  return speechEngine;
}
