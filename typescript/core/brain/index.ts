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
import type {
  BrainEngine,
  BrainEngineOptions,
  AvatarMode,
  KnowledgeEntry,
  MemoryInstance,
  LLMEngine,
  AiProviderEngine,
  ChatLogItem,
  AddChatMessageOptions
} from './types';
import { fetchKnowledge, findBestMatch } from './knowledge';
import { classifyEmotion, applyEmotionFromText } from './emotion';
import { initMemory, triggerRollingSummaryIfNeeded } from './memory';
import {
  getBrainMessage,
  getWelcomeText,
  buildDefaultLLMMessages
} from './messages';
import { initWebLLM, chatWithWebLLM } from './web-llm';
import { initAiProvider, chatWithAiProvider } from './ai-provider';

export * from './types';
export * from './compression';
export * from './knowledge';
export * from './emotion';
export * from './memory';
export * from './messages';
export * from './tool-calling';
export * from './web-llm';
export * from './ai-provider';

/**
 * Creates and initializes the Brain cognitive engine instance (orchestrating AI Provider, WebLLM, RAG knowledge, and memory).
 *
 * @param setting - Brain engine options.
 * @returns Initialized Brain engine instance.
 */
export async function initBrainEngine(
  setting: BrainEngineOptions = {}
): Promise<BrainEngine> {
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

  let llm: LLMEngine | null = null;
  let memory: MemoryInstance | null = null;
  let aiProvider: AiProviderEngine | null = null;

  const safeKnowledge: KnowledgeEntry[] =
    Array.isArray(knowledge) && knowledge.length > 0
      ? (knowledge as KnowledgeEntry[])
      : await fetchKnowledge(knowledgeUrl);
  const safeCompanionKnowledge: KnowledgeEntry[] =
    Array.isArray(companionKnowledge) && companionKnowledge.length > 0
      ? (companionKnowledge as KnowledgeEntry[])
      : await fetchKnowledge(companionKnowledgeUrl);

  const _store = createBaseStore({});
  void _store;

  let _welcomeText: string | ((context: unknown) => string) | null = null;
  let _companionWelcomeText: string | ((context: unknown) => string) | null =
    null;
  let _assistantWelcomeText: string | ((context: unknown) => string) | null =
    null;

  const brainEngine: BrainEngine = {
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

    setGender: (newGender: string) => {
      brainEngine.gender = newGender;
    },

    setLocale: (newLocale: string) => {
      brainEngine.locale = newLocale;
    },

    get welcomeText() {
      return _welcomeText;
    },
    set welcomeText(
      newWelcomeText: string | ((context: unknown) => string) | null
    ) {
      _welcomeText = newWelcomeText;
    },

    get companionWelcomeText() {
      return _companionWelcomeText;
    },
    set companionWelcomeText(
      newCompanionWelcomeText: string | ((context: unknown) => string) | null
    ) {
      _companionWelcomeText = newCompanionWelcomeText;
    },

    get assistantWelcomeText() {
      return _assistantWelcomeText;
    },
    set assistantWelcomeText(
      newAssistantWelcomeText: string | ((context: unknown) => string) | null
    ) {
      _assistantWelcomeText = newAssistantWelcomeText;
    },

    buildLLMMessages:
      typeof buildLLMMessages === 'function'
        ? buildLLMMessages
        : (question: string, engineType: string) =>
            buildDefaultLLMMessages(brainEngine, question, engineType),

    get buildDefaultLLMMessages() {
      return (question: string, engineType: string) =>
        buildDefaultLLMMessages(brainEngine, question, engineType);
    },

    getWelcomeText: () => getWelcomeText(brainEngine),
    classifyEmotion: classifyEmotion,

    applyEmotionFromText: (text: string) =>
      applyEmotionFromText(brainEngine, text),
    answerQuestion: (question: string) => answerQuestion(brainEngine, question),
    emitAnswer: (text: string) => emitAnswer(brainEngine, text),
    getRetrievalAnswer: (rawQuestion: string) =>
      getRetrievalAnswer(brainEngine, rawQuestion),
    getCompanionFallbackResponse: (question: string) =>
      getCompanionFallbackResponse(brainEngine, question),
    chatWithAiProvider: (question: string) =>
      chatWithAiProvider(brainEngine, question),
    chatWithWebLLM: (question: string) => chatWithWebLLM(brainEngine, question),
    triggerRollingSummaryIfNeeded: () =>
      triggerRollingSummaryIfNeeded(brainEngine),

    addChatMessage: (
      role: string,
      text: string,
      options?: AddChatMessageOptions
    ) => addChatMessage(brainEngine, role, text, options),
    updateChatMessage: (id: string, text: string, streaming?: boolean) =>
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
    set enableMemory(enabled: boolean) {
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
    set enableAiProvider(enabled: boolean) {
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
        typeof brainEngine.modes === 'object' && brainEngine.modes !== null
          ? Object.keys(brainEngine.modes)
          : [];
      return Array.from(
        new Set([...Object.values(AVATAR_MODE_MAP), ...customModeKeys])
      );
    }
  } as unknown as BrainEngine;

  if (typeof welcomeText === 'function' || typeof welcomeText === 'string') {
    brainEngine.welcomeText = welcomeText;
  }
  if (
    typeof companionWelcomeText === 'function' ||
    typeof companionWelcomeText === 'string'
  ) {
    brainEngine.companionWelcomeText = companionWelcomeText;
  }
  if (
    typeof assistantWelcomeText === 'function' ||
    typeof assistantWelcomeText === 'string'
  ) {
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
      onLoading: (...args: unknown[]) => {
        return brainEngine.onLlmLoading?.(...args);
      },
      onLoadProgress: (progressInfo?: unknown, ...args: unknown[]) => {
        const safeProgress =
          typeof progressInfo === 'number'
            ? progressInfo
            : typeof (progressInfo as { progress?: unknown })?.progress ===
                'number'
              ? Number((progressInfo as { progress: number }).progress)
              : 0;
        const progressPayload =
          typeof progressInfo === 'object' && progressInfo !== null
            ? { ...progressInfo, progress: safeProgress }
            : { progress: safeProgress };
        return brainEngine.onLlmLoadProgress?.(progressPayload, ...args);
      },
      onLoaded: (engineInstance?: unknown, ...args: unknown[]) => {
        return brainEngine.onLlmLoaded?.(engineInstance, ...args);
      },
      onLoadError: (error?: unknown, ...args: unknown[]) => {
        const safeError =
          error instanceof Error
            ? error
            : new Error(String(error ?? 'Unknown error'));
        return brainEngine.onLlmLoadError?.(safeError, ...args);
      },
      onChatting: (response?: unknown, ...args: unknown[]) => {
        return brainEngine.onLlmChatting?.(response, ...args);
      },
      onStreamChatting: (chunk?: unknown, ...args: unknown[]) => {
        return brainEngine.onLlmStreamChatting?.(chunk, ...args);
      }
    },
    brainEngine
  );
  memory = initMemory({
    avatarMode: brainEngine.avatarMode as AvatarMode,
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

    onConnecting: (fetchSetting?: unknown, ...args: unknown[]) => {
      return brainEngine.onAiProviderConnecting?.(fetchSetting, ...args);
    },
    onConnected: (response?: unknown, ...args: unknown[]) => {
      return brainEngine.onAiProviderConnected?.(response, ...args);
    },
    onError: (error?: unknown, ...args: unknown[]) => {
      const safeError =
        error instanceof Error
          ? error
          : new Error(String(error ?? 'Unknown error'));
      return brainEngine.onAiProviderError?.(safeError, ...args);
    },
    onChatting: (response?: unknown, ...args: unknown[]) => {
      return brainEngine.onAiProviderChatting?.(response, ...args);
    },
    onStreamChatting: (chunk?: unknown, ...args: unknown[]) => {
      return brainEngine.onAiProviderStreamChatting?.(chunk, ...args);
    }
  });

  if (
    brainEngine.preloadWebLLM === true &&
    brainEngine.llm?.supported === true
  ) {
    brainEngine.llm.load().catch((error: unknown) => {
      console.warn('[initBrainEngine] Preload WebLLM failed:', error);
    });
  }

  return brainEngine;
}

/**
 * Generates default fallback response text for companion persona mode when question is not found in knowledge.
 *
 * @param brainEngine - Brain engine instance.
 * @param question - User question text.
 * @returns Fallback response string.
 */
export function getCompanionFallbackResponse(
  brainEngine: BrainEngine | Record<string, unknown>,
  question: string
): string {
  const engine = brainEngine as Partial<BrainEngine> & Record<string, unknown>;
  const locale = engine?.locale || 'zh-TW';
  const name =
    (engine?.memory?.data as { name?: string } | undefined)?.name || '';
  const templateContext = { question, name, locale };

  if (
    typeof engine?.companionFallbackContext !== 'undefined' &&
    engine?.companionFallbackContext !== null
  ) {
    const resolvedFallbackText = resolveLocalized(
      engine.companionFallbackContext,
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
    engine?.companionFallback,
    locale,
    defaultList,
    templateContext
  );
  const companionFallbackList =
    Array.isArray(rawList) && rawList.length > 0
      ? (rawList as string[])
      : defaultList;

  const currentIdx =
    typeof engine.companionFallbackIdx === 'number'
      ? engine.companionFallbackIdx
      : 0;
  engine.companionFallbackIdx = currentIdx + 1;
  return companionFallbackList[currentIdx % companionFallbackList.length];
}

/**
 * Processes question retrieval and ranking against knowledge bases.
 *
 * @param brainEngine - Brain engine instance.
 * @param rawQuestion - Raw user question text.
 * @returns Matched answer or fallback response text.
 */
export function getRetrievalAnswer(
  brainEngine: BrainEngine | Record<string, unknown>,
  rawQuestion: string
): string {
  const engine = brainEngine as Partial<BrainEngine> & Record<string, unknown>;
  const locale = engine?.locale || 'zh-TW';
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
  const currentAvatarMode = (engine?.avatarMode || '') as string;
  const currentCustomMode = (engine?.modes?.[currentAvatarMode] || {}) as {
    knowledge?: KnowledgeEntry[];
    fallback?: unknown;
  };

  const targetKnowledge =
    Array.isArray(currentCustomMode?.knowledge) &&
    currentCustomMode.knowledge.length > 0
      ? currentCustomMode.knowledge
      : engine.knowledge || [];

  const site = findBestMatch(targetKnowledge, question);
  if (currentAvatarMode === AVATAR_MODE_MAP.companion) {
    const chat = findBestMatch(engine.companionKnowledge || [], question);
    if (
      chat.entry !== null &&
      chat.score >= 0.16 &&
      chat.score + 0.05 >= site.score
    ) {
      return chat.entry.a || '';
    }
    if (site.entry !== null && site.score >= 0.16) {
      return site.entry.a || '';
    }
    return getCompanionFallbackResponse(engine, question);
  }
  if (site.entry !== null && site.score >= 0.16) {
    return site.entry.a || '';
  }

  if (
    typeof currentCustomMode?.fallback !== 'undefined' &&
    currentCustomMode?.fallback !== null
  ) {
    if (
      Array.isArray(currentCustomMode.fallback) &&
      currentCustomMode.fallback.length > 0
    ) {
      const fallbackList = currentCustomMode.fallback as string[];
      return (
        fallbackList[Math.floor(Math.random() * fallbackList.length)] || ''
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
    typeof engine.assistantFallbackContext !== 'undefined' &&
    engine.assistantFallbackContext !== null
  ) {
    const resolvedFallbackContext = resolveLocalized(
      engine.assistantFallbackContext,
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
 * @param brainEngine - Brain engine instance.
 * @param role - Message author role ('user' | 'assistant').
 * @param text - Message text content.
 * @param options - Additional message options.
 * @returns Generated or assigned message ID.
 */
export function addChatMessage(
  brainEngine: BrainEngine | Record<string, unknown>,
  role: string,
  text: string,
  options: AddChatMessageOptions = {}
): string {
  const engine = brainEngine as Partial<BrainEngine> & {
    chatSeq: number;
    chatLog: ChatLogItem[];
  };
  const item: ChatLogItem = {
    id: options.id || 'm' + ++engine.chatSeq,
    role: role === 'user' ? 'user' : 'assistant',
    text: String(text || '').slice(0, 4000),
    streaming: Boolean(options.streaming),
    pendingTool: options.pendingTool || null,
    pendingChoices: options.pendingChoices || null
  };
  engine.chatLog.push(item);
  if (engine.chatLog.length > 80) {
    engine.chatLog.shift();
  }

  if (typeof engine.onAddChatMessage === 'function') {
    const callback = engine.onAddChatMessage as (...args: unknown[]) => unknown;
    if (callback.length <= 1) {
      callback(item);
    } else {
      callback(item.role, item.text, options);
    }
  }
  if (typeof engine.onChatHistoryChanged === 'function') {
    engine.onChatHistoryChanged(engine.chatLog);
  }
  return item.id;
}

/**
 * Updates an existing message in conversation history log.
 *
 * @param brainEngine - Brain engine instance.
 * @param id - Target message ID.
 * @param text - Updated text content.
 * @param streaming - Whether message is still streaming.
 * @returns Updated message ID.
 */
export function updateChatMessage(
  brainEngine: BrainEngine | Record<string, unknown>,
  id: string,
  text: string,
  streaming?: boolean
): string {
  const engine = brainEngine as Partial<BrainEngine> & {
    chatSeq: number;
    chatLog: ChatLogItem[];
  };
  const item = engine.chatLog.find((msg: ChatLogItem) => msg.id === id);
  if (item === undefined) {
    return addChatMessage(engine, 'assistant', text, { id, streaming });
  }
  item.text = String(text || '').slice(0, 4000);
  item.streaming = Boolean(streaming);
  if (typeof engine.onUpdateChatMessage === 'function') {
    const callback = engine.onUpdateChatMessage as (
      ...args: unknown[]
    ) => unknown;
    if (callback.length <= 1) {
      callback(item);
    } else {
      callback(item.id, item.text, item.streaming);
    }
  }
  if (typeof engine.onChatHistoryChanged === 'function') {
    engine.onChatHistoryChanged(engine.chatLog);
  }
  return item.id;
}

/**
 * Handles full question answering lifecycle with priority routing (AI Provider -> WebLLM -> Knowledge Retrieval).
 *
 * @param brainEngine - Brain engine instance.
 * @param question - User question text.
 */
export async function answerQuestion(
  brainEngine: BrainEngine | Record<string, unknown>,
  question: string
): Promise<string | void> {
  const engine = brainEngine as Partial<BrainEngine> & Record<string, unknown>;
  const safeQuestion = (question || '').trim();
  if (safeQuestion === '') {
    if (typeof engine.onSpokenAudioTextChange === 'function') {
      engine.onSpokenAudioTextChange(getBrainMessage(engine, 'brain.notClear'));
    }
    return;
  }

  function notifyFallback(
    fromEngine: string,
    toEngine: string,
    error: unknown
  ) {
    if (typeof engine.onBrainFallback === 'function') {
      try {
        engine.onBrainFallback(fromEngine, toEngine, error);
      } catch (fallbackError) {
        console.error('[answerQuestion] onBrainFallback error:', fallbackError);
      }
    }
  }

  function triggerBackgroundWebLLMLoad() {
    if (
      engine.autoFallbackWebLLM === true &&
      engine.llm?.supported === true &&
      engine.llm?.state === STATE_MAP.IDLE
    ) {
      engine.llm.load().catch((loadError: unknown) => {
        console.warn(
          '[answerQuestion] Background WebLLM fallback loading failed:',
          loadError
        );
      });
    }
  }

  if (engine.aiProvider?.enabled === true && engine.aiProvider.ready === true) {
    try {
      if (typeof engine.chatWithAiProvider === 'function') {
        return await engine.chatWithAiProvider(question);
      }
      return await chatWithAiProvider(engine, question);
    } catch (error) {
      console.warn(
        '[answerQuestion] AI Provider 呼叫失敗，嘗試降級至 WebLLM 或檢索式後備：',
        error
      );
      triggerBackgroundWebLLMLoad();
      const targetFallback =
        engine.llm?.state === STATE_MAP.READY
          ? BRAIN_ENGINE_TYPE_MAP.WEB_LLM
          : BRAIN_ENGINE_TYPE_MAP.RETRIEVAL;
      notifyFallback(BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER, targetFallback, error);
    }
  } else if (
    engine.aiProvider?.enabled === true &&
    engine.aiProvider.ready === false
  ) {
    triggerBackgroundWebLLMLoad();
  }

  if (engine.llm?.state === STATE_MAP.READY) {
    try {
      if (typeof engine.chatWithWebLLM === 'function') {
        return await engine.chatWithWebLLM(question);
      }
      return await chatWithWebLLM(engine, question);
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
  } else if (engine.llm?.supported === true) {
    console.info(
      `[answerQuestion] WebLLM 當前狀態為 "${engine.llm?.state}"（非 READY），使用知識庫檢索模式處理。`
    );
  }

  const retrievalAnswer = getRetrievalAnswer(engine, safeQuestion);
  console.info(
    `[answerQuestion] 已生成知識庫檢索回答 (問題: "${safeQuestion}")`
  );
  if (typeof engine.emitAnswer === 'function') {
    return engine.emitAnswer(retrievalAnswer);
  }
  return emitAnswer(engine, retrievalAnswer);
}

/**
 * Emits and records assistant answer text (history turn, chat UI, voice synthesis, emotion).
 *
 * @param brainEngine - Brain engine instance.
 * @param text - Answer content text.
 */
export function emitAnswer(
  brainEngine: BrainEngine | Record<string, unknown>,
  text: string
): string | void {
  const engine = brainEngine as Partial<BrainEngine> & Record<string, unknown>;
  if (typeof text !== 'string' || text === '') {
    return;
  }
  if (engine.memory?.addTurn) {
    engine.memory.addTurn('assistant', text);
  }
  const messageId = addChatMessage(engine, 'assistant', text);
  if (typeof engine.applyEmotionFromText === 'function') {
    engine.applyEmotionFromText(text);
  }
  if (typeof engine.onSpokenAudioPlayNow === 'function') {
    engine.onSpokenAudioPlayNow(text);
  }
  if (typeof engine.triggerRollingSummaryIfNeeded === 'function') {
    engine.triggerRollingSummaryIfNeeded();
  }
  return messageId;
}

/**
 * Validates that a custom Brain engine implementation provides all required methods and properties.
 *
 * @param engine - Custom engine instance candidate.
 * @returns Validation result and list of missing members.
 */
export function validateBrainEngine(engine: unknown): {
  isValid: boolean;
  missing: string[];
} {
  if (typeof engine !== 'object' || engine === null) {
    return { isValid: false, missing: ['engine object'] };
  }
  const engineObj = engine as Record<string, unknown>;
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
  const missing: string[] = [];
  requiredMethods.forEach((methodName) => {
    if (typeof engineObj[methodName] !== 'function') {
      missing.push(`${methodName}()`);
    }
  });
  requiredProps.forEach((propName) => {
    if (engineObj[propName] === undefined) {
      missing.push(propName);
    }
  });
  return { isValid: missing.length === 0, missing };
}
