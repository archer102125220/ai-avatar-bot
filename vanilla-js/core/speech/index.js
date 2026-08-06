import { addChatMessage, handleAnswer } from '../brain.js';
import { continueToolConfirmation, continueToolChoice, continueToolInput, routeHostTool, offerToolChoices, prepareTool } from '../tools.js';
export const DEFAULT_TTS_ENDPOINT = 'api/tts';
export const DEFAULT_FEMALE_NEURAL_VOICE = 'zh-TW-HsiaoChenNeural'; // 微軟神經語音「曉臻」
export const DEFAULT_MALE_NEURAL_VOICE = 'zh-TW-YunJheNeural'; // 微軟神經語音「雲哲」

// speech.js
// ===== TTS：開口說話 + 對嘴 =====
export function loadVoice() {
  const voices = speechSynthesis.getVoices();
  const pick = (targetVoice) =>
    voices.find(
      (voice) =>
        targetVoice.test(`${voice.name} ${voice.lang}`) &&
        !/Google/i.test(voice.name)
    ); // 避開 Chrome 會靜默失敗的 Google 遠端語音

  return (
    pick(/(HsiaoChen|HsiaoYu|曉臻|曉雨).*zh/i) || // 微軟神經女聲（最自然，若有安裝）
    pick(/(Yating|Zhiwei).*zh[-_]TW/i) || // 較新、較不機械的微軟 zh-TW 女聲
    pick(/Microsoft.*zh[-_]TW/i) || // 任何微軟 zh-TW（本地、可靠）
    pick(/zh[-_]TW/i) ||
    pick(/^zh/i) ||
    voices.find((voice) => /zh/i.test(voice.lang)) ||
    null
  );
}

// speech.js
// edge-tts 神經語音：抓 /api/tts 的 MP3 → AudioBuffer（給佇列預抓用）
export async function fetchTTSBuffer(aiAvatarWidget = null, text) {
  const safeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (
    aiAvatarWidget.speechEngine.audioCtx instanceof safeAudioContext ===
    false
  ) {
    aiAvatarWidget.speechEngine.audioCtx = new safeAudioContext();
  }
  if (aiAvatarWidget.speechEngine.audioCtx.state === 'suspended') {
    try {
      await aiAvatarWidget.speechEngine.audioCtx.resume();
    } catch (_error) {}
  }
  const sep =
    aiAvatarWidget.speechEngine.ttsEndpoint.indexOf('?') < 0 ? '?' : '&';
  const response = await fetch(
    aiAvatarWidget.speechEngine.ttsEndpoint +
      sep +
      'voice=' +
      encodeURIComponent(aiAvatarWidget.speechEngine.neuralVoice) +
      '&text=' +
      encodeURIComponent(text)
  );
  if (!response.ok) {
    throw new Error('http ' + response.status);
  }
  const respArrayBuffer = await response.arrayBuffer();
  if (respArrayBuffer.byteLength < 800) {
    throw new Error('audio too small');
  }
  return aiAvatarWidget.speechEngine.audioCtx.decodeAudioData(respArrayBuffer);
}

// speech.js
export function prefetchSpeech(aiAvatarWidget = null, sid) {
  // 只預抓最前面 2 句（在途 ≤2），護後端限流
  if (
    sid !== aiAvatarWidget.speechEngine.speakSeq ||
    aiAvatarWidget.speechEngine.neuralDisabled
  ) {
    return;
  }
  for (const item of aiAvatarWidget.speechEngine.speechQ.slice(0, 2)) {
    if (!item.prep && !item.err) {
      item.prep = fetchTTSBuffer(aiAvatarWidget, item.text).catch((e) => {
        item.err = e;
        return null;
      });
    }
  }
}

// speech.js
// 播一句（Web Audio + AnalyserNode 以「實際音量」驅動嘴型），播完呼叫 done 換下一句
export function playBuffer(aiAvatarWidget = null, audioBuf, done) {
  const src = aiAvatarWidget.speechEngine.audioCtx.createBufferSource();
  src.buffer = audioBuf;
  const analyser = aiAvatarWidget.speechEngine.audioCtx.createAnalyser();
  analyser.fftSize = 256;
  src.connect(analyser);
  analyser.connect(aiAvatarWidget.speechEngine.audioCtx.destination);
  const data = new Uint8Array(analyser.fftSize);
  aiAvatarWidget.speechEngine.currentSource = src;
  aiAvatarWidget.speechEngine.useAudioMouth = true;
  aiAvatarWidget.speechEngine.isSpeaking = true;
  if (!aiAvatarWidget.speechEngine.tapDone) {
    aiAvatarWidget.speechEngine.tapDone = true;
    if (aiAvatarWidget.avatarModel) {
      try {
        aiAvatarWidget.avatarModel.motion('Tap');
      } catch (_error) {}
    }
  } // Tap 動作一段話只做一次
  function audioLoop() {
    if (aiAvatarWidget.speechEngine.currentSource !== src) {
      return; // 不是我在播了就停
    }
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    aiAvatarWidget.speechEngine.audioMouth = Math.min(
      1,
      Math.sqrt(sum / data.length) * 3.4
    ); // RMS 音量 → 開口
    aiAvatarWidget.speechEngine.currentFps = requestAnimationFrame(audioLoop);
  }
  aiAvatarWidget.speechEngine.currentFps = requestAnimationFrame(audioLoop);
  src.onended = () => {
    // 自然播完才收尾；被打斷時 onended 已被清掉
    if (aiAvatarWidget.speechEngine.currentSource !== src) {
      return;
    }
    if (
      typeof aiAvatarWidget.speechEngine.currentFps === 'number' &&
      aiAvatarWidget.speechEngine.currentFps > 0
    ) {
      cancelAnimationFrame(aiAvatarWidget.speechEngine.currentFps);
      aiAvatarWidget.speechEngine.currentFps = 0;
    }
    aiAvatarWidget.speechEngine.isSpeaking = false;
    aiAvatarWidget.speechEngine.useAudioMouth = false;
    aiAvatarWidget.speechEngine.audioMouth = 0;
    aiAvatarWidget.speechEngine.currentSource = null;
    done();
  };
  src.start(0);
}

// speech.js
// 整段文字 → 句子陣列（TTS 逐句抓、邊講邊抓下一句，長答案不用等整段）
export function splitSentences(text) {
  const out = [];
  let buf = '';
  for (const ch of String(text || '')) {
    buf += ch;
    if (/[。！？!?；;\n…]/.test(ch)) {
      if (buf.trim()) {
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
  if (buf.trim()) {
    out.push(buf.trim());
  }
  const merged = []; // 太短的碎句併進前一句（太短的 TTS 不自然、請求也多）
  for (const s of out) {
    if (
      merged.length &&
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
export function handleNeuralFail(aiAvatarWidget = null, e) {
  const msg = e?.message || '';
  if (/http 429/.test(msg)) {
    console.warn('TTS 被限流，這句退瀏覽器語音');
    return;
  } // 429 是暫時的，別鎖死神經語音
  if (/http 4\d\d|Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    aiAvatarWidget.speechEngine.neuralDisabled = true; // 結構性失敗(無後端/CORS/被擋)→不再試
  }
  console.warn('神經語音失敗，退回瀏覽器語音：', msg);
}

// speech.js
// 後備：瀏覽器內建語音(Yating) 逐句版。對嘴用「估時長」驅動，不靠 speechSynthesis.speaking 輪詢
// （Chrome 在 cancel 後常回報失準 → 第二次說話嘴巴就不動了）
export function speakBrowserChunk(aiAvatarWidget = null, text, sid, done) {
  if (
    aiAvatarWidget.speechEngine.ttsMuted === true ||
    'speechSynthesis' in window === false
  ) {
    done();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  if (
    typeof aiAvatarWidget.speechEngine.ttVoice !== 'object' ||
    aiAvatarWidget.speechEngine.ttVoice === null
  ) {
    aiAvatarWidget.speechEngine.ttVoice = loadVoice(aiAvatarWidget);
  }
  if (
    typeof aiAvatarWidget.speechEngine.ttVoice === 'object' &&
    aiAvatarWidget.speechEngine.ttVoice !== null
  ) {
    utterance.voice = aiAvatarWidget.speechEngine.ttVoice;
  }
  utterance.lang = aiAvatarWidget.speechEngine.ttVoice?.lang || 'zh-TW';
  utterance.rate = aiAvatarWidget.speechEngine.ttsRate || 1.0;
  utterance.pitch = 1.0;
  utterance.onboundary = () => {
    aiAvatarWidget.speechEngine.mouthTarget = 0.5 + Math.random() * 0.5;
  };
  let fin = false;
  const finish = () => {
    if (fin) {
      return;
    }
    fin = true;
    aiAvatarWidget.speechEngine.isSpeaking = false;
    done();
  };
  utterance.onend = finish;
  const estMs = Math.min(
    16000,
    Math.max(
      1200,
      (text.length * 130) / (aiAvatarWidget.speechEngine.ttsRate || 1)
    )
  );
  const fire = () => {
    if (sid !== aiAvatarWidget.speechEngine.speakSeq) {
      return; // 排隊期間被打斷就不講了
    }
    try {
      speechSynthesis.resume();
    } catch (_error) {} // 解 Chrome cancel 後卡住的 bug
    speechSynthesis.speak(utterance);
    aiAvatarWidget.speechEngine.isSpeaking = true;
    aiAvatarWidget.speechEngine.mouthTarget = 0.7;
    if (!aiAvatarWidget.speechEngine.tapDone) {
      aiAvatarWidget.speechEngine.tapDone = true;
      if (aiAvatarWidget.avatarModel) {
        try {
          aiAvatarWidget.avatarModel.motion('Tap');
        } catch (_error) {}
      }
    }
    clearTimeout(aiAvatarWidget.speechEngine.speakBrowserTimer);
    aiAvatarWidget.speechEngine.speakBrowserTimer = setTimeout(finish, estMs); // 保底：時間到閉嘴＋換下一句，不依賴事件
  };
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    setTimeout(fire, 120);
  } else {
    fire();
  }
}

export function initSpeechEngine(setting = {}, aiAvatarWidget) {
  const {
    ttsEndpoint,
    neuralVoice,
    // TODO: 帶 speak 與其他方法耦合拆解完後改為直接放到這份檔案中
    speak
  } = setting;

  const speechEngine = {
    avatarMode: '', // 不確定？

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
        return fetchTTSBuffer(...arguments);
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

    _isSpeaking: false,
    get isSpeaking() {
      return this._isSpeaking;
    },
    set isSpeaking(newIsSpeaking) {
      if (typeof newIsSpeaking === 'boolean' || newIsSpeaking === null) {
        this._isSpeaking = newIsSpeaking;
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

    isListening: false,

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
          this.onSpokenDisplayTextChange(newSpeakingLabel, aiAvatarWidget);
        }
      }
    },
    get speak() {
      return function _speak(text) {
        return speak(aiAvatarWidget, String(text || '').slice(0, 600));
      };
    },
    _spokenAudioText: '',
    get spokenAudioText() {
      return this._spokenAudioText;
    },
    set spokenAudioText(newSpeakingSounds) {
      if (typeof newSpeakingSounds === 'string' || newSpeakingSounds === null) {
        this._spokenAudioText = newSpeakingSounds;

        this.spokenDisplayText = newSpeakingSounds;
        if (typeof this.onSpeaking === 'function') {
          this.onSpeaking(newSpeakingSounds, aiAvatarWidget);
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
      return function (text, currentAiAvatar, ...args) {
        if (typeof setting.onSpeaking === 'function') {
          return setting.onSpeaking.call(
            currentAiAvatar,
            text,
            currentAiAvatar,
            ...args
          );
        }
      };
    },
    get onSpeakingEnd() {
      return function (text, currentAiAvatar, ...args) {
        if (typeof setting.onSpeakingEnd === 'function') {
          return setting.onSpeakingEnd.call(
            currentAiAvatar,
            text,
            currentAiAvatar,
            ...args
          );
        }
      };
    },
    get onSpokenDisplayTextChange() {
      return function _onSpokenDisplayTextChange(
        newSpeakingLabel,
        currentAiAvatar,
        ...args
      ) {
        clearTimeout(this.spokenDisplayTextTimer);
        this.spokenDisplayTextTimer = setTimeout(
          () => this.onSpokenDisplayTextTimeout(currentAiAvatar),
          6000
        );

        if (typeof setting.onSpokenDisplayTextChange === 'function') {
          return setting.onSpokenDisplayTextChange.call(
            currentAiAvatar,
            newSpeakingLabel,
            currentAiAvatar,
            ...args
          );
        }
      };
    },
    get onSpokenDisplayTextTimeout() {
      return function (currentAiAvatar, ...args) {
        if (typeof setting.onSpokenDisplayTextTimeout === 'function') {
          return setting.onSpokenDisplayTextTimeout.call(
            currentAiAvatar,
            ...args
          );
        }
      };
    },

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
    speechEngine.greeting = setting.greeting.bind(aiAvatarWidget);
  }
  if (typeof setting.companionGreeting === 'function') {
    speechEngine.companionGreeting =
      setting.companionGreeting.bind(aiAvatarWidget);
  } else if (typeof setting.companionGreeting === 'string') {
    speechEngine.companionGreeting = setting.companionGreeting;
  }
  if (typeof setting.assistantGreeting === 'function') {
    speechEngine.assistantGreeting =
      setting.assistantGreeting.bind(aiAvatarWidget);
  } else if (typeof setting.assistantGreeting === 'string') {
    speechEngine.assistantGreeting = setting.assistantGreeting;
  }

  // speech.js
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => {
      speechEngine.ttVoice = loadVoice(aiAvatarWidget);
    };
    speechEngine.ttVoice = loadVoice(aiAvatarWidget);
  }

  return speechEngine;
}

// ================== EXTRACTED FROM index.js ==================
export function computeMouth(aiAvatarWidget = null) {
  if (
    aiAvatarWidget.speechEngine.isSpeaking &&
    aiAvatarWidget.speechEngine.useAudioMouth
  ) {
    aiAvatarWidget.speechEngine.mouthValue +=
      (aiAvatarWidget.speechEngine.audioMouth -
        aiAvatarWidget.speechEngine.mouthValue) *
      0.5; // 神經語音：跟真實音量精準對嘴
  } else if (aiAvatarWidget.speechEngine.isSpeaking) {
    const t = performance.now() / 1000;
    aiAvatarWidget.speechEngine.mouthValue =
      0.12 +
      0.83 *
        aiAvatarWidget.speechEngine.mouthTarget *
        Math.abs(Math.sin(t * 9)); // 瀏覽器語音：假開合
  } else {
    aiAvatarWidget.speechEngine.mouthValue = Math.max(
      0,
      aiAvatarWidget.speechEngine.mouthValue - 0.18
    );
  }
  return aiAvatarWidget.speechEngine.mouthValue;
}

// speech.js
// 串流版切句：state.buf 累積 token，切得出完整句就吐出（force＝收尾把殘句也吐）
export function drainSentences(state, force) {
  const out = [];
  let i;
  while ((i = state.buf.search(/[。！？!?；;\n…]/)) >= 0) {
    const s = state.buf.slice(0, i + 1).trim();
    state.buf = state.buf.slice(i + 1);
    if (s) {
      out.push(s);
    }
  }
  if (force && state.buf.trim()) {
    out.push(state.buf.trim());
    state.buf = '';
  }
  return out;
}

// speech.js | brain.js


// speech.js
// 中止目前正在講的（逐句佇列 + 神經語音音檔 + 瀏覽器 TTS + 對嘴），給「點第二下打斷第一下」用
export function stopSpeaking(aiAvatarWidget = null) {
  aiAvatarWidget.speechEngine.speakSeq++; // 作廢所有在跑的逐句鏈（pump 看序號就會停）
  aiAvatarWidget.speechEngine.speechQ = [];
  aiAvatarWidget.speechEngine.speechEnded = true;
  aiAvatarWidget.speechEngine.isSpeechPlaying = false;
  try {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  } catch (_error) {}
  try {
    clearTimeout(aiAvatarWidget.speechEngine.speakBrowserTimer);
  } catch (_error) {}
  if (
    typeof aiAvatarWidget.speechEngine.currentFps === 'number' &&
    aiAvatarWidget.speechEngine.currentFps > 0
  ) {
    cancelAnimationFrame(aiAvatarWidget.speechEngine.currentFps);
    aiAvatarWidget.speechEngine.currentFps = 0;
  }
  if (aiAvatarWidget.speechEngine.currentSource) {
    try {
      aiAvatarWidget.speechEngine.currentSource.onended = null;
      aiAvatarWidget.speechEngine.currentSource.stop();
    } catch (_error) {}
    aiAvatarWidget.speechEngine.currentSource = null;
  }
  aiAvatarWidget.speechEngine.isSpeaking = false;
  aiAvatarWidget.speechEngine.useAudioMouth = false;
  aiAvatarWidget.speechEngine.audioMouth = 0;

  aiAvatarWidget.skinEngine.gestureName = 'neutral';
}

// speech.js
// 對外入口：整段文字 → 切句進逐句佇列（②講第 1 句時預抓第 2 句 → 長答案幾乎立刻開口）
export function speak(aiAvatarWidget = null, text, options) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar speak] aiAvatarWidget.container is not an HTMLElement'
    );
    return;
  }

  if (aiAvatarWidget.speechEngine.ttsMuted === true) {
    onUtteranceEnd(aiAvatarWidget); // 靜音：沒語音可收尾，直接觸發對話迴圈 hook
    return;
  }

  aiAvatarWidget.speechEngine.spokenDisplayText = text;
  const sid = beginSpeech(aiAvatarWidget);
  aiAvatarWidget.setEmotionFromText(text); // ①講話帶情緒（3D 表情；要在 beginSpeech 之後，不然被 reset）
  for (const sentences of splitSentences(text)) {
    pushSpeech(aiAvatarWidget, sid, sentences, options);
  }
  endSpeech(aiAvatarWidget, sid);
}

// speech.js
// ===== ②逐句開講引擎：一次一個 session；句子依序講，神經語音在背景先抓下一句 =====
export function beginSpeech(aiAvatarWidget = null) {
  stopSpeaking(aiAvatarWidget); // 打斷上一段（含清佇列、表情回中性）
  aiAvatarWidget.speechEngine.assistantSpeechStartedAt = performance.now();
  if (aiAvatarWidget.speechEngine.convoOn) {
    aiAvatarWidget.uiDom.updateVoiceStatus(
      aiAvatarWidget.speechEngine.convoOn,
      '正在回答，可以直接插話…',
      'speaking',
      0
    );
  }
  aiAvatarWidget.speechEngine.speechQ = [];
  aiAvatarWidget.speechEngine.speechEnded = false;
  aiAvatarWidget.speechEngine.isSpeechPlaying = false;
  aiAvatarWidget.speechEngine.tapDone = false;
  return ++aiAvatarWidget.speechEngine.speakSeq;
}
// speech.js
export function pushSpeech(aiAvatarWidget = null, sid, text, options) {
  if (sid !== aiAvatarWidget.speechEngine.speakSeq) {
    return;
  }
  const safeText = String(text || '').trim();
  if (!safeText) {
    return;
  }
  aiAvatarWidget.speechEngine.speechQ.push({
    text: safeText,
    prep: null,
    err: null,
    instant: !!(options && options.instant)
  });
  prefetchSpeech(aiAvatarWidget, sid);
  pumpSpeech(aiAvatarWidget, sid);
}
// speech.js
export function endSpeech(aiAvatarWidget = null, sid) {
  if (sid === aiAvatarWidget.speechEngine.speakSeq) {
    aiAvatarWidget.speechEngine.speechEnded = true;
    // aiAvatarWidget.speechEngine.spokenDisplayText = "";
    aiAvatarWidget.skinEngine.emo.target = 0;
    pumpSpeech(aiAvatarWidget, sid);
  }
}

// speech.js
export function onUtteranceEnd(aiAvatarWidget = null) {
  aiAvatarWidget.speechEngine.isProcessing = false;
  if (
    aiAvatarWidget.speechEngine.convoOn === true &&
    aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion
  ) {
    aiAvatarWidget.uiDom.updateVoiceStatus(
      aiAvatarWidget.speechEngine.convoOn,
      '準備繼續聆聽…',
      'thinking',
      0
    );
    setTimeout(() => {
      if (
        aiAvatarWidget.speechEngine.convoOn === true &&
        aiAvatarWidget.speechEngine.isListening === false &&
        aiAvatarWidget.speechEngine.isSpeaking === false &&
        aiAvatarWidget.speechEngine.isSpeechPlaying === false
      ) {
        aiAvatarWidget.speechEngine.noSpeechRuns = 0;
        startListening(aiAvatarWidget);
      }
    }, 450);
  } else {
    stopVoiceSession(aiAvatarWidget);
  }
}

// ui.js
// 範例提示清單：一進站就告訴使用者「可以說什麼」，點任一項＝直接問（語音/打字都不用先猜）


// ui.js
// 打字輸入：Enter 或 ➤ 送出。組字中（注音/拼音選字）按的 Enter 不送，避免誤發半成品


// speech.js
export async function pumpSpeech(aiAvatarWidget = null, sid) {
  if (
    aiAvatarWidget.speechEngine.isSpeechPlaying ||
    sid !== aiAvatarWidget.speechEngine.speakSeq
  ) {
    return;
  }
  const item = aiAvatarWidget.speechEngine.speechQ.shift();
  if (!item) {
    if (aiAvatarWidget.speechEngine.speechEnded) {
      aiAvatarWidget.skinEngine.gestureName = 'neutral';
      onUtteranceEnd(aiAvatarWidget);
    }
    return;
  } // 整段講完 → 表情回中性＋(陪伴)重開麥
  aiAvatarWidget.speechEngine.isSpeechPlaying = true;
  const done = () => {
    if (sid !== aiAvatarWidget.speechEngine.speakSeq) {
      return;
    }
    aiAvatarWidget.speechEngine.isSpeechPlaying = false;
    prefetchSpeech(aiAvatarWidget, sid);
    pumpSpeech(aiAvatarWidget, sid);
  };

  if (
    item.instant &&
    item.text === getGreetingText(aiAvatarWidget) &&
    !aiAvatarWidget.speechEngine.tapGreetingBuffer
  ) {
    preloadTapGreeting(aiAvatarWidget);
    speakBrowserChunk(aiAvatarWidget, item.text, sid, done);
    return;
  }

  let buf = null;
  if (!aiAvatarWidget.speechEngine.neuralDisabled && !item.err) {
    if (!item.prep) {
      item.prep = fetchTTSBuffer(aiAvatarWidget, item.text).catch((e) => {
        item.err = e;
        return null;
      });
    }
    buf = await item.prep;
  }
  if (sid !== aiAvatarWidget.speechEngine.speakSeq) {
    return; // 等音檔期間被新的說話打斷 → 整條放棄
  }
  if (buf) {
    prefetchSpeech(aiAvatarWidget, sid);
    playBuffer(aiAvatarWidget, buf, done);
  } else {
    if (item.err) {
      handleNeuralFail(aiAvatarWidget, item.err);
    }
    speakBrowserChunk(aiAvatarWidget, item.text, sid, done);
  }
}

// brain.js | speech.js


// speech.js | brain.js
export async function handleUser(aiAvatarWidget = null, text = '') {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error('[aiAvatar handleUser] rootContainer is not an HTMLElement');
    return;
  }

  if (typeof text === 'string' && text !== '') {
    addChatMessage(aiAvatarWidget, 'user', text);
    aiAvatarWidget.speechEngine.spokenDisplayText = '你：' + text;
  }

  if (
    text &&
    aiAvatarWidget.brainEngine.pendingToolConfirmation &&
    continueToolConfirmation(aiAvatarWidget, text)
  )
    return;
  if (
    text &&
    aiAvatarWidget.brainEngine.pendingToolChoice &&
    continueToolChoice(aiAvatarWidget, text)
  )
    return;
  if (
    text &&
    aiAvatarWidget.brainEngine.pendingToolInput &&
    continueToolInput(aiAvatarWidget, text)
  )
    return;

  if (aiAvatarWidget.brainEngine.mem.isCompanion && text) {
    if (/忘記我|清除記憶|forget me/i.test(text)) {
      aiAvatarWidget.brainEngine.mem.wipe();
      aiAvatarWidget.speechEngine.spokenAudioText =
        '好，我把記憶都清掉了，我們重新認識吧！';
      return;
    }
    aiAvatarWidget.brainEngine.mem.captureName(text);
    aiAvatarWidget.brainEngine.mem.addTurn('user', text);
  }

  const routedTool = routeHostTool(aiAvatarWidget, text);
  if (routedTool.ambiguous && routedTool.ambiguous.length) {
    aiAvatarWidget.speechEngine.isProcessing = false;
    offerToolChoices(aiAvatarWidget, text, routedTool.ambiguous);
    return;
  }
  if (routedTool.match) {
    aiAvatarWidget.speechEngine.isProcessing = false;
    prepareTool(
      aiAvatarWidget,
      routedTool.match.tool,
      text,
      { confidence: routedTool.match.score, reason: routedTool.match.reason },
      {}
    );
    return;
  }

  // aiAvatarWidget.speechEngine.isSpeaking = true;
  aiAvatarWidget.speechEngine.isProcessing = true; // 回答完成前不要自動重開麥（onUtteranceEnd 會清）

  if (
    aiAvatarWidget.skinEngine &&
    aiAvatarWidget.skinEngine.gestureName !== undefined
  ) {
    aiAvatarWidget.skinEngine.gestureName = 'thinking';
  }

  handleAnswer(aiAvatarWidget, text);
}

export async function ensureMicMonitor(aiAvatarWidget) {
  if (aiAvatarWidget.speechEngine.micStream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    throw new Error('media-not-supported');

  aiAvatarWidget.speechEngine.micStream =
    await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  aiAvatarWidget.speechEngine.micAudioCtx = new (
    window.AudioContext || window.webkitAudioContext
  )();
  if (aiAvatarWidget.speechEngine.micAudioCtx.state === 'suspended') {
    try {
      await aiAvatarWidget.speechEngine.micAudioCtx.resume();
    } catch (_e) {}
  }

  aiAvatarWidget.speechEngine.micAnalyser =
    aiAvatarWidget.speechEngine.micAudioCtx.createAnalyser();
  aiAvatarWidget.speechEngine.micAnalyser.fftSize = 256;
  aiAvatarWidget.speechEngine.micAnalyser.smoothingTimeConstant = 0.35;
  aiAvatarWidget.speechEngine.micAudioCtx
    .createMediaStreamSource(aiAvatarWidget.speechEngine.micStream)
    .connect(aiAvatarWidget.speechEngine.micAnalyser);
  aiAvatarWidget.speechEngine.micData = new Uint8Array(
    aiAvatarWidget.speechEngine.micAnalyser.fftSize
  );

  aiAvatarWidget.speechEngine.micNoiseFloor = 0;
  aiAvatarWidget.speechEngine.voiceFrames = 0;
  aiAvatarWidget.speechEngine.lastBargeIn = 0;

  monitorMicLevel(aiAvatarWidget);
}

export function monitorMicLevel(aiAvatarWidget) {
  if (
    !aiAvatarWidget.speechEngine.micAnalyser ||
    !aiAvatarWidget.speechEngine.micData
  ) {
    return;
  }
  aiAvatarWidget.speechEngine.micAnalyser.getByteTimeDomainData(
    aiAvatarWidget.speechEngine.micData
  );
  let sum = 0;
  for (let i = 0; i < aiAvatarWidget.speechEngine.micData.length; i++) {
    const value = (aiAvatarWidget.speechEngine.micData[i] - 128) / 128;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / aiAvatarWidget.speechEngine.micData.length);

  const isSpeaking =
    aiAvatarWidget.speechEngine.isSpeaking ||
    aiAvatarWidget.speechEngine.isSpeechPlaying;
  const isListening = aiAvatarWidget.speechEngine.isListening;
  const assistantActive =
    isSpeaking || aiAvatarWidget.speechEngine.isProcessing;

  if (!assistantActive && !isListening) {
    aiAvatarWidget.speechEngine.micNoiseFloor =
      aiAvatarWidget.speechEngine.micNoiseFloor * 0.96 + rms * 0.04;
  }

  const showVoiceUI =
    aiAvatarWidget.speechEngine.convoOn || isListening || assistantActive;

  aiAvatarWidget.uiDom.updateVoiceStatus(
    showVoiceUI,
    aiAvatarWidget.uiDom.voiceStatusEl?.textContent,
    isListening ? 'listening' : isSpeaking ? 'speaking' : 'thinking',
    rms * 650
  );

  const threshold = Math.max(
    0.085,
    aiAvatarWidget.speechEngine.micNoiseFloor * 5.5
  );
  const speechDuration =
    performance.now() -
    (aiAvatarWidget.speechEngine.assistantSpeechStartedAt || performance.now());

  if (
    aiAvatarWidget.speechEngine.convoOn &&
    assistantActive &&
    speechDuration > 550 &&
    rms > threshold
  ) {
    aiAvatarWidget.speechEngine.voiceFrames++;
  } else {
    aiAvatarWidget.speechEngine.voiceFrames = Math.max(
      0,
      (aiAvatarWidget.speechEngine.voiceFrames || 0) - 2
    );
  }

  if (
    aiAvatarWidget.speechEngine.voiceFrames >= 9 &&
    performance.now() - aiAvatarWidget.speechEngine.lastBargeIn > 1400
  ) {
    interruptForVoice(aiAvatarWidget);
  }

  aiAvatarWidget.speechEngine.micRaf = requestAnimationFrame(() =>
    monitorMicLevel(aiAvatarWidget)
  );
}

export function stopMicMonitor(aiAvatarWidget) {
  if (aiAvatarWidget.speechEngine.micRaf)
    cancelAnimationFrame(aiAvatarWidget.speechEngine.micRaf);
  aiAvatarWidget.speechEngine.micRaf = 0;

  if (aiAvatarWidget.speechEngine.micStream) {
    aiAvatarWidget.speechEngine.micStream
      .getTracks()
      .forEach((track) => track.stop());
  }
  aiAvatarWidget.speechEngine.micStream = null;
  aiAvatarWidget.speechEngine.micAnalyser = null;
  aiAvatarWidget.speechEngine.micData = null;

  if (aiAvatarWidget.speechEngine.micAudioCtx) {
    try {
      aiAvatarWidget.speechEngine.micAudioCtx.close();
    } catch (_e) {}
  }
  aiAvatarWidget.speechEngine.micAudioCtx = null;
  if (aiAvatarWidget.uiDom.voiceLevelEl)
    aiAvatarWidget.uiDom.voiceLevelEl.style.width = '0';
}

export function stopVoiceSession(aiAvatarWidget, message) {
  aiAvatarWidget.speechEngine.convoOn = false;
  clearTimeout(aiAvatarWidget.speechEngine.recognitionSilenceTimer);
  aiAvatarWidget.speechEngine.recognitionText = '';
  aiAvatarWidget.speechEngine.recognitionSubmitted = true;
  aiAvatarWidget.speechEngine.recognitionError = 'aborted';
  try {
    if (typeof aiAvatarWidget.speechEngine?.recognition?.abort === 'function') {
      aiAvatarWidget.speechEngine.recognition.abort();
    }
  } catch (_error) {}
  aiAvatarWidget.speechEngine.recognition = null;
  aiAvatarWidget.speechEngine.isListening = false;
  aiAvatarWidget.speechEngine.isProcessing = false;
  stopSpeaking(aiAvatarWidget);
  setMic(aiAvatarWidget, false);
  stopMicMonitor(aiAvatarWidget);

  aiAvatarWidget.uiDom.updateVoiceStatus(false, '', '', 0);
  if (message) {
    aiAvatarWidget.speechEngine.spokenDisplayText = message;
  }
}

export function interruptForVoice(aiAvatarWidget) {
  aiAvatarWidget.speechEngine.lastBargeIn = performance.now();
  aiAvatarWidget.speechEngine.voiceFrames = 0;

  aiAvatarWidget.speechEngine.speakSeq++;
  if (
    typeof aiAvatarWidget.brainEngine?.llm?.controller?.abort === 'function'
  ) {
    try {
      aiAvatarWidget.brainEngine.llm.controller.abort();
    } catch (_error) {}
  }

  stopSpeaking(aiAvatarWidget);
  aiAvatarWidget.speechEngine.isProcessing = false;

  aiAvatarWidget.uiDom.updateVoiceStatus(
    aiAvatarWidget.speechEngine.convoOn,
    '已停止回答，請繼續說…',
    'listening',
    0
  );

  setTimeout(() => {
    if (
      aiAvatarWidget.speechEngine.convoOn &&
      !aiAvatarWidget.speechEngine.isListening
    ) {
      startListening(aiAvatarWidget);
    }
  }, 100);
}

// ===== STT：聽你說話 =====
export function setMic(aiAvatarWidget = null, isListening = false) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error('[aiAvatar setMic] rootContainer is not an HTMLElement');
    return;
  }

  const btnMic = aiAvatarWidget.uiDom.micButtonEl;
  if (isListening === true) {
    btnMic.setAttribute('css-state', 'listening');
  } else {
    btnMic.removeAttribute('css-state');
  }

  const convoOn = aiAvatarWidget.speechEngine.convoOn;
  btnMic.setAttribute('aria-pressed', String(!!convoOn));

  btnMic.textContent =
    isListening === true
      ? aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion
        ? '● 對話中'
        : '● 聆聽中'
      : convoOn
        ? '◌ 對話中'
        : '🎙️ 即時';

  const suggestions = aiAvatarWidget.uiDom.suggestionsEl;
  if (suggestions instanceof HTMLElement) {
    suggestions.style.display = isListening || convoOn ? 'none' : 'flex';
  } // 聆聽中收起清單
}

// speech.js | brain.js
export async function startListening(aiAvatarWidget = null) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar startListening] rootContainer is not an HTMLElement'
    );
    return;
  }

  const SafeSpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SafeSpeechRecognition) {
    aiAvatarWidget.speechEngine.spokenAudioText =
      '你的瀏覽器不支援語音辨識，建議用 Chrome 開喔。';
    aiAvatarWidget.speechEngine.convoOn = false;
    return;
  }
  if (
    aiAvatarWidget.speechEngine.isListening &&
    aiAvatarWidget.speechEngine.recognition
  ) {
    aiAvatarWidget.speechEngine.recognition.stop();
    return;
  }

  if (!aiAvatarWidget.speechEngine.micStream) {
    setMic(aiAvatarWidget, false);
    aiAvatarWidget.uiDom.updateVoiceStatus(
      true,
      '正在取得麥克風權限…',
      'thinking',
      0
    );
  }
  try {
    await ensureMicMonitor(aiAvatarWidget);
    if (
      aiAvatarWidget.speechEngine.isSpeechPlaying ||
      aiAvatarWidget.speechEngine.isProcessing
    ) {
      stopSpeaking(aiAvatarWidget);
    }
  } catch (e) {
    aiAvatarWidget.speechEngine.convoOn = false;
    setMic(aiAvatarWidget, false);
    const message = '無法啟動語音功能，請檢查麥克風與瀏覽器設定。';
    aiAvatarWidget.speechEngine.spokenAudioText = message;
    aiAvatarWidget.uiDom.updateVoiceStatus(true, message, '', 0);
    console.warn('mic monitor error', e);
    return;
  }

  try {
    aiAvatarWidget.speechEngine.recognition = new SafeSpeechRecognition();
  } catch (error) {
    aiAvatarWidget.speechEngine.spokenAudioText =
      '語音辨識啟動失敗：' + error.message;
    aiAvatarWidget.speechEngine.convoOn = false;
    return;
  }

  aiAvatarWidget.speechEngine.recognitionSilenceTimer = null;
  aiAvatarWidget.speechEngine.recognition.lang = 'zh-TW';
  aiAvatarWidget.speechEngine.recognition.interimResults = true;
  aiAvatarWidget.speechEngine.recognition.continuous = true;
  aiAvatarWidget.speechEngine.recognition.maxAlternatives = 1;
  aiAvatarWidget.speechEngine.recognition.onstart = () => {
    aiAvatarWidget.speechEngine.isListening = true;
    setMic(aiAvatarWidget, true);
    aiAvatarWidget.uiDom.updateVoiceStatus(
      true,
      '請說話，可以隨時插話…',
      'listening',
      0
    );
  };
  aiAvatarWidget.speechEngine.recognition.onresult = (event) => {
    let finalText = '',
      interimText = '';
    for (const result of event.results) {
      if (result.isFinal) finalText += result[0].transcript + ' ';
      else interimText += result[0].transcript + ' ';
    }
    const txt = (finalText + interimText).trim();
    if (!txt) return;

    aiAvatarWidget.speechEngine.noSpeechRuns = 0;
    aiAvatarWidget.speechEngine.spokenDisplayText =
      '你：' + txt + (interimText ? '…' : '');
    aiAvatarWidget.uiDom.updateVoiceStatus(
      aiAvatarWidget.speechEngine.convoOn,
      interimText ? '正在辨識：' + txt : '收到語音，準備送出…',
      'listening',
      0
    );

    clearTimeout(aiAvatarWidget.speechEngine.recognitionSilenceTimer);
    aiAvatarWidget.speechEngine.recognitionSilenceTimer = setTimeout(
      () => {
        try {
          if (aiAvatarWidget.speechEngine.recognition)
            aiAvatarWidget.speechEngine.recognition.stop();
        } catch (_error) {}
      },
      interimText ? 900 : 420
    );

    const last = event.results[event.results.length - 1];
    if (last.isFinal) {
      handleUser(aiAvatarWidget, txt);
    }
  };
  aiAvatarWidget.speechEngine.recognition.onerror = (event) => {
    aiAvatarWidget.speechEngine.isListening = false;
    setMic(aiAvatarWidget, false);
    if (event.error === 'not-allowed') {
      aiAvatarWidget.speechEngine.convoOn = false;
      aiAvatarWidget.speechEngine.spokenDisplayText =
        '我需要麥克風權限才能聽你說話喔。';
      stopMicMonitor(aiAvatarWidget);
      aiAvatarWidget.uiDom.updateVoiceStatus(true, '麥克風權限被拒絕', '', 0);
      return;
    }
    if (event.error === 'aborted') {
      return; // 手動中止不需顯示錯誤，保留 stopVoiceSession 寫入的文字
    }
    if (
      aiAvatarWidget.speechEngine.convoOn === true &&
      event.error === 'no-speech'
    ) {
      return; // 交給 onend 的續聽邏輯
    }

    aiAvatarWidget.speechEngine.spokenDisplayText =
      '沒聽清楚（' + event.error + '），再試一次。';
  };
  aiAvatarWidget.speechEngine.recognition.onend = () => {
    aiAvatarWidget.speechEngine.isListening = false;
    setMic(aiAvatarWidget, false);
    // 連續對話：靜默結束（沒觸發回答）→ 自動再聽；連 3 次沒聲音就休息，避免無限開麥
    if (
      aiAvatarWidget.speechEngine.convoOn === true &&
      !aiAvatarWidget.speechEngine.isProcessing &&
      !aiAvatarWidget.speechEngine.isSpeaking &&
      !aiAvatarWidget.speechEngine.isSpeechPlaying
    ) {
      if (++aiAvatarWidget.speechEngine.noSpeechRuns >= 3) {
        stopVoiceSession(
          aiAvatarWidget,
          '連續幾次沒有聽到聲音，即時對話已暫停。'
        );
        return;
      }
      setTimeout(() => {
        if (
          aiAvatarWidget.speechEngine.convoOn === true &&
          !aiAvatarWidget.speechEngine.isListening &&
          !aiAvatarWidget.speechEngine.isSpeaking &&
          !aiAvatarWidget.speechEngine.isSpeechPlaying &&
          !aiAvatarWidget.speechEngine.isProcessing
        ) {
          startListening(aiAvatarWidget);
        }
      }, 350);
    }
  };
  try {
    aiAvatarWidget.speechEngine.recognition.start();
  } catch (_error) {}
}

// speech.js | brain.js | skin.js
// TODO: onTap 留在這份檔案，畢竟有複雜交互的邏輯，但是內部的邏輯要再深入研究是否應該細部拆分出去
// onTap 內主要就呼叫那些被細拆的邏輯
export function onTap(aiAvatarWidget = null) {
  if (
    typeof aiAvatarWidget !== 'object' ||
    aiAvatarWidget === null ||
    aiAvatarWidget?.uiDom?.onTapTimer === true
  ) {
    return; // 去抖：hit 事件與 pointerdown 可能同時觸發
  }
  if (aiAvatarWidget.uiDom) aiAvatarWidget.uiDom.onTapTimer = true;
  setTimeout(() => {
    if (aiAvatarWidget.uiDom) aiAvatarWidget.uiDom.onTapTimer = false;
  }, 400);
  if (aiAvatarWidget.skinEngine.avatarModel) {
    try {
      aiAvatarWidget.skinEngine.avatarModel.motion('Tap');
    } catch (_error) {}
  }

  let greeting = '你好～';

  if (typeof aiAvatarWidget.speechEngine.greeting === 'function') {
    greeting = aiAvatarWidget.speechEngine.greeting(
      {
        isCompanion: aiAvatarWidget.brainEngine.mem.isCompanion,
        visits: aiAvatarWidget.brainEngine.mem.data.visits,
        name: aiAvatarWidget.brainEngine.mem.data.name
      },
      aiAvatarWidget
    );
  } else if (typeof aiAvatarWidget.speechEngine.greeting === 'string') {
    greeting = aiAvatarWidget.speechEngine.greeting;
  } else if (aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion) {
    greeting =
      (aiAvatarWidget.brainEngine.mem.data.name
        ? aiAvatarWidget.brainEngine.mem.data.name + '～'
        : '你好～') + '想聊什麼都可以，點 💬 我們就開始！';

    if (typeof aiAvatarWidget.speechEngine.companionGreeting === 'function') {
      greeting = aiAvatarWidget.speechEngine.companionGreeting(
        {
          isCompanion: aiAvatarWidget.brainEngine.mem.isCompanion,
          visits: aiAvatarWidget.brainEngine.mem.data.visits,
          name: aiAvatarWidget.brainEngine.mem.data.name
        },
        aiAvatarWidget
      );
    } else if (
      typeof aiAvatarWidget.speechEngine.companionGreeting === 'string'
    ) {
      greeting = aiAvatarWidget.speechEngine.companionGreeting;
    }
  } else if (aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.assistant) {
    greeting =
      '你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！';

    if (typeof aiAvatarWidget.speechEngine.assistantGreeting === 'function') {
      greeting = aiAvatarWidget.speechEngine.assistantGreeting(
        {
          isCompanion: aiAvatarWidget.brainEngine.mem.isCompanion,
          visits: aiAvatarWidget.brainEngine.mem.data.visits,
          name: aiAvatarWidget.brainEngine.mem.data.name
        },
        aiAvatarWidget
      );
    } else if (
      typeof aiAvatarWidget.speechEngine.assistantGreeting === 'string'
    ) {
      greeting = aiAvatarWidget.speechEngine.assistantGreeting;
    }
  }

  aiAvatarWidget.speechEngine.spokenAudioText = greeting;
}

export function getGreetingText(aiAvatarWidget) {
  if (aiAvatarWidget.speechEngine.greeting) {
    const text = aiAvatarWidget.speechEngine.greeting(aiAvatarWidget);
    if (text) return text;
  }

  if (aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion) {
    if (aiAvatarWidget.speechEngine.companionGreeting) {
      if (typeof aiAvatarWidget.speechEngine.companionGreeting === 'function') {
        const text =
          aiAvatarWidget.speechEngine.companionGreeting(aiAvatarWidget);
        if (text) return text;
      } else {
        return aiAvatarWidget.speechEngine.companionGreeting;
      }
    }
    const name = aiAvatarWidget.brainEngine?.mem?.data?.name || '';
    return (
      (name ? name + '～' : '你好～') + '想聊什麼都可以，點 💬 我們就開始！'
    );
  } else {
    if (aiAvatarWidget.speechEngine.assistantGreeting) {
      if (typeof aiAvatarWidget.speechEngine.assistantGreeting === 'function') {
        const text =
          aiAvatarWidget.speechEngine.assistantGreeting(aiAvatarWidget);
        if (text) return text;
      } else {
        return aiAvatarWidget.speechEngine.assistantGreeting;
      }
    }
    return (
      aiAvatarWidget.brainEngine?.KBM?.greeting ||
      '你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！'
    );
  }
}

export function preloadTapGreeting(aiAvatarWidget) {
  if (aiAvatarWidget.speechEngine.neuralDisabled) return Promise.resolve(null);

  const text = getGreetingText(aiAvatarWidget);
  const key = aiAvatarWidget.speechEngine.neuralVoice + '\n' + text;

  if (
    aiAvatarWidget.speechEngine.tapGreetingPrep &&
    aiAvatarWidget.speechEngine.tapGreetingCacheKey === key
  ) {
    return aiAvatarWidget.speechEngine.tapGreetingPrep;
  }

  aiAvatarWidget.speechEngine.tapGreetingCacheKey = key;
  aiAvatarWidget.speechEngine.tapGreetingBuffer = null;
  aiAvatarWidget.speechEngine.tapGreetingPrep = fetchTTSBuffer(
    aiAvatarWidget,
    text,
    true
  )
    .then((buffer) => {
      if (aiAvatarWidget.speechEngine.tapGreetingCacheKey === key) {
        aiAvatarWidget.speechEngine.tapGreetingBuffer = buffer;
      }
      return buffer;
    })
    .catch((error) => {
      if (aiAvatarWidget.speechEngine.tapGreetingCacheKey === key) {
        aiAvatarWidget.speechEngine.tapGreetingPrep = null;
        aiAvatarWidget.speechEngine.tapGreetingBuffer = null;
      }
      throw error;
    });

  return aiAvatarWidget.speechEngine.tapGreetingPrep;
}

export function localeLabel(locale) {
  return /^en/i.test(locale)
    ? 'EN'
    : /^ja/i.test(locale)
      ? '日'
      : /^ko/i.test(locale)
        ? '한'
        : '中';
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

export function setLocale(aiAvatarWidget, locale) {
  const matched =
    ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'].find(
      (l) => l.toLowerCase() === (locale || '').toLowerCase()
    ) || 'zh-TW';
  aiAvatarWidget.speechEngine.currentLocale = matched;
  // Note: Only fallback neural voice if the developer didn't set a hardcoded voice in config
  if (!aiAvatarWidget.config?.voice) {
    aiAvatarWidget.speechEngine.neuralVoice = localeVoice(matched);
  }

  if (aiAvatarWidget.uiDom.langButtonEl) {
    aiAvatarWidget.uiDom.langButtonEl.textContent = localeLabel(matched);
  }

  if (aiAvatarWidget.speechEngine.recognition) {
    aiAvatarWidget.speechEngine.recognition.lang = matched;
  }

  loadVoice(aiAvatarWidget);
}
