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
import { renderHistory, initSkinModeChangeButton } from '@/core/ui';
import { callOptionEvent } from './options';
import type {
  AiAvatarWidget,
  AvatarBotOptions,
  BaseStore,
  I18nEngine,
  BrainEngine,
  SpeechEngine,
  SkinEngine,
  ToolsEngine,
  UiDom
} from '@types';
import type { StreamPipeline } from './pipeline-stream';

export interface SetupBrainParams {
  options: AvatarBotOptions;
  widget: AiAvatarWidget;
  rootStore: BaseStore;
  i18nEngine: I18nEngine;
  getEngines: () => {
    brainEngine: BrainEngine | any;
    speechEngine: SpeechEngine | any;
    skinEngine: SkinEngine | any;
    toolsEngine: ToolsEngine | any;
  };
  getUiDom: () => UiDom | any;
  streamPipeline: StreamPipeline | any;
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
}: SetupBrainParams): Promise<BrainEngine | any> {
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

  const brainOptions: any = {
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
      ((fromEngine: string, toEngine: string, error: any) => {
        return callOptionEvent(
          options,
          widget,
          'onBrainFallback',
          fromEngine,
          toEngine,
          error
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
            (toolItem: any) => toolItem.name === toolName
          ) || null
        );
      }
      return null;
    },
    offerToolConfirmation: (tool: any, toolArguments: any, toolOptions: any) => {
      const { toolsEngine } = getEngines();
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        typeof toolsEngine.offerHostTool === 'function'
      ) {
        toolsEngine.offerHostTool(
          tool,
          '',
          { confidence: 1, reason: 'ai_tool_call' },
          toolArguments,
          toolOptions
        );
      }
    },
    executeTool: async (tool: any, toolArguments: any, toolOptions: any) => {
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
        const resolvedOptions =
          typeof toolOptions === 'object' && toolOptions !== null
            ? {
                ...toolOptions,
                input: {
                  ...toolOptions.input,
                  context: {
                    ...defaultContext,
                    ...(typeof toolOptions.input?.context === 'object' &&
                    toolOptions.input.context !== null
                      ? toolOptions.input.context
                      : {})
                  },
                  query:
                    typeof toolOptions.input?.query === 'string'
                      ? toolOptions.input.query
                      : ''
                }
              }
            : { input: { context: defaultContext, query: '' } };

        return await toolsEngine.executeToolDirectly(
          tool,
          toolArguments,
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
      options.compression || (options as any).brain?.compression || compression,

    welcomeText: options.welcomeText,
    companionWelcomeText: options.companionWelcomeText,
    assistantWelcomeText: options.assistantWelcomeText,

    onLlmLoading() {
      const { speechEngine } = getEngines();
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.spokenDisplayText =
          typeof i18nEngine?.t === 'function'
            ? i18nEngine.t('brain.llm.loading')
            : '開始下載 AI 大腦（約 1GB，只需第一次）…';
      }
      callOptionEvent(options, widget, 'onLlmLoading');
    },
    onLlmLoadProgress(loadProgress: any) {
      const uiDom = getUiDom();
      if (uiDom?.btnLlmEl instanceof HTMLElement) {
        uiDom.btnLlmEl.textContent =
          '🧠 ' + Math.round((loadProgress?.progress || 0) * 100) + '%';
      }
      callOptionEvent(options, widget, 'onLlmLoadProgress', loadProgress);
    },
    onLlmLoaded() {
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
      callOptionEvent(options, widget, 'onLlmLoaded');
    },
    onLlmLoadError(error: any) {
      const { speechEngine } = getEngines();
      const uiDom = getUiDom();
      if (uiDom?.btnLlmEl instanceof HTMLElement) {
        uiDom.btnLlmEl.textContent = '🧠✗';
      }
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.spokenDisplayText =
          typeof i18nEngine?.t === 'function'
            ? i18nEngine.t('brain.llm.error', {
                error: error?.message || error
              })
            : 'AI 大腦載入失敗：' + (error?.message || error);
      }
      callOptionEvent(options, widget, 'onLlmLoadError', error);
    },
    onAiProviderConnecting() {
      const uiDom = getUiDom();
      const btnLlmEl = uiDom?.btnLlmEl;
      if (btnLlmEl instanceof HTMLElement) {
        btnLlmEl.textContent = '🧠…';
        btnLlmEl.title =
          typeof i18nEngine?.t === 'function'
            ? i18nEngine.t('brain.aiProvider.connecting')
            : 'AI 伺服器大腦（連線中）';
      }
      callOptionEvent(options, widget, 'onAiProviderConnecting');
    },
    onAiProviderConnected(response: any, _fetchSetting: any, aiProvider: any) {
      const { brainEngine, speechEngine } = getEngines();
      const uiDom = getUiDom();
      const isConnectionSuccessful = response?.ok === true;
      const btnLlmEl = uiDom?.btnLlmEl;

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
                  model: aiProvider?.model
                })
              : 'AI 伺服器：已連線 ' + aiProvider?.model;
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
      callOptionEvent(
        options,
        widget,
        'onAiProviderConnected',
        response,
        _fetchSetting,
        aiProvider
      );
    },
    onSummaryUpdated(summary: any) {
      callOptionEvent(options, widget, 'onSummaryUpdated', summary);
    },
    onAddChatMessage(chatMessageItem: any) {
      const uiDom = getUiDom();
      if (uiDom?.historyPanelEl?.getAttribute('css-is-open') === 'true') {
        renderHistory(widget);
      }
      callOptionEvent(options, widget, 'onAddChatMessage', chatMessageItem);
    },
    onUpdateChatMessage(chatMessageItem: any) {
      const uiDom = getUiDom();
      if (uiDom?.historyPanelEl?.getAttribute('css-is-open') === 'true') {
        renderHistory(widget);
      }
      callOptionEvent(options, widget, 'onUpdateChatMessage', chatMessageItem);
    },
    onChatHistoryChanged(chatLog: any) {
      callOptionEvent(options, widget, 'onChatHistoryChanged', chatLog);
    },
    onSpokenAudioPlayNow(text: string) {
      const { speechEngine } = getEngines();
      if (typeof speechEngine?.speak === 'function') {
        speechEngine.speak(text);
      }
      callOptionEvent(options, widget, 'onSpokenAudioPlayNow', text);
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
    onToolNotFound(info: any) {
      return callOptionEvent(options, widget, 'onToolNotFound', info, widget);
    },
    onToolError(info: any) {
      return callOptionEvent(options, widget, 'onToolError', info, widget);
    }
  };

  let brainEngine: any = null;
  let useCustomBrainEngine = false;

  if (
    typeof customEngines.brain === 'function' ||
    (typeof customEngines.brain === 'object' && customEngines.brain !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.brain === 'function'
          ? await (customEngines.brain as any)(brainOptions)
          : customEngines.brain;

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
  rootStore: BaseStore;
  i18nEngine: I18nEngine;
  getEngines: () => {
    brainEngine: BrainEngine | any;
    speechEngine: SpeechEngine | any;
    skinEngine: SkinEngine | any;
    toolsEngine?: ToolsEngine | any;
  };
  getUiDom: () => UiDom | any;
  handleUser: (text?: string) => void;
  onTapAvatar: () => void;
  streamPipeline: StreamPipeline | any;
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
}: SetupSpeechParams): Promise<SpeechEngine | any> {
  const {
    customEngines = {},
    ttsEndpoint = DEFAULT_TTS_ENDPOINT,
    avatarMode
  } = options;

  return await initSpeechEngine({
    customEngines: {
      tts: customEngines.tts,
      stt: customEngines.stt
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
    onVoiceStatusChanged(convoOn: boolean, text?: string, state?: string, level?: number) {
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
    onSpeechWait: (speechSequenceId?: any) => {
      streamPipeline.onSpeechWait(speechSequenceId);
    },
    onLanguageChanged(locale: string, localeLabel: string, shortLabel?: string) {
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
    brainEngine: BrainEngine | any;
    speechEngine: SpeechEngine | any;
    skinEngine: SkinEngine | any;
    toolsEngine?: ToolsEngine | any;
  };
  getUiDom: () => UiDom | any;
}

/**
 * Creates and initializes the Tools engine instance for external function calls.
 */
export function setupToolsEngine({
  options,
  widget,
  getEngines,
  getUiDom
}: SetupToolsParams): ToolsEngine | any {
  const { customEngines = {} } = options;

  const toolsOptions = {
    confirmationTimeoutMs:
      typeof options.confirmationTimeoutMs === 'number'
        ? options.confirmationTimeoutMs
        : (options as any).toolConfirmationTimeoutMs,
    onToolCall: (pendingToolCall: any) => {
      callOptionEvent(options, widget, 'onToolCall', pendingToolCall, widget);
    },
    onAddChatMessage(role: any, text: any, messageOptions: any) {
      const { brainEngine } = getEngines();
      callOptionEvent(
        options,
        widget,
        'onAddChatMessage',
        role,
        text,
        messageOptions
      );
      return brainEngine?.addChatMessage(role, text, messageOptions);
    },
    onUpdateChatMessage(messageId: any, text: any, append: any) {
      const { brainEngine } = getEngines();
      callOptionEvent(
        options,
        widget,
        'onUpdateChatMessage',
        messageId,
        text,
        append
      );
      return brainEngine?.updateChatMessage(messageId, text, append);
    },
    onSetHistoryOpen(isOpen: boolean) {
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
        uiDom.historyButtonEl.setAttribute('aria-expanded', String(isOpen === true));
      }
      callOptionEvent(options, widget, 'onSetHistoryOpen', isOpen);
    },
    onRenderHistory() {
      renderHistory(widget);
      callOptionEvent(options, widget, 'onRenderHistory');
    },
    onSpokenAudioPlayNow(text: string) {
      const { speechEngine } = getEngines();
      if (
        typeof speechEngine === 'object' &&
        speechEngine !== null &&
        typeof speechEngine.speak === 'function'
      ) {
        speechEngine.speak(text);
      }
      callOptionEvent(options, widget, 'onSpokenAudioPlayNow', text);
    },
    getChatLog: () => getEngines().brainEngine?.chatLog || [],
    getChatSeq: () => getEngines().brainEngine?.chatSeq || 0,
    isConvoOn: () => getEngines().speechEngine?.convoOn || false
  };

  let toolsEngine: any = null;
  let useCustomToolsEngine = false;

  if (
    typeof customEngines.tools === 'function' ||
    (typeof customEngines.tools === 'object' && customEngines.tools !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.tools === 'function'
          ? (customEngines.tools as any)(toolsOptions)
          : customEngines.tools;

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
      : Array.isArray((options as any).hostTools) && (options as any).hostTools.length > 0
        ? (options as any).hostTools
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
  rootStore: BaseStore;
  getEngines: () => {
    brainEngine: BrainEngine | any;
    speechEngine: SpeechEngine | any;
    skinEngine: SkinEngine | any;
    toolsEngine?: ToolsEngine | any;
  };
  getUiDom: () => UiDom | any;
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
}: SetupSkinParams): Promise<SkinEngine | any> {
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

  let skinEngine: any = null;
  let useCustomSkinEngine = false;

  if (
    typeof customEngines.skin === 'function' ||
    (typeof customEngines.skin === 'object' && customEngines.skin !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.skin === 'function'
          ? await (customEngines.skin as any)({
              stageEl,
              aiAvatarWidget: widget,
              speechEngine: getEngines().speechEngine
            })
          : customEngines.skin;

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
    skinEngine = initSkinEngine({
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
          speechEngine.spokenDisplayText = await brainEngine?.getWelcomeText();
        }
        if (typeof widget.onReady === 'function') {
          widget.onReady(widget);
        }
      },
      onThreeDimensionalError(error: any) {
        if (typeof widget.onError === 'function') {
          widget.onError(error, widget);
        }
        callOptionEvent(options, widget, 'onThreeDimensionalError', error);
      },
      onTwoDimensionalError(error: any) {
        const uiDom = getUiDom();
        const directWarnEl = uiDom?.directWarnEl;
        if (
          directWarnEl instanceof HTMLParagraphElement ||
          directWarnEl instanceof HTMLDivElement
        ) {
          directWarnEl.textContent =
            '2D 啟動失敗：' + (error?.message || error);
          directWarnEl.style.display = 'flex';
        }
        if (typeof widget.onError === 'function') {
          widget.onError(error, widget);
        }
        callOptionEvent(options, widget, 'onTwoDimensionalError', error);
      },
      VRMFileChangeFail(error: any) {
        console.error(error);
        const { speechEngine } = getEngines();
        if (speechEngine !== null && typeof speechEngine === 'object') {
          speechEngine.spokenDisplayText = error?.message || error;
        }
        if (typeof widget.onError === 'function') {
          widget.onError(error, widget);
        }
        callOptionEvent(options, widget, 'VRMFileChangeFail', error);
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
          if (
            typeof currentSkin.renderer?.canvas?.addEventListener === 'function'
          ) {
            currentSkin.renderer.canvas.addEventListener('pointerdown', () => {
              if (
                Array.isArray(currentSkin.renderer?.TAP_GESTURES) === true &&
                currentSkin.renderer.TAP_GESTURES.length > 0 &&
                typeof currentSkin.renderer.playGesture === 'function'
              ) {
                currentSkin.renderer.playGesture(
                  currentSkin.renderer.TAP_GESTURES[
                    Math.floor(
                      Math.random() * currentSkin.renderer.TAP_GESTURES.length
                    )
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
            currentSkin.renderer.canvas.addEventListener('pointerdown', () => {
              speechEngine?.triggerTap();
            });
          }
        }
        callOptionEvent(options, widget, 'onModelChangeEnd');
      }
    });
  }

  return skinEngine;
}
