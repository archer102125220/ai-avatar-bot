import { describe, it, expect, vi } from 'vitest';
import { initToolsEngine } from '../../../core/tools';

describe('Unit Test: core/tools/index.js', () => {
  it('should initialize tools engine with callbacks', () => {
    const onAddChatMessage = vi.fn();
    const onToolCancel = vi.fn();

    const engine = initToolsEngine({
      onAddChatMessage,
      onToolCancel,
      getChatLog: () => [],
      getChatSeq: () => 1
    });

    expect(engine).toBeDefined();
    expect(Array.isArray(engine.HOST_TOOLS)).toBe(true);
    expect(typeof engine.routeHostTool).toBe('function');
    expect(typeof engine.parameterPrompt).toBe('function');
  });

  it('should generate parameter prompt with choices if enum exists', () => {
    const engine = initToolsEngine({
      getChatLog: () => [],
      getChatSeq: () => 1
    });
    const tool = {
      name: 'order_drink',
      label: '點飲料',
      inputSchema: {
        type: 'object',
        properties: {
          sugar: {
            title: '甜度',
            enum: ['無糖', '半糖', '全糖']
          }
        }
      }
    };

    const prompt = engine.parameterPrompt(tool, 'sugar');
    expect(prompt).toContain('甜度');
    expect(prompt).toContain('可選：無糖、半糖、全糖');
  });

  it('should execute tool directly and return result', async () => {
    const executeMock = vi.fn(async ({ args }) => ({
      success: true,
      message: `已查詢 ${args.city} 的天氣`
    }));

    const tool = {
      name: 'get_weather',
      label: '查詢天氣',
      execute: executeMock
    };

    const engine = initToolsEngine({
      getChatLog: () => [],
      getChatSeq: () => 1,
      onUpdateChatMessage: vi.fn(),
      onAddChatMessage: vi.fn()
    });
    const result = await engine.executeToolDirectly(
      tool,
      { city: '台中' },
      { query: '查台中天氣' }
    );

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        args: { city: '台中' },
        query: '查台中天氣'
      })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe('已查詢 台中 的天氣');
  });
});
