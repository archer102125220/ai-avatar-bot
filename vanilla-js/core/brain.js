// brain.js
export const STATE_MAP = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error'
};
// brain.js
export const AVATAR_MODE_MAP = {
  companion: 'companion',
  assistant: 'assistant'
};
export const DEFAULT_AVATAR_MODE = AVATAR_MODE_MAP.assistant;

// brain.js
export const DEFAULT_LLM_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:latest';

// brain.js
export async function handleGetKnowledge(knowledgeUrl = '') {
  try {
    if (typeof knowledgeUrl === 'string' && knowledgeUrl !== '') {
      const knowledge = await fetch(knowledgeUrl).then((response) => {
        if (typeof response?.json === 'function') {
          return response.json();
        }
        return response || [];
      });
      if (Array.isArray(knowledge) === false) {
        throw new Error(
          '[aiAvatar handleGetKnowledge] Knowledge is not an array'
        );
      }
      return knowledge;
    }
  } catch (_error) {}
  return [];
}

// brain.js
export function initLLM(llmModel = DEFAULT_LLM_MODEL) {
  let engine = null;
  let loadingPromise = null;

  const LLM = {
    supported: 'gpu' in navigator,
    state: STATE_MAP.IDLE, // idle | loading | ready | error
    progress: 0,
    model: llmModel || DEFAULT_LLM_MODEL,
    async load(onProgress) {
      if (engine) return engine;
      if (loadingPromise) return loadingPromise;
      this.state = STATE_MAP.LOADING;
      loadingPromise = import('@mlc-ai/web-llm') // 動態載入：只有按下🧠才抓這包函式庫
        .then((webllm) =>
          webllm.CreateMLCEngine(llmModel, {
            initProgressCallback: (p) => {
              this.progress = p.progress || 0;
              if (typeof onProgress === 'function') {
                onProgress(p);
              }
            }
          })
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
    async chat(messages, onDelta) {
      if (!engine) {
        return null;
      }
      if (!onDelta) {
        const result = await engine.chat.completions.create({
          messages,
          temperature: 0.4,
          max_tokens: 220
        });
        return result?.choices?.[0]?.message?.content;
      }
      // 串流：邊生成邊回吐 token（逐句開講用）——首句不用等整段生成完
      const stream = await engine.chat.completions.create({
        messages,
        temperature: 0.4,
        max_tokens: 220,
        stream: true
      });
      let fullResponse = '';
      for await (const chunk of stream) {
        const content = chunk?.choices?.[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          onDelta(content, fullResponse);
        }
      }
      return fullResponse;
    }
  };

  return LLM;
}

// brain.js
export function initOLLAMA(ollamaUrl = '', ollamaModel = DEFAULT_OLLAMA_MODEL) {
  const OLLAMA = {
    base: ollamaUrl,
    model: ollamaModel || DEFAULT_OLLAMA_MODEL,
    enabled: !!ollamaUrl,
    ready: false,
    async ping() {
      if (!this.enabled) {
        return false;
      }
      try {
        const response = await fetch(
          this.base.replace(/\/v1$/, '') + '/api/tags'
        );
        this.ready = response.ok;
        return response.ok;
      } catch (_error) {
        this.ready = false;
        return false;
      }
    },
    async chat(messages) {
      const response = await fetch(this.base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.4,
          max_tokens: 220,
          stream: false
        })
      });
      if (response.ok !== true) {
        throw new Error('http ' + response.status);
      }
      const result = await response.json();
      return result?.choices?.[0]?.message?.content;
    }
  };
  return OLLAMA;
}

// brain.js
export function initMEM(avatarMode) {
  // 記憶（陪伴模式限定）：只存訪客自己瀏覽器的 localStorage，零後端、不上傳；說「忘記我」即清除
  const MEM = {
    key: 'avatar-widget-mem',
    // on: avatarMode === AVATAR_MODE_MAP.companion,
    isCompanion: avatarMode === AVATAR_MODE_MAP.companion,
    data: { name: '', visits: 0, last: 0, history: [] },
    load() {
      if (!this.isCompanion) return;
      try {
        const localData = JSON.parse(localStorage.getItem(this.key) || 'null');
        if (typeof localData === 'object') {
          this.data = Object.assign(this.data, localData);
        }
      } catch (_error) {}
      this.data.visits = (this.data.visits || 0) + 1;
      this.save();
    },
    save() {
      if (!this.isCompanion) return;
      try {
        this.data.last = Date.now();
        localStorage.setItem(this.key, JSON.stringify(this.data));
      } catch (_error) {}
    },
    addTurn(role, content) {
      if (!this.isCompanion || !content) {
        return;
      }
      this.data.history.push({ role, content: String(content).slice(0, 200) });
      if (this.data.history.length > 12) {
        this.data.history.splice(0, this.data.history.length - 12); // 只留最近 6 輪
      }
      this.save();
    },
    captureName(text) {
      if (!this.isCompanion) {
        return;
      }
      const m = /(?:我叫|我是|叫我)\s*([^\s，。、,.!！?？的]{1,10})/.exec(
        text || ''
      );
      if (m && !/誰|什麼|不知|沒有/.test(m[1])) {
        this.data.name = m[1];
        this.save();
      }
    },
    wipe() {
      this.data = { name: '', visits: 1, last: 0, history: [] };
      try {
        localStorage.removeItem(this.key);
      } catch (_error) {}
    }
  };
  MEM.load();

  return MEM;
}

export function initBrainEngine(seting = {}) {
  const brain = {
    LLM: initLLM(seting.llmModel),
    MEM: initMEM(seting.avatarMode),
    OLLAMA: initOLLAMA(seting.ollamaUrl, seting.ollamaModel)
  };
  return brain;
}
