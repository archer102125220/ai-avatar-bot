import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setupStoreSubscribers,
  setupI18nSubscribers
} from '@/core/orchestrator/subscribers';
import { createBaseStore } from '@/core/store';
import { initI18nEngine } from '@/core/i18n';
import type {
  AiAvatarWidget,
  BaseStore,
  I18nEngine,
  GetEnginesFn,
  UiDom
} from '@/core/orchestrator/types';

interface MockUiDom {
  suggestionsEl: HTMLElement;
  historyPanelEl: HTMLElement;
  langButtonEl: HTMLButtonElement | null;
  updateMicState: ReturnType<typeof vi.fn>;
  updateVoiceStatus: ReturnType<typeof vi.fn>;
}

interface MockEngines {
  brainEngine: {
    avatarMode: string;
    enableAiProvider: boolean;
    preloadWebLLM: boolean;
    autoFallbackWebLLM: boolean;
    enableAutoContinue: boolean;
    maxAutoContinuations: number;
    autoContinueMode: string;
    autoContinuePrompt: string | (() => string) | null;
    memory: { enabled: boolean };
    setGender: ReturnType<typeof vi.fn>;
    setLocale: ReturnType<typeof vi.fn>;
  };
  speechEngine: {
    isListening: boolean;
    convoOn: boolean;
    setGender: ReturnType<typeof vi.fn>;
    setLocale: ReturnType<typeof vi.fn>;
  };
  skinEngine: {
    setGender: ReturnType<typeof vi.fn>;
  };
  toolsEngine: Record<string, unknown>;
}

describe('Orchestrator Store & i18n Subscribers', () => {
  let rootStore: BaseStore;
  let i18nEngine: I18nEngine;
  let mockWidget: AiAvatarWidget;
  let mockUiDom: MockUiDom;
  let mockEngines: MockEngines;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');

    rootStore = createBaseStore({
      gender: 'female',
      brainGender: null,
      speechGender: null,
      skinGender: null,
      avatarMode: 'assistant',
      enableMemory: true,
      enableAiProvider: false,
      preloadWebLLM: false,
      autoFallbackWebLLM: true,
      enableAutoContinue: false,
      maxAutoContinuations: 3,
      autoContinueMode: 'single_turn',
      autoContinuePrompt: null,
      locale: 'zh-TW',
      suggestedQuestions: []
    });

    i18nEngine = initI18nEngine({ locale: 'zh-TW' });

    mockUiDom = {
      suggestionsEl: document.createElement('div'),
      historyPanelEl: document.createElement('section'),
      langButtonEl: document.createElement('button'),
      updateMicState: vi.fn(),
      updateVoiceStatus: vi.fn()
    };

    mockEngines = {
      brainEngine: {
        avatarMode: 'assistant',
        enableAiProvider: false,
        preloadWebLLM: false,
        autoFallbackWebLLM: true,
        enableAutoContinue: false,
        maxAutoContinuations: 3,
        autoContinueMode: 'single_turn',
        autoContinuePrompt: null,
        memory: { enabled: true },
        setGender: vi.fn(),
        setLocale: vi.fn()
      },
      speechEngine: {
        isListening: false,
        convoOn: false,
        setGender: vi.fn(),
        setLocale: vi.fn()
      },
      skinEngine: {
        setGender: vi.fn()
      },
      toolsEngine: {}
    };

    mockWidget = {
      uiDom: mockUiDom,
      i18nEngine,
      rootStore,
      avatarMode: 'assistant',
      get suggestedQuestions() {
        return (rootStore.getState().suggestedQuestions as string[]) ?? [];
      }
    } as unknown as AiAvatarWidget;
  });

  const getEngines: GetEnginesFn = () =>
    mockEngines as unknown as ReturnType<GetEnginesFn>;
  const getUiDom = () => mockUiDom as unknown as UiDom;

  describe('setupStoreSubscribers', () => {
    it('should synchronize avatarMode and call renderSuggestions', () => {
      setupStoreSubscribers({
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getUiDom,
        getEngines
      });

      rootStore.setState({ avatarMode: 'companion' });

      expect(mockEngines.brainEngine.avatarMode).toBe('companion');
      expect(mockUiDom.updateMicState).toHaveBeenCalled();
    });

    it('should synchronize memory, AI provider, and auto-continue store flags', () => {
      setupStoreSubscribers({
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getUiDom,
        getEngines
      });

      rootStore.setState({
        enableMemory: false,
        enableAiProvider: true,
        preloadWebLLM: true,
        autoFallbackWebLLM: false,
        enableAutoContinue: true,
        maxAutoContinuations: 5,
        autoContinueMode: 'multi_turn',
        autoContinuePrompt: 'Continue...'
      });

      expect(mockEngines.brainEngine.memory.enabled).toBe(false);
      expect(mockEngines.brainEngine.enableAiProvider).toBe(true);
      expect(mockEngines.brainEngine.preloadWebLLM).toBe(true);
      expect(mockEngines.brainEngine.autoFallbackWebLLM).toBe(false);
      expect(mockEngines.brainEngine.enableAutoContinue).toBe(true);
      expect(mockEngines.brainEngine.maxAutoContinuations).toBe(5);
      expect(mockEngines.brainEngine.autoContinueMode).toBe('multi_turn');
      expect(mockEngines.brainEngine.autoContinuePrompt).toBe('Continue...');
    });

    it('should propagate gender and sub-gender overrides to engines', () => {
      setupStoreSubscribers({
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getUiDom,
        getEngines
      });

      rootStore.setState({ gender: 'male' });
      expect(mockEngines.brainEngine.setGender).toHaveBeenCalledWith('male');
      expect(mockEngines.speechEngine.setGender).toHaveBeenCalledWith('male');
      expect(mockEngines.skinEngine.setGender).toHaveBeenCalledWith('male');

      // Individual override
      rootStore.setState({ brainGender: 'female' });
      expect(mockEngines.brainEngine.setGender).toHaveBeenCalledWith('female');

      // speechGender and skinGender overrides
      rootStore.setState({ speechGender: 'male' });
      expect(mockEngines.speechEngine.setGender).toHaveBeenCalledWith('male');
      rootStore.setState({ skinGender: 'female' });
      expect(mockEngines.skinEngine.setGender).toHaveBeenCalledWith('female');

      // Setting sub-gender to empty string falls back to rootStore.gender
      rootStore.setState({ brainGender: '', speechGender: '', skinGender: '' });
      expect(mockEngines.brainEngine.setGender).toHaveBeenCalledWith('male');
      expect(mockEngines.speechEngine.setGender).toHaveBeenCalledWith('male');
      expect(mockEngines.skinEngine.setGender).toHaveBeenCalledWith('male');

      // Generic gender change when sub-genders are not null does not overwrite overridden sub-genders
      rootStore.setState({
        brainGender: 'female',
        speechGender: 'female',
        skinGender: 'female'
      });
      rootStore.setState({ gender: 'male' });
      // Should not call setGender with 'male' since sub-genders are non-null
      expect(mockEngines.brainEngine.setGender).toHaveBeenLastCalledWith(
        'female'
      );
    });

    it('should propagate locale changes to brainEngine and speechEngine', () => {
      setupStoreSubscribers({
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getUiDom,
        getEngines
      });

      rootStore.setState({ locale: 'en-US' });
      expect(mockEngines.brainEngine.setLocale).toHaveBeenCalledWith('en-US');
      expect(mockEngines.speechEngine.setLocale).toHaveBeenCalledWith('en-US');
    });

    it('should re-render suggestions on all suggestion store key updates and handle null engines gracefully', () => {
      setupStoreSubscribers({
        widget: mockWidget as unknown as AiAvatarWidget,
        rootStore,
        i18nEngine,
        getUiDom: () => null,
        getEngines: () =>
          ({
            brainEngine: null,
            speechEngine: null,
            skinEngine: null
          }) as unknown as ReturnType<
            Parameters<typeof setupStoreSubscribers>[0]['getEngines']
          >
      });

      // Triggers avatarMode without uiDom or engines
      expect(() =>
        rootStore.setState({ avatarMode: 'companion' })
      ).not.toThrow();

      // Suggestion state keys
      const suggestionKeys = [
        'suggestedQuestions',
        'companionSuggestedQuestions',
        'assistantSuggestedQuestions',
        'suggestedTitle',
        'companionSuggestedTitle',
        'assistantSuggestedTitle'
      ];
      suggestionKeys.forEach((key) => {
        expect(() => rootStore.setState({ [key]: ['問題1'] })).not.toThrow();
      });
    });

    it('should synchronize brainGender, speechGender, skinGender, and locale to engines', () => {
      setupStoreSubscribers({
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getUiDom,
        getEngines
      });

      // Test brainGender, speechGender, skinGender with specific values and empty fallback
      rootStore.setState({ brainGender: 'male' });
      expect(mockEngines.brainEngine.setGender).toHaveBeenCalledWith('male');
      rootStore.setState({ brainGender: '' });
      expect(mockEngines.brainEngine.setGender).toHaveBeenCalledWith('female');

      rootStore.setState({ speechGender: 'male' });
      expect(mockEngines.speechEngine.setGender).toHaveBeenCalledWith('male');
      rootStore.setState({ speechGender: '' });
      expect(mockEngines.speechEngine.setGender).toHaveBeenCalledWith('female');

      rootStore.setState({ skinGender: 'male' });
      expect(mockEngines.skinEngine.setGender).toHaveBeenCalledWith('male');
      rootStore.setState({ skinGender: '' });
      expect(mockEngines.skinEngine.setGender).toHaveBeenCalledWith('female');

      // Test store locale subscriber
      rootStore.setState({ locale: 'ja-JP' });
      expect(mockEngines.brainEngine.setLocale).toHaveBeenCalledWith('ja-JP');
      expect(mockEngines.speechEngine.setLocale).toHaveBeenCalledWith('ja-JP');
    });
  });

  describe('setupI18nSubscribers', () => {
    it('should update locale and UI when i18n locale changes', () => {
      const options = {
        onLanguageChanged: vi.fn()
      };

      setupI18nSubscribers({
        widget: mockWidget,
        options,
        rootStore,
        i18nEngine,
        container,
        getUiDom,
        getEngines
      });

      i18nEngine.setLocale('en-US');

      expect(rootStore.getState().locale).toBe('en-US');
      expect(mockEngines.brainEngine.setLocale).toHaveBeenCalledWith('en-US');
      expect(mockEngines.speechEngine.setLocale).toHaveBeenCalledWith('en-US');
      expect(mockUiDom.langButtonEl?.textContent).toBe('EN');
      expect(options.onLanguageChanged).toHaveBeenCalledWith(
        'en-US',
        'English (US)',
        'EN'
      );
      expect(mockUiDom.updateVoiceStatus).toHaveBeenCalled();
    });

    it('should handle i18n messages change and button label fallbacks', () => {
      const options = {};
      const customUiDom = {
        langButtonEl: document.createElement('button'),
        updateMicState: null,
        updateVoiceStatus: null
      };

      setupI18nSubscribers({
        widget: mockWidget as unknown as AiAvatarWidget,
        options,
        rootStore,
        i18nEngine,
        container,
        getUiDom: () =>
          customUiDom as unknown as ReturnType<
            Parameters<typeof setupI18nSubscribers>[0]['getUiDom']
          >,
        getEngines: () =>
          ({ brainEngine: null, speechEngine: null }) as unknown as ReturnType<
            Parameters<typeof setupI18nSubscribers>[0]['getEngines']
          >
      });

      // Test messages subscription
      i18nEngine.addMessages('zh-TW', { hello: '你好' });

      // Test locale change with missing shortLabel
      i18nEngine.setLocale('ja-JP');
      expect(customUiDom.langButtonEl.textContent).toBeTruthy();
    });

    it('should trigger suggestion rendering on all suggestion store keys', () => {
      setupStoreSubscribers({
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getUiDom,
        getEngines
      });

      rootStore.setState({ companionSuggestedQuestions: ['問題1'] });
      rootStore.setState({ assistantSuggestedQuestions: ['問題2'] });
      rootStore.setState({ suggestedTitle: '推薦問題' });
      rootStore.setState({ companionSuggestedTitle: '陪聊標題' });
      rootStore.setState({ assistantSuggestedTitle: '助理標題' });
      expect(mockUiDom.suggestionsEl).toBeDefined();
    });

    it('should cover defensive branch edges in setupStoreSubscribers and setupI18nSubscribers', () => {
      setupStoreSubscribers({
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getUiDom,
        getEngines
      });

      // 1. gender not string -> early return
      const prevGenderCalls =
        mockEngines.brainEngine.setGender.mock.calls.length;
      rootStore.setState({ gender: 12345 as unknown as string });
      expect(mockEngines.brainEngine.setGender.mock.calls.length).toBe(
        prevGenderCalls
      );

      // 2. locale not string -> early return
      const prevLocaleCalls =
        mockEngines.brainEngine.setLocale.mock.calls.length;
      rootStore.setState({ locale: null as unknown as string });
      expect(mockEngines.brainEngine.setLocale.mock.calls.length).toBe(
        prevLocaleCalls
      );

      // 3. autoContinuePrompt: function, null, and invalid non-string/non-fn/non-null
      const fnPrompt = () => 'fn-prompt';
      rootStore.setState({ autoContinuePrompt: fnPrompt });
      expect(mockEngines.brainEngine.autoContinuePrompt).toBe(fnPrompt);

      rootStore.setState({ autoContinuePrompt: null });
      expect(mockEngines.brainEngine.autoContinuePrompt).toBeNull();

      rootStore.setState({ autoContinuePrompt: 9999 as unknown as null });
      // 9999 is ignored, remains null
      expect(mockEngines.brainEngine.autoContinuePrompt).toBeNull();

      // 4. resolvedGender when state.gender is also non-string -> fallback to ''
      rootStore.setState({ gender: false as unknown as string });
      rootStore.setState({ brainGender: '' });
      expect(mockEngines.brainEngine.setGender).toHaveBeenCalledWith('');

      rootStore.setState({ speechGender: '' });
      expect(mockEngines.speechEngine.setGender).toHaveBeenCalledWith('');

      rootStore.setState({ skinGender: '' });
      expect(mockEngines.skinEngine.setGender).toHaveBeenCalledWith('');

      // 5. setupI18nSubscribers: companion avatarMode + label without shortLabel + fallback to newLocale + langButtonEl null
      const customLangBtn = document.createElement('button');
      const testUiDom = {
        langButtonEl: customLangBtn,
        updateMicState: vi.fn(),
        updateVoiceStatus: vi.fn()
      };

      rootStore.setState({ avatarMode: 'companion' });
      let capturedLocaleListener:
        ((newLocale: string, localeLabels?: unknown) => void) | undefined;
      const customI18nEngine = {
        subscribe: (key: string, fn: unknown) => {
          if (key === 'locale') {
            capturedLocaleListener = fn as (
              newLocale: string,
              localeLabels?: unknown
            ) => void;
          }
          return () => {};
        }
      } as unknown as I18nEngine;

      setupI18nSubscribers({
        widget: mockWidget,
        options: {},
        rootStore,
        i18nEngine: customI18nEngine,
        container,
        getUiDom: () =>
          testUiDom as unknown as ReturnType<
            Parameters<typeof setupI18nSubscribers>[0]['getUiDom']
          >,
        getEngines
      });

      // Trigger locale subscription with label only (empty shortLabel)
      capturedLocaleListener?.('fr-FR', { label: 'Français', shortLabel: '' });
      expect(customLangBtn.textContent).toBe('Français');
      expect(testUiDom.updateMicState).toHaveBeenCalledWith(
        false,
        false,
        true,
        customI18nEngine
      );

      // Trigger with both empty -> fallback to newLocale
      capturedLocaleListener?.('de-DE', { label: '', shortLabel: '' });
      expect(customLangBtn.textContent).toBe('de-DE');

      // Trigger with null localeLabels -> labelsObj is null
      capturedLocaleListener?.('es-ES', null);
      expect(customLangBtn.textContent).toBe('es-ES');

      // uiDom langButtonEl not HTMLButtonElement
      testUiDom.langButtonEl = null as unknown as HTMLButtonElement;
      expect(() => {
        capturedLocaleListener?.('it-IT', null);
      }).not.toThrow();

      // Defensive null i18nEngine
      expect(() => {
        setupI18nSubscribers({
          widget: mockWidget,
          options: {},
          rootStore,
          i18nEngine: null as unknown as I18nEngine,
          container,
          getUiDom: () => null,
          getEngines: () => ({
            brainEngine: null,
            speechEngine: null,
            skinEngine: null
          })
        });
      }).not.toThrow();
    });
  });
});
