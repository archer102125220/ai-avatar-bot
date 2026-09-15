import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserPipeline } from '../../../core/orchestrator/pipeline-user';
import { createStreamPipeline } from '../../../core/orchestrator/pipeline-stream';
import {
  createTapAvatarHandler,
  createModelDropHandler
} from '../../../core/orchestrator/interaction';
import { createBaseStore } from '../../../core/store';
import { initI18nEngine } from '../../../core/i18n';

describe('Orchestrator Pipelines & Interactions', () => {
  let rootStore;
  let i18nEngine;
  let mockWidget;
  let mockEngines;
  let autoContinueState;
  let streamSpeechState;

  beforeEach(() => {
    rootStore = createBaseStore({
      gender: 'female',
      avatarMode: 'assistant',
      locale: 'zh-TW',
      enableMemory: true
    });

    i18nEngine = initI18nEngine({ locale: 'zh-TW' });

    mockWidget = {
      name: 'MockWidget'
    };

    autoContinueState = {
      isActive: false,
      continuationIndex: 0,
      maxContinuations: 0,
      accumulatedText: ''
    };

    streamSpeechState = {
      sentenceBuffer: '',
      buf: ''
    };

    mockEngines = {
      brainEngine: {
        addChatMessage: vi.fn(),
        answerQuestion: vi.fn(),
        memory: {
          enabled: true,
          data: { visits: 1, name: 'Alice' },
          clear: vi.fn(),
          captureName: vi.fn(),
          addTurn: vi.fn()
        },
        llm: {
          controller: {
            abort: vi.fn()
          }
        }
      },
      speechEngine: {
        speakSeq: 1,
        convoOn: false,
        isListening: false,
        isProcessing: false,
        spokenDisplayText: '',
        spokenAudioText: '',
        stopSpeaking: vi.fn(),
        beginSpeech: vi.fn(() => 1),
        pushSpeech: vi.fn(),
        endSpeech: vi.fn(),
        drainSentences: vi.fn((state, isEnd) => {
          if (isEnd === true && state.buf !== '') {
            const res = [state.buf];
            state.buf = '';
            return res;
          }
          if (state.buf.includes('。')) {
            const parts = state.buf.split('。');
            state.buf = parts.pop() || '';
            return parts.map((p) => p + '。');
          }
          return [];
        }),
        onUtteranceEnd: vi.fn()
      },
      skinEngine: {
        gestureName: 'neutral',
        setEmotion: vi.fn(),
        loadVRMFile: vi.fn(),
        avatarModel: {
          motion: vi.fn()
        }
      },
      toolsEngine: {
        pendingToolConfirmation: null,
        pendingToolChoice: null,
        pendingToolInput: null,
        continueToolConfirmation: vi.fn(() => false),
        continueToolChoice: vi.fn(() => false),
        continueToolInput: vi.fn(() => false),
        routeHostTool: vi.fn(() => ({ match: null, ambiguous: [] })),
        offerToolChoices: vi.fn(),
        prepareTool: vi.fn()
      }
    };
  });

  const getEngines = () => mockEngines;
  const getWidget = () => mockWidget;

  describe('createUserPipeline (handleUser)', () => {
    it('should reset autoContinueState, stop previous speech, add turn, and answer question', () => {
      autoContinueState.isActive = true;
      autoContinueState.continuationIndex = 2;

      const handleUser = createUserPipeline({
        getWidget,
        rootStore,
        i18nEngine,
        getEngines,
        autoContinueState
      });

      handleUser('你好，請問天氣如何？');

      expect(autoContinueState.isActive).toBe(false);
      expect(autoContinueState.continuationIndex).toBe(0);
      expect(mockEngines.speechEngine.stopSpeaking).toHaveBeenCalled();
      expect(mockEngines.brainEngine.addChatMessage).toHaveBeenCalledWith('user', '你好，請問天氣如何？');
      expect(mockEngines.speechEngine.spokenDisplayText).toContain('你好，請問天氣如何？');
      expect(mockEngines.brainEngine.memory.captureName).toHaveBeenCalledWith('你好，請問天氣如何？');
      expect(mockEngines.brainEngine.memory.addTurn).toHaveBeenCalledWith('user', '你好，請問天氣如何？');
      expect(mockEngines.skinEngine.gestureName).toBe('thinking');
      expect(mockEngines.brainEngine.answerQuestion).toHaveBeenCalledWith('你好，請問天氣如何？');
    });

    it('should handle wipe memory request when user asks to forget', () => {
      const handleUser = createUserPipeline({
        getWidget,
        rootStore,
        i18nEngine,
        getEngines,
        autoContinueState
      });

      handleUser('請忘記我');

      expect(mockEngines.brainEngine.memory.clear).toHaveBeenCalled();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('記憶都清掉了');
      expect(mockEngines.brainEngine.answerQuestion).not.toHaveBeenCalled();
    });

    it('should intercept pending tool actions if toolsEngine is awaiting input', () => {
      mockEngines.toolsEngine.pendingToolConfirmation = 'confirm_1';
      mockEngines.toolsEngine.continueToolConfirmation = vi.fn(() => true);

      const handleUser = createUserPipeline({
        getWidget,
        rootStore,
        i18nEngine,
        getEngines,
        autoContinueState
      });

      handleUser('確認');

      expect(mockEngines.toolsEngine.continueToolConfirmation).toHaveBeenCalledWith('確認');
      expect(mockEngines.brainEngine.answerQuestion).not.toHaveBeenCalled();
    });

    it('should route tools and trigger prepareTool or offerToolChoices if matched', () => {
      // 1. Tool match
      mockEngines.toolsEngine.routeHostTool = vi.fn(() => ({
        match: { tool: { name: 'search' }, score: 0.9, reason: 'keyword' },
        ambiguous: []
      }));

      const handleUser = createUserPipeline({
        getWidget,
        rootStore,
        i18nEngine,
        getEngines,
        autoContinueState
      });

      handleUser('搜尋台北天氣');
      expect(mockEngines.toolsEngine.prepareTool).toHaveBeenCalled();
      expect(mockEngines.brainEngine.answerQuestion).not.toHaveBeenCalled();

      // 2. Ambiguous tool choice
      mockEngines.toolsEngine.routeHostTool = vi.fn(() => ({
        match: null,
        ambiguous: [{ tool: { name: 'a' } }, { tool: { name: 'b' } }]
      }));
      handleUser('曖昧指令');
      expect(mockEngines.toolsEngine.offerToolChoices).toHaveBeenCalledWith('曖昧指令', expect.any(Array));

      // 3. Pending tool choice and pending tool input
      mockEngines.toolsEngine.pendingToolChoice = { options: [] };
      mockEngines.toolsEngine.continueToolChoice = vi.fn(() => true);
      handleUser('選項 1');
      expect(mockEngines.toolsEngine.continueToolChoice).toHaveBeenCalledWith('選項 1');

      delete mockEngines.toolsEngine.pendingToolChoice;
      mockEngines.toolsEngine.pendingToolInput = { field: 'name' };
      mockEngines.toolsEngine.continueToolInput = vi.fn(() => true);
      handleUser('填入名字');
      expect(mockEngines.toolsEngine.continueToolInput).toHaveBeenCalledWith('填入名字');
    });
  });

  describe('createStreamPipeline', () => {
    it('should begin speech on stream start and push chunks as sentences arrive', () => {
      const options = {
        onStreamEnd: vi.fn()
      };

      const streamPipeline = createStreamPipeline({
        getWidget,
        options,
        getEngines,
        autoContinueState,
        streamSpeechState
      });

      streamPipeline.onStreamStart();
      expect(mockEngines.speechEngine.beginSpeech).toHaveBeenCalled();
      expect(streamPipeline.getStreamSpeechId()).toBe(1);

      streamPipeline.onStreamChunk('今天天氣真好。');
      expect(mockEngines.speechEngine.pushSpeech).toHaveBeenCalledWith(1, '今天天氣真好。');

      streamPipeline.onStreamEnd('今天天氣真好。下雨機率低。');
      expect(mockEngines.speechEngine.endSpeech).toHaveBeenCalledWith(1);
      expect(options.onStreamEnd).toHaveBeenCalledWith('今天天氣真好。下雨機率低。');
    });

    it('should handle auto-continue lifecycle and interrupt properly', () => {
      const options = {
        onAutoContinueStart: vi.fn(),
        onAutoContinueWait: vi.fn(),
        onAutoContinueResume: vi.fn(),
        onAutoContinueEnd: vi.fn()
      };

      const streamPipeline = createStreamPipeline({
        getWidget,
        options,
        getEngines,
        autoContinueState,
        streamSpeechState
      });

      streamPipeline.onAutoContinueStart({ continuationIndex: 1, maxContinuations: 3, accumulatedText: 'Part 1' });
      expect(autoContinueState.isActive).toBe(true);
      expect(autoContinueState.continuationIndex).toBe(1);
      expect(options.onAutoContinueStart).toHaveBeenCalled();

      streamPipeline.onAutoContinueWait({ continuationIndex: 1 });
      expect(mockEngines.skinEngine.setEmotion).toHaveBeenCalledWith('thinking');
      expect(options.onAutoContinueWait).toHaveBeenCalled();

      streamPipeline.onAutoContinueResume({ continuationIndex: 2, maxContinuations: 3, accumulatedText: 'Part 1 Part 2' });
      expect(autoContinueState.continuationIndex).toBe(2);
      expect(options.onAutoContinueResume).toHaveBeenCalled();

      streamPipeline.onAutoContinueEnd({});
      expect(autoContinueState.isActive).toBe(false);
      expect(options.onAutoContinueEnd).toHaveBeenCalled();

      // Test onInterrupt
      autoContinueState.isActive = true;
      streamPipeline.onInterrupt();
      expect(autoContinueState.isActive).toBe(false);
      expect(mockEngines.brainEngine.llm.controller.abort).toHaveBeenCalled();
    });

    it('should handle ttsMuted, missing speechEngine, and setStreamSpeechId', () => {
      const streamSpeechState = { sentenceBuffer: '', buf: '' };
      const autoContinueState = { isActive: false, continuationIndex: 0, maxContinuations: 0, accumulatedText: '' };
      let speechEngine = {
        ttsMuted: true,
        beginSpeech: vi.fn(() => 10),
        speakSeq: 10,
        drainSentences: vi.fn(() => ['句1']),
        pushSpeech: vi.fn(),
        endSpeech: vi.fn(),
        onUtteranceEnd: vi.fn()
      };

      const streamPipeline = createStreamPipeline({
        widget: { id: 'test-w' },
        options: {},
        getEngines: () => ({ speechEngine, skinEngine: null, brainEngine: null }),
        autoContinueState,
        streamSpeechState
      });

      // 1. ttsMuted is true -> streamSpeechId = 0
      streamPipeline.onStreamStart();
      expect(streamPipeline.getStreamSpeechId()).toBe(0);

      // onStreamChunk does nothing when streamSpeechId is 0
      streamPipeline.onStreamChunk('文字');
      expect(speechEngine.pushSpeech).not.toHaveBeenCalled();

      // onStreamEnd calls speechEngine.onUtteranceEnd() when streamSpeechId is 0
      streamPipeline.onStreamEnd('文字');
      expect(speechEngine.onUtteranceEnd).toHaveBeenCalled();

      // Test setStreamSpeechId
      streamPipeline.setStreamSpeechId(99);
      expect(streamPipeline.getStreamSpeechId()).toBe(99);

      // 2. speechEngine is null
      speechEngine = null;
      streamPipeline.onStreamStart();
      expect(streamPipeline.getStreamSpeechId()).toBe(0);
      streamPipeline.onStreamChunk('文字2');
      streamPipeline.onStreamEnd('文字2');
    });

    it('should handle speech sequence mismatch (barge-in chunk discard) and skinEngine gestureName', () => {
      const streamSpeechState = { sentenceBuffer: '', buf: '' };
      const autoContinueState = { isActive: false, continuationIndex: 0, maxContinuations: 0, accumulatedText: '' };
      const speechEngine = {
        ttsMuted: false,
        beginSpeech: vi.fn(() => 5),
        speakSeq: 6, // mismatch! (5 !== 6)
        drainSentences: vi.fn(() => ['句']),
        pushSpeech: vi.fn(),
        endSpeech: vi.fn(),
        onUtteranceEnd: vi.fn()
      };
      const skinEngine = {
        gestureName: 'idle'
      };
      const options = {
        onAutoContinueWait: vi.fn()
      };

      const streamPipeline = createStreamPipeline({
        options,
        getEngines: () => ({ speechEngine, skinEngine, brainEngine: { llm: { controller: null } } }),
        autoContinueState,
        streamSpeechState
      });

      streamPipeline.onStreamStart();
      expect(streamPipeline.getStreamSpeechId()).toBe(5);

      // Chunk is discarded because speakSeq !== streamSpeechId
      streamPipeline.onStreamChunk('忽略這句');
      expect(speechEngine.pushSpeech).not.toHaveBeenCalled();

      // onStreamEnd sequence mismatch -> does not call pushSpeech / endSpeech
      streamPipeline.onStreamEnd('忽略這句');
      expect(speechEngine.endSpeech).not.toHaveBeenCalled();

      // onAutoContinueWait with gestureName
      streamPipeline.onAutoContinueWait({});
      expect(skinEngine.gestureName).toBe('thinking');

      // onSpeechWait with isActive true
      autoContinueState.isActive = true;
      streamPipeline.onSpeechWait(5);
      expect(skinEngine.gestureName).toBe('thinking');
      expect(options.onAutoContinueWait).toHaveBeenCalledWith(
        expect.objectContaining({ speechSequenceId: 5 })
      );

      // onInterrupt with error during abort
      const throwingBrain = {
        llm: {
          controller: {
            abort: vi.fn(() => {
              throw new Error('Abort fail');
            })
          }
        }
      };
      const pipelineWithThrowingBrain = createStreamPipeline({
        options: {},
        getEngines: () => ({ speechEngine, skinEngine, brainEngine: throwingBrain }),
        autoContinueState,
        streamSpeechState
      });
      expect(() => pipelineWithThrowingBrain.onInterrupt()).not.toThrow();
    });
  });

  describe('createTapAvatarHandler', () => {
    it('should trigger tap motion and speak greeting based on avatar mode', () => {
      const options = {
        onTapAvatar: vi.fn()
      };

      const onTap = createTapAvatarHandler({
        getWidget,
        options,
        rootStore,
        i18nEngine,
        getEngines
      });

      onTap();

      expect(options.onTapAvatar).toHaveBeenCalled();
      expect(mockEngines.skinEngine.avatarModel.motion).toHaveBeenCalledWith('Tap');
      expect(mockEngines.speechEngine.spokenAudioText).toContain('虛擬人');

      // Test throttle guard
      mockEngines.speechEngine.onTapTimer = true;
      onTap();
      expect(mockEngines.skinEngine.avatarModel.motion).toHaveBeenCalledTimes(1);
    });
  });

  describe('createModelDropHandler', () => {
    it('should register and unregister drag and drop event listeners', () => {
      const container = document.createElement('div');
      const addSpy = vi.spyOn(container, 'addEventListener');
      const removeSpy = vi.spyOn(container, 'removeEventListener');

      const updateModelDropListeners = createModelDropHandler({
        container,
        getSkinEngine: () => mockEngines.skinEngine
      });

      updateModelDropListeners(true);
      expect(addSpy).toHaveBeenCalledWith('dragenter', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('drop', expect.any(Function));

      updateModelDropListeners(false);
      expect(removeSpy).toHaveBeenCalledWith('dragenter', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('drop', expect.any(Function));
    });

    it('should load VRM file when file is dropped onto container', () => {
      const container = document.createElement('div');
      const updateModelDropListeners = createModelDropHandler({
        container,
        getSkinEngine: () => mockEngines.skinEngine
      });

      updateModelDropListeners(true);

      const fakeFile = new File(['dummy content'], 'avatar.vrm', { type: 'application/octet-stream' });
      const dropEvent = new Event('drop');
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [fakeFile] }
      });

      container.dispatchEvent(dropEvent);

      expect(mockEngines.skinEngine.loadVRMFile).toHaveBeenCalledWith(fakeFile);
    });
  });
});
