import { initBrainEngine, validateBrainEngine } from '@/core/brain';
import { initSpeechEngine, validateSpeechEngine } from '@/core/speech';
import { initToolsEngine, validateToolsEngine } from '@/core/tools';
import { initSkinEngine, validateSkinEngine } from '@/core/skin';
import { createEmotionToolsPlugin } from '@/core/plugins';
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_MAX_TOKENS,
  DEFAULT_AI_PROVIDER_MODEL,
  DEFAULT_AI_PROVIDER_MAX_TOKENS,
  DEFAULT_TTS_ENDPOINT,
  ENGINE_MODE_MAP,
  AI_PROVIDER_STATUS_MAP
} from '@/core/constants';
import type { AvatarMode } from '@/core/types';
import { renderHistory, initSkinModeChangeButton, type UiDom } from '@/core/ui';
import { callOptionEvent } from './options';
import type { I18nEngine } from '@/core/i18n';
import type {
  BrainEngine,
  BrainCompressionOptions,
  UpdateChatMessageOptions
} from '@/core/brain';
import type { SpeechEngine, SpeechEngineOptions } from '@/core/speech';
import type { SkinEngine } from '@/core/skin';
import type {
  ToolsEngine,
  ToolDefinition,
  ToolOfferInfo,
  ToolInputRequiredInfo,
  ToolAmbiguousInfo,
  ToolConfirmInfo,
  ToolCancelInfo,
  ToolExecuteInfo,
  ToolResultData,
  ToolEventName,
  ToolsEngineOptions
} from '@/core/tools';
import type { AiAvatarWidget, AvatarBotOptions, AvatarBotStore } from './types';
import type { StreamPipeline } from './pipeline-stream';

export interface SetupBrainParams {
  options: AvatarBotOptions;
  widget: AiAvatarWidget;
  rootStore: AvatarBotStore;
  i18nEngine: I18nEngine;
  getEngines: () => {
    brainEngine: BrainEngine | null;
    speechEngine: SpeechEngine | null;
    skinEngine: SkinEngine | null;
    toolsEngine: ToolsEngine | null;
  };
  getUiDom: () => UiDom | null;
  streamPipeline: StreamPipeline;
}

/**
 * Creates and initializes the Brain engine instance.
 */
export async function setupBrainEngine({
  options,
  widget,
  rootStore,
  i18nEngine,
  getEngines,
  getUiDom,
  streamPipeline
}: SetupBrainParams): Promise<BrainEngine | null> {
  const {
    webLlmModel,
    llmModel,
    webLlmFallbackModel,
    llmFallbackModel,
    enableOomFallback = options.enableOomFallback,
    llmMaxTokens,
    maxHistoryTurns,
    memoryKey,
    memoryAdapter,
    sharedKnowledge = options.sharedKnowledge,
    sharedKnowledgeUrl = options.sharedKnowledgeUrl,
    assistantKnowledgeUrl = options.assistantKnowledgeUrl,
    knowledgeUrl = options.knowledgeUrl,
    companionKnowledgeUrl = options.companionKnowledgeUrl,
    assistantKnowledge = options.assistantKnowledge,
    knowledge = options.knowledge,
    companionKnowledge = options.companionKnowledge,
    companionFallback = options.companionFallback || [],
    knowledgeLimit = options.knowledgeLimit,
    ragTopK = options.ragTopK,
    knowledgeFilter = options.knowledgeFilter,
    aiProviderBaseUrl = '',
    aiProviderModel = DEFAULT_AI_PROVIDER_MODEL,
    aiProviderHeaders,
    aiProviderCreateFetchSetting,
    aiProviderCreateFetchPayload,
    aiProviderResponseFormat,
    aiProviderPingUrl = options.aiProviderPingUrl,
    aiProviderAutoPing = options.aiProviderAutoPing,
    aiProviderMaxTokens,
    aiProviderIsStream,
    customEngines = {},
    compression = {},
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext,
    languageRule,
    genderRule
  } = options;

  const resolvedWebLlmModel =
    (typeof webLlmModel === 'string' && webLlmModel !== ''
      ? webLlmModel
      : undefined) ||
    (typeof llmModel === 'string' && llmModel !== '' ? llmModel : undefined) ||
    DEFAULT_LLM_MODEL;

  const resolvedWebLlmFallbackModel =
    webLlmFallbackModel !== undefined
      ? webLlmFallbackModel
      : llmFallbackModel !== undefined
        ? llmFallbackModel
        : undefined;

  const resolvedLlmMaxTokens =
    typeof llmMaxTokens === 'number' &&
    Number.isFinite(llmMaxTokens) === true &&
    llmMaxTokens > 0
      ? llmMaxTokens
      : DEFAULT_LLM_MAX_TOKENS;

  const brainOptions: Record<string, unknown> = {
    webLlmModel: resolvedWebLlmModel,
    webLlmFallbackModel: resolvedWebLlmFallbackModel,
    enableOomFallback:
      typeof enableOomFallback === 'boolean' ? enableOomFallback : true,
    reasoning: options.reasoning,
    onLlmOomFallback: (
      primaryModel: string,
      fallbackModel: string,
      error: unknown
    ) => {
      return callOptionEvent(
        options,
        widget,
        'onLlmOomFallback',
        {
          failedModel: primaryModel,
          fallbackModel,
          error
        },
        primaryModel,
        fallbackModel,
        error
      );
    },
    llmMaxTokens: resolvedLlmMaxTokens,
    preloadWebLLM: rootStore.getState().preloadWebLLM,
    autoFallbackWebLLM: rootStore.getState().autoFallbackWebLLM,
    enableAutoContinue: rootStore.getState().enableAutoContinue,
    maxAutoContinuations: rootStore.getState().maxAutoContinuations,
    autoContinueMode: rootStore.getState().autoContinueMode,
    autoContinuePrompt: rootStore.getState().autoContinuePrompt,
    avatarMode: rootStore.getState().avatarMode,
    enableMemory: rootStore.getState().enableMemory,
    enableAiProvider: rootStore.getState().enableAiProvider,
    onBrainFallback:
      options.onBrainFallback ||
      ((
        fromEngine: string,
        toEngine: string,
        error?: unknown,
        ...args: unknown[]
      ) => {
        return callOptionEvent(
          options,
          widget,
          'onBrainFallback',
          fromEngine,
          toEngine,
          error,
          ...args
        );
      }),
    maxHistoryTurns,
    memoryKey,
    memoryAdapter,
    modes: rootStore.getState().modes,
    assistantKnowledgeUrl,
    knowledgeUrl,
    sharedKnowledgeUrl,
    companionKnowledgeUrl,
    assistantKnowledge,
    knowledge,
    sharedKnowledge,
    companionKnowledge,
    companionFallback,
    knowledgeLimit,
    ragTopK,
    knowledgeFilter,
    aiProviderBaseUrl,
    aiProviderModel,
    aiProviderHeaders,
    aiProviderCreateFetchSetting,
    aiProviderCreateFetchPayload,
    aiProviderResponseFormat,
    aiProviderPingUrl,
    aiProviderAutoPing,
    aiProviderMaxTokens:
      typeof aiProviderMaxTokens === 'number' &&
      Number.isFinite(aiProviderMaxTokens) === true &&
      aiProviderMaxTokens > 0
        ? aiProviderMaxTokens
        : DEFAULT_AI_PROVIDER_MAX_TOKENS,
    aiProviderIsStream,
    aiProviderExtractToolCalls: options.aiProviderExtractToolCalls,
    getTools: () => {
      const { toolsEngine } = getEngines();
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        typeof toolsEngine.getAiAvailableTools === 'function'
      ) {
        return toolsEngine.getAiAvailableTools();
      }
      return [];
    },
    getToolByName: (toolName: string) => {
      const { toolsEngine } = getEngines();
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        typeof toolsEngine.getToolByName === 'function'
      ) {
        return toolsEngine.getToolByName(toolName);
      }
      return null;
    },
    offerToolConfirmation: (
      tool: ToolDefinition | unknown,
      toolArguments?: unknown,
      toolOptions?: unknown
    ) => {
      const { toolsEngine, skinEngine, brainEngine, speechEngine } =
        getEngines();
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        typeof toolsEngine.offerTool === 'function'
      ) {
        const defaultContext = {
          skinEngine,
          brainEngine,
          speechEngine,
          aiAvatarWidget: widget,
          store: rootStore,
          i18nEngine
        };
        const resolvedOptions =
          typeof toolOptions === 'object' && toolOptions !== null
            ? {
                ...(toolOptions as Record<string, unknown>),
                context: {
                  ...defaultContext,
                  ...(typeof (toolOptions as Record<string, unknown>)
                    .context === 'object' &&
                  (toolOptions as Record<string, unknown>).context !== null
                    ? ((toolOptions as Record<string, unknown>)
                        .context as Record<string, unknown>)
                    : {})
                }
              }
            : { context: defaultContext };

        toolsEngine.offerTool(
          tool as ToolDefinition,
          '',
          { confidence: 1, reason: 'ai_tool_call' },
          toolArguments as Record<string, unknown> | undefined,
          resolvedOptions
        );
      }
    },
    executeTool: async (
      tool: ToolDefinition | unknown,
      toolArguments?: unknown,
      toolOptions?: Record<string, unknown> | null
    ) => {
      const { toolsEngine, skinEngine, brainEngine, speechEngine } =
        getEngines();
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        typeof toolsEngine.executeToolDirectly === 'function'
      ) {
        const defaultContext = {
          skinEngine,
          brainEngine,
          speechEngine,
          aiAvatarWidget: widget,
          store: rootStore,
          i18nEngine
        };

        const toolOptionsInput =
          typeof toolOptions?.input === 'object' && toolOptions.input !== null
            ? (toolOptions.input as Record<string, unknown>)
            : {};

        const resolvedOptions =
          typeof toolOptions === 'object' && toolOptions !== null
            ? {
                ...toolOptions,
                input: {
                  ...toolOptionsInput,
                  context: {
                    ...defaultContext,
                    ...(typeof toolOptionsInput.context === 'object' &&
                    toolOptionsInput.context !== null
                      ? (toolOptionsInput.context as Record<string, unknown>)
                      : {})
                  },
                  query:
                    typeof toolOptionsInput.query === 'string'
                      ? toolOptionsInput.query
                      : ''
                }
              }
            : { input: { context: defaultContext, query: '' } };

        return await toolsEngine.executeToolDirectly(
          tool as ToolDefinition,
          (toolArguments as Record<string, unknown>) || {},
          resolvedOptions
        );
      }
      return null;
    },
    buildLLMMessages: options.buildLLMMessages,

    i18nEngine,
    locale:
      typeof i18nEngine?.locale === 'string' && i18nEngine.locale !== ''
        ? i18nEngine.locale
        : rootStore.getState().locale,
    gender: rootStore.getState().brainGender || rootStore.getState().gender,
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext,
    languageRule,
    genderRule,
    compression:
      options.compression ||
      (
        options as {
          brain?: { compression?: BrainCompressionOptions };
        }
      ).brain?.compression ||
      compression,

    welcomeText: options.welcomeText,
    companionWelcomeText: options.companionWelcomeText,
    assistantWelcomeText: options.assistantWelcomeText,

    onLlmLoading(...args: unknown[]) {
      const { speechEngine } = getEngines();
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.spokenDisplayText =
          typeof i18nEngine?.t === 'function'
            ? i18nEngine.t('brain.llm.loading')
            : '開始下載 AI 大腦（約 1GB，只需第一次）…';
      }
      return callOptionEvent(options, widget, 'onLlmLoading', ...args);
    },
    onLlmLoadProgress(loadProgress: unknown, ...args: unknown[]) {
      const progressRatio =
        typeof loadProgress === 'number'
          ? loadProgress
          : typeof loadProgress === 'object' &&
              loadProgress !== null &&
              'progress' in loadProgress &&
              typeof (loadProgress as { progress?: unknown }).progress ===
                'number'
            ? (loadProgress as { progress: number }).progress
            : 0;
      const uiDom = getUiDom();
      const llmButtonEl = uiDom?.llmButtonEl;
      if (llmButtonEl instanceof HTMLElement) {
        llmButtonEl.textContent = '🧠 ' + Math.round(progressRatio * 100) + '%';
      }
      return callOptionEvent(
        options,
        widget,
        'onLlmLoadProgress',
        loadProgress,
        ...args
      );
    },
    onLlmLoaded(...args: unknown[]) {
      const { speechEngine } = getEngines();
      const uiDom = getUiDom();
      const llmButtonEl = uiDom?.llmButtonEl;
      if (llmButtonEl instanceof HTMLElement) {
        llmButtonEl.textContent = '🧠✓';
        llmButtonEl.setAttribute('css-llm-on', 'true');
      }
      const loadedMsg =
        typeof i18nEngine?.t === 'function'
          ? i18nEngine.t('brain.llm.loaded')
          : 'AI 大腦啟用完成，現在我可以聊得更自然囉！';
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.spokenAudioText = loadedMsg;
        speechEngine.spokenDisplayText = loadedMsg;
      }
      return callOptionEvent(options, widget, 'onLlmLoaded', ...args);
    },
    onLlmLoadError(error?: unknown, ...args: unknown[]) {
      const { speechEngine } = getEngines();
      const uiDom = getUiDom();
      const llmButtonEl = uiDom?.llmButtonEl;
      if (llmButtonEl instanceof HTMLElement) {
        llmButtonEl.textContent = '🧠✗';
      }
      const errorMsg =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error || '');

      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.spokenDisplayText =
          typeof i18nEngine?.t === 'function'
            ? i18nEngine.t('brain.llm.error', {
                error: errorMsg
              })
            : 'AI 大腦載入失敗：' + errorMsg;
      }
      return callOptionEvent(options, widget, 'onLlmLoadError', error, ...args);
    },
    onAiProviderConnecting(...args: unknown[]) {
      rootStore.setState({
        aiProviderStatus: AI_PROVIDER_STATUS_MAP.CONNECTING,
        aiProviderError: null
      });
      const uiDom = getUiDom();
      const llmButtonEl = uiDom?.llmButtonEl;
      if (llmButtonEl instanceof HTMLElement) {
        llmButtonEl.textContent = '🧠…';
        llmButtonEl.title =
          typeof i18nEngine?.t === 'function'
            ? i18nEngine.t('brain.aiProvider.connecting')
            : 'AI 伺服器大腦（連線中）';
      }
      return callOptionEvent(
        options,
        widget,
        'onAiProviderConnecting',
        ...args
      );
    },
    onAiProviderConnected(
      response?: unknown,
      _fetchSetting?: unknown,
      aiProvider?: unknown,
      ...args: unknown[]
    ) {
      const { brainEngine, speechEngine } = getEngines();
      const uiDom = getUiDom();
      const isConnectionSuccessful =
        typeof response === 'object' &&
        response !== null &&
        'ok' in response &&
        (response as { ok?: unknown }).ok === true;

      rootStore.setState({
        aiProviderStatus:
          isConnectionSuccessful === true
            ? AI_PROVIDER_STATUS_MAP.CONNECTED
            : AI_PROVIDER_STATUS_MAP.ERROR,
        aiProviderError:
          isConnectionSuccessful === true
            ? null
            : 'AI Provider connection failed'
      });

      const llmButtonEl = uiDom?.llmButtonEl;

      const aiProviderObj =
        typeof aiProvider === 'object' && aiProvider !== null
          ? (aiProvider as { model?: unknown })
          : null;
      const aiProviderModelName =
        typeof aiProviderObj?.model === 'string' ? aiProviderObj.model : '';

      if (llmButtonEl instanceof HTMLElement) {
        llmButtonEl.textContent =
          isConnectionSuccessful === true ? '🧠✓' : '🧠✗';
        if (isConnectionSuccessful === true) {
          llmButtonEl.setAttribute('css-llm-on', 'true');
        } else {
          llmButtonEl.removeAttribute('css-llm-on');
        }
        llmButtonEl.setAttribute(
          'aria-pressed',
          String(isConnectionSuccessful === true)
        );
        if (isConnectionSuccessful === true) {
          llmButtonEl.title =
            typeof i18nEngine?.t === 'function'
              ? i18nEngine.t('brain.aiProvider.connected', {
                  model: aiProviderModelName
                })
              : 'AI 伺服器：已連線 ' + aiProviderModelName;
        } else {
          llmButtonEl.title =
            typeof i18nEngine?.t === 'function'
              ? i18nEngine.t('brain.aiProvider.error')
              : 'AI 伺服器連不上（檢查 AI 伺服器是否在跑 / CORS）';
        }
      }
      if (isConnectionSuccessful === true) {
        setTimeout(() => {
          if (speechEngine !== null && typeof speechEngine === 'object') {
            speechEngine.spokenDisplayText =
              typeof i18nEngine?.t === 'function'
                ? i18nEngine.t('brain.aiProvider.connectedMsg', {
                    model: brainEngine?.aiProvider?.model
                  })
                : '已接上 AI 伺服器大腦（' +
                  brainEngine?.aiProvider?.model +
                  '）🧠 問我問題吧！';
          }
        }, 1300);
      }
      return callOptionEvent(
        options,
        widget,
        'onAiProviderConnected',
        response,
        _fetchSetting,
        aiProvider,
        ...args
      );
    },
    onAiProviderError(error?: unknown, ...args: unknown[]) {
      const errorMsg =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error || 'AI Provider connection error');

      rootStore.setState({
        aiProviderStatus: AI_PROVIDER_STATUS_MAP.ERROR,
        aiProviderError: errorMsg
      });

      const uiDom = getUiDom();
      const llmButtonEl = uiDom?.llmButtonEl;
      if (llmButtonEl instanceof HTMLElement) {
        llmButtonEl.textContent = '🧠✗';
        llmButtonEl.removeAttribute('css-llm-on');
        llmButtonEl.setAttribute('aria-pressed', 'false');
        llmButtonEl.title =
          typeof i18nEngine?.t === 'function'
            ? i18nEngine.t('brain.aiProvider.error')
            : 'AI 伺服器連不上（檢查 AI 伺服器是否在跑 / CORS）';
      }
      return callOptionEvent(
        options,
        widget,
        'onAiProviderError',
        error,
        ...args
      );
    },
    onSummaryUpdated(summary?: unknown, ...args: unknown[]) {
      return callOptionEvent(
        options,
        widget,
        'onSummaryUpdated',
        summary,
        ...args
      );
    },
    onSummarizingChange(isSummarizing: boolean, ...args: unknown[]) {
      return callOptionEvent(
        options,
        widget,
        'onSummarizingChange',
        isSummarizing,
        ...args
      );
    },
    onAddChatMessage(chatMessageItem?: unknown, ...args: unknown[]) {
      const uiDom = getUiDom();
      if (uiDom?.historyPanelEl?.getAttribute('css-is-open') === 'true') {
        renderHistory(widget);
      }
      const rawCallback = options.onAddChatMessage;
      if (
        typeof rawCallback === 'function' &&
        rawCallback.length > 1 &&
        typeof chatMessageItem === 'object' &&
        chatMessageItem !== null
      ) {
        const item = chatMessageItem as { role?: string; text?: string };
        return callOptionEvent(
          options,
          widget,
          'onAddChatMessage',
          item.role,
          item.text,
          chatMessageItem,
          ...args
        );
      }
      return callOptionEvent(
        options,
        widget,
        'onAddChatMessage',
        chatMessageItem,
        ...args
      );
    },
    onUpdateChatMessage(chatMessageItem?: unknown, ...args: unknown[]) {
      const uiDom = getUiDom();
      if (uiDom?.historyPanelEl?.getAttribute('css-is-open') === 'true') {
        renderHistory(widget);
      }
      const rawCallback = options.onUpdateChatMessage;
      if (
        typeof rawCallback === 'function' &&
        rawCallback.length > 1 &&
        typeof chatMessageItem === 'object' &&
        chatMessageItem !== null
      ) {
        const item = chatMessageItem as { id?: string; text?: string };
        return callOptionEvent(
          options,
          widget,
          'onUpdateChatMessage',
          item.id,
          item.text,
          chatMessageItem,
          ...args
        );
      }
      return callOptionEvent(
        options,
        widget,
        'onUpdateChatMessage',
        chatMessageItem,
        ...args
      );
    },
    onChatHistoryChanged(chatLog?: unknown, ...args: unknown[]) {
      return callOptionEvent(
        options,
        widget,
        'onChatHistoryChanged',
        chatLog,
        ...args
      );
    },
    onSpokenAudioPlayNow(text: string, ...args: unknown[]) {
      const { speechEngine } = getEngines();
      if (typeof speechEngine?.speak === 'function') {
        speechEngine.speak(text);
      }
      return callOptionEvent(
        options,
        widget,
        'onSpokenAudioPlayNow',
        text,
        ...args
      );
    },
    onSpokenDisplayTextChange(text: string) {
      const { speechEngine } = getEngines();
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.spokenDisplayText = text;
      }
    },
    onSpokenAudioTextChange(text: string) {
      const { speechEngine } = getEngines();
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.spokenAudioText = text;
      }
    },
    onEmotionChange(emotion: string) {
      const { skinEngine } = getEngines();
      if (typeof skinEngine === 'object' && skinEngine !== null) {
        if (typeof skinEngine.setEmotion === 'function') {
          skinEngine.setEmotion(emotion);
        } else if (skinEngine.gestureName !== undefined) {
          skinEngine.gestureName = emotion;
        }
      }
    },
    onStreamStart: streamPipeline.onStreamStart,
    onStreamChunk: streamPipeline.onStreamChunk,
    onStreamEnd: streamPipeline.onStreamEnd,
    onReasoningStart: streamPipeline.onReasoningStart,
    onReasoningChunk: streamPipeline.onReasoningChunk,
    onReasoningEnd: streamPipeline.onReasoningEnd,
    onAutoContinueStart: streamPipeline.onAutoContinueStart,
    onAutoContinueWait: streamPipeline.onAutoContinueWait,
    onAutoContinueResume: streamPipeline.onAutoContinueResume,
    onAutoContinueEnd: streamPipeline.onAutoContinueEnd,
    onToolNotFound(info?: unknown, ...args: unknown[]) {
      return callOptionEvent(
        options,
        widget,
        'onToolNotFound',
        info,
        widget,
        ...args
      );
    },
    onToolError(info?: unknown, ...args: unknown[]) {
      return callOptionEvent(
        options,
        widget,
        'onToolError',
        info,
        widget,
        ...args
      );
    }
  };

  let brainEngine: BrainEngine | null = null;
  let useCustomBrainEngine = false;

  if (
    typeof customEngines.brain === 'function' ||
    (typeof customEngines.brain === 'object' && customEngines.brain !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.brain === 'function'
          ? await (
              customEngines.brain as (
                opts: unknown
              ) => Promise<BrainEngine> | BrainEngine
            )(brainOptions)
          : (customEngines.brain as BrainEngine);

      const validation = validateBrainEngine(customInstance);
      if (validation.isValid === true) {
        brainEngine = customInstance;
        useCustomBrainEngine = true;
      } else {
        console.error(
          `[AvatarBot] 自訂 brainEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
        );
      }
    } catch (error) {
      console.error(
        `[AvatarBot] 初始化自訂 brainEngine 發生錯誤:`,
        error,
        `將退回使用預設引擎。`
      );
    }
  }

  if (useCustomBrainEngine === false) {
    brainEngine = await initBrainEngine(brainOptions);
  }

  return brainEngine;
}

export interface SetupSpeechParams {
  options: AvatarBotOptions;
  widget: AiAvatarWidget;
  rootStore: AvatarBotStore;
  i18nEngine: I18nEngine;
  getEngines: () => {
    brainEngine: BrainEngine | null;
    speechEngine: SpeechEngine | null;
    skinEngine: SkinEngine | null;
    toolsEngine?: ToolsEngine | null;
  };
  getUiDom: () => UiDom | null;
  handleUser: (text?: string) => void;
  onTapAvatar: () => void;
  streamPipeline: StreamPipeline;
  safeNeuralVoice: string;
}

/**
 * Creates and initializes the Speech engine instance (STT and TTS).
 */
export async function setupSpeechEngine({
  options,
  widget,
  rootStore,
  i18nEngine,
  getEngines,
  getUiDom,
  handleUser,
  onTapAvatar,
  streamPipeline,
  safeNeuralVoice
}: SetupSpeechParams): Promise<SpeechEngine> {
  const {
    customEngines = {},
    ttsEndpoint = DEFAULT_TTS_ENDPOINT,
    avatarMode
  } = options;

  const speechOptions: SpeechEngineOptions = {
    customEngines: {
      tts: customEngines.tts || undefined,
      stt: customEngines.stt || undefined
    },
    ttsEndpoint:
      typeof ttsEndpoint === 'string' && ttsEndpoint !== ''
        ? ttsEndpoint
        : DEFAULT_TTS_ENDPOINT,
    neuralVoice: safeNeuralVoice,
    locale: rootStore.getState().locale,
    getGender: () => {
      return rootStore.getState().speechGender || rootStore.getState().gender;
    },
    onSpokenDisplayTextChange(newSpeakingLabel: string) {
      const uiDom = getUiDom();
      if (uiDom?.bubbleEl instanceof HTMLElement) {
        uiDom.bubbleEl.textContent = newSpeakingLabel;
        uiDom.bubbleEl.setAttribute('css-is-show', 'true');
        uiDom.bubbleEl.removeAttribute('css-is-thinking');
      }
      callOptionEvent(
        options,
        widget,
        'onSpokenDisplayTextChange',
        newSpeakingLabel
      );
    },
    onSpokenDisplayTextTimeout() {
      const uiDom = getUiDom();
      if (uiDom?.bubbleEl instanceof HTMLElement) {
        uiDom.bubbleEl.removeAttribute('css-is-show');
      }
      callOptionEvent(options, widget, 'onSpokenDisplayTextTimeout');
    },
    onMicStateChanged(isListening: boolean, convoOn: boolean) {
      const uiDom = getUiDom();
      if (typeof uiDom?.updateMicState === 'function') {
        const currentAvatarMode = rootStore.getState().avatarMode || avatarMode;
        uiDom.updateMicState({
          isListening,
          continuousMode: convoOn,
          avatarMode: currentAvatarMode as AvatarMode,
          i18n: i18nEngine
        });
      }
      callOptionEvent(
        options,
        widget,
        'onMicStateChanged',
        isListening,
        convoOn
      );
    },
    onVoiceStatusChanged(
      convoOn: boolean,
      text?: string,
      state?: string,
      level?: number
    ) {
      const uiDom = getUiDom();
      if (typeof uiDom?.updateVoiceStatus === 'function') {
        uiDom.updateVoiceStatus({
          continuousMode: convoOn,
          text,
          state,
          level,
          i18n: i18nEngine
        });
      }
      callOptionEvent(
        options,
        widget,
        'onVoiceStatusChanged',
        convoOn,
        text,
        state,
        level
      );
    },
    onUserInput: (text: string) => {
      return handleUser(text);
    },
    onTapAvatar: () => {
      return onTapAvatar();
    },
    onInterrupt: () => {
      streamPipeline.onInterrupt();
    },
    onSpeechWait: (speechSequenceId?: string | number) => {
      streamPipeline.onSpeechWait(speechSequenceId);
    },
    onLanguageChanged(
      locale: string,
      localeLabel: string,
      shortLabel?: string
    ) {
      const uiDom = getUiDom();
      if (uiDom?.langButtonEl instanceof HTMLButtonElement) {
        uiDom.langButtonEl.textContent =
          typeof shortLabel === 'string' && shortLabel !== ''
            ? shortLabel
            : localeLabel;
      }
      callOptionEvent(
        options,
        widget,
        'onLanguageChanged',
        locale,
        localeLabel,
        shortLabel
      );
    },
    onSpeaking: (text: string) => {
      callOptionEvent(options, widget, 'onSpeaking', text);
    },
    onSpeakingEnd: () => {
      const { skinEngine } = getEngines();
      if (
        typeof skinEngine === 'object' &&
        skinEngine !== null &&
        typeof skinEngine.setEmotion === 'function'
      ) {
        skinEngine.setEmotion('neutral');
      }
      callOptionEvent(options, widget, 'onSpeakingEnd');
    }
  };

  if (
    typeof customEngines.speech === 'function' ||
    (typeof customEngines.speech === 'object' && customEngines.speech !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.speech === 'function'
          ? await customEngines.speech(speechOptions)
          : customEngines.speech;
      const validation = validateSpeechEngine(customInstance);
      if (validation.isValid === true) {
        return customInstance;
      }
      console.error(
        `[AvatarBot] 自訂 speechEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
      );
    } catch (error) {
      console.error(
        `[AvatarBot] 初始化自訂 speechEngine 發生錯誤:`,
        error,
        `將退回使用預設引擎。`
      );
    }
  }

  return await initSpeechEngine(speechOptions);
}

export interface SetupToolsParams {
  options: AvatarBotOptions;
  widget: AiAvatarWidget;
  rootStore?: AvatarBotStore;
  i18nEngine?: I18nEngine | null;
  getEngines: () => {
    brainEngine: BrainEngine | null;
    speechEngine: SpeechEngine | null;
    skinEngine: SkinEngine | null;
    toolsEngine?: ToolsEngine | null;
  };
  getUiDom: () => UiDom | null;
}

/**
 * Creates and initializes the Tools engine instance for external function calls.
 */
export function setupToolsEngine({
  options,
  widget,
  rootStore,
  i18nEngine,
  getEngines,
  getUiDom
}: SetupToolsParams): ToolsEngine | null {
  const { customEngines = {} } = options;

  const customTools =
    Array.isArray(options.tools) && options.tools.length > 0
      ? options.tools
      : [];

  const emotionTools =
    options.enableEmotionTools !== false
      ? createEmotionToolsPlugin(options.emotionToolsOptions || {})
      : [];

  const initialTools = [...customTools, ...emotionTools];

  const toolsOptions: ToolsEngineOptions = {
    tools: initialTools,
    context: () => ({
      skinEngine: getEngines().skinEngine,
      brainEngine: getEngines().brainEngine,
      speechEngine: getEngines().speechEngine,
      aiAvatarWidget: widget,
      store: rootStore,
      i18nEngine
    }),
    confirmationTimeoutMs:
      typeof options.confirmationTimeoutMs === 'number'
        ? options.confirmationTimeoutMs
        : undefined,
    onToolCall: (
      pendingToolCall: Record<string, unknown>,
      ...args: unknown[]
    ) => {
      return callOptionEvent(
        options,
        widget,
        'onToolCall',
        pendingToolCall,
        widget,
        ...args
      );
    },
    onToolOffer: (info: ToolOfferInfo, ...args: unknown[]) => {
      return callOptionEvent(
        options,
        widget,
        'onToolOffer',
        info,
        widget,
        ...args
      );
    },
    onToolInputRequired: (info: ToolInputRequiredInfo, ...args: unknown[]) => {
      return callOptionEvent(
        options,
        widget,
        'onToolInputRequired',
        info,
        widget,
        ...args
      );
    },
    onToolAmbiguous: (info: ToolAmbiguousInfo, ...args: unknown[]) => {
      return callOptionEvent(
        options,
        widget,
        'onToolAmbiguous',
        info,
        widget,
        ...args
      );
    },
    onToolConfirm: (info: ToolConfirmInfo, ...args: unknown[]) => {
      return callOptionEvent(
        options,
        widget,
        'onToolConfirm',
        info,
        widget,
        ...args
      );
    },
    onToolCancel: (info: ToolCancelInfo, ...args: unknown[]) => {
      return callOptionEvent(
        options,
        widget,
        'onToolCancel',
        info,
        widget,
        ...args
      );
    },
    onToolExecute: (info: ToolExecuteInfo, ...args: unknown[]) => {
      return callOptionEvent(
        options,
        widget,
        'onToolExecute',
        info,
        widget,
        ...args
      );
    },
    onToolResult: (info: ToolResultData, ...args: unknown[]) => {
      return callOptionEvent(
        options,
        widget,
        'onToolResult',
        info,
        widget,
        ...args
      );
    },
    onToolEvent: (
      event: ToolEventName,
      payload: unknown,
      ...args: unknown[]
    ) => {
      return callOptionEvent(
        options,
        widget,
        'onToolEvent',
        event,
        payload,
        widget,
        ...args
      );
    },
    onAddChatMessage(
      role: string,
      text: string,
      messageOptions?: unknown,
      ...args: unknown[]
    ) {
      const { brainEngine } = getEngines();
      if (typeof brainEngine?.addChatMessage === 'function') {
        return brainEngine.addChatMessage(
          role,
          text,
          messageOptions as Parameters<
            NonNullable<typeof brainEngine>['addChatMessage']
          >[2]
        );
      }
      callOptionEvent(
        options,
        widget,
        'onAddChatMessage',
        role,
        text,
        messageOptions,
        ...args
      );
      return undefined;
    },
    onUpdateChatMessage(
      messageId: string,
      text: string,
      updateOptions?: boolean | UpdateChatMessageOptions,
      ...args: unknown[]
    ) {
      const { brainEngine } = getEngines();
      if (typeof brainEngine?.updateChatMessage === 'function') {
        const resolvedOptions =
          typeof updateOptions === 'object' && updateOptions !== null
            ? updateOptions
            : typeof updateOptions === 'boolean'
              ? { streaming: updateOptions }
              : updateOptions;
        return brainEngine.updateChatMessage(messageId, text, resolvedOptions);
      }
      callOptionEvent(
        options,
        widget,
        'onUpdateChatMessage',
        messageId,
        text,
        updateOptions,
        ...args
      );
      return undefined;
    },
    onSetHistoryOpen(isOpen: boolean, ...args: unknown[]) {
      const uiDom = getUiDom();
      if (uiDom?.historyPanelEl instanceof HTMLElement) {
        if (isOpen === true) {
          uiDom.historyPanelEl.setAttribute('css-is-open', 'true');
          uiDom.historyPanelEl.inert = false;
        } else {
          uiDom.historyPanelEl.removeAttribute('css-is-open');
          uiDom.historyPanelEl.inert = true;
        }
        if (uiDom.historyPanelEl.getAttribute('css-is-open') === 'true') {
          renderHistory(widget);
        }
      }
      if (uiDom?.historyButtonEl instanceof HTMLElement) {
        uiDom.historyButtonEl.setAttribute(
          'aria-expanded',
          String(isOpen === true)
        );
      }
      return callOptionEvent(
        options,
        widget,
        'onSetHistoryOpen',
        isOpen,
        ...args
      );
    },
    onRenderHistory(...args: unknown[]) {
      renderHistory(widget);
      return callOptionEvent(options, widget, 'onRenderHistory', ...args);
    },
    onSpokenAudioPlayNow(text: string, ...args: unknown[]) {
      const { speechEngine } = getEngines();
      if (
        typeof speechEngine === 'object' &&
        speechEngine !== null &&
        typeof speechEngine.speak === 'function'
      ) {
        speechEngine.speak(text);
      }
      return callOptionEvent(
        options,
        widget,
        'onSpokenAudioPlayNow',
        text,
        ...args
      );
    },
    getChatLog: () => getEngines().brainEngine?.chatLog || [],
    getChatSeq: () => getEngines().brainEngine?.chatSeq || 0,
    isConvoOn: () => getEngines().speechEngine?.convoOn || false
  };

  let toolsEngine: ToolsEngine | null = null;
  let useCustomToolsEngine = false;

  if (
    typeof customEngines.tools === 'function' ||
    (typeof customEngines.tools === 'object' && customEngines.tools !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.tools === 'function'
          ? (customEngines.tools as (opts: unknown) => ToolsEngine)(
              toolsOptions
            )
          : (customEngines.tools as ToolsEngine);

      const validation = validateToolsEngine(customInstance);
      if (validation.isValid === true) {
        toolsEngine = customInstance;
        useCustomToolsEngine = true;
      } else {
        console.error(
          `[AvatarBot] 自訂 toolsEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
        );
      }
    } catch (error) {
      console.error(
        `[AvatarBot] 初始化自訂 toolsEngine 發生錯誤:`,
        error,
        `將退回使用預設引擎。`
      );
    }
  }

  if (useCustomToolsEngine === false) {
    toolsEngine = initToolsEngine(toolsOptions);
  }

  if (toolsEngine !== null) {
    if (
      useCustomToolsEngine === true &&
      Array.isArray(toolsEngine.tools) === true
    ) {
      const existingTools = toolsEngine.tools;
      const existingNames = new Set(existingTools.map((t) => t.name));
      const toolsToAdd = initialTools.filter((t) => !existingNames.has(t.name));
      toolsEngine.tools = [...existingTools, ...toolsToAdd];
    }
  }

  return toolsEngine;
}

export interface SetupSkinParams {
  options: AvatarBotOptions;
  widget: AiAvatarWidget;
  rootStore: AvatarBotStore;
  getEngines: () => {
    brainEngine: BrainEngine | null;
    speechEngine: SpeechEngine | null;
    skinEngine: SkinEngine | null;
    toolsEngine?: ToolsEngine | null;
  };
  getUiDom: () => UiDom | null;
  stageEl: HTMLElement;
}

/**
 * Creates and initializes the Skin rendering engine instance (2D Live2D / 3D VRM).
 */
export async function setupSkinEngine({
  options,
  widget,
  rootStore,
  getEngines,
  getUiDom,
  stageEl
}: SetupSkinParams): Promise<SkinEngine | null> {
  const {
    live2dUrl,
    startMode,
    fitMode,
    vrmUrl,
    skin2d,
    skin3d,
    gesture,
    customEngines = {}
  } = options;

  let skinEngine: SkinEngine | null = null;
  let useCustomSkinEngine = false;

  if (
    typeof customEngines.skin === 'function' ||
    (typeof customEngines.skin === 'object' && customEngines.skin !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.skin === 'function'
          ? await (
              customEngines.skin as (
                params: unknown
              ) => Promise<SkinEngine> | SkinEngine
            )({
              stageEl,
              aiAvatarWidget: widget,
              speechEngine: getEngines().speechEngine
            })
          : (customEngines.skin as SkinEngine);

      const validation = validateSkinEngine(customInstance);
      if (validation.isValid === true) {
        skinEngine = customInstance;
        useCustomSkinEngine = true;
      } else {
        console.error(
          `[AvatarBot] 自訂 skinEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
        );
      }
    } catch (error) {
      console.error(
        `[AvatarBot] 初始化自訂 skinEngine 發生錯誤:`,
        error,
        `將退回使用預設引擎。`
      );
    }
  }

  if (useCustomSkinEngine === false) {
    skinEngine =
      initSkinEngine({
        stageEl,
        live2dUrl,
        startMode,
        fitMode,
        skin2d,
        vrmUrl,
        skin3d,
        gesture,
        get gender() {
          return rootStore.getState().skinGender || rootStore.getState().gender;
        },

        computeMouth() {
          const { speechEngine } = getEngines();
          return speechEngine?.computeMouth
            ? speechEngine.computeMouth()
            : undefined;
        },
        async onMounted() {
          const { brainEngine, speechEngine } = getEngines();
          if (speechEngine !== null && typeof speechEngine === 'object') {
            const welcomeMsg = await brainEngine?.getWelcomeText();
            speechEngine.spokenDisplayText =
              typeof welcomeMsg === 'string' ? welcomeMsg : '';
          }
          if (typeof widget.onReady === 'function') {
            widget.onReady(widget);
          }
        },
        on3DError(error?: unknown, ...args: unknown[]) {
          if (typeof widget.onError === 'function') {
            const errObj =
              error instanceof Error ? error : new Error(String(error || ''));
            widget.onError(errObj, widget);
          }
          return callOptionEvent(options, widget, 'on3DError', error, ...args);
        },
        on2DError(error?: unknown, ...args: unknown[]) {
          const errorMsg =
            typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof (error as { message?: unknown }).message === 'string'
              ? (error as { message: string }).message
              : String(error || '');
          const uiDom = getUiDom();
          const directWarnEl = uiDom?.directWarnEl;
          if (
            directWarnEl instanceof HTMLParagraphElement ||
            directWarnEl instanceof HTMLDivElement
          ) {
            directWarnEl.textContent = '2D 啟動失敗：' + errorMsg;
            directWarnEl.style.display = 'flex';
          }
          if (typeof widget.onError === 'function') {
            const errObj = error instanceof Error ? error : new Error(errorMsg);
            widget.onError(errObj, widget);
          }
          return callOptionEvent(options, widget, 'on2DError', error, ...args);
        },
        onVrmFileChangeFail(error?: unknown, ...args: unknown[]) {
          console.error(error);
          const errorMsg =
            typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof (error as { message?: unknown }).message === 'string'
              ? (error as { message: string }).message
              : String(error || '');
          const { speechEngine } = getEngines();
          if (speechEngine !== null && typeof speechEngine === 'object') {
            speechEngine.spokenDisplayText = errorMsg;
          }
          if (typeof widget.onError === 'function') {
            const errObj = error instanceof Error ? error : new Error(errorMsg);
            widget.onError(errObj, widget);
          }
          return callOptionEvent(
            options,
            widget,
            'onVrmFileChangeFail',
            error,
            ...args
          );
        },
        onVrmFileChangeSuccess() {
          const { skinEngine: currentSkin, speechEngine } = getEngines();
          const rootState = rootStore?.getState?.() || {};
          const isEngineToggleEnabled =
            typeof rootState.enableEngineToggle === 'boolean'
              ? rootState.enableEngineToggle
              : true;

          initSkinModeChangeButton(widget, {
            has2D: currentSkin?.has2D === true,
            has3D: currentSkin?.has3D === true,
            isEngineToggleEnabled
          });

          if (speechEngine !== null && typeof speechEngine === 'object') {
            speechEngine.spokenDisplayText = '換上你的角色了！🎭';
          }
          callOptionEvent(options, widget, 'onVrmFileChangeSuccess');
        },
        onModelChangeStart(newEngineMode: string) {
          const uiDom = getUiDom();
          if (uiDom?.skinModeButtonEl instanceof HTMLElement) {
            if (newEngineMode === ENGINE_MODE_MAP.threeDimensional) {
              uiDom.skinModeButtonEl.textContent = '3D';
            } else {
              uiDom.skinModeButtonEl.textContent = '2D';
            }
          }
          callOptionEvent(options, widget, 'onModelChangeStart', newEngineMode);
        },
        onModelChangeEnd() {
          const uiDom = getUiDom();
          const { skinEngine: currentSkin, speechEngine } = getEngines();
          if (uiDom?.skinModeButtonEl instanceof HTMLElement) {
            if (currentSkin?.engineMode === ENGINE_MODE_MAP.threeDimensional) {
              uiDom.skinModeButtonEl.textContent = '3D';
            } else {
              uiDom.skinModeButtonEl.textContent = '2D';
            }
          }

          if (
            typeof currentSkin?.avatarModel === 'object' &&
            currentSkin.avatarModel !== null &&
            typeof currentSkin.avatarModel.on === 'function'
          ) {
            currentSkin.avatarModel.on('hit', () => {
              speechEngine?.triggerTap();
            });
          }
          if (
            typeof currentSkin?.renderer?.canvas?.addEventListener ===
            'function'
          ) {
            currentSkin.renderer.canvas.addEventListener('pointerdown', () => {
              const { speechEngine } = getEngines();
              if (typeof speechEngine?.triggerTap === 'function') {
                speechEngine.triggerTap();
              } else if (typeof widget?.tap === 'function') {
                widget.tap();
              }
            });
          }
          callOptionEvent(options, widget, 'onModelChangeEnd');
        }
      }) || null;
  }

  return skinEngine;
}
