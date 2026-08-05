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
