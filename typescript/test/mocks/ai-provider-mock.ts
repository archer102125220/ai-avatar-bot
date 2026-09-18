import { vi } from 'vitest';

/**
 * 建立 Mock 串流回傳生成器 (Async Iterable)
 * @param chunks - 欲依序輸出的文字片段陣列
 * @param options - 其他選項 (如附加 tool_calls)
 * @returns AsyncIterable<any>
 */
export async function* createMockChatCompletionStream(
  chunks: string[],
  options: { tool_calls?: any[]; finish_reason?: string } = {}
): AsyncGenerator<any, void, unknown> {
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
 * @param options
 * @returns Mock AI Provider Object
 */
export function createMockAiProvider(options: { defaultText?: string; name?: string; toolCalls?: any[] } = {}) {
  const defaultText = options.defaultText || '你好！我是你的 AI 助理。';
  return {
    name: options.name || 'openai',
    chat: vi.fn(async ({ messages: _messages, onStream, stream = true }: { messages?: any[]; onStream?: (text: string) => void; stream?: boolean }) => {
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
 * @param options
 * @returns Mock WebLLM Engine Object
 */
export function createMockWebLLMEngine(options: { defaultResponse?: string } = {}): Record<string, any> {
  const defaultResponse = options.defaultResponse || '來自 WebLLM 的回應';
  return {
    setInitProgressCallback: vi.fn(),
    reload: vi.fn(() => Promise.resolve()),
    chat: {
      completions: {
        create: vi.fn(async (params: { stream?: boolean } = {}): Promise<any> => {
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
