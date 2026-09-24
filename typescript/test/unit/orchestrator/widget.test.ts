import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as uiModule from '@/core/ui';
import { createAvatarWidget } from '@/core/orchestrator/widget';
import { initAvatarBot } from '@/core/orchestrator/index';
import { createBaseStore } from '@/core/store';
import { initI18nEngine } from '@/core/i18n';
import {
  DEFAULT_LLM_MODEL,
  STATE_MAP,
  ENGINE_MODE_MAP,
  AVATAR_MODE_MAP,
  FIT_MODE_MAP,
  BRAIN_ENGINE_TYPE_MAP,
  BRAIN_FALLBACK_TYPE_MAP,
  AUTO_CONTINUE_MODE_MAP,
  LLM_FINISH_REASON_MAP,
  FINISH_REASON_MAP,
  GENDER_MAP
} from '@/core/constants';
import type {
  I18nEngine,
  BrainEngine,
  SpeechEngine,
  SkinEngine,
  ToolsEngine
} from '@core';
import type { UiDom } from '@/core/ui';
import type {
  AvatarBotStore,
  AvatarBotStoreState,
  AiAvatarWidget
} from '@/core/orchestrator/types';

describe('Avatar Widget & Top-level Bot Orchestration (Deep Branch Coverage)', () => {
  let container: HTMLElement;
  let stageEl: HTMLElement;
  let rootStore: AvatarBotStore;
  let i18nEngine: I18nEngine;
  let mockUiDom: {
    minimalEl: HTMLElement;
    [key: string]: unknown;
  };
  let mockEngines: {
    brainEngine: {
      buildLLMMessages: ReturnType<typeof vi.fn>;
      classifyEmotion: ReturnType<typeof vi.fn>;
      applyEmotionFromText: ReturnType<typeof vi.fn>;
      answerQuestion: ReturnType<typeof vi.fn>;
      memory: { enabled: boolean };
      [key: string]: unknown;
    };
    skinEngine: Record<string, unknown>;
    speechEngine: Record<string, unknown>;
    toolsEngine: Record<string, unknown>;
  };
  let mockUpdateModelDropListeners: ReturnType<
    typeof vi.fn<(enabled: boolean) => void>
  >;
  let mockHandleUser: ReturnType<
    typeof vi.fn<(text?: string) => Promise<void> | void>
  >;

  beforeEach(() => {
    container = document.createElement('div');
    stageEl = document.createElement('div');
    stageEl.id = 'stage';

    rootStore = createBaseStore<AvatarBotStoreState>({
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
      enableModelDrop: false,
      enableEngineToggle: true,
      modes: { customMode: {} },
      suggestedQuestions: ['Q1'],
      companionSuggestedQuestions: ['CQ1'],
      assistantSuggestedQuestions: ['AQ1'],
      suggestedTitle: 'Title1',
      companionSuggestedTitle: 'CTitle1',
      assistantSuggestedTitle: 'ATitle1'
    });

    i18nEngine = initI18nEngine({ locale: 'zh-TW' });

    mockUiDom = {
      stageEl,
      minimalEl: document.createElement('button'),
      engineButtonEl: document.createElement('button'),
      suggestionsEl: document.createElement('div'),
      historyPanelEl: document.createElement('section'),
      updateVoiceStatus: vi.fn(),
      updateMicState: vi.fn()
    };

    mockHandleUser = vi.fn();

    mockEngines = {
      brainEngine: {
        avatarMode: 'assistant',
        enableMemory: true,
        enableAiProvider: false,
        preloadWebLLM: false,
        autoFallbackWebLLM: true,
        enableAutoContinue: false,
        maxAutoContinuations: 3,
        autoContinueMode: 'single_turn',
        autoContinuePrompt: null,
        memory: { enabled: true },
        buildLLMMessages: vi.fn(() => [{ role: 'system', content: 'test' }]),
        classifyEmotion: vi.fn(() => 'happy'),
        applyEmotionFromText: vi.fn(),
        answerQuestion: vi.fn(),
        getWelcomeText: vi.fn(async () => 'Welcome!')
      },
      speechEngine: {
        convoOn: false,
        isListening: false,
        spokenDisplayText: '',
        speak: vi.fn(),
        setMic: vi.fn(),
        subscribe: vi.fn()
      },
      skinEngine: {
        stageEl,
        has2D: true,
        has3D: true,
        engineMode: ENGINE_MODE_MAP.twoDimensional,
        setEmotion: vi.fn(),
        setSkin2d: vi.fn(),
        setSkin3d: vi.fn(),
        setFitMode: vi.fn(),
        setIsSpeaking: vi.fn()
      },
      toolsEngine: {
        HOST_TOOLS: []
      }
    };

    mockUpdateModelDropListeners = vi.fn();
  });

  const getEngines = () =>
    mockEngines as unknown as {
      brainEngine: BrainEngine | null;
      speechEngine: SpeechEngine | null;
      skinEngine: SkinEngine | null;
      toolsEngine: ToolsEngine | null;
    };
  const getUiDom = () => mockUiDom as unknown as UiDom;

  it('should expose all constants correctly', () => {
    const widget = createAvatarWidget({
      options: {},
      container,
      rootStore,
      i18nEngine,
      initialMinimal: false,
      getUiDom,
      getEngines,
      handleUser: mockHandleUser,
      updateModelDropListeners: mockUpdateModelDropListeners
    });

    expect(widget.options).toEqual({});
    expect(widget.DEFAULT_LLM_MODEL).toBe(DEFAULT_LLM_MODEL);
    expect(widget.STATE_MAP).toBe(STATE_MAP);
    expect(widget.ENGINE_MODE_MAP).toBe(ENGINE_MODE_MAP);
    expect(widget.AVATAR_MODE_MAP).toBe(AVATAR_MODE_MAP);
    expect(widget.FIT_MODE_MAP).toBe(FIT_MODE_MAP);
    expect(widget.BRAIN_ENGINE_TYPE_MAP).toBe(BRAIN_ENGINE_TYPE_MAP);
    expect(widget.BRAIN_FALLBACK_TYPE_MAP).toBe(BRAIN_FALLBACK_TYPE_MAP);
    expect(widget.AUTO_CONTINUE_MODE_MAP).toBe(AUTO_CONTINUE_MODE_MAP);
    expect(widget.LLM_FINISH_REASON_MAP).toBe(LLM_FINISH_REASON_MAP);
    expect(widget.FINISH_REASON_MAP).toBe(FINISH_REASON_MAP);
    expect(widget.availableModes).toContain('assistant');
    expect(widget.availableModes).toContain('companion');
    expect(widget.availableModes).toContain('customMode');
  });

  it('should proxy brain engine methods (buildLLMMessages, classifyEmotion, applyEmotionFromText, answerQuestion, handleUser)', () => {
    const widget = createAvatarWidget({
      options: {},
      container,
      rootStore,
      i18nEngine,
      initialMinimal: false,
      getUiDom,
      getEngines,
      handleUser: mockHandleUser,
      updateModelDropListeners: mockUpdateModelDropListeners
    });

    expect(widget.buildLLMMessages?.()).toEqual([
      { role: 'system', content: 'test' }
    ]);
    expect(widget.classifyEmotion?.('開心')).toBe('happy');
    widget.applyEmotionFromText?.('開心');
    expect(mockEngines.brainEngine.applyEmotionFromText).toHaveBeenCalledWith(
      '開心'
    );

    widget.answerQuestion?.('問題');
    expect(mockEngines.brainEngine.answerQuestion).toHaveBeenCalledWith('問題');

    widget.handleUser('輸入');
    expect(mockHandleUser).toHaveBeenCalledWith('輸入');
  });

  it('should handle all gender and sub-gender getters and setters with edge cases', () => {
    const widget = createAvatarWidget({
      options: {},
      container,
      rootStore,
      i18nEngine,
      initialMinimal: false,
      getUiDom,
      getEngines,
      handleUser: mockHandleUser,
      updateModelDropListeners: mockUpdateModelDropListeners
    });

    // Valid gender
    widget.gender = GENDER_MAP.male;
    expect(widget.gender).toBe(GENDER_MAP.male);

    // Invalid gender ignored
    widget.gender = 'invalid_gender';
    expect(widget.gender).toBe(GENDER_MAP.male);

    // Sub-genders: null or valid
    widget.brainGender = GENDER_MAP.female;
    expect(widget.brainGender).toBe(GENDER_MAP.female);
    widget.brainGender = null;
    expect(widget.brainGender).toBeNull();
    widget.brainGender = 'invalid';
    expect(widget.brainGender).toBeNull();

    widget.speechGender = GENDER_MAP.male;
    expect(widget.speechGender).toBe(GENDER_MAP.male);
    widget.speechGender = null;
    expect(widget.speechGender).toBeNull();
    widget.speechGender = 'invalid';
    expect(widget.speechGender).toBeNull();

    widget.skinGender = GENDER_MAP.female;
    expect(widget.skinGender).toBe(GENDER_MAP.female);
    widget.skinGender = null;
    expect(widget.skinGender).toBeNull();
    widget.skinGender = 'invalid';
    expect(widget.skinGender).toBeNull();
  });

  it('should handle locale getter and setter with i18nEngine fallback', () => {
    const widget = createAvatarWidget({
      options: {},
      container,
      rootStore,
      i18nEngine,
      initialMinimal: false,
      getUiDom,
      getEngines,
      handleUser: mockHandleUser,
      updateModelDropListeners: mockUpdateModelDropListeners
    });

    widget.locale = 'en-US';
    expect(widget.locale).toBe('en-US');

    // Invalid string ignored
    widget.locale = '';
    expect(widget.locale).toBe('en-US');

    // Fallback when i18nEngine is null
    const widgetNoI18n = createAvatarWidget({
      options: {},
      container,
      rootStore,
      i18nEngine: null as unknown as I18nEngine,
      initialMinimal: false,
      getUiDom,
      getEngines,
      handleUser: mockHandleUser,
      updateModelDropListeners: mockUpdateModelDropListeners
    });
    widgetNoI18n.locale = 'ja-JP';
    expect(widgetNoI18n.locale).toBe('ja-JP');
  });

  it('should handle all feature flags and configurations (memory, aiProvider, webLLM, autoContinue, modelDrop, engineToggle)', () => {
    const widget = createAvatarWidget({
      options: {},
      container,
      rootStore,
      i18nEngine,
      initialMinimal: false,
      getUiDom,
      getEngines,
      handleUser: mockHandleUser,
      updateModelDropListeners: mockUpdateModelDropListeners
    });

    // enableMemory
    widget.enableMemory = false;
    expect(widget.enableMemory).toBe(false);
    expect(mockEngines.brainEngine.memory.enabled).toBe(false);
    widget.enableMemory = 'not_boolean' as unknown as boolean; // ignored
    expect(widget.enableMemory).toBe(false);

    // enableAiProvider
    widget.enableAiProvider = true;
    expect(widget.enableAiProvider).toBe(true);
    expect(mockEngines.brainEngine.enableAiProvider).toBe(true);
    widget.enableAiProvider = 123 as unknown as boolean; // ignored
    expect(widget.enableAiProvider).toBe(true);

    // preloadWebLLM
    widget.preloadWebLLM = true;
    expect(widget.preloadWebLLM).toBe(true);
    expect(mockEngines.brainEngine.preloadWebLLM).toBe(true);

    // autoFallbackWebLLM
    widget.autoFallbackWebLLM = false;
    expect(widget.autoFallbackWebLLM).toBe(false);
    expect(mockEngines.brainEngine.autoFallbackWebLLM).toBe(false);

    // enableAutoContinue
    widget.enableAutoContinue = true;
    expect(widget.enableAutoContinue).toBe(true);
    expect(mockEngines.brainEngine.enableAutoContinue).toBe(true);

    // maxAutoContinuations
    widget.maxAutoContinuations = 5;
    expect(widget.maxAutoContinuations).toBe(5);
    expect(mockEngines.brainEngine.maxAutoContinuations).toBe(5);
    widget.maxAutoContinuations = -1; // invalid, ignored
    expect(widget.maxAutoContinuations).toBe(5);

    // autoContinueMode
    widget.autoContinueMode = AUTO_CONTINUE_MODE_MAP.BUFFERED as 'buffered';
    expect(widget.autoContinueMode).toBe(AUTO_CONTINUE_MODE_MAP.BUFFERED);
    expect(mockEngines.brainEngine.autoContinueMode).toBe(
      AUTO_CONTINUE_MODE_MAP.BUFFERED
    );
    widget.autoContinueMode = 'invalid_mode'; // ignored
    expect(widget.autoContinueMode).toBe(AUTO_CONTINUE_MODE_MAP.BUFFERED);

    // autoContinuePrompt
    const customPromptFn = () => 'prompt';
    widget.autoContinuePrompt = customPromptFn;
    expect(widget.autoContinuePrompt).toBe(customPromptFn);
    expect(mockEngines.brainEngine.autoContinuePrompt).toBe(customPromptFn);
    widget.autoContinuePrompt = 'string prompt';
    expect(widget.autoContinuePrompt).toBe('string prompt');
    widget.autoContinuePrompt = null;
    expect(widget.autoContinuePrompt).toBeNull();
    widget.autoContinuePrompt = 12345 as unknown as string; // ignored
    expect(widget.autoContinuePrompt).toBeNull();

    // enableModelDrop
    widget.enableModelDrop = true;
    expect(widget.enableModelDrop).toBe(true);
    expect(mockUpdateModelDropListeners).toHaveBeenCalledWith(true);

    // enableEngineToggle
    widget.enableEngineToggle = false;
    expect(widget.enableEngineToggle).toBe(false);
  });

  it('should handle all suggestion getters and setters and batch setSuggestedQuestions', () => {
    const widget = createAvatarWidget({
      options: {},
      container,
      rootStore,
      i18nEngine,
      initialMinimal: false,
      getUiDom,
      getEngines,
      handleUser: mockHandleUser,
      updateModelDropListeners: mockUpdateModelDropListeners
    });

    expect(widget.suggestedQuestions).toEqual(['Q1']);
    widget.suggestedQuestions = ['NewQ'];
    expect(widget.suggestedQuestions).toEqual(['NewQ']);

    expect(widget.companionSuggestedQuestions).toEqual(['CQ1']);
    widget.companionSuggestedQuestions = ['NewCQ'];
    expect(widget.companionSuggestedQuestions).toEqual(['NewCQ']);

    expect(widget.assistantSuggestedQuestions).toEqual(['AQ1']);
    widget.assistantSuggestedQuestions = ['NewAQ'];
    expect(widget.assistantSuggestedQuestions).toEqual(['NewAQ']);

    expect(widget.suggestedTitle).toBe('Title1');
    widget.suggestedTitle = 'NewTitle';
    expect(widget.suggestedTitle).toBe('NewTitle');

    expect(widget.companionSuggestedTitle).toBe('CTitle1');
    widget.companionSuggestedTitle = 'NewCTitle';
    expect(widget.companionSuggestedTitle).toBe('NewCTitle');

    expect(widget.assistantSuggestedTitle).toBe('ATitle1');
    widget.assistantSuggestedTitle = 'NewATitle';
    expect(widget.assistantSuggestedTitle).toBe('NewATitle');

    widget.setSuggestedQuestions(['BatchQ'], 'BatchTitle');
    expect(widget.suggestedQuestions).toEqual(['BatchQ']);
    expect(widget.suggestedTitle).toBe('BatchTitle');

    widget.renderSuggestions();

    // Widget skin delegation methods
    widget.setSkin2d({ zoom: 1.2 });
    expect(mockEngines.skinEngine.setSkin2d).toHaveBeenCalledWith({
      zoom: 1.2
    });

    widget.setSkin3d({ camera: { fov: 30 } });
    expect(mockEngines.skinEngine.setSkin3d).toHaveBeenCalledWith({
      camera: { fov: 30 }
    });

    widget.setFitMode(FIT_MODE_MAP.HALF);
    expect(mockEngines.skinEngine.setFitMode).toHaveBeenCalledWith(
      FIT_MODE_MAP.HALF
    );

    // Engine getters
    expect(widget.brainEngine).toBe(mockEngines.brainEngine);
    expect(widget.speechEngine).toBe(mockEngines.speechEngine);
    expect(widget.skinEngine).toBe(mockEngines.skinEngine);

    // Minimal element display methods
    widget.showMinimalEl();
    expect(mockUiDom.minimalEl.style.display).toBe('flex');

    widget.hiddenMinimalEl();
    expect(mockUiDom.minimalEl.style.display).toBe('none');

    // enableEngineToggle
    widget.enableEngineToggle = false;
    expect(rootStore.getState().enableEngineToggle).toBe(false);

    // Test gender setters with valid and invalid values
    widget.gender = 'invalid_gender';
    expect(widget.gender).toBe('female');
    widget.gender = 'male';
    expect(widget.gender).toBe('male');

    widget.brainGender = 'invalid_gender';
    expect(widget.brainGender).toBeNull();
    widget.brainGender = 'female';
    expect(widget.brainGender).toBe('female');

    widget.speechGender = 'invalid_gender';
    expect(widget.speechGender).toBeNull();
    widget.speechGender = 'male';
    expect(widget.speechGender).toBe('male');

    widget.skinGender = 'invalid_gender';
    expect(widget.skinGender).toBeNull();
    widget.skinGender = 'female';
    expect(widget.skinGender).toBe('female');

    // Test maxAutoContinuations and autoContinueMode
    widget.maxAutoContinuations = 5;
    expect(widget.maxAutoContinuations).toBe(5);
    widget.maxAutoContinuations = -2;
    expect(widget.maxAutoContinuations).toBe(5);

    widget.autoContinueMode = AUTO_CONTINUE_MODE_MAP.BUFFERED as 'buffered';
    expect(widget.autoContinueMode).toBe(AUTO_CONTINUE_MODE_MAP.BUFFERED);
    widget.autoContinueMode = 'invalid_mode';
    expect(widget.autoContinueMode).toBe(AUTO_CONTINUE_MODE_MAP.BUFFERED);

    widget.autoContinuePrompt = '請繼續';
    expect(widget.autoContinuePrompt).toBe('請繼續');
    widget.autoContinuePrompt = () => '函式提示';
    expect(typeof widget.autoContinuePrompt).toBe('function');
    widget.autoContinuePrompt = null;
    expect(widget.autoContinuePrompt).toBeNull();

    // Test enableModelDrop
    widget.enableModelDrop = true;
    expect(widget.enableModelDrop).toBe(true);
    expect(mockUpdateModelDropListeners).toHaveBeenCalledWith(true);

    // Test setSuggestedQuestions partial updates
    widget.setSuggestedQuestions(['OnlyQ']);
    expect(widget.suggestedQuestions).toEqual(['OnlyQ']);
    widget.setSuggestedQuestions(undefined, 'OnlyTitle');
    expect(widget.suggestedTitle).toBe('OnlyTitle');
  });

  it('should handle initAvatarBot with standard non-iframe mode, onReady, and model drop enabled', async () => {
    const onReady = vi.fn();
    const botContainer = document.createElement('div');
    document.body.appendChild(botContainer);

    const bot = await initAvatarBot({
      container: botContainer,
      isIframe: false,
      isMinimal: false,
      enableModelDrop: true,
      onReady
    });

    expect(bot).toBeDefined();
    expect(bot?.isIframe).toBe(false);
    expect(bot?.isMinimal).toBe(false);
    expect(typeof bot?.onReady).toBe('function');
    bot?.onReady?.(bot as unknown as AiAvatarWidget);
    expect(onReady).toHaveBeenCalled();
  });

  it('should handle iframe minimal mode edge cases and non-window environment', async () => {
    const onMinimalTrigger = vi.fn();
    const botContainer = document.createElement('div');
    document.body.appendChild(botContainer);

    const bot = await initAvatarBot({
      container: botContainer,
      isIframe: true,
      isMinimal: true,
      onMinimalTrigger
    });

    expect(bot).toBeDefined();
    expect(bot?.isIframe).toBe(true);
    expect(onMinimalTrigger).toHaveBeenCalledWith(true, bot);

    // Non-iframe minimal mode
    const botMinimal = await initAvatarBot({
      container: document.createElement('div'),
      isIframe: false,
      isMinimal: true
    });
    expect(botMinimal?.isMinimal).toBe(true);

    // SpeechEngine isSpeaking event syncs to skinEngine.setIsSpeaking
    if (typeof botMinimal?.speechEngine?.subscribe === 'function') {
      botMinimal.speechEngine.speak('說話同步測試');
    }
  });

  it('should handle widget isMinimal property setter with onMinimalTrigger callback', () => {
    const onMinimalTrigger = vi.fn();
    const widget = createAvatarWidget({
      options: {},
      container,
      rootStore,
      i18nEngine,
      initialMinimal: false,
      getUiDom,
      getEngines,
      handleUser: mockHandleUser,
      updateModelDropListeners: mockUpdateModelDropListeners
    });

    widget.onMinimalTrigger = onMinimalTrigger;
    expect(widget.isMinimal).toBe(false);

    // Switch to minimal = true
    widget.isMinimal = true;
    expect(widget.isMinimal).toBe(true);
    expect(onMinimalTrigger).toHaveBeenCalledWith(true, widget);
    expect(mockUiDom.minimalEl.style.display).toBe('flex');

    // Switch to minimal = false
    widget.isMinimal = false;
    expect(widget.isMinimal).toBe(false);
    expect(onMinimalTrigger).toHaveBeenCalledWith(false, widget);
    expect(mockUiDom.minimalEl.style.display).toBe('none');

    // Setting non-boolean should be ignored
    widget.isMinimal = 'not-a-bool' as unknown as boolean;
    expect(widget.isMinimal).toBe(false);
  });

  it('should throw TypeError when setting invalid avatarMode', () => {
    const widget = createAvatarWidget({
      options: {},
      container,
      rootStore,
      i18nEngine,
      initialMinimal: false,
      getUiDom,
      getEngines,
      handleUser: mockHandleUser,
      updateModelDropListeners: mockUpdateModelDropListeners
    });

    expect(() => {
      widget.avatarMode =
        'non_existent_mode' as unknown as typeof widget.avatarMode;
    }).toThrow(TypeError);
  });

  it('should fallback gracefully when brainEngine is null or missing specific properties', () => {
    const emptyEngines = {
      brainEngine: null,
      speechEngine: null,
      skinEngine: null,
      toolsEngine: null
    };

    const widget = createAvatarWidget({
      options: { isIframe: true },
      container,
      rootStore,
      i18nEngine: null as unknown as I18nEngine,
      initialMinimal: false,
      getUiDom: () =>
        null as unknown as ReturnType<
          Parameters<typeof createAvatarWidget>[0]['getUiDom']
        >,
      getEngines: () =>
        emptyEngines as unknown as ReturnType<
          Parameters<typeof createAvatarWidget>[0]['getEngines']
        >,
      handleUser: mockHandleUser
    });

    expect(widget.container).toBe(container);
    expect(widget.uiDom).toBeNull();
    expect(widget.toolsEngine).toBeNull();
    expect(widget.buildLLMMessages).toBeUndefined();
    expect(widget.classifyEmotion).toBeUndefined();
    expect(widget.applyEmotionFromText).toBeUndefined();
    expect(widget.answerQuestion).toBeUndefined();
    expect(widget.isIframe).toBe(true);

    // Default brain getters falling back to store / constants
    expect(typeof widget.enableMemory).toBe('boolean');
    expect(typeof widget.enableAiProvider).toBe('boolean');
    expect(typeof widget.preloadWebLLM).toBe('boolean');
    expect(typeof widget.autoFallbackWebLLM).toBe('boolean');
    expect(typeof widget.enableAutoContinue).toBe('boolean');
    expect(typeof widget.maxAutoContinuations).toBe('number');
    expect(typeof widget.autoContinueMode).toBe('string');
    expect(widget.autoContinuePrompt).toBeNull();

    // Setters when brainEngine is null
    widget.enableMemory = false;
    expect(widget.enableMemory).toBe(false);
    widget.enableAiProvider = true;
    expect(widget.enableAiProvider).toBe(true);
    widget.preloadWebLLM = true;
    expect(widget.preloadWebLLM).toBe(true);
    widget.autoFallbackWebLLM = false;
    expect(widget.autoFallbackWebLLM).toBe(false);
    widget.enableAutoContinue = true;
    expect(widget.enableAutoContinue).toBe(true);
    widget.maxAutoContinuations = 10;
    expect(widget.maxAutoContinuations).toBe(10);
    widget.autoContinueMode = AUTO_CONTINUE_MODE_MAP.STREAM as 'stream';
    expect(widget.autoContinueMode).toBe(AUTO_CONTINUE_MODE_MAP.STREAM);
    widget.autoContinuePrompt = 'Custom prompt';
    expect(widget.autoContinuePrompt).toBe('Custom prompt');

    // showMinimalEl and hiddenMinimalEl when skinEngine / uiDom are null
    expect(() => widget.showMinimalEl()).not.toThrow();
    expect(() => widget.hiddenMinimalEl()).not.toThrow();
  });

  it('should fallback to buildDefaultLLMMessages when buildLLMMessages is not defined on brain', () => {
    const buildDefaultLLMMessagesMock = vi.fn(() => [
      { role: 'system', content: 'default' }
    ]);
    const customEngines = {
      brainEngine: {
        buildDefaultLLMMessages: buildDefaultLLMMessagesMock
      },
      speechEngine: null,
      skinEngine: null,
      toolsEngine: { HOST_TOOLS: [] }
    };

    const widget = createAvatarWidget({
      options: {},
      container,
      rootStore,
      i18nEngine,
      initialMinimal: false,
      getUiDom,
      getEngines: () =>
        customEngines as unknown as ReturnType<
          Parameters<typeof createAvatarWidget>[0]['getEngines']
        >,
      handleUser: mockHandleUser
    });

    expect(widget.toolsEngine).toEqual({ HOST_TOOLS: [] });
    expect(widget.buildLLMMessages?.()).toEqual([
      { role: 'system', content: 'default' }
    ]);
  });

  it('should initialize full bot via initAvatarBot and wire isSpeaking subscriber', async () => {
    const stage = document.createElement('div');
    document.body.appendChild(container);
    document.body.appendChild(stage);

    const botWidget = await initAvatarBot({
      container,
      modelUrl: 'https://models.test/avatar.model3.json',
      welcomeText: 'Hello from Bot!',
      onReady: vi.fn()
    });

    expect(botWidget).toBeDefined();
    expect(botWidget?.container).toBe(container);

    // Test speechEngine isSpeaking subscription trigger
    if (typeof botWidget?.speechEngine?.subscribe === 'function') {
      // Simulate isSpeaking change
      botWidget.speechEngine.speak('測試語音播報');
    }
  });

  it('should handle iframe mode with onMinimalTrigger and enableModelDrop in initAvatarBot', async () => {
    const onMinimalTrigger = vi.fn();
    const botIframe = await initAvatarBot({
      container,
      isIframe: true,
      isMinimal: true,
      enableModelDrop: true,
      onMinimalTrigger
    });

    expect(botIframe).toBeDefined();
    expect(botIframe?.isIframe).toBe(true);
    expect(onMinimalTrigger).toHaveBeenCalledWith(true, botIframe);

    // Exercise getSkinEngine via drop event (line 113)
    const dropEvent = new Event('drop');
    container.dispatchEvent(dropEvent);

    // Test window undefined guard
    const origWindow = global.window;
    delete (globalThis as unknown as Record<string, unknown>).window;
    const noWindowRes = await initAvatarBot(
      {} as Parameters<typeof initAvatarBot>[0]
    );
    expect(noWindowRes).toBeUndefined();
    global.window = origWindow;
  });

  it('should test initAvatarBot with custom onReady, non-iframe isMinimal, and i18n label fallbacks', async () => {
    const onReady = vi.fn();
    const onMinimalTrigger = vi.fn();

    const bot = await initAvatarBot({
      container,
      isIframe: false,
      isMinimal: false,
      onReady,
      onMinimalTrigger,
      locale: 'zh-TW'
    });

    expect(bot).toBeDefined();
    expect(bot?.isMinimal).toBe(false);
    expect(bot?.onReady).toBeDefined();
    expect(bot?.onMinimalTrigger).toBeDefined();
    bot?.onReady?.(bot);
    expect(onReady).toHaveBeenCalled();
  });

  it('should throw error when initUi fails to initialize UI DOM in initAvatarBot', async () => {
    const initUiSpy = vi
      .spyOn(uiModule, 'initUi')
      .mockReturnValueOnce(null as unknown as UiDom);
    await expect(initAvatarBot({ container })).rejects.toThrow(
      '[aiAvatarBot] Failed to initialize UI DOM'
    );
    initUiSpy.mockRestore();
  });

  it('should forward speechEngine isSpeaking changes to skinEngine.setIsSpeaking', async () => {
    const bot = await initAvatarBot({ container });
    expect(bot).toBeDefined();
    const speechEngine = bot?.speechEngine;
    const skinEngine = bot?.skinEngine;
    expect(speechEngine).toBeDefined();
    expect(skinEngine).toBeDefined();

    if (speechEngine && skinEngine) {
      const setIsSpeakingSpy = vi.spyOn(skinEngine, 'setIsSpeaking');
      speechEngine.setState({ isSpeaking: true });
      expect(setIsSpeakingSpy).toHaveBeenCalledWith(true);
      speechEngine.setState({ isSpeaking: false });
      expect(setIsSpeakingSpy).toHaveBeenCalledWith(false);
      setIsSpeakingSpy.mockRestore();
    }
  });

  it('should handle i18n label fallbacks in initAvatarBot', async () => {
    const customI18n = initI18nEngine({ locale: 'zh-TW' });
    if (customI18n.labels) {
      customI18n.labels.shortLabel = '';
      customI18n.labels.label = '繁體中文';
    }
    const bot1 = await initAvatarBot({
      container,
      customEngines: { i18n: customI18n }
    });
    expect(bot1?.uiDom.langButtonEl.textContent).toBe('繁體中文');

    if (customI18n.labels) {
      customI18n.labels.shortLabel = '';
      customI18n.labels.label = '';
    }
    const bot2 = await initAvatarBot({
      container,
      customEngines: { i18n: customI18n }
    });
    expect(bot2?.uiDom.langButtonEl.textContent).toBe('中文');
  });
});
