import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setupBrainEngine,
  setupSpeechEngine,
  setupToolsEngine,
  setupSkinEngine
} from '../../../core/orchestrator/engine-factory';
import { createBaseStore } from '../../../core/store';
import { initI18nEngine } from '../../../core/i18n';
import { ENGINE_MODE_MAP, DEFAULT_EMOTION_TOOL_NAME } from '../../../core/constants';

describe('Orchestrator Engine Factory', () => {
  let rootStore;
  let i18nEngine;
  let mockWidget;
  let mockUiDom;
  let mockEngines;
  let mockStreamPipeline;

  beforeEach(() => {
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
      enableEngineToggle: true
    });

    i18nEngine = initI18nEngine({ locale: 'zh-TW' });

    mockWidget = {
      name: 'MockWidget',
      onReady: vi.fn(),
      onError: vi.fn()
    };

    mockUiDom = {
      btnLlmEl: document.createElement('button'),
      bubbleEl: document.createElement('p'),
      historyPanelEl: document.createElement('section'),
      directWarnEl: document.createElement('p'),
      engineButtonEl: document.createElement('button'),
      langButtonEl: document.createElement('button'),
      updateMicState: vi.fn(),
      updateVoiceStatus: vi.fn()
    };

    mockStreamPipeline = {
      onStreamStart: vi.fn(),
      onStreamChunk: vi.fn(),
      onStreamEnd: vi.fn(),
      onAutoContinueStart: vi.fn(),
      onAutoContinueWait: vi.fn(),
      onAutoContinueResume: vi.fn(),
      onAutoContinueEnd: vi.fn(),
      onInterrupt: vi.fn(),
      onSpeechWait: vi.fn()
    };

    mockEngines = {
      brainEngine: null,
      speechEngine: {
        spokenDisplayText: '',
        spokenAudioText: '',
        speak: vi.fn(),
        computeMouth: vi.fn(() => 0.4),
        triggerTap: vi.fn()
      },
      skinEngine: {
        setEmotion: vi.fn(),
        setIsSpeaking: vi.fn(),
        has2D: true,
        has3D: true,
        engineMode: ENGINE_MODE_MAP.twoDimensional,
        avatarModel: { on: vi.fn() },
        renderer: { canvas: document.createElement('canvas'), playGesture: vi.fn() }
      },
      toolsEngine: {
        getAiAvailableTools: vi.fn(() => []),
        HOST_TOOLS: [{ name: 'test_tool', execute: vi.fn() }],
        executeToolDirectly: vi.fn(async (tool, args) => ({ result: 'ok', tool, args })),
        offerHostTool: vi.fn()
      }
    };
  });

  const getEngines = () => mockEngines;
  const getUiDom = () => mockUiDom;

  describe('setupBrainEngine', () => {
    it('should create default brain engine with resolved options', async () => {
      const brainEngine = await setupBrainEngine({
        options: { llmMaxTokens: 256 },
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getEngines,
        getUiDom,
        streamPipeline: mockStreamPipeline
      });

      expect(brainEngine).toBeDefined();
      expect(brainEngine.llm?.maxTokens).toBe(256);
      expect(typeof brainEngine.answerQuestion).toBe('function');
    });

    it('should accept valid custom brain engine', async () => {
      const customBrain = {
        name: 'CustomBrain',
        addChatMessage: vi.fn(),
        updateChatMessage: vi.fn(),
        answerQuestion: vi.fn(),
        getWelcomeText: vi.fn(async () => 'Welcome!'),
        buildLLMMessages: vi.fn(),
        classifyEmotion: vi.fn(),
        applyEmotionFromText: vi.fn(),
        memory: {},
        llm: {},
        aiProvider: {},
        chatLog: [],
        chatSeq: 0
      };

      const brainEngine = await setupBrainEngine({
        options: {
          customEngines: { brain: customBrain }
        },
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getEngines,
        getUiDom,
        streamPipeline: mockStreamPipeline
      });

      expect(brainEngine).toBe(customBrain);
    });

    it('should fallback to default brain engine if custom engine fails validation', async () => {
      const invalidBrain = {
        name: 'InvalidBrain' // missing required methods & props
      };

      const brainEngine = await setupBrainEngine({
        options: {
          customEngines: { brain: invalidBrain }
        },
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getEngines,
        getUiDom,
        streamPipeline: mockStreamPipeline
      });

      expect(brainEngine).not.toBe(invalidBrain);
      expect(typeof brainEngine.answerQuestion).toBe('function');
    });

    it('should route tools execution through getTools and executeTool in brainOptions', async () => {
      let capturedBrainOptions;
      const customBrainFactory = vi.fn(async (opts) => {
        capturedBrainOptions = opts;
        return {
          addChatMessage: vi.fn(),
          updateChatMessage: vi.fn(),
          answerQuestion: vi.fn(),
          getWelcomeText: vi.fn(),
          buildLLMMessages: vi.fn(),
          classifyEmotion: vi.fn(),
          applyEmotionFromText: vi.fn(),
          memory: {},
          llm: {},
          aiProvider: {},
          chatLog: [],
          chatSeq: 0
        };
      });

      await setupBrainEngine({
        options: {
          customEngines: { brain: customBrainFactory }
        },
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getEngines,
        getUiDom,
        streamPipeline: mockStreamPipeline
      });

      expect(capturedBrainOptions.getTools()).toEqual([]);
      expect(capturedBrainOptions.getToolByName('test_tool')).toBe(mockEngines.toolsEngine.HOST_TOOLS[0]);

      const execResult = await capturedBrainOptions.executeTool('test_tool', { foo: 'bar' });
      expect(execResult).toEqual({
        result: 'ok',
        tool: 'test_tool',
        args: { foo: 'bar' }
      });
      expect(mockEngines.toolsEngine.executeToolDirectly).toHaveBeenCalled();
    });

    it('should trigger UI and speech updates on LLM lifecycle callbacks', async () => {
      let capturedBrainOptions;
      const customBrainFactory = vi.fn(async (opts) => {
        capturedBrainOptions = opts;
        return {
          addChatMessage: vi.fn(),
          updateChatMessage: vi.fn(),
          answerQuestion: vi.fn(),
          getWelcomeText: vi.fn(),
          buildLLMMessages: vi.fn(),
          classifyEmotion: vi.fn(),
          applyEmotionFromText: vi.fn(),
          memory: {},
          llm: {},
          aiProvider: {},
          chatLog: [],
          chatSeq: 0
        };
      });

      await setupBrainEngine({
        options: {
          customEngines: { brain: customBrainFactory }
        },
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getEngines,
        getUiDom,
        streamPipeline: mockStreamPipeline
      });

      // test onLlmLoading
      capturedBrainOptions.onLlmLoading();
      expect(mockEngines.speechEngine.spokenDisplayText).toContain('開始下載');

      // test onLlmLoadProgress
      capturedBrainOptions.onLlmLoadProgress({ progress: 0.5 });
      expect(mockUiDom.btnLlmEl.textContent).toBe('🧠 50%');

      // test onLlmLoaded
      capturedBrainOptions.onLlmLoaded();
      expect(mockUiDom.btnLlmEl.textContent).toBe('🧠✓');
      expect(mockUiDom.btnLlmEl.getAttribute('css-llm-on')).toBe('true');

      // test onEmotionChange
      capturedBrainOptions.onEmotionChange('happy');
      expect(mockEngines.skinEngine.setEmotion).toHaveBeenCalledWith('happy');
    });
  });

  describe('setupSpeechEngine', () => {
    it('should initialize default speech engine and forward voice/mic status', async () => {
      const handleUser = vi.fn();
      const onTapAvatar = vi.fn();
      const container = document.createElement('div');

      const speechEngine = await setupSpeechEngine({
        options: {},
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getEngines,
        getUiDom,
        handleUser,
        onTapAvatar,
        streamPipeline: mockStreamPipeline,
        container,
        safeNeuralVoice: 'zh-TW-HsiaoChenNeural'
      });

      expect(speechEngine).toBeDefined();
      expect(typeof speechEngine.speak).toBe('function');
      expect(typeof speechEngine.startListening).toBe('function');
    });
  });

  describe('setupToolsEngine', () => {
    it('should create default tools engine and merge emotion tools if enabled', () => {
      const toolsEngine = setupToolsEngine({
        options: {
          tools: [{ name: 'custom_search', description: 'search' }],
          enableEmotionTools: true
        },
        widget: mockWidget,
        getEngines,
        getUiDom
      });

      expect(toolsEngine).toBeDefined();
      expect(Array.isArray(toolsEngine.HOST_TOOLS)).toBe(true);
      const toolNames = toolsEngine.HOST_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('custom_search');
      expect(toolNames).toContain(DEFAULT_EMOTION_TOOL_NAME);
    });

    it('should accept custom tools engine if valid', () => {
      const customTools = {
        name: 'CustomTools',
        HOST_TOOLS: [],
        routeHostTool: vi.fn(),
        prepareTool: vi.fn(),
        continueToolInput: vi.fn(),
        offerToolChoices: vi.fn(),
        continueToolChoice: vi.fn(),
        chooseTool: vi.fn(),
        offerHostTool: vi.fn(),
        executePendingTool: vi.fn(),
        cancelPendingTool: vi.fn(),
        continueToolConfirmation: vi.fn(),
        handleToolResult: vi.fn()
      };

      const toolsEngine = setupToolsEngine({
        options: {
          customEngines: { tools: customTools }
        },
        widget: mockWidget,
        getEngines,
        getUiDom
      });

      expect(toolsEngine).toBe(customTools);
    });
  });

  describe('setupSkinEngine', () => {
    it('should initialize default skin engine and bind lifecycle hooks', async () => {
      const stageEl = document.createElement('div');
      const skinEngine = await setupSkinEngine({
        options: {
          startMode: ENGINE_MODE_MAP.twoDimensional
        },
        widget: mockWidget,
        rootStore,
        getEngines,
        getUiDom,
        stageEl
      });

      expect(skinEngine).toBeDefined();
      expect(typeof skinEngine.setEmotion).toBe('function');
    });

    it('should accept custom skin engine if valid', async () => {
      const stageEl = document.createElement('div');
      const customSkin = {
        name: 'CustomSkin',
        has2D: true,
        has3D: false,
        stageEl,
        setGender: vi.fn(),
        loadVRMFile: vi.fn()
      };

      const skinEngine = await setupSkinEngine({
        options: {
          customEngines: { skin: customSkin }
        },
        widget: mockWidget,
        rootStore,
        getEngines,
        getUiDom,
        stageEl
      });

      expect(skinEngine).toBe(customSkin);
    });
  });
});
