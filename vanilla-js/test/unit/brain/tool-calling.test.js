import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractToolCallsFromText,
  executeToolCallsLoop
} from '@/core/brain/tool-calling';
import { BRAIN_ENGINE_TYPE_MAP } from '@/core/constants';


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
    let mockBrainEngine;

    beforeEach(() => {
      mockBrainEngine = {
        getToolByName: vi.fn((name) => {
          if (name === 'registered_tool') {
            return { name: 'registered_tool', requiresConfirmation: false };
          }
          if (name === 'dangerous_tool') {
            return { name: 'dangerous_tool', requiresConfirmation: true };
          }
          return null;
        }),
        executeTool: vi.fn(async (_tool, args) => ({ ok: true, data: args })),
        offerToolConfirmation: vi.fn(),
        onToolNotFound: vi.fn(async ({ toolName }) => ({ ok: false, error: `Custom not found: ${toolName}` })),
        onToolError: vi.fn(async ({ error }) => ({ ok: false, error: `Custom error: ${error.message}` })),
        emitAnswer: vi.fn(),
        aiProvider: {
          chat: vi.fn(async () => 'AI Provider Summary of Tool')
        },
        llm: {
          chat: vi.fn(async (_msgs, onChunk) => {
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
      await executeToolCallsLoop(mockBrainEngine, { toolCalls: [] }, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer).not.toHaveBeenCalled();
    });

    it('should handle tool not found and trigger onToolNotFound hook', async () => {
      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'missing_tool', arguments: '{"q": 1}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);

      expect(mockBrainEngine.onToolNotFound).toHaveBeenCalled();
      expect(mockBrainEngine.aiProvider.chat).toHaveBeenCalled();
      expect(mockBrainEngine.emitAnswer).toHaveBeenCalledWith('AI Provider Summary of Tool');
    });

    it('should handle tool execution error and trigger onToolError hook', async () => {
      mockBrainEngine.executeTool = vi.fn().mockRejectedValue(new Error('Boom!'));

      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'registered_tool', arguments: '{"q": 1}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);

      expect(mockBrainEngine.onToolError).toHaveBeenCalled();
      expect(mockBrainEngine.emitAnswer).toHaveBeenCalled();
    });

    it('should handle tool confirmation required and resume after confirmation', async () => {
      let confirmationContext;
      mockBrainEngine.offerToolConfirmation = vi.fn((tool, args, ctx) => {
        confirmationContext = ctx;
      });

      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'dangerous_tool', arguments: '{"action":"delete"}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);

      expect(mockBrainEngine.offerToolConfirmation).toHaveBeenCalled();

      // Test cancelled
      await confirmationContext.onConfirmResume({ cancelled: true });
      expect(mockBrainEngine.emitAnswer).not.toHaveBeenCalled();

      // Test confirmed
      await confirmationContext.onConfirmResume({ ok: true, deleted: true });
      expect(mockBrainEngine.emitAnswer).toHaveBeenCalledWith('AI Provider Summary of Tool');
    });

    it('should execute WebLLM streaming second round summary', async () => {
      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'registered_tool', arguments: '{"q": 1}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.WEB_LLM);

      expect(mockBrainEngine.onStreamStart).toHaveBeenCalled();
      expect(mockBrainEngine.llm.chat).toHaveBeenCalled();
      expect(mockBrainEngine.onStreamChunk).toHaveBeenCalledWith('Chunk 1');
      expect(mockBrainEngine.memory.addTurn).toHaveBeenCalledWith('assistant', 'WebLLM Tool Summary');
      expect(mockBrainEngine.onStreamEnd).toHaveBeenCalledWith('WebLLM Tool Summary');
      expect(mockBrainEngine.triggerRollingSummaryIfNeeded).toHaveBeenCalled();
    });

    it('should fallback to lastResult error, message, or default string when summary response is empty', async () => {
      // 1. AI Provider with empty summary and lastResult has error
      mockBrainEngine.aiProvider.chat = vi.fn().mockResolvedValue('');
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({ ok: false, error: 'Database timeout' });

      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'registered_tool', arguments: '{}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer).toHaveBeenCalledWith('Database timeout');

      // 2. AI Provider with empty summary and lastResult is a plain string
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue('Plain result string');
      await executeToolCallsLoop(mockBrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer).toHaveBeenCalledWith('Plain result string');

      // 3. AI Provider with empty summary and lastResult has message
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({ ok: true, message: 'Updated 5 items' });
      await executeToolCallsLoop(mockBrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer).toHaveBeenCalledWith('Updated 5 items');

      // 4. AI Provider with empty summary and empty lastResult -> defaults to brain.toolExecutionError
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({});
      await executeToolCallsLoop(mockBrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER);
      expect(mockBrainEngine.emitAnswer).toHaveBeenCalled();
    });

    it('should fallback to WebLLM lastResult when streaming summary is empty', async () => {
      mockBrainEngine.llm.chat = vi.fn().mockResolvedValue({ content: '' });
      mockBrainEngine.executeTool = vi.fn().mockResolvedValue({ ok: false, error: 'WebLLM tool error' });

      const toolCallResponse = {
        toolCalls: [
          { id: 'call_1', function: { name: 'registered_tool', arguments: '{}' } }
        ],
        message: { content: '' }
      };

      await executeToolCallsLoop(mockBrainEngine, toolCallResponse, [], BRAIN_ENGINE_TYPE_MAP.WEB_LLM);
      expect(mockBrainEngine.onStreamEnd).toHaveBeenCalledWith('WebLLM tool error');
    });
  });
});
