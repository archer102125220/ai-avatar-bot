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
} from '@/core/brain';
import {
  AVATAR_MODE_MAP,
  STATE_MAP,
  BRAIN_ENGINE_TYPE_MAP
} from '@/core/constants';
import type { BrainEngine } from '@core';

describe('Unit Test: core/brain/index.js (Brain Engine Deep Branch Coverage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initBrainEngine', () => {
    it('should initialize complete brain engine with memory, llm, and aiProvider sub-modules', async () => {
      const onLlmLoading = vi.fn();
      const onLlmLoadProgress = vi.fn();
      const onLlmLoaded = vi.fn();
      const onLlmLoadError = vi.fn();
      const onLlmChatting = vi.fn();
      const onLlmStreamChatting = vi.fn();

      const onAiProviderConnecting = vi.fn();
      const onAiProviderConnected = vi.fn();
      const onAiProviderError = vi.fn();
      const onAiProviderChatting = vi.fn();
      const onAiProviderStreamChatting = vi.fn();

      const brainEngine: BrainEngine = await initBrainEngine({
        enableAiProvider: true,
        enableMemory: true,
        locale: 'zh-TW',
        welcomeText: () => '歡迎光臨！',
        companionWelcomeText: '陪伴模式哈囉！',
        assistantWelcomeText: () => '助理模式在此！',
        llmMaxTokens: 256,
        preloadWebLLM: true,
        onLlmLoading,
        onLlmLoadProgress,
        onLlmLoaded,
        onLlmLoadError,
        onLlmChatting,
        onLlmStreamChatting,
        onAiProviderConnecting,
        onAiProviderConnected,
        onAiProviderError,
        onAiProviderChatting,
        onAiProviderStreamChatting,
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

      // Test getters and setters for enableMemory and enableAiProvider
      expect(brainEngine.enableMemory).toBe(true);
      brainEngine.enableMemory = false;
      expect(brainEngine.enableMemory).toBe(false);

      expect(brainEngine.enableAiProvider).toBe(true);
      brainEngine.enableAiProvider = false;
      expect(brainEngine.enableAiProvider).toBe(false);
    });

    it('should support string welcomeTexts and custom modes registration', async () => {
      const brainEngine: BrainEngine = await initBrainEngine({
        welcomeText: '靜態歡迎詞',
        companionWelcomeText: '靜態陪伴詞',
        assistantWelcomeText: '靜態助理詞',
        modes: {
          doctor: {
            knowledge: [{ q: '看病', kw: '掛號', a: '請先掛號' }]
          }
        }
      });

      expect(brainEngine.welcomeText).toBe('靜態歡迎詞');
      expect(brainEngine.companionWelcomeText).toBe('靜態陪伴詞');
      expect(brainEngine.assistantWelcomeText).toBe('靜態助理詞');
      expect(brainEngine.availableModes).toContain('doctor');
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

      const answer = getRetrievalAnswer(brainEngine as any, '請問有支援 3D 嗎？');
      expect(answer).toBe('完全支援 Live2D 與 VRM 3D 模型！');
    });

    it('should return empty question prompt across all locales', () => {
      expect(getRetrievalAnswer({ locale: 'en-US' } as any, '')).toContain('say it again');
      expect(getRetrievalAnswer({ locale: 'ja-JP' } as any, '   ')).toContain('もう一度');
      expect(getRetrievalAnswer({ locale: 'ko-KR' } as any, '')).toContain('다시 한 번');
      expect(getRetrievalAnswer({ locale: 'zh-TW' } as any, '')).toContain('沒聽清楚');
    });

    it('should return localized assistant fallback when no knowledge matches across all locales', () => {
      expect(getRetrievalAnswer({ locale: 'en-US', knowledge: [] } as any, 'Quantum physics')).toContain('knowledge base does not cover');
      expect(getRetrievalAnswer({ locale: 'ja-JP', knowledge: [] } as any, '量子力学')).toContain('知識ベースにまだ登録されていません');
      expect(getRetrievalAnswer({ locale: 'ko-KR', knowledge: [] } as any, '양자역학')).toContain('지식 베이스에 아직');
      expect(getRetrievalAnswer({ locale: 'zh-TW', knowledge: [] } as any, '量子力學')).toContain('這題我的知識庫還沒收錄');
    });

    it('should support assistantFallbackContext and custom modes fallback in getRetrievalAnswer', () => {
      const brainEngineWithContext = {
        locale: 'zh-TW',
        knowledge: [],
        assistantFallbackContext: ({ question }: { question: string }) => `找不到「${question}」的資料喔！`
      };
      expect(getRetrievalAnswer(brainEngineWithContext as any, '火星')).toBe('找不到「火星」的資料喔！');

      const customModeEngine = {
        locale: 'zh-TW',
        avatarMode: 'guide',
        modes: {
          guide: {
            knowledge: [],
            fallback: ['導覽員目前不知道這題喔！']
          }
        }
      };
      expect(getRetrievalAnswer(customModeEngine as any, '門票')).toBe('導覽員目前不知道這題喔！');

      const customModeFunctionEngine = {
        locale: 'zh-TW',
        avatarMode: 'guide',
        modes: {
          guide: {
            knowledge: [],
            fallback: ({ question }: { question: string }) => `導覽員小提示：${question}`
          }
        }
      };
      expect(getRetrievalAnswer(customModeFunctionEngine as any, '廁所在哪')).toBe('導覽員小提示：廁所在哪');
    });

    it('should handle companion mode knowledge matching and fallback', () => {
      const brainEngine = {
        locale: 'zh-TW',
        avatarMode: AVATAR_MODE_MAP.companion,
        knowledge: [{ q: '網站介紹', kw: '網站', a: '這是官網' }],
        companionKnowledge: [{ q: '你開心嗎', kw: '開心', a: '我很開心！' }],
        companionFallbackIdx: 0
      };

      // Companion knowledge match
      expect(getRetrievalAnswer(brainEngine as any, '你今天開心嗎')).toBe('我很開心！');

      // Site knowledge match in companion mode
      expect(getRetrievalAnswer(brainEngine as any, '網站介紹')).toBe('這是官網');

      // Fallback in companion mode
      brainEngine.companionFallbackIdx = 0;
      const fallback = getRetrievalAnswer(brainEngine as any, '外太空有外星人嗎');
      expect(typeof fallback).toBe('string');
    });

    it('should cycle through companion fallback responses across different locales and custom contexts', () => {
      const enEngine = { locale: 'en-US', memory: { data: { name: 'Alice' } }, companionFallbackIdx: 0 };
      expect(getCompanionFallbackResponse(enEngine as any, 'hi')).toContain('Alice');

      const jaEngine = { locale: 'ja-JP', memory: { data: { name: 'さくら' } }, companionFallbackIdx: 0 };
      expect(getCompanionFallbackResponse(jaEngine as any, 'こんにちは')).toContain('さくら');

      const koEngine = { locale: 'ko-KR', memory: { data: { name: '지우' } }, companionFallbackIdx: 0 };
      expect(getCompanionFallbackResponse(koEngine as any, '안녕')).toContain('지우');

      const customFallbackEngine = {
        locale: 'zh-TW',
        companionFallbackContext: '自訂陪伴兜底回覆',
        companionFallbackIdx: 0
      };
      expect(getCompanionFallbackResponse(customFallbackEngine as any, '哈囉')).toBe('自訂陪伴兜底回覆');

      const arrayFallbackEngine = {
        locale: 'zh-TW',
        companionFallback: ['自訂清單回覆一', '自訂清單回覆二'],
        companionFallbackIdx: 0
      };
      expect(getCompanionFallbackResponse(arrayFallbackEngine as any, '哈囉')).toBe('自訂清單回覆一');
      expect(getCompanionFallbackResponse(arrayFallbackEngine as any, '哈囉')).toBe('自訂清單回覆二');
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

      const messageId = addChatMessage(brainEngine as any, 'user', '哈囉！');
      expect(brainEngine.chatLog).toHaveLength(1);
      expect((brainEngine.chatLog[0] as any).text).toBe('哈囉！');
      expect(onAddChatMessage).toHaveBeenCalledOnce();
      expect(onChatHistoryChanged).toHaveBeenCalledOnce();

      updateChatMessage(brainEngine as any, messageId, '哈囉～更新版！', false);
      expect((brainEngine.chatLog[0] as any).text).toBe('哈囉～更新版！');
      expect((brainEngine.chatLog[0] as any).streaming).toBe(false);
    });

    it('should shift oldest message when chatLog exceeds 80 messages and fallback to addChatMessage on unknown id update', () => {
      const brainEngine = {
        chatLog: Array.from({ length: 80 }, (_, i) => ({ id: `m${i}`, text: `msg${i}` })),
        chatSeq: 80
      };

      addChatMessage(brainEngine as any, 'assistant', '第 81 則訊息');
      expect(brainEngine.chatLog).toHaveLength(80);
      expect(brainEngine.chatLog[79].text).toBe('第 81 則訊息');

      // Update non-existing message id -> adds message
      const newId = updateChatMessage(brainEngine as any, 'non_existent_id', '新加入的訊息', false);
      expect(newId).toBeDefined();
    });
  });

  describe('emitAnswer', () => {
    it('should save to memory, update chat log, and play audio', () => {
      const addTurn = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();
      const applyEmotionFromText = vi.fn();
      const triggerRollingSummaryIfNeeded = vi.fn();

      const brainEngine = {
        chatLog: [],
        chatSeq: 0,
        memory: { addTurn },
        applyEmotionFromText,
        onSpokenAudioPlayNow,
        triggerRollingSummaryIfNeeded
      };

      emitAnswer(brainEngine as any, '今天天氣很棒！');

      expect(addTurn).toHaveBeenCalledWith('assistant', '今天天氣很棒！');
      expect(brainEngine.chatLog).toHaveLength(1);
      expect(applyEmotionFromText).toHaveBeenCalledWith('今天天氣很棒！');
      expect(onSpokenAudioPlayNow).toHaveBeenCalledWith('今天天氣很棒！');
      expect(triggerRollingSummaryIfNeeded).toHaveBeenCalled();

      // Empty text returns safely
      emitAnswer(brainEngine as any, '');
      emitAnswer(brainEngine as any, null as unknown as string);
    });
  });

  describe('answerQuestion (Engine Priority Routing & Fallback)', () => {
    it('should trigger onSpokenAudioTextChange on empty question', async () => {
      const onSpokenAudioTextChange = vi.fn();
      const brainEngine = {
        locale: 'zh-TW',
        onSpokenAudioTextChange
      };

      await answerQuestion(brainEngine as any, '   ');
      expect(onSpokenAudioTextChange).toHaveBeenCalled();
    });

    it('should route to AI Provider when enabled and ready', async () => {
      const chatWithAiProvider = vi.fn().mockResolvedValue(undefined);

      const brainEngine = {
        aiProvider: { enabled: true, ready: true },
        chatWithAiProvider
      };

      await answerQuestion(brainEngine as any, '測試問題');
      expect(chatWithAiProvider).toHaveBeenCalledWith('測試問題');
    });

    it('should fallback to WebLLM or Retrieval and trigger onBrainFallback when AI Provider errors', async () => {
      const onBrainFallback = vi.fn();
      const emitAnswerMock = vi.fn();

      const brainEngine = {
        aiProvider: { enabled: true, ready: true },
        chatWithAiProvider: vi.fn().mockRejectedValue(new Error('AI Provider offline')),
        llm: { state: STATE_MAP.READY },
        chatWithWebLLM: vi.fn().mockResolvedValue(undefined),
        onBrainFallback,
        emitAnswer: emitAnswerMock,
        STATE_MAP
      };

      await answerQuestion(brainEngine as any, '測試問題');

      expect(onBrainFallback).toHaveBeenCalledWith(
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER,
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM,
        expect.any(Error)
      );
      expect(brainEngine.chatWithWebLLM).toHaveBeenCalledWith('測試問題');
    });

    it('should trigger background WebLLM loading when AI provider is enabled but not ready', async () => {
      const loadMock = vi.fn().mockResolvedValue(undefined);
      const emitAnswerMock = vi.fn();

      const brainEngine = {
        autoFallbackWebLLM: true,
        aiProvider: { enabled: true, ready: false },
        llm: { supported: true, state: STATE_MAP.IDLE, load: loadMock },
        knowledge: [{ q: '測試', kw: '測試', a: '測試回答' }],
        emitAnswer: emitAnswerMock,
        STATE_MAP
      };

      await answerQuestion(brainEngine as any, '測試');
      expect(loadMock).toHaveBeenCalled();
      expect(emitAnswerMock).toHaveBeenCalledWith('測試回答');
    });

    it('should fallback to Retrieval when WebLLM throws error', async () => {
      const onBrainFallback = vi.fn();
      const emitAnswerMock = vi.fn();

      const brainEngine = {
        aiProvider: { enabled: false },
        llm: { state: STATE_MAP.READY },
        chatWithWebLLM: vi.fn().mockRejectedValue(new Error('WebLLM out of memory')),
        knowledge: [{ q: '你好', kw: '你好', a: '你好呀！' }],
        onBrainFallback,
        emitAnswer: emitAnswerMock,
        STATE_MAP
      };

      await answerQuestion(brainEngine as any, '你好');
      expect(onBrainFallback).toHaveBeenCalledWith(
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM,
        BRAIN_ENGINE_TYPE_MAP.RETRIEVAL,
        expect.any(Error)
      );
      expect(emitAnswerMock).toHaveBeenCalledWith('你好呀！');
    });
  });

  describe('validateBrainEngine', () => {
    it('should return isValid false when argument is not an object', () => {
      expect(validateBrainEngine(null)).toEqual({ isValid: false, missing: ['engine object'] });
      expect(validateBrainEngine(undefined)).toEqual({ isValid: false, missing: ['engine object'] });
      expect(validateBrainEngine('string')).toEqual({ isValid: false, missing: ['engine object'] });
    });

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

      const validation = validateBrainEngine(validEngine as any);
      expect(validation.isValid).toBe(true);
      expect(validation.missing).toEqual([]);
    });

    it('should return isValid false with missing method names when incomplete', () => {
      const incompleteEngine = {
        addChatMessage: () => {}
      };

      const validation = validateBrainEngine(incompleteEngine as any);
      expect(validation.isValid).toBe(false);
      expect(validation.missing.length).toBeGreaterThan(0);
    });

    it('should handle onBrainFallback error, trigger background WebLLM load, and fallback to default emitAnswer', async () => {
      const loadMock = vi.fn().mockRejectedValue(new Error('Load rejected'));
      const onBrainFallback = vi.fn().mockImplementation(() => {
        throw new Error('Hook failed');
      });

      const addChatMessageMock = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();
      const onSpokenDisplayTextChange = vi.fn();
      const onEmotionChange = vi.fn();

      const brainEngine: any = {
        aiProvider: { enabled: true, ready: false },
        autoFallbackWebLLM: true,
        llm: { supported: true, state: STATE_MAP.IDLE, load: loadMock },
        STATE_MAP,
        onBrainFallback,
        knowledge: [{ q: '知識', a: '答案' }],
        memory: { enabled: true, addTurn: vi.fn() },
        chatLog: [],
        addChatMessage: addChatMessageMock,
        onSpokenAudioPlayNow,
        onSpokenDisplayTextChange,
        onEmotionChange
      };

      // 1. aiProvider enabled but not ready -> triggers triggerBackgroundWebLLMLoad -> falls back to retrieval
      if (typeof brainEngine.answerQuestion === 'function') {
        await brainEngine.answerQuestion('知識');
      }

      // 2. aiProvider throws error -> onBrainFallback throws -> catches safely
      brainEngine.aiProvider.ready = true;
      brainEngine.aiProvider.chat = vi.fn().mockRejectedValue(new Error('AI Provider crash'));
      const { answerQuestion } = await import('@/core/brain/index');
      await answerQuestion(brainEngine, '知識');

      expect(loadMock).toHaveBeenCalled();
      expect(onBrainFallback).toHaveBeenCalled();
      expect(onSpokenAudioPlayNow).toHaveBeenCalled();
    });
  });
});
