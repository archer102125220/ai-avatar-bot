import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractToolCallsFromText,
  executeToolCallsLoop
} from '@/core/brain/tool-calling';
import { BRAIN_ENGINE_TYPE_MAP } from '@/core/constants';
import type { BrainEngine, LLMMessage } from '@/core/brain/types';
import type { ToolDefinition } from '@/core/tools/types';

describe('Brain Tool Calling Subsystem (Deep Branch Coverage)', () => {
  describe('extractToolCallsFromText', () => {
    it('should extract tool calls from text and handle non-string arguments', () => {
      expect(extractToolCallsFromText('')).toEqual([]);
      expect(extractToolCallsFromText(null)).toEqual([]);

      const xmlText = `
        Let me check the weather:
        <tool_call>
        {"name": "get_weather", "arguments": {"city": "Taipei"}}
        </tool_call>
        and another:
        <tool_call>
        {"name": "get_time", "arguments": "direct_str"}
        </tool_call>
        and malformed:
        <tool_call>
        {invalid_json}
        </tool_call>
      `;

      const tools = extractToolCallsFromText(xmlText);
      expect(tools.length).toBe(2);
      expect(tools[0].function.name).toBe('get_weather');
      expect(tools[0].function.arguments).toBe('{"city":"Taipei"}');
      expect(tools[1].function.name).toBe('get_time');
      expect(tools[1].function.arguments).toBe('direct_str');
    });
  });

  describe('executeToolCallsLoop', () => {
    let mockBrainEngine: Record<string, unknown>;

    beforeEach(() => {
      mockBrainEngine = {
        getToolByName: vi.fn((name: string) => {
          if (name === 'registered_tool') {
            return { name: 'registered_tool', requiresConfirmation: false };
          }
          if (name === 'dangerous_tool') {
            return { name: 'dangerous_tool', requiresConfirmation: true };
          }
          return null;
        }),
        executeTool: vi.fn(async (_tool: ToolDefinition, args: Record<string, unknown>) => ({ ok: true, data: args })),
        offerToolConfirmation: vi.fn(),
        onToolNotFound: vi.fn(async ({ toolName }: { toolName: string }) => ({ ok: false, error: `Custom not found: ${toolName}` })),
        onToolError: vi.fn(async ({ error }: { error: Error }) => ({ ok: false, error: `Custom error: ${error.message}` })),
        emitAnswer: vi.fn(),
        aiProvider: {
          chat: vi.fn(async () => 'AI Provider Summary of Tool')
        },
        llm: {
          chat: vi.fn(async (_msgs: LLMMessage[], onChunk: (chunk: string, full: string) => void) => {
            onChunk('Chunk 1', 'Chunk 1');
            onChunk('Chunk 2', 'Chunk 1Chunk 2');
            return 'WebLLM Tool Summary';
          })
        },
        memory: {
          enabled: true,
          addTurn: vi.fn()
        },
        onStreamStart: vi.fn(),
        onStreamChunk: vi.fn(),
        onStreamEnd: vi.fn(),
        onSpokenDisplayTextChange: vi.fn(),
        updateChatMessage: vi.fn(),
        applyEmotionFromText: vi.fn(),
        triggerRollingSummaryIfNeeded: vi.fn()
      };
    });

    it('should safely return if toolCalls is empty', async () => {
      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, { toolCalls: [] }, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    });

    it('should handle tool not found and trigger onToolNotFound hook', async () => {
      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'missing_tool', arguments: '{"q": 1}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);

      expect(mockBrainEngine.onToolNotFound as ReturnType<typeof vi.fn>).toHaveBeenCalled();
      expect((mockBrainEngine.aiProvider as { chat: ReturnType<typeof vi.fn> }).chat).toHaveBeenCalled();
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('AI Provider Summary of Tool');
    });

    it('should handle tool execution error and trigger onToolError hook', async () => {
      mockBrainEngine.executeTool = vi.fn().mockRejectedValue(new Error('Boom!'));
      mockBrainEngine.onToolError = vi.fn().mockImplementation(() => {
        throw new Error('Hook threw');
      });

      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'registered_tool', arguments: '{"q": 1}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);

      expect(mockBrainEngine.onToolError as ReturnType<typeof vi.fn>).toHaveBeenCalled();
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    });

    it('should fallback to string or message in lastResult when summary response is empty', async () => {
      // 1. lastResult as direct string
      (mockBrainEngine.aiProvider as { chat: ReturnType<typeof vi.fn> }).chat = vi.fn().mockResolvedValue('');
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue('直接字串結果');

      const toolCallResponse1 = {
        toolCalls: [
          { id: 'call_str', function: { name: 'registered_tool', arguments: '{}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse1, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('直接字串結果');

      // 2. lastResult as object with message property
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({ message: '物件訊息回傳' });
      const toolCallResponse2 = {
        toolCalls: [
          { id: 'call_msg', function: { name: 'registered_tool', arguments: '{}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse2, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('物件訊息回傳');
    });

    it('should handle tool confirmation required and resume after confirmation', async () => {
      let confirmationContext: { onConfirmResume: (res: Record<string, unknown>) => Promise<void> } | undefined;
      mockBrainEngine.offerToolConfirmation = vi.fn((_tool: unknown, _args: unknown, ctx: { onConfirmResume: (res: Record<string, unknown>) => Promise<void> }) => {
        confirmationContext = ctx;
      });

      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'dangerous_tool', arguments: '{"action":"delete"}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);

      expect(mockBrainEngine.offerToolConfirmation as ReturnType<typeof vi.fn>).toHaveBeenCalled();

      // Test cancelled
      await confirmationContext?.onConfirmResume({ cancelled: true });
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();

      // Test confirmed
      await confirmationContext?.onConfirmResume({ ok: true, deleted: true });
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('AI Provider Summary of Tool');
    });

    it('should execute WebLLM streaming second round summary', async () => {
      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'registered_tool', arguments: '{"q": 1}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.WEB_LLM);

      expect(mockBrainEngine.onStreamStart as ReturnType<typeof vi.fn>).toHaveBeenCalled();
      expect((mockBrainEngine.llm as { chat: ReturnType<typeof vi.fn> }).chat).toHaveBeenCalled();
      expect(mockBrainEngine.onStreamChunk as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('Chunk 1');
      expect((mockBrainEngine.memory as { addTurn: ReturnType<typeof vi.fn> }).addTurn).toHaveBeenCalledWith('assistant', 'WebLLM Tool Summary');
      expect(mockBrainEngine.onStreamEnd as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('WebLLM Tool Summary');
      expect(mockBrainEngine.triggerRollingSummaryIfNeeded as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    });

    it('should fallback to lastResult error, message, or default string when summary response is empty', async () => {
      // 1. AI Provider with empty summary and lastResult has error
      (mockBrainEngine.aiProvider as { chat: ReturnType<typeof vi.fn> }).chat = vi.fn().mockResolvedValue('');
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({ ok: false, error: 'Database timeout' });

      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'registered_tool', arguments: '{}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('Database timeout');

      // 2. AI Provider with empty summary and lastResult is a plain string
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue('Plain result string');
      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('Plain result string');

      // 3. AI Provider with empty summary and lastResult has message
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({ ok: true, message: 'Updated 5 items' });
      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('Updated 5 items');

      // 4. AI Provider with empty summary and empty lastResult -> defaults to brain.toolExecutionError
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({});
      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    });

    it('should fallback to WebLLM lastResult when streaming summary is empty', async () => {
      (mockBrainEngine.llm as { chat: ReturnType<typeof vi.fn> }).chat = vi.fn().mockResolvedValue({ content: '' });
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({ ok: false, error: 'WebLLM tool error' });

      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'registered_tool', arguments: '{}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.WEB_LLM);
      expect(mockBrainEngine.onStreamEnd as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('WebLLM tool error');

      // Test with plain string result in WebLLM mode
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue('WebLLM plain string result');
      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.WEB_LLM);
      expect(mockBrainEngine.onStreamEnd as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('WebLLM plain string result');

      // Test with message property in WebLLM mode
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({ message: 'WebLLM message result' });
      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.WEB_LLM);
      expect(mockBrainEngine.onStreamEnd as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('WebLLM message result');

      // Test with empty lastResult in WebLLM mode -> error fallback
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({});
      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.WEB_LLM);
      expect(mockBrainEngine.onStreamEnd as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    });

    it('should handle malformed JSON in tool call arguments and throwing onToolNotFound hook', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockBrainEngine.onToolNotFound = vi.fn(() => {
        throw new Error('onToolNotFound hook exploded');
      });

      const toolCallResponse = {
        toolCalls: [
          { id: 'call_bad', function: { name: 'unknown_tool', arguments: '{invalid JSON' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine as unknown as BrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('onToolNotFound 回呼執行錯誤'), expect.any(Error));

      consoleErrorSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });
});
