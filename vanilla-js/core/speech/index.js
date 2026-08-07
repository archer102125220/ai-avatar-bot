// TODO: 等到環境可以測試麥克風跟喇叭時，要徹底測過這份檔案內部的所有機制有沒有因為重構而出問題
import {
  DEFAULT_TTS_ENDPOINT,
  GENDER_MAP,
  AVATAR_MODE_MAP,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE
} from '../constants';
import { createBaseStore } from '../store';

// speech.js
// ===== TTS：開口說話 + 對嘴 =====
function loadVoice(gender) {
  const voices = speechSynthesis.getVoices();
  const pick = (targetVoice) =>
    voices.find(
      (voice) =>
        targetVoice.test(`${voice.name} ${voice.lang}`) &&
        !/Google/i.test(voice.name)
    ); // 避開 Chrome 會靜默失敗的 Google 遠端語音

  let broswerVoice = null;

  if (gender === GENDER_MAP.male) {
    broswerVoice = pick(
      /(YunJhe|YunJian|YunXia|雲哲|雲健|雲夏|Zhiwei|志偉).*zh/i
    ); // 微軟神經男聲
  } else if (gender === GENDER_MAP.female) {
    broswerVoice =
      pick(/(HsiaoChen|HsiaoYu|曉臻|曉雨).*zh/i) || // 微軟神經女聲（最自然，若有安裝）
      pick(/(Yating|Hanhan|雅婷|涵涵).*zh[-_]TW/i); // 較新、較不機械的微軟 zh-TW 女聲
  }

  return (
    broswerVoice ||
    pick(/Microsoft.*zh[-_]TW/i) || // 任何微軟 zh-TW（本地、可靠）
    pick(/zh[-_]TW/i) ||
    pick(/^zh/i) ||
    voices.find((voice) => /zh/i.test(voice.lang)) ||
    null
  );
}

// speech.js
// edge-tts 神經語音：抓 /api/tts 的 MP3 → AudioBuffer（給佇列預抓用）
async function fetchTTSBuffer(speechEngine, text) {
  const safeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (speechEngine.audioCtx instanceof safeAudioContext === false) {
    speechEngine.audioCtx = new safeAudioContext();
  }
  if (speechEngine.audioCtx.state === 'suspended') {
    try {
      await speechEngine.audioCtx.resume();
    } catch (_error) {}
  }
  const sep = speechEngine.ttsEndpoint.indexOf('?') < 0 ? '?' : '&';
  const response = await fetch(
    speechEngine.ttsEndpoint +
      sep +
      'voice=' +
      encodeURIComponent(speechEngine.neuralVoice) +
      '&text=' +
      encodeURIComponent(text)
  );
  if (response.ok === false) {
    throw new Error('http ' + response.status);
  }
  const respArrayBuffer = await response.arrayBuffer();
  if (respArrayBuffer.byteLength < 800) {
    throw new Error('audio too small');
  }
  return speechEngine.audioCtx.decodeAudioData(respArrayBuffer);
}

// speech.js
function prefetchSpeech(speechEngine, sid) {
  // 只預抓最前面 2 句（在途 ≤2），護後端限流
  if (sid !== speechEngine.speakSeq || speechEngine.neuralDisabled === true) {
    return;
  }
  for (const item of speechEngine.speechQ.slice(0, 2)) {
    if (item.prep == null && item.err == null) {
      item.prep = fetchTTSBuffer(speechEngine, item.text).catch((error) => {
        item.err = error;
        return null;
      });
    }
  }
}

// speech.js
// 播一句（Web Audio + AnalyserNode 以「實際音量」驅動嘴型），播完呼叫 done 換下一句
function playBuffer(speechEngine, audioBuf, done) {
  const src = speechEngine.audioCtx.createBufferSource();
  src.buffer = audioBuf;
  const analyser = speechEngine.audioCtx.createAnalyser();
  analyser.fftSize = 256;
  src.connect(analyser);
  analyser.connect(speechEngine.audioCtx.destination);
  const data = new Uint8Array(analyser.fftSize);
  speechEngine.currentSource = src;
  speechEngine.useAudioMouth = true;
  speechEngine.isSpeaking = true;
  if (speechEngine.tapDone !== true) {
    speechEngine.tapDone = true;
    if (
      typeof speechEngine.avatarModel === 'object' &&
      speechEngine.avatarModel !== null
    ) {
      try {
        speechEngine.avatarModel.motion('Tap');
      } catch (_error) {}
    }
  } // Tap 動作一段話只做一次
  function audioLoop() {
    if (speechEngine.currentSource !== src) {
      return; // 不是我在播了就停
    }
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const normalizedSample = (data[i] - 128) / 128;
      sum += normalizedSample * normalizedSample;
    }
    speechEngine.audioMouth = Math.min(1, Math.sqrt(sum / data.length) * 3.4); // RMS 音量 → 開口
    speechEngine.currentFps = requestAnimationFrame(audioLoop);
  }
  speechEngine.currentFps = requestAnimationFrame(audioLoop);
  src.onended = () => {
    // 自然播完才收尾；被打斷時 onended 已被清掉
    if (speechEngine.currentSource !== src) {
      return;
    }
    if (
      typeof speechEngine.currentFps === 'number' &&
      speechEngine.currentFps > 0
    ) {
      cancelAnimationFrame(speechEngine.currentFps);
      speechEngine.currentFps = 0;
    }
    speechEngine.isSpeaking = false;
    speechEngine.useAudioMouth = false;
    speechEngine.audioMouth = 0;
    speechEngine.currentSource = null;
    done();
  };
  src.start(0);
}

// speech.js
// 整段文字 → 句子陣列（TTS 逐句抓、邊講邊抓下一句，長答案不用等整段）
function splitSentences(text) {
  const out = [];
  let buf = '';
  for (const ch of String(text || '')) {
    buf += ch;
    if (/[。！？!?；;\n…]/.test(ch) === true) {
      if (buf.trim() !== '') {
        out.push(buf.trim());
      }
      buf = '';
    } else if (buf.length >= 80) {
      // 沒標點的長串：找逗號斷，不然硬切
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
  if (buf.trim() !== '') {
    out.push(buf.trim());
  }
  const merged = []; // 太短的碎句併進前一句（太短的 TTS 不自然、請求也多）
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
    // 上限 10 段：護 TTS 限流
    const m2 = [];
    for (let i = 0; i < merged.length; i += 2) {
      m2.push(merged[i] + (merged[i + 1] || ''));
    }
    merged.length = 0;
    merged.push.apply(merged, m2);
  }
  return merged;
}

// speech.js
function handleNeuralFail(speechEngine, e) {
  const msg = e?.message || '';
  if (/http 429/.test(msg) === true) {
    console.warn('TTS 被限流，這句退瀏覽器語音');
    return;
  } // 429 是暫時的，別鎖死神經語音
  if (
    /http 4\d\d|Failed to fetch|NetworkError|Load failed/i.test(msg) === true
  ) {
    speechEngine.neuralDisabled = true; // 結構性失敗(無後端/CORS/被擋)→不再試
  }
  console.warn('神經語音失敗，退回瀏覽器語音：', msg);
}

// speech.js
// 後備：瀏覽器內建語音(Yating) 逐句版。對嘴用「估時長」驅動，不靠 speechSynthesis.speaking 輪詢
// （Chrome 在 cancel 後常回報失準 → 第二次說話嘴巴就不動了）
function speakBrowserChunk(speechEngine, text, sid, done) {
  if (speechEngine.ttsMuted === true || 'speechSynthesis' in window === false) {
    done();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  if (speechEngine.ttVoice === null) {
    speechEngine.ttVoice = loadVoice(speechEngine.gender);
  }
  if (
    typeof speechEngine.ttVoice === 'object' &&
    speechEngine.ttVoice !== null
  ) {
    utterance.voice = speechEngine.ttVoice;
  }
  utterance.lang = speechEngine.ttVoice?.lang || 'zh-TW';
  utterance.rate = speechEngine.ttsRate || 1.0;
  utterance.pitch = 1.0;
  utterance.onboundary = () => {
    speechEngine.mouthTarget = 0.5 + Math.random() * 0.5;
  };
  let fin = false;
  const finish = () => {
    if (fin === true) {
      return;
    }
    fin = true;
    speechEngine.isSpeaking = false;
    done();
  };
  utterance.onend = finish;
  const estMs = Math.min(
    16000,
    Math.max(1200, (text.length * 130) / (speechEngine.ttsRate || 1))
  );
  const fire = () => {
    if (sid !== speechEngine.speakSeq) {
      return; // 排隊期間被打斷就不講了
    }
    try {
      speechSynthesis.resume();
    } catch (_error) {} // 解 Chrome cancel 後卡住的 bug
    speechSynthesis.speak(utterance);
    speechEngine.isSpeaking = true;
    speechEngine.mouthTarget = 0.7;
    if (speechEngine.tapDone !== true) {
      speechEngine.tapDone = true;
      if (
        typeof speechEngine.avatarModel === 'object' &&
        speechEngine.avatarModel !== null
      ) {
        try {
          speechEngine.avatarModel.motion('Tap');
        } catch (_error) {}
      }
    }
    clearTimeout(speechEngine.speakBrowserTimer);
    speechEngine.speakBrowserTimer = setTimeout(finish, estMs); // 保底：時間到閉嘴＋換下一句，不依賴事件
  };
  if (speechSynthesis.speaking === true || speechSynthesis.pending === true) {
    speechSynthesis.cancel();
    setTimeout(fire, 120);
  } else {
    fire();
  }
}

export function initSpeechEngine(setting = {}) {
  const { ttsEndpoint, neuralVoice } = setting;

  const store = createBaseStore({
    isSpeaking: false,
    isListening: false
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
    _gender: setting.getGender ? setting.getGender() : GENDER_MAP.female,
    get gender() {
      return this._gender;
    },
    setGender(newGender) {
      this._gender = newGender;
      if (newGender === GENDER_MAP.female) {
        this.neuralVoice = DEFAULT_FEMALE_NEURAL_VOICE;
      } else if (newGender === GENDER_MAP.male) {
        this.neuralVoice = DEFAULT_MALE_NEURAL_VOICE;
      }
      this.ttVoice = null;
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

    _mouthTarget: 0.7, // 可能要歸在 skin ?
    get mouthTarget() {
      return this._mouthTarget;
    },
    set mouthTarget(newMouthTarget) {
      if (typeof newMouthTarget === 'number' || newMouthTarget === null) {
        this._mouthTarget = newMouthTarget;
      }
    },

    _mouthValue: 0, // 可能要歸在 skin ?
    get mouthValue() {
      return this._mouthValue;
    },
    set mouthValue(newMouthValue) {
      if (typeof newMouthValue === 'number' || newMouthValue === null) {
        this._mouthValue = newMouthValue;
      }
    },

    _speakSeq: 0,
    get speakSeq() {
      return this._speakSeq;
    },
    set speakSeq(newSpeakSeq) {
      if (typeof newSpeakSeq === 'number' || newSpeakSeq === null) {
        this._speakSeq = newSpeakSeq;
      }
    },

    get fetchTTSBuffer() {
      return function _fetchTTSBuffer() {
        return fetchTTSBuffer(speechEngine, ...arguments);
      };
    },

    // ②逐句開講的佇列狀態（var：這檔案有「宣告前就被呼叫」的前例，避 TDZ）
    speechQ: [],
    speechEnded: false,
    isSpeechPlaying: false,
    tapDone: false,

    speakBrowserTimer: 0,
    spokenDisplayTextTimer: 0,

    // 控制「點第二下打斷第一下」
    _currentFps: 0,
    get currentFps() {
      return this._currentFps;
    },
    set currentFps(newCurrentFps) {
      if (typeof newCurrentFps === 'number' || newCurrentFps === null) {
        this._currentFps = newCurrentFps;
      }
    },

    _currentSource: null,
    get currentSource() {
      return this._currentSource;
    },
    set currentSource(newCurrentSource) {
      if (typeof newCurrentSource === 'object') {
        this._currentSource = newCurrentSource;
      }
    },

    get isSpeaking() {
      return store.getState().isSpeaking;
    },
    set isSpeaking(newIsSpeaking) {
      if (typeof newIsSpeaking === 'boolean' || newIsSpeaking === null) {
        store.setState({ isSpeaking: newIsSpeaking });
      }
    },

    _useAudioMouth: false,
    get useAudioMouth() {
      return this._useAudioMouth;
    },
    set useAudioMouth(newUseAudioMouth) {
      if (typeof newUseAudioMouth === 'boolean' || newUseAudioMouth === null) {
        this._newUseAudioMouth = newUseAudioMouth;
      }
    },

    _audioMouth: 0,
    get audioMouth() {
      return this._audioMouth;
    },
    set audioMouth(newAudioMouth) {
      if (typeof newAudioMouth === 'number' || newAudioMouth === null) {
        this._audioMouth = newAudioMouth;
      }
    },

    _ttsMuted: false,
    get ttsMuted() {
      return this._ttsMuted;
    },
    set ttsMuted(newTtsMuted) {
      if (typeof newTtsMuted === 'boolean' || newTtsMuted === null) {
        this._ttsMuted = newTtsMuted;
      }
    },

    // 連續對話（陪伴模式）：她講完 → 自動重開麥。她講話期間不開麥（會聽到自己的聲音）
    convoOn: false,
    noSpeechRuns: 0,

    get isListening() {
      return store.getState().isListening;
    },
    set isListening(newIsListening) {
      if (typeof newIsListening === 'boolean' || newIsListening === null) {
        store.setState({ isListening: newIsListening });
      }
    },

    // 抓不到神經語音後端就鎖定瀏覽器語音，避免每句都打 404
    _neuralDisabled: false,
    get neuralDisabled() {
      return this._neuralDisabled;
    },
    set neuralDisabled(newNeuralDisabled) {
      if (
        typeof newNeuralDisabled === 'boolean' ||
        newNeuralDisabled === null
      ) {
        this._neuralDisabled = newNeuralDisabled;
      }
    },

    _audioCtx: null,
    get audioCtx() {
      return this._audioCtx;
    },
    set audioCtx(newAudioCtx = null) {
      if (typeof newAudioCtx === 'object') {
        this._audioCtx = newAudioCtx;
      }
    },

    _ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    get ttsEndpoint() {
      return this._ttsEndpoint;
    },
    set ttsEndpoint(newTtsEndpoint = '') {
      if (typeof newTtsEndpoint === 'string' && newTtsEndpoint !== '') {
        this._ttsEndpoint = newTtsEndpoint;
      }
    },

    _neuralVoice: neuralVoice,
    get neuralVoice() {
      return this._neuralVoice; // 神經語音
    },
    set neuralVoice(newNeuralVoice = '') {
      if (typeof newNeuralVoice === 'string' || newNeuralVoice === null) {
        this._neuralVoice = newNeuralVoice;
      }
    },

    _ttVoice: null,
    get ttVoice() {
      return this._ttVoice;
    },
    set ttVoice(newTtVoice) {
      if (typeof newTtVoice === 'object') {
        this._ttVoice = newTtVoice;
      }
    },

    _ttsRate: 1.0,
    get ttsRate() {
      return this._ttsRate;
    },
    set ttsRate(newTtsRate) {
      if (typeof newTtsRate === 'number' || newTtsRate === null) {
        this._ttsRate = newTtsRate;
      }
    },

    _spokenDisplayText: '',
    get spokenDisplayText() {
      return this._spokenDisplayText;
    },
    set spokenDisplayText(newSpeakingLabel) {
      if (typeof newSpeakingLabel === 'string' || newSpeakingLabel === null) {
        this._spokenDisplayText = newSpeakingLabel;

        if (typeof this.onSpokenDisplayTextChange === 'function') {
          this.onSpokenDisplayTextChange(newSpeakingLabel);
        }
      }
    },
    speak: (text, options) =>
      speak(speechEngine, String(text || '').slice(0, 600), options),
    _spokenAudioText: '',
    get spokenAudioText() {
      return this._spokenAudioText;
    },
    set spokenAudioText(newSpeakingSounds) {
      if (typeof newSpeakingSounds === 'string' || newSpeakingSounds === null) {
        this._spokenAudioText = newSpeakingSounds;

        this.spokenDisplayText = newSpeakingSounds;
        if (typeof this.onSpeaking === 'function') {
          this.onSpeaking(newSpeakingSounds);
        }
        this.speak(newSpeakingSounds);
      }
    },

    _recognition: null,
    get recognition() {
      return this._recognition;
    },
    set recognition(newRecognition) {
      if (typeof newRecognition === 'object') {
        this._recognition = newRecognition;
      }
    },

    get onSpeaking() {
      return function _onSpeaking(text, ...args) {
        if (typeof setting.onSpeaking === 'function') {
          return setting.onSpeaking(text, ...args);
        }
      };
    },
    get onSpeakingEnd() {
      return function _onSpeakingEnd(text, ...args) {
        if (typeof setting.onSpeakingEnd === 'function') {
          return setting.onSpeakingEnd(text, ...args);
        }
      };
    },
    get onSpokenDisplayTextChange() {
      return function _onSpokenDisplayTextChange(newSpeakingLabel, ...args) {
        clearTimeout(this.spokenDisplayTextTimer);
        this.spokenDisplayTextTimer = setTimeout(
          () => this.onSpokenDisplayTextTimeout(),
          6000
        );

        if (typeof setting.onSpokenDisplayTextChange === 'function') {
          return setting.onSpokenDisplayTextChange(newSpeakingLabel, ...args);
        }
      };
    },
    get onSpokenDisplayTextTimeout() {
      return function _onSpokenDisplayTextTimeout(...args) {
        if (typeof setting.onSpokenDisplayTextTimeout === 'function') {
          return setting.onSpokenDisplayTextTimeout(...args);
        }
      };
    },

    stopSpeaking: () => stopSpeaking(speechEngine),
    interruptForVoice: () => interruptForVoice(speechEngine),
    computeMouth: () => computeMouth(speechEngine),
    onTap: () => onTap(speechEngine),
    stopVoiceSession: (message) => stopVoiceSession(speechEngine, message),
    setMic: (isListening) => setMic(speechEngine, isListening),
    startListening: () => startListening(speechEngine),
    preloadTapGreeting: () => preloadTapGreeting(speechEngine),
    setLocale: (locale) => setLocale(speechEngine, locale),
    pumpSpeech: (sid) => pumpSpeech(speechEngine, sid),
    handleUser: (text) => handleUser(speechEngine, text),
    beginSpeech: () => beginSpeech(speechEngine),
    pushSpeech: (sid, text, options) =>
      pushSpeech(speechEngine, sid, text, options),
    endSpeech: (sid) => endSpeech(speechEngine, sid),
    onUtteranceEnd: () => onUtteranceEnd(speechEngine),
    drainSentences: (state, force) =>
      drainSentences(speechEngine, state, force),

    _greeting: null, // function
    get greeting() {
      return this._greeting;
    },
    set greeting(newGreeting) {
      if (typeof newGreeting === 'function' || newGreeting === null) {
        this._greeting = newGreeting;
      }
    },

    _companionGreeting: null, // function | string
    get companionGreeting() {
      return this._companionGreeting;
    },
    set companionGreeting(newCompanionGreeting) {
      if (
        typeof newCompanionGreeting === 'function' ||
        typeof newCompanionGreeting === 'string' ||
        newCompanionGreeting === null
      ) {
        this._companionGreeting = newCompanionGreeting;
      }
    },

    _assistantGreeting: null, // function | string
    get assistantGreeting() {
      return this._assistantGreeting;
    },
    set assistantGreeting(newAssistantGreeting) {
      if (
        typeof newAssistantGreeting === 'function' ||
        typeof newAssistantGreeting === 'string' ||
        newAssistantGreeting === null
      ) {
        this._assistantGreeting = newAssistantGreeting;
      }
    },
    isProcessing: false
  };

  if (typeof setting.greeting === 'function') {
    speechEngine.greeting = setting.greeting.bind();
  }
  if (typeof setting.companionGreeting === 'function') {
    speechEngine.companionGreeting = setting.companionGreeting.bind();
  } else if (typeof setting.companionGreeting === 'string') {
    speechEngine.companionGreeting = setting.companionGreeting;
  }
  if (typeof setting.assistantGreeting === 'function') {
    speechEngine.assistantGreeting = setting.assistantGreeting.bind();
  } else if (typeof setting.assistantGreeting === 'string') {
    speechEngine.assistantGreeting = setting.assistantGreeting;
  }

  // speech.js
  if ('speechSynthesis' in window === true) {
    speechSynthesis.onvoiceschanged = () => {
      if (speechEngine.ttVoice === null) {
        speechEngine.ttVoice = loadVoice(speechEngine.gender);
      }
    };
    speechEngine.ttVoice = loadVoice(speechEngine.gender);
  }

  return speechEngine;
}

// ================== EXTRACTED FROM index.js ==================
function computeMouth(speechEngine) {
  if (speechEngine.isSpeaking === true && speechEngine.useAudioMouth === true) {
    speechEngine.mouthValue +=
      (speechEngine.audioMouth - speechEngine.mouthValue) * 0.5; // 神經語音：跟真實音量精準對嘴
  } else if (speechEngine.isSpeaking === true) {
    const timeNow = performance.now() / 1000;
    speechEngine.mouthValue =
      0.12 + 0.83 * speechEngine.mouthTarget * Math.abs(Math.sin(timeNow * 9)); // 瀏覽器語音：假開合
  } else {
    speechEngine.mouthValue = Math.max(0, speechEngine.mouthValue - 0.18);
  }
  return speechEngine.mouthValue;
}

// speech.js
// 串流版切句：state.buf 累積 token，切得出完整句就吐出（force＝收尾把殘句也吐）
function drainSentences(speechEngine, state, force) {
  const out = [];
  let i;
  while ((i = state.buf.search(/[。！？!?；;\n…]/)) >= 0) {
    const sentence = state.buf.slice(0, i + 1).trim();
    state.buf = state.buf.slice(i + 1);
    if (sentence !== '') {
      out.push(sentence);
    }
  }
  if (force === true && state.buf.trim() !== '') {
    out.push(state.buf.trim());
    state.buf = '';
  }
  return out;
}

// speech.js
// 中止目前正在講的（逐句佇列 + 神經語音音檔 + 瀏覽器 TTS + 對嘴），給「點第二下打斷第一下」用
function stopSpeaking(speechEngine) {
  speechEngine.speakSeq++; // 作廢所有在跑的逐句鏈（pump 看序號就會停）
  speechEngine.speechQ = [];
  speechEngine.speechEnded = true;
  speechEngine.isSpeechPlaying = false;
  try {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  } catch (_error) {}
  try {
    clearTimeout(speechEngine.speakBrowserTimer);
  } catch (_error) {}
  if (
    typeof speechEngine.currentFps === 'number' &&
    speechEngine.currentFps > 0
  ) {
    cancelAnimationFrame(speechEngine.currentFps);
    speechEngine.currentFps = 0;
  }
  if (
    typeof speechEngine.currentSource === 'object' &&
    speechEngine.currentSource !== null
  ) {
    try {
      speechEngine.currentSource.onended = null;
      speechEngine.currentSource.stop();
    } catch (_error) {}
    speechEngine.currentSource = null;
  }
  speechEngine.isSpeaking = false;
  speechEngine.useAudioMouth = false;
  speechEngine.audioMouth = 0;

  speechEngine.skin.gestureName = 'neutral';
}

// speech.js
// 對外入口：整段文字 → 切句進逐句佇列（②講第 1 句時預抓第 2 句 → 長答案幾乎立刻開口）
function speak(speechEngine, text, options) {
  if (speechEngine.container instanceof HTMLElement === false) {
    console.warn(
      '[aiAvatar speak] speechEngine.container is not an HTMLElement'
    );
    return;
  }

  if (speechEngine.ttsMuted === true) {
    speechEngine.setEmotionFromText(text);
    onUtteranceEnd(); // 靜音：沒語音可收尾，直接觸發對話迴圈 hook
    return;
  }

  speechEngine.spokenDisplayText = text;
  const sid = beginSpeech(speechEngine);
  speechEngine.setEmotionFromText(text); // ①講話帶情緒（3D 表情；要在 beginSpeech 之後，不然被 reset）
  for (const sentences of splitSentences(text)) {
    pushSpeech(speechEngine, sid, sentences, options);
  }
  endSpeech(speechEngine, sid);
}

// speech.js
// ===== ②逐句開講引擎：一次一個 session；句子依序講，神經語音在背景先抓下一句 =====
function beginSpeech(speechEngine) {
  stopSpeaking(speechEngine); // 打斷上一段（含清佇列、表情回中性）
  speechEngine.assistantSpeechStartedAt = performance.now();
  if (speechEngine.convoOn === true) {
    if (typeof speechEngine.onVoiceStatusChanged === 'function') {
      speechEngine.onVoiceStatusChanged(
        speechEngine.convoOn,
        '正在回答，可以直接插話…',
        'speaking',
        0
      );
    }
  }
  speechEngine.speechQ = [];
  speechEngine.speechEnded = false;
  speechEngine.isSpeechPlaying = false;
  speechEngine.tapDone = false;
  return ++speechEngine.speakSeq;
}
// speech.js
function pushSpeech(speechEngine, sid, text, options) {
  if (sid !== speechEngine.speakSeq) {
    return;
  }
  const safeText = String(text || '').trim();
  if (safeText === '') {
    return;
  }
  speechEngine.speechQ.push({
    text: safeText,
    prep: null,
    err: null,
    instant: !!(options && options.instant)
  });
  prefetchSpeech(speechEngine, sid);
  pumpSpeech(speechEngine, sid);
}
// speech.js
function endSpeech(speechEngine, sid) {
  if (sid === speechEngine.speakSeq) {
    speechEngine.speechEnded = true;
    // speechEngine.spokenDisplayText = "";
    speechEngine.skin.emo.target = 0;
    pumpSpeech(speechEngine, sid);
  }
}

// speech.js
function onUtteranceEnd(speechEngine) {
  speechEngine.isProcessing = false;
  if (
    speechEngine.convoOn === true &&
    speechEngine.avatarMode === AVATAR_MODE_MAP.companion
  ) {
    if (typeof speechEngine.onVoiceStatusChanged === 'function')
      speechEngine.onVoiceStatusChanged(
        speechEngine.convoOn,
        '準備繼續聆聽…',
        'thinking',
        0
      );
    setTimeout(() => {
      if (
        speechEngine.convoOn === true &&
        speechEngine.isListening === false &&
        speechEngine.isSpeaking === false &&
        speechEngine.isSpeechPlaying === false
      ) {
        speechEngine.noSpeechRuns = 0;
        startListening(speechEngine);
      }
    }, 450);
  } else {
    stopVoiceSession(speechEngine);
  }
}

// speech.js
async function pumpSpeech(speechEngine, sid) {
  if (speechEngine.isSpeechPlaying || sid !== speechEngine.speakSeq) {
    return;
  }
  const item = speechEngine.speechQ.shift();
  if (item === undefined) {
    if (speechEngine.speechEnded === true) {
      speechEngine.skin.gestureName = 'neutral';
      onUtteranceEnd(speechEngine);
    }
    return;
  } // 整段講完 → 表情回中性＋(陪伴)重開麥
  speechEngine.isSpeechPlaying = true;
  const done = () => {
    if (sid !== speechEngine.speakSeq) {
      return;
    }
    speechEngine.isSpeechPlaying = false;
    prefetchSpeech(speechEngine, sid);
    pumpSpeech(speechEngine, sid);
  };

  if (
    item.instant &&
    item.text === getGreetingText() &&
    speechEngine.tapGreetingBuffer == null
  ) {
    preloadTapGreeting(speechEngine);
    speakBrowserChunk(speechEngine, item.text, sid, done);
    return;
  }

  let buf = null;
  if (speechEngine.neuralDisabled !== true && item.err == null) {
    if (item.prep == null) {
      item.prep = fetchTTSBuffer(item.text).catch((error) => {
        item.err = error;
        return null;
      });
    }
    buf = await item.prep;
  }
  if (sid !== speechEngine.speakSeq) {
    return; // 等音檔期間被新的說話打斷 → 整條放棄
  }
  if (buf != null) {
    prefetchSpeech(speechEngine, sid);
    playBuffer(speechEngine, buf, done);
  } else {
    if (item.err != null) {
      handleNeuralFail(speechEngine, item.err);
    }
    speakBrowserChunk(speechEngine, item.text, sid, done);
  }
}

// speech.js | brain.js
async function handleUser(speechEngine, text = '') {
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

  // speechEngine.isSpeaking = true;
  speechEngine.isProcessing = true; // 回答完成前不要自動重開麥（onUtteranceEnd 會清）

  if (
    typeof speechEngine.skin === 'object' &&
    speechEngine.skin !== null &&
    speechEngine.skin.gestureName !== undefined
  ) {
    speechEngine.skin.gestureName = 'thinking';
  }

  speechEngine.brain.handleAnswer(text);
}

async function ensureMicMonitor(speechEngine) {
  if (
    typeof speechEngine.micStream === 'object' &&
    speechEngine.micStream !== null
  ) {
    return;
  }
  if (
    typeof navigator.mediaDevices !== 'object' ||
    navigator.mediaDevices === null ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    throw new Error('media-not-supported');
  }

  speechEngine.micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  });
  speechEngine.micAudioCtx = new (
    window.AudioContext || window.webkitAudioContext
  )();
  if (speechEngine.micAudioCtx.state === 'suspended') {
    try {
      await speechEngine.micAudioCtx.resume();
    } catch (_e) {}
  }

  speechEngine.micAnalyser = speechEngine.micAudioCtx.createAnalyser();
  speechEngine.micAnalyser.fftSize = 256;
  speechEngine.micAnalyser.smoothingTimeConstant = 0.35;
  speechEngine.micAudioCtx
    .createMediaStreamSource(speechEngine.micStream)
    .connect(speechEngine.micAnalyser);
  speechEngine.micData = new Uint8Array(speechEngine.micAnalyser.fftSize);

  speechEngine.micNoiseFloor = 0;
  speechEngine.voiceFrames = 0;
  speechEngine.lastBargeIn = 0;

  monitorMicLevel(speechEngine);
}

function monitorMicLevel(speechEngine) {
  if (
    typeof speechEngine.micAnalyser !== 'object' ||
    speechEngine.micAnalyser === null ||
    typeof speechEngine.micData !== 'object' ||
    speechEngine.micData === null
  ) {
    return;
  }
  speechEngine.micAnalyser.getByteTimeDomainData(speechEngine.micData);
  let sum = 0;
  for (let i = 0; i < speechEngine.micData.length; i++) {
    const value = (speechEngine.micData[i] - 128) / 128;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / speechEngine.micData.length);

  const isSpeaking = speechEngine.isSpeaking || speechEngine.isSpeechPlaying;
  const isListening = speechEngine.isListening;
  const assistantActive = isSpeaking || speechEngine.isProcessing;

  if (!assistantActive && !isListening) {
    speechEngine.micNoiseFloor = speechEngine.micNoiseFloor * 0.96 + rms * 0.04;
  }

  const showVoiceUI = speechEngine.convoOn || isListening || assistantActive;

  if (typeof speechEngine.onVoiceStatusChanged === 'function') {
    speechEngine.onVoiceStatusChanged(
      showVoiceUI,
      undefined,
      isListening ? 'listening' : isSpeaking ? 'speaking' : 'thinking',
      rms * 650
    );
  }

  const threshold = Math.max(0.085, speechEngine.micNoiseFloor * 5.5);
  const speechDuration =
    performance.now() -
    (speechEngine.assistantSpeechStartedAt || performance.now());

  if (
    speechEngine.convoOn === true &&
    assistantActive === true &&
    speechDuration > 550 &&
    rms > threshold
  ) {
    speechEngine.voiceFrames++;
  } else {
    speechEngine.voiceFrames = Math.max(0, (speechEngine.voiceFrames || 0) - 2);
  }

  if (
    speechEngine.voiceFrames >= 9 &&
    performance.now() - speechEngine.lastBargeIn > 1400
  ) {
    interruptForVoice(speechEngine);
  }

  speechEngine.micRaf = requestAnimationFrame(() =>
    monitorMicLevel(speechEngine)
  );
}

function stopMicMonitor(speechEngine) {
  if (typeof speechEngine.micRaf === 'number' && speechEngine.micRaf > 0) {
    cancelAnimationFrame(speechEngine.micRaf);
  }
  speechEngine.micRaf = 0;

  if (typeof speechEngine.micStream === 'object' && speechEngine.micStream !== null) {
    speechEngine.micStream.getTracks().forEach((track) => track.stop());
  }
  speechEngine.micStream = null;
  speechEngine.micAnalyser = null;
  speechEngine.micData = null;

  if (typeof speechEngine.micAudioCtx === 'object' && speechEngine.micAudioCtx !== null) {
    try {
      speechEngine.micAudioCtx.close();
    } catch (_e) {}
  }
  speechEngine.micAudioCtx = null;
  if (typeof speechEngine.onVoiceStatusChanged === 'function') {
    speechEngine.onVoiceStatusChanged(
      speechEngine.convoOn,
      undefined,
      undefined,
      0
    );
  }
}

function stopVoiceSession(speechEngine, message) {
  speechEngine.convoOn = false;
  clearTimeout(speechEngine.recognitionSilenceTimer);
  speechEngine.recognitionText = '';
  speechEngine.recognitionSubmitted = true;
  speechEngine.recognitionError = 'aborted';
  try {
    if (typeof speechEngine?.recognition?.abort === 'function') {
      speechEngine.recognition.abort();
    }
  } catch (_error) {}
  speechEngine.recognition = null;
  speechEngine.isListening = false;
  speechEngine.isProcessing = false;
  stopSpeaking(speechEngine);
  setMic(speechEngine, false);
  stopMicMonitor(speechEngine);

  if (typeof speechEngine.onVoiceStatusChanged === 'function') {
    speechEngine.onVoiceStatusChanged(false, '', '', 0);
  }
  if (typeof message === 'string' && message !== '') {
    speechEngine.spokenDisplayText = message;
  }
}

function interruptForVoice(speechEngine) {
  speechEngine.lastBargeIn = performance.now();
  speechEngine.voiceFrames = 0;

  speechEngine.speakSeq++;
  if (typeof speechEngine.brain?.llm?.controller?.abort === 'function') {
    try {
      speechEngine.brain.llm.controller.abort();
    } catch (_error) {}
  }

  stopSpeaking(speechEngine);
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
    if (speechEngine.convoOn === true && speechEngine.isListening !== true) {
      startListening(speechEngine);
    }
  }, 100);
}

// ===== STT：聽你說話 =====
function setMic(speechEngine, isListening = false) {
  if (typeof speechEngine.onMicStateChanged === 'function') {
    speechEngine.onMicStateChanged(isListening, speechEngine.convoOn);
  }
}

// speech.js | brain.js
async function startListening(speechEngine) {
  const rootContainer = speechEngine.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar startListening] rootContainer is not an HTMLElement'
    );
    return;
  }

  const SafeSpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SafeSpeechRecognition == null) {
    speechEngine.spokenAudioText =
      '你的瀏覽器不支援語音辨識，建議用 Chrome 開喔。';
    speechEngine.convoOn = false;
    return;
  }
  if (speechEngine.isListening === true && typeof speechEngine.recognition === 'object' && speechEngine.recognition !== null) {
    speechEngine.recognition.stop();
    return;
  }

  if (typeof speechEngine.micStream !== 'object' || speechEngine.micStream === null) {
    setMic(speechEngine, false);
    if (typeof speechEngine.onVoiceStatusChanged === 'function') {
      speechEngine.onVoiceStatusChanged(
        true,
        '正在取得麥克風權限…',
        'thinking',
        0
      );
    }
  }
  try {
    await ensureMicMonitor(speechEngine);
    if (speechEngine.isSpeechPlaying === true || speechEngine.isProcessing === true) {
      stopSpeaking(speechEngine);
    }
  } catch (e) {
    speechEngine.convoOn = false;
    setMic(speechEngine, false);
    const message = '無法啟動語音功能，請檢查麥克風與瀏覽器設定。';
    speechEngine.spokenAudioText = message;
    if (typeof speechEngine.onVoiceStatusChanged === 'function') {
      speechEngine.onVoiceStatusChanged(true, message, '', 0);
    }
    console.warn('mic monitor error', e);
    return;
  }

  try {
    speechEngine.recognition = new SafeSpeechRecognition();
  } catch (error) {
    speechEngine.spokenAudioText = '語音辨識啟動失敗：' + error.message;
    speechEngine.convoOn = false;
    return;
  }

  speechEngine.recognitionSilenceTimer = null;
  speechEngine.recognition.lang = 'zh-TW';
  speechEngine.recognition.interimResults = true;
  speechEngine.recognition.continuous = true;
  speechEngine.recognition.maxAlternatives = 1;
  speechEngine.recognition.onstart = () => {
    speechEngine.isListening = true;
    setMic(speechEngine, true);
    if (typeof speechEngine.onVoiceStatusChanged === 'function') {
      speechEngine.onVoiceStatusChanged(
        true,
        '請說話，可以隨時插話…',
        'listening',
        0
      );
    }
  };
  speechEngine.recognition.onresult = (event) => {
    let finalText = '',
      interimText = '';
    for (const result of event.results) {
      if (result.isFinal === true) {
        finalText += result[0].transcript + ' ';
      } else {
        interimText += result[0].transcript + ' ';
      }
    }
    const txt = (finalText + interimText).trim();
    if (txt === '') {
      return;
    }

    speechEngine.noSpeechRuns = 0;
    speechEngine.spokenDisplayText = '你：' + txt + (interimText !== '' ? '…' : '');
    if (typeof speechEngine.onVoiceStatusChanged === 'function') {
      speechEngine.onVoiceStatusChanged(
        speechEngine.convoOn,
        interimText !== '' ? '正在辨識：' + txt : '收到語音，準備送出…',
        'listening',
        0
      );
    }

    clearTimeout(speechEngine.recognitionSilenceTimer);
    speechEngine.recognitionSilenceTimer = setTimeout(
      () => {
        try {
          if (typeof speechEngine.recognition === 'object' && speechEngine.recognition !== null) {
            speechEngine.recognition.stop();
          }
        } catch (_error) {}
      },
      interimText !== '' ? 900 : 420
    );

    const last = event.results[event.results.length - 1];
    if (last.isFinal === true) {
      handleUser(speechEngine, txt);
    }
  };
  speechEngine.recognition.onerror = (event) => {
    speechEngine.isListening = false;
    setMic(speechEngine, false);
    if (event.error === 'not-allowed') {
      speechEngine.convoOn = false;
      speechEngine.spokenDisplayText = '我需要麥克風權限才能聽你說話喔。';
      stopMicMonitor(speechEngine);
      if (typeof speechEngine.onVoiceStatusChanged === 'function') {
        speechEngine.onVoiceStatusChanged(
          speechEngine.convoOn,
          '麥克風權限被拒絕',
          '',
          0
        );
      }
      return;
    }
    if (event.error === 'aborted') {
      return; // 手動中止不需顯示錯誤，保留 stopVoiceSession 寫入的文字
    }
    if (speechEngine.convoOn === true && event.error === 'no-speech') {
      return; // 交給 onend 的續聽邏輯
    }

    speechEngine.spokenDisplayText =
      '沒聽清楚（' + event.error + '），再試一次。';
  };
  speechEngine.recognition.onend = () => {
    speechEngine.isListening = false;
    setMic(speechEngine, false);
    // 連續對話：靜默結束（沒觸發回答）→ 自動再聽；連 3 次沒聲音就休息，避免無限開麥
    if (
      speechEngine.convoOn === true &&
      speechEngine.isProcessing !== true &&
      speechEngine.isSpeaking !== true &&
      speechEngine.isSpeechPlaying !== true
    ) {
      if (++speechEngine.noSpeechRuns >= 3) {
        stopVoiceSession(
          speechEngine,
          '連續幾次沒有聽到聲音，即時對話已暫停。'
        );
        return;
      }
      setTimeout(() => {
        if (
          speechEngine.convoOn === true &&
          speechEngine.isListening !== true &&
          speechEngine.isSpeaking !== true &&
          speechEngine.isSpeechPlaying !== true &&
          speechEngine.isProcessing !== true
        ) {
          startListening(speechEngine);
        }
      }, 350);
    }
  };
  try {
    speechEngine.recognition.start();
  } catch (_error) {}
}

// speech.js | brain.js | skin.js
// TODO: onTap 留在這份檔案，畢竟有複雜交互的邏輯，但是內部的邏輯要再深入研究是否應該細部拆分出去
// onTap 內主要就呼叫那些被細拆的邏輯
function onTap(speechEngine) {
  if (speechEngine.onTapTimer === true) {
    return; // 去抖：hit 事件與 pointerdown 可能同時觸發
  }
  speechEngine.onTapTimer = true;
  setTimeout(() => {
    speechEngine.onTapTimer = false;
  }, 400);
  if (typeof speechEngine.skin.avatarModel === 'object' && speechEngine.skin.avatarModel !== null) {
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
      (typeof speechEngine.brain.mem.data.name === 'string' && speechEngine.brain.mem.data.name !== ''
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

function getGreetingText(speechEngine) {
  if (typeof speechEngine.greeting === 'function') {
    const text = speechEngine.greeting();
    if (typeof text === 'string' && text !== '') {
      return text;
    }
  }

  if (speechEngine.avatarMode === AVATAR_MODE_MAP.companion) {
    if (speechEngine.companionGreeting != null) {
      if (typeof speechEngine.companionGreeting === 'function') {
        const text = speechEngine.companionGreeting();
        if (typeof text === 'string' && text !== '') {
          return text;
        }
      } else {
        return speechEngine.companionGreeting;
      }
    }
    const name = speechEngine.brain?.mem?.data?.name || '';
    return (
      (name !== '' ? name + '～' : '你好～') + '想聊什麼都可以，點 💬 我們就開始！'
    );
  } else {
    if (speechEngine.assistantGreeting != null) {
      if (typeof speechEngine.assistantGreeting === 'function') {
        const text = speechEngine.assistantGreeting();
        if (typeof text === 'string' && text !== '') {
          return text;
        }
      } else {
        return speechEngine.assistantGreeting;
      }
    }
    return (
      speechEngine.brain?.KBM?.greeting ||
      '你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！'
    );
  }
}

function preloadTapGreeting(speechEngine) {
  if (speechEngine.neuralDisabled === true) {
    return Promise.resolve(null);
  }

  const text = getGreetingText(speechEngine);
  const key = speechEngine.neuralVoice + '\n' + text;

  if (
    speechEngine.tapGreetingPrep != null &&
    speechEngine.tapGreetingCacheKey === key
  ) {
    return speechEngine.tapGreetingPrep;
  }

  speechEngine.tapGreetingCacheKey = key;
  speechEngine.tapGreetingBuffer = null;
  speechEngine.tapGreetingPrep = fetchTTSBuffer(speechEngine, text, true)
    .then((buffer) => {
      if (speechEngine.tapGreetingCacheKey === key) {
        speechEngine.tapGreetingBuffer = buffer;
      }
      return buffer;
    })
    .catch((error) => {
      if (speechEngine.tapGreetingCacheKey === key) {
        speechEngine.tapGreetingPrep = null;
        speechEngine.tapGreetingBuffer = null;
      }
      throw error;
    });

  return speechEngine.tapGreetingPrep;
}

function localeLabel(locale) {
  return /^en/i.test(locale)
    ? 'EN'
    : /^ja/i.test(locale)
      ? '日'
      : /^ko/i.test(locale)
        ? '한'
        : '中';
}

function localeVoice(locale) {
  return /^en/i.test(locale)
    ? 'en-US-JennyNeural'
    : /^ja/i.test(locale)
      ? 'ja-JP-NanamiNeural'
      : /^ko/i.test(locale)
        ? 'ko-KR-SunHiNeural'
        : 'zh-TW-HsiaoChenNeural';
}

function setLocale(speechEngine, locale) {
  const matched =
    ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'].find(
      (loc) => loc.toLowerCase() === (locale || '').toLowerCase()
    ) || 'zh-TW';
  speechEngine.currentLocale = matched;
  // Note: Only fallback neural voice if the developer didn't set a hardcoded voice in config
  if (typeof speechEngine.config?.voice !== 'string' || speechEngine.config?.voice === '') {
    speechEngine.neuralVoice = localeVoice(matched);
  }

  if (typeof speechEngine.onLanguageChanged === 'function') {
    speechEngine.onLanguageChanged(matched, localeLabel(matched));
  }

  if (typeof speechEngine.recognition === 'object' && speechEngine.recognition !== null) {
    speechEngine.recognition.lang = matched;
  }

  loadVoice();
}
