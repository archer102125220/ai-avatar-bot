// M4b：WebLLM（瀏覽器內跑小模型，零金鑰）。函式庫改成「按下🧠才動態 import」，
//    一般訪客（不啟用大腦）不會下載這包 JS。控制權掛到 window.LLM。

const STATE_MAP = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
};
const MODE_MAP = {
  twoDimensional: "2d",
  threeDimensional: "3d",
};

const DEFAULT_LLM_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

// ===== 可設定（由 embed.js 透過 query 帶入）：皮=模型 / 肉的語音=後端 / 內容=知識庫 =====
const DEFAULT_MODEL_URL =
  "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json";
const DEFAULT_TTS_ENDPOINT = "api/tts";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:latest";
const DEFAULT_NEURAL_VOICE = "zh-TW-HsiaoChenNeural"; // 微軟神經語音「曉臻」
const DEFALUT_START_MODE = MODE_MAP.twoDimensional;

// 取景：'half'=近距離半身（頭+上半身，腿裁掉，聊天頭像感）；'full'=全身。可用 ?fit=full / data-fit 切回
const DEFALUT_FIT_MODE = "half";

async function handleGetKnowledge(knowledgeUrl = "") {
  try {
    if (typeof knowledgeUrl === "string" && knowledgeUrl !== "") {
      const knowledge = await fetch(knowledgeUrl).then((response) => {
        if (typeof response?.json === "function") {
          return response.json();
        }
        return [];
      });
      if (Array.isArray(knowledge) === false) {
        throw new Error("[AiAvatarWidget] Knowledge is not an array");
      }
      return knowledge;
    }
  } catch (_error) {}
  return [];
}

function initLLM(llmModel = DEFAULT_LLM_MODEL) {
  let engine = null;
  let loadingPromise = null;

  const LLM = {
    supported: "gpu" in navigator,
    state: STATE_MAP.IDLE, // idle | loading | ready | error
    progress: 0,
    model: llmModel || DEFAULT_LLM_MODEL,
    async load(onProgress) {
      if (engine) return engine;
      if (loadingPromise) return loadingPromise;
      this.state = STATE_MAP.LOADING;
      loadingPromise = import("https://esm.run/@mlc-ai/web-llm") // 動態載入：只有按下🧠才抓這包函式庫
        .then((webllm) =>
          webllm.CreateMLCEngine(llmModel, {
            initProgressCallback: (p) => {
              this.progress = p.progress || 0;
              if (typeof onProgress === "function") {
                onProgress(p);
              }
            },
          }),
        )
        .then((mlcEngine) => {
          engine = mlcEngine;
          this.state = STATE_MAP.READY;
          return mlcEngine;
        })
        .catch((error) => {
          this.state = STATE_MAP.ERROR;
          this.error = String(error);
          throw error;
        });
      return loadingPromise;
    },
    async chat(messages) {
      if (!engine) {
        return null;
      }
      const result = await engine.chat.completions.create({
        messages,
        temperature: 0.4,
        max_tokens: 220,
      });
      return result?.choices?.[0]?.message?.content;
    },
  };

  return LLM;
}
function initOLLAMA(ollamaBase = "", ollamaModel = DEFAULT_OLLAMA_MODEL) {
  const OLLAMA = {
    base: ollamaBase,
    model: ollamaModel || DEFAULT_OLLAMA_MODEL,
    enabled: !!ollamaBase,
    ready: false,
    async ping() {
      if (!this.enabled) {
        return false;
      }
      try {
        const response = await fetch(
          this.base.replace(/\/v1$/, "") + "/api/tags",
        );
        this.ready = response.ok;
        return response.ok;
      } catch (_error) {
        this.ready = false;
        return false;
      }
    },
    async chat(messages) {
      const response = await fetch(this.base + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.4,
          max_tokens: 220,
          stream: false,
        }),
      });
      if (response.ok !== true) {
        throw new Error("http " + response.status);
      }
      const result = await response.json();
      return result?.choices?.[0]?.message?.content;
    },
  };
  return OLLAMA;
}
// 共用：檢索到的資料 + 問題 → 給 LLM 的訊息（Ollama 與 WebLLM 共用同一套 RAG 提示）
function buildLLMMessages(question) {
  const ctx = topK(question, 3)
    .map((e) => "Q：" + e.q + "\nA：" + e.a)
    .join("\n---\n");
  return [
    {
      role: "system",
      content:
        "你是「可嵌入任何網站的語音虛擬人元件」的示範助手。主題是教人「怎麼把這個元件裝到自己的網站、怎麼換成自己的角色、怎麼使用」。請用繁體中文、口語、最多兩三句話簡短回答。優先依據【參考資料】回答；資料沒有的就用常識簡短回應，不確定就老實說不知道。\n\n【參考資料】\n" +
        (ctx || "（無）"),
    },
    { role: "user", content: question },
  ];
}

function showBubble(aiAvatarWidget = null, text) {
  const bubbleEl = aiAvatarWidget?.bubbleEl;
  if (bubbleEl instanceof HTMLElement === false) {
    console.error("[aiAvatar showBubble] bubbleEl is not an HTMLElement");
    return;
  }
  bubbleEl.textContent = text;
  bubbleEl.classList.add("show");

  clearTimeout(aiAvatarWidget.showBubbleTimer);
  aiAvatarWidget.showBubbleTimer = setTimeout(
    () => bubbleEl.classList.remove("show"),
    6000,
  );
}

// ===== TTS：開口說話 + 對嘴 =====
function loadVoice(aiAvatarWidget = null) {
  const voices = speechSynthesis.getVoices();
  const pick = (targetVoice) =>
    voices.find(
      (voice) =>
        targetVoice.test(`${voice.name} ${voice.lang}`) &&
        !/Google/i.test(voice.name),
    ); // 避開 Chrome 會靜默失敗的 Google 遠端語音

  aiAvatarWidget.ttVoice =
    pick(/(HsiaoChen|HsiaoYu|曉臻|曉雨).*zh/i) || // 微軟神經女聲（最自然，若有安裝）
    pick(/(Yating|Zhiwei).*zh[-_]TW/i) || // 較新、較不機械的微軟 zh-TW 女聲
    pick(/Microsoft.*zh[-_]TW/i) || // 任何微軟 zh-TW（本地、可靠）
    pick(/zh[-_]TW/i) ||
    pick(/^zh/i) ||
    voices.find((voice) => /zh/i.test(voice.lang)) ||
    null;
}

// ===== 拖放自己的 VRM：把 .vrm 拖到角色上就直接換成你的 3D 角色（零改 code）=====
function loadVRMFile(aiAvatarWidget = null, file) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error(
      "[aiAvatar loadVRMFile] aiAvatarWidget.container is not an HTMLElement",
    );
    return;
  }

  if (
    file instanceof window.File === false ||
    /\.vrm$/i.test(file?.name || "") === false
  ) {
    showBubble(aiAvatarWidget, "請拖一個 .vrm 檔喔");
    return;
  }
  try {
    if (
      typeof aiAvatarWidget.vrmUrl === "string" &&
      aiAvatarWidget.vrmUrl.indexOf("blob:") === 0
    ) {
      URL.revokeObjectURL(aiAvatarWidget.vrmUrl);
    }
  } catch (_error) {}
  aiAvatarWidget.vrmUrl = URL.createObjectURL(file);
  const btnEngine = rootContainer.querySelector("#btn-engine"); // 換上後也顯示 2D/3D 切換鈕
  if (btnEngine instanceof HTMLElement) {
    btnEngine.style.display = "";
    if (typeof btnEngine.onclick !== "function") {
      btnEngine.onclick = () => {
        setEngine(
          aiAvatarWidget,
          aiAvatarWidget.engineMode === MODE_MAP.threeDimensional
            ? MODE_MAP.twoDimensional
            : MODE_MAP.threeDimensional,
        );
      };
    }
  }
  aiAvatarWidget.engineMode = null; // 強制重 boot（即使已在 3D）
  setEngine(aiAvatarWidget, MODE_MAP.threeDimensional);
  showBubble(aiAvatarWidget, "換上你的角色了！🎭");
}

// 中止目前正在講的（神經語音音檔 + 瀏覽器 TTS + 對嘴），給「點第二下打斷第一下」用
function stopSpeaking(aiAvatarWidget = null) {
  try {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
  } catch (_error) {}
  try {
    clearTimeout(speakBrowser._t);
  } catch (_error) {}
  if (
    typeof aiAvatarWidget.currentFps === "number" &&
    aiAvatarWidget.currentFps > 0
  ) {
    cancelAnimationFrame(aiAvatarWidget.currentFps);
    aiAvatarWidget.currentFps = 0;
  }
  if (aiAvatarWidget.currentSource) {
    try {
      aiAvatarWidget.currentSource.onended = null;
      aiAvatarWidget.currentSource.stop();
    } catch (_error) {}
    aiAvatarWidget.currentSource = null;
  }
  aiAvatarWidget.isSpeaking = false;
  aiAvatarWidget.useAudioMouth = false;
  aiAvatarWidget.audioMouth = 0;
}

// 對外入口：先試 edge-tts 神經語音(真人感 + 精準對嘴)，失敗自動退回瀏覽器語音
function speak(aiAvatarWidget = null, text) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error(
      "[aiAvatar speak] aiAvatarWidget.container is not an HTMLElement",
    );
    return;
  }

  const myseq = ++aiAvatarWidget.speakSeq; // 每次說話一個序號，用來判斷是否已被新點擊取代
  showBubble(aiAvatarWidget, text);
  if (typeof aiAvatarWidget.onSpeaking === "function") {
    aiAvatarWidget.onSpeaking(text);
  }
  if (aiAvatarWidget.ttsMuted === true) {
    return;
  }
  stopSpeaking(aiAvatarWidget); // 立刻打斷上一段
  if (aiAvatarWidget.neuralDisabled === true) {
    speakBrowser(aiAvatarWidget, text);
    return;
  } // 沒有神經語音後端 → 直接用瀏覽器語音
  speakNeural(aiAvatarWidget, text, myseq).catch((error) => {
    if (myseq !== aiAvatarWidget.speakSeq) return; // 已被更新的點擊取代 → 不要退回播放
    const msg = error?.message || "";
    if (/http 4\d\d|Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      aiAvatarWidget.neuralDisabled = true; // 結構性失敗(無後端/CORS/被擋)→不再試神經語音
    }
    console.warn("神經語音失敗，退回瀏覽器語音：", msg);
    aiAvatarWidget.useAudioMouth = false;
    speakBrowser(aiAvatarWidget, text);
  });
}

// edge-tts 神經語音：抓 /api/tts 的 MP3，用 Web Audio 播放並以「實際音量」驅動嘴型
async function speakNeural(aiAvatarWidget = null, text, seq) {
  const safeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (aiAvatarWidget.audioCtx instanceof safeAudioContext === false) {
    aiAvatarWidget.audioCtx = new safeAudioContext();
  }
  if (aiAvatarWidget.audioCtx.state === "suspended") {
    try {
      await aiAvatarWidget.audioCtx.resume();
    } catch (_error) {}
  }
  const sep = aiAvatarWidget.ttsEndpoint.indexOf("?") < 0 ? "?" : "&";
  const response = await fetch(
    aiAvatarWidget.ttsEndpoint +
      sep +
      "voice=" +
      encodeURIComponent(aiAvatarWidget.neuralVoice) +
      "&text=" +
      encodeURIComponent(text),
  );
  if (seq !== aiAvatarWidget.speakSeq) {
    return; // 抓回來時已被新點擊取代 → 放棄（避免重疊）
  }
  if (!response.ok) {
    throw new Error("http " + response.status);
  }
  const respArrayBuffer = await response.arrayBuffer();
  if (seq !== aiAvatarWidget.speakSeq) {
    return;
  }
  if (respArrayBuffer.byteLength < 800) {
    throw new Error("audio too small");
  }
  const audioBuf =
    await aiAvatarWidget.audioCtx.decodeAudioData(respArrayBuffer);
  if (seq !== aiAvatarWidget.speakSeq) {
    return; // 解碼後最後確認，舊音檔不搶播
  }
  const source = aiAvatarWidget.audioCtx.createBufferSource();
  source.buffer = audioBuf;
  const analyser = aiAvatarWidget.audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  analyser.connect(aiAvatarWidget.audioCtx.destination);
  const data = new Uint8Array(analyser.fftSize);
  aiAvatarWidget.currentSource = source;
  aiAvatarWidget.useAudioMouth = true;
  aiAvatarWidget.isSpeaking = true;
  if (
    typeof aiAvatarWidget.model === "object" &&
    aiAvatarWidget.model !== null
  ) {
    try {
      aiAvatarWidget.model.motion("Tap");
    } catch (_error) {}
  }
  const loop = () => {
    if (
      aiAvatarWidget.currentSource !== source &&
      aiAvatarWidget.currentSource !== null
    ) {
      return; // 不是我在播了就停
    }
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    aiAvatarWidget.audioMouth = Math.min(1, Math.sqrt(sum / data.length) * 3.4); // RMS 音量 → 開口
    aiAvatarWidget.currentFps = requestAnimationFrame(loop);
  };
  aiAvatarWidget.currentFps = requestAnimationFrame(loop);
  source.onended = () => {
    // 自然播完才收尾；被打斷時 onended 已被清掉
    if (aiAvatarWidget.currentSource !== source) {
      return;
    }
    if (aiAvatarWidget.currentFps) {
      cancelAnimationFrame(aiAvatarWidget.currentFps);
      aiAvatarWidget.currentFps = 0;
    }
    aiAvatarWidget.isSpeaking = false;
    aiAvatarWidget.useAudioMouth = false;
    aiAvatarWidget.audioMouth = 0;
    aiAvatarWidget.currentSource = null;
  };
  source.start(0);
}

// 後備：瀏覽器內建語音(Yating)。對嘴綁「實際是否在發聲」，不依賴各語音不一致的事件
function speakBrowser(aiAvatarWidget = null, text) {
  if (
    aiAvatarWidget.ttsMuted === true ||
    "speechSynthesis" in window === false
  ) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  if (
    typeof aiAvatarWidget.ttVoice !== "object" ||
    aiAvatarWidget.ttVoice === null
  ) {
    loadVoice(aiAvatarWidget);
  }
  if (
    typeof aiAvatarWidget.ttVoice === "object" &&
    aiAvatarWidget.ttVoice !== null
  ) {
    utterance.voice = aiAvatarWidget.ttVoice;
  }
  utterance.lang = aiAvatarWidget.ttVoice?.lang || "zh-TW";
  utterance.rate = aiAvatarWidget.ttsRate;
  utterance.pitch = 1.0;
  utterance.onboundary = () => {
    aiAvatarWidget.mouthTarget = 0.5 + Math.random() * 0.5;
  };
  const stopLip = () => {
    aiAvatarWidget.isSpeaking = false;
  };
  utterance.onend = stopLip;
  // 嘴型用「估時長」驅動，不靠 speechSynthesis.speaking 輪詢
  // （Chrome 在 cancel 後常回報失準 → 第二次說話嘴巴就不動了）
  const estMs = Math.min(
    16000,
    Math.max(1500, (text.length * 130) / (aiAvatarWidget.ttsRate || 1)),
  );
  const fire = () => {
    try {
      speechSynthesis.resume();
    } catch (_error) {} // 解 Chrome cancel 後卡住的 bug
    speechSynthesis.speak(utterance);
    aiAvatarWidget.isSpeaking = true;
    aiAvatarWidget.mouthTarget = 0.7;
    if (aiAvatarWidget.model) {
      try {
        aiAvatarWidget.model.motion("Tap");
      } catch (_error) {}
    }
    clearTimeout(aiAvatarWidget.speakBrowserTimer);
    aiAvatarWidget.speakBrowserTimer = setTimeout(stopLip, estMs); // 保底：時間到閉嘴，不依賴事件
  };
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    setTimeout(fire, 120);
  } else {
    fire();
  }
}

// ===== 大腦：M4 檢索 + M4b（WebLLM）生成 =====
// 中文不好斷詞，改用「字元 bigram（相鄰兩字）」相似度，對中文很有效、又不用任何函式庫。
function bigrams(s) {
  s = (s || "").toLowerCase().replace(/[\s，。、？！,.?!~～]/g, "");
  const g = [];
  for (let i = 0; i < s.length - 1; i++) {
    g.push(s.slice(i, i + 2));
  }
  if (s.length === 1) {
    g.push(s);
  }
  return g;
}
function similarity(query, text) {
  const A = bigrams(query);
  const B = new Set(bigrams(text));
  if (!A.length || !B.size) {
    return 0;
  }
  let hit = 0;
  for (const x of A) {
    if (B.has(x)) {
      hit++;
    }
  }
  return hit / Math.sqrt(A.length * B.size);
}
function scoreEntry(question, e) {
  let score = Math.max(
    similarity(question, e.q),
    similarity(question, e.kw || ""),
  );
  const terms = (e.kw || "").split(/\s+/).filter(Boolean);
  for (const t of terms) {
    if (t.length >= 2 && question.includes(t)) {
      score = Math.max(score, 0.5 + t.length * 0.04);
    }
  }
  return score;
}
function topK(question, k) {
  const knowledge = window.KNOWLEDGE || [];

  return knowledge
    .map((e) => ({ e, s: scoreEntry(question, e) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .filter((x) => x.s > 0.05)
    .map((x) => x.e);
}
// 檢索式回答（零金鑰、即時、永遠可用的後備）
function brain(rawQuestion) {
  const question = (rawQuestion || "").trim?.();
  if (typeof question !== "string" || question === "") {
    return "我好像沒聽清楚，可以再說一次嗎？";
  }

  const knowledge = window.KNOWLEDGE || [];
  let best = null;
  let bestScore = 0;
  for (const qaPair of knowledge) {
    const score = scoreEntry(question, qaPair);
    if (score > bestScore) {
      bestScore = score;
      best = qaPair;
    }
  }

  if (best && bestScore >= 0.16) {
    return best.a;
  }

  return (
    "你問的是「" +
    question +
    "」對吧？這題我的知識庫還沒收錄～你可以問我「怎麼安裝」「怎麼換成我的角色」「要不要錢」「麥克風怎麼用」這些喔。"
  );
}

async function ollamaLLMBrain(aiAvatarWidget, question) {
  try {
    showBubble(aiAvatarWidget, "讓我想想…");
    if (typeof aiAvatarWidget.gesture3D === "function") {
      aiAvatarWidget.gesture3D("thinking");
    }
    const out = (
      (await aiAvatarWidget.OLLAMA.chat(buildLLMMessages(question))) || ""
    ).trim();
    if (typeof out === "string" && out !== "") {
      return out;
    }
  } catch (error) {
    console.warn("Ollama error", error);
    aiAvatarWidget.OLLAMA.ready = false;
  }
  throw new Error(
    `Ollama did not return a string or returned an empty string: ${out}`,
  );
}

async function webLLMBrain(aiAvatarWidget, question) {
  try {
    showBubble(aiAvatarWidget, "讓我想想…");
    if (typeof aiAvatarWidget.gesture3D === "function") {
      aiAvatarWidget.gesture3D("thinking");
    }
    const out = (
      (await aiAvatarWidget.LLM.chat(buildLLMMessages(question))) || ""
    ).trim();
    if (typeof out === "string" && out !== "") {
      return out;
    }
  } catch (error) {
    console.warn("WebLLM error", error);
    aiAvatarWidget.LLM.state = STATE_MAP.ERROR;
  }
  throw new Error(
    `WebLLM did not return a string or returned an empty string: ${out}`,
  );
}

// 有啟用 WebLLM 時，用「檢索到的資料 + LLM」生成更自然的回答；否則退回檢索式
async function handleAnswer(aiAvatarWidget = null, rawQuestion = "") {
  const question = (rawQuestion || "")?.trim?.();
  if (typeof question !== "string" || question === "") {
    return "我好像沒聽清楚，可以再說一次嗎？";
  }

  try {
    // 1) 本機 Ollama 大腦（最聰明，優先）
    if (aiAvatarWidget.OLLAMA?.enabled && aiAvatarWidget.OLLAMA?.ready) {
      return await ollamaLLMBrain(aiAvatarWidget, question);
    }
    // 2) 瀏覽器內 WebLLM（與 Ollama 共用 buildLLMMessages，prompt 只有一份）
    if (aiAvatarWidget.LLM?.state === aiAvatarWidget.STATE_MAP.READY) {
      return await webLLMBrain(aiAvatarWidget, question);
    }
  } catch (_error) {}

  return brain(question);
}

async function handleUser(aiAvatarWidget = null, text) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error("[aiAvatar handleUser] rootContainer is not an HTMLElement");
    return;
  }

  if (typeof text === "string" && text !== "") {
    showBubble(aiAvatarWidget, "你：" + text);
    speak(aiAvatarWidget, await handleAnswer(aiAvatarWidget, text));
  }
}

// ===== STT：聽你說話 =====
function setMic(aiAvatarWidget = null, on) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error("[aiAvatar setMic] rootContainer is not an HTMLElement");
    return;
  }

  const btnMic = aiAvatarWidget.micButtonEl;
  btnMic.classList.toggle("listening", on);
  btnMic.textContent = on ? "● 聆聽中" : "🎤 說話";

  const suggestions = aiAvatarWidget.suggestionsEl;
  if (suggestions instanceof HTMLElement) {
    suggestions.style.display = on ? "none" : "flex";
  } // 聆聽中收起清單
}
function startListening(aiAvatarWidget = null) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error(
      "[aiAvatar startListening] rootContainer is not an HTMLElement",
    );
    return;
  }
  if (!SafeSpeechRecognition) {
    speak(aiAvatarWidget, "你的瀏覽器不支援語音辨識，建議用 Chrome 開喔。");
    return;
  }
  if (aiAvatarWidget.listening && aiAvatarWidget.recognition) {
    aiAvatarWidget.recognition.stop();
    return;
  }
  try {
    aiAvatarWidget.recognition = new SafeSpeechRecognition();
  } catch (error) {
    speak(aiAvatarWidget, "語音辨識啟動失敗：" + error.message);
    return;
  }
  aiAvatarWidget.recognition.lang = "zh-TW";
  aiAvatarWidget.recognition.interimResults = true;
  aiAvatarWidget.recognition.continuous = false;
  aiAvatarWidget.recognition.maxAlternatives = 1;
  aiAvatarWidget.recognition.onstart = () => {
    aiAvatarWidget.listening = true;
    setMic(aiAvatarWidget, true);
    showBubble(aiAvatarWidget, "聆聽中…請說話 🎙️");
  };
  aiAvatarWidget.recognition.onresult = (event) => {
    let txt = "";
    for (const result of event.results) {
      txt += result[0].transcript;
    }
    const last = event.results[event.results.length - 1];
    if (last.isFinal) {
      handleUser(aiAvatarWidget, txt.trim());
    } else {
      showBubble(aiAvatarWidget, "「" + txt + "」…");
    }
  };
  aiAvatarWidget.recognition.onerror = (error) => {
    aiAvatarWidget.listening = false;
    setMic(aiAvatarWidget, false);
    showBubble(
      aiAvatarWidget,
      error.error === "not-allowed"
        ? "我需要麥克風權限才能聽你說話喔。"
        : "沒聽清楚（" + error.error + "），再試一次。",
    );
  };
  aiAvatarWidget.recognition.onend = () => {
    aiAvatarWidget.listening = false;
    setMic(aiAvatarWidget, false);
  };
  try {
    aiAvatarWidget.recognition.start();
  } catch (_error) {}
}

// ===== 共用：每幀算出嘴巴開合 0..1（2D 寫 ParamMouthOpenY、3D 寫 aa 表情，共用同一套計算）=====
function computeMouth(aiAvatarWidget = null) {
  if (aiAvatarWidget.isSpeaking && aiAvatarWidget.useAudioMouth) {
    aiAvatarWidget.mouthValue +=
      (aiAvatarWidget.audioMouth - aiAvatarWidget.mouthValue) * 0.5; // 神經語音：跟真實音量精準對嘴
  } else if (aiAvatarWidget.isSpeaking) {
    const t = performance.now() / 1000;
    aiAvatarWidget.mouthValue =
      0.12 + 0.83 * aiAvatarWidget.mouthTarget * Math.abs(Math.sin(t * 9)); // 瀏覽器語音：假開合
  } else {
    aiAvatarWidget.mouthValue = Math.max(0, aiAvatarWidget.mouthValue - 0.18);
  }
  return aiAvatarWidget.mouthValue;
}

// 2D 引擎相依（pixi + live2d）改成「用到才載」，3D 模式就不會下載 Live2D
function loadUMD() {
  const cdnDependencieUrlArray = [
    {
      id: "live2dcubismcore",
      src: "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
    },
    {
      id: "pixi.js@6.5.10",
      src: "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js",
    },
    {
      id: "pixi-live2d-display@0.4.0",
      src: "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js",
    },
  ];

  if (window.__cdnDependenciePromise__ instanceof Promise === true) {
    return window.__cdnDependenciePromise__;
  }

  window.__cdnDependenciePromise__ = cdnDependencieUrlArray.reduce(
    (cdnDependenciePromise, cdnDependencie) =>
      cdnDependenciePromise.then(
        () =>
          new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = cdnDependencie.src;
            if (cdnDependencie.id) {
              script.id = cdnDependencie.id;
            }
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          }),
      ),
    Promise.resolve(),
  );

  return window.__cdnDependenciePromise__;
}

// ===== 引擎切換外殼：每個引擎建自己的 canvas、回傳 dispose；切換＝dispose 舊的再 boot 新的 =====
function createCanvas(aiAvatarWidget = null) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    throw new Error(
      "[aiAvatar createCanvas] rootContainer is not an HTMLElement",
    );
  }

  const stage = rootContainer.querySelector("#stage");
  stage.querySelectorAll("canvas.avatar-canvas").forEach((old) => old.remove()); // 切換時保證不留舊 canvas（殘骸）
  const newCanvas = document.createElement("canvas");
  newCanvas.classList.add("avatar-canvas");
  stage.insertBefore(newCanvas, stage.firstChild); // 放最底層，UI 疊在上面
  return newCanvas;
}

async function setEngine(aiAvatarWidget = null, engineMode = "") {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error("[aiAvatar setEngine] rootContainer is not an HTMLElement");
    return;
  }
  if (
    aiAvatarWidget.switching === true ||
    engineMode === aiAvatarWidget.engineMode
  ) {
    return;
  }
  aiAvatarWidget.switching = true;
  if (typeof aiAvatarWidget?.renderer?.dispose === "function") {
    try {
      aiAvatarWidget.renderer.dispose();
    } catch (_error) {}
    aiAvatarWidget.renderer = null;
  }
  aiAvatarWidget.engineMode = engineMode;
  const btnEngine = rootContainer.querySelector("#btn-engine");
  if (btnEngine instanceof HTMLElement) {
    btnEngine.textContent =
      engineMode === MODE_MAP.threeDimensional ? "3D" : "2D";
  }
  try {
    aiAvatarWidget.renderer =
      engineMode === MODE_MAP.threeDimensional
        ? await bootVRM(aiAvatarWidget)
        : await bootAvatar(aiAvatarWidget);
  } catch (error) {
    console.error(error);
  }
  aiAvatarWidget.switching = false;
}
// 切換用：embedder 兩個皮都給(data-model + data-vrm) → 長出 2D/3D 切換鈕。
// 預設引擎：data-engine 優先；否則有明確 2D 皮就 2D、只有 3D 就 3D。
function initEngines(aiAvatarWidget = null, has2D, has3D) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error("[aiAvatar initEngines] rootContainer is not an HTMLElement");
    return;
  }

  const startMode =
    aiAvatarWidget.startMode ||
    (has2D
      ? MODE_MAP.twoDimensional
      : has3D
        ? MODE_MAP.threeDimensional
        : MODE_MAP.twoDimensional);

  aiAvatarWidget.startMode = startMode;

  setEngine(aiAvatarWidget, startMode);
  if (
    typeof has2D === "string" &&
    has2D !== "" &&
    typeof has3D === "string" &&
    has3D !== ""
  ) {
    // 兩個皮都給 → 顯示切換鈕，讓使用者即時切
    const btnEngine = rootContainer.querySelector("#btn-engine");
    if (btnEngine instanceof HTMLElement) {
      btnEngine.style.display = "";
      btnEngine.onclick = () =>
        setEngine(
          aiAvatarWidget,
          aiAvatarWidget.engineMode === MODE_MAP.threeDimensional
            ? MODE_MAP.twoDimensional
            : MODE_MAP.threeDimensional,
        );
    }
  }
}

// ===== 3D 皮：VRM（three + three-vrm，ESM 動態 import）=====
async function bootVRM(aiAvatarWidget = null, setting = {}) {
  const rootContainer = aiAvatarWidget?.container;
  const { bow = "", wave = "", thinking = "", look = "", relax = "" } = setting;
  try {
    if (rootContainer instanceof HTMLElement === false) {
      throw new Error("[aiAvatar bootVRM] rootContainer is not an HTMLElement");
    }
    const THREE = await import("three");
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");
    const { VRMAnimationLoaderPlugin, createVRMAnimationClip } =
      await import("@pixiv/three-vrm-animation");
    const tk = "https://cdn.jsdelivr.net/gh/tk256ailab/vrm-viewer@main/VRMA/";
    const GESTURES = {
      // 情境手勢 + 待機變化（body-only，不碰嘴）
      wave: wave || tk + "Goodbye.vrma",
      bow:
        bow ||
        "https://cdn.jsdelivr.net/gh/hirokazuniimoto/virtual-avatar-sdk@main/assets/animations/quick_formal_bow.vrma",
      thinking: thinking || tk + "Thinking.vrma",
      look: look || tk + "LookAround.vrma",
      relax: relax || tk + "Relax.vrma",
    };
    const TAP_GESTURES = ["wave", "bow"]; // 點一下隨機：揮手/鞠躬問候（歡迎感）

    const stage = rootContainer.querySelector("#stage");
    const canvas = createCanvas(aiAvatarWidget);
    const webGLRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    webGLRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    webGLRenderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
    camera.position.set(0, 1.4, 1.6);
    camera.lookAt(0, 1.3, 0);
    const resize = () => {
      const clientWidth = stage.clientWidth;
      const clientHeight = stage.clientHeight;
      webGLRenderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    rootContainer.addEventListener("resize", resize);

    const scene = new THREE.Scene();
    // 調暗：原本 key=π / fill=π*0.35 / ambient=0.6 太亮（MToon 易過曝），整體降約 4 成
    const key = new THREE.DirectionalLight(0xffffff, Math.PI * 0.6);
    key.position.set(1, 1.5, 2);
    const fill = new THREE.DirectionalLight(0xfff0e8, Math.PI * 0.2);
    fill.position.set(-1.5, 0.5, 1);
    scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.38));
    const lookTarget = new THREE.Object3D();
    scene.add(lookTarget); // lookAt 目標：跟著滑鼠
    let mx = 0;
    let my = 0; // 游標相對位置 -1..1
    const onMove = (event) => {
      const clientRect = stage.getBoundingClientRect();
      if (!clientRect.width) return;
      mx = Math.max(
        -1,
        Math.min(
          1,
          ((event.clientX - clientRect.left) / clientRect.width) * 2 - 1,
        ),
      );
      my = Math.max(
        -1,
        Math.min(
          1,
          ((event.clientY - clientRect.top) / clientRect.height) * 2 - 1,
        ),
      );
    };
    rootContainer.addEventListener("pointermove", onMove);

    let nextBlink = 2 + Math.random() * 3;
    let blinkT = -1;
    let mixer = null;
    let waving = false;
    const BLINK = 0.12;
    const gestureActions = {};
    let currentGesture = null;
    let idleBreak = 0;
    const clock = new THREE.Clock();
    const loader = new GLTFLoader();
    loader.register((p) => new VRMLoaderPlugin(p));
    loader.register((p) => new VRMAnimationLoaderPlugin(p)); // 同一個 loader 也能讀 .vrma
    const gltf = await new Promise((resolve, reject) =>
      loader.load(
        aiAvatarWidget.vrmUrl,
        (gltf) => {
          resolve(gltf);
        },
        undefined,
        (error) => {
          reject(error);
        },
      ),
    ).catch((error) => {
      console.error(error);
      if (typeof aiAvatarWidget.onError === "function") {
        aiAvatarWidget.onError(error);
      }
    });

    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);

    const vrm = gltf.userData.vrm;

    VRMUtils.combineMorphs(vrm);
    VRMUtils.rotateVRM0(vrm); // VRM0.x 轉正；VRM1 為安全 no-op

    // VRM0 被 rotateVRM0 轉 180°，手臂 z 旋轉方向會相反；VRM1 不轉 → 用版本決定正負號
    const armSign = String(vrm.meta && vrm.meta.metaVersion) === "1" ? -1 : 1;
    vrm.scene.traverse((o) => {
      o.frustumCulled = false;
    });
    scene.add(vrm.scene);

    try {
      if (vrm.lookAt) {
        vrm.lookAt.target = lookTarget;
      }
    } catch (_e) {} // 眼睛跟著滑鼠

    // VRMA 情境手勢庫（body-only，不碰嘴）：點擊/出場揮手、思考托腮、待機變化(環顧/放鬆)
    (async () => {
      const bodyOnly = (cl) => {
        cl.tracks = cl.tracks.filter((tr) => /\.quaternion$/.test(tr.name));
        return cl;
      }; // 只留骨架旋轉、剝臉部表情與位移
      try {
        mixer = new THREE.AnimationMixer(vrm.scene);
        for (const [name, file] of Object.entries(GESTURES)) {
          try {
            const gg = await loader.loadAsync(file);
            const a = gg.userData.vrmAnimations && gg.userData.vrmAnimations[0];
            if (!a) {
              continue;
            }
            const act = mixer.clipAction(
              bodyOnly(createVRMAnimationClip(a, vrm)),
            );
            act.setLoop(THREE.LoopOnce, 1);
            act.clampWhenFinished = true;
            gestureActions[name] = act;
          } catch (error) {
            console.warn("VRMA " + name + " 載入失敗：", error?.message);
          }
        }
        mixer.addEventListener("finished", (event) => {
          // 手勢播完 → 立刻停、交回程序化站姿（不 fadeOut，避免露出 bind T-pose）
          if (event.action === currentGesture) {
            try {
              event.action.stop();
            } catch (_error) {}
            currentGesture = null;
            waving = false;
          }
        });
        aiAvatarWidget.gesture3D = playGesture; // 對外 hook：思考等時機可從對話流程觸發
        if (gestureActions.wave) {
          setTimeout(() => playGesture("wave"), 800); // 出場招呼
        }
        idleBreak = setInterval(() => {
          // 待機變化：偶爾環顧/放鬆，不死板
          if (!waving && !aiAvatarWidget.isSpeaking && Math.random() < 0.65) {
            playGesture(Math.random() < 0.5 ? "look" : "relax");
          }
        }, 15000);
      } catch (error) {
        console.warn("VRMA 手勢庫載入失敗：", error?.message);
      }
    })();
    setTimeout(
      () =>
        showBubble(
          aiAvatarWidget,
          "點 🎤 說話、或直接打字問我；想更聰明可按 🧠 啟用 AI 大腦 👋",
        ),
      700,
    );
    if (typeof aiAvatarWidget.onReady === "function") {
      aiAvatarWidget.onReady();
    }

    function playGesture(name) {
      // 播一個手勢（期間 mixer 控身體），平時用程序化站姿
      const act = gestureActions[name];
      if (!act || waving) return; // 一次一個，播放中不打斷
      waving = true;
      currentGesture = act;
      act.reset();
      act.setEffectiveWeight(1);
      act.play(); // 硬切，不 fadeIn（fade 低權重會露出 bind T-pose）
    }
    canvas.addEventListener("pointerdown", () => {
      playGesture(
        TAP_GESTURES[Math.floor(Math.random() * TAP_GESTURES.length)],
      );
      onTap(aiAvatarWidget);
    });

    let alive = true;
    (function loop() {
      if (!alive) return;
      requestAnimationFrame(loop);
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      if (vrm) {
        if (mixer) {
          mixer.update(dt); // 揮手時 mixer 控身體
        }
        const em = vrm.expressionManager;
        // 對嘴 + 眨眼（永遠歸我們，mixer 之後 vrm.update 之前）
        const mv = computeMouth(aiAvatarWidget);
        em && em.setValue("aa", mv);
        if (blinkT < 0) {
          nextBlink -= dt;
          if (nextBlink <= 0) {
            blinkT = 0;
            nextBlink = 2 + Math.random() * 4;
          }
        } else {
          blinkT += dt / BLINK;
          em && em.setValue("blink", Math.sin(Math.min(blinkT, 1) * Math.PI));
          if (blinkT >= 1) {
            blinkT = -1;
            em && em.setValue("blink", 0);
          }
        }
        lookTarget.position.set(mx * 0.9, 1.42 - my * 0.55, 1.6); // 眼睛 lookAt 目標跟游標（永遠更新）
        if (!waving) {
          // 待機：直立、手放下、輕呼吸、頭跟游標
          const humanoid = vrm.humanoid;
          const lUA = humanoid.getNormalizedBoneNode("leftUpperArm");
          const rUA = humanoid.getNormalizedBoneNode("rightUpperArm");
          const sp = humanoid.getNormalizedBoneNode("spine");
          const hd = humanoid.getNormalizedBoneNode("head");
          let armL = 1.15 * armSign;
          let armR = -1.15 * armSign;
          let spX = Math.sin(t * 0.9) * 0.018;
          let spY = Math.sin(t * 0.5) * 0.012;
          let hdY = mx * 0.3;
          let hdX = my * 0.12 + Math.sin(t * 0.5) * 0.01;
          if (aiAvatarWidget.isSpeaking) {
            // 講話時：身體/頭/手持續小動作（疊在站姿上）
            const ts = t * 3.0;
            spY += Math.sin(ts) * 0.03;
            hdX += Math.abs(Math.sin(ts * 0.9)) * 0.045; // 點頭
            hdY += Math.sin(ts * 0.55) * 0.05; // 轉頭
            armL += Math.sin(ts * 0.7) * 0.06; // 手臂比劃
            armR -= Math.sin(ts * 0.62) * 0.06;
          }
          if (lUA) lUA.rotation.z = armL;
          if (rUA) rUA.rotation.z = armR;
          if (sp) {
            sp.rotation.x = spX;
            sp.rotation.y = spY;
          }
          if (hd) {
            hd.rotation.y = hdY;
            hd.rotation.x = hdX;
          }
        }
        vrm.update(dt); // 套用骨架/表情/springbone
      }
      webGLRenderer.render(scene, camera);
    })();

    return {
      aiAvatarWidget,
      rootContainer,
      gltf,
      get vrm() {
        return vrm;
      },
      dispose() {
        alive = false;
        aiAvatarWidget.gesture3D = null;
        try {
          clearInterval(idleBreak);
        } catch (_error) {}
        rootContainer.removeEventListener("resize", resize);
        rootContainer.removeEventListener("pointermove", onMove);
        try {
          if (typeof mixer?.stopAllAction === "function") {
            mixer.stopAllAction();
          }
        } catch (_error) {}
        try {
          if (vrm) {
            VRMUtils.deepDispose(vrm.scene);
          }
        } catch (_error) {} // 釋放 3D 幾何/材質，避免殘骸與 WebGL context 累積
        try {
          webGLRenderer.dispose();
        } catch (_error) {}
        try {
          webGLRenderer.forceContextLoss();
        } catch (_error) {}
        canvas.remove();
        vrm = null;
      },
    };
  } catch (error) {
    console.error(error);
    if (typeof aiAvatarWidget.onError === "function") {
      aiAvatarWidget.onError(error);
    }
  }
}

// ===== 2D 皮：Live2D 載入 + 對嘴 =====
async function bootAvatar(aiAvatarWidget = null, modelUrl = DEFAULT_MODEL_URL) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error("[aiAvatar bootAvatar] rootContainer is not an HTMLElement");
    return;
  }
  try {
    await loadUMD(); // 用到才載 pixi + live2d
    const Live2DModel = PIXI.live2d.Live2DModel;
    try {
      Live2DModel.registerTicker(PIXI.Ticker);
    } catch (_error) {}

    const canvas = createCanvas(aiAvatarWidget);
    let pixiApp = new PIXI.Application({
      view: canvas,
      autoStart: true,
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: rootContainer.querySelector("#stage"),
    });

    aiAvatarWidget.model = await Live2DModel.from(
      modelUrl || DEFAULT_MODEL_URL,
    );
    pixiApp.stage.addChild(aiAvatarWidget.model);
    aiAvatarWidget.model.anchor.set(0.5, 1.0);

    // 關掉 Live2D 模型自帶的（日文）動作語音 — 只保留我們自己的 TTS（兩者來源不同，互不影響）
    try {
      if (PIXI.live2d.SoundManager) {
        PIXI.live2d.SoundManager.volume = 0;
      }
    } catch (_error) {}
    try {
      const ms =
        (aiAvatarWidget.model.internalModel.settings &&
          aiAvatarWidget.model.internalModel.settings.motions) ||
        {};
      for (const g of Object.keys(ms)) {
        (ms[g] || []).forEach((d) => {
          delete d.Sound;
          delete d.sound;
        });
      }
    } catch (_error) {}

    const safeFitMode = aiAvatarWidget.fitMode || DEFALUT_FIT_MODE;
    function fit() {
      const width = pixiApp.renderer.width;
      const height = pixiApp.renderer.height;
      const nativeH = aiAvatarWidget.model?.internalModel?.height || 1000;
      if (safeFitMode === "half") {
        const ZOOM = 1.9; // 放大倍率：越大越近（半身越緊）
        const s = (height / nativeH) * 0.95 * ZOOM;
        aiAvatarWidget.model.scale.set(s);
        aiAvatarWidget.model.x = width / 2;
        aiAvatarWidget.model.y = nativeH * s + height * 0.04; // 腳推到畫面外、頭留 4% 上緣
      } else {
        aiAvatarWidget.model.scale.set((height / nativeH) * 0.95);
        aiAvatarWidget.model.x = width / 2;
        aiAvatarWidget.model.y = height;
      }
    }
    fit();
    rootContainer.addEventListener("resize", fit);

    try {
      const groups = aiAvatarWidget.model.internalModel.settings.groups || [];
      const g = groups.find((x) => (x.Name || "").toLowerCase() === "lipsync");
      if (g?.Ids?.length) {
        aiAvatarWidget.lipIds = g.Ids;
      }
    } catch (_error) {}

    // 對嘴：攔截 coreModel.update（計算頂點前的最後一刻寫入嘴巴，保證不被 motion/loadParameters 洗掉）
    try {
      const core = aiAvatarWidget.model.internalModel.coreModel;
      const origUpdate = core.update.bind(core);
      core.update = function () {
        const mouth = computeMouth(aiAvatarWidget); // 共用嘴型計算（與 3D 同一套）
        for (const id of aiAvatarWidget.lipIds) {
          try {
            core.setParameterValueById(id, mouth);
          } catch (_error) {}
        }
        return origUpdate();
      };
    } catch (_error) {}

    aiAvatarWidget.model.on("hit", () => onTap(aiAvatarWidget));
    canvas.addEventListener("pointerdown", () => onTap(aiAvatarWidget));

    setTimeout(
      () =>
        showBubble(
          aiAvatarWidget,
          "點 🎤 說話、或直接打字問我；想更聰明可按 🧠 啟用 AI 大腦 👋",
        ),
      700,
    );
    if (typeof aiAvatarWidget.onReady === "function") {
      aiAvatarWidget.onReady();
    }

    return {
      aiAvatarWidget,
      rootContainer,
      get canvas() {
        return canvas;
      },
      get model() {
        return aiAvatarWidget.model;
      },
      get pixiApp() {
        return pixiApp;
      },
      dispose() {
        try {
          rootContainer.removeEventListener("resize", fit);
        } catch (_error) {}
        try {
          if (typeof pixiApp?.destroy === "function") {
            pixiApp.destroy(true, {
              children: true,
              texture: true,
              baseTexture: true,
            });
          }
        } catch (_error) {}
        pixiApp = null;
        aiAvatarWidget.model = null;
        canvas.remove();
      },
    };
  } catch (error) {
    console.error(error);
    const directWarnEl = rootContainer.querySelector("#direct-warn");
    if (
      directWarnEl instanceof HTMLParagraphElement ||
      directWarnEl instanceof HTMLDivElement
    ) {
      directWarnEl.textContent = "2D 啟動失敗：" + (error?.message || error);
      directWarnEl.style.display = "flex";
    }
    if (typeof aiAvatarWidget.onError === "function") {
      aiAvatarWidget.onError(error);
    }
  }
}

function onTap(aiAvatarWidget = null) {
  if (
    typeof aiAvatarWidget !== "object" ||
    aiAvatarWidget === null ||
    aiAvatarWidget?.onTapTimer === true
  ) {
    return; // 去抖：hit 事件與 pointerdown 可能同時觸發
  }
  aiAvatarWidget.onTapTimer = true;
  setTimeout(() => {
    aiAvatarWidget.onTapTimer = false;
  }, 400);
  if (aiAvatarWidget.model) {
    try {
      aiAvatarWidget.model.motion("Tap");
    } catch (_error) {}
  }
  speak(
    aiAvatarWidget,
    "你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！",
  );
}

// 範例提示清單：一進站就告訴使用者「可以說什麼」，點任一項＝直接問（語音/打字都不用先猜）
function renderSuggestions(aiAvatarWidget = null) {
  const suggestions = aiAvatarWidget.suggestionsEl;
  if (suggestions instanceof HTMLElement === false) {
    console.warn(
      "[aiAvatar renderSuggestions] aiAvatarWidget.suggestionsEl is not an HTMLElement",
    );
    return;
  }

  const SUGGESTIONS = [
    "怎麼安裝？",
    "怎麼換成我的角色？",
    "要不要錢？",
    "麥克風怎麼用？",
    "我可以說什麼？",
  ];
  const label = document.createElement("p");
  label.classList.add("sg-label");
  label.textContent = "💬 你可以問我：";
  suggestions.appendChild(label);
  SUGGESTIONS.forEach((suggestion) => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("sugg");
    button.textContent = suggestion;
    button.onclick = () => {
      handleUser(aiAvatarWidget, suggestion.replace(/？$/, ""));
    };
    suggestions.appendChild(button);
  });
}

// 打字輸入：Enter 或 ➤ 送出。組字中（注音/拼音選字）按的 Enter 不送，避免誤發半成品
function bindTyping(aiAvatarWidget = null) {
  const typeInput = aiAvatarWidget.questionInputEl;
  if (typeInput instanceof HTMLElement === false) {
    console.error(
      "[aiAvatar bindTyping] aiAvatarWidget.questionInputEl is not an HTMLElement",
    );
    return;
  }

  const send = () => {
    const text = typeInput.value.trim();
    if (typeof text !== "string" || text === "") {
      return;
    }
    typeInput.value = "";
    handleUser(aiAvatarWidget, text);
  };
  aiAvatarWidget.sendButtonEl.onclick = send;
  typeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      send();
    }
  });
}

// 啟用本機 Ollama 時：開機 ping 一下，連上就把 🧠 切成「本機大腦」狀態
async function initOllama(aiAvatarWidget = null) {
  if (typeof aiAvatarWidget?.container?.querySelector !== "function") {
    console.error(
      "[aiAvatar initOllama] aiAvatarWidget.container is not an HTMLElement",
    );
    return;
  }

  if (aiAvatarWidget.OLLAMA?.enabled !== true) {
    return;
  }

  const btnLlm = aiAvatarWidget.btnLlmEl;
  if (btnLlm instanceof HTMLElement) {
    btnLlm.textContent = "🧠…";
    btnLlm.title = "本機 Ollama 大腦（連線中）";
  }
  const ok = await aiAvatarWidget.OLLAMA.ping();
  if (btnLlm instanceof HTMLElement) {
    btnLlm.textContent = ok ? "🧠本機" : "🧠✗";
    btnLlm.classList.toggle("llm-on", ok);
    btnLlm.setAttribute("aria-pressed", String(ok));
    btnLlm.title = ok
      ? "本機 Ollama：已連線 " + aiAvatarWidget.OLLAMA.model
      : "本機 Ollama 連不上（檢查 Ollama 是否在跑 / CORS）";
  }
  if (ok === true) {
    setTimeout(
      () =>
        showBubble(
          aiAvatarWidget,
          "已接上本機 AI 大腦（" +
            aiAvatarWidget.OLLAMA.model +
            "）🧠 問我問題吧！",
        ),
      1300,
    );
  }
}

async function initAiAvatarWidget(optiopns = {}) {
  const {
    container = null,
    ollamaBase = "",
    ollamaModel = DEFAULT_OLLAMA_MODEL,
    neuralVoice = DEFAULT_NEURAL_VOICE,
    knowledgeUrl = "",
    modelUrl = DEFAULT_MODEL_URL,
    ttsEndpoint = DEFAULT_TTS_ENDPOINT, // 沒設→試同站相對路徑；抓不到→自動退回瀏覽器語音（純前端可用）
    llmModel = DEFAULT_LLM_MODEL,
    knowledge = null,
    startMode = DEFALUT_START_MODE,
    fitMode = DEFALUT_FIT_MODE,
    vrmUrl = "",
  } = optiopns;

  if (container instanceof HTMLElement === false) {
    throw new Error("container must be an HTMLElement");
  }
  const routeQuery = new URLSearchParams(location.search);

  const safeModelUrl = modelUrl || DEFAULT_MODEL_URL;
  const safeVrmUrl =
    vrmUrl || (/\.vrm($|\?)/i.test(safeModelUrl) ? safeModelUrl : "");

  const stageEl = document.createElement("div");
  stageEl.setAttribute("id", "stage");
  const bubbleEl = document.createElement("p");
  bubbleEl.setAttribute("id", "bubble");
  const suggestionsEl = document.createElement("div");
  suggestionsEl.setAttribute("id", "suggestions");
  const controlBarEl = document.createElement("div");
  controlBarEl.setAttribute("id", "control-bar");
  const dockRow1El = document.createElement("div");
  dockRow1El.classList.add("dock-row");

  const questionInputEl = document.createElement("input");
  questionInputEl.setAttribute("id", "type-input");
  questionInputEl.setAttribute("type", "text");
  questionInputEl.setAttribute("placeholder", "打字問我也可以…");
  questionInputEl.setAttribute("maxlength", "200");
  questionInputEl.setAttribute("aria-label", "輸入文字問題");

  const sendButtonEl = document.createElement("button");
  sendButtonEl.setAttribute("id", "btn-send");
  sendButtonEl.classList.add("ctrl");
  sendButtonEl.classList.add("primary");
  sendButtonEl.setAttribute("aria-label", "送出文字問題");
  const sendButtonSpan = document.createElement("span");
  sendButtonSpan.setAttribute("aria-hidden", "true");
  sendButtonSpan.textContent = "➤";
  sendButtonEl.appendChild(sendButtonSpan);

  const dockRow2El = document.createElement("div");
  dockRow2El.classList.add("dock-row");
  dockRow2El.setAttribute("role", "toolbar");
  dockRow2El.setAttribute("aria-label", "虛擬人控制列");

  const micButtonEl = document.createElement("button");
  micButtonEl.setAttribute("id", "btn-mic");
  micButtonEl.setAttribute("aria-label", "開始語音對話");
  micButtonEl.classList.add("ctrl");
  micButtonEl.classList.add("primary");
  const micButtonSpanEl = document.createElement("span");
  micButtonSpanEl.setAttribute("aria-hidden", "true");
  micButtonSpanEl.textContent = "🎤 說話";
  micButtonEl.appendChild(micButtonSpanEl);

  const engineButtonEl = document.createElement("button");
  engineButtonEl.setAttribute("id", "btn-engine");
  engineButtonEl.setAttribute("aria-label", "切換 2D / 3D 角色");
  engineButtonEl.classList.add("ctrl");
  engineButtonEl.style.display = "none";
  engineButtonEl.textContent = "2D／3D";

  const muteButtonEl = document.createElement("button");
  muteButtonEl.setAttribute("id", "btn-mute");
  muteButtonEl.setAttribute("aria-label", "靜音");
  muteButtonEl.setAttribute("aria-pressed", "false");
  muteButtonEl.classList.add("ctrl");
  const muteButtonSpanEl = document.createElement("span");
  muteButtonSpanEl.setAttribute("aria-hidden", "true");
  muteButtonSpanEl.textContent = "🔊";
  muteButtonEl.appendChild(muteButtonSpanEl);

  const btnLlmEl = document.createElement("button");
  btnLlmEl.setAttribute("id", "btn-llm");
  btnLlmEl.setAttribute("aria-label", "啟用瀏覽器內 AI 大腦（首次需下載模型）");
  btnLlmEl.setAttribute("aria-pressed", "false");
  btnLlmEl.classList.add("ctrl");
  const btnLlmSpanEl = document.createElement("span");
  btnLlmSpanEl.setAttribute("aria-hidden", "true");
  btnLlmSpanEl.textContent = "🧠";
  btnLlmEl.appendChild(btnLlmSpanEl);

  const speedButtonEl = document.createElement("button");
  speedButtonEl.setAttribute("id", "btn-speed");
  speedButtonEl.setAttribute("aria-label", "調整語速");
  speedButtonEl.setAttribute("aria-pressed", "false");
  speedButtonEl.classList.add("ctrl");
  const speedButtonSpanEl = document.createElement("span");
  speedButtonSpanEl.setAttribute("aria-hidden", "true");
  speedButtonSpanEl.textContent = "1.0×";
  speedButtonEl.append(speedButtonSpanEl);

  const closeButtonEl = document.createElement("button");
  closeButtonEl.setAttribute("id", "btn-close");
  closeButtonEl.setAttribute("aria-label", "收起助理");
  closeButtonEl.classList.add("ctrl");
  const closeButtonSpanEl = document.createElement("span");
  closeButtonSpanEl.setAttribute("aria-hidden", "true");
  closeButtonSpanEl.textContent = "✕";
  closeButtonEl.appendChild(closeButtonSpanEl);

  const directWarnEl = document.createElement("p");
  directWarnEl.setAttribute("id", "direct-warn");
  directWarnEl.textContent = "請透過 <code>embed.js</code> 載入此元件。";

  stageEl.appendChild(bubbleEl);
  stageEl.appendChild(suggestionsEl);
  stageEl.appendChild(controlBarEl);
  controlBarEl.appendChild(dockRow1El);
  controlBarEl.appendChild(dockRow2El);
  dockRow1El.appendChild(questionInputEl);
  dockRow1El.appendChild(sendButtonEl);
  dockRow2El.appendChild(micButtonEl);
  dockRow2El.appendChild(btnLlmEl);
  dockRow2El.appendChild(engineButtonEl);
  dockRow2El.appendChild(muteButtonEl);
  dockRow2El.appendChild(speedButtonEl);
  dockRow2El.appendChild(closeButtonEl);
  container.appendChild(stageEl);
  container.appendChild(directWarnEl);

  const aiAvatarWidget = {
    get optiopns() {
      return optiopns;
    },

    get DEFAULT_LLM_MODEL() {
      return DEFAULT_LLM_MODEL;
    },
    get STATE_MAP() {
      return STATE_MAP;
    },
    get DEFAULT_MODEL_URL() {
      return DEFAULT_MODEL_URL;
    },

    // ===== 跟父頁溝通 =====
    // 父頁 origin（用 referrer 推；推不到才退回 '*'）——postMessage 盡量指定目標而非對全網廣播
    get PARENT_ORIGIN() {
      try {
        return new URL(document.referrer).origin;
      } catch (_error) {
        return "*";
      }
    },

    // ===== 本機 Ollama 大腦（試玩用；只在本機 / localhost 通）=====
    // data-ollama 指向 OpenAI 相容端點（如 http://localhost:11434/v1）；data-llmmodel 指定模型名
    get ollamaBase() {
      return ollamaBase;
    },

    _ollamaModel: ollamaModel || DEFAULT_OLLAMA_MODEL,
    get ollamaModel() {
      return ollamaModel;
    },
    set ollamaModel(newOllamaModel) {
      if (typeof newOllamaModel === "string" || newOllamaModel === null) {
        this._ollamaModel = newOllamaModel;
      }
    },

    get routeQuery() {
      return routeQuery;
    },

    get container() {
      return container;
    },

    get stageEl() {
      return stageEl;
    },
    get bubbleEl() {
      return bubbleEl;
    },
    get suggestionsEl() {
      return suggestionsEl;
    },
    get controlBarEl() {
      return controlBarEl;
    },
    get dockRow1El() {
      return dockRow1El;
    },
    get dockRow2El() {
      return dockRow2El;
    },
    get questionInputEl() {
      return questionInputEl;
    },
    get sendButtonEl() {
      return sendButtonEl;
    },
    get micButtonEl() {
      return micButtonEl;
    },
    get engineButtonEl() {
      return engineButtonEl;
    },
    get muteButtonEl() {
      return muteButtonEl;
    },
    get btnLlmEl() {
      return btnLlmEl;
    },
    get speedButtonEl() {
      return speedButtonEl;
    },
    get closeButtonEl() {
      return closeButtonEl;
    },
    get directWarnEl() {
      return directWarnEl;
    },

    // 狀態
    // 皮的引擎判斷：data-vrm 指向 .vrm → 走 3D(VRM)；否則 data-model(.model3.json) → 走 2D(Live2D)
    _vrmUrl: safeVrmUrl, // let：拖放自己的 VRM 時可換,
    get vrmUrl() {
      return this._vrmUrl;
    },
    set vrmUrl(newVrmUrl = "") {
      if (typeof newVrmUrl === "string" && newVrmUrl !== "") {
        this._vrmUrl = newVrmUrl;
      }
    },

    _has2D: !!safeModelUrl,
    get has2D() {
      return this._has2D;
    },
    set has2D(newHas2D = false) {
      if (typeof newHas2D === "boolean") {
        this._has2D = newHas2D;
      }
    },

    _has3D: false,
    get has3D() {
      return this._has3D;
    },
    set has3D(newHas3D = false) {
      if (typeof newHas3D === "boolean") {
        this._has3D = newHas3D;
      }
    },

    _startMode: startMode || DEFALUT_START_MODE,
    get startMode() {
      return this._startMode;
    },
    set startMode(newStartMode = "") {
      if (typeof newStartMode === "string" && newStartMode !== "") {
        this._startMode = newStartMode;
      }
    },

    _fitMode: fitMode || DEFALUT_FIT_MODE,
    get fitMode() {
      return this._fitMode;
    },
    set fitMode(newFitMode = "") {
      if (typeof newFitMode === "string" && newFitMode !== "") {
        this._fitMode = newFitMode;
      }
    },

    _switching: null,
    get switching() {
      return this._switching;
    },
    set switching(newSwitching = null) {
      if (typeof newSwitching === "boolean") {
        this._switching = newSwitching;
      }
    },

    _renderer: null,
    get renderer() {
      return this._renderer;
    },
    set renderer(newRenderer = null) {
      this._renderer = newRenderer;
    },

    _engineMode: null,
    get engineMode() {
      return this._engineMode;
    },
    set engineMode(newEngineMode = "") {
      if (typeof newEngineMode === "string" && newEngineMode !== "") {
        this._engineMode = newEngineMode;
      }
    },

    _neuralVoice: neuralVoice || DEFAULT_NEURAL_VOICE,
    get neuralVoice() {
      return this._neuralVoice; // 神經語音
    },
    set neuralVoice(newNeuralVoice = "") {
      if (typeof newNeuralVoice === "string" || newNeuralVoice === null) {
        this._neuralVoice = newNeuralVoice;
      }
    },

    _audioCtx: null,
    get audioCtx() {
      return this._audioCtx;
    },
    set audioCtx(newAudioCtx = null) {
      if (typeof newAudioCtx === "object") {
        this._audioCtx = newAudioCtx;
      }
    },

    _isSpeaking: false,
    get isSpeaking() {
      return this._isSpeaking;
    },
    set isSpeaking(newIsSpeaking) {
      if (typeof newIsSpeaking === "boolean" || newIsSpeaking === null) {
        this._isSpeaking = newIsSpeaking;
      }
    },

    _mouthValue: 0,
    get mouthValue() {
      return this._mouthValue;
    },
    set mouthValue(newMouthValue) {
      if (typeof newMouthValue === "number" || newMouthValue === null) {
        this._mouthValue = newMouthValue;
      }
    },

    _mouthTarget: 0.7,
    get mouthTarget() {
      return this._mouthTarget;
    },
    set mouthTarget(newMouthTarget) {
      if (typeof newMouthTarget === "number" || newMouthTarget === null) {
        this._mouthTarget = newMouthTarget;
      }
    },

    _lipIds: ["ParamMouthOpenY"],
    get lipIds() {
      return this._lipIds;
    },
    set lipIds(newLipIds) {
      if (Array.isArray(newLipIds) || newLipIds === null) {
        this._lipIds = newLipIds;
      }
    },

    _ttsMuted: false,
    get ttsMuted() {
      return this._ttsMuted;
    },
    set ttsMuted(newTtsMuted) {
      if (typeof newTtsMuted === "boolean" || newTtsMuted === null) {
        this._ttsMuted = newTtsMuted;
      }
    },

    _ttsRate: 1.0,
    get ttsRate() {
      return this._ttsRate;
    },
    set ttsRate(newTtsRate) {
      if (typeof newTtsRate === "number" || newTtsRate === null) {
        this._ttsRate = newTtsRate;
      }
    },

    _ttVoice: null,
    get ttVoice() {
      return this._ttVoice;
    },
    set ttVoice(newTtVoice) {
      if (typeof newTtVoice === "object") {
        this._ttVoice = newTtVoice;
      }
    },

    _audioMouth: 0,
    get audioMouth() {
      return this._audioMouth;
    },
    set audioMouth(newAudioMouth) {
      if (typeof newAudioMouth === "number" || newAudioMouth === null) {
        this._audioMouth = newAudioMouth;
      }
    },

    _useAudioMouth: false,
    get useAudioMouth() {
      return this._useAudioMouth;
    },
    set useAudioMouth(newUseAudioMouth) {
      if (typeof newUseAudioMouth === "boolean" || newUseAudioMouth === null) {
        this._newUseAudioMouth = newUseAudioMouth;
      }
    },

    _speakSeq: 0,
    get speakSeq() {
      return this._speakSeq;
    },
    set speakSeq(newSpeakSeq) {
      if (typeof newSpeakSeq === "number" || newSpeakSeq === null) {
        this._speakSeq = newSpeakSeq;
      }
    },

    _currentSource: null,
    get currentSource() {
      return this._currentSource;
    },
    set currentSource(newCurrentSource) {
      if (typeof newCurrentSource === "object") {
        this._currentSource = newCurrentSource;
      }
    },

    // 控制「點第二下打斷第一下」
    _currentFps: 0,
    get currentFps() {
      return this._currentFps;
    },
    set currentFps(newCurrentFps) {
      if (typeof newCurrentFps === "number" || newCurrentFps === null) {
        this._currentFps = newCurrentFps;
      }
    },

    // 抓不到神經語音後端就鎖定瀏覽器語音，避免每句都打 404
    _neuralDisabled: false,
    get neuralDisabled() {
      return this._neuralDisabled;
    },
    set neuralDisabled(newNeuralDisabled) {
      if (
        typeof newNeuralDisabled === "boolean" ||
        newNeuralDisabled === null
      ) {
        this._neuralDisabled = newNeuralDisabled;
      }
    },

    _recognition: null,
    get recognition() {
      return this._recognition;
    },
    set recognition(newRecognition) {
      if (typeof newRecognition === "object") {
        this._recognition = newRecognition;
      }
    },

    // 3D 手勢觸發 hook（bootVRM 設定；2D 模式為 null → 自動 no-op）
    _gesture3D: null,
    get gesture3D() {
      return this._gesture3D;
    },
    set gesture3D(newGesture3D) {
      if (typeof newGesture3D === "object") {
        this._gesture3D = newGesture3D;
      }
    },

    _modelUrl: safeModelUrl,
    get modelUrl() {
      return this._modelUrl;
    },
    set modelUrl(newModelUrl = "") {
      if (typeof newModelUrl === "string" && newModelUrl !== "") {
        this._modelUrl = newModelUrl;
      }
    },
    _llmModel: llmModel || DEFAULT_LLM_MODEL,
    get llmModel() {
      return this._llmModel;
    },
    set llmModel(newLlmModel = "") {
      if (typeof newLlmModel === "string" && newLlmModel !== "") {
        this._llmModel = newLlmModel;
      }
    },
    _knowledge: knowledge,
    get knowledge() {
      return this._knowledge;
    },
    set knowledge(newKnowledge = []) {
      if (Array.isArray(newKnowledge) === true) {
        this._knowledge = newKnowledge;
      }
    },

    _knowledgeUrl: knowledgeUrl,
    get knowledgeUrl() {
      return this._knowledgeUrl;
    },
    set knowledgeUrl(newKnowledgeUrl = "") {
      if (typeof newKnowledgeUrl === "string" && newKnowledgeUrl !== "") {
        this._knowledgeUrl = newKnowledgeUrl;
      }
    },

    _ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    get ttsEndpoint() {
      return this._ttsEndpoint;
    },
    set ttsEndpoint(newTtsEndpoint = "") {
      if (typeof newTtsEndpoint === "string" && newTtsEndpoint !== "") {
        this._ttsEndpoint = newTtsEndpoint;
      }
    },

    LLM: null,
    KNOWLEDGE: null,
    OLLAMA: null,

    showBubbleTimer: 0,
    speakBrowserTimer: 0,
    onTapTimer: false,
  };
  aiAvatarWidget.has3D = !!aiAvatarWidget.vrmUrl;
  aiAvatarWidget.startMode =
    startMode ||
    (aiAvatarWidget.has2D
      ? MODE_MAP.twoDimensional
      : aiAvatarWidget.has3D
        ? MODE_MAP.threeDimensional
        : MODE_MAP.twoDimensional);

  if (typeof optiopns.onClose === "function") {
    aiAvatarWidget.onClose = optiopns.onClose.bind(aiAvatarWidget);
  }
  if (typeof optiopns.onError === "function") {
    aiAvatarWidget.onError = optiopns.onError.bind(aiAvatarWidget);
  }
  if (typeof optiopns.onReady === "function") {
    aiAvatarWidget.onReady = optiopns.onReady.bind(aiAvatarWidget);
  }
  if (typeof optiopns.onSpeaking === "function") {
    aiAvatarWidget.onSpeaking = optiopns.onSpeaking.bind(aiAvatarWidget);
  }

  initEngines(aiAvatarWidget, aiAvatarWidget.has2D, aiAvatarWidget.has3D);

  aiAvatarWidget.LLM = initLLM(llmModel);
  aiAvatarWidget.KNOWLEDGE =
    Array.isArray(knowledge) && knowledge.length > 0
      ? knowledge
      : await handleGetKnowledge(aiAvatarWidget.knowledgeUrl);
  aiAvatarWidget.OLLAMA = initOLLAMA(
    aiAvatarWidget.ollamaBase,
    aiAvatarWidget.ollamaModel,
  );

  if ("speechSynthesis" in window) {
    speechSynthesis.onvoiceschanged = () => loadVoice(aiAvatarWidget);
    loadVoice(aiAvatarWidget);
  }

  ["dragenter", "dragover"].forEach((eventName) =>
    container.addEventListener(eventName, (event) => {
      event.preventDefault();
    }),
  );
  container.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event?.dataTransfer?.files?.[0];
    if (file instanceof window.File) {
      loadVRMFile(aiAvatarWidget, file);
    }
  });

  renderSuggestions(aiAvatarWidget);
  bindTyping(aiAvatarWidget);

  // ===== 控制列 =====
  closeButtonEl.onclick = () => {
    if (typeof aiAvatarWidget.onClose === "function") {
      aiAvatarWidget.onClose();
    }
  };

  micButtonEl.onclick = () => startListening(aiAvatarWidget);

  muteButtonEl.onclick = (event) => {
    const el = event.target;
    aiAvatarWidget.ttsMuted = !aiAvatarWidget.ttsMuted;
    el.textContent = aiAvatarWidget.ttsMuted ? "🔇" : "🔊";
    el.setAttribute("aria-pressed", String(aiAvatarWidget.ttsMuted));
    if (aiAvatarWidget.ttsMuted === true) {
      stopSpeaking(aiAvatarWidget); // 立刻停掉正在播的（神經語音 + 瀏覽器語音）
    }
    showBubble(
      aiAvatarWidget,
      aiAvatarWidget.ttsMuted ? "已靜音" : "已開啟語音",
    );
  };
  speedButtonEl.onclick = (event) => {
    const el = event.target;
    const steps = [0.9, 1.0, 1.2, 1.4];
    aiAvatarWidget.ttsRate =
      steps[(steps.indexOf(aiAvatarWidget.ttsRate) + 1) % steps.length] || 1.0;
    el.textContent = aiAvatarWidget.ttsRate.toFixed(1) + "×";
    showBubble(
      aiAvatarWidget,
      "語速：" + aiAvatarWidget.ttsRate.toFixed(1) + "×",
    );
  };
  btnLlmEl.onclick = async (event) => {
    const el = event.target;

    // 啟用本機 Ollama 模式時：🧠 用來顯示狀態 / 重新連線，不下載 WebLLM
    if (aiAvatarWidget.OLLAMA?.enabled === true) {
      const ok =
        aiAvatarWidget.OLLAMA.ready || (await aiAvatarWidget.OLLAMA.ping());
      el.textContent = ok ? "🧠本機" : "🧠✗";
      el.classList.toggle("llm-on", ok);
      el.setAttribute("aria-pressed", String(ok));
      showBubble(
        aiAvatarWidget,
        ok
          ? "本機 AI 大腦運作中（" + aiAvatarWidget.OLLAMA.model + "）🧠"
          : "本機 Ollama 連不上：確認 Ollama 在跑、且 OLLAMA_ORIGINS 已允許這個網站。",
      );

      return;
    }
    if (aiAvatarWidget.LLM?.supported !== true) {
      showBubble(
        aiAvatarWidget,
        "這個裝置不支援 WebGPU，先用知識庫模式就好（功能一樣可用）。",
      );
      return;
    }
    if (aiAvatarWidget.LLM?.state === STATE_MAP.READY) {
      showBubble(aiAvatarWidget, "AI 大腦已啟用，問我問題吧 🧠");
      return;
    } else if (aiAvatarWidget.LLM?.state === STATE_MAP.LOADING) {
      showBubble(
        aiAvatarWidget,
        "AI 大腦載入中… " + Math.round(aiAvatarWidget.LLM.progress * 100) + "%",
      );
      return;
    }

    showBubble(aiAvatarWidget, "開始下載 AI 大腦（約 1GB，只需第一次）…");
    try {
      await aiAvatarWidget.LLM.load((p) => {
        el.textContent = "🧠 " + Math.round((p.progress || 0) * 100) + "%";
      });
      el.textContent = "🧠✓";
      el.classList.add("llm-on");
      speak(aiAvatarWidget, "AI 大腦啟用完成，現在我可以聊得更自然囉！");
    } catch (e) {
      el.textContent = "🧠✗";
      showBubble(aiAvatarWidget, "AI 大腦載入失敗：" + ((e && e.message) || e));
    }
  };

  window.LLM = aiAvatarWidget.LLM;
  window.KNOWLEDGE = aiAvatarWidget.KNOWLEDGE;
  window.OLLAMA = aiAvatarWidget.OLLAMA;
  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.ns !== "avatar-widget-host") {
      return;
    }
    if (data.type === "say") {
      speak(container, String(data.text || "").slice(0, 600));
    }
    // 注意：不接受用 postMessage 遠端啟動麥克風（listen），避免惡意父頁偷開麥；麥克風只由使用者點擊觸發
  });
  await initOllama(aiAvatarWidget);

  return aiAvatarWidget;
}
