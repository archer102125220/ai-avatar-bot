import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAvatarWidget } from '../../../core/orchestrator/widget';
import { initAvatarBot } from '../../../core/orchestrator/index';
import { createBaseStore } from '../../../core/store';
import { initI18nEngine } from '../../../core/i18n';
import {
  AVATAR_MODE_MAP,
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  GENDER_MAP
} from '../../../core/constants';

describe('Avatar Widget & Top-level Bot Orchestration', () => {
  let container;
  let stageEl;
  let rootStore;
  let i18nEngine;
  let mockUiDom;
  let mockEngines;
  let mockUpdateModelDropListeners;

  beforeEach(() => {
    container = document.createElement('div');
    stageEl = document.createElement('div');
    stageEl.id = 'stage';

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
      enableModelDrop: false,
      enableEngineToggle: true,
      modes: {}
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
        buildLLMMessages: vi.fn(),
        classifyEmotion: vi.fn(),
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

  const getEngines = () => mockEngines;
  const getUiDom = () => mockUiDom;

  describe('createAvatarWidget', () => {
    it('should expose all required constant maps and engine getters', () => {
      const widget = createAvatarWidget({
        options: {},
        container,
        rootStore,
        i18nEngine,
        initialMinimal: false,
        getUiDom,
        getEngines,
        handleUser: vi.fn(),
        updateModelDropListeners: mockUpdateModelDropListeners
      });

      expect(widget.container).toBe(container);
      expect(widget.uiDom).toBe(mockUiDom);
      expect(widget.i18nEngine).toBe(i18nEngine);
      expect(widget.brainEngine).toBe(mockEngines.brainEngine);
      expect(widget.speechEngine).toBe(mockEngines.speechEngine);
      expect(widget.skinEngine).toBe(mockEngines.skinEngine);
      expect(widget.toolsEngine).toBe(mockEngines.toolsEngine);

      expect(widget.ENGINE_MODE_MAP).toBe(ENGINE_MODE_MAP);
      expect(widget.AVATAR_MODE_MAP).toBe(AVATAR_MODE_MAP);
      expect(widget.FIT_MODE_MAP).toBe(FIT_MODE_MAP);
    });

    it('should manage minimal mode toggle and element styles', () => {
      const widget = createAvatarWidget({
        options: {},
        container,
        rootStore,
        i18nEngine,
        initialMinimal: false,
        getUiDom,
        getEngines,
        handleUser: vi.fn(),
        updateModelDropListeners: mockUpdateModelDropListeners
      });

      widget.onMinimalTrigger = vi.fn();

      widget.isMinimal = true;
      expect(widget.isMinimal).toBe(true);
      expect(widget.onMinimalTrigger).toHaveBeenCalledWith(true, widget);
      expect(stageEl.style.opacity).toBe('0');
      expect(mockUiDom.minimalEl.style.display).toBe('flex');

      widget.isMinimal = false;
      expect(widget.isMinimal).toBe(false);
      expect(widget.onMinimalTrigger).toHaveBeenCalledWith(false, widget);
      expect(stageEl.style.opacity).toBe('1');
      expect(mockUiDom.minimalEl.style.display).toBe('none');
    });

    it('should validate and synchronize avatarMode', () => {
      const widget = createAvatarWidget({
        options: {},
        container,
        rootStore,
        i18nEngine,
        initialMinimal: false,
        getUiDom,
        getEngines,
        handleUser: vi.fn(),
        updateModelDropListeners: mockUpdateModelDropListeners
      });

      widget.avatarMode = AVATAR_MODE_MAP.companion;
      expect(widget.avatarMode).toBe(AVATAR_MODE_MAP.companion);
      expect(rootStore.getState().avatarMode).toBe(AVATAR_MODE_MAP.companion);

      expect(() => {
        widget.avatarMode = 'invalid_avatar_mode';
      }).toThrowError(/Invalid avatarMode/);
    });

    it('should synchronize state properties and trigger sub-listeners', () => {
      const widget = createAvatarWidget({
        options: {},
        container,
        rootStore,
        i18nEngine,
        initialMinimal: false,
        getUiDom,
        getEngines,
        handleUser: vi.fn(),
        updateModelDropListeners: mockUpdateModelDropListeners
      });

      widget.gender = GENDER_MAP.male;
      expect(widget.gender).toBe(GENDER_MAP.male);

      widget.enableMemory = false;
      expect(widget.enableMemory).toBe(false);

      widget.enableAiProvider = true;
      expect(widget.enableAiProvider).toBe(true);

      widget.enableModelDrop = true;
      expect(mockUpdateModelDropListeners).toHaveBeenCalledWith(true);

      widget.setSkin2d({ zoom: 1.2 });
      expect(mockEngines.skinEngine.setSkin2d).toHaveBeenCalledWith({ zoom: 1.2 });

      widget.setSkin3d({ camera: { fov: 45 } });
      expect(mockEngines.skinEngine.setSkin3d).toHaveBeenCalledWith({ camera: { fov: 45 } });

      widget.setFitMode(FIT_MODE_MAP.HALF);
      expect(mockEngines.skinEngine.setFitMode).toHaveBeenCalledWith(FIT_MODE_MAP.HALF);
    });
  });

  describe('initAvatarBot (top-level integration)', () => {
    it('should instantiate complete bot in container and return functional widget', async () => {
      const onReady = vi.fn();
      const botContainer = document.createElement('div');
      document.body.appendChild(botContainer);

      const bot = await initAvatarBot({
        container: botContainer,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onReady
      });

      expect(bot).toBeDefined();
      expect(bot.container).toBe(botContainer);
      expect(bot.brainEngine).toBeDefined();
      expect(bot.speechEngine).toBeDefined();
      expect(bot.skinEngine).toBeDefined();
      expect(bot.toolsEngine).toBeDefined();
      expect(bot.uiDom).toBeDefined();

      expect(typeof bot.handleUser).toBe('function');
      expect(botContainer.querySelector('#stage')).toBeDefined();
      expect(botContainer.querySelector('#control-bar')).toBeDefined();
    });
  });
});
