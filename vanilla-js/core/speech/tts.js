import { GENDER_MAP } from '../constants';
import { createBaseStore } from '../store';

/**
 * 驗證傳入的語音合成 (TTS) 引擎是否實作了必要的方法與屬性。
 *
 * @param {Object} engine - 欲驗證的 TTS 引擎實例。
 * @returns {{ isValid: boolean, missing: string[] }} 包含驗證結果及缺失的方法或屬性列表。
 */
export function validateTTSEngine(engine) {
  const missing = [];
  if (typeof engine !== 'object' || engine === null) {
    missing.push('engine instance');
  } else {
    ['speak', 'stop', 'computeMouth', 'setGender', 'setLocale'].forEach(
      (method) => {
        if (typeof engine[method] !== 'function') missing.push(`${method}()`);
      }
    );
    ['isSpeaking', 'isMuted'].forEach((prop) => {
      if (!(prop in engine)) missing.push(prop);
    });
  }
  return { isValid: missing.length === 0, missing };
}

/**
 * 根據指定性別載入適用的瀏覽器原生語音 (SpeechSynthesisVoice)。
 * 會優先尋找特定名稱的高品質語音，若無則依序退回尋找符合語言特徵的預設語音。
 *
 * @param {string} gender - 性別標識，參考 GENDER_MAP (例如: 'male', 'female')。
 * @returns {SpeechSynthesisVoice|null} 匹配到的語音物件，如果找不到則回傳 null。
 */
export function loadVoice(gender) {
  const voices = speechSynthesis.getVoices();
  const pick = (targetVoice) =>
    voices.find(
      (voice) =>
        targetVoice.test(`${voice.name} ${voice.lang}`) &&
        !/Google/i.test(voice.name)
    );

  let broswerVoice = null;
  if (gender === GENDER_MAP.male) {
    broswerVoice = pick(
      /(YunJhe|YunJian|YunXia|雲哲|雲健|雲夏|Zhiwei|志偉).*zh/i
    );
  } else if (gender === GENDER_MAP.female) {
    broswerVoice =
      pick(/(HsiaoChen|HsiaoYu|曉臻|曉雨).*zh/i) ||
      pick(/(Yating|Hanhan|雅婷|涵涵).*zh[-_]TW/i);
  }

  return (
    broswerVoice ||
    pick(/Microsoft.*zh[-_]TW/i) ||
    pick(/zh[-_]TW/i) ||
    pick(/^zh/i) ||
    voices.find((voice) => /zh/i.test(voice.lang)) ||
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
  const out = [];
  let buf = '';
  for (const ch of String(text || '')) {
    buf += ch;
    if (/[。！？!?；;\n…]/.test(ch) === true) {
      if (buf.trim() !== '') out.push(buf.trim());
      buf = '';
    } else if (buf.length >= 80) {
      const cut = Math.max(buf.lastIndexOf('，'), buf.lastIndexOf(','));
      if (cut > 20) {
        out.push(buf.slice(0, cut + 1).trim());
        buf = buf.slice(cut + 1);
      } else {
        out.push(buf.trim());
        buf = '';
      }
    }
  }
  if (buf.trim() !== '') out.push(buf.trim());
  const merged = [];
  for (const s of out) {
    if (
      merged.length > 0 &&
      (s.length < 6 || merged[merged.length - 1].length < 6)
    ) {
      merged[merged.length - 1] += s;
    } else {
      merged.push(s);
    }
  }
  while (merged.length > 10) {
    const m2 = [];
    for (let i = 0; i < merged.length; i += 2) {
      m2.push(merged[i] + (merged[i + 1] || ''));
    }
    merged.length = 0;
    merged.push.apply(merged, m2);
  }
  return merged;
}

/**
 * 根據傳入的語系代碼，取得對應的神經網路語音模型名稱 (Neural Voice)。
 *
 * @param {string} locale - 語系代碼 (例如: 'zh-TW', 'en-US')。
 * @returns {string} 預設的神經網路語音模型名稱。
 */
export function localeVoice(locale) {
  return /^en/i.test(locale)
    ? 'en-US-JennyNeural'
    : /^ja/i.test(locale)
      ? 'ja-JP-NanamiNeural'
      : /^ko/i.test(locale)
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
 * @property {function(): void} [onSpeakStart] - 當開始播放語音時的處理函數。
 * @property {function(): void} [onSpeakEnd] - 當播放語音結束時的處理函數。
 * @property {function(string): void} [onSpokenDisplayTextChange] - 當正在播放的文字內容改變時的處理函數。
 */

/**
 * 建立並初始化預設的語音合成 (TTS) 引擎，負責管理神經網路語音 (Web API) 與瀏覽器原生語音的播放與排程。
 * 支援分段載入與嘴型同步計算。
 *
 * @param {TTSEngineOptions} [options={}] - 初始化設定與回調函數。
 * @returns {{
 *   subscribe: Function,
 *   getState: Function,
 *   setState: Function,
 *   isSpeaking: boolean,
 *   isMuted: boolean,
 *   speak: function(string, Object=): void,
 *   stop: function(): void,
 *   computeMouth: function(): number,
 *   setGender: function(string): void,
 *   setLocale: function(string): void,
 *   preloadTapGreeting: function(string): Promise<any>
 * }} 包含狀態管理與播放控制方法的 TTS 引擎實例。
 */
export function initDefaultTTSEngine(options = {}) {
  const {
    ttsEndpoint = '',
    neuralVoice = '',
    gender = GENDER_MAP.female,
    onSpeakStart, // function(text)
    onSpeakEnd, // function()
    onSpokenDisplayTextChange // function(text)
  } = options;

  const store = createBaseStore({
    ttsEndpoint,
    neuralVoice,
    gender,
    locale: 'zh-TW',
    isSpeaking: false,
    isMuted: false,
    speechQ: [],
    speechController: null,
    audioCtx: null,
    audioSource: null,
    audioAnalyser: null,
    audioDataArray: null,
    mouthTimer: null,
    ttVoice: null,
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
    set isMuted(val) {
      store.setState({ isMuted: val });
    },

    speak(text, options = {}) {
      if (this.isMuted === true) {
        if (typeof onSpeakEnd === 'function') onSpeakEnd();
        return;
      }

      const safeText = String(text || '').slice(0, 600);
      if (typeof onSpokenDisplayTextChange === 'function') {
        onSpokenDisplayTextChange(safeText);
      }

      this.stop();
      store.setState({ isSpeaking: true });
      state.speechQ = [];
      state.speechEnded = false;
      state.tapDone = false;
      const sid = ++state.speakSeq;

      for (const sentences of splitSentences(safeText)) {
        if (sentences.trim() === '') continue;
        state.speechQ.push({
          text: sentences.trim(),
          prep: null,
          err: null,
          instant: !!options.instant
        });
        prefetchSpeech(sid);
        pumpSpeech(sid);
      }

      if (sid === state.speakSeq) {
        state.speechEnded = true;
        pumpSpeech(sid);
      }
    },

    stop() {
      state.speakSeq++;
      state.speechQ = [];
      state.speechEnded = true;
      store.setState({ isSpeaking: false });
      try {
        if ('speechSynthesis' in window) speechSynthesis.cancel();
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
          state.currentSource.stop();
        } catch (_error) {}
        state.currentSource = null;
      }
      state.useAudioMouth = false;
      state.audioMouth = 0;
    },

    computeMouth() {
      const state = store.getState();
      if (this.isSpeaking === true && state.useAudioMouth === true) {
        // 降低 smoothing 係數 (0.5 -> 0.25)，讓嘴唇開合更平滑，不會閃爍太快
        state.mouthValue += (state.audioMouth - state.mouthValue) * 0.25;
      } else if (this.isSpeaking === true) {
        const timeNow = performance.now() / 1000;
        state.mouthValue =
          0.12 + 0.83 * state.mouthTarget * Math.abs(Math.sin(timeNow * 9));
      } else {
        state.mouthValue = Math.max(0, state.mouthValue - 0.18);
      }
      return state.mouthValue;
    },

    setGender(newGender) {
      store.setState({ gender: newGender, ttVoice: null });
    },

    setLocale(locale) {
      const matched =
        ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'].find(
          (loc) => loc.toLowerCase() === (locale || '').toLowerCase()
        ) || 'zh-TW';
      store.setState({ 
        locale: matched, 
        neuralVoice: localeVoice(matched),
        ttVoice: loadVoice(store.getState().gender)
      });
    },

    preloadTapGreeting(text) {
      if (state.neuralDisabled === true) return Promise.resolve(null);
      const state = store.getState();
      const key = state.neuralVoice + '\n' + text;
      if (state.tapGreetingPrep != null && state.tapGreetingCacheKey === key) {
        return state.tapGreetingPrep;
      }
      state.tapGreetingCacheKey = key;
      state.tapGreetingBuffer = null;
      state.tapGreetingPrep = fetchTTSBuffer(text, true)
        .then((buffer) => {
          if (state.tapGreetingCacheKey === key)
            state.tapGreetingBuffer = buffer;
          return buffer;
        })
        .catch((error) => {
          if (state.tapGreetingCacheKey === key) {
            state.tapGreetingPrep = null;
            state.tapGreetingBuffer = null;
          }
          throw error;
        });
      return state.tapGreetingPrep;
    }
  };

  const getAudioContext = async () => {
    const state = store.getState();
    const safeAudioContext = window.AudioContext || window.webkitAudioContext;
    if (state.audioCtx instanceof safeAudioContext === false) {
      store.setState({ audioCtx: new safeAudioContext() });
    }
    const curCtx = store.getState().audioCtx;
    if (curCtx.state === 'suspended') {
      try {
        await curCtx.resume();
      } catch (_error) {}
    }
    return curCtx;
  };

  const fetchTTSBuffer = async (text) => {
    const ctx = await getAudioContext();
    const state = store.getState();
    const sep = state.ttsEndpoint.indexOf('?') < 0 ? '?' : '&';
    const response = await fetch(
      state.ttsEndpoint +
        sep +
        'voice=' +
        encodeURIComponent(state.neuralVoice) +
        '&text=' +
        encodeURIComponent(text)
    );
    if (response.ok === false) throw new Error('http ' + response.status);
    const respArrayBuffer = await response.arrayBuffer();
    if (respArrayBuffer.byteLength < 800) throw new Error('audio too small');
    return ctx.decodeAudioData(respArrayBuffer);
  };

  const prefetchSpeech = (sid) => {
    if (sid !== state.speakSeq || state.neuralDisabled === true) return;
    for (const item of state.speechQ.slice(0, 2)) {
      if (item.prep == null && item.err == null) {
        item.prep = fetchTTSBuffer(item.text).catch((error) => {
          item.err = error;
          return null;
        });
      }
    }
  };

  const playBuffer = (audioBuf, done) => {
    const state = store.getState();
    const src = state.audioCtx.createBufferSource();
    src.buffer = audioBuf;
    const analyser = state.audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyser.connect(state.audioCtx.destination);
    const data = new Uint8Array(analyser.fftSize);
    state.currentSource = src;
    state.useAudioMouth = true;
    store.setState({ isSpeaking: true });

    if (state.tapDone !== true) {
      state.tapDone = true;
      if (typeof onSpeakStart === 'function') onSpeakStart();
    }

    function audioLoop() {
      if (state.currentSource !== src) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const normalizedSample = (data[i] - 128) / 128;
        sum += normalizedSample * normalizedSample;
      }
      // 提高音量乘數 (3.4 -> 4.5)，讓嘴巴張得更大
      state.audioMouth = Math.min(1, Math.sqrt(sum / data.length) * 4.5);
      state.currentFps = requestAnimationFrame(audioLoop);
    }
    state.currentFps = requestAnimationFrame(audioLoop);
    src.onended = () => {
      if (state.currentSource !== src) return;
      if (state.currentFps > 0) {
        cancelAnimationFrame(state.currentFps);
        state.currentFps = 0;
      }
      store.setState({ isSpeaking: false });
      state.useAudioMouth = false;
      state.audioMouth = 0;
      state.currentSource = null;
      done();
    };
    src.start(0);
  };

  const handleNeuralFail = (e) => {
      const state = store.getState();
    const msg = e?.message || '';
    if (/http 429/.test(msg) === true) {
      console.warn('TTS 被限流，這句退瀏覽器語音');
      return;
    }
    if (
      /http 4\d\d|Failed to fetch|NetworkError|Load failed/i.test(msg) === true
    ) {
      state.neuralDisabled = true;
    }
    console.warn('神經語音失敗，退回瀏覽器語音：', msg);
  };

  const speakBrowserChunk = (text, sid, done) => {
    if (engine.isMuted === true || 'speechSynthesis' in window === false) {
      done();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const state = store.getState();
    if (state.ttVoice === null) {
      store.setState({ ttVoice: loadVoice(state.gender) });
    }
    const curVoice = store.getState().ttVoice;
    if (curVoice) utterance.voice = curVoice;
    utterance.lang = curVoice?.lang || state.locale;
    utterance.rate = state.ttsRate;
    utterance.pitch = 1.0;
    utterance.onboundary = () => {
      state.mouthTarget = 0.5 + Math.random() * 0.5;
    };
    let fin = false;
    const finish = () => {
      if (fin === true) return;
      fin = true;
      store.setState({ isSpeaking: false });
      done();
    };
    utterance.onend = finish;
    const estMs = Math.min(
      16000,
      Math.max(1200, (text.length * 130) / state.ttsRate)
    );

    const fire = () => {
      if (sid !== state.speakSeq) return;
      try {
        speechSynthesis.resume();
      } catch (_error) {}
      speechSynthesis.speak(utterance);
      store.setState({ isSpeaking: true });
      state.mouthTarget = 0.7;
      if (state.tapDone !== true) {
        state.tapDone = true;
        if (typeof onSpeakStart === 'function') onSpeakStart();
      }
      state.speakBrowserTimer = setTimeout(finish, estMs);
    };
    if (speechSynthesis.speaking === true || speechSynthesis.pending === true) {
      speechSynthesis.cancel();
      setTimeout(fire, 120);
    } else {
      fire();
    }
  };

  const pumpSpeech = async (sid) => {
    if (state.isSpeechPlaying || sid !== state.speakSeq) return;
    const item = state.speechQ.shift();
    if (item === undefined) {
      if (state.speechEnded === true) {
        store.setState({ isSpeaking: false });
        if (typeof onSpeakEnd === 'function') onSpeakEnd();
      }
      return;
    }
    state.isSpeechPlaying = true;
    const done = () => {
      if (sid !== state.speakSeq) return;
      state.isSpeechPlaying = false;
      prefetchSpeech(sid);
      pumpSpeech(sid);
    };

    if (
      item.instant &&
      state.tapGreetingBuffer != null &&
      item.text === state.tapGreetingCacheKey?.split('\n')[1]
    ) {
      engine.preloadTapGreeting(item.text);
      speakBrowserChunk(item.text, sid, done);
      return;
    }

    let buf = null;
    if (state.neuralDisabled !== true && item.err == null) {
      if (item.prep == null) {
        item.prep = fetchTTSBuffer(item.text).catch((error) => {
          item.err = error;
          return null;
        });
      }
      buf = await item.prep;
    }
    if (sid !== state.speakSeq) return;
    if (buf != null) {
      prefetchSpeech(sid);
      playBuffer(buf, done);
    } else {
      if (item.err != null) handleNeuralFail(item.err);
      speakBrowserChunk(item.text, sid, done);
    }
  };

  if ('speechSynthesis' in window === true) {
    speechSynthesis.onvoiceschanged = () => {
      if (state.ttVoice === null) state.ttVoice = loadVoice(state.gender);
    };
    state.ttVoice = loadVoice(state.gender);
  }

  return engine;
}
