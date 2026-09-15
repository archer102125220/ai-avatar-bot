import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initBrainEngine,
  getRetrievalAnswer,
  getCompanionFallbackResponse,
  answerQuestion,
  emitAnswer,
  addChatMessage,
  updateChatMessage,
  validateBrainEngine
} from '../../../core/brain';
import {
  AVATAR_MODE_MAP,
  STATE_MAP,
  BRAIN_ENGINE_TYPE_MAP
} from '../../../core/constants';

describe('Unit Test: core/brain/index.js (Brain Engine)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initBrainEngine', () => {
    it('should initialize complete brain engine with memory, llm, and aiProvider sub-modules', async () => {
      const brainEngine = await initBrainEngine({
        enableAiProvider: false,
        enableMemory: true,
        locale: 'zh-TW',
        knowledge: [
          { q: '這是什麼？', kw: '介紹 說明', a: '這是語音虛擬人 SDK' }
        ]
      });

      expect(brainEngine.locale).toBe('zh-TW');
      expect(brainEngine.knowledge).toHaveLength(1);
      expect(brainEngine.memory).toBeDefined();
      expect(brainEngine.llm).toBeDefined();
      expect(brainEngine.aiProvider).toBeDefined();
      expect(brainEngine.availableModes).toContain(AVATAR_MODE_MAP.assistant);
      expect(brainEngine.availableModes).toContain(AVATAR_MODE_MAP.companion);
    });
  });

  describe('getRetrievalAnswer & getCompanionFallbackResponse', () => {
    it('should return matching knowledge answer when score meets threshold', () => {
      const brainEngine = {
        locale: 'zh-TW',
        knowledge: [
          { q: '支援 3D 嗎？', kw: '3D VRM', a: '完全支援 Live2D 與 VRM 3D 模型！' }
        ]
      };

      const answer = getRetrievalAnswer(brainEngine, '請問有支援 3D 嗎？');
      expect(answer).toBe('完全支援 Live2D 與 VRM 3D 模型！');
    });

    it('should return localized fallback when no knowledge matches in assistant mode', () => {
      const brainEngine = {
        locale: 'zh-TW',
        knowledge: []
      };

      const fallback = getRetrievalAnswer(brainEngine, '宇宙的起源是什麼？');
      expect(fallback).toContain('宇宙的起源是什麼？');
      expect(fallback).toContain('知識庫還沒收錄');
    });

    it('should cycle through companion fallback responses in companion mode', () => {
      const brainEngine = {
        locale: 'zh-TW',
        avatarMode: AVATAR_MODE_MAP.companion,
        companionKnowledge: [],
        companionFallbackIdx: 0,
        memory: { data: { name: '小美' } }
      };

      const firstResponse = getCompanionFallbackResponse(brainEngine, '你好啊');
      const secondResponse = getCompanionFallbackResponse(brainEngine, '今天心情好');

      expect(firstResponse).toContain('小美');
      expect(typeof secondResponse).toBe('string');
      expect(brainEngine.companionFallbackIdx).toBe(2);
    });
  });

  describe('addChatMessage & updateChatMessage', () => {
    it('should record messages into chatLog and notify listeners', () => {
      const onAddChatMessage = vi.fn();
      const onChatHistoryChanged = vi.fn();

      const brainEngine = {
        chatLog: [],
        chatSeq: 0,
        onAddChatMessage,
        onChatHistoryChanged
      };

      const messageId = addChatMessage(brainEngine, 'user', '哈囉！');
      expect(brainEngine.chatLog).toHaveLength(1);
      expect(brainEngine.chatLog[0].text).toBe('哈囉！');
      expect(onAddChatMessage).toHaveBeenCalledOnce();
      expect(onChatHistoryChanged).toHaveBeenCalledOnce();

      updateChatMessage(brainEngine, messageId, '哈囉～更新版！', false);
      expect(brainEngine.chatLog[0].text).toBe('哈囉～更新版！');
      expect(brainEngine.chatLog[0].streaming).toBe(false);
    });
  });

  describe('emitAnswer', () => {
    it('should save to memory, update chat log, and play audio', () => {
      const addTurn = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();
      const onEmotionChange = vi.fn();

      const brainEngine = {
        chatLog: [],
        chatSeq: 0,
        memory: { addTurn },
        onSpokenAudioPlayNow,
        onEmotionChange
      };

      emitAnswer(brainEngine, '今天天氣很棒！');

      expect(addTurn).toHaveBeenCalledWith('assistant', '今天天氣很棒！');
      expect(brainEngine.chatLog).toHaveLength(1);
      expect(onSpokenAudioPlayNow).toHaveBeenCalledWith('今天天氣很棒！');
    });
  });

  describe('answerQuestion (Engine Priority Routing)', () => {
    it('should route to AI Provider when enabled and ready', async () => {
      const chatWithAiProvider = vi.fn().mockResolvedValue();

      const brainEngine = {
        aiProvider: { enabled: true, ready: true },
        chatWithAiProvider
      };

      await answerQuestion(brainEngine, '測試問題');
      expect(chatWithAiProvider).toHaveBeenCalledWith('測試問題');
    });

    it('should fallback to WebLLM or Retrieval and trigger onBrainFallback when AI Provider errors', async () => {
      const onBrainFallback = vi.fn();
      const emitAnswerMock = vi.fn();

      const brainEngine = {
        aiProvider: { enabled: true, ready: true },
        chatWithAiProvider: vi.fn().mockRejectedValue(new Error('AI Provider offline')),
        llm: { state: STATE_MAP.READY },
        chatWithWebLLM: vi.fn().mockResolvedValue(),
        onBrainFallback,
        emitAnswer: emitAnswerMock,
        STATE_MAP
      };

      await answerQuestion(brainEngine, '測試問題');

      expect(onBrainFallback).toHaveBeenCalledWith(
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER,
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM,
        expect.any(Error)
      );
      expect(brainEngine.chatWithWebLLM).toHaveBeenCalledWith('測試問題');
    });

    it('should route directly to Retrieval when AI Provider and WebLLM are unavailable', async () => {
      const emitAnswerMock = vi.fn();

      const brainEngine = {
        aiProvider: { enabled: false, ready: false },
        llm: { state: STATE_MAP.IDLE },
        knowledge: [{ q: '哈囉', kw: '哈囉', a: '你好！' }],
        emitAnswer: emitAnswerMock,
        STATE_MAP
      };

      await answerQuestion(brainEngine, '哈囉');
      expect(emitAnswerMock).toHaveBeenCalledWith('你好！');
    });
  });

  describe('validateBrainEngine', () => {
    it('should return isValid true when all required methods and properties are present', () => {
      const validEngine = {
        addChatMessage: () => {},
        updateChatMessage: () => {},
        answerQuestion: () => {},
        getWelcomeText: () => {},
        buildLLMMessages: () => {},
        classifyEmotion: () => {},
        applyEmotionFromText: () => {},
        memory: {},
        llm: {},
        aiProvider: {},
        chatLog: [],
        chatSeq: 0
      };

      const validation = validateBrainEngine(validEngine);
      expect(validation.isValid).toBe(true);
      expect(validation.missing).toEqual([]);
    });

    it('should return isValid false with missing method names when incomplete', () => {
      const incompleteEngine = {
        addChatMessage: () => {}
      };

      const validation = validateBrainEngine(incompleteEngine);
      expect(validation.isValid).toBe(false);
      expect(validation.missing.length).toBeGreaterThan(0);
    });
  });
});
