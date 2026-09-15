import { vi } from 'vitest';

/**
 * 建立 Mock 串流回傳生成器 (Async Iterable)
 * @param {string[]} chunks - 欲依序輸出的文字片段陣列
 * @param {Object} [options={}] - 其他選項 (如附加 tool_calls)
 * @returns {AsyncIterable<Object>}
 */
export async function* createMockChatCompletionStream(chunks, options = {}) {
  for (const chunk of chunks) {
    yield {
      choices: [
        {
          delta: {
            content: chunk,
            role: 'assistant',
            ...(options.tool_calls ? { tool_calls: options.tool_calls } : {})
          },
          finish_reason: null
        }
      ]
    };
  }
  // 最後一個結束 chunk
  yield {
    choices: [
      {
        delta: {},
        finish_reason: options.finish_reason || 'stop'
      }
    ]
  };
}

/**
 * 建立 Mock AI Provider 實例
 * @param {Object} [options={}]
 * @returns {Object}
 */
export function createMockAiProvider(options = {}) {
  const defaultText = options.defaultText || '你好！我是你的 AI 助理。';
  return {
    name: options.name || 'openai',
    chat: vi.fn(async ({ messages, onStream, stream = true }) => {
      const chunks = [defaultText.slice(0, 3), defaultText.slice(3)];
      if (stream && typeof onStream === 'function') {
        for (const chunk of chunks) {
          onStream(chunk);
        }
      }
      return {
        text: defaultText,
        toolCalls: options.toolCalls || []
      };
    }),
    streamChat: vi.fn(async function* () {
      yield* createMockChatCompletionStream([defaultText]);
    })
  };
}

/**
 * 建立 Mock WebLLM MLCEngine
 * @param {Object} [options={}]
 * @returns {Object}
 */
export function createMockWebLLMEngine(options = {}) {
  const defaultResponse = options.defaultResponse || '來自 WebLLM 的回應';
  return {
    setInitProgressCallback: vi.fn(),
    reload: vi.fn(() => Promise.resolve()),
    chat: {
      completions: {
        create: vi.fn(async (params) => {
          if (params.stream) {
            return createMockChatCompletionStream([defaultResponse]);
          }
          return {
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: defaultResponse
                }
              }
            ]
          };
        })
      }
    },
    interruptGenerate: vi.fn(),
    resetChat: vi.fn()
  };
}
