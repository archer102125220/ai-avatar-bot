import { createBaseStore } from './store';
import {
  STATE_MAP,
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_AI_PROVIDER_MODEL
} from './constants';

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
  const grams = [];
  for (let i = 0; i < s.length - 1; i++) {
    grams.push(s.slice(i, i + 2));
  }
  if (s.length === 1) {
    grams.push(s);
  }
  return grams;
}

// brain.js
export function similarity(query, text) {
  const queryBigrams = bigrams(query);
  const textBigramsSet = new Set(bigrams(text));
  if (queryBigrams.length === 0 || textBigramsSet.size === 0) {
    return 0;
  }
  let hit = 0;
  for (const gram of queryBigrams) {
    if (textBigramsSet.has(gram) === true) {
      hit++;
    }
  }
  return hit / Math.sqrt(queryBigrams.length * textBigramsSet.size);
}

// brain.js
export function scoreEntry(question, e) {
  const safeQ =
    typeof question === 'string'
      ? question
      : Array.isArray(question)
        ? question[question.length - 1]?.content || ''
        : String(question || '');
  const targetQ = typeof e.q === 'string' ? e.q : String(e.q || '');
  const targetKw = typeof e.kw === 'string' ? e.kw : String(e.kw || '');
  let score = Math.max(similarity(safeQ, targetQ), similarity(safeQ, targetKw));
  const terms = targetKw.split(/\s+/).filter(Boolean);
  for (const item of terms) {
    if (item.length >= 2 && safeQ.includes(item) === true) {
      score = Math.max(score, 0.5 + item.length * 0.04);
    }
  }
  return score;
}

// brain.js
export function topK(brainEngine, question, k) {
  const knowledge = brainEngine?.knowledge || [];

  return knowledge
    .map((entry) => ({ entry, score: scoreEntry(question, entry) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .filter((item) => item.score > 0.05)
    .map((item) => item.entry);
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
      if (typeof engine === 'object' && engine !== null) {
        return engine;
      }
      if (loadingPromise instanceof Promise === true) {
        return loadingPromise;
      }
      this.state = STATE_MAP.LOADING;
      this.onLoading();

      loadingPromise = (async () => {
        try {
          const webllm = await import('@mlc-ai/web-llm'); // 動態載入：只有按下🧠才抓這包函式庫
          engine = await webllm.CreateMLCEngine(llmModel, {
            initProgressCallback: (progressInfo) => {
              this.progress = progressInfo.progress || 0;
              this.onLoadProgress(progressInfo);
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
      if (typeof engine !== 'object' || engine === null) {
        return null;
      }

      if (typeof onDelta !== 'function' || this.isStream === false) {
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
        if (typeof content === 'string' && content !== '') {
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
export async function getWelcomeText(brainEngine) {
  let welcomeText =
    '點 🎤 說話、或直接打字問我；想更聰明可按 🧠 啟用 AI 大腦 👋';

  if (typeof brainEngine?.welcomeText === 'function') {
    welcomeText = await brainEngine.welcomeText({
      isCompanion: brainEngine.mem.isCompanion,
      visits: brainEngine.mem.data.visits,
      name: brainEngine.mem.data.name
    });
  } else if (typeof brainEngine?.welcomeText === 'string') {
    welcomeText = brainEngine.welcomeText;
  } else if (brainEngine?.avatarMode === AVATAR_MODE_MAP.companion) {
    if (typeof brainEngine?.companionWelcomeText === 'function') {
      welcomeText = await brainEngine.companionWelcomeText();
    } else if (brainEngine.mem.data.visits > 1) {
      welcomeText =
        (brainEngine.mem.data.name ? brainEngine.mem.data.name + '，' : '') +
        '歡迎回來～這是我們第 ' +
        brainEngine.mem.data.visits +
        ' 次見面！點 💬 繼續聊，我記得我們聊過什麼喔';
    } else if (typeof brainEngine.companionWelcomeText === 'string') {
      welcomeText = brainEngine.companionWelcomeText;
    } else {
      welcomeText =
        '嗨～我是這裡的陪聊虛擬人！點 💬 就能連續對話，我會記得你說過的話（只存在你這台瀏覽器，說『忘記我』就清掉）';
    }
  } else if (typeof brainEngine?.assistantWelcomeText === 'function') {
    welcomeText = await brainEngine.assistantWelcomeText();
  } else if (typeof brainEngine?.assistantWelcomeText === 'string') {
    welcomeText = brainEngine.assistantWelcomeText;
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
    enabled: typeof providerBaseUrl === 'string' && providerBaseUrl !== '',
    ready: false,
    async ping(fetchSetting = null) {
      if (this.enabled === false) {
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
        if (typeof localData === 'object' && localData !== null) {
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
      if (
        this.isCompanion === false ||
        typeof content !== 'string' ||
        content === ''
      ) {
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
      const match = /(?:我叫|我是|叫我)\s*([^\s，。、,.!！?？的]{1,10})/.exec(
        text || ''
      );
      if (match !== null && /誰|什麼|不知|沒有/.test(match[1]) === false) {
        this.data.name = match[1];
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
  if (surprised > 0 && surprised >= Math.max(happy, sad)) {
    return 'surprised';
  }
  if (sad > happy) {
    return 'sad';
  }
  if (happy > 0) {
    return 'happy';
  }
  return 'neutral';
}

export async function initBrainEngine(seting = {}) {
  const {
    llmModel,
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

    onAddChatMessage,
    onUpdateChatMessage,
    onChatHistoryChanged,

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

  const store = createBaseStore({
    // Add states here if needed in the future
  });

  const brainEngine = {
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
    get companionFallback() {
      return companionFallback;
    },
    companionKnowledge: safeCompanionKnowledge,
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

    onAddChatMessage: onAddChatMessage || null,
    onUpdateChatMessage: onUpdateChatMessage || null,
    onChatHistoryChanged: onChatHistoryChanged || null,

    chatLog: [],
    chatSeq: 0,

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

    defaultBuildLLMMessages: (question) =>
      defaultBuildLLMMessages(brainEngine, question),

    getWelcomeText: () => getWelcomeText(brainEngine),
    classifyEmotion: classifyEmotion,
    setEmotionFromText: (text) => setEmotionFromText(brainEngine, text),
    handleAnswer: (question) => handleAnswer(brainEngine, question),
    addChatMessage: (role, text, options) =>
      addChatMessage(brainEngine, role, text, options),
    updateChatMessage: (id, text, streaming) =>
      updateChatMessage(brainEngine, id, text, streaming),

    get llm() {
      return llm;
    },
    get mem() {
      return mem;
    },
    get aiProvider() {
      return aiProvider;
    },
    get skin() {
      return seting.getSkin ? seting.getSkin() : null;
    },
    get speech() {
      return seting.getSpeech ? seting.getSpeech() : null;
    }
  };

  if (typeof welcomeText === 'function') {
    brainEngine.welcomeText = welcomeText;
  } else if (typeof welcomeText === 'string') {
    brainEngine.welcomeText = welcomeText;
  }
  if (typeof companionWelcomeText === 'function') {
    brainEngine.companionWelcomeText = companionWelcomeText;
  } else if (typeof companionWelcomeText === 'string') {
    brainEngine.companionWelcomeText = companionWelcomeText;
  }
  if (typeof assistantWelcomeText === 'function') {
    brainEngine.assistantWelcomeText = assistantWelcomeText;
  } else if (typeof assistantWelcomeText === 'string') {
    brainEngine.assistantWelcomeText = assistantWelcomeText;
  }

  if (typeof onLlmLoading === 'function') {
    brainEngine.onLlmLoading = onLlmLoading.bind(brainEngine);
  }

  if (typeof onLlmLoadProgress === 'function') {
    brainEngine.onLlmLoadProgress = onLlmLoadProgress.bind(brainEngine);
  }

  if (typeof onLlmLoaded === 'function') {
    brainEngine.onLlmLoaded = onLlmLoaded.bind(brainEngine);
  }

  if (typeof onLlmLoadError === 'function') {
    brainEngine.onLlmLoadError = onLlmLoadError.bind(brainEngine);
  }

  if (typeof onLlmChatting === 'function') {
    brainEngine.onLlmChatting = onLlmChatting.bind(brainEngine);
  }

  if (typeof onLlmStreamChatting === 'function') {
    brainEngine.onLlmStreamChatting = onLlmStreamChatting.bind(brainEngine);
  }

  if (typeof onAiProviderConnecting === 'function') {
    brainEngine.onAiProviderConnecting =
      onAiProviderConnecting.bind(brainEngine);
  }

  if (typeof onAiProviderConnected === 'function') {
    brainEngine.onAiProviderConnected = onAiProviderConnected.bind(brainEngine);
  }

  if (typeof onAiProviderError === 'function') {
    brainEngine.onAiProviderError = onAiProviderError.bind(brainEngine);
  }

  if (typeof onAiProviderChatting === 'function') {
    brainEngine.onAiProviderChatting = onAiProviderChatting.bind(brainEngine);
  }

  if (typeof onAiProviderStreamChatting === 'function') {
    brainEngine.onAiProviderStreamChatting =
      onAiProviderStreamChatting.bind(brainEngine);
  }

  llm = initLLM(
    {
      llmModel,
      LLMMaxTokens,
      LLMIsStream,
      onLoading(...arg) {
        return brainEngine.onLlmLoading?.(...arg);
      },
      onLoadProgress(...arg) {
        return brainEngine.onLlmLoadProgress?.(...arg);
      },
      onLoaded(...arg) {
        return brainEngine.onLlmLoaded?.(...arg);
      },
      onLoadError(...arg) {
        return brainEngine.onLlmLoadError?.(...arg);
      },
      onChatting(...arg) {
        return brainEngine.onLlmChatting?.(...arg);
      },
      onStreamChatting(...arg) {
        return brainEngine.onLlmStreamChatting?.(...arg);
      }
    },
    brainEngine
  );
  mem = initMEM({ avatarMode: brainEngine.avatarMode });
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
      return brainEngine.onAiProviderConnecting?.(...arg);
    },
    onConnected(...arg) {
      return brainEngine.onAiProviderConnected?.(...arg);
    },
    onError(...arg) {
      return brainEngine.onAiProviderError?.(...arg);
    },
    onChatting(...arg) {
      return brainEngine.onAiProviderChatting?.(...arg);
    },
    onStreamChatting(...arg) {
      return brainEngine.onAiProviderStreamChatting?.(...arg);
    }
  });

  return brainEngine;
}

export function setEmotionFromText(brainEngine, text) {
  if (
    typeof brainEngine === 'object' &&
    brainEngine !== null &&
    typeof brainEngine.skin === 'object' &&
    brainEngine.skin !== null
  ) {
    brainEngine.skin.gestureName = classifyEmotion(text);
  }
}

// 檢索式回答（零金鑰、即時、永遠可用的後備）
export function bestOf(knowledgeList = [], question) {
  let bestEntry = null;
  let bestScore = 0;
  for (const entry of knowledgeList || []) {
    const score = scoreEntry(question, entry);
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }
  return { entry: bestEntry, score: bestScore };
}

export function brainEngineCompanionFallback(brainEngine, question) {
  if (typeof brainEngine?.companionFallbackContext === 'function') {
    return brainEngine.companionFallbackContext(question);
  } else if (typeof brainEngine?.companionFallbackContext === 'string') {
    return brainEngine.companionFallbackContext;
  }

  // 陪聊版兜底：輪流換句，不推銷產品題
  const name = brainEngine.mem.data.name;
  const companionFallbackList =
    Array.isArray(brainEngine.companionFallback) === true &&
    brainEngine.companionFallback.length > 0
      ? brainEngine.companionFallback
      : [
          (name ? name + '，' : '') +
            '這個我還不太會聊，但我想聽你說——多講一點？',
          '嗯嗯，我在聽。後來呢？',
          '哈，這題有點考倒我了，你怎麼看？',
          '我還在學著聊這個～對了，按 🧠 開 AI 大腦，我會聊得更順喔。'
        ];

  return companionFallbackList[
    brainEngine.companionFallbackIdx++ % companionFallbackList.length
  ];
}

export function handleThinking(brainEngine, rawQuestion) {
  const question = (rawQuestion || '').trim();
  if (question === '') {
    return '我好像沒聽清楚，可以再說一次嗎？';
  }
  const site = bestOf(brainEngine.knowledge, question);
  if (brainEngine.avatarMode === AVATAR_MODE_MAP.companion) {
    // 陪伴模式：聊天題給陪聊腦、網站/產品題照答
    const chat = bestOf(brainEngine.companionKnowledge, question);
    if (chat.entry && chat.score >= 0.16 && chat.score + 0.05 >= site.score) {
      return chat.entry.a;
    }
    if (site.entry && site.score >= 0.16) {
      return site.entry.a;
    }
    return brainEngineCompanionFallback(brainEngine, question);
  }
  if (site.entry && site.score >= 0.16) {
    return site.entry.a;
  }

  if (typeof brainEngine.assistantFallbackContext === 'function') {
    return brainEngine.assistantFallbackContext(question);
  } else if (typeof brainEngine.assistantFallbackContext === 'string') {
    return brainEngine.assistantFallbackContext;
  }

  return (
    '你問的是「' +
    question +
    '」對吧？這題我的知識庫還沒收錄～你可以問我「怎麼安裝」「怎麼換成我的角色」「要不要錢」「麥克風怎麼用」這些喔。'
  );
}

export function addChatMessage(brainEngine, role, text, options = {}) {
  const item = {
    id: options.id || 'm' + ++brainEngine.chatSeq,
    role: role === 'user' ? 'user' : 'assistant',
    text: String(text || '').slice(0, 4000),
    streaming: !!options.streaming,
    pendingTool: options.pendingTool || null,
    pendingChoices: options.pendingChoices || null
  };
  brainEngine.chatLog.push(item);
  if (brainEngine.chatLog.length > 80) {
    brainEngine.chatLog.shift();
  }

  if (typeof brainEngine.onAddChatMessage === 'function') {
    brainEngine.onAddChatMessage(item);
  }
  if (typeof brainEngine.onChatHistoryChanged === 'function') {
    brainEngine.onChatHistoryChanged(brainEngine.chatLog);
  }
  return item.id;
}

export function updateChatMessage(brainEngine, id, text, streaming) {
  const item = brainEngine.chatLog.find((msg) => msg.id === id);
  if (item === undefined) {
    return addChatMessage(brainEngine, 'assistant', text, { id, streaming });
  }
  item.text = String(text || '').slice(0, 4000);
  item.streaming = !!streaming;
  if (typeof brainEngine.onUpdateChatMessage === 'function') {
    brainEngine.onUpdateChatMessage(item);
  }
  if (typeof brainEngine.onChatHistoryChanged === 'function') {
    brainEngine.onChatHistoryChanged(brainEngine.chatLog);
  }
  return item.id;
}

export async function aiProviderLLMBrain(brainEngine, question) {
  try {
    brainEngine.speech.spokenDisplayText = '讓我想想…';

    if (brainEngine.skin) {
      brainEngine.skin.gestureName = 'thinking';
    }

    const out = await brainEngine.aiProvider.chat(
      brainEngine.defaultBuildLLMMessages(question)
    );
    if (typeof out === 'string' && out.trim() !== '') {
      return sayAnswer(brainEngine, out.trim());
    }
    throw new Error('AI Provider response is empty');
  } catch (e) {
    console.warn('AI Provider error', e);
    throw e;
  }
}

export function defaultBuildLLMMessages(brainEngine, question) {
  const context = topK(brainEngine, question, 3)
    .map((entry) => 'Q：' + entry.q + '\nA：' + entry.a)
    .join('\n---\n');
  const RAG =
    '優先依據【參考資料】回答；資料沒有的就用常識簡短回應，不確定就老實說不知道。\n\n【參考資料】\n' +
    (context || '（無）');
  const systemContext =
    brainEngine?.avatarMode === AVATAR_MODE_MAP.companion
      ? '你是這個網站的陪伴型語音虛擬人，親切、口語、繁體中文、每次最多兩三句。你記得訪客先前的對話' +
        (brainEngine?.mem?.data?.name
          ? '，訪客叫「' + brainEngine.mem.data.name + '」，可自然稱呼'
          : '') +
        '。' +
        RAG
      : '你是「可嵌入任何網站的語音虛擬人元件」的示範助手。主題是教人「怎麼把這個元件裝到自己的網站、怎麼換成自己的角色、怎麼使用」。請用繁體中文、口語、最多兩三句話簡短回答。' +
        RAG;
  const msgs = [{ role: 'system', content: systemContext }];
  if (brainEngine?.mem?.isCompanion === true) {
    for (const h of brainEngine.mem.data.history) {
      msgs.push({ role: h.role, content: h.content });
    }
  }
  msgs.push({ role: 'user', content: question });
  return msgs;
}

export async function webLLMBrain(brainEngine, question) {
  try {
    brainEngine.speech.spokenDisplayText = '讓我想想…';

    if (brainEngine.skin) {
      brainEngine.skin.gestureName = 'thinking';
    }

    const sid = brainEngine.speech.ttsMuted
      ? 0
      : brainEngine.speech.beginSpeech(); // 靜音時只更新字幕、不進語音佇列
    const st = { buf: '' };
    const streamMessageId = 'stream-' + Date.now();
    const out = await brainEngine.llm.chat(
      brainEngine.defaultBuildLLMMessages(question),
      (delta, sofar) => {
        brainEngine.speech.spokenDisplayText = sofar; // 邊生成邊更新字幕
        updateChatMessage(brainEngine, streamMessageId, sofar, true);

        // Always evaluate emotion from text during stream, even if TTS is muted
        if (!sid || sid === brainEngine.speech.speakSeq) {
          brainEngine.setEmotionFromText(sofar);
        }

        if (sid) {
          if (sid !== brainEngine.speech.speakSeq) {
            return; // 中途被打斷 → 剩下的只當字幕
          }
          st.buf += delta;
          for (const s of brainEngine.speech.drainSentences(st, false)) {
            brainEngine.speech.pushSpeech(sid, s);
          }
        }
      }
    );
    if (typeof out === 'string' && out.trim() !== '') {
      brainEngine.mem.addTurn('assistant', out.trim());
      updateChatMessage(brainEngine, streamMessageId, out.trim(), false);
      if (sid && sid === brainEngine.speech.speakSeq) {
        for (const s of brainEngine.speech.drainSentences(st, true)) {
          brainEngine.speech.pushSpeech(sid, s);
        }
        brainEngine.speech.endSpeech(sid);
      } else if (!sid) {
        brainEngine.speech.onUtteranceEnd(); // 靜音：沒有語音收尾 → 手動觸發對話迴圈 hook
      }
      if (typeof brainEngine?.speech?.onSpeakingEnd === 'function') {
        brainEngine.speech.onSpeakingEnd(out.trim());
      }
      return;
    }
    if (sid) {
      brainEngine.speech.endSpeech(sid); // 空回答：收掉這條 session，往下走檢索
    }
    throw new Error('WebLLM response is empty');
  } catch (e) {
    console.warn('llm error', e);
    throw e;
  }
}

export async function handleAnswer(brainEngine, question) {
  const safeQuestion = (question || '').trim();
  if (safeQuestion === '') {
    brainEngine.speech.spokenAudioText = '我好像沒聽清楚，可以再說一次嗎？';
    return;
  }
  try {
    // 1) AI 伺服器大腦（最聰明，優先；整段生成後逐句講）
    if (brainEngine.aiProvider?.enabled && brainEngine.aiProvider.ready) {
      return await aiProviderLLMBrain(brainEngine, question);
    }
    // 2) 瀏覽器內 WebLLM：串流 → 每切出一個完整句就丟進逐句佇列開講（首句延遲大幅縮短）
    if (brainEngine.llm?.state === brainEngine.STATE_MAP.READY) {
      return await webLLMBrain(brainEngine, question);
    }
  } catch (_error) {
    console.error(_error);
  }

  // 3) 檢索式後備（零金鑰、永遠可用）
  sayAnswer(brainEngine, handleThinking(brainEngine, safeQuestion));
}

export function sayAnswer(brainEngine, text) {
  if (typeof text !== 'string' || text === '') {
    return;
  }
  brainEngine.mem.addTurn('assistant', text);
  addChatMessage(brainEngine, 'assistant', text);
  brainEngine.speech.speak(text);
}
