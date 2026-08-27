// TODO: 等到環境可以測試麥克風跟喇叭時，要徹底測過這份檔案內部的所有機制有沒有因為重構而出問題
import { DEFAULT_TTS_ENDPOINT, GENDER_MAP } from '../constants';
import { createBaseStore } from '../store';
import { getSttMessage, initDefaultSTTEngine, validateSTTEngine } from './stt';
import { splitSentences, initDefaultTTSEngine, validateTTSEngine } from './tts';

export {
  validateTTSEngine,
  validateSTTEngine,
  initDefaultSTTEngine,
  initDefaultTTSEngine,
  splitSentences,
  getSttMessage
};

/**
 * 語音引擎實例，作為 STT 與 TTS 的中央統籌，並負責整合事件與串接 LLM 回應。
 *
 * @typedef {Object} SpeechEngine
 * @property {(selector: any, callback?: Function) => () => void} subscribe - 訂閱狀態變更 (例如: 'spokenDisplayText', 'gender' 等)。
 * @property {() => Object} getState - 取得當前所有內部狀態。
 * @property {(updates: Object | ((state: Object) => Object)) => void} setState - 覆寫或更新部分狀態。
 * @property {string} gender - 目前設定的性別 (例如: 'female', 'male')。
 * @property {(gender: string) => void} setGender - 設定語音性別。
 * @property {HTMLElement|null} container - 虛擬人的根容器 DOM 元素。
 * @property {(convoOn: boolean, text: string, state: string, level: number) => void} [onVoiceStatusChanged] - 語音狀態變更回調。
 * @property {(isListening: boolean, convoOn: boolean) => void} [onMicStateChanged] - 麥克風開關狀態變更回調。
 * @property {(locale: string, label: string, shortLabel?: string) => void} [onLanguageChanged] - 語言變更回調。
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
 * @property {(text: string, options?: Object) => void} speak - 將指定文字轉換為語音並播放。
 * @property {() => void} stopSpeaking - 停止當前的語音播放。
 * @property {() => void} interruptForVoice - 打斷當前助理的回應 (包含中斷 LLM) 並進入聆聽狀態。
 * @property {() => Array<number>} computeMouth - 計算並回傳當前語音對應的嘴型資料 (Viseme)。
 * @property {() => void} triggerTap - 觸發使用者點擊虛擬人的互動事件。
 * @property {(message?: string) => void} stopVoiceSession - 停止即時語音對話工作階段。
 * @property {(isListening: boolean) => void} setMic - 設定並通知麥克風開關狀態變更。
 * @property {() => void} startListening - 開始透過麥克風聆聽語音輸入。
 * @property {(text: string) => Promise<void>|void} preloadTapGreeting - 預載點擊時的問候語音。
 * @property {string} locale - 當前語系與地區 (例如 'zh-TW', 'en-US')。
 * @property {(locale: string) => void} setLocale - 設定 STT/TTS 語言與地區 (例如 'zh-TW', 'en-US')。
 * @property {string} _speechBuf - [內部屬性] 語音文字緩衝區。
 * @property {Array<string>} _speechQueue - [內部屬性] 語音句子播放佇列。
 * @property {(state: Object, force?: boolean) => Array<string>} drainSentences - [內部方法] 從狀態緩衝區提取完整句子。
 * @property {() => number} beginSpeech - 標記開始一段新的語音生成，回傳新的 speakSeq。
 * @property {(speechSequenceId: number, text: string, options?: Object) => void} pushSpeech - 將文字片段推入語音佇列並依序播放。
 * @property {(speechSequenceId: number, options?: Object) => void} _playNextQueue - [內部方法] 播放佇列中的下一段語音。
 * @property {() => void} _onTTSSpeakEnd - [內部方法] TTS 單句播放結束的回調處理。
 * @property {boolean} _speechEndedFlag - [內部屬性] 標記目前文字流是否已全部生成完畢。
 * @property {(speechSequenceId: number) => void} endSpeech - 標記特定序號的語音流文字生成結束。
 * @property {() => void} onUtteranceEnd - 整段語音完全結束的處理邏輯 (解除 processing 狀態)。
 */

/**
 * @typedef {Object} SpeechEngineOptions
 * @property {Object} [customEngines={}] - 開發者自訂注入的 STT 與 TTS 引擎實例。
 * @property {Object|((options: Object) => Promise<Object>|Object)} [customEngines.stt] - 自訂的 STT 引擎或其初始化函數。
 * @property {Object|((options: Object) => Promise<Object>|Object)} [customEngines.tts] - 自訂的 TTS 引擎或其初始化函數。
 * @property {string} [ttsEndpoint] - 神經網路語音合成的 API 端點。
 * @property {string} [neuralVoice] - 指定的神經網路語音模型名稱。
 * @property {string} [locale] - 初始語系設定 (例如 'zh-TW')。
 * @property {() => string} [getGender] - 取得目前的性別。
 * @property {() => HTMLElement} [getContainer] - 取得根容器元素。
 * @property {(convoOn: boolean, text: string, state: string, level: number) => void} [onVoiceStatusChanged] - 語音狀態改變的回調。
 * @property {(isListening: boolean, convoOn: boolean) => void} [onMicStateChanged] - 麥克風開關狀態改變的回調 (isListening, convoOn)。
 * @property {(locale: string, label: string, shortLabel?: string) => void} [onLanguageChanged] - 語言改變的回調 (locale, label, shortLabel)。
 * @property {(displayText: string) => void} [onSpokenDisplayTextChange] - 語音文字改變的回調。
 * @property {() => void} [onSpokenDisplayTextTimeout] - 語音文字氣泡顯示逾時的回調。
 * @property {(audioText: string) => void} [onSpeaking] - 語音準備播放的回調。
 * @property {() => void} [onSpeakingEnd] - 語音播放完全結束的回調。
 * @property {(text: string) => void} [onUserInput] - 使用者文字輸入回調。
 * @property {() => void} [onTapAvatar] - 使用者點擊虛擬人回調。
 * @property {() => void} [onInterrupt] - 語音被打斷的回調。
 */

/**
 * 串流文字即時斷句方法。
 * 監聽累積字元緩衝區，一旦出現句尾標點符號便立即切出完整句子供 TTS 排程播放。
 * 同時具備超長子句防呆機制，若字數過長且偵測到逗號即提前斷句，大幅縮短首句語音延遲。
 *
 * @param {{buf?: string, sentenceBuffer?: string}} state - 包含即時文字緩衝區的狀態物件。
 * @param {boolean} [force=false] - 是否強制輸出最後留在緩衝區內的文字（例如串流已結束）。
 * @returns {string[]} 切出可立即發送至 TTS 合成的句子陣列。
 */
export function drainSentences(state, force = false) {
  if (typeof state !== 'object' || state === null) {
    return [];
  }

  const getBuf = () =>
    typeof state.buf === 'string'
      ? state.buf
      : typeof state.sentenceBuffer === 'string'
        ? state.sentenceBuffer
        : '';

  const setBuf = (val) => {
    if (typeof state.buf === 'string') state.buf = val;
    if (typeof state.sentenceBuffer === 'string') state.sentenceBuffer = val;
  };

  let buf = getBuf();
  const out = [];

  while (buf.length > 0) {
    // 尋找句尾標點符號：中文標點 [。！？!?；;\n…\r] 或 英文句點+空白/換行
    const match = buf.match(/[。！？!?；;\n…\r]|\.\s+/);
    if (match && typeof match.index === 'number') {
      const cutPos = match.index + match[0].length;
      const sentence = buf.slice(0, cutPos).trim();
      buf = buf.slice(cutPos);
      if (sentence !== '') {
        out.push(sentence);
      }
    } else if (buf.length >= 40) {
      // 若長度達 40 字元仍未偵測到句號，在逗號處提前切分，避免長句子延遲發聲
      const commaMatch = buf.match(/[，,]\s*/);
      if (
        commaMatch &&
        typeof commaMatch.index === 'number' &&
        commaMatch.index >= 12
      ) {
        const cutPos = commaMatch.index + commaMatch[0].length;
        const sentence = buf.slice(0, cutPos).trim();
        buf = buf.slice(cutPos);
        if (sentence !== '') {
          out.push(sentence);
        }
      } else if (buf.length >= 80) {
        // 80 字元超長防呆切分
        const sentence = buf.slice(0, 80).trim();
        buf = buf.slice(80);
        if (sentence !== '') {
          out.push(sentence);
        }
      } else {
        break;
      }
    } else {
      break;
    }
  }

  if (force === true && buf.trim() !== '') {
    out.push(buf.trim());
    buf = '';
  }

  setBuf(buf);
  return out;
}

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
    locale: setting.locale || 'zh-TW'
  });

  let spokenDisplayTextTimer = null;
  store.subscribe('spokenDisplayText', (displayText) => {
    if (typeof setting.onSpokenDisplayTextChange === 'function') {
      setting.onSpokenDisplayTextChange(displayText);
    }
    if (spokenDisplayTextTimer) {
      clearTimeout(spokenDisplayTextTimer);
    }
    if (displayText !== '') {
      spokenDisplayTextTimer = setTimeout(() => {
        if (typeof setting.onSpokenDisplayTextTimeout === 'function') {
          setting.onSpokenDisplayTextTimeout();
        }
      }, 6000);
    }
  });

  store.subscribe('gender', (newGender) => {
    if (ttsEngine && typeof ttsEngine.setGender === 'function') {
      ttsEngine.setGender(newGender);
    }
  });

  store.subscribe('locale', (newLocale) => {
    if (sttEngine && typeof sttEngine.setLocale === 'function') {
      sttEngine.setLocale(newLocale);
    }
    if (ttsEngine && typeof ttsEngine.setLocale === 'function') {
      ttsEngine.setLocale(newLocale);
    }
  });

  store.subscribe('ttsMuted', (isMuted) => {
    if (ttsEngine) {
      ttsEngine.isMuted = isMuted;
    }
  });

  store.subscribe('spokenAudioText', (audioText) => {
    store.setState({ spokenDisplayText: audioText });
    if (typeof setting.onSpeaking === 'function') {
      setting.onSpeaking(audioText);
    }
    speechEngine.speak(audioText);
  });

  // --- TTS Setup ---
  const ttsOptions = {
    ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    neuralVoice: neuralVoice,
    gender: store.getState().gender,
    locale: store.getState().locale,
    onSpeakStart: (audioText) => {
      if (typeof setting.onSpeaking === 'function') {
        setting.onSpeaking(audioText);
      }
    },
    onSpeakEnd: () => {
      if (typeof speechEngine._onTTSSpeakEnd === 'function') {
        speechEngine._onTTSSpeakEnd();
      }
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
      return sttEngine ? sttEngine.isListening : false;
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
      if (typeof text === 'string' && text.trim() !== '') {
        speechEngine.spokenDisplayText = text.trim();
      }
      ttsEngine.speak(text, options);
      if (typeof ttsEngine.getState === 'function') {
        speechEngine.speakSeq = ttsEngine.getState().speakSeq;
      }
    },

    get spokenAudioText() {
      return store.getState().spokenAudioText;
    },
    set spokenAudioText(newSpeakingSounds) {
      store.setState({ spokenAudioText: newSpeakingSounds });
    },

    stopSpeaking: () => {
      speechEngine.speakSeq++;
      speechEngine._speechEndedFlag = false;
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
      if (sttEngine && typeof sttEngine.stopListening === 'function') {
        sttEngine.stopListening();
      }
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
      if (sttEngine && typeof sttEngine.startListening === 'function') {
        sttEngine.startListening();
      }
    },

    preloadTapGreeting: (text) => {
      if (typeof ttsEngine.preloadTapGreeting === 'function') {
        return ttsEngine.preloadTapGreeting(text);
      }
    },

    get locale() {
      return store.getState().locale;
    },
    setLocale: (locale) => {
      store.setState({ locale });
      if (typeof speechEngine.onLanguageChanged === 'function') {
        let label = '語音預設';
        let shortLabel = '';
        if (/en/i.test(locale)) {
          label = '英文 (English)';
          shortLabel = 'English';
        } else if (/ja/i.test(locale)) {
          label = '日文 (日本語)';
          shortLabel = '日本語';
        } else if (/ko/i.test(locale)) {
          label = '韓文 (한국어)';
          shortLabel = '한국어';
        } else if (/zh/i.test(locale)) {
          label = '繁體中文';
          shortLabel = '中文';
        }
        speechEngine.onLanguageChanged(locale, label, shortLabel);
      }
    },

    _speechBuffer: '',
    get _speechBuf() {
      return this._speechBuffer;
    },
    set _speechBuf(val) {
      this._speechBuffer = val;
    },
    _speechQueue: [],

    drainSentences: (state, force) => {
      return drainSentences(state, force);
    },

    beginSpeech: () => {
      speechEngine.stopSpeaking();
      speechEngine._speechBuffer = '';
      speechEngine._speechEndedFlag = false;
      if (typeof ttsEngine.beginSpeech === 'function') {
        speechEngine.speakSeq = ttsEngine.beginSpeech();
      } else {
        speechEngine.speakSeq++;
      }
      return speechEngine.speakSeq;
    },

    pushSpeech: (speechSequenceId, text, options = {}) => {
      if (speechSequenceId !== speechEngine.speakSeq) return;
      speechEngine._speechBuffer += text;

      if (typeof ttsEngine.pushSpeech === 'function') {
        ttsEngine.pushSpeech(speechSequenceId, text, options);
      } else {
        ttsEngine.speak(text, options);
      }
    },

    _speechEndedFlag: false,
    endSpeech: (speechSequenceId) => {
      if (speechSequenceId !== speechEngine.speakSeq) return;
      speechEngine._speechEndedFlag = true;
      if (typeof ttsEngine.endSpeech === 'function') {
        ttsEngine.endSpeech(speechSequenceId);
      } else {
        if (!ttsEngine.isSpeaking) {
          speechEngine.onUtteranceEnd();
        }
      }
    },

    _onTTSSpeakEnd: () => {
      speechEngine.onUtteranceEnd();
      if (typeof setting.onSpeakingEnd === 'function') {
        setting.onSpeakingEnd();
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
      speechEngine.stopVoiceSession(
        getSttMessage(speechEngine.locale, 'bgStop')
      );
    }
  });

  // --- STT Setup ---
  const sttOptions = {
    locale: store.getState().locale,
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
      speechEngine.stopVoiceSession(
        getSttMessage(speechEngine.locale, 'noSpeechAbort')
      );
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
