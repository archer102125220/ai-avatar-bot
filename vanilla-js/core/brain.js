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
export const DEFAULT_AI_PROVIDER_MODEL = 'qwen2.5:latest';

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
export function initLLM(llmModel = DEFAULT_LLM_MODEL, brain) {
  let engine = null;
  let loadingPromise = null;

  const llm = {
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
                onProgress(p, brain);
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
          onDelta(content, fullResponse, llm, brain);
        }
      }
      return fullResponse;
    }
  };

  return llm;
}

// brain.js
export function initAiProvider(setting = {}, brain) {
  const {
    providerBaseUrl = '',
    providerPingUrl = '',
    providerChatUrl = '',
    providerModel = DEFAULT_AI_PROVIDER_MODEL,
    providerCreatedFetchSetting = null,
    providerCreatedFetchPayload = null,
    providerResponesFormat = null
  } = setting;

  const aiProvider = {
    base: providerBaseUrl,
    pingUrl: providerPingUrl,
    chatUrl: providerChatUrl,

    model: providerModel || DEFAULT_AI_PROVIDER_MODEL,
    enabled: !!providerBaseUrl,
    ready: false,
    async ping(fetchSetting = null) {
      if (!this.enabled) {
        return false;
      }
      try {
        const response = await fetch(
          this.base + (this.pingUrl || '/api/tags'),
          fetchSetting
        );
        this.ready = response.ok;
        return response.ok;
      } catch (_error) {
        this.ready = false;
        return false;
      }
    },
    async chat(messages, fetchSetting) {
      const defaultFetchSetting = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };
      const defaultPaylaod = {
        model: this.model,
        messages,
        temperature: 0.4,
        max_tokens: 220,
        stream: false
      };

      if (typeof this.createdFetchSetting === 'function') {
        const currentFetchSetting = this.createdFetchSetting(
          messages,
          defaultFetchSetting
        );
        if (typeof currentFetchSetting === 'object') {
          fetchSetting = currentFetchSetting;
        }
      }

      if (typeof fetchSetting !== 'object') {
        fetchSetting = defaultFetchSetting;
      }

      if (typeof fetchSetting?.body === 'undefined') {
        if (typeof this.createdFetchPayload === 'function') {
          const currentPayload = this.createdFetchPayload(
            messages,
            defaultPaylaod,
            fetchSetting
          );
          if (typeof currentPayload !== 'undefined') {
            fetchSetting.body = currentPayload;
          }
        } else {
          fetchSetting.body = JSON.stringify(defaultPaylaod);
        }
      }

      const response = await fetch(
        this.base + (this.chatUrl || '/chat/completions'),
        fetchSetting
      );
      // if (response.ok !== true) {
      //   throw new Error('http ' + response.status);
      // }

      if (typeof this.responesFormat === 'function') {
        return await this.responesFormat(
          response,
          fetchSetting,
          messages,
          this
        );
      }

      const result = await response.json();
      return result?.choices?.[0]?.message?.content;
    }
  };

  aiProvider.createdFetchSetting = function (...arg) {
    if (typeof providerCreatedFetchSetting === 'function') {
      providerCreatedFetchSetting.call(this, ...arg, this, brain);
    }
  }.bind(aiProvider);

  aiProvider.createdFetchPayload = function (...arg) {
    if (typeof providerCreatedFetchPayload === 'function') {
      providerCreatedFetchPayload.call(this, ...arg, this, brain);
    }
  }.bind(aiProvider);

  aiProvider.responesFormat = function (...arg) {
    if (typeof providerResponesFormat === 'function') {
      providerResponesFormat.call(this, ...arg, this, brain);
    }
  }.bind(aiProvider);

  return aiProvider;
}

// brain.js
export function initMEM(avatarMode, brain) {
  // 記憶（陪伴模式限定）：只存訪客自己瀏覽器的 localStorage，零後端、不上傳；說「忘記我」即清除
  const mem = {
    key: 'avatar-widget-mem',
    // on: avatarMode === AVATAR_MODE_MAP.companion,
    isCompanion: avatarMode === AVATAR_MODE_MAP.companion,
    data: { name: '', visits: 0, last: 0, history: [] },
    load() {
      if (this.isCompanion === false) {
        return;
      }
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
      if (this.isCompanion === false) {
        return;
      }
      try {
        this.data.last = Date.now();
        localStorage.setItem(this.key, JSON.stringify(this.data));
      } catch (_error) {}
    },
    addTurn(role, content) {
      if (this.isCompanion === false || !content) {
        return;
      }
      this.data.history.push({ role, content: String(content).slice(0, 200) });
      if (this.data.history.length > 12) {
        this.data.history.splice(0, this.data.history.length - 12); // 只留最近 6 輪
      }
      this.save();
    },
    captureName(text) {
      if (this.isCompanion === false) {
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
  mem.load();

  return mem;
}

export function initBrainEngine(seting = {}) {
  const {
    llmModel,
    avatarMode,
    onConnecting,
    onConnected,
    onDisconnecting,
    aiProviderModel,
    aiProviderCreatedFetchSetting,
    aiProviderCreatedFetchPayload,
    aiProviderBaseUrl,
    aiProviderPingUrl,
    aiProviderChatUrl
  } = seting;

  const brain = {
    onConnecting: null,
    onConnected: null,
    onDisconnecting: null,

    _connecting: false,
    get connecting() {
      return this._connecting;
    },
    set connecting(value) {
      this._connecting = value;
      if (value === false) return;

      if (typeof this.onConnecting === 'function') {
        this.onConnecting(this);
      }
    },
    _connected: false,
    get connected() {
      return this._connected;
    },
    set connected(value) {
      this._connected = value;
      if (value === false) return;

      if (typeof this.onConnected === 'function') {
        this.onConnected(this);
      }
    },
    _disconnecting: false,
    get disconnecting() {
      return this._disconnecting;
    },
    set disconnecting(value) {
      this._disconnecting = value;
      if (value === false) return;

      if (typeof this.onDisconnecting === 'function') {
        this.onDisconnecting(this);
      }
    }
  };

  const llm = initLLM(llmModel, brain);
  const mem = initMEM(avatarMode, brain);
  const aiProvider = initAiProvider(
    {
      providerModel: aiProviderModel,
      providerCreatedFetchSetting: aiProviderCreatedFetchSetting,
      providerCreatedFetchPayload: aiProviderCreatedFetchPayload,
      providerBaseUrl: aiProviderBaseUrl,
      providerPingUrl: aiProviderPingUrl,
      providerChatUrl: aiProviderChatUrl
    },
    brain
  );

  if (typeof onConnecting === 'function') {
    brain.onConnecting = onConnecting.bind(brain);
  }

  if (typeof onConnected === 'function') {
    brain.onConnected = onConnected.bind(brain);
  }

  if (typeof onDisconnecting === 'function') {
    brain.onDisconnecting = onDisconnecting.bind(brain);
  }

  return {
    ...brain,
    get llm() {
      return llm;
    },
    get mem() {
      return mem;
    },
    get aiProvider() {
      return aiProvider;
    }
  };
}
