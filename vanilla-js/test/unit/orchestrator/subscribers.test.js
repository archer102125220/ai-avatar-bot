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
    });
  });
});
