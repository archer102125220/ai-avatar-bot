import { GENDER_MAP } from '../constants';
import { createBaseStore } from '../store';

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

export function localeVoice(locale) {
  return /^en/i.test(locale)
    ? 'en-US-JennyNeural'
    : /^ja/i.test(locale)
      ? 'ja-JP-NanamiNeural'
      : /^ko/i.test(locale)
        ? 'ko-KR-SunHiNeural'
        : 'zh-TW-HsiaoChenNeural';
}


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
      if (this.isSpeaking === true && state.useAudioMouth === true) {
        state.mouthValue += (state.audioMouth - state.mouthValue) * 0.5;
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
      state.audioMouth = Math.min(1, Math.sqrt(sum / data.length) * 3.4);
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
