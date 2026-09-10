import { AVATAR_MODE_MAP } from '../constants';
import { renderSuggestions, updateUIStrings } from '../ui';
import { callOptionEvent } from './options';

/**
 * 設定 rootStore 狀態變更訂閱，將變更同步至各引擎與 UI。
 *
 * @param {Object} params
 * @param {import('./types').AiAvatarWidget} params.widget - Widget 實例
 * @param {import('../store').BaseStore} params.rootStore - 狀態 Store
 * @param {any} params.i18nEngine - 多語系引擎實例
 * @param {() => any} params.getUiDom - 取得 UI DOM 物件的函式
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - 取得各引擎實例的函式
 */
export function setupStoreSubscribers({
  widget,
  rootStore,
  i18nEngine,
  getUiDom,
  getEngines
}) {
  rootStore.subscribe('avatarMode', (newAvatarMode) => {
    const { brainEngine, speechEngine } = getEngines();
    const uiDom = getUiDom();

    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.avatarMode = newAvatarMode;
    }
    renderSuggestions(widget);
    if (typeof uiDom?.updateMicState === 'function') {
      const isCompanion = newAvatarMode === AVATAR_MODE_MAP.companion;
      uiDom.updateMicState(
        speechEngine?.isListening,
        speechEngine?.convoOn,
        isCompanion,
        i18nEngine
      );
    }
  });

  rootStore.subscribe('enableMemory', (newEnableMemory) => {
    const { brainEngine } = getEngines();
    if (
      typeof brainEngine?.memory === 'object' &&
      brainEngine?.memory !== null
    ) {
      brainEngine.memory.enabled = newEnableMemory;
    }
  });

  rootStore.subscribe('enableAiProvider', (newEnableAiProvider) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.enableAiProvider = newEnableAiProvider;
    }
  });

  rootStore.subscribe('preloadWebLLM', (newPreloadWebLLM) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.preloadWebLLM = newPreloadWebLLM;
    }
  });

  rootStore.subscribe('autoFallbackWebLLM', (newAutoFallbackWebLLM) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.autoFallbackWebLLM = newAutoFallbackWebLLM;
    }
  });

  rootStore.subscribe('enableAutoContinue', (newEnableAutoContinue) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.enableAutoContinue = newEnableAutoContinue;
    }
  });

  rootStore.subscribe('maxAutoContinuations', (newMaxAutoContinuations) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.maxAutoContinuations = newMaxAutoContinuations;
    }
  });

  rootStore.subscribe('autoContinueMode', (newAutoContinueMode) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.autoContinueMode = newAutoContinueMode;
    }
  });

  rootStore.subscribe('autoContinuePrompt', (newAutoContinuePrompt) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.autoContinuePrompt = newAutoContinuePrompt;
    }
  });

  rootStore.subscribe('gender', (newGender) => {
    const { brainEngine, speechEngine, skinEngine } = getEngines();
    const state = rootStore.getState();
    if (
      state.brainGender === null &&
      typeof brainEngine?.setGender === 'function'
    ) {
      brainEngine.setGender(newGender);
    }
    if (
      state.speechGender === null &&
      typeof speechEngine?.setGender === 'function'
    ) {
      speechEngine.setGender(newGender);
    }
    if (
      state.skinGender === null &&
      typeof skinEngine?.setGender === 'function'
    ) {
      skinEngine.setGender(newGender);
    }
  });

  rootStore.subscribe('brainGender', (newBrainGender) => {
    const { brainEngine } = getEngines();
    const state = rootStore.getState();
    const resolvedGender =
      typeof newBrainGender === 'string' && newBrainGender !== ''
        ? newBrainGender
        : state.gender;
    if (typeof brainEngine?.setGender === 'function') {
      brainEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('speechGender', (newSpeechGender) => {
    const { speechEngine } = getEngines();
    const state = rootStore.getState();
    const resolvedGender =
      typeof newSpeechGender === 'string' && newSpeechGender !== ''
        ? newSpeechGender
        : state.gender;
    if (typeof speechEngine?.setGender === 'function') {
      speechEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('skinGender', (newSkinGender) => {
    const { skinEngine } = getEngines();
    const state = rootStore.getState();
    const resolvedGender =
      typeof newSkinGender === 'string' && newSkinGender !== ''
        ? newSkinGender
        : state.gender;
    if (typeof skinEngine?.setGender === 'function') {
      skinEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('locale', (newLocale) => {
    const { brainEngine, speechEngine } = getEngines();
    if (typeof brainEngine?.setLocale === 'function') {
      brainEngine.setLocale(newLocale);
    }
    if (typeof speechEngine?.setLocale === 'function') {
      speechEngine.setLocale(newLocale);
    }
  });

  const suggestionStateKeys = [
    'suggestedQuestions',
    'companionSuggestedQuestions',
    'assistantSuggestedQuestions',
    'suggestedTitle',
    'companionSuggestedTitle',
    'assistantSuggestedTitle'
  ];
  suggestionStateKeys.forEach((key) => {
    rootStore.subscribe(key, () => {
      renderSuggestions(widget);
    });
  });
}

/**
 * 設定 i18n 多語系引擎訂閱，同步更新 UI 文字、麥克風、語音狀態並派發 onLanguageChanged。
 *
 * @param {Object} params
 * @param {import('./types').AiAvatarWidget} params.widget - Widget 實例
 * @param {import('./types').AvatarBotOptions} params.options - 原始設定選項
 * @param {import('../store').BaseStore} params.rootStore - 狀態 Store
 * @param {any} params.i18nEngine - 多語系引擎實例
 * @param {HTMLElement} params.container - Widget 根容器 DOM
 * @param {() => any} params.getUiDom - 取得 UI DOM 物件的函式
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - 取得各引擎實例的函式
 */
export function setupI18nSubscribers({
  widget,
  options,
  rootStore,
  i18nEngine,
  container,
  getUiDom,
  getEngines
}) {
  if (
    typeof i18nEngine === 'object' &&
    i18nEngine !== null &&
    typeof i18nEngine.subscribe === 'function'
  ) {
    i18nEngine.subscribe('messages', () => {
      updateUIStrings(container, i18nEngine);
      renderSuggestions(widget);
    });

    i18nEngine.subscribe('locale', (newLocale, localeLabels) => {
      const { brainEngine, speechEngine } = getEngines();
      const uiDom = getUiDom();

      rootStore.setState({ locale: newLocale });
      if (typeof brainEngine?.setLocale === 'function') {
        brainEngine.setLocale(newLocale);
      }
      if (typeof speechEngine?.setLocale === 'function') {
        speechEngine.setLocale(newLocale);
      }
      updateUIStrings(container, i18nEngine);
      if (typeof uiDom?.updateMicState === 'function') {
        const isCompanion =
          rootStore.getState().avatarMode === AVATAR_MODE_MAP.companion;
        uiDom.updateMicState(
          speechEngine?.isListening,
          speechEngine?.convoOn,
          isCompanion,
          i18nEngine
        );
      }
      if (typeof uiDom?.updateVoiceStatus === 'function') {
        uiDom.updateVoiceStatus(
          speechEngine?.convoOn,
          undefined,
          undefined,
          undefined,
          i18nEngine
        );
      }
      renderSuggestions(widget);
      if (uiDom?.langButtonEl instanceof HTMLButtonElement) {
        uiDom.langButtonEl.textContent =
          typeof localeLabels?.shortLabel === 'string' &&
          localeLabels.shortLabel !== ''
            ? localeLabels.shortLabel
            : typeof localeLabels?.label === 'string' &&
                localeLabels.label !== ''
              ? localeLabels.label
              : newLocale;
      }
      callOptionEvent(
        options,
        widget,
        'onLanguageChanged',
        newLocale,
        localeLabels?.label,
        localeLabels?.shortLabel
      );
    });
  }
}
