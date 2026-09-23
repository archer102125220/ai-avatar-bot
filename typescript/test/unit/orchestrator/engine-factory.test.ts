import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setupBrainEngine,
  setupSpeechEngine,
  setupToolsEngine,
  setupSkinEngine
} from '@/core/orchestrator/engine-factory';
import { createBaseStore } from '@/core/store';
import { initI18nEngine } from '@/core/i18n';
import { ENGINE_MODE_MAP, DEFAULT_EMOTION_TOOL_NAME } from '@/core/constants';
import type { I18nEngine } from '@core';

import * as SpeechModule from '@/core/speech';
import * as SkinModule from '@/core/skin';

describe('Orchestrator Engine Factory', () => {
  let rootStore: any;
  let i18nEngine: I18nEngine;
  let mockWidget: any;
  let mockUiDom: any;
  let mockEngines: any;
  let mockStreamPipeline: any;

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

    const historyPanelEl = document.createElement('section');
    const historyListEl = document.createElement('div');
    historyListEl.id = 'history-list';
    historyPanelEl.appendChild(historyListEl);

    mockUiDom = {
      btnLlmEl: document.createElement('button'),
      bubbleEl: document.createElement('p'),
      historyPanelEl,
      historyButtonEl: document.createElement('button'),
      directWarnEl: document.createElement('p'),
      engineButtonEl: document.createElement('button'),
      langButtonEl: document.createElement('button'),
      updateMicState: vi.fn(),
      updateVoiceStatus: vi.fn()
    };

    mockWidget = {
      name: 'MockWidget',
      uiDom: mockUiDom,
      brainEngine: { chatLog: [] },
      i18nEngine,
      store: rootStore,
      onReady: vi.fn(),
      onError: vi.fn()
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
        executeToolDirectly: vi.fn(async (tool: any, args: any) => ({ result: 'ok', tool, args })),
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
          customEngines: { brain: customBrain as any }
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
          // @ts-ignore: Defensive runtime type checking test
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
      let capturedBrainOptions: any;
      const customBrainFactory = vi.fn(async (opts: any) => {
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
          customEngines: { brain: customBrainFactory as any }
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

      // Test default onBrainFallback
      expect(capturedBrainOptions.onBrainFallback('webllm', 'ai_provider', new Error('WebLLM failed'))).toBeUndefined();

      // Test offerToolConfirmation
      capturedBrainOptions.offerToolConfirmation('test_tool', { a: 1 }, {});
      expect(mockEngines.toolsEngine.offerHostTool).toHaveBeenCalled();

      const execResult = await capturedBrainOptions.executeTool('test_tool', { foo: 'bar' }, {
        input: { query: '使用者問題', context: { customContext: true } }
      });
      expect(execResult).toEqual({
        result: 'ok',
        tool: 'test_tool',
        args: { foo: 'bar' }
      });
      expect(mockEngines.toolsEngine.executeToolDirectly).toHaveBeenCalled();
    });

    it('should trigger UI and speech updates on LLM lifecycle callbacks', async () => {
      let capturedBrainOptions: any;
      const customBrainFactory = vi.fn(async (opts: any) => {
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
          customEngines: { brain: customBrainFactory as any }
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

      // test onLlmLoadError
      capturedBrainOptions.onLlmLoadError(new Error('LLM load failed'));
      expect(mockUiDom.btnLlmEl.textContent).toBe('🧠✗');
      expect(mockEngines.speechEngine.spokenDisplayText).toContain('LLM load failed');

      // test onEmotionChange with setEmotion
      capturedBrainOptions.onEmotionChange('happy');
      expect(mockEngines.skinEngine.setEmotion).toHaveBeenCalledWith('happy');

      // test onEmotionChange fallback to gestureName
      const skinWithoutSetEmotion = { gestureName: 'neutral' };
      mockEngines.skinEngine = skinWithoutSetEmotion;
      capturedBrainOptions.onEmotionChange('sad');
      expect(skinWithoutSetEmotion.gestureName).toBe('sad');
    });

    it('should test all AI provider callbacks and state transitions in setupBrainEngine', async () => {
      vi.useFakeTimers();
      let capturedBrainOptions: any;
      const customBrainFactory = vi.fn(async (opts: any) => {
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
          aiProvider: { model: 'gpt-4o' },
          chatLog: [],
          chatSeq: 0
        };
      });

      const onBrainFallback = vi.fn();
      const onToolNotFound = vi.fn();
      const onToolError = vi.fn();

      await setupBrainEngine({
        options: {
          customEngines: { brain: customBrainFactory as any },
          onBrainFallback,
          onToolNotFound,
          onToolError
        },
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getEngines,
        getUiDom,
        streamPipeline: mockStreamPipeline
      });

      // onAiProviderConnecting
      capturedBrainOptions.onAiProviderConnecting();
      expect(mockUiDom.btnLlmEl.textContent).toBe('🧠…');
      expect(mockUiDom.btnLlmEl.title).toBe('AI 伺服器大腦（連線中）');

      // onAiProviderConnected (success)
      capturedBrainOptions.onAiProviderConnected({ ok: true }, {}, { model: 'gpt-4o' });
      expect(mockUiDom.btnLlmEl.textContent).toBe('🧠✓');
      expect(mockUiDom.btnLlmEl.getAttribute('css-llm-on')).toBe('true');
      expect(mockUiDom.btnLlmEl.getAttribute('aria-pressed')).toBe('true');
      expect(mockUiDom.btnLlmEl.title).toContain('gpt-4o');

      vi.advanceTimersByTime(1400);
      expect(mockEngines.speechEngine.spokenDisplayText).toContain('已接上 AI 伺服器大腦');

      // onAiProviderConnected (failure)
      capturedBrainOptions.onAiProviderConnected({ ok: false }, {}, { model: 'gpt-4o' });
      expect(mockUiDom.btnLlmEl.textContent).toBe('🧠✗');
      expect(mockUiDom.btnLlmEl.hasAttribute('css-llm-on')).toBe(false);
      expect(mockUiDom.btnLlmEl.getAttribute('aria-pressed')).toBe('false');
      expect(mockUiDom.btnLlmEl.title).toContain('AI 伺服器連不上');

      // onSummaryUpdated, onChatHistoryChanged, onSpokenAudioPlayNow, onSpokenDisplayTextChange, onSpokenAudioTextChange
      capturedBrainOptions.onSummaryUpdated('New Summary');
      capturedBrainOptions.onChatHistoryChanged([{ role: 'user', content: 'hi' }]);
      capturedBrainOptions.onSpokenAudioPlayNow('Hello audio');
      expect(mockEngines.speechEngine.speak).toHaveBeenCalledWith('Hello audio');

      capturedBrainOptions.onSpokenDisplayTextChange('Display text');
      expect(mockEngines.speechEngine.spokenDisplayText).toBe('Display text');

      capturedBrainOptions.onSpokenAudioTextChange('Audio text');
      expect(mockEngines.speechEngine.spokenAudioText).toBe('Audio text');

      // onAddChatMessage & onUpdateChatMessage with history panel open
      mockUiDom.historyPanelEl.setAttribute('css-is-open', 'true');
      capturedBrainOptions.onAddChatMessage({ id: 1, text: 'Hello' });
      capturedBrainOptions.onUpdateChatMessage({ id: 1, text: 'Hello updated' });

      // onBrainFallback
      capturedBrainOptions.onBrainFallback('aiProvider', 'webLLM', new Error('Err'));
      expect(onBrainFallback).toHaveBeenCalled();

      // onToolNotFound & onToolError
      capturedBrainOptions.onToolNotFound({ name: 'unknown' });
      expect(onToolNotFound).toHaveBeenCalled();
      capturedBrainOptions.onToolError({ name: 'calc', error: 'failed' });
      expect(onToolError).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should test tool delegation edge branches in setupBrainEngine', async () => {
      let capturedBrainOptions: any;
      const customBrainFactory = vi.fn(async (opts: any) => {
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
          customEngines: { brain: customBrainFactory as any }
        },
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getEngines: () => ({
          ...mockEngines,
          toolsEngine: null
        }),
        getUiDom,
        streamPipeline: mockStreamPipeline
      });

      expect(capturedBrainOptions.getTools()).toEqual([]);
      expect(capturedBrainOptions.getToolByName('any')).toBeNull();
      capturedBrainOptions.offerToolConfirmation('any', {}, {});
      const nullExec = await capturedBrainOptions.executeTool('any', {}, {});
      expect(nullExec).toBeNull();
    });

    it('should handle custom brain factory throwing error and fallback to default', async () => {
      const brainEngine = await setupBrainEngine({
        options: {
          customEngines: {
            brain: () => {
              throw new Error('Factory crashed');
            }
          }
        },
        widget: mockWidget,
        rootStore,
        i18nEngine,
        getEngines,
        getUiDom,
        streamPipeline: mockStreamPipeline
      });

      expect(brainEngine).toBeDefined();
      expect(typeof brainEngine.answerQuestion).toBe('function');
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

    it('should trigger all callbacks and UI updates in setupSpeechEngine', async () => {
      let capturedSpeechOptions: any;
      const initSpeechSpy = vi.spyOn(SpeechModule, 'initSpeechEngine').mockImplementation(async (opts: any) => {
        capturedSpeechOptions = opts;
        return {
          speak: vi.fn(),
          startListening: vi.fn(),
          stopListening: vi.fn(),
          toggleVoice: vi.fn(),
          setGender: vi.fn(),
          spokenDisplayText: '',
          spokenAudioText: '',
          convoOn: false,
          isListening: false
        } as any;
      });

      const onSpeaking = vi.fn();
      const onSpeakingEnd = vi.fn();
      const onLanguageChanged = vi.fn();
      const onMicStateChanged = vi.fn();
      const onVoiceStatusChanged = vi.fn();
      const onSpokenDisplayTextChange = vi.fn();
      const onSpokenDisplayTextTimeout = vi.fn();
      const handleUser = vi.fn();
      const onTapAvatar = vi.fn();
      const container = document.createElement('div');

      await setupSpeechEngine({
        options: {
          onSpeaking,
          onSpeakingEnd,
          onLanguageChanged,
          onMicStateChanged,
          onVoiceStatusChanged,
          onSpokenDisplayTextChange,
          onSpokenDisplayTextTimeout
        },
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

      expect(typeof capturedSpeechOptions.getGender()).toBe('string');
      expect(capturedSpeechOptions.getContainer()).toBe(container);

      // onSpokenDisplayTextChange
      capturedSpeechOptions.onSpokenDisplayTextChange('Hello bubble');
      expect(mockUiDom.bubbleEl.textContent).toBe('Hello bubble');
      expect(mockUiDom.bubbleEl.getAttribute('css-is-show')).toBe('true');
      expect(onSpokenDisplayTextChange).toHaveBeenCalledWith('Hello bubble');

      // onSpokenDisplayTextTimeout
      capturedSpeechOptions.onSpokenDisplayTextTimeout();
      expect(mockUiDom.bubbleEl.hasAttribute('css-is-show')).toBe(false);
      expect(onSpokenDisplayTextTimeout).toHaveBeenCalled();

      // onMicStateChanged
      capturedSpeechOptions.onMicStateChanged(true, true);
      expect(mockUiDom.updateMicState).toHaveBeenCalled();
      expect(onMicStateChanged).toHaveBeenCalledWith(true, true);

      // onVoiceStatusChanged
      capturedSpeechOptions.onVoiceStatusChanged(true, 'Ready', 'standby', 0);
      expect(mockUiDom.updateVoiceStatus).toHaveBeenCalled();
      expect(onVoiceStatusChanged).toHaveBeenCalled();

      // onUserInput, onTapAvatar, onInterrupt, onSpeechWait
      capturedSpeechOptions.onUserInput('Hello AI');
      expect(handleUser).toHaveBeenCalledWith('Hello AI');

      capturedSpeechOptions.onTapAvatar();
      expect(onTapAvatar).toHaveBeenCalled();

      capturedSpeechOptions.onInterrupt();
      expect(mockStreamPipeline.onInterrupt).toHaveBeenCalled();

      capturedSpeechOptions.onSpeechWait('seq_123');
      expect(mockStreamPipeline.onSpeechWait).toHaveBeenCalledWith('seq_123');

      // onLanguageChanged
      capturedSpeechOptions.onLanguageChanged('zh-TW', '繁體中文', '繁中');
      expect(mockUiDom.langButtonEl.textContent).toBe('繁中');
      expect(onLanguageChanged).toHaveBeenCalledWith('zh-TW', '繁體中文', '繁中');

      // onSpeaking & onSpeakingEnd
      capturedSpeechOptions.onSpeaking('Speaking text');
      expect(onSpeaking).toHaveBeenCalledWith('Speaking text');

      capturedSpeechOptions.onSpeakingEnd();
      expect(mockEngines.skinEngine.setEmotion).toHaveBeenCalledWith('neutral');
      expect(onSpeakingEnd).toHaveBeenCalled();

      initSpeechSpy.mockRestore();
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
      const toolNames = toolsEngine.HOST_TOOLS.map((t: any) => t.name);
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
          customEngines: { tools: customTools as any }
        },
        widget: mockWidget,
        getEngines,
        getUiDom
      });

      expect(toolsEngine).toBe(customTools);
    });

    it('should test tools callbacks and history toggling in setupToolsEngine', () => {
      let capturedToolsOptions: any;
      const customToolsFactory = vi.fn((opts: any) => {
        capturedToolsOptions = opts;
        return {
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
      });

      const onToolCall = vi.fn();
      const onSetHistoryOpen = vi.fn();
      const onRenderHistory = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();

      mockEngines.brainEngine = {
        addChatMessage: vi.fn(),
        updateChatMessage: vi.fn(),
        chatLog: [{ role: 'user', content: 'test' }],
        chatSeq: 4
      };

      setupToolsEngine({
        options: {
          customEngines: { tools: customToolsFactory as any },
          toolConfirmationTimeoutMs: 5000,
          onToolCall,
          onSetHistoryOpen,
          onRenderHistory,
          onSpokenAudioPlayNow,
          enableEmotionTools: false
        },
        widget: mockWidget,
        getEngines,
        getUiDom
      });

      expect(capturedToolsOptions.confirmationTimeoutMs).toBe(5000);

      // onToolCall
      capturedToolsOptions.onToolCall({ name: 'calc' });
      expect(onToolCall).toHaveBeenCalled();

      // onAddChatMessage & onUpdateChatMessage
      capturedToolsOptions.onAddChatMessage('assistant', 'Text', {});
      expect(mockEngines.brainEngine.addChatMessage).toHaveBeenCalledWith('assistant', 'Text', {});

      capturedToolsOptions.onUpdateChatMessage('msg_1', 'New Text', false);
      expect(mockEngines.brainEngine.updateChatMessage).toHaveBeenCalledWith('msg_1', 'New Text', false);

      // onSetHistoryOpen true / false
      capturedToolsOptions.onSetHistoryOpen(true);
      expect(mockUiDom.historyPanelEl.getAttribute('css-is-open')).toBe('true');
      expect(mockUiDom.historyPanelEl.inert).toBe(false);
      expect(mockUiDom.historyButtonEl.getAttribute('aria-expanded')).toBe('true');
      expect(onSetHistoryOpen).toHaveBeenCalledWith(true);

      capturedToolsOptions.onSetHistoryOpen(false);
      expect(mockUiDom.historyPanelEl.hasAttribute('css-is-open')).toBe(false);
      expect(mockUiDom.historyPanelEl.inert).toBe(true);
      expect(mockUiDom.historyButtonEl.getAttribute('aria-expanded')).toBe('false');
      expect(onSetHistoryOpen).toHaveBeenCalledWith(false);

      // onRenderHistory
      capturedToolsOptions.onRenderHistory();
      expect(onRenderHistory).toHaveBeenCalled();

      // onSpokenAudioPlayNow
      capturedToolsOptions.onSpokenAudioPlayNow('Voice now');
      expect(mockEngines.speechEngine.speak).toHaveBeenCalledWith('Voice now');
      expect(onSpokenAudioPlayNow).toHaveBeenCalledWith('Voice now');

      // getChatLog, getChatSeq, isConvoOn
      expect(capturedToolsOptions.getChatLog()).toEqual([{ role: 'user', content: 'test' }]);
      expect(capturedToolsOptions.getChatSeq()).toBe(4);
      expect(capturedToolsOptions.isConvoOn()).toBe(false);
    });

    it('should fallback to default tools engine when custom engine is invalid or throws', () => {
      const toolsEngineInvalid = setupToolsEngine({
        options: {
          // @ts-ignore: Defensive runtime type checking test
          customEngines: { tools: { invalid: true } }
        },
        widget: mockWidget,
        getEngines,
        getUiDom
      });
      expect(toolsEngineInvalid).toBeDefined();

      const toolsEngineThrows = setupToolsEngine({
        options: {
          customEngines: {
            tools: () => {
              throw new Error('Factory crashed');
            }
          }
        },
        widget: mockWidget,
        getEngines,
        getUiDom
      });
      expect(toolsEngineThrows).toBeDefined();
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
          customEngines: { skin: customSkin as any }
        },
        widget: mockWidget,
        rootStore,
        getEngines,
        getUiDom,
        stageEl
      });

      expect(skinEngine).toBe(customSkin);
    });

    it('should test all skin callbacks and canvas pointerdown bindings', async () => {
      let capturedSkinOptions: any;
      const initSkinSpy = vi.spyOn(SkinModule, 'initSkinEngine').mockImplementation((opts: any) => {
        capturedSkinOptions = opts;
        return {
          name: 'CustomSkin',
          has2D: true,
          has3D: false,
          stageEl: opts.stageEl,
          setGender: vi.fn(),
          loadVRMFile: vi.fn(),
          setEmotion: vi.fn()
        } as any;
      });

      const onThreeDimensionalError = vi.fn();
      const onTwoDimensionalError = vi.fn();
      const VRMFileChangeFail = vi.fn();
      const VRMFileChangeSuccess = vi.fn();
      const onModelChangeStart = vi.fn();
      const onModelChangeEnd = vi.fn();
      const stageEl = document.createElement('div');

      mockEngines.brainEngine = {
        getWelcomeText: vi.fn(async () => 'Welcome!')
      };

      await setupSkinEngine({
        options: {
          onThreeDimensionalError,
          onTwoDimensionalError,
          VRMFileChangeFail,
          VRMFileChangeSuccess,
          onModelChangeStart,
          onModelChangeEnd
        },
        widget: mockWidget,
        rootStore,
        getEngines,
        getUiDom,
        stageEl
      });

      // computeMouth
      expect(capturedSkinOptions.computeMouth()).toBe(0.4);

      // onMounted
      await capturedSkinOptions.onMounted();
      expect(mockEngines.speechEngine.spokenDisplayText).toBe('Welcome!');
      expect(mockWidget.onReady).toHaveBeenCalledWith(mockWidget);

      // onThreeDimensionalError
      capturedSkinOptions.onThreeDimensionalError(new Error('3D failed'));
      expect(mockWidget.onError).toHaveBeenCalled();
      expect(onThreeDimensionalError).toHaveBeenCalled();

      // onTwoDimensionalError
      capturedSkinOptions.onTwoDimensionalError(new Error('2D failed'));
      expect(mockUiDom.directWarnEl.textContent).toContain('2D 啟動失敗');
      expect(mockUiDom.directWarnEl.style.display).toBe('flex');
      expect(onTwoDimensionalError).toHaveBeenCalled();

      // VRMFileChangeFail
      capturedSkinOptions.VRMFileChangeFail(new Error('VRM failed'));
      expect(mockEngines.speechEngine.spokenDisplayText).toBe('VRM failed');
      expect(VRMFileChangeFail).toHaveBeenCalled();

      // VRMFileChangeSuccess
      capturedSkinOptions.VRMFileChangeSuccess();
      expect(mockEngines.speechEngine.spokenDisplayText).toContain('換上你的角色了');
      expect(VRMFileChangeSuccess).toHaveBeenCalled();

      // onModelChangeStart (3D vs 2D)
      capturedSkinOptions.onModelChangeStart(ENGINE_MODE_MAP.threeDimensional);
      expect(mockUiDom.engineButtonEl.textContent).toBe('3D');
      expect(onModelChangeStart).toHaveBeenCalledWith(ENGINE_MODE_MAP.threeDimensional);

      capturedSkinOptions.onModelChangeStart(ENGINE_MODE_MAP.twoDimensional);
      expect(mockUiDom.engineButtonEl.textContent).toBe('2D');

      // onModelChangeEnd in 3D mode with TAP_GESTURES
      mockEngines.skinEngine.engineMode = ENGINE_MODE_MAP.threeDimensional;
      mockEngines.skinEngine.renderer = {
        canvas: document.createElement('canvas'),
        TAP_GESTURES: ['wave', 'nod'],
        playGesture: vi.fn()
      };
      capturedSkinOptions.onModelChangeEnd();
      expect(mockUiDom.engineButtonEl.textContent).toBe('3D');
      expect(onModelChangeEnd).toHaveBeenCalled();

      // simulate pointerdown on 3D canvas
      mockEngines.skinEngine.renderer.canvas.dispatchEvent(new Event('pointerdown'));
      expect(mockEngines.skinEngine.renderer.playGesture).toHaveBeenCalled();
      expect(mockEngines.speechEngine.triggerTap).toHaveBeenCalled();

      // onModelChangeEnd in 2D mode with avatarModel hit
      mockEngines.skinEngine.engineMode = ENGINE_MODE_MAP.twoDimensional;
      const hitHandlers: Function[] = [];
      mockEngines.skinEngine.avatarModel = {
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'hit') hitHandlers.push(cb);
        })
      };
      mockEngines.skinEngine.renderer = {
        canvas: document.createElement('canvas')
      };
      capturedSkinOptions.onModelChangeEnd();
      expect(mockUiDom.engineButtonEl.textContent).toBe('2D');

      // trigger hit handler
      expect(hitHandlers.length).toBeGreaterThan(0);
      hitHandlers[0]();
      expect(mockEngines.speechEngine.triggerTap).toHaveBeenCalled();

      // trigger 2D canvas pointerdown
      mockEngines.skinEngine.renderer.canvas.dispatchEvent(new Event('pointerdown'));
      expect(mockEngines.speechEngine.triggerTap).toHaveBeenCalled();

      // onModelChangeStart (3D and 2D)
      capturedSkinOptions.onModelChangeStart(ENGINE_MODE_MAP.threeDimensional);
      expect(mockUiDom.engineButtonEl.textContent).toBe('3D');

      capturedSkinOptions.onModelChangeStart(ENGINE_MODE_MAP.twoDimensional);
      expect(mockUiDom.engineButtonEl.textContent).toBe('2D');

      // onModelChangeEnd in 3D mode
      mockEngines.skinEngine.engineMode = ENGINE_MODE_MAP.threeDimensional;
      const playGestureMock = vi.fn();
      mockEngines.skinEngine.renderer = {
        canvas: document.createElement('canvas'),
        TAP_GESTURES: ['Wave', 'Bow'],
        playGesture: playGestureMock
      };
      capturedSkinOptions.onModelChangeEnd();
      expect(mockUiDom.engineButtonEl.textContent).toBe('3D');

      mockEngines.skinEngine.renderer.canvas.dispatchEvent(new Event('pointerdown'));
      expect(playGestureMock).toHaveBeenCalled();
      expect(mockEngines.speechEngine.triggerTap).toHaveBeenCalled();

      initSkinSpy.mockRestore();
    });

    it('should fallback to default skin engine when custom engine is invalid or throws', async () => {
      const stageEl = document.createElement('div');
      const skinInvalid = await setupSkinEngine({
        options: {
          // @ts-ignore: Defensive runtime type checking test
          customEngines: { skin: { invalid: true } }
        },
        widget: mockWidget,
        rootStore,
        getEngines,
        getUiDom,
        stageEl
      });
      expect(skinInvalid).toBeDefined();

      const skinThrows = await setupSkinEngine({
        options: {
          customEngines: {
            skin: () => {
              throw new Error('Factory crashed');
            }
          }
        },
        widget: mockWidget,
        rootStore,
        getEngines,
        getUiDom,
        stageEl
      });
      expect(skinThrows).toBeDefined();
    });

    it('should test onTwoDimensionalError, VRMFileChangeFail, and VRMFileChangeSuccess handlers in setupSkinEngine options', async () => {
      let capturedSkinOptions: any = null;
      const initSkinSpy = vi.spyOn(SkinModule, 'initSkinEngine').mockImplementation((opts: any) => {
        capturedSkinOptions = opts;
        return mockEngines.skinEngine;
      });

      const onTwoDimensionalError = vi.fn();
      const VRMFileChangeFail = vi.fn();
      const VRMFileChangeSuccess = vi.fn();

      const stageEl = document.createElement('div');
      await setupSkinEngine({
        options: {
          onTwoDimensionalError,
          VRMFileChangeFail,
          VRMFileChangeSuccess
        },
        widget: mockWidget,
        rootStore,
        getEngines,
        getUiDom,
        stageEl
      });

      expect(capturedSkinOptions).toBeDefined();

      // 1. onTwoDimensionalError
      capturedSkinOptions.onTwoDimensionalError(new Error('2D failed'));
      expect(mockUiDom.directWarnEl.textContent).toContain('2D 啟動失敗');
      expect(mockUiDom.directWarnEl.style.display).toBe('flex');
      expect(mockWidget.onError).toHaveBeenCalled();
      expect(onTwoDimensionalError).toHaveBeenCalled();

      // 2. VRMFileChangeFail
      capturedSkinOptions.VRMFileChangeFail(new Error('VRM drop failed'));
      expect(mockEngines.speechEngine.spokenDisplayText).toBe('VRM drop failed');
      expect(VRMFileChangeFail).toHaveBeenCalled();

      // 3. VRMFileChangeSuccess
      capturedSkinOptions.VRMFileChangeSuccess();
      expect(mockEngines.speechEngine.spokenDisplayText).toBe('換上你的角色了！🎭');
      expect(VRMFileChangeSuccess).toHaveBeenCalled();

      initSkinSpy.mockRestore();
    });
  });
});
