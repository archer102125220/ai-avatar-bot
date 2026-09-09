import { initBrainEngine, validateBrainEngine } from '../brain';
import { initSpeechEngine } from '../speech';
import { initToolsEngine, validateToolsEngine } from '../tools';
import { initSkinEngine, validateSkinEngine } from '../skin';
import { createEmotionToolsPlugin } from '../plugins';
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_MAX_TOKENS,
  DEFAULT_AI_PROVIDER_MODEL,
  DEFAULT_AI_PROVIDER_MAX_TOKENS,
  DEFAULT_TTS_ENDPOINT,
  ENGINE_MODE_MAP,
  AVATAR_MODE_MAP
} from '../constants';
import { renderHistory } from '../ui';
import { callOptionEvent } from './options';

/**
 * 建立並初始化 Brain 大腦引擎實例。
 *
 * @param {Object} params
 * @param {import('./types').AvatarBotOptions} params.options - 原始設定選項
 * @param {import('./types').AiAvatarWidget} params.widget - Widget 實例
 * @param {import('../store').BaseStore} params.rootStore - 狀態 Store
 * @param {any} params.i18nEngine - 多語系引擎實例
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - 取得各引擎實例的函式
 * @param {() => any} params.getUiDom - 取得 UI DOM 物件的函式
 * @param {any} params.streamPipeline - 串流處理管線物件
 * @returns {Promise<any>}
 */
export async function setupBrainEngine({
  options,
  widget,
  rootStore,
  i18nEngine,
  getEngines,
  getUiDom,
  streamPipeline
}) {
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

  const brainOptions = {
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
      ((fromEngine, toEngine, error) => {
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
    getToolByName: (toolName) => {
      const { toolsEngine } = getEngines();
      if (
        typeof toolsEngine === 'object' &&
        toolsEngine !== null &&
        Array.isArray(toolsEngine.HOST_TOOLS) === true &&
        toolsEngine.HOST_TOOLS.length > 0
      ) {
        return (
          toolsEngine.HOST_TOOLS.find(
            (toolItem) => toolItem.name === toolName
          ) || null
        );
      }
      return null;
    },
    offerToolConfirmation: (tool, toolArguments, toolOptions) => {
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
    executeTool: async (tool, toolArguments, toolOptions) => {
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
      options.compression || options.brain?.compression || compression,

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
    onLlmLoadProgress(loadProgress) {
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
    onLlmLoadError(error) {
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
    onAiProviderConnected(response, _fetchSetting, aiProvider) {
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
    onSummaryUpdated(summary) {
      callOptionEvent(options, widget, 'onSummaryUpdated', summary);
    },
    onAddChatMessage(chatMessageItem) {
      const uiDom = getUiDom();
      if (uiDom?.historyPanelEl?.getAttribute('css-is-open') === 'true') {
        renderHistory(widget);
      }
      callOptionEvent(options, widget, 'onAddChatMessage', chatMessageItem);
    },
    onUpdateChatMessage(chatMessageItem) {
      const uiDom = getUiDom();
      if (uiDom?.historyPanelEl?.getAttribute('css-is-open') === 'true') {
        renderHistory(widget);
      }
      callOptionEvent(options, widget, 'onUpdateChatMessage', chatMessageItem);
    },
    onChatHistoryChanged(chatLog) {
      callOptionEvent(options, widget, 'onChatHistoryChanged', chatLog);
    },
    onSpokenAudioPlayNow(text) {
      const { speechEngine } = getEngines();
      if (typeof speechEngine?.speak === 'function') {
        speechEngine.speak(text);
      }
      callOptionEvent(options, widget, 'onSpokenAudioPlayNow', text);
    },
    onSpokenDisplayTextChange(text) {
      const { speechEngine } = getEngines();
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.spokenDisplayText = text;
      }
    },
    onSpokenAudioTextChange(text) {
      const { speechEngine } = getEngines();
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.spokenAudioText = text;
      }
    },
    onEmotionChange(emotion) {
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
    onToolNotFound(info) {
      return callOptionEvent(options, widget, 'onToolNotFound', info, widget);
    },
    onToolError(info) {
      return callOptionEvent(options, widget, 'onToolError', info, widget);
    }
  };

  let brainEngine = null;
  let useCustomBrainEngine = false;

  if (
    typeof customEngines.brain === 'function' ||
    (typeof customEngines.brain === 'object' && customEngines.brain !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.brain === 'function'
          ? await customEngines.brain(brainOptions)
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

/**
 * 建立並初始化 Speech 語音引擎實例。
 *
 * @param {Object} params
 * @param {import('./types').AvatarBotOptions} params.options - 原始設定選項
 * @param {import('./types').AiAvatarWidget} params.widget - Widget 實例
 * @param {import('../store').BaseStore} params.rootStore - 狀態 Store
 * @param {any} params.i18nEngine - 多語系引擎實例
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - 取得各引擎實例的函式
 * @param {() => any} params.getUiDom - 取得 UI DOM 物件的函式
 * @param {(text?: string) => void} params.handleUser - 使用者輸入處理函式
 * @param {() => void} params.onTapAvatar - Avatar 點擊互動函式
 * @param {any} params.streamPipeline - 串流處理管線物件
 * @param {HTMLElement} params.container - Widget 根容器 DOM
 * @param {string} params.safeNeuralVoice - 安全的語音識別名稱
 * @returns {Promise<any>}
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
}) {
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
    onSpokenDisplayTextChange(newSpeakingLabel) {
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
    onMicStateChanged(isListening, convoOn) {
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
    onVoiceStatusChanged(convoOn, text, state, level) {
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
    onUserInput: (text) => {
      return handleUser(text);
    },
    onTapAvatar: () => {
      return onTapAvatar();
    },
    onInterrupt: () => {
      streamPipeline.onInterrupt();
    },
    onSpeechWait: (speechSequenceId) => {
      streamPipeline.onSpeechWait(speechSequenceId);
    },
    onLanguageChanged(locale, localeLabel, shortLabel) {
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
    onSpeaking: (text) => {
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

/**
 * 建立並初始化 Tools 外部工具引擎實例。
 *
 * @param {Object} params
 * @param {import('./types').AvatarBotOptions} params.options - 原始設定選項
 * @param {import('./types').AiAvatarWidget} params.widget - Widget 實例
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - 取得各引擎實例的函式
 * @param {() => any} params.getUiDom - 取得 UI DOM 物件的函式
 * @returns {any}
 */
export function setupToolsEngine({ options, widget, getEngines, getUiDom }) {
  const { customEngines = {} } = options;

  const toolsOptions = {
    confirmationTimeoutMs:
      typeof options.confirmationTimeoutMs === 'number'
        ? options.confirmationTimeoutMs
        : options.toolConfirmationTimeoutMs,
    onToolCall: (pendingToolCall) => {
      callOptionEvent(options, widget, 'onToolCall', pendingToolCall, widget);
    },
    onAddChatMessage(role, text, messageOptions) {
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
    onUpdateChatMessage(messageId, text, append) {
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
    onSetHistoryOpen(isOpen) {
      const uiDom = getUiDom();
      if (uiDom?.historyPanelEl instanceof HTMLElement) {
        if (isOpen === true) {
          uiDom.historyPanelEl.setAttribute('css-is-open', 'true');
        } else {
          uiDom.historyPanelEl.removeAttribute('css-is-open');
        }
        if (uiDom.historyPanelEl.getAttribute('css-is-open') === 'true') {
          renderHistory(widget);
        }
      }
      callOptionEvent(options, widget, 'onSetHistoryOpen', isOpen);
    },
    onRenderHistory() {
      renderHistory(widget);
      callOptionEvent(options, widget, 'onRenderHistory');
    },
    onSpokenAudioPlayNow(text) {
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

  let toolsEngine = null;
  let useCustomToolsEngine = false;

  if (
    typeof customEngines.tools === 'function' ||
    (typeof customEngines.tools === 'object' && customEngines.tools !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.tools === 'function'
          ? customEngines.tools(toolsOptions)
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
      : Array.isArray(options.hostTools) && options.hostTools.length > 0
        ? options.hostTools
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

/**
 * 建立並初始化 Skin 模型渲染外觀引擎實例。
 *
 * @param {Object} params
 * @param {import('./types').AvatarBotOptions} params.options - 原始設定選項
 * @param {import('./types').AiAvatarWidget} params.widget - Widget 實例
 * @param {import('../store').BaseStore} params.rootStore - 狀態 Store
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - 取得各引擎實例的函式
 * @param {() => any} params.getUiDom - 取得 UI DOM 物件的函式
 * @param {HTMLElement} params.stageEl - 虛擬人渲染畫布容器 DOM
 * @returns {Promise<any>}
 */
export async function setupSkinEngine({
  options,
  widget,
  rootStore,
  getEngines,
  getUiDom,
  stageEl
}) {
  const {
    modelUrl,
    startMode,
    fitMode,
    vrmUrl,
    gesture3D,
    gesture2D,
    customEngines = {}
  } = options;

  let skinEngine = null;
  let useCustomSkinEngine = false;

  if (
    typeof customEngines.skin === 'function' ||
    (typeof customEngines.skin === 'object' && customEngines.skin !== null)
  ) {
    try {
      const customInstance =
        typeof customEngines.skin === 'function'
          ? await customEngines.skin({
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
      vrmUrl,
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
      onThreeDimensionalError(error) {
        if (typeof widget.onError === 'function') {
          widget.onError(error, widget);
        }
        callOptionEvent(options, widget, 'onThreeDimensionalError', error);
      },
      onTwoDimensionalError(error) {
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
      VRMFileChangeFail(error) {
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
        const uiDom = getUiDom();
        const engineButtonEl = uiDom?.engineButtonEl;
        const { skinEngine: currentSkin, speechEngine } = getEngines();

        if (engineButtonEl instanceof HTMLElement) {
          engineButtonEl.style.display = '';
          if (typeof engineButtonEl.onclick !== 'function') {
            engineButtonEl.onclick = () => {
              if (
                currentSkin?.engineMode === ENGINE_MODE_MAP.threeDimensional
              ) {
                currentSkin.engineMode = ENGINE_MODE_MAP.twoDimensional;
              } else if (
                currentSkin !== null &&
                typeof currentSkin === 'object'
              ) {
                currentSkin.engineMode = ENGINE_MODE_MAP.threeDimensional;
              }
            };
          }
        }
        if (speechEngine !== null && typeof speechEngine === 'object') {
          speechEngine.spokenDisplayText = '換上你的角色了！🎭';
        }
        callOptionEvent(options, widget, 'VRMFileChangeSuccess');
      },
      onModelChangeStart(newEngineMode) {
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
