// M4b：WebLLM（瀏覽器內跑小模型，零金鑰）。函式庫改成「按下🧠才動態 import」，
//    一般訪客（不啟用大腦）不會下載這包 JS。控制權掛到 window.LLM。

function initLLM(llmModel = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC") {
  let engine = null;
  let loadingPromise = null;
  const LLM = {
    supported: "gpu" in navigator,
    state: STATE_MAP.IDLE, // idle | loading | ready | error
    progress: 0,
    model: llmModel,
    async load(onProgress) {
      if (engine) return engine;
      if (loadingPromise) return loadingPromise;
      window.LLM.state = STATE_MAP.LOADING;
      loadingPromise = import("https://esm.run/@mlc-ai/web-llm") // 動態載入：只有按下🧠才抓這包函式庫
        .then((webllm) =>
          webllm.CreateMLCEngine(LLM_MODEL, {
            initProgressCallback: (p) => {
              window.LLM.progress = p.progress || 0;
              if (onProgress) onProgress(p);
            },
          }),
        )
        .then((e) => {
          engine = e;
          window.LLM.state = STATE_MAP.READY;
          return e;
        })
        .catch((err) => {
          window.LLM.state = STATE_MAP.ERROR;
          window.LLM.error = String(err);
          throw err;
        });
      return loadingPromise;
    },
    async chat(messages) {
      if (!engine) return null;
      const r = await engine.chat.completions.create({
        messages,
        temperature: 0.4,
        max_tokens: 220,
      });
      return r && r.choices && r.choices[0] && r.choices[0].message.content;
    },
  };

  return LLM;
}
function initOLLAMA(ollamaBase = "", ollamaModel = "") {
  const OLLAMA = {
    base: ollamaBase,
    model: ollamaModel,
    enabled: !!ollamaBase,
    ready: false,
    async ping() {
      if (!this.enabled) return false;
      try {
        const r = await fetch(this.base.replace(/\/v1$/, "") + "/api/tags");
        this.ready = r.ok;
        return r.ok;
      } catch (e) {
        this.ready = false;
        return false;
      }
    },
    async chat(messages) {
      const r = await fetch(this.base + "/chat/completions", {
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
      if (!r.ok) throw new Error("http " + r.status);
      const j = await r.json();
      return (
        j &&
        j.choices &&
        j.choices[0] &&
        j.choices[0].message &&
        j.choices[0].message.content
      );
    },
  };
  return OLLAMA;
}
// 共用：檢索到的資料 + 問題 → 給 LLM 的訊息（Ollama 與 WebLLM 共用同一套 RAG 提示）
function buildLLMMessages(q) {
  const ctx = topK(q, 3)
    .map((e) => "Q：" + e.q + "\nA：" + e.a)
    .join("\n---\n");
  return [
    {
      role: "system",
      content:
        "你是「可嵌入任何網站的語音虛擬人元件」的示範助手。主題是教人「怎麼把這個元件裝到自己的網站、怎麼換成自己的角色、怎麼使用」。請用繁體中文、口語、最多兩三句話簡短回答。優先依據【參考資料】回答；資料沒有的就用常識簡短回應，不確定就老實說不知道。\n\n【參考資料】\n" +
        (ctx || "（無）"),
    },
    { role: "user", content: q },
  ];
}
// ===== 跟父頁溝通 =====
// 父頁 origin（用 referrer 推；推不到才退回 '*'）——postMessage 盡量指定目標而非對全網廣播
const PARENT_ORIGIN = (function () {
  try {
    return new URL(document.referrer).origin;
  } catch (e) {
    return "*";
  }
})();
function postToParent(type, payload) {
  try {
    window.parent.postMessage(
      Object.assign({ ns: "avatar-widget", type }, payload || {}),
      PARENT_ORIGIN,
    );
  } catch (e) {}
}

const routeQuery = new URLSearchParams(location.search);

// const LLM_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"; // 中文不錯、約 1.1GB、首次下載後會被快取
const LLM_MODEL = "gemma-2-2b-it-q4f32_1-MLC"; // Google 公開模型
const STATE_MAP = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
};
window.LLM = initLLM(LLM_MODEL);

// ===== 可設定（由 embed.js 透過 query 帶入）：皮=模型 / 肉的語音=後端 / 內容=知識庫 =====
const MODEL_URL =
  routeQuery.get("model") ||
  "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json";
const TTS_ENDPOINT = routeQuery.get("api") || "api/tts"; // 沒設→試同站相對路徑；抓不到→自動退回瀏覽器語音（純前端可用）
const KNOWLEDGE_URL = routeQuery.get("knowledge") || "";
async function handleGetKnowledge(knowledgeUrl = "") {
  if (knowledgeUrl) {
    const knowledge = await fetch(knowledgeUrl).then((r) => r.json());
    return knowledge;
  }
  return [];
}

(async () => {
  window.KNOWLEDGE = await handleGetKnowledge(KNOWLEDGE_URL);
})();

// 皮的引擎判斷：data-vrm 指向 .vrm → 走 3D(VRM)；否則 data-model(.model3.json) → 走 2D(Live2D)
let VRM_URL =
  routeQuery.get("vrm") || (/\.vrm($|\?)/i.test(MODEL_URL) ? MODEL_URL : ""); // let：拖放自己的 VRM 時可換
const ENGINE = VRM_URL ? "3d" : "2d";
// 切換用：embedder 兩個皮都給(data-model + data-vrm) → 長出 2D/3D 切換鈕。
// 預設引擎：data-engine 優先；否則有明確 2D 皮就 2D、只有 3D 就 3D。
const has2D = !!routeQuery.get("model");
const has3D = !!VRM_URL;
const startMode =
  routeQuery.get("engine") || (has2D ? "2d" : has3D ? "3d" : "2d");

let _umd = null;
let _renderer = null;
let _engineMode = null;
let _switching = false;

// ===== 本機 Ollama 大腦（試玩用；只在本機 / localhost 通）=====
// data-ollama 指向 OpenAI 相容端點（如 http://localhost:11434/v1）；data-llmmodel 指定模型名
const OLLAMA_BASE = (routeQuery.get("ollama") || "").replace(/\/+$/, "");
const OLLAMA_MODEL = routeQuery.get("llmmodel") || "qwen2.5:latest";
window.OLLAMA = initOLLAMA(OLLAMA_BASE, OLLAMA_MODEL);

// ===== 模組層狀態 =====
const NEURAL_VOICE = routeQuery.get("voice") || "zh-TW-HsiaoChenNeural"; // 微軟神經語音「曉臻」（可用 data-voice 覆蓋）
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let model = null;
let app = null;
let isSpeaking = false;
let mouthValue = 0;
let mouthTarget = 0.7;
let lipIds = ["ParamMouthOpenY"];
let ttsMuted = false;
let ttsRate = 1.0;
let ttVoice = null;
let audioMouth = 0;
let useAudioMouth = false;
let audioCtx = null;
let speakSeq = 0;
let currentSource = null;
let currentFps = 0; // 控制「點第二下打斷第一下」
let neuralDisabled = false; // 抓不到神經語音後端就鎖定瀏覽器語音，避免每句都打 404
let recognition = null;
let listening = false;
let gesture3D = null; // 3D 手勢觸發 hook（bootVRM 設定；2D 模式為 null → 自動 no-op）

// ===== 防止被直接開（常見網站 widget 的「禁止直接訪問」提示；純 UX，非安全控制），留 ?dev=1 給開發 =====
function main() {
  const isEmbedded = window.self !== window.top;
  const devBypass = routeQuery.has("dev");
  if (!isEmbedded && !devBypass) {
    document.getElementById("stage").style.display = "none";
    document.getElementById("direct-warn").style.display = "flex";
  } else {
    initEngines();
  }
}
main();

window.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.ns !== "avatar-widget-host") return;
  if (d.type === "say") speak(String(d.text || "").slice(0, 600));
  // 注意：不接受用 postMessage 遠端啟動麥克風（listen），避免惡意父頁偷開麥；麥克風只由使用者點擊觸發
});

function showBubble(text) {
  const bubble = document.getElementById("bubble");
  bubble.textContent = text;
  bubble.classList.add("show");
  clearTimeout(showBubble._t);
  showBubble._t = setTimeout(() => bubble.classList.remove("show"), 6000);
}

// ===== TTS：開口說話 + 對嘴 =====
function loadVoice() {
  const vs = speechSynthesis.getVoices();
  const pick = (re) => {
    return vs.find(
      (v) => re.test(v.name + " " + v.lang) && !/Google/i.test(v.name),
    ); // 避開 Chrome 會靜默失敗的 Google 遠端語音
  };
  ttVoice =
    pick(/(HsiaoChen|HsiaoYu|曉臻|曉雨).*zh/i) || // 微軟神經女聲（最自然，若有安裝）
    pick(/(Yating|Zhiwei).*zh[-_]TW/i) || // 較新、較不機械的微軟 zh-TW 女聲
    pick(/Microsoft.*zh[-_]TW/i) || // 任何微軟 zh-TW（本地、可靠）
    pick(/zh[-_]TW/i) ||
    pick(/^zh/i) ||
    vs.find((v) => /zh/i.test(v.lang)) ||
    null;
}

if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = loadVoice;
  loadVoice();
}

// 中止目前正在講的（神經語音音檔 + 瀏覽器 TTS + 對嘴），給「點第二下打斷第一下」用
function stopSpeaking() {
  try {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
  } catch (e) {}
  try {
    clearTimeout(speakBrowser._t);
  } catch (e) {}
  if (currentFps) {
    cancelAnimationFrame(currentFps);
    currentFps = 0;
  }
  if (currentSource) {
    try {
      currentSource.onended = null;
      currentSource.stop();
    } catch (e) {}
    currentSource = null;
  }
  isSpeaking = false;
  useAudioMouth = false;
  audioMouth = 0;
}

// 對外入口：先試 edge-tts 神經語音(真人感 + 精準對嘴)，失敗自動退回瀏覽器語音
function speak(text) {
  const myseq = ++speakSeq; // 每次說話一個序號，用來判斷是否已被新點擊取代
  showBubble(text);
  postToParent("speaking", { text });
  if (ttsMuted) return;
  stopSpeaking(); // 立刻打斷上一段
  if (neuralDisabled) {
    speakBrowser(text);
    return;
  } // 沒有神經語音後端 → 直接用瀏覽器語音
  speakNeural(text, myseq).catch((e) => {
    if (myseq !== speakSeq) return; // 已被更新的點擊取代 → 不要退回播放
    const msg = (e && e.message) || "";
    if (/http 4\d\d|Failed to fetch|NetworkError|Load failed/i.test(msg))
      neuralDisabled = true; // 結構性失敗(無後端/CORS/被擋)→不再試神經語音
    console.warn("神經語音失敗，退回瀏覽器語音：", msg);
    useAudioMouth = false;
    speakBrowser(text);
  });
}

// edge-tts 神經語音：抓 /api/tts 的 MP3，用 Web Audio 播放並以「實際音量」驅動嘴型
async function speakNeural(text, seq) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch (e) {}
  }
  const sep = TTS_ENDPOINT.indexOf("?") < 0 ? "?" : "&";
  const resp = await fetch(
    TTS_ENDPOINT +
      sep +
      "voice=" +
      encodeURIComponent(NEURAL_VOICE) +
      "&text=" +
      encodeURIComponent(text),
  );
  if (seq !== speakSeq) {
    return; // 抓回來時已被新點擊取代 → 放棄（避免重疊）
  }
  if (!resp.ok) {
    throw new Error("http " + resp.status);
  }
  const arr = await resp.arrayBuffer();
  if (seq !== speakSeq) {
    return;
  }
  if (arr.byteLength < 800) {
    throw new Error("audio too small");
  }
  const audioBuf = await audioCtx.decodeAudioData(arr);
  if (seq !== speakSeq) {
    return; // 解碼後最後確認，舊音檔不搶播
  }
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuf;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  src.connect(analyser);
  analyser.connect(audioCtx.destination);
  const data = new Uint8Array(analyser.fftSize);
  currentSource = src;
  useAudioMouth = true;
  isSpeaking = true;
  if (model) {
    try {
      model.motion("Tap");
    } catch (e) {}
  }
  const loop = () => {
    if (currentSource !== src) {
      return; // 不是我在播了就停
    }
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    audioMouth = Math.min(1, Math.sqrt(sum / data.length) * 3.4); // RMS 音量 → 開口
    currentFps = requestAnimationFrame(loop);
  };
  currentFps = requestAnimationFrame(loop);
  src.onended = () => {
    // 自然播完才收尾；被打斷時 onended 已被清掉
    if (currentSource !== src) {
      return;
    }
    if (currentFps) {
      cancelAnimationFrame(currentFps);
      currentFps = 0;
    }
    isSpeaking = false;
    useAudioMouth = false;
    audioMouth = 0;
    currentSource = null;
  };
  src.start(0);
}

// 後備：瀏覽器內建語音(Yating)。對嘴綁「實際是否在發聲」，不依賴各語音不一致的事件
function speakBrowser(text) {
  if (ttsMuted || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  if (!ttVoice) loadVoice();
  if (ttVoice) u.voice = ttVoice;
  u.lang = (ttVoice && ttVoice.lang) || "zh-TW";
  u.rate = ttsRate;
  u.pitch = 1.0;
  u.onboundary = () => {
    mouthTarget = 0.5 + Math.random() * 0.5;
  };
  const stopLip = () => {
    isSpeaking = false;
  };
  u.onend = stopLip;
  // 嘴型用「估時長」驅動，不靠 speechSynthesis.speaking 輪詢
  // （Chrome 在 cancel 後常回報失準 → 第二次說話嘴巴就不動了）
  const estMs = Math.min(
    16000,
    Math.max(1500, (text.length * 130) / (ttsRate || 1)),
  );
  const fire = () => {
    try {
      speechSynthesis.resume();
    } catch (e) {} // 解 Chrome cancel 後卡住的 bug
    speechSynthesis.speak(u);
    isSpeaking = true;
    mouthTarget = 0.7;
    if (model) {
      try {
        model.motion("Tap");
      } catch (e) {}
    }
    clearTimeout(speakBrowser._t);
    speakBrowser._t = setTimeout(stopLip, estMs); // 保底：時間到閉嘴，不依賴事件
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
function scoreEntry(q, e) {
  let score = Math.max(similarity(q, e.q), similarity(q, e.kw || ""));
  const terms = (e.kw || "").split(/\s+/).filter(Boolean);
  for (const t of terms) {
    if (t.length >= 2 && q.includes(t)) {
      score = Math.max(score, 0.5 + t.length * 0.04);
    }
  }
  return score;
}
function topK(q, k) {
  const knowledge = window.KNOWLEDGE || [];

  return knowledge
    .map((e) => ({ e, s: scoreEntry(q, e) }))
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

async function ollamaLLMBrain(question) {
  try {
    showBubble("讓我想想…");
    if (typeof gesture3D === "function") {
      gesture3D("thinking");
    }
    const out = (
      (await window.OLLAMA.chat(buildLLMMessages(question))) || ""
    ).trim();
    if (typeof out === "string" && out.length !== 0) {
      return out;
    }
  } catch (e) {
    console.warn("Ollama error", e);
    window.OLLAMA.ready = false;
  }
  throw new Error(
    `Ollama did not return a string or returned an empty string: ${out}`,
  );
}

async function webLLMBrain(question) {
  try {
    showBubble("讓我想想…");
    if (typeof gesture3D === "function") {
      gesture3D("thinking");
    }
    const out = (
      (await window.LLM.chat(buildLLMMessages(question))) || ""
    ).trim();
    if (typeof out === "string" && out.length !== 0) {
      return out;
    }
  } catch (error) {
    console.warn("WebLLM error", error);
    window.LLM.state = STATE_MAP.ERROR;
  }
  throw new Error(
    `WebLLM did not return a string or returned an empty string: ${out}`,
  );
}

// 有啟用 WebLLM 時，用「檢索到的資料 + LLM」生成更自然的回答；否則退回檢索式
async function handleAnswer(rawQuestion = "") {
  const question = (rawQuestion || "")?.trim?.();
  if (typeof question !== "string" || question === "") {
    return "我好像沒聽清楚，可以再說一次嗎？";
  }

  try {
    // 1) 本機 Ollama 大腦（最聰明，優先）
    if (window.OLLAMA?.enabled && window.OLLAMA?.ready) {
      return await ollamaLLMBrain(question);
    }
    // 2) 瀏覽器內 WebLLM（與 Ollama 共用 buildLLMMessages，prompt 只有一份）
    if (window.LLM?.state === STATE_MAP.READY) {
      return await webLLMBrain(question);
    }
  } catch (_error) {}

  return brain(question);
}

async function handleUser(text) {
  if (text) showBubble("你：" + text);
  speak(await handleAnswer(text));
}

// ===== STT：聽你說話 =====
function setMic(on) {
  const b = document.getElementById("btn-mic");
  b.classList.toggle("listening", on);
  b.textContent = on ? "● 聆聽中" : "🎤 說話";
  const sg = document.getElementById("suggestions");
  if (sg) sg.style.display = on ? "none" : "flex"; // 聆聽中收起清單
}
function startListening() {
  if (!SR) {
    speak("你的瀏覽器不支援語音辨識，建議用 Chrome 開喔。");
    return;
  }
  if (listening && recognition) {
    recognition.stop();
    return;
  }
  try {
    recognition = new SR();
  } catch (e) {
    speak("語音辨識啟動失敗：" + e.message);
    return;
  }
  recognition.lang = "zh-TW";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    listening = true;
    setMic(true);
    showBubble("聆聽中…請說話 🎙️");
  };
  recognition.onresult = (e) => {
    let txt = "";
    for (const r of e.results) txt += r[0].transcript;
    const last = e.results[e.results.length - 1];
    if (last.isFinal) handleUser(txt.trim());
    else showBubble("「" + txt + "」…");
  };
  recognition.onerror = (e) => {
    listening = false;
    setMic(false);
    showBubble(
      e.error === "not-allowed"
        ? "我需要麥克風權限才能聽你說話喔。"
        : "沒聽清楚（" + e.error + "），再試一次。",
    );
  };
  recognition.onend = () => {
    listening = false;
    setMic(false);
  };
  try {
    recognition.start();
  } catch (e) {}
}

// ===== 共用：每幀算出嘴巴開合 0..1（2D 寫 ParamMouthOpenY、3D 寫 aa 表情，共用同一套計算）=====
function computeMouth() {
  if (isSpeaking && useAudioMouth) {
    mouthValue += (audioMouth - mouthValue) * 0.5; // 神經語音：跟真實音量精準對嘴
  } else if (isSpeaking) {
    const t = performance.now() / 1000;
    mouthValue = 0.12 + 0.83 * mouthTarget * Math.abs(Math.sin(t * 9)); // 瀏覽器語音：假開合
  } else {
    mouthValue = Math.max(0, mouthValue - 0.18);
  }
  return mouthValue;
}

// 2D 引擎相依（pixi + live2d）改成「用到才載」，3D 模式就不會下載 Live2D
function loadUMD() {
  if (_umd) return _umd;
  const urls = [
    "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
    "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js",
    "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js",
  ];
  _umd = urls.reduce(
    (p, u) =>
      p.then(
        () =>
          new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = u;
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
          }),
      ),
    Promise.resolve(),
  );
  return _umd;
}

// ===== 引擎切換外殼：每個引擎建自己的 canvas、回傳 dispose；切換＝dispose 舊的再 boot 新的 =====
function newCanvas() {
  const st = document.getElementById("stage");
  st.querySelectorAll("canvas.avatar-canvas").forEach((old) => old.remove()); // 切換時保證不留舊 canvas（殘骸）
  const c = document.createElement("canvas");
  c.className = "avatar-canvas";
  st.insertBefore(c, st.firstChild); // 放最底層，UI 疊在上面
  return c;
}

async function setEngine(mode) {
  if (_switching || mode === _engineMode) return;
  _switching = true;
  if (_renderer) {
    try {
      _renderer.dispose();
    } catch (e) {}
    _renderer = null;
  }
  _engineMode = mode;
  const eb = document.getElementById("btn-engine");
  if (eb) eb.textContent = mode === "3d" ? "3D" : "2D";
  try {
    _renderer = mode === "3d" ? await bootVRM() : await bootAvatar();
  } catch (e) {
    console.error(e);
  }
  _switching = false;
}
function initEngines() {
  setEngine(startMode);
  if (has2D && has3D) {
    // 兩個皮都給 → 顯示切換鈕，讓使用者即時切
    const eb = document.getElementById("btn-engine");
    if (eb) {
      eb.style.display = "";
      eb.onclick = () => setEngine(_engineMode === "3d" ? "2d" : "3d");
    }
  }
}

// ===== 拖放自己的 VRM：把 .vrm 拖到角色上就直接換成你的 3D 角色（零改 code）=====
function loadVRMFile(file) {
  if (!file || !/\.vrm$/i.test(file.name)) {
    showBubble("請拖一個 .vrm 檔喔");
    return;
  }
  try {
    if (VRM_URL && VRM_URL.indexOf("blob:") === 0) URL.revokeObjectURL(VRM_URL);
  } catch (e) {}
  VRM_URL = URL.createObjectURL(file);
  const eb = document.getElementById("btn-engine"); // 換上後也顯示 2D/3D 切換鈕
  if (eb) {
    eb.style.display = "";
    if (!eb.onclick)
      eb.onclick = () => setEngine(_engineMode === "3d" ? "2d" : "3d");
  }
  _engineMode = null; // 強制重 boot（即使已在 3D）
  setEngine("3d");
  showBubble("換上你的角色了！🎭");
}
["dragenter", "dragover"].forEach((ev) =>
  document.addEventListener(ev, (e) => {
    e.preventDefault();
  }),
);
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) loadVRMFile(f);
});

// ===== 3D 皮：VRM（three + three-vrm，ESM 動態 import）=====
async function bootVRM() {
  try {
    const THREE = await import("three");
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");
    const { VRMAnimationLoaderPlugin, createVRMAnimationClip } =
      await import("@pixiv/three-vrm-animation");
    const TK = "https://cdn.jsdelivr.net/gh/tk256ailab/vrm-viewer@main/VRMA/";
    const GESTURES = {
      // 情境手勢 + 待機變化（body-only，不碰嘴）
      wave: TK + "Goodbye.vrma",
      bow: "https://cdn.jsdelivr.net/gh/hirokazuniimoto/virtual-avatar-sdk@main/assets/animations/quick_formal_bow.vrma",
      thinking: TK + "Thinking.vrma",
      look: TK + "LookAround.vrma",
      relax: TK + "Relax.vrma",
    };
    const TAP_GESTURES = ["wave", "bow"]; // 點一下隨機：揮手/鞠躬問候（歡迎感）

    const stage = document.getElementById("stage");
    const canvas = newCanvas();
    const r3 = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    r3.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r3.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
    camera.position.set(0, 1.4, 1.6);
    camera.lookAt(0, 1.3, 0);
    const resize = () => {
      const w = stage.clientWidth,
        h = stage.clientHeight;
      r3.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const scene = new THREE.Scene();
    // 調暗：原本 key=π / fill=π*0.35 / ambient=0.6 太亮（MToon 易過曝），整體降約 4 成
    const key = new THREE.DirectionalLight(0xffffff, Math.PI * 0.6);
    key.position.set(1, 1.5, 2);
    const fill = new THREE.DirectionalLight(0xfff0e8, Math.PI * 0.2);
    fill.position.set(-1.5, 0.5, 1);
    scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.38));
    const lookTarget = new THREE.Object3D();
    scene.add(lookTarget); // lookAt 目標：跟著滑鼠
    let mx = 0,
      my = 0; // 游標相對位置 -1..1
    const onMove = (ev) => {
      const r = stage.getBoundingClientRect();
      if (!r.width) return;
      mx = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1));
      my = Math.max(-1, Math.min(1, ((ev.clientY - r.top) / r.height) * 2 - 1));
    };
    window.addEventListener("pointermove", onMove);

    let vrm = null,
      armSign = 1,
      nextBlink = 2 + Math.random() * 3,
      blinkT = -1,
      mixer = null,
      waving = false;
    const BLINK = 0.12;
    const gestureActions = {};
    let currentGesture = null,
      idleBreak = 0;
    const clock = new THREE.Clock();
    const loader = new GLTFLoader();
    loader.register((p) => new VRMLoaderPlugin(p));
    loader.register((p) => new VRMAnimationLoaderPlugin(p)); // 同一個 loader 也能讀 .vrma
    loader.load(
      VRM_URL,
      (gltf) => {
        vrm = gltf.userData.vrm;
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        VRMUtils.combineMorphs(vrm);
        VRMUtils.rotateVRM0(vrm); // VRM0.x 轉正；VRM1 為安全 no-op
        // VRM0 被 rotateVRM0 轉 180°，手臂 z 旋轉方向會相反；VRM1 不轉 → 用版本決定正負號
        armSign = String(vrm.meta && vrm.meta.metaVersion) === "1" ? -1 : 1;
        vrm.scene.traverse((o) => {
          o.frustumCulled = false;
        });
        scene.add(vrm.scene);
        window.__avatarVrm = vrm;
        try {
          if (vrm.lookAt) vrm.lookAt.target = lookTarget;
        } catch (e) {} // 眼睛跟著滑鼠
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
                const a =
                  gg.userData.vrmAnimations && gg.userData.vrmAnimations[0];
                if (!a) continue;
                const act = mixer.clipAction(
                  bodyOnly(createVRMAnimationClip(a, vrm)),
                );
                act.setLoop(THREE.LoopOnce, 1);
                act.clampWhenFinished = true;
                gestureActions[name] = act;
              } catch (e) {
                console.warn("VRMA " + name + " 載入失敗：", e && e.message);
              }
            }
            mixer.addEventListener("finished", (e) => {
              // 手勢播完 → 立刻停、交回程序化站姿（不 fadeOut，避免露出 bind T-pose）
              if (e.action === currentGesture) {
                try {
                  e.action.stop();
                } catch (er) {}
                currentGesture = null;
                waving = false;
              }
            });
            gesture3D = playGesture; // 對外 hook：思考等時機可從對話流程觸發
            if (gestureActions.wave) setTimeout(() => playGesture("wave"), 800); // 出場招呼
            idleBreak = setInterval(() => {
              // 待機變化：偶爾環顧/放鬆，不死板
              if (!waving && !isSpeaking && Math.random() < 0.65)
                playGesture(Math.random() < 0.5 ? "look" : "relax");
            }, 15000);
          } catch (e) {
            console.warn("VRMA 手勢庫載入失敗：", e && e.message);
          }
        })();
        setTimeout(
          () =>
            showBubble(
              "點 🎤 說話、或直接打字問我；想更聰明可按 🧠 啟用 AI 大腦 👋",
            ),
          700,
        );
        postToParent("ready");
      },
      undefined,
      (e) => {
        console.error(e);
        postToParent("error", { message: String(e) });
      },
    );

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
      onTap();
    });

    let alive = true;
    (function loop() {
      if (!alive) return;
      requestAnimationFrame(loop);
      const dt = clock.getDelta(),
        t = clock.elapsedTime;
      if (vrm) {
        if (mixer) mixer.update(dt); // 揮手時 mixer 控身體
        const em = vrm.expressionManager;
        // 對嘴 + 眨眼（永遠歸我們，mixer 之後 vrm.update 之前）
        const mv = computeMouth();
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
          const h = vrm.humanoid;
          const lUA = h.getNormalizedBoneNode("leftUpperArm"),
            rUA = h.getNormalizedBoneNode("rightUpperArm"),
            sp = h.getNormalizedBoneNode("spine"),
            hd = h.getNormalizedBoneNode("head");
          let armL = 1.15 * armSign,
            armR = -1.15 * armSign;
          let spX = Math.sin(t * 0.9) * 0.018,
            spY = Math.sin(t * 0.5) * 0.012;
          let hdY = mx * 0.3,
            hdX = my * 0.12 + Math.sin(t * 0.5) * 0.01;
          if (isSpeaking) {
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
      r3.render(scene, camera);
    })();

    return {
      dispose() {
        alive = false;
        gesture3D = null;
        try {
          clearInterval(idleBreak);
        } catch (e) {}
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onMove);
        try {
          mixer && mixer.stopAllAction();
        } catch (e) {}
        try {
          if (vrm) VRMUtils.deepDispose(vrm.scene);
        } catch (e) {} // 釋放 3D 幾何/材質，避免殘骸與 WebGL context 累積
        try {
          r3.dispose();
        } catch (e) {}
        try {
          r3.forceContextLoss();
        } catch (e) {}
        canvas.remove();
        window.__avatarVrm = null;
      },
    };
  } catch (err) {
    console.error(err);
    postToParent("error", { message: err.message });
  }
}

// ===== 2D 皮：Live2D 載入 + 對嘴 =====
async function bootAvatar() {
  try {
    await loadUMD(); // 用到才載 pixi + live2d
    const Live2DModel = PIXI.live2d.Live2DModel;
    try {
      Live2DModel.registerTicker(PIXI.Ticker);
    } catch (e) {}

    const canvas = newCanvas();
    app = new PIXI.Application({
      view: canvas,
      autoStart: true,
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: document.getElementById("stage"),
    });

    model = await Live2DModel.from(MODEL_URL);
    app.stage.addChild(model);
    model.anchor.set(0.5, 1.0);

    // 關掉 Live2D 模型自帶的（日文）動作語音 — 只保留我們自己的 TTS（兩者來源不同，互不影響）
    try {
      if (PIXI.live2d.SoundManager) PIXI.live2d.SoundManager.volume = 0;
    } catch (e) {}
    try {
      const ms =
        (model.internalModel.settings &&
          model.internalModel.settings.motions) ||
        {};
      for (const g of Object.keys(ms))
        (ms[g] || []).forEach((d) => {
          delete d.Sound;
          delete d.sound;
        });
    } catch (e) {}

    // 取景：'half'=近距離半身（頭+上半身，腿裁掉，聊天頭像感）；'full'=全身。可用 ?fit=full / data-fit 切回
    const FIT_MODE = routeQuery.get("fit") || "half";
    function fit() {
      const w = app.renderer.width,
        h = app.renderer.height;
      const nativeH =
        (model.internalModel && model.internalModel.height) || 1000;
      if (FIT_MODE === "half") {
        const ZOOM = 1.9; // 放大倍率：越大越近（半身越緊）
        const s = (h / nativeH) * 0.95 * ZOOM;
        model.scale.set(s);
        model.x = w / 2;
        model.y = nativeH * s + h * 0.04; // 腳推到畫面外、頭留 4% 上緣
      } else {
        model.scale.set((h / nativeH) * 0.95);
        model.x = w / 2;
        model.y = h;
      }
    }
    fit();
    window.addEventListener("resize", fit);

    try {
      const groups = model.internalModel.settings.groups || [];
      const g = groups.find((x) => (x.Name || "").toLowerCase() === "lipsync");
      if (g && g.Ids && g.Ids.length) lipIds = g.Ids;
    } catch (e) {}

    // 對嘴：攔截 coreModel.update（計算頂點前的最後一刻寫入嘴巴，保證不被 motion/loadParameters 洗掉）
    try {
      const core = model.internalModel.coreModel;
      const origUpdate = core.update.bind(core);
      core.update = function () {
        const m = computeMouth(); // 共用嘴型計算（與 3D 同一套）
        for (const id of lipIds) {
          try {
            core.setParameterValueById(id, m);
          } catch (e) {}
        }
        return origUpdate();
      };
    } catch (e) {}

    model.on("hit", () => onTap());
    canvas.addEventListener("pointerdown", onTap);

    setTimeout(
      () =>
        showBubble(
          "點 🎤 說話、或直接打字問我；想更聰明可按 🧠 啟用 AI 大腦 👋",
        ),
      700,
    );
    postToParent("ready");
    window.__avatarModel = model;

    return {
      dispose() {
        try {
          window.removeEventListener("resize", fit);
        } catch (e) {}
        try {
          app &&
            app.destroy(true, {
              children: true,
              texture: true,
              baseTexture: true,
            });
        } catch (e) {}
        app = null;
        model = null;
        canvas.remove();
      },
    };
  } catch (err) {
    console.error(err);
    const w = document.getElementById("direct-warn");
    if (w) {
      w.textContent = "2D 啟動失敗：" + ((err && err.message) || err);
      w.style.display = "flex";
    }
    postToParent("error", { message: err.message });
  }
}

function onTap() {
  if (onTap._lock) return; // 去抖：hit 事件與 pointerdown 可能同時觸發
  onTap._lock = true;
  setTimeout(() => {
    onTap._lock = false;
  }, 400);
  if (model)
    try {
      model.motion("Tap");
    } catch (e) {}
  speak(
    "你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！",
  );
}

// ===== 控制列 =====
document.getElementById("btn-close").onclick = () => postToParent("close");

// 範例提示清單：一進站就告訴使用者「可以說什麼」，點任一項＝直接問（語音/打字都不用先猜）
(function renderSuggestions() {
  const box = document.getElementById("suggestions");
  if (!box) return;
  const SUGGESTIONS = [
    "怎麼安裝？",
    "怎麼換成我的角色？",
    "要不要錢？",
    "麥克風怎麼用？",
    "我可以說什麼？",
  ];
  const label = document.createElement("p");
  label.className = "sg-label";
  label.textContent = "💬 你可以問我：";
  box.appendChild(label);
  SUGGESTIONS.forEach((suggestion) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sugg";
    button.textContent = suggestion;
    button.onclick = () => handleUser(suggestion.replace(/？$/, ""));
    box.appendChild(button);
  });
})();
// 打字輸入：Enter 或 ➤ 送出。組字中（注音/拼音選字）按的 Enter 不送，避免誤發半成品
(function bindTyping() {
  const ti = document.getElementById("type-input");
  const send = () => {
    const t = ti.value.trim();
    if (!t) return;
    ti.value = "";
    handleUser(t);
  };
  document.getElementById("btn-send").onclick = send;
  ti.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      send();
    }
  });
})();
document.getElementById("btn-mic").onclick = () => startListening();
document.getElementById("btn-mute").onclick = () => {
  ttsMuted = !ttsMuted;
  const mb = document.getElementById("btn-mute");
  mb.textContent = ttsMuted ? "🔇" : "🔊";
  mb.setAttribute("aria-pressed", String(ttsMuted));
  if (ttsMuted) stopSpeaking(); // 立刻停掉正在播的（神經語音 + 瀏覽器語音）
  showBubble(ttsMuted ? "已靜音" : "已開啟語音");
};
document.getElementById("btn-speed").onclick = () => {
  const steps = [0.9, 1.0, 1.2, 1.4];
  ttsRate = steps[(steps.indexOf(ttsRate) + 1) % steps.length] || 1.0;
  document.getElementById("btn-speed").textContent = ttsRate.toFixed(1) + "×";
  showBubble("語速：" + ttsRate.toFixed(1) + "×");
};
document.getElementById("btn-llm").onclick = async () => {
  const btn = document.getElementById("btn-llm");
  // 啟用本機 Ollama 模式時：🧠 用來顯示狀態 / 重新連線，不下載 WebLLM
  if (window.OLLAMA && window.OLLAMA.enabled) {
    const ok = window.OLLAMA.ready || (await window.OLLAMA.ping());
    btn.textContent = ok ? "🧠本機" : "🧠✗";
    btn.classList.toggle("llm-on", ok);
    btn.setAttribute("aria-pressed", String(ok));
    showBubble(
      ok
        ? "本機 AI 大腦運作中（" + window.OLLAMA.model + "）🧠"
        : "本機 Ollama 連不上：確認 Ollama 在跑、且 OLLAMA_ORIGINS 已允許這個網站。",
    );
    return;
  }
  if (!window.LLM || !window.LLM.supported) {
    showBubble("這個裝置不支援 WebGPU，先用知識庫模式就好（功能一樣可用）。");
    return;
  }
  if (window.LLM.state === STATE_MAP.READY) {
    showBubble("AI 大腦已啟用，問我問題吧 🧠");
    return;
  }
  if (window.LLM.state === STATE_MAP.LOADING) {
    showBubble("AI 大腦載入中… " + Math.round(window.LLM.progress * 100) + "%");
    return;
  }
  showBubble("開始下載 AI 大腦（約 1GB，只需第一次）…");
  try {
    await window.LLM.load((p) => {
      btn.textContent = "🧠 " + Math.round((p.progress || 0) * 100) + "%";
    });
    btn.textContent = "🧠✓";
    btn.classList.add("llm-on");
    speak("AI 大腦啟用完成，現在我可以聊得更自然囉！");
  } catch (e) {
    btn.textContent = "🧠✗";
    showBubble("AI 大腦載入失敗：" + ((e && e.message) || e));
  }
};

// 啟用本機 Ollama 時：開機 ping 一下，連上就把 🧠 切成「本機大腦」狀態
(async function initOllama() {
  if (!window.OLLAMA || !window.OLLAMA.enabled) return;
  const btn = document.getElementById("btn-llm");
  if (btn) {
    btn.textContent = "🧠…";
    btn.title = "本機 Ollama 大腦（連線中）";
  }
  const ok = await window.OLLAMA.ping();
  if (btn) {
    btn.textContent = ok ? "🧠本機" : "🧠✗";
    btn.classList.toggle("llm-on", ok);
    btn.setAttribute("aria-pressed", String(ok));
    btn.title = ok
      ? "本機 Ollama：已連線 " + window.OLLAMA.model
      : "本機 Ollama 連不上（檢查 Ollama 是否在跑 / CORS）";
  }
  if (ok)
    setTimeout(
      () =>
        showBubble(
          "已接上本機 AI 大腦（" + window.OLLAMA.model + "）🧠 問我問題吧！",
        ),
      1300,
    );
})();
