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

export const EMO_TARGET_MAP = {
  happy: 0.65,
  surprised: 0.6,
  sad: 0.5
};

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
// ===== 大腦：M4 檢索 + M4b（WebLLM）生成 =====
// 中文不好斷詞，改用「字元 bigram（相鄰兩字）」相似度，對中文很有效、又不用任何函式庫。
export function bigrams(s) {
  s = (s || '').toLowerCase().replace(/[\s，。、？！,.?!~～]/g, '');
  const g = [];
  for (let i = 0; i < s.length - 1; i++) {
    g.push(s.slice(i, i + 2));
  }
  if (s.length === 1) {
    g.push(s);
  }
  return g;
}

// brain.js
export function similarity(query, text) {
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

// brain.js
export function scoreEntry(question, e) {
  let score = Math.max(
    similarity(question, e.q),
    similarity(question, e.kw || '')
  );
  const terms = (e.kw || '').split(/\s+/).filter(Boolean);
  for (const item of terms) {
    if (item.length >= 2 && question.includes(item)) {
      score = Math.max(score, 0.5 + item.length * 0.04);
    }
  }
  return score;
}

// brain.js
export function topK(aiAvatarWidget = null, question, k) {
  const knowledge = aiAvatarWidget?.brainEngine?.knowledge || [];

  return knowledge
    .map((e) => ({ e, s: scoreEntry(question, e) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .filter((x) => x.s > 0.05)
    .map((x) => x.e);
}

// brain.js
export function initLLM(setting = {}, brain) {
  const {
    llmModel = DEFAULT_LLM_MODEL,
    LLMMaxTokens = 220,
    LLMIsStream = true,
    onLoading,
    onLoadProgress,
    onLoaded,
    onLoadError,
    onChatting,
    onStreamChatting
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

    get maxTokens() {
      return LLMMaxTokens;
    },
    get isStream() {
      return LLMIsStream;
    },

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
    get onChatting() {
      return function _onChating(...arg) {
        if (typeof onChatting === 'function') {
          onChatting(...arg);
        }
      };
    },
    get onStreamChatting() {
      return function _onStreamChatting(...arg) {
        if (typeof onStreamChatting === 'function') {
          onStreamChatting(...arg);
        }
      };
    },
    async load() {
      if (engine) return engine;
      if (loadingPromise) return loadingPromise;
      this.state = STATE_MAP.LOADING;
      this.onLoading();

      loadingPromise = (async () => {
        try {
          const webllm = await import('@mlc-ai/web-llm'); // 動態載入：只有按下🧠才抓這包函式庫
          engine = await webllm.CreateMLCEngine(llmModel, {
            initProgressCallback: (p) => {
              this.progress = p.progress || 0;
              this.onLoadProgress(p);
            }
          });

          this.state = STATE_MAP.READY;

          this.onLoaded(engine);
        } catch (error) {
          this.state = STATE_MAP.ERROR;
          this.error = String(error);
          this.onLoadError(error, this);
          throw error;
        }
      })();

      return loadingPromise;
    },
    async chat(messages, onDelta) {
      if (!engine) {
        return null;
      }

      if (!onDelta || this.isStream === false) {
        const result = await engine.chat.completions.create({
          messages,
          temperature: 0.4,
          max_tokens: this.maxTokens
        });

        this.onChatting(result, messages, brain);
        return result?.choices?.[0]?.message?.content;
      }

      // 串流：邊生成邊回吐 token（逐句開講用）——首句不用等整段生成完
      const stream = await engine.chat.completions.create({
        messages,
        temperature: 0.4,
        max_tokens: this.maxTokens,
        stream: true
      });
      let fullResponse = '';
      for await (const chunk of stream) {
        const content = chunk?.choices?.[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          onDelta(content, fullResponse, llm, brain);
          this.onStreamChatting(content, fullResponse, brain);
        }
      }

      this.onChatting(fullResponse, messages, brain);
      return fullResponse;
    }
  };

  return llm;
}

// brain.js
export async function getWelcomeText(aiAvatarWidget = null) {
  let welcomeText =
    '點 🎤 說話、或直接打字問我；想更聰明可按 🧠 啟用 AI 大腦 👋';

  if (typeof aiAvatarWidget?.brainEngine?.welcomeText === 'function') {
    welcomeText = await aiAvatarWidget.brainEngine.welcomeText(
      {
        isCompanion: aiAvatarWidget.brainEngine.mem.isCompanion,
        visits: aiAvatarWidget.brainEngine.mem.data.visits,
        name: aiAvatarWidget.brainEngine.mem.data.name
      },
      aiAvatarWidget
    );
  } else if (typeof aiAvatarWidget?.brainEngine?.welcomeText === 'string') {
    welcomeText = aiAvatarWidget.brainEngine.welcomeText;
  } else if (aiAvatarWidget?.avatarMode === AVATAR_MODE_MAP.companion) {
    if (
      typeof aiAvatarWidget?.brainEngine?.companionWelcomeText === 'function'
    ) {
      welcomeText =
        await aiAvatarWidget.brainEngine.companionWelcomeText(aiAvatarWidget);
    } else if (aiAvatarWidget.brainEngine.mem.data.visits > 1) {
      welcomeText =
        (aiAvatarWidget.brainEngine.mem.data.name
          ? aiAvatarWidget.brainEngine.mem.data.name + '，'
          : '') +
        '歡迎回來～這是我們第 ' +
        aiAvatarWidget.brainEngine.mem.data.visits +
        ' 次見面！點 💬 繼續聊，我記得我們聊過什麼喔';
    } else if (
      typeof aiAvatarWidget.brainEngine.companionWelcomeText === 'string'
    ) {
      welcomeText = aiAvatarWidget.brainEngine.companionWelcomeText;
    } else {
      welcomeText =
        '嗨～我是這裡的陪聊虛擬人！點 💬 就能連續對話，我會記得你說過的話（只存在你這台瀏覽器，說『忘記我』就清掉）';
    }
  } else if (
    typeof aiAvatarWidget?.brainEngine?.assistantWelcomeText === 'function'
  ) {
    welcomeText =
      await aiAvatarWidget.brainEngine.assistantWelcomeText(aiAvatarWidget);
  } else if (
    typeof aiAvatarWidget?.brainEngine?.assistantWelcomeText === 'string'
  ) {
    welcomeText = aiAvatarWidget.brainEngine.assistantWelcomeText;
  }

  return welcomeText;
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
    providerIsStream = false,

    onConnecting = null,
    onConnected = null,
    onError = null,
    onChatting = null,
    onStreamChatting = null
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
    get isStream() {
      return providerIsStream;
    },

    get onConnecting() {
      return function _onConnecting(...arg) {
        if (typeof onConnecting === 'function') {
          onConnecting(...arg);
        }
      };
    },
    get onConnected() {
      return function _onConnected(...arg) {
        if (typeof onConnected === 'function') {
          onConnected(...arg);
        }
      };
    },
    get onError() {
      return function _onError(...arg) {
        if (typeof onError === 'function') {
          onError(...arg);
        }
      };
    },
    get onChatting() {
      return function _onChating(...arg) {
        if (typeof onChatting === 'function') {
          onChatting(...arg);
        }
      };
    },
    get onStreamChatting() {
      return function _onStreamChatting(...arg) {
        if (typeof onStreamChatting === 'function') {
          onStreamChatting(...arg);
        }
      };
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
      try {
        const defaultFetchSetting = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };
        // TODO: 調整成支援 stream 的模式
        const defaultPaylaod = {
          model: this.model,
          messages,
          temperature: 0.4,
          max_tokens: this.maxTokens,
          stream: this.isStream
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
      } catch (error) {
        this.ready = false;
        throw error;
      }
    }
  };

  // 啟用本機 AI 伺服器時：開機 ping 一下，連上就把 🧠 切成「AI 伺服器大腦」狀態
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

// brain.js
// 從回答文字粗判情緒（規則式、零成本；驚訝 > 難過 > 開心 > 中性）
export function classifyEmotion(text) {
  const safeText = String(text || '');
  const countPattern = (regex) => (safeText.match(regex) || []).length;
  const surprised = countPattern(/哇|居然|竟然|沒想到|驚|真的嗎|！？|\?!|!\?/g);
  const sad = countPattern(
    /抱歉|對不起|可惜|遺憾|失敗|錯誤|沒辦法|不支援|不行|連不上|難過|唉/g
  );
  const happy = countPattern(
    /哈|笑|開心|太好了|好耶|讚|恭喜|歡迎|謝謝|沒問題|完成|成功|一起|囉|喔！|🎉|😊|👋/g
  );
  if (surprised && surprised >= Math.max(happy, sad)) {
    return 'surprised';
  }
  if (sad > happy) {
    return 'sad';
  }
  if (happy) {
    return 'happy';
  }
  return 'neutral';
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

    LLMMaxTokens,
    LLMIsStream,
    onLlmLoading,
    onLlmLoadProgress,
    onLlmLoaded,
    onLlmLoadError,
    onLlmChatting,
    onLlmStreamChatting,

    onAiProviderConnecting,
    onAiProviderConnected,
    onAiProviderError,
    onAiProviderChatting,
    onAiProviderStreamChatting,

    aiProviderCreatedFetchSetting,
    aiProviderCreatedFetchPayload,
    aiProviderPingUrl,
    aiProviderChatUrl,
    aiProviderMaxTokens,
    aiProviderIsStream
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
    onLlmChatting: null,
    onLlmStreamChatting: null,

    onAiProviderConnecting: null,
    onAiProviderConnected: null,
    onAiProviderError: null,
    onAiProviderChatting: null,
    onAiProviderStreamChatting: null,

    chatLog: [],
    chatSeq: 0,
    HOST_TOOLS: [],
    pendingToolInput: null,
    pendingToolChoice: null,
    pendingToolConfirmation: null,

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

  if (typeof onLlmChatting === 'function') {
    brain.onLlmChatting = onLlmChatting.bind(brain);
  }

  if (typeof onLlmStreamChatting === 'function') {
    brain.onLlmStreamChatting = onLlmStreamChatting.bind(brain);
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

  if (typeof onAiProviderChatting === 'function') {
    brain.onAiProviderChatting = onAiProviderChatting.bind(brain);
  }

  if (typeof onAiProviderStreamChatting === 'function') {
    brain.onAiProviderStreamChatting = onAiProviderStreamChatting.bind(brain);
  }

  llm = initLLM(
    {
      llmModel,
      LLMMaxTokens,
      LLMIsStream,
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
      },
      onChatting(...arg) {
        return brain.onLlmChatting?.(...arg, aiAvatarWidget);
      },
      onStreamChatting(...arg) {
        return brain.onLlmStreamChatting?.(...arg, aiAvatarWidget);
      }
    },
    brain
  );
  mem = initMEM({ avatarMode: brain.avatarMode });
  aiProvider = await initAiProvider({
    providerModel: aiProviderModel,
    providerBaseUrl: aiProviderBaseUrl,

    providerCreatedFetchSetting: aiProviderCreatedFetchSetting,
    providerCreatedFetchPayload: aiProviderCreatedFetchPayload,
    providerPingUrl: aiProviderPingUrl,
    providerChatUrl: aiProviderChatUrl,
    providerMaxTokens: aiProviderMaxTokens,
    providerIsStream: aiProviderIsStream,

    onConnecting(...arg) {
      return brain.onAiProviderConnecting?.(...arg, aiAvatarWidget);
    },
    onConnected(...arg) {
      return brain.onAiProviderConnected?.(...arg, aiAvatarWidget);
    },
    onError(...arg) {
      return brain.onAiProviderError?.(...arg, aiAvatarWidget);
    },
    onChatting(...arg) {
      return brain.onAiProviderChatting?.(...arg, aiAvatarWidget);
    },
    onStreamChatting(...arg) {
      return brain.onAiProviderStreamChatting?.(...arg, aiAvatarWidget);
    }
  });

  return brain;
}

export function setEmotionFromText(aiAvatarWidget, text) {
  aiAvatarWidget.skinEngine.gestureName = classifyEmotion(text);
}

// 檢索式回答（零金鑰、即時、永遠可用的後備）
export function bestOf(knowledgeList = [], question) {
  let e = null;
  let s = 0;
  for (const x of knowledgeList || []) {
    const v = scoreEntry(question, x);
    if (v > s) {
      s = v;
      e = x;
    }
  }
  return { e, s };
}

export function brainCompanionFallback(aiAvatarWidget = null, question) {
  if (typeof aiAvatarWidget?.companionFallbackContext === 'function') {
    return aiAvatarWidget.companionFallbackContext(question, aiAvatarWidget);
  } else if (typeof aiAvatarWidget?.companionFallbackContext === 'string') {
    return aiAvatarWidget.companionFallbackContext;
  }

  // 陪聊版兜底：輪流換句，不推銷產品題
  const name = aiAvatarWidget.brainEngine.mem.data.name;
  const companionFallbackList =
    Array.isArray(aiAvatarWidget.brainEngine.companionFallback) === true &&
    aiAvatarWidget.brainEngine.companionFallback.length > 0
      ? aiAvatarWidget.brainEngine.companionFallback
      : [
          (name ? name + '，' : '') +
            '這個我還不太會聊，但我想聽你說——多講一點？',
          '嗯嗯，我在聽。後來呢？',
          '哈，這題有點考倒我了，你怎麼看？',
          '我還在學著聊這個～對了，按 🧠 開 AI 大腦，我會聊得更順喔。'
        ];

  return companionFallbackList[
    aiAvatarWidget.brainEngine.companionFallbackIdx++ %
      companionFallbackList.length
  ];
}

export function handleThinking(aiAvatarWidget = null, rawQuestion) {
  const question = (rawQuestion || '').trim();
  if (!question) {
    return '我好像沒聽清楚，可以再說一次嗎？';
  }
  const site = bestOf(aiAvatarWidget.brainEngine.knowledge, question);
  if (aiAvatarWidget.avatarMode === AVATAR_MODE_MAP.companion) {
    // 陪伴模式：聊天題給陪聊腦、網站/產品題照答
    const chat = bestOf(
      aiAvatarWidget.brainEngine.companionKnowledge,
      question
    );
    if (chat.e && chat.s >= 0.16 && chat.s + 0.05 >= site.s) {
      return chat.e.a;
    }
    if (site.e && site.s >= 0.16) {
      return site.e.a;
    }
    return brainCompanionFallback(aiAvatarWidget, question);
  }
  if (site.e && site.s >= 0.16) {
    return site.e.a;
  }

  if (typeof aiAvatarWidget?.assistantFallbackContext === 'function') {
    return aiAvatarWidget.assistantFallbackContext(question, aiAvatarWidget);
  } else if (typeof aiAvatarWidget?.assistantFallbackContext === 'string') {
    return aiAvatarWidget.assistantFallbackContext;
  }

  return (
    '你問的是「' +
    question +
    '」對吧？這題我的知識庫還沒收錄～你可以問我「怎麼安裝」「怎麼換成我的角色」「要不要錢」「麥克風怎麼用」這些喔。'
  );
}

export function addChatMessage(aiAvatarWidget, role, text, options = {}) {
  const item = {
    id: options.id || 'm' + ++aiAvatarWidget.brainEngine.chatSeq,
    role: role === 'user' ? 'user' : 'assistant',
    text: String(text || '').slice(0, 4000),
    streaming: !!options.streaming,
    pendingTool: options.pendingTool || null,
    pendingChoices: options.pendingChoices || null
  };
  aiAvatarWidget.brainEngine.chatLog.push(item);
  if (aiAvatarWidget.brainEngine.chatLog.length > 80) aiAvatarWidget.brainEngine.chatLog.shift();

  if (aiAvatarWidget.uiDom.historyPanelEl?.classList.contains('open')) {
    import('./ui.js').then(({ renderHistory }) => renderHistory(aiAvatarWidget));
  }
  return item.id;
}

export function updateChatMessage(aiAvatarWidget, id, text, streaming) {
  const item = aiAvatarWidget.brainEngine.chatLog.find((m) => m.id === id);
  if (!item) {
    return addChatMessage(aiAvatarWidget, 'assistant', text, { id, streaming });
  }
  item.text = String(text || '').slice(0, 4000);
  item.streaming = !!streaming;
  if (aiAvatarWidget.uiDom.historyPanelEl?.classList.contains('open')) {
    import('./ui.js').then(({ renderHistory }) => renderHistory(aiAvatarWidget));
  }
  return item.id;
}

export async function aiProviderLLMBrain(aiAvatarWidget = null, question) {
  try {
    aiAvatarWidget.speechEngine.spokenDisplayText = '讓我想想…';

    aiAvatarWidget.skinEngine.gestureName = 'thinking';

    const out = await aiAvatarWidget.brainEngine.aiProvider.chat(
      aiAvatarWidget.buildLLMMessages(aiAvatarWidget, question)
    );
    if (out?.trim?.()) {
      return sayAnswer(aiAvatarWidget, out.trim());
    }
    throw new Error('AI Provider response is empty');
  } catch (e) {
    console.warn('AI Provider error', e);
    throw e;
  }
}

export function defaultBuildLLMMessages(aiAvatarWidget = null, question) {
  const context = topK(aiAvatarWidget, question, 3)
    .map((e) => 'Q：' + e.q + '\nA：' + e.a)
    .join('\n---\n');
  const RAG =
    '優先依據【參考資料】回答；資料沒有的就用常識簡短回應，不確定就老實說不知道。\n\n【參考資料】\n' +
    (context || '（無）');
  const systemContext =
    aiAvatarWidget?.avatarMode === AVATAR_MODE_MAP.companion
      ? '你是這個網站的陪伴型語音虛擬人，親切、口語、繁體中文、每次最多兩三句。你記得訪客先前的對話' +
        (aiAvatarWidget?.brainEngine?.mem?.data?.name
          ? '，訪客叫「' +
            aiAvatarWidget.brainEngine.mem.data.name +
            '」，可自然稱呼'
          : '') +
        '。' +
        RAG
      : '你是「可嵌入任何網站的語音虛擬人元件」的示範助手。主題是教人「怎麼把這個元件裝到自己的網站、怎麼換成自己的角色、怎麼使用」。請用繁體中文、口語、最多兩三句話簡短回答。' +
        RAG;
  const msgs = [{ role: 'system', content: systemContext }];
  if (aiAvatarWidget?.brainEngine?.mem?.isCompanion === true) {
    for (const h of aiAvatarWidget.brainEngine.mem.data.history) {
      msgs.push({ role: h.role, content: h.content });
    }
  }
  msgs.push({ role: 'user', content: question });
  return msgs;
}

export async function webLLMBrain(aiAvatarWidget = null, question) {
  try {
    aiAvatarWidget.speechEngine.spokenDisplayText = '讓我想想…';

    aiAvatarWidget.skinEngine.gestureName = 'thinking';

    const { beginSpeech, pushSpeech, endSpeech, onUtteranceEnd, drainSentences } = await import('./speech/index.js');

    const sid = aiAvatarWidget.speechEngine.ttsMuted
      ? 0
      : beginSpeech(aiAvatarWidget); // 靜音時只更新字幕、不進語音佇列
    const st = { buf: '' };
    const streamMessageId = 'stream-' + Date.now();
    const out = await aiAvatarWidget.brainEngine.llm.chat(
      aiAvatarWidget.buildLLMMessages(aiAvatarWidget, question),
      (delta, sofar) => {
        aiAvatarWidget.speechEngine.spokenDisplayText = sofar; // 邊生成邊更新字幕
        updateChatMessage(aiAvatarWidget, streamMessageId, sofar, true);
        if (sid) {
          if (sid !== aiAvatarWidget.speechEngine.speakSeq) {
            return; // 中途被打斷 → 剩下的只當字幕
          }
          aiAvatarWidget.setEmotionFromText(sofar);
          st.buf += delta;
          for (const s of drainSentences(st, false)) {
            pushSpeech(aiAvatarWidget, sid, s);
          }
        }
      }
    );
    if (out?.trim?.()) {
      aiAvatarWidget.brainEngine.mem.addTurn('assistant', out.trim());
      updateChatMessage(aiAvatarWidget, streamMessageId, out.trim(), false);
      if (sid && sid === aiAvatarWidget.speechEngine.speakSeq) {
        for (const s of drainSentences(st, true)) {
          pushSpeech(aiAvatarWidget, sid, s);
        }
        endSpeech(aiAvatarWidget, sid);
      } else if (!sid) {
        onUtteranceEnd(aiAvatarWidget); // 靜音：沒有語音收尾 → 手動觸發對話迴圈 hook
      }
      if (typeof aiAvatarWidget?.speechEngine.onSpeakingEnd === 'function') {
        aiAvatarWidget.speechEngine.onSpeakingEnd(out.trim(), aiAvatarWidget);
      }
      return;
    }
    if (sid) {
      endSpeech(aiAvatarWidget, sid); // 空回答：收掉這條 session，往下走檢索
    }
    throw new Error('WebLLM response is empty');
  } catch (e) {
    console.warn('llm error', e);
    throw e;
  }
}

export async function handleAnswer(aiAvatarWidget = null, question) {
  const safeQuestion = (question || '').trim();
  if (!safeQuestion) {
    aiAvatarWidget.speechEngine.spokenAudioText =
      '我好像沒聽清楚，可以再說一次嗎？';
    return;
  }
  try {
    // 1) AI 伺服器大腦（最聰明，優先；整段生成後逐句講）
    if (
      aiAvatarWidget.brainEngine.aiProvider?.enabled &&
      aiAvatarWidget.brainEngine.aiProvider.ready
    ) {
      return await aiProviderLLMBrain(aiAvatarWidget, question);
    }
    // 2) 瀏覽器內 WebLLM：串流 → 每切出一個完整句就丟進逐句佇列開講（首句延遲大幅縮短）
    if (
      aiAvatarWidget.brainEngine.llm?.state === aiAvatarWidget.STATE_MAP.READY
    ) {
      return await webLLMBrain(aiAvatarWidget, question);
    }
  } catch (_error) {
    console.error(_error);
  }

  // 3) 檢索式後備（零金鑰、永遠可用）
  sayAnswer(aiAvatarWidget, handleThinking(aiAvatarWidget, safeQuestion));
}

export function sayAnswer(aiAvatarWidget, text) {
  if (!text) return;
  aiAvatarWidget.brainEngine.mem.addTurn('assistant', text);
  addChatMessage(aiAvatarWidget, 'assistant', text);
  aiAvatarWidget.speechEngine.speak(text);
}
