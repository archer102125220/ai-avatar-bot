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
    ['startListening', 'stopListening'].forEach((method) => {
      if (typeof engine[method] !== 'function') missing.push(`${method}()`);
    });
    ['isListening'].forEach((prop) => {
      if (!(prop in engine)) missing.push(prop);
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
 * @property {number} micRaf - RequestAnimationFrame 的 ID。
 * @property {Object|null} recognition - Web Speech API 辨識實例 (SpeechRecognition)。
 * @property {number|null} recognitionSilenceTimer - 靜音超時計時器 ID。
 * @property {boolean} isListening - 是否正在聆聽。
 * @property {number} noSpeechRuns - 連續未偵測到語音的次數。
 */

/**
 * 語音轉文字 (STT) 引擎的初始化選項。
 * 
 * @typedef {Object} STTEngineOptions
 * @property {(text: string, isFinal: boolean, isInterim: boolean) => void} [onResult] - 當辨識出文字時的處理函數。
 * @property {(rms: number, showVoiceUI: boolean, stateString: string, levelAmp: number) => void} [onMicLevel] - 麥克風音量監聽回調。
 * @property {() => void} [onBargeIn] - 當使用者插話 (Barge-In) 時的處理函數。
 * @property {(errorMessage: string, isNotAllowed: boolean) => void} [onError] - 發生錯誤時的處理函數。
 * @property {(isListening: boolean, statusMessage?: string, isAborted?: boolean) => void} [onStatusChange] - 狀態變更時的處理函數。
 * @property {() => void} [onNoSpeechAbort] - 連續未接收到聲音導致中止時的處理函數。
 * @property {() => boolean} [getAssistantActive] - 取得助理是否處於活動狀態 (說話或處理中)。
 * @property {() => number} [getSpeechDuration] - 取得目前的發言持續時間 (毫秒)。
 * @property {() => boolean} [getConvoOn] - 取得是否開啟即時對話功能。
 */

/**
 * 預設語音轉文字 (STT) 引擎實例。
 *
 * @typedef {Object} STTEngineInstance
 * @property {(listener: (state: STTEngineState) => void) => (() => void)} subscribe - 訂閱引擎內部狀態變更的函數，回傳取消訂閱的函數。
 * @property {() => STTEngineState} getState - 取得目前引擎內部狀態。
 * @property {(newState: Partial<STTEngineState>) => void} setState - 更新引擎內部狀態。
 * @property {boolean} isListening - 標示目前是否正在聆聽語音。
 * @property {() => Promise<void>} startListening - 啟動語音辨識與麥克風監聽。
 * @property {() => void} stopListening - 停止語音辨識與麥克風監聽。
 */

/**
 * 建立並初始化預設的語音轉文字 (STT) 引擎，負責管理麥克風權限、音量分析與瀏覽器內建語音辨識 (Web Speech API)。
 *
 * @param {STTEngineOptions} [options={}] - 初始化設定與回調函數。
 * @returns {STTEngineInstance} 包含狀態管理與操作方法的 STT 引擎實例。
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
  } = options;

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
    recognitionSilenceTimer: null,
    isListening: false,
    noSpeechRuns: 0,
    locale: options.locale || 'zh-TW'
  });

  const state = store.getState();

  const setMic = (isListening) => {
    state.isListening = isListening;
    store.setState({ isListening });
    if (typeof onStatusChange === 'function') {
      onStatusChange(isListening);
    }
  };

  const monitorMicLevel = () => {
    if (
      typeof state.micAnalyser !== 'object' ||
      state.micAnalyser === null ||
      typeof state.micData !== 'object' ||
      state.micData === null
    ) {
      return;
    }
    state.micAnalyser.getByteTimeDomainData(state.micData);
    let sum = 0;
    for (let i = 0; i < state.micData.length; i++) {
      const value = (state.micData[i] - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / state.micData.length);

    const isListening = state.isListening;
    const convoOn = typeof getConvoOn === 'function' ? getConvoOn() : false;
    const assistantActive = typeof getAssistantActive === 'function' ? getAssistantActive() : false;

    if (!assistantActive && !isListening) {
      state.micNoiseFloor = state.micNoiseFloor * 0.96 + rms * 0.04;
    }

    const showVoiceUI = convoOn || isListening || assistantActive;
    const stateString = isListening ? 'listening' : (assistantActive ? 'speaking' : 'thinking');

    if (typeof onMicLevel === 'function') {
      onMicLevel(rms, showVoiceUI, stateString, rms * 650);
    }

    const threshold = Math.max(0.085, state.micNoiseFloor * 5.5);
    const speechDuration = typeof getSpeechDuration === 'function' ? getSpeechDuration() : 0;

    if (
      convoOn === true &&
      assistantActive === true &&
      speechDuration > 550 &&
      rms > threshold
    ) {
      state.voiceFrames++;
    } else {
      state.voiceFrames = Math.max(0, (state.voiceFrames || 0) - 2);
    }

    if (
      state.voiceFrames >= 9 &&
      performance.now() - state.lastBargeIn > 1400
    ) {
      state.lastBargeIn = performance.now();
      state.voiceFrames = 0;
      if (typeof onBargeIn === 'function') onBargeIn();
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
      } catch (_e) {}
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
      state.micStream.getTracks().forEach((track) => track.stop());
    }
    state.micStream = null;
    state.micAnalyser = null;
    state.micData = null;

    if (typeof state.micAudioCtx === 'object' && state.micAudioCtx !== null) {
      try {
        state.micAudioCtx.close();
      } catch (_e) {}
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

    setLocale(newLocale) {
      state.locale = newLocale;
      store.setState({ locale: newLocale });
    },

    get isListening() {
      return state.isListening;
    },

    async startListening() {
      const SafeSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SafeSpeechRecognition == null) {
        if (typeof onError === 'function') {
          onError('你的瀏覽器不支援語音辨識，建議用 Chrome 開喔。', false);
        }
        return;
      }

      if (this.isListening && state.recognition) {
        state.recognition.stop();
        return;
      }

      if (!state.micStream) {
        setMic(false);
        if (typeof onStatusChange === 'function') {
          onStatusChange(false, '正在取得麥克風權限…');
        }
      }

      try {
        await ensureMicMonitor();
      } catch (e) {
        setMic(false);
        if (typeof onError === 'function') {
          onError('無法啟動語音功能，請檢查麥克風與瀏覽器設定。', false);
        }
        console.warn('mic monitor error', e);
        return;
      }

      try {
        state.recognition = new SafeSpeechRecognition();
      } catch (error) {
        if (typeof onError === 'function') {
          onError('語音辨識啟動失敗：' + error.message, false);
        }
        return;
      }

      state.recognitionSilenceTimer = null;
      state.recognition.lang = state.locale || 'zh-TW';
      state.recognition.interimResults = true;
      state.recognition.continuous = true;
      state.recognition.maxAlternatives = 1;

      state.recognition.onstart = () => {
        setMic(true);
        if (typeof onStatusChange === 'function') {
          onStatusChange(true, '請說話，可以隨時插話…');
        }
      };

      state.recognition.onresult = (event) => {
        let finalText = '', interimText = '';
        for (const result of event.results) {
          if (result.isFinal) {
            finalText += result[0].transcript + ' ';
          } else {
            interimText += result[0].transcript + ' ';
          }
        }
        const txt = (finalText + interimText).trim();
        if (txt === '') return;

        state.noSpeechRuns = 0;
        if (typeof onResult === 'function') {
          const last = event.results[event.results.length - 1];
          onResult(txt, last.isFinal, interimText !== '');
        }

        clearTimeout(state.recognitionSilenceTimer);
        state.recognitionSilenceTimer = setTimeout(() => {
          try {
            if (state.recognition) state.recognition.stop();
          } catch (_error) {}
        }, interimText !== '' ? 900 : 420);
      };

      state.recognition.onerror = (event) => {
        setMic(false);
        if (event.error === 'not-allowed') {
          stopMicMonitor();
          if (typeof onError === 'function') {
            onError('我需要麥克風權限才能聽你說話喔。', true);
          }
          return;
        }
        if (event.error === 'aborted') {
          if (typeof onStatusChange === 'function') {
             onStatusChange(false, '', true);
          }
          return;
        }
        const convoOn = typeof getConvoOn === 'function' ? getConvoOn() : false;
        if (convoOn && event.error === 'no-speech') {
          return; // handled in onend
        }
        if (typeof onError === 'function') {
          onError('沒聽清楚（' + event.error + '），再試一次。', false);
        }
      };

      state.recognition.onend = () => {
        setMic(false);
        const convoOn = typeof getConvoOn === 'function' ? getConvoOn() : false;
        const assistantActive = typeof getAssistantActive === 'function' ? getAssistantActive() : false;
        
        if (convoOn && !assistantActive) {
          if (++state.noSpeechRuns >= 3) {
            if (typeof onNoSpeechAbort === 'function') onNoSpeechAbort();
            return;
          }
          setTimeout(() => {
            const currentConvo = typeof getConvoOn === 'function' ? getConvoOn() : false;
            const currentActive = typeof getAssistantActive === 'function' ? getAssistantActive() : false;
            if (currentConvo && !this.isListening && !currentActive) {
              this.startListening();
            }
          }, 350);
        }
      };

      try {
        state.recognition.start();
      } catch (_error) {}
    },

    stopListening() {
      clearTimeout(state.recognitionSilenceTimer);
      try {
        if (typeof state.recognition?.abort === 'function') {
          state.recognition.abort();
        }
      } catch (_error) {}
      state.recognition = null;
      setMic(false);
      stopMicMonitor();
    }
  };

  return engine;
}
