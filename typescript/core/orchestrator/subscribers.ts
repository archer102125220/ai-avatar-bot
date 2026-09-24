import { AVATAR_MODE_MAP } from '@/core/constants';
import { renderSuggestions, updateUIStrings } from '@/core/ui';
import { callOptionEvent } from './options';
import type {
  AiAvatarWidget,
  AvatarBotOptions,
  BaseStore,
  I18nEngine,
  GetEnginesFn,
  UiDom,
  BrainEngine,
  SpeechEngine,
  SkinEngine
} from './types';

export interface SetupStoreSubscribersParams {
  widget: AiAvatarWidget;
  rootStore: BaseStore;
  i18nEngine: I18nEngine;
  getUiDom: () => UiDom | null;
  getEngines: GetEnginesFn;
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
  rootStore.subscribe('avatarMode', (newAvatarMode: unknown) => {
    const { brainEngine, speechEngine } = getEngines();
    const uiDom = getUiDom();

    if (
      typeof brainEngine === 'object' &&
      brainEngine !== null &&
      typeof newAvatarMode === 'string'
    ) {
      brainEngine.avatarMode =
        newAvatarMode as import('@/core/brain').AvatarMode;
    }
    renderSuggestions(widget);
    if (typeof uiDom?.updateMicState === 'function') {
      const isCompanion = newAvatarMode === AVATAR_MODE_MAP.companion;
      uiDom.updateMicState(
        speechEngine?.isListening ?? false,
        speechEngine?.convoOn ?? false,
        isCompanion,
        i18nEngine
      );
    }
  });

  rootStore.subscribe('enableMemory', (newEnableMemory: unknown) => {
    const { brainEngine } = getEngines();
    if (
      typeof brainEngine?.memory === 'object' &&
      brainEngine?.memory !== null &&
      typeof newEnableMemory === 'boolean'
    ) {
      brainEngine.memory.enabled = newEnableMemory;
    }
  });

  rootStore.subscribe('enableAiProvider', (newEnableAiProvider: unknown) => {
    const { brainEngine } = getEngines();
    if (
      typeof brainEngine === 'object' &&
      brainEngine !== null &&
      typeof newEnableAiProvider === 'boolean'
    ) {
      brainEngine.enableAiProvider = newEnableAiProvider;
    }
  });

  rootStore.subscribe('preloadWebLLM', (newPreloadWebLLM: unknown) => {
    const { brainEngine } = getEngines();
    if (
      typeof brainEngine === 'object' &&
      brainEngine !== null &&
      typeof newPreloadWebLLM === 'boolean'
    ) {
      brainEngine.preloadWebLLM = newPreloadWebLLM;
    }
  });

  rootStore.subscribe(
    'autoFallbackWebLLM',
    (newAutoFallbackWebLLM: unknown) => {
      const { brainEngine } = getEngines();
      if (
        typeof brainEngine === 'object' &&
        brainEngine !== null &&
        typeof newAutoFallbackWebLLM === 'boolean'
      ) {
        brainEngine.autoFallbackWebLLM = newAutoFallbackWebLLM;
      }
    }
  );

  rootStore.subscribe(
    'enableAutoContinue',
    (newEnableAutoContinue: unknown) => {
      const { brainEngine } = getEngines();
      if (
        typeof brainEngine === 'object' &&
        brainEngine !== null &&
        typeof newEnableAutoContinue === 'boolean'
      ) {
        brainEngine.enableAutoContinue = newEnableAutoContinue;
      }
    }
  );

  rootStore.subscribe(
    'maxAutoContinuations',
    (newMaxAutoContinuations: unknown) => {
      const { brainEngine } = getEngines();
      if (
        typeof brainEngine === 'object' &&
        brainEngine !== null &&
        typeof newMaxAutoContinuations === 'number'
      ) {
        brainEngine.maxAutoContinuations = newMaxAutoContinuations;
      }
    }
  );

  rootStore.subscribe('autoContinueMode', (newAutoContinueMode: unknown) => {
    const { brainEngine } = getEngines();
    if (
      typeof brainEngine === 'object' &&
      brainEngine !== null &&
      typeof newAutoContinueMode === 'string'
    ) {
      brainEngine.autoContinueMode = newAutoContinueMode;
    }
  });

  rootStore.subscribe(
    'autoContinuePrompt',
    (newAutoContinuePrompt: unknown) => {
      const { brainEngine } = getEngines();
      if (
        typeof brainEngine === 'object' &&
        brainEngine !== null &&
        (typeof newAutoContinuePrompt === 'string' ||
          typeof newAutoContinuePrompt === 'function' ||
          newAutoContinuePrompt === null)
      ) {
        brainEngine.autoContinuePrompt = newAutoContinuePrompt as
          string | ((...args: unknown[]) => string) | null;
      }
    }
  );

  rootStore.subscribe('gender', (newGender: unknown) => {
    if (typeof newGender !== 'string') {
      return;
    }
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

  rootStore.subscribe('brainGender', (newBrainGender: unknown) => {
    const { brainEngine } = getEngines();
    const state = rootStore.getState();
    const resolvedGender =
      typeof newBrainGender === 'string' && newBrainGender !== ''
        ? newBrainGender
        : typeof state.gender === 'string'
          ? state.gender
          : '';
    if (typeof brainEngine?.setGender === 'function') {
      brainEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('speechGender', (newSpeechGender: unknown) => {
    const { speechEngine } = getEngines();
    const state = rootStore.getState();
    const resolvedGender =
      typeof newSpeechGender === 'string' && newSpeechGender !== ''
        ? newSpeechGender
        : typeof state.gender === 'string'
          ? state.gender
          : '';
    if (typeof speechEngine?.setGender === 'function') {
      speechEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('skinGender', (newSkinGender: unknown) => {
    const { skinEngine } = getEngines();
    const state = rootStore.getState();
    const resolvedGender =
      typeof newSkinGender === 'string' && newSkinGender !== ''
        ? newSkinGender
        : typeof state.gender === 'string'
          ? state.gender
          : '';
    if (typeof skinEngine?.setGender === 'function') {
      skinEngine.setGender(resolvedGender);
    }
  });

  rootStore.subscribe('locale', (newLocale: unknown) => {
    if (typeof newLocale !== 'string') {
      return;
    }
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
  getUiDom: () => UiDom | null;
  getEngines: () => {
    brainEngine: BrainEngine | null;
    speechEngine: SpeechEngine | null;
    skinEngine: SkinEngine | null;
  };
}

/**
 * Sets up subscribers to internationalization changes.
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

    i18nEngine.subscribe(
      'locale',
      (newLocale: string, localeLabels?: unknown) => {
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
            speechEngine?.isListening ?? false,
            speechEngine?.convoOn ?? false,
            isCompanion,
            i18nEngine
          );
        }
        if (typeof uiDom?.updateVoiceStatus === 'function') {
          uiDom.updateVoiceStatus(
            speechEngine?.convoOn ?? false,
            undefined,
            undefined,
            undefined,
            i18nEngine
          );
        }
        renderSuggestions(widget);

        const labelsObj =
          typeof localeLabels === 'object' && localeLabels !== null
            ? (localeLabels as { label?: unknown; shortLabel?: unknown })
            : null;
        const label =
          typeof labelsObj?.label === 'string' ? labelsObj.label : '';
        const shortLabel =
          typeof labelsObj?.shortLabel === 'string' ? labelsObj.shortLabel : '';

        if (uiDom?.langButtonEl instanceof HTMLButtonElement) {
          uiDom.langButtonEl.textContent =
            shortLabel !== '' ? shortLabel : label !== '' ? label : newLocale;
        }
        callOptionEvent(
          options,
          widget,
          'onLanguageChanged',
          newLocale,
          label,
          shortLabel
        );
      }
    );
  }
}
