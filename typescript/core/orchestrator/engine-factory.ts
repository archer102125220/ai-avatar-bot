import { initBrainEngine, validateBrainEngine } from '@/core/brain';
import { initSpeechEngine } from '@/core/speech';
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
  AVATAR_MODE_MAP
} from '@/core/constants';
import { renderHistory, initSkinModeChangeButton, type UiDom } from '@/core/ui';
import { callOptionEvent } from './options';
import type { I18nEngine } from '@/core/i18n';
import type { BrainEngine, BrainCompressionOptions } from '@/core/brain';
import type { SpeechEngine } from '@/core/speech';
import type { SkinEngine, Renderer3D } from '@/core/skin';
import type { ToolsEngine, HostTool, ToolDefinition } from '@/core/tools';
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
    llmModel = DEFAULT_LLM_MODEL,
    llmMaxTokens,
    maxHistoryTurns,
    memoryKey,
    memoryAdapter,
    knowledgeUrl = '',
    companionKnowledgeUrl = '',
    knowledge = null,
    companionKnowledge = null,
    companionFallback = [],
    aiProviderBaseUrl = '',
    aiProviderModel = DEFAULT_AI_PROVIDER_MODEL,
    aiProviderCreateFetchSetting,
    aiProviderCreateFetchPayload,
    aiProviderResponseFormat,
    aiProviderMaxTokens,
    aiProviderStream,
    customEngines = {},
    compression = {},
    systemContextTemplate,
    companionSystemContextTemplate,
    ragTemplate,
    customContext,
    languageRule,
    genderRule
  } = options;

  const resolvedLlmMaxTokens =
    typeof llmMaxTokens === 'number' &&
    Number.isFinite(llmMaxTokens) === true &&
    llmMaxTokens > 0
      ? llmMaxTokens
      : DEFAULT_LLM_MAX_TOKENS;

  const brainOptions: Record<string, unknown> = {
    llmModel,
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
    knowledgeUrl,
    companionKnowledgeUrl,
    knowledge,
    companionKnowledge,
    companionFallback,
    aiProviderBaseUrl,
    aiProviderModel,
    aiProviderCreateFetchSetting,
    aiProviderCreateFetchPayload,
    aiProviderResponseFormat,
    aiProviderMaxTokens:
      typeof aiProviderMaxTokens === 'number' &&
      Number.isFinite(aiProviderMaxTokens) === true &&
      aiProviderMaxTokens > 0
        ? aiProviderMaxTokens
        : DEFAULT_AI_PROVIDER_MAX_TOKENS,
    aiProviderStream,
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
        Array.isArray(toolsEngine.HOST_TOOLS) === true &&
        toolsEngine.HOST_TOOLS.length > 0
      ) {
        return (
          toolsEngine.HOST_TOOLS.find(
            (toolItem: HostTool) => toolItem.name === toolName
          ) || null
        );
      }
      return null;
    },
    offerToolConfirmation: (
      tool: HostTool | unknown,
      toolArguments?: unknown,
      toolOptions?: unknown
    ) => {
      const { toolsEngine } = getEngines();
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        typeof toolsEngine.offerHostTool === 'function'
      ) {
        toolsEngine.offerHostTool(
          tool as HostTool,
          '',
          { confidence: 1, reason: 'ai_tool_call' },
          toolArguments as Record<string, unknown> | undefined,
          toolOptions as Record<string, unknown> | undefined
        );
      }
    },
    executeTool: async (
      tool: HostTool | unknown,
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
      if (uiDom?.btnLlmEl instanceof HTMLElement) {
        uiDom.btnLlmEl.textContent =
          '🧠 ' + Math.round(progressRatio * 100) + '%';
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
      if (uiDom?.btnLlmEl instanceof HTMLElement) {
        uiDom.btnLlmEl.textContent = '🧠✓';
        uiDom.btnLlmEl.setAttribute('css-llm-on', 'true');
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
      if (uiDom?.btnLlmEl instanceof HTMLElement) {
        uiDom.btnLlmEl.textContent = '🧠✗';
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
      const uiDom = getUiDom();
      const btnLlmEl = uiDom?.btnLlmEl;
      if (btnLlmEl instanceof HTMLElement) {
        btnLlmEl.textContent = '🧠…';
        btnLlmEl.title =
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
      const btnLlmEl = uiDom?.btnLlmEl;

      const aiProviderObj =
        typeof aiProvider === 'object' && aiProvider !== null
          ? (aiProvider as { model?: unknown })
          : null;
      const aiProviderModelName =
        typeof aiProviderObj?.model === 'string' ? aiProviderObj.model : '';

      if (btnLlmEl instanceof HTMLElement) {
        btnLlmEl.textContent = isConnectionSuccessful === true ? '🧠✓' : '🧠✗';
        if (isConnectionSuccessful === true) {
          btnLlmEl.setAttribute('css-llm-on', 'true');
        } else {
          btnLlmEl.removeAttribute('css-llm-on');
        }
        btnLlmEl.setAttribute(
          'aria-pressed',
          String(isConnectionSuccessful === true)
        );
        if (isConnectionSuccessful === true) {
          btnLlmEl.title =
            typeof i18nEngine?.t === 'function'
              ? i18nEngine.t('brain.aiProvider.connected', {
                  model: aiProviderModelName
                })
              : 'AI 伺服器：已連線 ' + aiProviderModelName;
        } else {
          btnLlmEl.title =
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
    onSummaryUpdated(summary?: unknown, ...args: unknown[]) {
      return callOptionEvent(
        options,
        widget,
        'onSummaryUpdated',
        summary,
        ...args
      );
    },
    onAddChatMessage(chatMessageItem?: unknown, ...args: unknown[]) {
      const uiDom = getUiDom();
      if (uiDom?.historyPanelEl?.getAttribute('css-is-open') === 'true') {
        renderHistory(widget);
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
  container: HTMLElement;
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
  container,
  safeNeuralVoice
}: SetupSpeechParams): Promise<SpeechEngine> {
  const {
    customEngines = {},
    ttsEndpoint = DEFAULT_TTS_ENDPOINT,
    avatarMode
  } = options;

  return await initSpeechEngine({
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
        const isCompanion = currentAvatarMode === AVATAR_MODE_MAP.companion;
        uiDom.updateMicState(isListening, convoOn, isCompanion, i18nEngine);
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
        uiDom.updateVoiceStatus(convoOn, text, state, level, i18nEngine);
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
    getContainer: () => container,
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
  });
}

export interface SetupToolsParams {
  options: AvatarBotOptions;
  widget: AiAvatarWidget;
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
  getEngines,
  getUiDom
}: SetupToolsParams): ToolsEngine | null {
  const { customEngines = {} } = options;
  const rawOptions = options as Record<string, unknown>;

  const toolsOptions = {
    confirmationTimeoutMs:
      typeof options.confirmationTimeoutMs === 'number'
        ? options.confirmationTimeoutMs
        : typeof rawOptions.toolConfirmationTimeoutMs === 'number'
          ? (rawOptions.toolConfirmationTimeoutMs as number)
          : undefined,
    onToolCall: (pendingToolCall: unknown, ...args: unknown[]) => {
      return callOptionEvent(
        options,
        widget,
        'onToolCall',
        pendingToolCall,
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
      callOptionEvent(
        options,
        widget,
        'onAddChatMessage',
        role,
        text,
        messageOptions,
        ...args
      );
      return brainEngine?.addChatMessage(
        role,
        text,
        messageOptions as Parameters<
          NonNullable<typeof brainEngine>['addChatMessage']
        >[2]
      );
    },
    onUpdateChatMessage(
      messageId: string,
      text: string,
      append?: boolean,
      ...args: unknown[]
    ) {
      const { brainEngine } = getEngines();
      callOptionEvent(
        options,
        widget,
        'onUpdateChatMessage',
        messageId,
        text,
        append,
        ...args
      );
      return brainEngine?.updateChatMessage(messageId, text, append);
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

  const customTools =
    Array.isArray(options.tools) && options.tools.length > 0
      ? options.tools
      : Array.isArray(rawOptions.hostTools) &&
          (rawOptions.hostTools as unknown[]).length > 0
        ? (rawOptions.hostTools as HostTool[])
        : [];

  const emotionTools =
    options.enableEmotionTools !== false
      ? createEmotionToolsPlugin(options.emotionToolsOptions || {})
      : [];

  if (Array.isArray(toolsEngine?.HOST_TOOLS) === true) {
    toolsEngine.HOST_TOOLS = [...customTools, ...emotionTools];
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
    modelUrl,
    startMode,
    fitMode,
    vrmUrl,
    skin2d,
    zoom,
    offsetX,
    offsetY,
    anchor,
    skin3d,
    camera,
    modelTransform,
    pointerLook,
    gesture3D,
    gesture2D,
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
        modelUrl,
        startMode,
        fitMode,
        skin2d,
        zoom,
        offsetX,
        offsetY,
        anchor,
        vrmUrl,
        skin3d,
        camera,
        modelTransform,
        pointerLook,
        gesture3D,
        gesture2D,
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
        onThreeDimensionalError(error?: unknown, ...args: unknown[]) {
          if (typeof widget.onError === 'function') {
            const errObj =
              error instanceof Error ? error : new Error(String(error || ''));
            widget.onError(errObj, widget);
          }
          return callOptionEvent(
            options,
            widget,
            'onThreeDimensionalError',
            error,
            ...args
          );
        },
        onTwoDimensionalError(error?: unknown, ...args: unknown[]) {
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
          return callOptionEvent(
            options,
            widget,
            'onTwoDimensionalError',
            error,
            ...args
          );
        },
        VRMFileChangeFail(error?: unknown, ...args: unknown[]) {
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
            'VRMFileChangeFail',
            error,
            ...args
          );
        },
        VRMFileChangeSuccess() {
          const { skinEngine: currentSkin, speechEngine } = getEngines();
          const rootState = rootStore?.getState?.() || {};
          const isEngineToggleEnabled =
            typeof rootState.enableEngineToggle === 'boolean'
              ? rootState.enableEngineToggle
              : true;

          initSkinModeChangeButton(
            widget,
            currentSkin?.has2D === true,
            currentSkin?.has3D === true,
            isEngineToggleEnabled
          );

          if (speechEngine !== null && typeof speechEngine === 'object') {
            speechEngine.spokenDisplayText = '換上你的角色了！🎭';
          }
          callOptionEvent(options, widget, 'VRMFileChangeSuccess');
        },
        onModelChangeStart(newEngineMode: string) {
          const uiDom = getUiDom();
          if (uiDom?.engineButtonEl instanceof HTMLElement) {
            if (newEngineMode === ENGINE_MODE_MAP.threeDimensional) {
              uiDom.engineButtonEl.textContent = '3D';
            } else {
              uiDom.engineButtonEl.textContent = '2D';
            }
          }
          callOptionEvent(options, widget, 'onModelChangeStart', newEngineMode);
        },
        onModelChangeEnd() {
          const uiDom = getUiDom();
          const { skinEngine: currentSkin, speechEngine } = getEngines();
          if (uiDom?.engineButtonEl instanceof HTMLElement) {
            if (currentSkin?.engineMode === ENGINE_MODE_MAP.threeDimensional) {
              uiDom.engineButtonEl.textContent = '3D';
            } else {
              uiDom.engineButtonEl.textContent = '2D';
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
          if (currentSkin?.engineMode === ENGINE_MODE_MAP.threeDimensional) {
            const renderer3D = currentSkin.renderer as
              | (Renderer3D & {
                  TAP_GESTURES?: string[];
                  playGesture?: (g: string) => void;
                })
              | undefined;
            if (typeof renderer3D?.canvas?.addEventListener === 'function') {
              renderer3D.canvas.addEventListener('pointerdown', () => {
                if (
                  Array.isArray(renderer3D.TAP_GESTURES) === true &&
                  renderer3D.TAP_GESTURES.length > 0 &&
                  typeof renderer3D.playGesture === 'function'
                ) {
                  renderer3D.playGesture(
                    renderer3D.TAP_GESTURES[
                      Math.floor(Math.random() * renderer3D.TAP_GESTURES.length)
                    ]
                  );
                }
                speechEngine?.triggerTap();
              });
            }
          } else {
            if (
              typeof currentSkin?.renderer?.canvas?.addEventListener ===
              'function'
            ) {
              currentSkin.renderer.canvas.addEventListener(
                'pointerdown',
                () => {
                  speechEngine?.triggerTap();
                }
              );
            }
          }
          callOptionEvent(options, widget, 'onModelChangeEnd');
        }
      }) || null;
  }

  return skinEngine;
}
