import { GENDER_MAP, AVATAR_MODE_MAP } from '../constants';

export function loadVoice(gender) {
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

// edge-tts 神經語音：抓 /api/tts 的 MP3 → AudioBuffer（給佇列預抓用）
export async function fetchTTSBuffer(speechEngine, text, isGreeting = false) {
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

export function prefetchSpeech(speechEngine, sid) {
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

// 播一句（Web Audio + AnalyserNode 以「實際音量」驅動嘴型），播完呼叫 done 換下一句
export function playBuffer(speechEngine, audioBuf, done) {
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

// 整段文字 → 句子陣列（TTS 逐句抓、邊講邊抓下一句，長答案不用等整段）
export function splitSentences(text) {
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

export function handleNeuralFail(speechEngine, e) {
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

// 後備：瀏覽器內建語音(Yating) 逐句版。對嘴用「估時長」驅動，不靠 speechSynthesis.speaking 輪詢
// （Chrome 在 cancel 後常回報失準 → 第二次說話嘴巴就不動了）
export function speakBrowserChunk(speechEngine, text, sid, done) {
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

export function computeMouth(speechEngine) {
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

// 串流版切句：state.buf 累積 token，切得出完整句就吐出（force＝收尾把殘句也吐）
export function drainSentences(speechEngine, state, force) {
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

// 中止目前正在講的（逐句佇列 + 神經語音音檔 + 瀏覽器 TTS + 對嘴），給「點第二下打斷第一下」用
export function stopSpeaking(speechEngine) {
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

// 對外入口：整段文字 → 切句進逐句佇列（②講第 1 句時預抓第 2 句 → 長答案幾乎立刻開口）
export function speak(speechEngine, text, options) {
  if (speechEngine.container instanceof HTMLElement === false) {
    console.warn(
      '[aiAvatar speak] speechEngine.container is not an HTMLElement'
    );
    return;
  }

  if (speechEngine.ttsMuted === true) {
    speechEngine.setEmotionFromText(text);
    onUtteranceEnd(speechEngine); // 靜音：沒語音可收尾，直接觸發對話迴圈 hook
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

// ===== ②逐句開講引擎：一次一個 session；句子依序講，神經語音在背景先抓下一句 =====
export function beginSpeech(speechEngine) {
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

export function pushSpeech(speechEngine, sid, text, options) {
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

export function endSpeech(speechEngine, sid) {
  if (sid === speechEngine.speakSeq) {
    speechEngine.speechEnded = true;
    // speechEngine.spokenDisplayText = "";
    speechEngine.skin.emo.target = 0;
    pumpSpeech(speechEngine, sid);
  }
}

export function onUtteranceEnd(speechEngine) {
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
        speechEngine.startListening();
      }
    }, 450);
  } else {
    speechEngine.stopVoiceSession();
  }
}

export async function pumpSpeech(speechEngine, sid) {
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
    item.text === getGreetingText(speechEngine) &&
    speechEngine.tapGreetingBuffer == null
  ) {
    preloadTapGreeting(speechEngine);
    speakBrowserChunk(speechEngine, item.text, sid, done);
    return;
  }

  let buf = null;
  if (speechEngine.neuralDisabled !== true && item.err == null) {
    if (item.prep == null) {
      item.prep = fetchTTSBuffer(speechEngine, item.text).catch((error) => {
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

export function getGreetingText(speechEngine) {
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
      (name !== '' ? name + '～' : '你好～') +
      '想聊什麼都可以，點 💬 我們就開始！'
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

export function preloadTapGreeting(speechEngine) {
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

export function setLocale(speechEngine, locale) {
  const matched =
    ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'].find(
      (loc) => loc.toLowerCase() === (locale || '').toLowerCase()
    ) || 'zh-TW';
  speechEngine.currentLocale = matched;
  // Note: Only fallback neural voice if the developer didn't set a hardcoded voice in config
  if (
    typeof speechEngine.config?.voice !== 'string' ||
    speechEngine.config?.voice === ''
  ) {
    speechEngine.neuralVoice = localeVoice(matched);
  }

  if (typeof speechEngine.onLanguageChanged === 'function') {
    speechEngine.onLanguageChanged(matched, localeLabel(matched));
  }

  if (
    typeof speechEngine.recognition === 'object' &&
    speechEngine.recognition !== null
  ) {
    speechEngine.recognition.lang = matched;
  }

  loadVoice(speechEngine.gender);
}
