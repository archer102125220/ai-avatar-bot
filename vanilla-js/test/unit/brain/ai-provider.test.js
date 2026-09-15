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

    it('should handle auto-continue when finishReason is length', async () => {
      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          type: 'text',
          content: '前半段回答...',
          finishReason: LLM_FINISH_REASON_MAP.LENGTH
        })
        .mockResolvedValueOnce({
          type: 'text',
          content: '後半段回答結束。',
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

      await chatWithAiProvider(brainEngine, '請詳細說明');

      expect(mockChat).toHaveBeenCalledTimes(2);
      expect(emitAnswer).toHaveBeenCalledWith('前半段回答...\n後半段回答結束。');
    });
  });
});
