// M4b：WebLLM（瀏覽器內跑小模型，零金鑰）。函式庫改成「按下🧠才動態 import」，
//    一般訪客（不啟用大腦）不會下載這包 JS。控制權掛到 window.LLM。

// const LLM_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"; // 中文不錯、約 1.1GB、首次下載後會被快取
const LLM_MODEL = "gemma-2-2b-it-q4f32_1-MLC"; // Google 公開模型
const STATE_MAP = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
};

const routeQuery = new URLSearchParams(window.location.search);

function initLLM(llmModel = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC") {
  let engine = null;
  let loadingPromise = null;
  const LLM = {
    supported: "gpu" in window.navigator,
    state: STATE_MAP.IDLE, // idle | loading | ready | error
    progress: 0,
    model: llmModel,
    async load(onProgress) {
      if (engine) return engine;
      if (loadingPromise) return loadingPromise;
      window.LLM.state = STATE_MAP.LOADING;
      loadingPromise = import("@mlc-ai/web-llm") // 動態載入：只有按下🧠才抓這包函式庫
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
