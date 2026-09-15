import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setupStoreSubscribers,
  setupI18nSubscribers
} from '../../../core/orchestrator/subscribers';
import { createBaseStore } from '../../../core/store';
import { initI18nEngine } from '../../../core/i18n';

describe('Orchestrator Store & i18n Subscribers', () => {
  let rootStore;
  let i18nEngine;
  let mockWidget;
  let mockUiDom;
  let mockEngines;
  let container;

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
        return rootStore.getState().suggestedQuestions;
      }
    };
  });

  const getEngines = () => mockEngines;
  const getUiDom = () => mockUiDom;

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
      rootStore.setState({ brainGender: 'female', speechGender: 'female', skinGender: 'female' });
      rootStore.setState({ gender: 'male' });
      // Should not call setGender with 'male' since sub-genders are non-null
      expect(mockEngines.brainEngine.setGender).toHaveBeenLastCalledWith('female');
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
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getUiDom: () => null,
        getEngines: () => ({ brainEngine: null, speechEngine: null, skinEngine: null })
      });

      // Triggers avatarMode without uiDom or engines
      expect(() => rootStore.setState({ avatarMode: 'companion' })).not.toThrow();

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
      expect(mockUiDom.langButtonEl.textContent).toBe('EN');
      expect(options.onLanguageChanged).toHaveBeenCalledWith('en-US', 'English (US)', 'EN');
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
        widget: mockWidget,
        options,
        rootStore,
        i18nEngine,
        container,
        getUiDom: () => customUiDom,
        getEngines: () => ({ brainEngine: null, speechEngine: null })
      });

      // Test messages subscription
      i18nEngine.addMessages('zh-TW', { hello: '你好' });

      // Test locale change with missing shortLabel
      i18nEngine.setLocale('ja-JP');
      expect(customUiDom.langButtonEl.textContent).toBeTruthy();

      // Test with null i18nEngine
      expect(() => {
        setupI18nSubscribers({
          widget: mockWidget,
          options: {},
          rootStore,
          i18nEngine: null,
          container,
          getUiDom: () => null,
          getEngines: () => ({})
        });
      }).not.toThrow();
    });
  });
});
