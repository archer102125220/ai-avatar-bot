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
export function initLLM(setting = {}, brain) {
  const {
    llmModel = DEFAULT_LLM_MODEL,
    onLoading,
    onLoadProgress,
    onLoaded,
    onLoadError
  } = setting;

  let engine = null;
  let loadingPromise = null;

  const llm = {
    get supported() {
      return 'gpu' in navigator;
    },
    state: STATE_MAP.IDLE, // idle | loading | ready | error
    progress: 0,
    model: llmModel || DEFAULT_LLM_MODEL,

    get onLoading() {
      return function _onLoading(...arg) {
        if (typeof onLoading === 'function') {
          onLoading(...arg);
        }
      };
    },
    get onLoadProgress() {
      return function _onLoadProgress(...arg) {
        if (typeof onLoadProgress === 'function') {
          onLoadProgress(...arg);
        }
      };
    },
    get onLoaded() {
      return function _onLoaded(...arg) {
        if (typeof onLoaded === 'function') {
          onLoaded(...arg);
        }
      };
    },
    get onLoadError() {
      return function _onLoadError(...arg) {
        if (typeof onLoadError === 'function') {
          onLoadError(...arg);
        }
      };
    },
    async load() {
      if (engine) return engine;
      if (loadingPromise) return loadingPromise;
      this.state = STATE_MAP.LOADING;
      this.onLoading();
      loadingPromise = import('@mlc-ai/web-llm') // 動態載入：只有按下🧠才抓這包函式庫
        .then((webllm) => {
          return webllm.CreateMLCEngine(llmModel, {
            initProgressCallback: (p) => {
              this.progress = p.progress || 0;
              this.onLoadProgress(p);
            }
          });
        })
        .then((mlcEngine) => {
          engine = mlcEngine;
          this.state = STATE_MAP.READY;
          this.onLoaded(mlcEngine);
          return mlcEngine;
        })
        .catch((error) => {
          this.state = STATE_MAP.ERROR;
          this.error = String(error);
          this.onLoadError(error, this);
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
export async function initAiProvider(setting = {}) {
  const {
    providerBaseUrl = '',
    providerPingUrl = '',
    providerChatUrl = '',
    providerModel = DEFAULT_AI_PROVIDER_MODEL,
    providerCreatedFetchSetting = null,
    providerCreatedFetchPayload = null,
    providerResponesFormat = null,

    providerMaxTokens = 2048,
    providerStream = false,

    onConnecting = null,
    onConnected = null,
    onError = null
  } = setting;

  const aiProvider = {
    base: providerBaseUrl,
    pingUrl: providerPingUrl,
    chatUrl: providerChatUrl,

    get createdFetchSetting() {
      return providerCreatedFetchSetting;
    },
    get createdFetchPayload() {
      return providerCreatedFetchPayload;
    },
    get responesFormat() {
      return providerResponesFormat;
    },
    get maxTokens() {
      return providerMaxTokens;
    },
    get stream() {
      return providerStream;
    },

    get onConnecting() {
      return onConnecting;
    },
    get onConnected() {
      return onConnected;
    },
    get onError() {
      return onError;
    },

    model: providerModel || DEFAULT_AI_PROVIDER_MODEL,
    enabled: !!providerBaseUrl,
    ready: false,
    async ping(fetchSetting = null) {
      if (!this.enabled) {
        return false;
      }
      try {
        await this.onConnecting(fetchSetting, this);
        const response = await fetch(
          this.base + (this.pingUrl || '/api/tags'),
          fetchSetting
        );
        this.ready = response.ok;
        await this.onConnected(response, fetchSetting, this);
        return response.ok;
      } catch (error) {
        console.error(error);
        this.ready = false;
        await this.onError(error, fetchSetting, this);
        return false;
      }
    },
    async chat(messages, fetchSetting) {
      const defaultFetchSetting = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };
      // TODO: 可以傳遞參數的方式在初始化時設定 max_tokens 及 stream
      const defaultPaylaod = {
        model: this.model,
        messages,
        temperature: 0.4,
        max_tokens: this.maxTokens,
        stream: this.stream
      };

      if (typeof this.createdFetchSetting === 'function') {
        const currentFetchSetting = await this.createdFetchSetting(
          messages,
          this.model,
          defaultFetchSetting,
          this
        );
        if (typeof currentFetchSetting === 'object') {
          fetchSetting = currentFetchSetting;
        }
      }

      if (typeof fetchSetting !== 'object') {
        fetchSetting = defaultFetchSetting;
      }

      if (typeof this.createdFetchPayload === 'function') {
        const currentPayload = await this.createdFetchPayload(
          messages,
          this.model,
          defaultPaylaod,
          fetchSetting,
          this
        );
        if (typeof currentPayload !== 'undefined') {
          fetchSetting.body = currentPayload;
        }
      }

      if (typeof fetchSetting.body === 'undefined') {
        fetchSetting.body = JSON.stringify(defaultPaylaod);
      }

      const response = await fetch(
        this.base + (this.chatUrl || '/chat/completions'),
        fetchSetting
      );
      // if (response.ok !== true) {
      //   throw new Error('http ' + response.status);
      // }

      console.log({ response });

      if (typeof this.responesFormat === 'function') {
        return await this.responesFormat(
          response,
          fetchSetting,
          messages,
          this
        );
      }

      const result = await response.json();

      console.log({ result });
      return result?.choices?.[0]?.message?.content;
    }
  };

  // 啟用本機 Ollama 時：開機 ping 一下，連上就把 🧠 切成「本機大腦」狀態
  if (aiProvider?.enabled === true) {
    await aiProvider.ping();
  }

  return aiProvider;
}

// brain.js
export function initMEM({ avatarMode }) {
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

export async function initBrainEngine(seting = {}, aiAvatarWidget = null) {
  const {
    llmModel,
    avatarMode,
    knowledge = [],
    knowledgeUrl,
    companionKnowledge = [],
    companionKnowledgeUrl,
    companionFallback,
    aiProviderModel,
    aiProviderBaseUrl,

    welcomeText = null,
    companionWelcomeText = null,
    assistantWelcomeText = null,

    onLlmLoading,
    onLlmLoadProgress,
    onLlmLoaded,
    onLlmLoadError,

    onAiProviderConnecting,
    onAiProviderConnected,
    onAiProviderError,

    aiProviderCreatedFetchSetting,
    aiProviderCreatedFetchPayload,
    aiProviderPingUrl,
    aiProviderChatUrl,
    aiProviderMaxTokens,
    aiProviderStream
  } = seting;

  let llm = null;
  let mem = null;
  let aiProvider = null;

  const safeKnowledge =
    Array.isArray(knowledge) && knowledge.length > 0
      ? knowledge
      : await handleGetKnowledge(knowledgeUrl);
  const safeCompanionKnowledge =
    Array.isArray(companionKnowledge) && companionKnowledge.length > 0
      ? companionKnowledge
      : await handleGetKnowledge(companionKnowledgeUrl);

  const brain = {
    get STATE_MAP() {
      return STATE_MAP;
    },
    get AVATAR_MODE_MAP() {
      return AVATAR_MODE_MAP;
    },
    get DEFAULT_AVATAR_MODE() {
      return DEFAULT_AVATAR_MODE;
    },
    get DEFAULT_LLM_MODEL() {
      return DEFAULT_LLM_MODEL;
    },
    get DEFAULT_AI_PROVIDER_MODEL() {
      return DEFAULT_AI_PROVIDER_MODEL;
    },

    get knowledgeUrl() {
      return knowledgeUrl;
    },
    knowledge: safeKnowledge,
    get companionKnowledgeUrl() {
      return companionKnowledgeUrl;
    },
    companionKnowledge: safeCompanionKnowledge,
    companionFallback,
    companionFallbackIdx: 0,

    onLlmLoading: null,
    onLlmLoadProgress: null,
    onLlmLoaded: null,
    onLlmLoadError: null,

    onAiProviderConnecting: null,
    onAiProviderConnected: null,
    onAiProviderError: null,

    _welcomeText: null,
    get welcomeText() {
      return this._welcomeText;
    },
    set welcomeText(newWelcomeText) {
      if (typeof newWelcomeText === 'function' || newWelcomeText === null) {
        this._welcomeText = newWelcomeText;
      }
    },

    _companionWelcomeText: null,
    get companionWelcomeText() {
      return this._companionWelcomeText;
    },
    set companionWelcomeText(newCompanionWelcomeText) {
      if (
        typeof newCompanionWelcomeText === 'function' ||
        typeof newCompanionWelcomeText === 'string' ||
        newCompanionWelcomeText === null
      ) {
        this._companionWelcomeText = newCompanionWelcomeText;
      }
    },

    _assistantWelcomeText: null,
    get assistantWelcomeText() {
      return this._assistantWelcomeText;
    },
    set assistantWelcomeText(newAssistantWelcomeText) {
      if (
        typeof newAssistantWelcomeText === 'function' ||
        typeof newAssistantWelcomeText === 'string' ||
        newAssistantWelcomeText === null
      ) {
        this._assistantWelcomeText = newAssistantWelcomeText;
      }
    },

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

  if (typeof welcomeText === 'function') {
    brain.welcomeText = welcomeText.bind(aiAvatarWidget);
  } else if (typeof welcomeText === 'string') {
    brain.welcomeText = welcomeText;
  }
  if (typeof companionWelcomeText === 'function') {
    brain.companionWelcomeText = companionWelcomeText.bind(aiAvatarWidget);
  } else if (typeof companionWelcomeText === 'string') {
    brain.companionWelcomeText = companionWelcomeText;
  }
  if (typeof assistantWelcomeText === 'function') {
    brain.assistantWelcomeText = assistantWelcomeText.bind(aiAvatarWidget);
  } else if (typeof assistantWelcomeText === 'string') {
    brain.assistantWelcomeText = assistantWelcomeText;
  }

  if (typeof onLlmLoading === 'function') {
    brain.onLlmLoading = onLlmLoading.bind(brain);
  }

  if (typeof onLlmLoadProgress === 'function') {
    brain.onLlmLoadProgress = onLlmLoadProgress.bind(brain);
  }

  if (typeof onLlmLoaded === 'function') {
    brain.onLlmLoaded = onLlmLoaded.bind(brain);
  }

  if (typeof onLlmLoadError === 'function') {
    brain.onLlmLoadError = onLlmLoadError.bind(brain);
  }

  if (typeof onAiProviderConnecting === 'function') {
    brain.onAiProviderConnecting = onAiProviderConnecting.bind(brain);
  }

  if (typeof onAiProviderConnected === 'function') {
    brain.onAiProviderConnected = onAiProviderConnected.bind(brain);
  }

  if (typeof onAiProviderError === 'function') {
    brain.onAiProviderError = onAiProviderError.bind(brain);
  }

  llm = initLLM(
    {
      llmModel,
      onLoading(...arg) {
        return brain.onLlmLoading?.(...arg, aiAvatarWidget);
      },
      onLoadProgress(...arg) {
        return brain.onLlmLoadProgress?.(...arg, aiAvatarWidget);
      },
      onLoaded(...arg) {
        return brain.onLlmLoaded?.(...arg, aiAvatarWidget);
      },
      onLoadError(...arg) {
        return brain.onLlmLoadError?.(...arg, aiAvatarWidget);
      }
    },
    brain
  );
  mem = initMEM({ avatarMode });
  aiProvider = await initAiProvider({
    providerModel: aiProviderModel,
    providerCreatedFetchSetting: aiProviderCreatedFetchSetting,
    providerCreatedFetchPayload: aiProviderCreatedFetchPayload,
    providerBaseUrl: aiProviderBaseUrl,
    providerPingUrl: aiProviderPingUrl,
    providerChatUrl: aiProviderChatUrl,
    providerMaxTokens: aiProviderMaxTokens,
    providerStream: aiProviderStream,
    onConnecting(...arg) {
      return brain.onAiProviderConnecting?.(...arg, aiAvatarWidget);
    },
    onConnected(...arg) {
      return brain.onAiProviderConnected?.(...arg, aiAvatarWidget);
    },
    onError(...arg) {
      return brain.onAiProviderError?.(...arg, aiAvatarWidget);
    }
  });

  return brain;
}
