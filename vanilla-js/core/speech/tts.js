import { GENDER_MAP } from '../constants';
import { createBaseStore } from '../store';

/**
 * 語音播放選項。
 *
 * @typedef {Object} TTSSpeakOptions
 * @property {boolean} [instant=false] - 是否立即播放，忽略常規排程。
 * @property {boolean} [updateDisplay=true] - 是否同步更新字幕文字。
 */

/**
 * 語音合成 (TTS) 引擎內部狀態定義。
 *
 * @typedef {Object} TTSEngineState
 * @property {string} ttsEndpoint - 神經網路語音合成 API 的端點網址。
 * @property {string} neuralVoice - 欲使用的神經網路語音模型名稱。
 * @property {string} gender - 語音性別。
 * @property {string} locale - 語系代碼。
 * @property {boolean} isSpeaking - 是否正在播放語音。
 * @property {boolean} isMuted - 是否處於靜音狀態。
 * @property {Array<{text: string, prefetchPromise: Promise<AudioBuffer|null>|null, error: Error|null, instant: boolean}>} speechQueue - 語音播放佇列。
 * @property {SpeechSynthesisVoice|null} browserVoice - 瀏覽器原生語音物件。
 * @property {number} speakSeq - 語音播放序號。
 * @property {number} ttsRate - 語音播放速率。
 * @property {number} mouthTarget - 嘴型開合目標值。
 * @property {number} mouthValue - 當前平滑後的嘴型開合數值 (0~1)。
 * @property {number} audioMouth - 音訊即時能量對應的嘴型開合數值。
 * @property {boolean} useAudioMouth - 是否使用即時音訊能量計算嘴型。
 */

/**
 * 語音合成 (TTS) 引擎的介面定義。
 *
 * @typedef {Object} TTSEngine
 * @property {(selector: any, callback?: Function) => () => void} subscribe - 訂閱狀態變更的函數。
 * @property {() => TTSEngineState} getState - 取得當前狀態的函數。
 * @property {(updates: Partial<TTSEngineState> | ((state: TTSEngineState) => Partial<TTSEngineState>)) => void} setState - 設定狀態的函數。
 * @property {boolean} isSpeaking - 指示引擎是否正在播放語音。
 * @property {boolean} isMuted - 指示引擎是否處於靜音狀態。
 * @property {string} locale - 當前語系代碼 (例如: 'zh-TW', 'en-US')。
 * @property {(text: string, options?: TTSSpeakOptions) => void} speak - 播放指定的文本語音。
 * @property {() => void} stop - 停止當前正在播放的語音。
 * @property {() => number} computeMouth - 計算並回傳當前的嘴型開合數值 (0~1)。
 * @property {(newGender: string) => void} setGender - 設定語音的性別 (例如: 'male', 'female')。
 * @property {(locale: string) => void} setLocale - 設定語音的語系代碼 (例如: 'zh-TW', 'en-US')。
 * @property {(text: string) => Promise<AudioBuffer|null>} preloadTapGreeting - 預先載入指定的歡迎詞語音。
 */

/**
 * 驗證結果物件。
 *
 * @typedef {Object} TTSEngineValidationResult
 * @property {boolean} isValid - 是否為有效的 TTS 引擎。
 * @property {string[]} missing - 缺失的方法或屬性列表。
 */

/**
 * 驗證傳入的語音合成 (TTS) 引擎是否實作了必要的方法與屬性。
 *
 * @param {TTSEngine|Object|null|undefined} engine - 欲驗證的 TTS 引擎實例。
 * @returns {TTSEngineValidationResult} 包含驗證結果及缺失的方法或屬性列表。
 */
export function validateTTSEngine(engine) {
  const missing = [];
  if (typeof engine !== 'object' || engine === null) {
    missing.push('engine instance');
  } else {
    ['speak', 'stop', 'computeMouth', 'setGender', 'setLocale'].forEach(
      (methodName) => {
        if (typeof engine[methodName] !== 'function') {
          missing.push(`${methodName}()`);
        }
      }
    );
    ['isSpeaking', 'isMuted'].forEach((propertyName) => {
      if (!(propertyName in engine)) {
        missing.push(propertyName);
      }
    });
  }
  return { isValid: missing.length === 0, missing };
}

/**
 * 根據指定性別與語系載入適用的瀏覽器原生語音 (SpeechSynthesisVoice)。
 * 會優先尋找特定名稱的高品質語音，若無則依序退回尋找符合語言特徵的預設語音。
 *
 * @param {string} gender - 性別標識，參考 GENDER_MAP (例如: 'male', 'female')。
 * @param {string} [locale='zh-TW'] - 語系代碼 (例如: 'zh-TW', 'en-US', 'ja-JP', 'ko-KR')。
 * @returns {SpeechSynthesisVoice|null} 匹配到的語音物件，如果找不到則回傳 null。
 */
export function loadVoice(gender, locale = 'zh-TW') {
  if (
    typeof speechSynthesis !== 'object' ||
    speechSynthesis === null ||
    typeof speechSynthesis.getVoices !== 'function'
  ) {
    return null;
  }
  const voices = speechSynthesis.getVoices();
  const findMatchingVoice = (voicePattern) =>
    voices.find(
      (voice) =>
        voicePattern.test(`${voice.name} ${voice.lang}`) === true &&
        !/Google/i.test(voice.name)
    );

  const normalizedLocale =
    typeof locale === 'string' && locale !== ''
      ? locale.toLowerCase()
      : 'zh-tw';
  let matchedVoice = null;

  if (normalizedLocale.startsWith('en') === true) {
    if (gender === GENDER_MAP.male) {
      matchedVoice = findMatchingVoice(/(Guy|Christopher|Eric|Davis).*en/i);
    } else if (gender === GENDER_MAP.female) {
      matchedVoice = findMatchingVoice(/(Jenny|Aria|Sara|Zira).*en/i);
    }
    return (
      matchedVoice ||
      findMatchingVoice(/Microsoft.*en/i) ||
      findMatchingVoice(/en[-_]US/i) ||
      findMatchingVoice(/^en/i) ||
      voices.find((voice) => /en/i.test(voice.lang) === true) ||
      null
    );
  }

  if (normalizedLocale.startsWith('ja') === true) {
    if (gender === GENDER_MAP.male) {
      matchedVoice = findMatchingVoice(/(Keita|Daichi|Ichiro).*ja/i);
    } else if (gender === GENDER_MAP.female) {
      matchedVoice = findMatchingVoice(/(Nanami|Ayumi|Haruka).*ja/i);
    }
    return (
      matchedVoice ||
      findMatchingVoice(/Microsoft.*ja/i) ||
      findMatchingVoice(/ja[-_]JP/i) ||
      findMatchingVoice(/^ja/i) ||
      voices.find((voice) => /ja/i.test(voice.lang) === true) ||
      null
    );
  }

  if (normalizedLocale.startsWith('ko') === true) {
    if (gender === GENDER_MAP.male) {
      matchedVoice = findMatchingVoice(/(InJoon|GookMin).*ko/i);
    } else if (gender === GENDER_MAP.female) {
      matchedVoice = findMatchingVoice(/(SunHi|Heami).*ko/i);
    }
    return (
      matchedVoice ||
      findMatchingVoice(/Microsoft.*ko/i) ||
      findMatchingVoice(/ko[-_]KR/i) ||
      findMatchingVoice(/^ko/i) ||
      voices.find((voice) => /ko/i.test(voice.lang) === true) ||
      null
    );
  }

  if (gender === GENDER_MAP.male) {
    matchedVoice = findMatchingVoice(
      /(YunJhe|YunJian|YunXia|雲哲|雲健|雲夏|Zhiwei|志偉).*zh/i
    );
  } else if (gender === GENDER_MAP.female) {
    matchedVoice =
      findMatchingVoice(/(HsiaoChen|HsiaoYu|曉臻|曉雨).*zh/i) ||
      findMatchingVoice(/(Yating|Hanhan|雅婷|涵涵).*zh[-_]TW/i);
  }

  return (
    matchedVoice ||
    findMatchingVoice(/Microsoft.*zh[-_]TW/i) ||
    findMatchingVoice(/zh[-_]TW/i) ||
    findMatchingVoice(/^zh/i) ||
    voices.find((voice) => /zh/i.test(voice.lang) === true) ||
    null
  );
}

/**
 * 將長篇文本切割成適合語音合成播放的短句陣列。
 * 會根據標點符號與長度限制進行智慧斷句，並嘗試合併過短的片段。
 *
 * @param {string} text - 欲切割的完整文本。
 * @returns {string[]} 切割後的短句陣列。
 */
export function splitSentences(text) {
  const sentenceList = [];
  let currentBuffer = '';
  const rawText = typeof text === 'string' ? text : '';

  for (const character of rawText) {
    currentBuffer += character;
    if (/[。！？!?；;\n…]/.test(character) === true) {
      if (currentBuffer.trim() !== '') {
        sentenceList.push(currentBuffer.trim());
      }
      currentBuffer = '';
    } else if (currentBuffer.length >= 80) {
      const splitIndex = Math.max(
        currentBuffer.lastIndexOf('，'),
        currentBuffer.lastIndexOf(',')
      );
      if (splitIndex > 20) {
        sentenceList.push(currentBuffer.slice(0, splitIndex + 1).trim());
        currentBuffer = currentBuffer.slice(splitIndex + 1);
      } else {
        sentenceList.push(currentBuffer.trim());
        currentBuffer = '';
      }
    }
  }

  if (currentBuffer.trim() !== '') {
    sentenceList.push(currentBuffer.trim());
  }

  const mergedSentences = [];
  for (const sentence of sentenceList) {
    if (
      mergedSentences.length > 0 &&
      (sentence.length < 3 ||
        mergedSentences[mergedSentences.length - 1].length < 3)
    ) {
      mergedSentences[mergedSentences.length - 1] += sentence;
    } else {
      mergedSentences.push(sentence);
    }
  }

  while (mergedSentences.length > 10) {
    const combinedSentences = [];
    for (let index = 0; index < mergedSentences.length; index += 2) {
      const nextSentence =
        typeof mergedSentences[index + 1] === 'string'
          ? mergedSentences[index + 1]
          : '';
      combinedSentences.push(mergedSentences[index] + nextSentence);
    }
    mergedSentences.length = 0;
    mergedSentences.push(...combinedSentences);
  }

  return mergedSentences;
}

/**
 * 根據傳入的語系代碼，取得對應的神經網路語音模型名稱 (Neural Voice)。
 *
 * @param {string} locale - 語系代碼 (例如: 'zh-TW', 'en-US')。
 * @returns {string} 預設的神經網路語音模型名稱。
 */
export function localeVoice(locale) {
  const normalizedLocale = typeof locale === 'string' ? locale : '';
  return /^en/i.test(normalizedLocale) === true
    ? 'en-US-JennyNeural'
    : /^ja/i.test(normalizedLocale) === true
      ? 'ja-JP-NanamiNeural'
      : /^ko/i.test(normalizedLocale) === true
        ? 'ko-KR-SunHiNeural'
        : 'zh-TW-HsiaoChenNeural';
}

/**
 * 語音合成 (TTS) 引擎的初始化選項。
 *
 * @typedef {Object} TTSEngineOptions
 * @property {string} [ttsEndpoint=''] - 神經網路語音合成 API 的端點網址。
 * @property {string} [neuralVoice=''] - 欲使用的神經網路語音模型名稱。
 * @property {string} [gender=GENDER_MAP.female] - 預設性別。
 * @property {string} [locale='zh-TW'] - 預設語系代碼。
 * @property {() => void} [onSpeakStart] - 當開始播放語音時的處理函數。
 * @property {() => void} [onSpeakEnd] - 當播放語音結束時的處理函數。
 * @property {(speechSequenceId?: number) => void} [onSpeechWait] - 當語音佇列暫時排空但串流尚未結束（等待後續 LLM 生成片段）時的處理函數。
 * @property {(text: string) => void} [onSpokenDisplayTextChange] - 當正在播放的文字內容改變時的處理函數。
 */

/**
 * 建立並初始化預設的語音合成 (TTS) 引擎，負責管理神經網路語音 (Web API) 與瀏覽器原生語音的播放與排程。
 * 支援分段載入與嘴型同步計算。
 *
 * @param {TTSEngineOptions} [options={}] - 初始化設定與回調函數。
 * @returns {TTSEngine} 包含狀態管理與播放控制方法的 TTS 引擎實例。
 */
export function initDefaultTTSEngine(options = {}) {
  const {
    ttsEndpoint = '',
    neuralVoice = '',
    gender = GENDER_MAP.female,
    locale = 'zh-TW',
    onSpeakStart,
    onSpeakEnd,
    onSpeechWait,
    onSpokenDisplayTextChange
  } = options;

  const store = createBaseStore({
    ttsEndpoint,
    neuralVoice,
    gender,
    locale,
    isSpeaking: false,
    isMuted: false,
    speechQueue: [],
    speechController: null,
    audioCtx: null,
    audioSource: null,
    audioAnalyser: null,
    audioDataArray: null,
    mouthTimer: null,
    browserVoice: null,
    speakSeq: 0,
    isSpeechPlaying: false,
    speechEnded: false,
    tapDone: false,
    speakBrowserTimer: 0,
    currentFps: 0,
    currentSource: null,
    neuralDisabled: false,
    tapGreetingCacheKey: null,
    tapGreetingPrep: null,
    tapGreetingBuffer: null,
    ttsRate: 1.0,
    mouthTarget: 0.7,
    mouthValue: 0,
    audioMouth: 0,
    useAudioMouth: false
  });

  const state = store.getState();
  const activeTTSAbortControllers = new Set();

  const engine = {
    subscribe: store.subscribe,
    getState: store.getState,
    setState: store.setState,

    get isSpeaking() {
      return store.getState().isSpeaking;
    },
    get isMuted() {
      return store.getState().isMuted;
    },
    set isMuted(value) {
      store.setState({ isMuted: value });
    },

    get ttsRate() {
      return store.getState().ttsRate;
    },
    set ttsRate(newRate) {
      store.setState({
        ttsRate:
          typeof newRate === 'number' &&
          Number.isFinite(newRate) === true &&
          newRate > 0
            ? newRate
            : 1.0
      });
    },

    beginSpeech() {
      engine.stop();
      state.speechQueue = [];
      state.speechEnded = false;
      state.tapDone = false;
      state.isSpeechPlaying = false;
      state.useAudioMouth = false;
      state.audioMouth = 0;
      state.speakSeq += 1;
      return state.speakSeq;
    },

    pushSpeech(speechSequenceId, text, options = {}) {
      if (speechSequenceId !== state.speakSeq || this.isMuted === true) {
        return;
      }
      const safeText = typeof text === 'string' ? text.trim() : '';
      if (safeText === '') {
        return;
      }
      state.speechQueue.push({
        text: safeText,
        prefetchPromise: null,
        error: null,
        instant: Boolean(options.instant)
      });
      prefetchSpeech(speechSequenceId);
      processSpeechQueue(speechSequenceId);
    },

    endSpeech(speechSequenceId) {
      if (speechSequenceId !== state.speakSeq) {
        return;
      }
      state.speechEnded = true;
      processSpeechQueue(speechSequenceId);
    },

    speak(text, options = {}) {
      if (this.isMuted === true) {
        if (typeof onSpeakEnd === 'function') {
          onSpeakEnd();
        }
        return;
      }

      const safeText = (typeof text === 'string' ? text : '').slice(0, 600);
      if (
        options.updateDisplay !== false &&
        typeof onSpokenDisplayTextChange === 'function'
      ) {
        onSpokenDisplayTextChange(safeText);
      }

      const speechSequenceId = this.beginSpeech();
      for (const sentence of splitSentences(safeText)) {
        if (sentence.trim() === '') {
          continue;
        }
        this.pushSpeech(speechSequenceId, sentence.trim(), options);
      }
      this.endSpeech(speechSequenceId);
    },

    stop() {
      state.speakSeq += 1;
      state.speechQueue = [];
      state.speechEnded = true;
      state.isSpeechPlaying = false;
      store.setState({ isSpeaking: false });
      for (const abortController of activeTTSAbortControllers) {
        try {
          abortController.abort();
        } catch (_error) {}
      }
      activeTTSAbortControllers.clear();
      try {
        if (
          typeof window === 'object' &&
          window !== null &&
          'speechSynthesis' in window
        ) {
          speechSynthesis.cancel();
        }
      } catch (_error) {}
      try {
        clearTimeout(state.speakBrowserTimer);
      } catch (_error) {}
      if (state.currentFps > 0) {
        cancelAnimationFrame(state.currentFps);
        state.currentFps = 0;
      }
      if (state.currentSource !== null) {
        try {
          state.currentSource.onended = null;
          state.currentSource.disconnect();
          state.currentSource.stop();
        } catch (_error) {}
        state.currentSource = null;
      }
      state.useAudioMouth = false;
      state.audioMouth = 0;
      state.mouthValue = 0;
    },

    computeMouth() {
      const currentState = store.getState();
      if (this.isSpeaking === true && currentState.useAudioMouth === true) {
        // 平滑開合響應：適度降低響應係數，使嘴型隨音節自然過渡，避免高頻震顫
        const smoothingFactor =
          currentState.audioMouth > currentState.mouthValue ? 0.42 : 0.22;
        currentState.mouthValue +=
          (currentState.audioMouth - currentState.mouthValue) * smoothingFactor;
      } else if (this.isSpeaking === true) {
        // 瀏覽器語音 / 備份模式：降頻至自然說話節奏 (約 1.6 次/秒)，以平滑 lerp 計算開合
        const currentTimeInSeconds = performance.now() / 1000;
        const targetMouth =
          0.06 +
          0.68 *
            currentState.mouthTarget *
            Math.pow(Math.sin(currentTimeInSeconds * 5.2), 2);
        currentState.mouthValue +=
          (targetMouth - currentState.mouthValue) * 0.32;
      } else {
        // 停止說話時平滑淡出閉嘴
        currentState.mouthValue = Math.max(0, currentState.mouthValue - 0.12);
      }
      return currentState.mouthValue;
    },

    setGender(newGender) {
      store.setState({
        gender: newGender,
        browserVoice: loadVoice(newGender, store.getState().locale)
      });
    },

    get locale() {
      const currentLocale = store.getState().locale;
      return typeof currentLocale === 'string' && currentLocale !== ''
        ? currentLocale
        : 'zh-TW';
    },

    setLocale(locale) {
      const targetLocale = typeof locale === 'string' ? locale : '';
      const matchedLocale =
        ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'].find(
          (supportedLocale) =>
            supportedLocale.toLowerCase() === targetLocale.toLowerCase()
        ) || 'zh-TW';
      store.setState({
        locale: matchedLocale,
        neuralVoice: localeVoice(matchedLocale),
        browserVoice: loadVoice(store.getState().gender, matchedLocale)
      });
    },

    preloadTapGreeting(text) {
      if (state.neuralDisabled === true) {
        return Promise.resolve(null);
      }
      const currentState = store.getState();
      const cacheKey = currentState.neuralVoice + '\n' + text;
      if (
        currentState.tapGreetingPrep !== null &&
        currentState.tapGreetingPrep !== undefined &&
        currentState.tapGreetingCacheKey === cacheKey
      ) {
        return currentState.tapGreetingPrep;
      }
      currentState.tapGreetingCacheKey = cacheKey;
      currentState.tapGreetingBuffer = null;
      currentState.tapGreetingPrep = fetchTTSBuffer(text, true)
        .then((audioBuffer) => {
          if (currentState.tapGreetingCacheKey === cacheKey) {
            currentState.tapGreetingBuffer = audioBuffer;
          }
          return audioBuffer;
        })
        .catch((error) => {
          if (currentState.tapGreetingCacheKey === cacheKey) {
            currentState.tapGreetingPrep = null;
            currentState.tapGreetingBuffer = null;
          }
          throw error;
        });
      return currentState.tapGreetingPrep;
    }
  };

  const getAudioContext = async () => {
    const currentState = store.getState();
    const AudioContextClass =
      typeof window === 'object' && window !== null
        ? window.AudioContext || window.webkitAudioContext
        : null;
    if (
      typeof AudioContextClass === 'function' &&
      currentState.audioCtx instanceof AudioContextClass === false
    ) {
      store.setState({ audioCtx: new AudioContextClass() });
    }
    const currentAudioContext = store.getState().audioCtx;
    if (
      currentAudioContext !== null &&
      typeof currentAudioContext === 'object' &&
      currentAudioContext.state === 'suspended'
    ) {
      try {
        await currentAudioContext.resume();
      } catch (_error) {}
    }
    return currentAudioContext;
  };

  const fetchTTSBuffer = async (text, isPersistent = false) => {
    const audioContext = await getAudioContext();
    const currentState = store.getState();
    const abortController = new AbortController();
    if (isPersistent !== true) {
      activeTTSAbortControllers.add(abortController);
    }
    const querySeparator =
      currentState.ttsEndpoint.indexOf('?') < 0 ? '?' : '&';
    try {
      const response = await fetch(
        currentState.ttsEndpoint +
          querySeparator +
          'voice=' +
          encodeURIComponent(currentState.neuralVoice) +
          '&text=' +
          encodeURIComponent(text),
        { signal: abortController.signal }
      );
      if (response.ok === false) {
        throw new Error('http ' + response.status);
      }
      const responseArrayBuffer = await response.arrayBuffer();
      if (responseArrayBuffer.byteLength < 800) {
        throw new Error('audio too small');
      }
      return await audioContext.decodeAudioData(responseArrayBuffer);
    } finally {
      if (isPersistent !== true) {
        activeTTSAbortControllers.delete(abortController);
      }
    }
  };

  const prefetchSpeech = (speechSequenceId) => {
    if (speechSequenceId !== state.speakSeq || state.neuralDisabled === true) {
      return;
    }
    for (const queueItem of state.speechQueue.slice(0, 2)) {
      if (
        queueItem.prefetchPromise === null &&
        queueItem.error === null
      ) {
        queueItem.prefetchPromise = fetchTTSBuffer(queueItem.text).catch(
          (error) => {
            queueItem.error = error;
            return null;
          }
        );
      }
    }
  };

  const playBuffer = (audioBuffer, onPlayCompleted) => {
    const currentState = store.getState();
    const bufferSourceNode = currentState.audioCtx.createBufferSource();
    bufferSourceNode.buffer = audioBuffer;
    if (typeof currentState.ttsRate === 'number' && currentState.ttsRate > 0) {
      bufferSourceNode.playbackRate.value = currentState.ttsRate;
    }
    const analyserNode = currentState.audioCtx.createAnalyser();
    analyserNode.fftSize = 128;
    analyserNode.smoothingTimeConstant = 0;
    bufferSourceNode.connect(analyserNode);
    analyserNode.connect(currentState.audioCtx.destination);
    const timeDomainData = new Uint8Array(analyserNode.fftSize);
    currentState.currentSource = bufferSourceNode;
    currentState.useAudioMouth = true;
    store.setState({ isSpeaking: true });
    currentState.audioMouth = 0.12;
    currentState.mouthValue = Math.max(currentState.mouthValue, 0.12);

    if (currentState.tapDone !== true) {
      currentState.tapDone = true;
      if (typeof onSpeakStart === 'function') {
        onSpeakStart();
      }
    }

    function runAudioVisualizationLoop() {
      if (currentState.currentSource !== bufferSourceNode) {
        return;
      }
      analyserNode.getByteTimeDomainData(timeDomainData);
      let sumOfSquares = 0;
      for (
        let sampleIndex = 0;
        sampleIndex < timeDomainData.length;
        sampleIndex += 1
      ) {
        const normalizedSample = (timeDomainData[sampleIndex] - 128) / 128;
        sumOfSquares += normalizedSample * normalizedSample;
      }
      const rootMeanSquare = Math.sqrt(sumOfSquares / timeDomainData.length);
      currentState.audioMouth = Math.min(
        1,
        Math.max(0, (rootMeanSquare - 0.006) * 5.2)
      );
      currentState.currentFps = requestAnimationFrame(
        runAudioVisualizationLoop
      );
    }
    currentState.currentFps = requestAnimationFrame(runAudioVisualizationLoop);
    bufferSourceNode.onended = () => {
      if (currentState.currentSource !== bufferSourceNode) {
        return;
      }
      if (currentState.currentFps > 0) {
        cancelAnimationFrame(currentState.currentFps);
        currentState.currentFps = 0;
      }
      store.setState({ isSpeaking: false });
      currentState.useAudioMouth = false;
      currentState.audioMouth = 0;
      currentState.currentSource = null;
      if (typeof onPlayCompleted === 'function') {
        onPlayCompleted();
      }
    };
    bufferSourceNode.start(0);
  };

  const handleNeuralVoiceError = (error) => {
    const currentState = store.getState();
    const errorMessage =
      typeof error === 'object' && error !== null && typeof error.message === 'string'
        ? error.message
        : '';
    if (/http 429/.test(errorMessage) === true) {
      console.warn('TTS 被限流，這句退瀏覽器語音');
      return;
    }
    if (
      /http 4\d\d|Failed to fetch|NetworkError|Load failed/i.test(
        errorMessage
      ) === true
    ) {
      currentState.neuralDisabled = true;
    }
    console.warn('神經語音失敗，退回瀏覽器語音：', errorMessage);
  };

  const speakBrowserChunk = (text, speechSequenceId, onChunkCompleted) => {
    if (
      engine.isMuted === true ||
      (typeof window === 'object' &&
        window !== null &&
        'speechSynthesis' in window === false)
    ) {
      if (typeof onChunkCompleted === 'function') {
        onChunkCompleted();
      }
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const currentState = store.getState();
    if (currentState.browserVoice === null) {
      store.setState({ browserVoice: loadVoice(currentState.gender) });
    }
    const currentVoice = store.getState().browserVoice;
    if (currentVoice !== null) {
      utterance.voice = currentVoice;
    }
    utterance.lang = currentVoice?.lang || currentState.locale;
    utterance.rate =
      typeof currentState.ttsRate === 'number' && currentState.ttsRate > 0
        ? currentState.ttsRate
        : 1.0;
    utterance.pitch = 1.0;
    utterance.onboundary = () => {
      currentState.mouthTarget = 0.5 + Math.random() * 0.5;
    };
    let isFinished = false;
    const handleFinish = () => {
      if (isFinished === true) {
        return;
      }
      isFinished = true;
      store.setState({ isSpeaking: false });
      if (typeof onChunkCompleted === 'function') {
        onChunkCompleted();
      }
    };
    utterance.onend = handleFinish;
    const effectiveRate =
      typeof currentState.ttsRate === 'number' && currentState.ttsRate > 0
        ? currentState.ttsRate
        : 1.0;
    const estimatedDurationMs = Math.min(
      16000,
      Math.max(1200, (text.length * 130) / effectiveRate)
    );

    const playUtterance = () => {
      if (speechSequenceId !== state.speakSeq) {
        return;
      }
      try {
        speechSynthesis.resume();
      } catch (_error) {}
      speechSynthesis.speak(utterance);
      store.setState({ isSpeaking: true });
      currentState.mouthTarget = 0.7;
      if (currentState.tapDone !== true) {
        currentState.tapDone = true;
        if (typeof onSpeakStart === 'function') {
          onSpeakStart();
        }
      }
      currentState.speakBrowserTimer = setTimeout(
        handleFinish,
        estimatedDurationMs
      );
    };
    if (
      speechSynthesis.speaking === true ||
      speechSynthesis.pending === true
    ) {
      speechSynthesis.cancel();
      setTimeout(playUtterance, 120);
    } else {
      playUtterance();
    }
  };

  const processSpeechQueue = async (speechSequenceId) => {
    if (
      state.isSpeechPlaying === true ||
      speechSequenceId !== state.speakSeq
    ) {
      return;
    }
    const speechItem = state.speechQueue.shift();
    if (speechItem === undefined) {
      if (state.speechEnded === true) {
        store.setState({ isSpeaking: false });
        if (typeof onSpeakEnd === 'function') {
          onSpeakEnd();
        }
      } else {
        store.setState({ isSpeaking: false });
        if (typeof onSpeechWait === 'function') {
          onSpeechWait(speechSequenceId);
        }
      }
      return;
    }
    state.isSpeechPlaying = true;
    const handleChunkDone = () => {
      if (speechSequenceId !== state.speakSeq) {
        return;
      }
      state.isSpeechPlaying = false;
      prefetchSpeech(speechSequenceId);
      processSpeechQueue(speechSequenceId);
    };

    const cachedGreetingKey =
      typeof state.tapGreetingCacheKey === 'string'
        ? state.tapGreetingCacheKey.split('\n')[1]
        : undefined;
    if (
      speechItem.instant === true &&
      state.tapGreetingBuffer !== null &&
      speechItem.text === cachedGreetingKey
    ) {
      engine.preloadTapGreeting(speechItem.text);
      speakBrowserChunk(speechItem.text, speechSequenceId, handleChunkDone);
      return;
    }

    let audioBuffer = null;
    if (state.neuralDisabled !== true && speechItem.error === null) {
      if (speechItem.prefetchPromise === null) {
        speechItem.prefetchPromise = fetchTTSBuffer(speechItem.text).catch(
          (error) => {
            speechItem.error = error;
            return null;
          }
        );
      }
      audioBuffer = await speechItem.prefetchPromise;
    }
    if (speechSequenceId !== state.speakSeq) {
      return;
    }
    if (audioBuffer !== null) {
      prefetchSpeech(speechSequenceId);
      playBuffer(audioBuffer, handleChunkDone);
    } else {
      if (speechItem.error !== null) {
        handleNeuralVoiceError(speechItem.error);
      }
      speakBrowserChunk(speechItem.text, speechSequenceId, handleChunkDone);
    }
  };

  if (
    typeof window === 'object' &&
    window !== null &&
    'speechSynthesis' in window === true
  ) {
    speechSynthesis.onvoiceschanged = () => {
      if (state.browserVoice === null) {
        state.browserVoice = loadVoice(state.gender);
      }
    };
    state.browserVoice = loadVoice(state.gender);
  }

  return engine;
}
