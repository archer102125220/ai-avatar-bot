import { createBaseStore } from '../store';

/**
 * @typedef {Object} STTEngineValidationResult
 * @property {boolean} isValid - 標示引擎是否實作了所有必要的方法與屬性。
 * @property {string[]} missing - 缺失的方法或屬性名稱列表。
 */

/**
 * 驗證傳入的語音轉文字 (STT) 引擎是否實作了必要的方法與屬性。
 *
 * @param {Object|null|undefined} engine - 欲驗證的 STT 引擎實例。
 * @returns {STTEngineValidationResult} 包含驗證結果及缺失的方法或屬性列表。
 */
export function validateSTTEngine(engine) {
  const missing = [];
  if (typeof engine !== 'object' || engine === null) {
    missing.push('engine instance');
  } else {
    ['startListening', 'stopListening'].forEach((methodName) => {
      if (typeof engine[methodName] !== 'function') {
        missing.push(`${methodName}()`);
      }
    });
    ['isListening'].forEach((propertyName) => {
      if (!(propertyName in engine)) {
        missing.push(propertyName);
      }
    });
  }
  return { isValid: missing.length === 0, missing };
}

/**
 * 語音轉文字 (STT) 引擎的內部狀態。
 * 
 * @typedef {Object} STTEngineState
 * @property {MediaStream|null} micStream - 麥克風音訊串流。
 * @property {AudioContext|null} micAudioCtx - 音訊上下文。
 * @property {AnalyserNode|null} micAnalyser - 音訊分析節點。
 * @property {Uint8Array|null} micData - 音訊頻率資料。
 * @property {number} micNoiseFloor - 麥克風底噪位準。
 * @property {number} voiceFrames - 連續偵測到語音的幀數。
 * @property {number} lastBargeIn - 上次插話的時間戳記。
 * @property {number} micRaf - 麥克風音量監控的 requestAnimationFrame ID。
 * @property {SpeechRecognition|null} recognition - Web Speech API 語音辨識實例。
 * @property {boolean} isListening - 目前是否正在聆聽語音。
 * @property {string} locale - 當前語系代碼（例如 'zh-TW', 'en-US'）。
 * @property {number} noSpeechRuns - 連續未偵測到語音的次數。
 * @property {number} lastRestart - 上次重啟辨識的時間戳記。
 * @property {number} speechStartTime - 語音辨識開始的時間戳記。
 * @property {number} interimStartTime - 臨時辨識結果開始的時間戳記。
 * @property {string} spokenDisplayText - 目前由語音模組產生的提示文字。
 * @property {boolean} isAborted - 是否主動中止語音辨識。
 */

/**
 * @typedef {Object} STTEngineOptions
 * @property {(text: string, isFinal: boolean, isInterim: boolean) => void} [onResult] - 當取得辨識結果時的回調函數。
 * @property {(rms: number, showVoiceUI: boolean, stateString: string, levelAmp: number) => void} [onMicLevel] - 當麥克風音量位準更新時的回調函數。
 * @property {() => void} [onBargeIn] - 當偵測到使用者插話時的回調函數。
 * @property {(errorMessage: string, isNotAllowed: boolean) => void} [onError] - 當語音辨識發生錯誤時的回調函數。
 * @property {(isListening: boolean, statusMessage?: string, isAborted?: boolean) => void} [onStatusChange] - 當語音辨識狀態變更時的回調函數。
 * @property {() => void} [onNoSpeechAbort] - 當連續多次未偵測到語音而中止時的回調函數。
 * @property {() => boolean} [getAssistantActive] - 取得助理目前是否處於活動狀態（例如正在說話或處理中）的函數。
 * @property {() => number} [getSpeechDuration] - 取得目前虛擬人說話持續時間的函數。
 * @property {() => boolean} [getConvoOn] - 取得目前連續對話模式是否開啟的函數。
 * @property {string} [locale='zh-TW'] - 初始語系代碼。
 */

/**
 * 預設 STT 引擎的多語系訊息字典。
 */
const DEFAULT_STT_MESSAGES = {
  'zh-TW': {
    unsupported: '你的瀏覽器不支援語音辨識，建議用 Chrome 開喔。',
    requestPermission: '正在取得麥克風權限…',
    micError: '無法啟動語音功能，請檢查麥克風與瀏覽器設定。',
    startFailed: '語音辨識啟動失敗：{error}',
    listening: '請說話，可以隨時插話…',
    permissionDenied: '我需要麥克風權限才能聽你說話喔。',
    noSpeech: '沒聽清楚（{error}），再試一次。',
    sessionEnded: '即時語音對話已結束。',
    bgStop: '頁面進入背景，即時語音已停止。',
    noSpeechAbort: '連續幾次沒有聽到聲音，即時對話已暫停。'
  },
  'en-US': {
    unsupported: 'Your browser does not support speech recognition. Chrome is recommended.',
    requestPermission: 'Requesting microphone permission...',
    micError: 'Unable to start voice service. Please check microphone permissions and browser settings.',
    startFailed: 'Failed to start speech recognition: {error}',
    listening: 'Please speak, you can interrupt anytime...',
    permissionDenied: 'Microphone permission is required to listen.',
    noSpeech: "Didn't catch that ({error}), please try again.",
    sessionEnded: 'Voice session ended.',
    bgStop: 'Page entered background, voice session stopped.',
    noSpeechAbort: 'No speech detected multiple times, voice session paused.'
  },
  'ja-JP': {
    unsupported: 'お使いのブラウザは音声認識に対応していません。Chromeをお勧めします。',
    requestPermission: 'マイクの権限を取得中…',
    micError: '音声機能を開始できません。マイクの許可と設定を確認してください。',
    startFailed: '音声認識の開始に失敗しました：{error}',
    listening: '話しかけてください。いつでも遮って話せます…',
    permissionDenied: 'マイクの権限が必要です。',
    noSpeech: '聞き取れませんでした（{error}）、もう一度お試しください。',
    sessionEnded: '音声対話が終了しました。',
    bgStop: 'バックグラウンドに移動したため、音声対話を停止しました。',
    noSpeechAbort: '音声が検出されなかったため、対話を一時停止しました。'
  },
  'ko-KR': {
    unsupported: '현재 브라우저는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 권장합니다.',
    requestPermission: '마이크 권한 요청 중…',
    micError: '음성 기능을 시작할 수 없습니다. 마이크 권한과 브라우저 설정을 확인해 주세요.',
    startFailed: '음성 인식 시작 실패: {error}',
    listening: '말씀해 주세요. 언제든 중간에 말씀하셔도 됩니다…',
    permissionDenied: '말씀을 듣기 위해 마이크 권한이 필요합니다.',
    noSpeech: '잘 듣지 못했습니다 ({error}), 다시 시도해 주세요.',
    sessionEnded: '실시간 음성 대화가 종료되었습니다.',
    bgStop: '페이지가 백그라운드로 전환되어 음성 대화가 중지되었습니다.',
    noSpeechAbort: '여러 번 음성이 감지되지 않아 실시간 대화가 일시 중지되었습니다.'
  }
};

/**
 * 取得指定語系的 STT 提示訊息。
 *
 * @param {string} locale - 語系代碼。
 * @param {string} key - 訊息鍵值。
 * @param {Object} [params={}] - 替換參數。
 * @returns {string} 格式化後的提示訊息。
 */
export function getSttMessage(locale, key, params = {}) {
  const currentLocale =
    typeof locale === 'string' && locale !== '' ? locale : 'zh-TW';
  const messageDictionary =
    DEFAULT_STT_MESSAGES[currentLocale] || DEFAULT_STT_MESSAGES['zh-TW'] || {};
  let formattedMessage =
    messageDictionary[key] || DEFAULT_STT_MESSAGES['zh-TW']?.[key] || key;
  if (typeof params === 'object' && params !== null) {
    for (const paramKey in params) {
      if (Object.prototype.hasOwnProperty.call(params, paramKey)) {
        formattedMessage = formattedMessage.replace(
          new RegExp(`\\{${paramKey}\\}`, 'g'),
          String(params[paramKey])
        );
      }
    }
  }
  return formattedMessage;
}

/**
 * 語音轉文字 (STT) 引擎實例介面。
 * 
 * @typedef {Object} STTEngine
 * @property {(selector: any, callback?: Function) => () => void} subscribe - 訂閱狀態變更。
 * @property {() => STTEngineState} getState - 取得當前所有內部狀態。
 * @property {(updates: Partial<STTEngineState> | ((state: STTEngineState) => Partial<STTEngineState>)) => void} setState - 覆寫或更新部分狀態。
 * @property {string} locale - 當前語系代碼（例如 'zh-TW', 'en-US'）。
 * @property {(newLocale: string) => void} setLocale - 設定 STT 語系。
 * @property {boolean} isListening - 目前是否正在聆聽語音。
 * @property {() => Promise<void>} startListening - 開始聆聽語音輸入。
 * @property {() => void} stopListening - 停止聆聽語音輸入。
 */

/**
 * 建立並初始化預設的語音轉文字 (STT) 引擎，負責管理麥克風權限、音量分析與瀏覽器內建語音辨識 (Web Speech API)。
 *
 * @param {STTEngineOptions} [options={}] - 初始化設定與回調函數。
 * @returns {STTEngine} 包含狀態管理與操作方法的 STT 引擎實例。
 */
export function initDefaultSTTEngine(options = {}) {
  const {
    onResult, // function(text, isFinal, isInterim)
    onMicLevel, // function(rms, showVoiceUI, stateString, levelAmp)
    onBargeIn, // function()
    onError, // function(errorMessage, isNotAllowed)
    onStatusChange, // function(isListening, statusMessage, isAborted)
    onNoSpeechAbort, // function()
    getAssistantActive, // function() => boolean
    getSpeechDuration, // function() => number
    getConvoOn, // function() => boolean
    locale = 'zh-TW'
  } = options;

  const initialLocale =
    typeof locale === 'string' && locale !== '' ? locale : 'zh-TW';

  const store = createBaseStore({
    micStream: null,
    micAudioCtx: null,
    micAnalyser: null,
    micData: null,
    micNoiseFloor: 0,
    voiceFrames: 0,
    lastBargeIn: 0,
    micRaf: 0,
    recognition: null,
    isListening: false,
    locale: initialLocale,
    noSpeechRuns: 0,
    lastRestart: 0,
    speechStartTime: 0,
    interimStartTime: 0,
    spokenDisplayText: '',
    isAborted: false
  });

  const state = store.getState();

  const monitorMicLevel = () => {
    if (
      typeof state.micAnalyser !== 'object' ||
      state.micAnalyser === null ||
      typeof state.micData !== 'object' ||
      state.micData === null
    ) {
      return;
    }

    state.micAnalyser.getByteFrequencyData(state.micData);

    let sumOfSquares = 0;
    const bufferLength = state.micData.length;
    for (let index = 0; index < bufferLength; index++) {
      const normalizedSample = (state.micData[index] - 128) / 128;
      sumOfSquares += normalizedSample * normalizedSample;
    }
    const rms = Math.sqrt(sumOfSquares / bufferLength);

    state.micNoiseFloor =
      typeof state.micNoiseFloor === 'number' && state.micNoiseFloor > 0
        ? state.micNoiseFloor * 0.995 + rms * 0.005
        : rms;

    const speechThreshold = Math.max(0.06, state.micNoiseFloor * 3.5);
    const isSpeaking = rms > speechThreshold;
    const levelAmp = Math.min(1, rms * 8);

    const convoOn = typeof getConvoOn === 'function' ? getConvoOn() : false;
    const showVoiceUI = convoOn === true || state.isListening === true;

    let stateString = '';
    const isAssistantActive =
      typeof getAssistantActive === 'function' ? getAssistantActive() : false;

    if (isAssistantActive === true) {
      stateString = 'speaking';
    } else if (isSpeaking === true) {
      stateString = 'user-speaking';
    } else if (state.isListening === true) {
      stateString = 'listening';
    }

    if (typeof onMicLevel === 'function') {
      onMicLevel(rms, showVoiceUI, stateString, levelAmp);
    }

    const speechDuration =
      typeof getSpeechDuration === 'function' ? getSpeechDuration() : 0;
    const immuneBargeIn = speechDuration < 1200;

    if (isSpeaking === true && isAssistantActive === true && immuneBargeIn === false) {
      state.voiceFrames = (state.voiceFrames || 0) + 1;
    } else {
      state.voiceFrames = Math.max(0, (state.voiceFrames || 0) - 2);
    }

    if (
      state.voiceFrames >= 9 &&
      performance.now() - state.lastBargeIn > 1400
    ) {
      state.lastBargeIn = performance.now();
      state.voiceFrames = 0;
      if (typeof onBargeIn === 'function') {
        onBargeIn();
      }
    }

    state.micRaf = requestAnimationFrame(monitorMicLevel);
  };

  const ensureMicMonitor = async () => {
    if (typeof state.micStream === 'object' && state.micStream !== null) {
      return;
    }
    if (
      typeof navigator.mediaDevices !== 'object' ||
      navigator.mediaDevices === null ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      throw new Error('media-not-supported');
    }

    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    state.micAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (state.micAudioCtx.state === 'suspended') {
      try {
        await state.micAudioCtx.resume();
      } catch (_resumeError) {}
    }

    state.micAnalyser = state.micAudioCtx.createAnalyser();
    state.micAnalyser.fftSize = 256;
    state.micAnalyser.smoothingTimeConstant = 0.35;
    state.micAudioCtx
      .createMediaStreamSource(state.micStream)
      .connect(state.micAnalyser);
    state.micData = new Uint8Array(state.micAnalyser.fftSize);

    state.micNoiseFloor = 0;
    state.voiceFrames = 0;
    state.lastBargeIn = 0;

    monitorMicLevel();
  };

  const stopMicMonitor = () => {
    if (typeof state.micRaf === 'number' && state.micRaf > 0) {
      cancelAnimationFrame(state.micRaf);
    }
    state.micRaf = 0;

    if (typeof state.micStream === 'object' && state.micStream !== null) {
      state.micStream.getTracks().forEach((audioTrack) => {
        audioTrack.stop();
      });
    }
    state.micStream = null;
    state.micAnalyser = null;
    state.micData = null;

    if (typeof state.micAudioCtx === 'object' && state.micAudioCtx !== null) {
      try {
        state.micAudioCtx.close();
      } catch (_closeError) {}
    }
    state.micAudioCtx = null;
    if (typeof onMicLevel === 'function') {
      const convoOn = typeof getConvoOn === 'function' ? getConvoOn() : false;
      onMicLevel(0, convoOn, '', 0);
    }
  };

  const engine = {
    subscribe: store.subscribe,
    getState: store.getState,
    setState: store.setState,

    get locale() {
      const currentLocale = state.locale || store.getState().locale;
      return typeof currentLocale === 'string' && currentLocale !== ''
        ? currentLocale
        : 'zh-TW';
    },

    setLocale(newLocale) {
      const targetLocale =
        typeof newLocale === 'string' && newLocale !== '' ? newLocale : 'zh-TW';
      state.locale = targetLocale;
      store.setState({ locale: targetLocale });
      if (typeof state.recognition === 'object' && state.recognition !== null) {
        state.recognition.lang = targetLocale;
      }
    },

    get isListening() {
      return state.isListening === true;
    },

    get noSpeechRuns() {
      return typeof state.noSpeechRuns === 'number' ? state.noSpeechRuns : 0;
    },

    set noSpeechRuns(value) {
      state.noSpeechRuns =
        typeof value === 'number' && Number.isFinite(value) === true
          ? value
          : 0;
    },

    async startListening() {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (typeof SpeechRecognition !== 'function') {
        const unsupportedMessage = getSttMessage(engine.locale, 'unsupported');
        if (typeof onError === 'function') {
          onError(unsupportedMessage, false);
        }
        return;
      }

      if (typeof state.recognition === 'object' && state.recognition !== null) {
        try {
          state.recognition.abort();
        } catch (_abortError) {}
        state.recognition = null;
      }

      try {
        if (typeof onStatusChange === 'function') {
          onStatusChange(false, getSttMessage(engine.locale, 'requestPermission'));
        }
        await ensureMicMonitor();
      } catch (_permissionError) {
        const micErrorMessage = getSttMessage(engine.locale, 'micError');
        if (typeof onError === 'function') {
          onError(micErrorMessage, true);
        }
        return;
      }

      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = engine.locale || 'zh-TW';
      recognitionInstance.maxAlternatives = 1;

      recognitionInstance.onstart = () => {
        state.isListening = true;
        store.setState({ isListening: true });
        state.speechStartTime = performance.now();
        state.interimStartTime = 0;
        if (typeof onStatusChange === 'function') {
          onStatusChange(true, getSttMessage(engine.locale, 'listening'));
        }
      };

      recognitionInstance.onend = () => {
        const wasListening = state.isListening;
        state.isListening = false;
        store.setState({ isListening: false });
        if (typeof onStatusChange === 'function') {
          onStatusChange(false, '', state.isAborted);
        }

        const convoOn = typeof getConvoOn === 'function' ? getConvoOn() : false;
        if (convoOn === false && wasListening === true) {
          stopMicMonitor();
        }
      };

      recognitionInstance.onerror = (event) => {
        const recognitionError = event.error;
        if (recognitionError === 'aborted') {
          return;
        }

        if (recognitionError === 'not-allowed') {
          const permissionDeniedMessage = getSttMessage(engine.locale, 'permissionDenied');
          if (typeof onError === 'function') {
            onError(permissionDeniedMessage, true);
          }
          return;
        }

        if (recognitionError === 'no-speech') {
          state.noSpeechRuns =
            (typeof state.noSpeechRuns === 'number' ? state.noSpeechRuns : 0) + 1;
          const convoOn = typeof getConvoOn === 'function' ? getConvoOn() : false;
          if (state.noSpeechRuns >= 4 && convoOn === true) {
            if (typeof onNoSpeechAbort === 'function') {
              onNoSpeechAbort();
            }
            return;
          }
        }

        const noSpeechMessage = getSttMessage(engine.locale, 'noSpeech', {
          error: recognitionError
        });
        if (typeof onError === 'function') {
          onError(noSpeechMessage, false);
        }
      };

      recognitionInstance.onresult = (event) => {
        let recognizedText = '';
        let isFinal = false;

        const resultsLength = event.results.length;
        for (
          let resultIndex = event.resultIndex;
          resultIndex < resultsLength;
          resultIndex++
        ) {
          const speechResult = event.results[resultIndex];
          if (typeof speechResult?.[0]?.transcript === 'string') {
            recognizedText += speechResult[0].transcript;
          }
          if (speechResult.isFinal === true) {
            isFinal = true;
          }
        }

        if (recognizedText.trim() === '') {
          return;
        }

        state.noSpeechRuns = 0;

        if (isFinal === true) {
          state.interimStartTime = 0;
          if (typeof onResult === 'function') {
            onResult(recognizedText, true, false);
          }
          return;
        }

        if (state.interimStartTime === 0) {
          state.interimStartTime = performance.now();
        }

        const elapsed = performance.now() - state.interimStartTime;
        if (elapsed > 2000 && recognizedText.trim().length >= 4) {
          state.interimStartTime = 0;
          try {
            recognitionInstance.stop();
          } catch (_stopError) {}
          if (typeof onResult === 'function') {
            onResult(recognizedText, true, false);
          }
          return;
        }

        if (typeof onResult === 'function') {
          onResult(recognizedText, false, true);
        }
      };

      recognitionInstance.onaudiostart = () => {};
      recognitionInstance.onspeechstart = () => {
        state.noSpeechRuns = 0;
      };
      recognitionInstance.onspeechend = () => {};
      recognitionInstance.onaudioend = () => {};

      state.recognition = recognitionInstance;
      state.isAborted = false;
      store.setState({ isAborted: false });

      try {
        recognitionInstance.start();
      } catch (startError) {
        state.isListening = false;
        store.setState({ isListening: false });
        const startFailedMessage = getSttMessage(engine.locale, 'startFailed', {
          error:
            typeof startError === 'object' &&
            startError !== null &&
            typeof startError.message === 'string'
              ? startError.message
              : String(startError)
        });
        if (typeof onError === 'function') {
          onError(startFailedMessage, false);
        }
      }
    },

    stopListening() {
      state.isAborted = true;
      store.setState({ isAborted: true });
      if (typeof state.recognition === 'object' && state.recognition !== null) {
        try {
          state.recognition.abort();
        } catch (_abortError) {}
        state.recognition = null;
      }
      state.isListening = false;
      store.setState({ isListening: false });
      stopMicMonitor();
    }
  };

  return engine;
}

