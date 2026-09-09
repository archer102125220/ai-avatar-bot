import {
  initUi,
  renderSuggestions,
  bindTyping,
  bindUiEvent,
  initSkinModeChangeButton,
  updateUIStrings
} from '../ui';
import { normalizeOptions } from './options';
import { createAvatarWidget } from './widget';
import { setupStoreSubscribers, setupI18nSubscribers } from './subscribers';
import { createUserPipeline } from './pipeline-user';
import { createStreamPipeline } from './pipeline-stream';
import { createTapAvatarHandler, createModelDropHandler } from './interaction';
import {
  setupBrainEngine,
  setupSpeechEngine,
  setupToolsEngine,
  setupSkinEngine
} from './engine-factory';

export * from './types';
export * from './options';
export * from './widget';
export * from './subscribers';
export * from './pipeline-user';
export * from './pipeline-stream';
export * from './interaction';
export * from './engine-factory';

/**
 * 初始化 AI Avatar Bot 實例。
 *
 * @param {import('./types').AvatarBotOptions} [rawOptions={}] - 初始化設定選項
 * @returns {Promise<import('./types').AiAvatarWidget|void>}
 */
export async function initAvatarBot(rawOptions = {}) {
  if (typeof window !== 'object') {
    return;
  }

  const {
    rawOptions: options,
    container,
    rootStore,
    i18nEngine,
    initialMinimal,
    isModelDropEnabled,
    safeNeuralVoice
  } = normalizeOptions(rawOptions);

  const stageEl = document.createElement('div');
  stageEl.setAttribute('id', 'stage');
  const uiDom = initUi(container, stageEl, i18nEngine);

  let brainEngine = null;
  let speechEngine = null;
  let skinEngine = null;
  let toolsEngine = null;

  const getEngines = () => ({
    brainEngine,
    speechEngine,
    skinEngine,
    toolsEngine
  });
  const getUiDom = () => uiDom;

  const streamSpeechState = { sentenceBuffer: '', buf: '' };
  const autoContinueState = {
    isActive: false,
    continuationIndex: 0,
    maxContinuations: 0,
    accumulatedText: ''
  };

  const getWidget = () => aiAvatarWidget;

  const streamPipeline = createStreamPipeline({
    getWidget,
    options,
    getEngines,
    autoContinueState,
    streamSpeechState
  });

  const handleUser = createUserPipeline({
    getWidget,
    rootStore,
    i18nEngine,
    getEngines,
    autoContinueState
  });

  const onTapAvatar = createTapAvatarHandler({
    getWidget,
    options,
    rootStore,
    i18nEngine,
    getEngines
  });

  const updateModelDropListeners = createModelDropHandler({
    container,
    getSkinEngine: () => skinEngine
  });

  const aiAvatarWidget = createAvatarWidget({
    options,
    container,
    rootStore,
    i18nEngine,
    initialMinimal,
    getUiDom,
    getEngines,
    handleUser,
    updateModelDropListeners
  });

  setupStoreSubscribers({
    widget: aiAvatarWidget,
    rootStore,
    i18nEngine,
    getUiDom,
    getEngines
  });

  setupI18nSubscribers({
    widget: aiAvatarWidget,
    options,
    rootStore,
    i18nEngine,
    container,
    getUiDom,
    getEngines
  });

  brainEngine = await setupBrainEngine({
    options,
    widget: aiAvatarWidget,
    rootStore,
    i18nEngine,
    getEngines,
    getUiDom,
    streamPipeline
  });

  speechEngine = await setupSpeechEngine({
    options,
    widget: aiAvatarWidget,
    rootStore,
    i18nEngine,
    getEngines,
    getUiDom,
    handleUser,
    onTapAvatar,
    streamPipeline,
    container,
    safeNeuralVoice
  });

  toolsEngine = setupToolsEngine({
    options,
    widget: aiAvatarWidget,
    getEngines,
    getUiDom
  });

  skinEngine = await setupSkinEngine({
    options,
    widget: aiAvatarWidget,
    rootStore,
    getEngines,
    getUiDom,
    stageEl
  });

  if (
    typeof speechEngine === 'object' &&
    speechEngine !== null &&
    typeof speechEngine.subscribe === 'function'
  ) {
    speechEngine.subscribe('isSpeaking', (isSpeaking) => {
      if (
        typeof skinEngine === 'object' &&
        skinEngine !== null &&
        typeof skinEngine.setIsSpeaking === 'function'
      ) {
        skinEngine.setIsSpeaking(isSpeaking);
      }
    });
  }

  // 初始化 UI 語音狀態
  uiDom.updateVoiceStatus(
    aiAvatarWidget.speechEngine.convoOn,
    typeof i18nEngine?.t === 'function'
      ? i18nEngine.t('ui.voice.standby')
      : '即時語音待命',
    '',
    0,
    i18nEngine
  );

  if (typeof options.onReady === 'function') {
    aiAvatarWidget.onReady = options.onReady.bind(aiAvatarWidget);
  }

  if (typeof options.onMinimalTrigger === 'function') {
    aiAvatarWidget.onMinimalTrigger =
      options.onMinimalTrigger.bind(aiAvatarWidget);
  }

  initSkinModeChangeButton(aiAvatarWidget, skinEngine.has2D, skinEngine.has3D);
  renderSuggestions(aiAvatarWidget);
  bindTyping(aiAvatarWidget);
  bindUiEvent(aiAvatarWidget);
  updateUIStrings(container, i18nEngine);

  if (
    uiDom?.langButtonEl instanceof HTMLButtonElement &&
    typeof i18nEngine === 'object' &&
    i18nEngine !== null
  ) {
    uiDom.langButtonEl.textContent =
      typeof i18nEngine.labels?.shortLabel === 'string' &&
      i18nEngine.labels.shortLabel !== ''
        ? i18nEngine.labels.shortLabel
        : typeof i18nEngine.labels?.label === 'string' &&
            i18nEngine.labels.label !== ''
          ? i18nEngine.labels.label
          : '中文';
  }

  aiAvatarWidget.speechEngine.setMic(false);

  if (isModelDropEnabled === true) {
    updateModelDropListeners(true);
  }

  if (aiAvatarWidget.isIframe === true) {
    if (typeof aiAvatarWidget.onMinimalTrigger === 'function') {
      aiAvatarWidget.onMinimalTrigger(options.isMinimal === true, aiAvatarWidget);
    }
    aiAvatarWidget.hiddenMinimalEl();
  } else {
    aiAvatarWidget.isMinimal = options.isMinimal === true;
  }

  return aiAvatarWidget;
}

export default initAvatarBot;
