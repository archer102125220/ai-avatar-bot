import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initAiProvider, chatWithAiProvider } from '../../../core/brain/ai-provider';
import {
  LLM_FINISH_REASON_MAP,
  AUTO_CONTINUE_MODE_MAP
} from '../../../core/constants';

describe('Unit Test: core/brain/ai-provider.js', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('initAiProvider', () => {
    it('should initialize with default options and auto-enable if baseUrl provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: ['llama-3'] })
      });

      const provider = await initAiProvider({
        providerBaseUrl: 'http://localhost:11434'
      });

      expect(provider.enabled).toBe(true);
      expect(provider.baseUrl).toBe('http://localhost:11434');
      expect(provider.ready).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        null
      );
    });

    it('should remain disabled if no baseUrl and enableAiProvider is false', async () => {
      const provider = await initAiProvider({
        enableAiProvider: false
      });

      expect(provider.enabled).toBe(false);
      expect(provider.ready).toBe(false);
    });
  });

  describe('ping', () => {
    it('should return true on successful response and invoke lifecycle hooks', async () => {
      const onConnecting = vi.fn();
      const onConnected = vi.fn();

      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const provider = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.example.com',
        onConnecting,
        onConnected
      });

      const result = await provider.ping();
      expect(result).toBe(true);
      expect(provider.ready).toBe(true);
      expect(onConnecting).toHaveBeenCalled();
      expect(onConnected).toHaveBeenCalled();
    });

    it('should return false and handle network error gracefully', async () => {
      const onError = vi.fn();
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const provider = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.example.com',
        onError
      });

      const result = await provider.ping();
      expect(result).toBe(false);
      expect(provider.ready).toBe(false);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('chat', () => {
    it('should send formatted messages and return text response', async () => {
      const mockResponse = {
        choices: [
          {
            message: { role: 'assistant', content: '這是 AI 的回覆' },
            finish_reason: 'stop'
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const provider = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.openai.com/v1',
        providerChatUrl: '/chat/completions'
      });

      const response = await provider.chat([{ role: 'user', content: '你好' }]);
      expect(response.type).toBe('text');
      expect(response.content).toBe('這是 AI 的回覆');
      expect(response.finishReason).toBe('stop');
    });

    it('should support tool calling schema in request and parse tool_calls response', async () => {
      const mockToolCallResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"city":"Taipei"}' }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockToolCallResponse
      });

      const provider = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.openai.com/v1'
      });

      const tools = [
        {
          name: 'get_weather',
          description: 'Get weather for a city',
          parameters: {
            type: 'object',
            properties: { city: { type: 'string' } }
          }
        }
      ];

      const response = await provider.chat(
        [{ role: 'user', content: '台北天氣如何？' }],
        null,
        tools
      );

      expect(response.type).toBe('tool_calls');
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls[0].function.name).toBe('get_weather');
    });

    it('should parse fallback <tool_call> XML tags from text content', async () => {
      const mockXmlResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: '<tool_call>{"name":"get_time","arguments":{}}</tool_call>'
            },
            finish_reason: 'stop'
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockXmlResponse
      });

      const provider = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.openai.com/v1'
      });

      const response = await provider.chat([{ role: 'user', content: '現在幾點？' }]);
      expect(response.type).toBe('tool_calls');
      expect(response.toolCalls[0].function.name).toBe('get_time');
    });

    it('should throw error when server returns non-ok HTTP status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Service unavailable'
      });

      const provider = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.openai.com/v1'
      });

      await expect(
        provider.chat([{ role: 'user', content: '測試失敗' }])
      ).rejects.toThrow('HTTP 500 Internal Server Error - Service unavailable');
    });
  });

  describe('chatWithAiProvider', () => {
    it('should orchestrate chat with AI Provider and emit answer', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        type: 'text',
        content: '今天天氣很好！',
        finishReason: 'stop'
      });

      const emitAnswer = vi.fn();
      const onEmotionChange = vi.fn();

      const brainEngine = {
        aiProvider: { chat: mockChat },
        locale: 'zh-TW',
        knowledge: [],
        memory: { enabled: false },
        compression: {},
        emitAnswer,
        onEmotionChange
      };

      await chatWithAiProvider(brainEngine, '今天天氣好嗎？');

      expect(onEmotionChange).toHaveBeenCalledWith('thinking');
      expect(mockChat).toHaveBeenCalled();
      expect(emitAnswer).toHaveBeenCalledWith('今天天氣很好！');
    });

    it('should handle auto-continue in STREAM mode with live updates and hooks', async () => {
      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          type: 'text',
          content: '串流第一段...',
          finishReason: LLM_FINISH_REASON_MAP.LENGTH
        })
        .mockResolvedValueOnce({
          type: 'text',
          content: '串流第二段完成。',
          finishReason: LLM_FINISH_REASON_MAP.STOP
        });

      const updateChatMessage = vi.fn();
      const applyEmotionFromText = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();
      const onAutoContinueStart = vi.fn();
      const onAutoContinueResume = vi.fn();
      const onAutoContinueEnd = vi.fn();
      const triggerRollingSummaryIfNeeded = vi.fn();
      const addTurn = vi.fn();

      const brainEngine = {
        aiProvider: { chat: mockChat },
        enableAutoContinue: true,
        maxAutoContinuations: 2,
        autoContinueMode: AUTO_CONTINUE_MODE_MAP.STREAM,
        locale: 'zh-TW',
        knowledge: [],
        memory: { enabled: true, addTurn },
        compression: {},
        updateChatMessage,
        applyEmotionFromText,
        onSpokenAudioPlayNow,
        onAutoContinueStart,
        onAutoContinueResume,
        onAutoContinueEnd,
        triggerRollingSummaryIfNeeded
      };

      await chatWithAiProvider(brainEngine, '請串流輸出');

      expect(mockChat).toHaveBeenCalledTimes(2);
      expect(onAutoContinueStart).toHaveBeenCalled();
      expect(onAutoContinueResume).toHaveBeenCalled();
      expect(onAutoContinueEnd).toHaveBeenCalled();
      expect(updateChatMessage).toHaveBeenCalled();
      expect(applyEmotionFromText).toHaveBeenCalled();
      expect(onSpokenAudioPlayNow).toHaveBeenCalled();
      expect(addTurn).toHaveBeenCalledWith('assistant', '串流第一段...\n串流第二段完成。');
      expect(triggerRollingSummaryIfNeeded).toHaveBeenCalled();
    });

    it('should support custom createFetchSetting, createFetchPayload, and responseFormat', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Custom Response' }, finish_reason: 'stop' }]
        })
      });

      const customCreateFetchSetting = vi.fn((_url, body) => ({
        method: 'POST',
        headers: { 'X-Custom-Auth': 'secret' },
        body: JSON.stringify(body)
      }));

      const customCreateFetchPayload = vi.fn((msgs, tools, format) => ({
        custom_messages: msgs,
        custom_tools: tools,
        response_format: format
      }));

      const provider = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://custom-api.example.com',
        providerCreateFetchSetting: customCreateFetchSetting,
        providerCreateFetchPayload: customCreateFetchPayload,
        providerResponseFormat: { type: 'json_object' }
      });

      const result = await provider.chat([{ role: 'user', content: 'hello' }]);

      expect(customCreateFetchSetting).toHaveBeenCalled();
      expect(customCreateFetchPayload).toHaveBeenCalled();
      expect(result.content).toBe('Custom Response');
    });

    it('should handle auto-continue in BUFFERED mode and emit final joined answer', async () => {
      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          type: 'text',
          content: '緩衝第一段...',
          finishReason: LLM_FINISH_REASON_MAP.LENGTH
        })
        .mockResolvedValueOnce({
          type: 'text',
          content: '緩衝第二段結束。',
          finishReason: LLM_FINISH_REASON_MAP.STOP
        });

      const emitAnswer = vi.fn();
      const brainEngine = {
        aiProvider: { chat: mockChat },
        enableAutoContinue: true,
        maxAutoContinuations: 2,
        autoContinueMode: AUTO_CONTINUE_MODE_MAP.BUFFERED,
        locale: 'zh-TW',
        knowledge: [],
        memory: { enabled: false },
        compression: {},
        emitAnswer
      };

      await chatWithAiProvider(brainEngine, '緩衝測試');

      expect(emitAnswer).toHaveBeenCalledWith('緩衝第一段...\n緩衝第二段結束。');
    });

    it('should handle tool_calls response in chatWithAiProvider and route to tools execution', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        type: 'tool_calls',
        toolCalls: [{ id: 'call_1', function: { name: 'get_weather', arguments: '{}' } }],
        message: { role: 'assistant', content: '' }
      });

      const brainEngine = {
        aiProvider: { chat: mockChat },
        locale: 'zh-TW',
        knowledge: [],
        memory: { enabled: true, addTurn: vi.fn() },
        executeTool: vi.fn(async () => ({ result: 'sunny' })),
        getToolByName: vi.fn(() => ({ name: 'get_weather' })),
        getTools: vi.fn(() => []),
        emitAnswer: vi.fn()
      };

      await chatWithAiProvider(brainEngine, '天氣如何');
      expect(mockChat).toHaveBeenCalled();
    });

    it('should throw error when initial AI Provider response is empty', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        type: 'text',
        content: '   '
      });

      const brainEngine = {
        aiProvider: { chat: mockChat },
        locale: 'zh-TW'
      };

      await expect(chatWithAiProvider(brainEngine, '測試空回覆')).rejects.toThrow('AI Provider 回應為空或格式錯誤');
    });
  });
});
