import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initWebLLM, chatWithWebLLM } from '../../../core/brain/web-llm';
import {
  STATE_MAP,
  LLM_FINISH_REASON_MAP,
  CHAT_ROLE_MAP
} from '../../../core/constants';
import * as WebLLMModule from '@mlc-ai/web-llm';

vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn().mockImplementation((model, options) => {
    if (typeof options?.initProgressCallback === 'function') {
      options.initProgressCallback({ progress: 0.5, text: 'Loading...' });
      options.initProgressCallback({ progress: 1.0, text: 'Ready' });
    }
    return Promise.resolve({
      chat: {
        completions: {
          create: vi.fn().mockImplementation((opt) => {
            if (opt.stream === true) {
              return (async function* () {
                yield { choices: [{ delta: { content: '你好' } }] };
                yield { choices: [{ delta: { content: '，世界！' }, finish_reason: 'stop' }] };
              })();
            }
            return Promise.resolve({
              choices: [
                {
                  message: { role: 'assistant', content: 'WebLLM 回應內容' },
                  finish_reason: 'stop'
                }
              ]
            });
          })
        }
      }
    });
  })
}));

describe('Unit Test: core/brain/web-llm.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initWebLLM', () => {
    it('should initialize with default idle state, callbacks, and getters', () => {
      const onLoading = vi.fn();
      const onLoadProgress = vi.fn();
      const onLoaded = vi.fn();
      const onLoadError = vi.fn();
      const onChatting = vi.fn();
      const onStreamChatting = vi.fn();

      const llm = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct-q4f32_1-MLC',
        llmMaxTokens: 512,
        llmIsStream: true,
        onLoading,
        onLoadProgress,
        onLoaded,
        onLoadError,
        onChatting,
        onStreamChatting
      });

      expect(llm.state).toBe(STATE_MAP.IDLE);
      expect(llm.progress).toBe(0);
      expect(llm.model).toBe('Llama-3-8B-Instruct-q4f32_1-MLC');
      expect(llm.maxTokens).toBe(512);
      expect(llm.isStream).toBe(true);
      expect(llm.supported).toBe(true); // navigator.gpu mocked in test/setup.js

      llm.onLoading();
      expect(onLoading).toHaveBeenCalled();

      llm.onLoadProgress({ progress: 0.5 });
      expect(onLoadProgress).toHaveBeenCalled();

      llm.onLoaded({});
      expect(onLoaded).toHaveBeenCalled();

      llm.onLoadError(new Error('err'));
      expect(onLoadError).toHaveBeenCalled();

      llm.onChatting({}, []);
      expect(onChatting).toHaveBeenCalled();

      llm.onStreamChatting('a', 'b');
      expect(onStreamChatting).toHaveBeenCalled();
    });

    it('should handle load error and transition to ERROR state', async () => {
      const origCreate = WebLLMModule.CreateMLCEngine;
      WebLLMModule.CreateMLCEngine.mockRejectedValueOnce(new Error('GPU out of memory'));

      const onLoadError = vi.fn();
      const llm = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct',
        onLoadError
      });

      await expect(llm.load()).rejects.toThrow('GPU out of memory');
      expect(llm.state).toBe(STATE_MAP.ERROR);
      expect(onLoadError).toHaveBeenCalled();

      WebLLMModule.CreateMLCEngine = origCreate;
    });
  });

  describe('chat', () => {
    it('should return null if engine is not loaded', async () => {
      const llm = initWebLLM({ llmModel: 'Llama-3-8B-Instruct' });
      const res = await llm.chat([{ role: 'user', content: 'hi' }]);
      expect(res).toBeNull();
    });

    it('should support Hermes Function Calling model and tool_calls response', async () => {
      let passedOptions;
      WebLLMModule.CreateMLCEngine.mockResolvedValueOnce({
        chat: {
          completions: {
            create: vi.fn().mockImplementation((opt) => {
              passedOptions = opt;
              return Promise.resolve({
                choices: [
                  {
                    message: {
                      role: 'assistant',
                      content: 'Checking weather...',
                      tool_calls: [
                        {
                          id: 'call_1',
                          type: 'function',
                          function: { name: 'get_weather', arguments: '{"city":"Tokyo"}' }
                        }
                      ]
                    },
                    finish_reason: 'tool_calls'
                  }
                ]
              });
            })
          }
        }
      });

      const llm = initWebLLM({
        llmModel: 'Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC'
      });
      await llm.load();

      const tools = [
        {
          name: 'get_weather',
          description: 'Get weather',
          inputSchema: { type: 'object', properties: { city: { type: 'string' } } }
        }
      ];

      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Weather in Tokyo' }
      ];

      const res = await llm.chat(messages, null, tools);
      expect(res.type).toBe('tool_calls');
      expect(res.toolCalls).toHaveLength(1);
      expect(passedOptions.tools).toBeDefined();
      // Verify system prompt was injected into first user message
      expect(passedOptions.messages[0].content).toContain('[Instruction: You are helpful]');
    });

    it('should parse fallback XML <tool_call> tags in non-stream and stream modes', async () => {
      // Non-stream XML fallback
      WebLLMModule.CreateMLCEngine.mockResolvedValueOnce({
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: '<tool_call>{"name":"get_time","arguments":{}}</tool_call>'
                  },
                  finish_reason: 'stop'
                }
              ]
            })
          }
        }
      });

      const llm = initWebLLM({ llmModel: 'Llama-3-8B-Instruct', llmIsStream: false });
      await llm.load();

      const res = await llm.chat([{ role: 'user', content: 'what time is it' }]);
      expect(res.type).toBe('tool_calls');
      expect(res.toolCalls[0].function.name).toBe('get_time');
    });

    it('should handle streaming tool_calls deltas accumulator', async () => {
      WebLLMModule.CreateMLCEngine.mockResolvedValueOnce({
        chat: {
          completions: {
            create: vi.fn().mockImplementation(() => (async function* () {
              yield {
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        { index: 0, id: 'call_abc', function: { name: 'calc', arguments: '{"a":' } }
                      ]
                    }
                  }
                ]
              };
              yield {
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        { index: 0, function: { arguments: '1}' } }
                      ]
                    },
                    finish_reason: 'tool_calls'
                  }
                ]
              };
            })())
          }
        }
      });

      const llm = initWebLLM({ llmModel: 'Llama-3-8B-Instruct', llmIsStream: true });
      await llm.load();

      const onDelta = vi.fn();
      const res = await llm.chat([{ role: 'user', content: 'calculate' }], onDelta, []);
      expect(res.type).toBe('tool_calls');
      expect(res.toolCalls[0].function.name).toBe('calc');
      expect(res.toolCalls[0].function.arguments).toBe('{"a":1}');
    });

    it('should catch CustomSystemPromptError on Function Calling and fallback to standard chat', async () => {
      let callCount = 0;
      WebLLMModule.CreateMLCEngine.mockResolvedValueOnce({
        chat: {
          completions: {
            create: vi.fn().mockImplementation((opt) => {
              callCount++;
              if (opt.tools) {
                throw new Error('CustomSystemPromptError: tools not supported');
              }
              return Promise.resolve({
                choices: [{ message: { role: 'assistant', content: '純文字回傳' }, finish_reason: 'stop' }]
              });
            })
          }
        }
      });

      const llm = initWebLLM({ llmModel: 'Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC', llmIsStream: false });
      await llm.load();

      const res = await llm.chat(
        [{ role: 'user', content: 'test' }],
        null,
        [{ name: 't', inputSchema: { type: 'object', properties: {} } }]
      );
      expect(callCount).toBe(2);
      expect(res.content).toBe('純文字回傳');
    });
  });

  describe('chatWithWebLLM', () => {
    it('should handle tool_calls response in chatWithWebLLM and route to executeToolCallsLoop', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          type: 'tool_calls',
          toolCalls: [{ id: '1', function: { name: 'mock_tool', arguments: '{}' } }],
          message: { role: 'assistant', content: '' }
        })
      };

      const brainEngine = {
        llm: mockLlm,
        locale: 'zh-TW',
        knowledge: [],
        memory: { enabled: true, addTurn: vi.fn() },
        executeTool: vi.fn(async () => ({ result: 'done' })),
        getToolByName: vi.fn(() => ({ name: 'mock_tool', label: '工具' })),
        getTools: vi.fn(() => []),
        onStreamStart: vi.fn(),
        updateChatMessage: vi.fn()
      };

      await chatWithWebLLM(brainEngine, '執行工具');
      expect(mockLlm.chat).toHaveBeenCalled();
    });

    it('should throw error when initial WebLLM response is empty', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          type: 'text',
          content: '   '
        })
      };

      const brainEngine = {
        llm: mockLlm,
        locale: 'zh-TW',
        onStreamStart: vi.fn(),
        onStreamEnd: vi.fn()
      };

      await expect(chatWithWebLLM(brainEngine, '請問在嗎？')).rejects.toThrow('WebLLM response is empty');
      expect(brainEngine.onStreamEnd).toHaveBeenCalledWith('');
    });

    it('should handle auto-continue loop when finishReason is length', async () => {
      let callCount = 0;
      const mockLlm = {
        chat: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              type: 'text',
              content: '第一段未完...',
              finishReason: LLM_FINISH_REASON_MAP.LENGTH
            });
          }
          return Promise.resolve({
            type: 'text',
            content: '第二段已結束。',
            finishReason: LLM_FINISH_REASON_MAP.STOP
          });
        })
      };

      const onAutoContinueStart = vi.fn();
      const onAutoContinueResume = vi.fn();
      const onAutoContinueEnd = vi.fn();
      const onStreamEnd = vi.fn();

      const brainEngine = {
        llm: mockLlm,
        enableAutoContinue: true,
        maxAutoContinuations: 2,
        locale: 'zh-TW',
        memory: { enabled: true, addTurn: vi.fn() },
        onAutoContinueStart,
        onAutoContinueResume,
        onAutoContinueEnd,
        onStreamEnd,
        updateChatMessage: vi.fn()
      };

      await chatWithWebLLM(brainEngine, '說長一點的故事');

      expect(callCount).toBe(2);
      expect(onAutoContinueStart).toHaveBeenCalled();
      expect(onAutoContinueResume).toHaveBeenCalled();
      expect(onAutoContinueEnd).toHaveBeenCalled();
      expect(onStreamEnd).toHaveBeenCalledWith(expect.stringContaining('第二段已結束'));
    });

    it('should handle streaming web-llm chat with stream chunk callbacks', async () => {
      async function* mockStreamGenerator() {
        yield {
          choices: [{ delta: { content: '第一句。' }, finish_reason: null }]
        };
        yield {
          choices: [{ delta: { content: '第二句。' }, finish_reason: 'stop' }]
        };
      }

      const mockLlm = {
        isStream: true,
        chat: vi.fn().mockImplementation(async (messages, onChunk) => {
          for await (const chunk of mockStreamGenerator()) {
            if (typeof onChunk === 'function') {
              onChunk(chunk);
            }
          }
          return {
            type: 'text',
            content: '第一句。第二句。',
            finishReason: 'stop'
          };
        })
      };

      const onStreamStart = vi.fn();
      const onStreamChunk = vi.fn();
      const onStreamEnd = vi.fn();

      const brainEngine = {
        llm: mockLlm,
        locale: 'zh-TW',
        memory: { enabled: true, addTurn: vi.fn() },
        onStreamStart,
        onStreamChunk,
        onStreamEnd,
        updateChatMessage: vi.fn()
      };

      await chatWithWebLLM(brainEngine, '串流測試');
      expect(onStreamStart).toHaveBeenCalled();
      expect(onStreamChunk).toHaveBeenCalled();
      expect(onStreamEnd).toHaveBeenCalledWith('第一句。第二句。');
    });
  });
});
