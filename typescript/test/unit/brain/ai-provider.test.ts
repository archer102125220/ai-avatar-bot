import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initAiProvider,
  chatWithAiProvider,
  type AiProviderEngine
} from '@/core/brain/ai-provider';
import {
  LLM_FINISH_REASON_MAP,
  AUTO_CONTINUE_MODE_MAP
} from '@/core/constants';
import type { BrainEngine, LLMMessage } from '@/core/brain/types';
import type { ToolDefinition } from '@/core/tools';

type AiProviderController = AiProviderEngine;

describe('Unit Test: core/brain/ai-provider.js', () => {
  let originalFetch: typeof global.fetch;

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
      } as unknown as Response);

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
      const provider: AiProviderController = await initAiProvider({
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

      global.fetch = vi
        .fn()
        .mockResolvedValue({ ok: true } as unknown as Response);

      const provider: AiProviderController = await initAiProvider({
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

      const provider: AiProviderController = await initAiProvider({
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
    it('should format messages correctly, invoke chat completion endpoint, and return parsed response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: '這是 AI 的回覆'
            },
            finish_reason: 'stop'
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as unknown as Response);

      const provider: AiProviderController = await initAiProvider({
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
                  function: {
                    name: 'get_weather',
                    arguments: '{"city":"Taipei"}'
                  }
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
      } as unknown as Response);

      const provider: AiProviderController = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.openai.com/v1'
      });

      const tools: ToolDefinition[] = [
        {
          name: 'get_weather',
          description: 'Get weather for a city',
          inputSchema: {
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
      expect(response.toolCalls?.[0]?.function?.name).toBe('get_weather');
    });

    it('should parse fallback <tool_call> XML tags from text content', async () => {
      const mockXmlResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                '<tool_call>{"name":"get_time","arguments":{}}</tool_call>'
            },
            finish_reason: 'stop'
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockXmlResponse
      } as unknown as Response);

      const provider: AiProviderController = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.openai.com/v1'
      });

      const response = await provider.chat([
        { role: 'user', content: '現在幾點？' }
      ]);
      expect(response.type).toBe('tool_calls');
      expect(response.toolCalls?.[0]?.function?.name).toBe('get_time');
    });

    it('should throw error when server returns non-ok HTTP status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Service unavailable'
      } as unknown as Response);

      const provider: AiProviderController = await initAiProvider({
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
      } as unknown as BrainEngine;

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
      } as unknown as BrainEngine;

      await chatWithAiProvider(brainEngine, '請串流輸出');

      expect(mockChat).toHaveBeenCalledTimes(2);
      expect(onAutoContinueStart).toHaveBeenCalled();
      expect(onAutoContinueResume).toHaveBeenCalled();
      expect(onAutoContinueEnd).toHaveBeenCalled();
      expect(updateChatMessage).toHaveBeenCalled();
      expect(applyEmotionFromText).toHaveBeenCalled();
      expect(onSpokenAudioPlayNow).toHaveBeenCalled();
      expect(addTurn).toHaveBeenCalledWith(
        'assistant',
        '串流第一段...\n串流第二段完成。'
      );
      expect(triggerRollingSummaryIfNeeded).toHaveBeenCalled();
    });

    it('should sanitize nested and non-string message contents before sending', async () => {
      let sentBody:
        { messages: Array<{ role: string; content: string }> } | undefined;
      global.fetch = vi
        .fn()
        .mockImplementation((_url: string, opt?: RequestInit) => {
          sentBody = JSON.parse(opt?.body as string);
          return Promise.resolve({
            ok: true,
            json: async () => ({
              choices: [{ message: { role: 'assistant', content: 'OK' } }],
              done_reason: 'length'
            })
          } as unknown as Response);
        });

      const provider: AiProviderController = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.openai.com/v1'
      });

      const res = await provider.chat([
        {
          role: 'user',
          content: { content: '從 content.content 取出的文字' }
        } as unknown as LLMMessage,
        { role: 'assistant', content: { other: 123 } } as unknown as LLMMessage,
        { role: 'user', content: 8888 as unknown as string }
      ]);

      expect(sentBody?.messages[0]?.content).toBe(
        '從 content.content 取出的文字'
      );
      expect(sentBody?.messages[1]?.content).toBe('{"other":123}');
      expect(sentBody?.messages[2]?.content).toBe('8888');
      expect(res.finishReason).toBe('length');
    });

    it('should support custom extractToolCalls and custom responseFormat function', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ raw_custom_data: 123 })
      } as unknown as Response);

      const customFormat = vi.fn(async () => ({
        type: 'text',
        content: '自訂格式化結果'
      }));

      const provider: AiProviderController = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.openai.com/v1',
        providerResponseFormat: customFormat
      });

      const result = await provider.chat([{ role: 'user', content: 'test' }]);
      expect(customFormat).toHaveBeenCalled();
      expect(result.content).toBe('自訂格式化結果');
    });

    it('should support custom extractToolCalls function', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          custom_tool_payload: [{ id: '99', fn: 'my_custom_tool' }]
        })
      } as unknown as Response);

      const customExtractToolCalls = vi.fn((res: unknown) => {
        const payload = (
          res as { custom_tool_payload?: Array<{ id: string; fn: string }> }
        )?.custom_tool_payload;
        return [
          {
            id: payload?.[0]?.id || '',
            function: { name: payload?.[0]?.fn || '', arguments: '{}' }
          }
        ];
      });

      const provider: AiProviderController = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.openai.com/v1',
        providerExtractToolCalls: customExtractToolCalls
      });

      const result = await provider.chat([
        { role: 'user', content: 'call custom' }
      ]);
      expect(customExtractToolCalls).toHaveBeenCalled();
      expect(result.type).toBe('tool_calls');
      expect(result.toolCalls?.[0]?.function?.name).toBe('my_custom_tool');
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
      } as unknown as BrainEngine;

      await chatWithAiProvider(brainEngine, '緩衝測試');

      expect(emitAnswer).toHaveBeenCalledWith(
        '緩衝第一段...\n緩衝第二段結束。'
      );
    });

    it('should handle tool_calls response in chatWithAiProvider and route to tools execution', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        type: 'tool_calls',
        toolCalls: [
          { id: 'call_1', function: { name: 'get_weather', arguments: '{}' } }
        ],
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
      } as unknown as BrainEngine;

      await chatWithAiProvider(brainEngine, '天氣如何');
      expect(mockChat).toHaveBeenCalled();
    });

    it('should throw error when AI Provider response is empty or invalid format', async () => {
      const mockChat = vi.fn().mockResolvedValue(null);
      const brainEngine = {
        aiProvider: { chat: mockChat },
        locale: 'zh-TW',
        knowledge: [],
        memory: { enabled: true, addTurn: vi.fn() },
        emitAnswer: vi.fn()
      } as unknown as BrainEngine;
      await expect(
        chatWithAiProvider(brainEngine, '測試空回覆')
      ).rejects.toThrow('AI Provider 回應為空或格式錯誤');
    });

    it('should handle auto-continue loop in stream mode and single_turn mode', async () => {
      // 1. Auto-continue in STREAM mode
      let callCount = 0;
      const mockChatStream = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            type: 'text',
            content: '這是第一段文字...',
            finishReason: LLM_FINISH_REASON_MAP.LENGTH
          });
        }
        return Promise.resolve({
          type: 'text',
          content: '這是第二段文字結束。',
          finishReason: LLM_FINISH_REASON_MAP.STOP
        });
      });

      const onAutoContinueStart = vi.fn();
      const onAutoContinueResume = vi.fn();
      const onAutoContinueEnd = vi.fn();
      const addChatMessage = vi.fn().mockReturnValue('msg_stream_1');
      const updateChatMessage = vi.fn();
      const applyEmotionFromText = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();
      const triggerRollingSummaryIfNeeded = vi.fn();

      const brainEngineStream = {
        aiProvider: { chat: mockChatStream },
        enableAutoContinue: true,
        maxAutoContinuations: 2,
        autoContinueMode: AUTO_CONTINUE_MODE_MAP.STREAM,
        locale: 'zh-TW',
        memory: { enabled: true, addTurn: vi.fn() },
        buildLLMMessages: vi
          .fn()
          .mockResolvedValue([{ role: 'user', content: '故事' }]),
        onAutoContinueStart,
        onAutoContinueResume,
        onAutoContinueEnd,
        addChatMessage,
        updateChatMessage,
        applyEmotionFromText,
        onSpokenAudioPlayNow,
        triggerRollingSummaryIfNeeded,
        onSpokenDisplayTextChange: vi.fn(),
        onEmotionChange: vi.fn()
      } as unknown as BrainEngine;

      await chatWithAiProvider(brainEngineStream, '講長故事');

      expect(callCount).toBe(2);
      expect(onAutoContinueStart).toHaveBeenCalled();
      expect(onAutoContinueResume).toHaveBeenCalled();
      expect(onAutoContinueEnd).toHaveBeenCalled();
      expect(addChatMessage).toHaveBeenCalledWith(
        'assistant',
        '這是第一段文字...'
      );
      expect(updateChatMessage).toHaveBeenCalledWith(
        'msg_stream_1',
        expect.stringContaining('這是第二段文字結束'),
        false
      );
      expect(onSpokenAudioPlayNow).toHaveBeenCalled();
      expect(triggerRollingSummaryIfNeeded).toHaveBeenCalled();
    });

    it('should support custom createFetchPayload and format HTTP error with text body', async () => {
      // 1. Custom createFetchPayload
      let customPayloadPassed: boolean | undefined;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '自訂負載成功' } }]
        })
      } as unknown as Response);

      const provider: AiProviderController = await initAiProvider({
        enableAiProvider: true,
        providerBaseUrl: 'https://api.custom.com',
        providerCreateFetchPayload: async (msgs: unknown) => {
          customPayloadPassed = true;
          return JSON.stringify({ custom_msgs: msgs });
        }
      });

      const res = await provider.chat([{ role: 'user', content: 'hello' }]);
      expect(customPayloadPassed).toBe(true);
      expect(res.content).toBe('自訂負載成功');

      // 2. HTTP error with error text
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid model parameter'
      } as unknown as Response);

      await expect(
        provider.chat([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('HTTP 400 Bad Request - Invalid model parameter');
    });

    it('should break auto-continue loop early on empty next chunk and handle missing emitAnswer in BUFFERED mode', async () => {
      // 1. Empty next chunk break in auto-continue
      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          type: 'text',
          content: '開頭篇章',
          finishReason: LLM_FINISH_REASON_MAP.LENGTH
        })
        .mockResolvedValueOnce({
          type: 'text',
          content: '   ', // empty chunk -> breaks loop
          finishReason: LLM_FINISH_REASON_MAP.LENGTH
        });

      const onAutoContinueEnd = vi.fn();
      const brainEngine = {
        aiProvider: { chat: mockChat },
        enableAutoContinue: true,
        maxAutoContinuations: 3,
        autoContinueMode: AUTO_CONTINUE_MODE_MAP.BUFFERED,
        locale: 'zh-TW',
        memory: { enabled: false },
        onAutoContinueEnd
      } as unknown as BrainEngine;

      await chatWithAiProvider(brainEngine, '講故事');
      expect(onAutoContinueEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          totalContinuations: 1
        })
      );
    });
  });
});
