import { createBaseStore } from '@/core/store';
import { resolveLocalized } from '@/core/i18n';
import {
  STATE_MAP,
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_MAX_TOKENS,
  DEFAULT_AI_PROVIDER_MODEL,
  DEFAULT_ENABLE_MEMORY,
  DEFAULT_MAX_HISTORY_TURNS,
  DEFAULT_MEMORY_KEY,
  BRAIN_ENGINE_TYPE_MAP,
  BRAIN_FALLBACK_TYPE_MAP,
  DEFAULT_ENABLE_AUTO_CONTINUE,
  DEFAULT_MAX_AUTO_CONTINUATIONS,
  AUTO_CONTINUE_MODE_MAP,
  DEFAULT_AUTO_CONTINUE_MODE,
  LLM_FINISH_REASON_MAP,
  FINISH_REASON_MAP
} from '@/core/constants';
import { fetchKnowledge, findBestMatch } from './knowledge.js';
import { classifyEmotion, applyEmotionFromText } from './emotion.js';
import { initMemory, triggerRollingSummaryIfNeeded } from './memory.js';
import {
  getBrainMessage,
  getWelcomeText,
  buildDefaultLLMMessages
} from './messages.js';
import { initWebLLM, chatWithWebLLM } from './web-llm.js';
import { initAiProvider, chatWithAiProvider } from './ai-provider.js';

export * from './compression.js';
export * from './knowledge.js';
export * from './emotion.js';
export * from './memory.js';
export * from './messages.js';
export * from './tool-calling.js';
export * from './web-llm.js';
export * from './ai-provider.js';

/**
 * Brain engine options definition referencing types/index.d.ts via @types.
 * @typedef {import('@types').BrainEngineOptions} BrainEngineOptions
 */

/**
 * Brain engine instance interface referencing types/index.d.ts via @types.
 * @typedef {import('@types').BrainEngine} BrainEngine
 */

/**
 * Creates and initializes the Brain cognitive engine instance (orchestrating AI Provider, WebLLM, RAG knowledge, and memory).
 *
 * @param {import('@types').BrainEngineOptions} [setting={}] - Brain engine options.
 * @returns {Promise<import('@types').BrainEngine>} Initialized Brain engine instance.
 */
export async function initBrainEngine(setting = {}) {
  const {
    llmModel,
    preloadWebLLM = false,
    autoFallbackWebLLM = true,
    enableAutoContinue = DEFAULT_ENABLE_AUTO_CONTINUE,
    maxAutoContinuations = DEFAULT_MAX_AUTO_CONTINUATIONS,
    autoContinueMode = DEFAULT_AUTO_CONTINUE_MODE,
    autoContinuePrompt = null,
    knowledge = [],
    knowledgeUrl,
    companionKnowledge = [],
    companionKnowledgeUrl,
    companionFallback,
    enableAiProvider,
    aiProviderModel,
    aiProviderBaseUrl,

    enableMemory = DEFAULT_ENABLE_MEMORY,
    maxHistoryTurns = DEFAULT_MAX_HISTORY_TURNS,
    memoryKey = DEFAULT_MEMORY_KEY,
    memoryAdapter = null,
    compression = {},
    modes = {},

    welcomeText = null,
    companionWelcomeText = null,
    assistantWelcomeText = null,

    llmMaxTokens,
    llmIsStream,
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
    onSpokenAudioPlayNow,
    onSpokenDisplayTextChange,
    onSpokenAudioTextChange,
    onEmotionChange,
    onSummaryUpdated,
    onStreamStart,
    onStreamChunk,
    onStreamEnd,
    onAutoContinueStart = null,
    onAutoContinueWait = null,
    onAutoContinueResume = null,
    onAutoContinueEnd = null,

    aiProviderCreateFetchSetting = null,
    aiProviderCreateFetchPayload = null,
    aiProviderResponseFormat = null,
    aiProviderPingUrl,
    aiProviderChatUrl,
    aiProviderMaxTokens,
    aiProviderIsStream,
    aiProviderExtractToolCalls,
    getTools,
    getToolByName,
    offerToolConfirmation,
    executeTool,
    buildLLMMessages,
    i18nEngine = null,
    locale = 'zh-TW',
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext,
    languageRule,
    gender,
    genderRule,
    onBrainFallback = null,
    onToolNotFound = null,
    onToolError = null
  } = setting;

  let llm = null;
  let memory = null;
  let aiProvider = null;

  const safeKnowledge =
    Array.isArray(knowledge) && knowledge.length > 0
      ? knowledge
      : await fetchKnowledge(knowledgeUrl);
  const safeCompanionKnowledge =
    Array.isArray(companionKnowledge) && companionKnowledge.length > 0
      ? companionKnowledge
      : await fetchKnowledge(companionKnowledgeUrl);

  const _store = createBaseStore({
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
    get BRAIN_ENGINE_TYPE_MAP() {
      return BRAIN_ENGINE_TYPE_MAP;
    },
    get BRAIN_FALLBACK_TYPE_MAP() {
      return BRAIN_FALLBACK_TYPE_MAP;
    },
    get LLM_FINISH_REASON_MAP() {
      return LLM_FINISH_REASON_MAP;
    },
    get FINISH_REASON_MAP() {
      return FINISH_REASON_MAP;
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

    getTools: typeof getTools === 'function' ? getTools : () => [],
    getToolByName: typeof getToolByName === 'function' ? getToolByName : null,
    offerToolConfirmation:
      typeof offerToolConfirmation === 'function'
        ? offerToolConfirmation
        : null,
    executeTool: typeof executeTool === 'function' ? executeTool : null,

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
    onSpokenAudioPlayNow: onSpokenAudioPlayNow || null,
    onSpokenDisplayTextChange: onSpokenDisplayTextChange || null,
    onSpokenAudioTextChange: onSpokenAudioTextChange || null,
    onEmotionChange: onEmotionChange || null,
    onSummaryUpdated: onSummaryUpdated || null,
    onStreamStart: onStreamStart || null,
    onStreamChunk: onStreamChunk || null,
    onStreamEnd: onStreamEnd || null,
    onAutoContinueStart: onAutoContinueStart || null,
    onAutoContinueWait: onAutoContinueWait || null,
    onAutoContinueResume: onAutoContinueResume || null,
    onAutoContinueEnd: onAutoContinueEnd || null,
    onToolNotFound: onToolNotFound || null,
    onToolError: onToolError || null,

    enableAutoContinue:
      typeof enableAutoContinue === 'boolean'
        ? enableAutoContinue
        : DEFAULT_ENABLE_AUTO_CONTINUE,
    maxAutoContinuations:
      typeof maxAutoContinuations === 'number' &&
      Number.isFinite(maxAutoContinuations) === true &&
      maxAutoContinuations > 0
        ? maxAutoContinuations
        : DEFAULT_MAX_AUTO_CONTINUATIONS,
    autoContinueMode:
      autoContinueMode === AUTO_CONTINUE_MODE_MAP.BUFFERED
        ? AUTO_CONTINUE_MODE_MAP.BUFFERED
        : AUTO_CONTINUE_MODE_MAP.STREAM,
    autoContinuePrompt: autoContinuePrompt || null,

    chatLog: [],
    chatSeq: 0,

    i18nEngine: i18nEngine || null,
    locale,
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext: customContext || null,
    languageRule,
    gender,
    genderRule,
    compression:
      typeof compression === 'object' && compression !== null
        ? compression
        : {},

    setGender: (newGender) => {
      brainEngine.gender = newGender;
    },

    setLocale: (newLocale) => {
      brainEngine.locale = newLocale;
    },

    _welcomeText: null,
    get welcomeText() {
      return this._welcomeText;
    },
    set welcomeText(newWelcomeText) {
      this._welcomeText = newWelcomeText;
    },

    _companionWelcomeText: null,
    get companionWelcomeText() {
      return this._companionWelcomeText;
    },
    set companionWelcomeText(newCompanionWelcomeText) {
      this._companionWelcomeText = newCompanionWelcomeText;
    },

    _assistantWelcomeText: null,
    get assistantWelcomeText() {
      return this._assistantWelcomeText;
    },
    set assistantWelcomeText(newAssistantWelcomeText) {
      this._assistantWelcomeText = newAssistantWelcomeText;
    },

    buildLLMMessages:
      typeof buildLLMMessages === 'function'
        ? buildLLMMessages
        : (question, engineType) =>
            buildDefaultLLMMessages(brainEngine, question, engineType),

    get buildDefaultLLMMessages() {
      return (question, engineType) =>
        buildDefaultLLMMessages(brainEngine, question, engineType);
    },

    getWelcomeText: () => getWelcomeText(brainEngine),
    classifyEmotion: classifyEmotion,

    applyEmotionFromText: (text) => applyEmotionFromText(brainEngine, text),
    answerQuestion: (question) => answerQuestion(brainEngine, question),
    emitAnswer: (text) => emitAnswer(brainEngine, text),
    getRetrievalAnswer: (rawQuestion) =>
      getRetrievalAnswer(brainEngine, rawQuestion),
    getCompanionFallbackResponse: (question) =>
      getCompanionFallbackResponse(brainEngine, question),
    chatWithAiProvider: (question) => chatWithAiProvider(brainEngine, question),
    chatWithWebLLM: (question) => chatWithWebLLM(brainEngine, question),
    triggerRollingSummaryIfNeeded: () =>
      triggerRollingSummaryIfNeeded(brainEngine),

    addChatMessage: (role, text, options) =>
      addChatMessage(brainEngine, role, text, options),
    updateChatMessage: (id, text, streaming) =>
      updateChatMessage(brainEngine, id, text, streaming),

    get llm() {
      return llm;
    },
    get memory() {
      return memory;
    },
    get enableMemory() {
      return memory?.enabled ?? DEFAULT_ENABLE_MEMORY;
    },
    set enableMemory(enabled) {
      if (typeof enabled === 'boolean' && memory !== null) {
        memory.enabled = enabled;
      }
    },
    get enableAiProvider() {
      return (
        aiProvider?.enabled ??
        (typeof enableAiProvider === 'boolean'
          ? enableAiProvider
          : typeof aiProviderBaseUrl === 'string' && aiProviderBaseUrl !== '')
      );
    },
    set enableAiProvider(enabled) {
      if (typeof enabled === 'boolean' && aiProvider !== null) {
        aiProvider.enabled = enabled;
      }
    },
    preloadWebLLM: typeof preloadWebLLM === 'boolean' ? preloadWebLLM : false,
    autoFallbackWebLLM:
      typeof autoFallbackWebLLM === 'boolean' ? autoFallbackWebLLM : true,
    onBrainFallback:
      typeof onBrainFallback === 'function' ? onBrainFallback : null,
    get aiProvider() {
      return aiProvider;
    },
    modes: typeof modes === 'object' && modes !== null ? modes : {},
    get availableModes() {
      const customModeKeys =
        typeof this.modes === 'object' && this.modes !== null
          ? Object.keys(this.modes)
          : [];
      return Array.from(
        new Set([...Object.values(AVATAR_MODE_MAP), ...customModeKeys])
      );
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

  const resolvedLLMMaxTokens =
    typeof llmMaxTokens === 'number' &&
    Number.isFinite(llmMaxTokens) === true &&
    llmMaxTokens > 0
      ? llmMaxTokens
      : DEFAULT_LLM_MAX_TOKENS;

  llm = initWebLLM(
    {
      llmModel,
      llmMaxTokens: resolvedLLMMaxTokens,
      llmIsStream,
      onLoading(...args) {
        return brainEngine.onLlmLoading?.(...args);
      },
      onLoadProgress(...args) {
        return brainEngine.onLlmLoadProgress?.(...args);
      },
      onLoaded(...args) {
        return brainEngine.onLlmLoaded?.(...args);
      },
      onLoadError(...args) {
        return brainEngine.onLlmLoadError?.(...args);
      },
      onChatting(...args) {
        return brainEngine.onLlmChatting?.(...args);
      },
      onStreamChatting(...args) {
        return brainEngine.onLlmStreamChatting?.(...args);
      }
    },
    brainEngine
  );
  memory = initMemory({
    avatarMode: brainEngine.avatarMode,
    enableMemory:
      typeof enableMemory === 'boolean' ? enableMemory : DEFAULT_ENABLE_MEMORY,
    memoryKey,
    maxHistoryTurns,
    memoryAdapter
  });
  aiProvider = await initAiProvider({
    enableAiProvider,
    providerModel: aiProviderModel,
    providerBaseUrl: aiProviderBaseUrl,

    providerCreateFetchSetting: aiProviderCreateFetchSetting,
    providerCreateFetchPayload: aiProviderCreateFetchPayload,
    providerResponseFormat: aiProviderResponseFormat,

    providerPingUrl: aiProviderPingUrl,
    providerChatUrl: aiProviderChatUrl,
    providerMaxTokens: aiProviderMaxTokens,
    providerIsStream: aiProviderIsStream,
    providerExtractToolCalls: aiProviderExtractToolCalls,

    onConnecting(...args) {
      return brainEngine.onAiProviderConnecting?.(...args);
    },
    onConnected(...args) {
      return brainEngine.onAiProviderConnected?.(...args);
    },
    onError(...args) {
      return brainEngine.onAiProviderError?.(...args);
    },
    onChatting(...args) {
      return brainEngine.onAiProviderChatting?.(...args);
    },
    onStreamChatting(...args) {
      return brainEngine.onAiProviderStreamChatting?.(...args);
    }
  });

  if (
    brainEngine.preloadWebLLM === true &&
    brainEngine.llm?.supported === true
  ) {
    brainEngine.llm.load().catch((error) => {
      console.warn('[initBrainEngine] Preload WebLLM failed:', error);
    });
  }

  return brainEngine;
}

/**
 * Generates default fallback response text for companion persona mode when question is not found in knowledge.
 *
 * @param {import('@types').BrainEngine} brainEngine - Brain engine instance.
 * @param {string} question - User question text.
 * @returns {string} Fallback response string.
 */
export function getCompanionFallbackResponse(brainEngine, question) {
  const locale = brainEngine?.locale || 'zh-TW';
  const name = brainEngine?.memory?.data?.name || '';
  const templateContext = { question, name, locale };

  if (
    typeof brainEngine?.companionFallbackContext !== 'undefined' &&
    brainEngine?.companionFallbackContext !== null
  ) {
    const resolvedFallbackText = resolveLocalized(
      brainEngine.companionFallbackContext,
      locale,
      undefined,
      templateContext
    );
    if (typeof resolvedFallbackText === 'string') {
      return resolvedFallbackText;
    }
  }

  const hasName = typeof name === 'string' && name !== '';
  let defaultList = [
    (hasName ? `${name}，` : '') + '這個我還不太會聊，但我想聽你說——多講一點？',
    '嗯嗯，我在聽。後來呢？',
    '哈，這題有點考倒我了，你怎麼看？',
    '我還在學著聊這個～對了，按 🧠 開 AI 大腦，我會聊得更順喔。'
  ];

  if (/en/i.test(locale)) {
    defaultList = [
      (hasName ? `${name}, ` : '') +
        'I am still learning to chat about this, but I would love to hear more from you!',
      'Mhm, I am listening. What happened next?',
      'Haha, this question stumped me a bit. What do you think?',
      'I am still getting the hang of this~ By the way, click 🧠 to enable AI Brain for smoother conversations.'
    ];
  } else if (/ja/i.test(locale)) {
    defaultList = [
      (hasName ? `${name}さん、` : '') +
        'それについてはまだ勉強中ですが、もっと詳しく聞かせてくれますか？',
      'うんうん、聞いていますよ。それからどうなりましたか？',
      'ふふ、ちょっと難しい質問ですね！あなたはどう思いますか？',
      'もっとスムーズに話せるよう練習中です〜 🧠 を押してAIブレインを有効にすると、より自然に会話できますよ！'
    ];
  } else if (/ko/i.test(locale)) {
    defaultList = [
      (hasName ? `${name}님, ` : '') +
        '그 부분은 아직 잘 모르지만, 더 자세히 이야기해 주실 수 있나요?',
      '네, 듣고 있어요. 그 다음엔 어떻게 되었나요?',
      '하하, 조금 어려운 질문이네요! 어떻게 생각하세요?',
      '더自然스럽게 대화하도록 배우는 중이에요~ 🧠를 눌러 AI 브레인을 켜면 더 매끄럽게 이야기할 수 있어요.'
    ];
  }

  const rawList = resolveLocalized(
    brainEngine?.companionFallback,
    locale,
    defaultList,
    templateContext
  );
  const companionFallbackList =
    Array.isArray(rawList) && rawList.length > 0 ? rawList : defaultList;

  return companionFallbackList[
    brainEngine.companionFallbackIdx++ % companionFallbackList.length
  ];
}

/**
 * Processes question retrieval and ranking against knowledge bases.
 *
 * @param {import('@types').BrainEngine} brainEngine - Brain engine instance.
 * @param {string} rawQuestion - Raw user question text.
 * @returns {string} Matched answer or fallback response text.
 */
export function getRetrievalAnswer(brainEngine, rawQuestion) {
  const locale = brainEngine?.locale || 'zh-TW';
  const question = (rawQuestion || '').trim();
  if (question === '') {
    if (/en/i.test(locale)) {
      return "I didn't hear that clearly, could you say it again?";
    }
    if (/ja/i.test(locale)) {
      return 'うまく聞き取れませんでした。もう一度言っていただけますか？';
    }
    if (/ko/i.test(locale)) {
      return '잘 듣지 못했어요. 다시 한 번 말씀해 주시겠어요?';
    }
    return '我好像沒聽清楚，可以再說一次嗎？';
  }
  const currentAvatarMode = brainEngine?.avatarMode;
  const currentCustomMode = brainEngine?.modes?.[currentAvatarMode];

  const targetKnowledge =
    Array.isArray(currentCustomMode?.knowledge) &&
    currentCustomMode.knowledge.length > 0
      ? currentCustomMode.knowledge
      : brainEngine.knowledge;

  const site = findBestMatch(targetKnowledge, question);
  if (currentAvatarMode === AVATAR_MODE_MAP.companion) {
    // 陪伴模式：聊天題給陪聊腦、網站/產品題照答
    const chat = findBestMatch(brainEngine.companionKnowledge, question);
    if (
      chat.entry !== null &&
      chat.score >= 0.16 &&
      chat.score + 0.05 >= site.score
    ) {
      return chat.entry.a;
    }
    if (site.entry !== null && site.score >= 0.16) {
      return site.entry.a;
    }
    return getCompanionFallbackResponse(brainEngine, question);
  }
  if (site.entry !== null && site.score >= 0.16) {
    return site.entry.a;
  }

  if (
    typeof currentCustomMode?.fallback !== 'undefined' &&
    currentCustomMode?.fallback !== null
  ) {
    if (
      Array.isArray(currentCustomMode.fallback) &&
      currentCustomMode.fallback.length > 0
    ) {
      return (
        currentCustomMode.fallback[
          Math.floor(Math.random() * currentCustomMode.fallback.length)
        ] || ''
      );
    }
    const resolvedCustomFallback = resolveLocalized(
      currentCustomMode.fallback,
      locale,
      undefined,
      { question, locale }
    );
    if (typeof resolvedCustomFallback === 'string') {
      return resolvedCustomFallback;
    }
  }

  if (
    typeof brainEngine.assistantFallbackContext !== 'undefined' &&
    brainEngine.assistantFallbackContext !== null
  ) {
    const resolvedFallbackContext = resolveLocalized(
      brainEngine.assistantFallbackContext,
      locale,
      undefined,
      { question, locale }
    );
    if (typeof resolvedFallbackContext === 'string') {
      return resolvedFallbackContext;
    }
  }

  if (/en/i.test(locale)) {
    return (
      'You asked about "' +
      question +
      '", right? My knowledge base does not cover this yet. You can ask me questions like "What is this?", "How to install to project?", "Supports 3D & custom models?", or "How does the AI Brain work?".'
    );
  }
  if (/ja/i.test(locale)) {
    return (
      '「' +
      question +
      '」についてですね。知識ベースにまだ登録されていません。「これは何ですか？」「プロジェクトへの導入方法は？」「3D対応やアバター変更は？」「AIブレインの仕組みは？」などを聞いてみてください。'
    );
  }
  if (/ko/i.test(locale)) {
    return (
      '"' +
      question +
      '"에 대한 질문이시군요? 지식 베이스에 아직 등록되지 않았습니다. "이것은 무엇인가요?", "프로젝트에 어떻게 설치하나요?", "3D 지원 및 캐릭터 변경은?", "AI 브레인은 어떻게 작동하나요?" 등을 물어보실 수 있어요.'
    );
  }

  return (
    '你問的是「' +
    question +
    '」對吧？這題我的知識庫還沒收錄～你可以問我「這是什麼」「怎麼安裝到專案」「支援 3D 與換角色嗎」「AI 大腦是如何運作的」「怎麼使用工具調用」這些喔。'
  );
}

/**
 * Appends a conversation turn message to internal history log.
 *
 * @param {import('@types').BrainEngine} brainEngine - Brain engine instance.
 * @param {string} role - Message author role ('user' | 'assistant').
 * @param {string} text - Message text content.
 * @param {Object} [options={}] - Additional message options.
 * @param {string} [options.id] - Unique message ID.
 * @param {boolean} [options.streaming] - Whether message is actively streaming.
 * @param {Object} [options.pendingTool] - Pending tool descriptor.
 * @param {Array<any>} [options.pendingChoices] - Pending options list.
 * @returns {string} Generated or assigned message ID.
 */
export function addChatMessage(brainEngine, role, text, options = {}) {
  const item = {
    id: options.id || 'm' + ++brainEngine.chatSeq,
    role: role === 'user' ? 'user' : 'assistant',
    text: String(text || '').slice(0, 4000),
    streaming: Boolean(options.streaming),
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

/**
 * Updates an existing message in conversation history log.
 *
 * @param {import('@types').BrainEngine} brainEngine - Brain engine instance.
 * @param {string} id - Target message ID.
 * @param {string} text - Updated text content.
 * @param {boolean} streaming - Whether message is still streaming.
 * @returns {string} Updated message ID.
 */
export function updateChatMessage(brainEngine, id, text, streaming) {
  const item = brainEngine.chatLog.find((msg) => msg.id === id);
  if (item === undefined) {
    return addChatMessage(brainEngine, 'assistant', text, { id, streaming });
  }
  item.text = String(text || '').slice(0, 4000);
  item.streaming = Boolean(streaming);
  if (typeof brainEngine.onUpdateChatMessage === 'function') {
    brainEngine.onUpdateChatMessage(item);
  }
  if (typeof brainEngine.onChatHistoryChanged === 'function') {
    brainEngine.onChatHistoryChanged(brainEngine.chatLog);
  }
  return item.id;
}

/**
 * Handles full question answering lifecycle with priority routing (AI Provider -> WebLLM -> Knowledge Retrieval).
 *
 * @param {import('@types').BrainEngine} brainEngine - Brain engine instance.
 * @param {string} question - User question text.
 * @returns {Promise<void>}
 */
export async function answerQuestion(brainEngine, question) {
  const safeQuestion = (question || '').trim();
  if (safeQuestion === '') {
    if (typeof brainEngine.onSpokenAudioTextChange === 'function') {
      brainEngine.onSpokenAudioTextChange(
        getBrainMessage(brainEngine, 'brain.notClear')
      );
    }
    return;
  }

  function notifyFallback(fromEngine, toEngine, error) {
    if (typeof brainEngine.onBrainFallback === 'function') {
      try {
        brainEngine.onBrainFallback(fromEngine, toEngine, error);
      } catch (fallbackError) {
        console.error('[answerQuestion] onBrainFallback error:', fallbackError);
      }
    }
  }

  function triggerBackgroundWebLLMLoad() {
    if (
      brainEngine.autoFallbackWebLLM === true &&
      brainEngine.llm?.supported === true &&
      brainEngine.llm?.state === brainEngine.STATE_MAP.IDLE
    ) {
      brainEngine.llm.load().catch((loadError) => {
        console.warn(
          '[answerQuestion] Background WebLLM fallback loading failed:',
          loadError
        );
      });
    }
  }

  // 1) AI 伺服器大腦（最聰明，優先；整段生成後逐句講）
  if (
    brainEngine.aiProvider?.enabled === true &&
    brainEngine.aiProvider.ready === true
  ) {
    try {
      if (typeof brainEngine.chatWithAiProvider === 'function') {
        return await brainEngine.chatWithAiProvider(question);
      }
      return await chatWithAiProvider(brainEngine, question);
    } catch (error) {
      console.warn(
        '[answerQuestion] AI Provider 呼叫失敗，嘗試降級至 WebLLM 或檢索式後備：',
        error
      );
      triggerBackgroundWebLLMLoad();
      const targetFallback =
        brainEngine.llm?.state === brainEngine.STATE_MAP.READY
          ? BRAIN_ENGINE_TYPE_MAP.WEB_LLM
          : BRAIN_ENGINE_TYPE_MAP.RETRIEVAL;
      notifyFallback(BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER, targetFallback, error);
    }
  } else if (
    brainEngine.aiProvider?.enabled === true &&
    brainEngine.aiProvider.ready === false
  ) {
    triggerBackgroundWebLLMLoad();
  }

  // 2) 瀏覽器內 WebLLM：串流 → 每切出一個完整句就丟進逐句佇列開講（首句延遲大幅縮短）
  if (brainEngine.llm?.state === brainEngine.STATE_MAP.READY) {
    try {
      if (typeof brainEngine.chatWithWebLLM === 'function') {
        return await brainEngine.chatWithWebLLM(question);
      }
      return await chatWithWebLLM(brainEngine, question);
    } catch (error) {
      console.warn(
        '[answerQuestion] WebLLM 呼叫失敗，嘗試降級至檢索式後備：',
        error
      );
      notifyFallback(
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM,
        BRAIN_ENGINE_TYPE_MAP.RETRIEVAL,
        error
      );
    }
  }

  // 3) 檢索式後備（零金鑰、永遠可用）
  const retrievalAnswer = getRetrievalAnswer(brainEngine, safeQuestion);
  if (typeof brainEngine.emitAnswer === 'function') {
    brainEngine.emitAnswer(retrievalAnswer);
  } else {
    emitAnswer(brainEngine, retrievalAnswer);
  }
}

/**
 * Emits and records assistant answer text (history turn, chat UI, voice synthesis, emotion).
 *
 * @param {import('@types').BrainEngine} brainEngine - Brain engine instance.
 * @param {string} text - Answer content text.
 */
export function emitAnswer(brainEngine, text) {
  if (typeof text !== 'string' || text === '') {
    return;
  }
  brainEngine.memory.addTurn('assistant', text);
  addChatMessage(brainEngine, 'assistant', text);
  if (typeof brainEngine.applyEmotionFromText === 'function') {
    brainEngine.applyEmotionFromText(text);
  }
  if (typeof brainEngine.onSpokenAudioPlayNow === 'function') {
    brainEngine.onSpokenAudioPlayNow(text);
  }
  if (typeof brainEngine.triggerRollingSummaryIfNeeded === 'function') {
    brainEngine.triggerRollingSummaryIfNeeded();
  }
}

/**
 * Validates that a custom Brain engine implementation provides all required methods and properties.
 *
 * @param {any} engine - Custom engine instance candidate.
 * @returns {{ isValid: boolean, missing: string[] }} Validation result and list of missing members.
 */
export function validateBrainEngine(engine) {
  if (typeof engine !== 'object' || engine === null) {
    return { isValid: false, missing: ['engine object'] };
  }
  const requiredMethods = [
    'addChatMessage',
    'updateChatMessage',
    'answerQuestion',
    'getWelcomeText',
    'buildLLMMessages',
    'classifyEmotion',
    'applyEmotionFromText'
  ];
  const requiredProps = ['memory', 'llm', 'aiProvider', 'chatLog', 'chatSeq'];
  const missing = [];
  requiredMethods.forEach((methodName) => {
    if (typeof engine[methodName] !== 'function') {
      missing.push(`${methodName}()`);
    }
  });
  requiredProps.forEach((propName) => {
    if (engine[propName] === undefined) {
      missing.push(propName);
    }
  });
  return { isValid: missing.length === 0, missing };
}
