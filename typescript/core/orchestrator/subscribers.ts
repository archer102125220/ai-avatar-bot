import { AVATAR_MODE_MAP } from '@/core/constants';
import { renderSuggestions, updateUIStrings } from '@/core/ui';
import { callOptionEvent } from './options';
import type { AiAvatarWidget, AvatarBotOptions, BaseStore, I18nEngine } from '@types';

export interface SetupStoreSubscribersParams {
  widget: AiAvatarWidget;
  rootStore: BaseStore;
  i18nEngine: I18nEngine;
  getUiDom: () => any;
  getEngines: () => {
    brainEngine: any;
    speechEngine: any;
    skinEngine: any;
    toolsEngine?: any;
  };
}

/**
 * Subscribes to central rootStore state changes and synchronizes updates to sub-engines and UI components.
 */
export function setupStoreSubscribers({
  widget,
  rootStore,
  i18nEngine,
  getUiDom,
  getEngines
}: SetupStoreSubscribersParams): void {
  rootStore.subscribe('avatarMode', (newAvatarMode: string) => {
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

  rootStore.subscribe('enableMemory', (newEnableMemory: boolean) => {
    const { brainEngine } = getEngines();
    if (
      typeof brainEngine?.memory === 'object' &&
      brainEngine?.memory !== null
    ) {
      brainEngine.memory.enabled = newEnableMemory;
    }
  });

  rootStore.subscribe('enableAiProvider', (newEnableAiProvider: boolean) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.enableAiProvider = newEnableAiProvider;
    }
  });

  rootStore.subscribe('preloadWebLLM', (newPreloadWebLLM: boolean) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.preloadWebLLM = newPreloadWebLLM;
    }
  });

  rootStore.subscribe('autoFallbackWebLLM', (newAutoFallbackWebLLM: boolean) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.autoFallbackWebLLM = newAutoFallbackWebLLM;
    }
  });

  rootStore.subscribe('enableAutoContinue', (newEnableAutoContinue: boolean) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.enableAutoContinue = newEnableAutoContinue;
    }
  });

  rootStore.subscribe('maxAutoContinuations', (newMaxAutoContinuations: number) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.maxAutoContinuations = newMaxAutoContinuations;
    }
  });

  rootStore.subscribe('autoContinueMode', (newAutoContinueMode: string) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.autoContinueMode = newAutoContinueMode;
    }
  });

  rootStore.subscribe('autoContinuePrompt', (newAutoContinuePrompt: any) => {
    const { brainEngine } = getEngines();
    if (typeof brainEngine === 'object' && brainEngine !== null) {
      brainEngine.autoContinuePrompt = newAutoContinuePrompt;
    }
  });

  rootStore.subscribe('gender', (newGender: string) => {
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

  rootStore.subscribe('brainGender', (newBrainGender: string | null) => {
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

  rootStore.subscribe('speechGender', (newSpeechGender: string | null) => {
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

  rootStore.subscribe('skinGender', (newSkinGender: string | null) => {
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

  rootStore.subscribe('locale', (newLocale: string) => {
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

export interface SetupI18nSubscribersParams {
  widget: AiAvatarWidget;
  options: AvatarBotOptions;
  rootStore: BaseStore;
  i18nEngine: I18nEngine;
  container: HTMLElement;
  getUiDom: () => any;
  getEngines: () => {
    brainEngine: any;
    speechEngine: any;
    skinEngine?: any;
    toolsEngine?: any;
  };
}

/**
 * Subscribes to i18n engine changes, synchronizing UI translations, mic states, voice indicators, and triggering `onLanguageChanged`.
 */
export function setupI18nSubscribers({
  widget,
  options,
  rootStore,
  i18nEngine,
  container,
  getUiDom,
  getEngines
}: SetupI18nSubscribersParams): void {
  if (
    typeof i18nEngine === 'object' &&
    i18nEngine !== null &&
    typeof i18nEngine.subscribe === 'function'
  ) {
    i18nEngine.subscribe('messages', () => {
      updateUIStrings(container, i18nEngine);
      renderSuggestions(widget);
    });

    i18nEngine.subscribe('locale', (newLocale: string, localeLabels: any) => {
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
