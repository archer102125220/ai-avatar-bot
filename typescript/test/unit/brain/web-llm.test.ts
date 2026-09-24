import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initWebLLM, chatWithWebLLM } from '@/core/brain/web-llm';
import { STATE_MAP, LLM_FINISH_REASON_MAP } from '@/core/constants';
import type { ToolDefinition } from '@/core/tools';
import type { LLMEngine } from '@core';

type WebLLMController = LLMEngine;

interface ChatTestResult {
  type?: string;
  content?: string;
  toolCalls?: Array<{
    id?: string;
    function: { name: string; arguments: string };
  }>;
}

import * as WebLLMModule from '@mlc-ai/web-llm';

const asMLCEngine = (mockInstance: unknown): WebLLMModule.MLCEngine =>
  mockInstance as WebLLMModule.MLCEngine;

vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn().mockImplementation((_model, options) => {
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
                yield {
                  choices: [
                    { delta: { content: '，世界！' }, finish_reason: 'stop' }
                  ]
                };
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

      const llm: WebLLMController = initWebLLM({
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
      expect(llm.supported).toBe(true); // navigator.gpu mocked in test/setup.ts

      llm.onLoading();
      expect(onLoading).toHaveBeenCalled();

      llm.onLoadProgress({ progress: 0.5, text: 'Loading' });
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
      vi.mocked(WebLLMModule.CreateMLCEngine).mockRejectedValueOnce(
        new Error('GPU out of memory')
      );

      const onLoadError = vi.fn();
      const llm: WebLLMController = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct',
        onLoadError
      });

      await expect(llm.load()).rejects.toThrow('GPU out of memory');
      expect(llm.state).toBe(STATE_MAP.ERROR);
      expect(onLoadError).toHaveBeenCalled();
    });

    it('should be idempotent if load() is called multiple times while already loaded', async () => {
      const llm: WebLLMController = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct'
      });
      await llm.load();
      expect(llm.state).toBe(STATE_MAP.READY);

      // Second load call should return same engine immediately
      const engine2 = await llm.load();
      expect(engine2).toBeDefined();
    });

    it('should handle supported flag when navigator.gpu is unavailable', () => {
      const origGpu = navigator.gpu;
      try {
        Reflect.deleteProperty(navigator, 'gpu');
        const llm: WebLLMController = initWebLLM();
        expect(llm.supported).toBe(false);
      } finally {
        Object.defineProperty(navigator, 'gpu', {
          value: origGpu,
          configurable: true,
          writable: true
        });
      }
    });
  });

  describe('chat', () => {
    it('should return null if engine is not loaded', async () => {
      const llm: WebLLMController = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct'
      });
      const res = await llm.chat([{ role: 'user', content: 'hi' }]);
      expect(res).toBeNull();
    });

    it('should fallback and remove tools if tool execution returns empty string', async () => {
      let callCount = 0;
      vi.mocked(WebLLMModule.CreateMLCEngine).mockResolvedValueOnce(
        asMLCEngine({
          chat: {
            completions: {
              create: vi.fn().mockImplementation((opt) => {
                callCount++;
                if (opt.tools) {
                  return Promise.resolve({
                    choices: [
                      {
                        message: { role: 'assistant', content: '  ' },
                        finish_reason: 'stop'
                      }
                    ]
                  });
                }
                return Promise.resolve({
                  choices: [
                    {
                      message: { role: 'assistant', content: '純文字重試成功' },
                      finish_reason: 'stop'
                    }
                  ]
                });
              })
            }
          }
        })
      );

      const llm: WebLLMController = initWebLLM({
        llmModel: 'Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC',
        llmIsStream: false
      });
      await llm.load();

      const res = await llm.chat([{ role: 'user', content: 'hi' }], null, [
        { name: 'mockTool', inputSchema: { type: 'object', properties: {} } }
      ] as ToolDefinition[]);

      expect(callCount).toBe(2);
      expect((res as ChatTestResult).content).toBe('純文字重試成功');
    });

    it('should catch UnsupportedModelIdError and fallback to standard chat', async () => {
      let callCount = 0;
      vi.mocked(WebLLMModule.CreateMLCEngine).mockResolvedValueOnce(
        asMLCEngine({
          chat: {
            completions: {
              create: vi.fn().mockImplementation((opt) => {
                callCount++;
                if (opt.tools) {
                  throw new Error(
                    'UnsupportedModelIdError: not supported for ChatCompletionRequest.tools'
                  );
                }
                return Promise.resolve({
                  choices: [
                    {
                      message: {
                        role: 'assistant',
                        content: '模型不支援工具，純文字回覆'
                      },
                      finish_reason: 'stop'
                    }
                  ]
                });
              })
            }
          }
        })
      );

      const llm: WebLLMController = initWebLLM({
        llmModel: 'Non-Hermes-Model',
        llmIsStream: false
      });
      await llm.load();

      const res = await llm.chat([{ role: 'user', content: 'test' }], null, [
        { name: 't', inputSchema: { type: 'object', properties: {} } }
      ] as ToolDefinition[]);
      expect(callCount).toBe(2);
      expect((res as ChatTestResult).content).toBe(
        '模型不支援工具，純文字回覆'
      );
    });

    it('should support Hermes Function Calling model and tool_calls response', async () => {
      let passedOptions: {
        tools?: unknown[];
        messages?: Array<{ role: string; content: string }>;
      } = {};
      vi.mocked(WebLLMModule.CreateMLCEngine).mockResolvedValueOnce(
        asMLCEngine({
          chat: {
            completions: {
              create: vi
                .fn()
                .mockImplementation((opt: typeof passedOptions) => {
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
                              function: {
                                name: 'get_weather',
                                arguments: '{"city":"Tokyo"}'
                              }
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
        })
      );

      const llm: WebLLMController = initWebLLM({
        llmModel: 'Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC'
      });
      await llm.load();

      const tools = [
        {
          name: 'get_weather',
          description: 'Get weather',
          inputSchema: {
            type: 'object',
            properties: { city: { type: 'string' } }
          }
        }
      ];

      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Weather in Tokyo' }
      ];

      const res = (await llm.chat(
        messages,
        null,
        tools as ToolDefinition[]
      )) as ChatTestResult;
      expect(res.type).toBe('tool_calls');
      expect(res.toolCalls).toHaveLength(1);
      expect(passedOptions.tools).toBeDefined();
      // Verify system prompt was injected into first user message
      expect(passedOptions.messages?.[0].content).toContain(
        '[Instruction: You are helpful]'
      );
    });

    it('should parse fallback XML <tool_call> tags in non-stream and stream modes', async () => {
      // Non-stream XML fallback
      vi.mocked(WebLLMModule.CreateMLCEngine).mockResolvedValueOnce(
        asMLCEngine({
          chat: {
            completions: {
              create: vi.fn().mockResolvedValue({
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
              })
            }
          }
        })
      );

      const llm: WebLLMController = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct',
        llmIsStream: false
      });
      await llm.load();

      const res = (await llm.chat([
        { role: 'user', content: 'what time is it' }
      ])) as ChatTestResult;
      expect(res.type).toBe('tool_calls');
      expect(res.toolCalls?.[0].function.name).toBe('get_time');
    });

    it('should handle streaming tool_calls deltas accumulator', async () => {
      vi.mocked(WebLLMModule.CreateMLCEngine).mockResolvedValueOnce(
        asMLCEngine({
          chat: {
            completions: {
              create: vi.fn().mockImplementation(() =>
                (async function* () {
                  yield {
                    choices: [
                      {
                        delta: {
                          tool_calls: [
                            {
                              index: 0,
                              id: 'call_abc',
                              function: { name: 'calc', arguments: '{"a":' }
                            }
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
                })()
              )
            }
          }
        })
      );

      const llm: WebLLMController = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct',
        llmIsStream: true
      });
      await llm.load();

      const onDelta = vi.fn();
      const res = (await llm.chat(
        [{ role: 'user', content: 'calculate' }],
        onDelta,
        []
      )) as ChatTestResult;
      expect(res.type).toBe('tool_calls');
      expect(res.toolCalls?.[0].function.name).toBe('calc');
      expect(res.toolCalls?.[0].function.arguments).toBe('{"a":1}');
    });

    it('should catch CustomSystemPromptError on Function Calling and fallback to standard chat', async () => {
      let callCount = 0;
      vi.mocked(WebLLMModule.CreateMLCEngine).mockResolvedValueOnce(
        asMLCEngine({
          chat: {
            completions: {
              create: vi.fn().mockImplementation((opt) => {
                callCount++;
                if (opt.tools) {
                  throw new Error(
                    'CustomSystemPromptError: tools not supported'
                  );
                }
                return Promise.resolve({
                  choices: [
                    {
                      message: { role: 'assistant', content: '純文字回傳' },
                      finish_reason: 'stop'
                    }
                  ]
                });
              })
            }
          }
        })
      );

      const llm: WebLLMController = initWebLLM({
        llmModel: 'Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC',
        llmIsStream: false
      });
      await llm.load();

      const res = await llm.chat([{ role: 'user', content: 'test' }], null, [
        { name: 't', inputSchema: { type: 'object', properties: {} } }
      ] as ToolDefinition[]);
      expect(callCount).toBe(2);
      expect((res as ChatTestResult).content).toBe('純文字回傳');
    });
  });

  describe('chatWithWebLLM', () => {
    it('should handle tool_calls response in chatWithWebLLM and route to executeToolCallsLoop', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          type: 'tool_calls',
          toolCalls: [
            { id: '1', function: { name: 'mock_tool', arguments: '{}' } }
          ],
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

      await expect(chatWithWebLLM(brainEngine, '請問在嗎？')).rejects.toThrow(
        'WebLLM response is empty'
      );
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
      expect(onStreamEnd).toHaveBeenCalledWith(
        expect.stringContaining('第二段已結束')
      );
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
        chat: vi.fn().mockImplementation(async (_messages, onChunk) => {
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

    it('should handle tool_calls response, custom buildLLMMessages, and early break in auto-continue', async () => {
      // 1. chatResponse with type 'tool_calls'
      const mockLlmToolCall = {
        chat: vi.fn().mockResolvedValue({
          type: 'tool_calls',
          toolCalls: [
            { id: 'call_1', function: { name: 'calc', arguments: '{}' } }
          ]
        })
      };

      const executeTool = vi.fn().mockResolvedValue({ ok: true });
      const brainEngineTool = {
        llm: mockLlmToolCall,
        locale: 'zh-TW',
        buildLLMMessages: vi
          .fn()
          .mockResolvedValue([{ role: 'user', content: '算一下' }]),
        getTools: vi.fn(() => [{ name: 'calc' }]),
        executeTool,
        aiProvider: { chat: vi.fn().mockResolvedValue('計算結果總結') },
        emitAnswer: vi.fn(),
        updateChatMessage: vi.fn(),
        onSpokenDisplayTextChange: vi.fn(),
        onEmotionChange: vi.fn()
      };

      await chatWithWebLLM(brainEngineTool, '算一下');
      expect(brainEngineTool.buildLLMMessages).toHaveBeenCalled();
      expect(brainEngineTool.onEmotionChange).toHaveBeenCalledWith('thinking');

      // 2. Auto-continue with empty next chunk breaks loop early
      let continueCount = 0;
      const mockLlmEmptyChunk = {
        chat: vi.fn().mockImplementation((_msgs: unknown, onChunk: unknown) => {
          continueCount++;
          if (continueCount === 1) {
            if (typeof onChunk === 'function') onChunk('開頭...', '開頭...');
            return Promise.resolve({
              type: 'text',
              content: '開頭...',
              finishReason: LLM_FINISH_REASON_MAP.LENGTH
            });
          }
          if (typeof onChunk === 'function') onChunk('', '');
          return Promise.resolve({
            type: 'text',
            content: '   ', // empty next chunk -> breaks
            finishReason: LLM_FINISH_REASON_MAP.LENGTH
          });
        })
      };

      const onAutoContinueEnd = vi.fn();
      const brainEngineAuto = {
        llm: mockLlmEmptyChunk,
        enableAutoContinue: true,
        maxAutoContinuations: 3,
        locale: 'zh-TW',
        memory: { enabled: true, addTurn: vi.fn() },
        onAutoContinueStart: vi.fn(),
        onAutoContinueResume: vi.fn(),
        onAutoContinueEnd,
        onStreamEnd: vi.fn(),
        triggerRollingSummaryIfNeeded: vi.fn(),
        applyEmotionFromText: vi.fn(),
        updateChatMessage: vi.fn()
      };

      await chatWithWebLLM(brainEngineAuto, '講故事');
      expect(onAutoContinueEnd).toHaveBeenCalled();
      expect(brainEngineAuto.triggerRollingSummaryIfNeeded).toHaveBeenCalled();
    });

    it('should handle streaming tool call delta chunks and JSON text tool call extraction', async () => {
      // 1. Streaming delta tool calls
      vi.mocked(WebLLMModule.CreateMLCEngine).mockResolvedValueOnce(
        asMLCEngine({
          chat: {
            completions: {
              create: vi.fn().mockImplementation(() =>
                (async function* () {
                  yield {
                    choices: [
                      {
                        delta: {
                          tool_calls: [
                            {
                              index: 0,
                              id: 'call_stream_1',
                              function: {
                                name: 'search_data',
                                arguments: '{"q":'
                              }
                            }
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
                            {
                              index: 0,
                              function: { arguments: '"avatar"}' }
                            }
                          ]
                        },
                        finish_reason: 'tool_calls'
                      }
                    ]
                  };
                })()
              )
            }
          }
        })
      );

      const llm: WebLLMController = initWebLLM({ llmIsStream: true });
      await llm.load();
      const res = (await llm.chat(
        [{ role: 'user', content: '搜尋' }],
        vi.fn(),
        [{ name: 'search_data' }] as ToolDefinition[]
      )) as ChatTestResult;
      expect(res.type).toBe('tool_calls');
      expect(res.toolCalls?.[0].function.arguments).toBe('{"q":"avatar"}');

      // 2. Stream fallback text tool calls
      vi.mocked(WebLLMModule.CreateMLCEngine).mockResolvedValueOnce(
        asMLCEngine({
          chat: {
            completions: {
              create: vi.fn().mockImplementation(() =>
                (async function* () {
                  yield {
                    choices: [
                      {
                        delta: {
                          content:
                            '<tool_call>{"name":"get_time","arguments":{"zone":"UTC"}}</tool_call>'
                        },
                        finish_reason: 'stop'
                      }
                    ]
                  };
                })()
              )
            }
          }
        })
      );

      const llm2: WebLLMController = initWebLLM({ llmIsStream: true });
      await llm2.load();
      const res2 = (await llm2.chat(
        [{ role: 'user', content: '現在時間' }],
        vi.fn()
      )) as ChatTestResult;
      expect(res2.type).toBe('tool_calls');
      expect(res2.toolCalls?.[0].function.name).toBe('get_time');
    });

    it('should degrade to pure conversation mode when Function Calling is not supported by model', async () => {
      let attempt = 0;
      vi.mocked(WebLLMModule.CreateMLCEngine).mockResolvedValueOnce(
        asMLCEngine({
          chat: {
            completions: {
              create: vi.fn().mockImplementation((opt) => {
                attempt++;
                if (attempt === 1 && opt.tools) {
                  throw new Error(
                    'not supported for ChatCompletionRequest.tools on this model'
                  );
                }
                return Promise.resolve({
                  choices: [
                    {
                      message: { role: 'assistant', content: '降級純對話回答' },
                      finish_reason: 'stop'
                    }
                  ]
                });
              })
            }
          }
        })
      );

      const llm: WebLLMController = initWebLLM({ llmIsStream: false });
      await llm.load();
      const res = (await llm.chat(
        [{ role: 'user', content: '測試降級' }],
        null,
        [{ name: 'tool_a' }] as ToolDefinition[]
      )) as ChatTestResult;
      expect(res.type).toBe('text');
      expect(res.content).toBe('降級純對話回答');
    });

    it('should test resolvedIsStream options and streaming continuation in chatWithWebLLM', async () => {
      // 1. isStream & LLMIsStream options resolution
      const llm1: WebLLMController = initWebLLM({ isStream: false });
      expect(llm1.isStream).toBe(false);

      const llm2: WebLLMController = initWebLLM({ LLMIsStream: false });
      expect(llm2.isStream).toBe(false);

      // 2. chatWithWebLLM with streaming auto-continue triggering stream callbacks
      let chatCallCount = 0;
      const onSpokenDisplayTextChange = vi.fn();
      const updateChatMessage = vi.fn();
      const applyEmotionFromText = vi.fn();
      const onStreamChunk = vi.fn();
      const onAutoContinueStart = vi.fn();
      const onAutoContinueResume = vi.fn();
      const onAutoContinueEnd = vi.fn();

      const mockLlm = {
        state: STATE_MAP.READY,
        isStream: true,
        chat: vi.fn().mockImplementation((_msgs, streamCb) => {
          chatCallCount++;
          if (chatCallCount === 1) {
            if (typeof streamCb === 'function') {
              streamCb('第一段文字', '第一段文字');
            }
            return Promise.resolve({
              type: 'text',
              content: '第一段文字',
              finishReason: LLM_FINISH_REASON_MAP.LENGTH
            });
          }
          if (typeof streamCb === 'function') {
            streamCb('接續第二段', '接續第二段');
          }
          return Promise.resolve({
            type: 'text',
            content: '接續第二段',
            finishReason: LLM_FINISH_REASON_MAP.STOP
          });
        })
      };

      const onStreamEnd = vi.fn();

      const brainEngine = {
        llm: mockLlm,
        onSpokenDisplayTextChange,
        updateChatMessage,
        applyEmotionFromText,
        onStreamChunk,
        onStreamEnd,
        onAutoContinueStart,
        onAutoContinueResume,
        onAutoContinueEnd,
        enableAutoContinue: true,
        maxAutoContinuations: 2
      };

      await chatWithWebLLM(brainEngine, [
        { role: 'user', content: '長篇故事' }
      ] as unknown as string);

      expect(onStreamEnd).toHaveBeenCalledWith(
        expect.stringContaining('第一段文字')
      );
      expect(onStreamEnd).toHaveBeenCalledWith(
        expect.stringContaining('接續第二段')
      );
      expect(onSpokenDisplayTextChange).toHaveBeenCalled();
      expect(updateChatMessage).toHaveBeenCalled();
      expect(applyEmotionFromText).toHaveBeenCalled();
      expect(onStreamChunk).toHaveBeenCalled();
      expect(onAutoContinueStart).toHaveBeenCalled();
      expect(onAutoContinueResume).toHaveBeenCalled();
      expect(onAutoContinueEnd).toHaveBeenCalled();
    });
  });
});
