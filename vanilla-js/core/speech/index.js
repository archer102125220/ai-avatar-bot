// TODO: 等到環境可以測試麥克風跟喇叭時，要徹底測過這份檔案內部的所有機制有沒有因為重構而出問題
import { DEFAULT_TTS_ENDPOINT, GENDER_MAP } from '../constants';
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
 * @property {string} gender - 目前設定的性別 (例如: 'female', 'male')。
 * @property {function(string): void} setGender - 設定語音性別。
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
 * @property {boolean} isProcessing - 是否正在處理中。
 * @property {number} assistantSpeechStartedAt - 助理開始說話的時間戳。
 * @property {string} spokenDisplayText - 目前在畫面上顯示的對話字幕。
 * @property {string} spokenAudioText - 最新準備或正在轉換為語音的純文字。
 * @property {function(string, Object=): void} speak - 將指定文字轉換為語音並播放。
 * @property {function(): void} stopSpeaking - 停止當前的語音播放。
 * @property {function(): void} interruptForVoice - 打斷當前助理的回應 (包含中斷 LLM) 並進入聆聽狀態。
 * @property {function(): Array<number>} computeMouth - 計算並回傳當前語音對應的嘴型資料 (Viseme)。
 * @property {function(): void} triggerTap - 觸發使用者點擊虛擬人的互動事件。
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
 */

/**
 * @typedef {Object} SpeechEngineOptions
 * @property {Object} [customEngines={}] - 開發者自訂注入的 STT 與 TTS 引擎實例。
 * @property {Object|function(Object): Object} [customEngines.stt] - 自訂的 STT 引擎或其初始化函數。
 * @property {Object|function(Object): Object} [customEngines.tts] - 自訂的 TTS 引擎或其初始化函數。
 * @property {string} [ttsEndpoint] - 神經網路語音合成的 API 端點。
 * @property {string} [neuralVoice] - 指定的神經網路語音模型名稱。
 * @property {function(): string} [getGender] - 取得目前的性別。
 * @property {function(): HTMLElement} [getContainer] - 取得根容器元素。
 * @property {function(boolean, string, string, number): void} [onVoiceStatusChanged] - 語音狀態改變的回調。
 * @property {function(boolean, boolean): void} [onMicStateChanged] - 麥克風開關狀態改變的回調 (isListening, convoOn)。
 * @property {function(string, string): void} [onLanguageChanged] - 語言改變的回調 (locale, label)。
 * @property {function(string): void} [onSpokenDisplayTextChange] - 語音文字改變的回調。
 * @property {function(string): void} [onSpeaking] - 語音準備播放的回調。
 * @property {function(): void} [onSpeakingEnd] - 語音播放完全結束的回調。
 * @property {function(string): void} [onUserInput] - 使用者文字輸入回調。
 * @property {function(): void} [onTapAvatar] - 使用者點擊虛擬人回調。
 * @property {function(): void} [onInterrupt] - 語音被打斷的回調。
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
    assistantSpeechStartedAt: 0
  });

  let spokenDisplayTextTimer = null;
  store.subscribe('spokenDisplayText', (val) => {
    if (typeof setting.onSpokenDisplayTextChange === 'function') {
      setting.onSpokenDisplayTextChange(val);
    }
    if (spokenDisplayTextTimer) {
      clearTimeout(spokenDisplayTextTimer);
    }
    if (val !== '') {
      spokenDisplayTextTimer = setTimeout(() => {
        if (typeof setting.onSpokenDisplayTextTimeout === 'function') {
          setting.onSpokenDisplayTextTimeout();
        }
      }, 6000);
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

    get gender() {
      return store.getState().gender;
    },
    setGender(newGender) {
      store.setState({ gender: newGender });
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
      if (typeof setting.onInterrupt === 'function') {
        setting.onInterrupt();
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

    triggerTap: () => {
      if (typeof setting.onTapAvatar === 'function') {
        setting.onTapAvatar();
      }
    },

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
          label = 'English';
        } else if (/ja/i.test(locale)) {
          label = '日本語';
        } else if (/ko/i.test(locale)) {
          label = '한국어';
        } else if (/zh/i.test(locale)) {
          label = '中文';
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
    }
  };

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
      // 移除誤植的 onTapAvatar 呼叫，避免中斷正常回答並播放歡迎詞
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
        if (typeof setting.onUserInput === 'function') {
          setting.onUserInput(text);
        }
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
