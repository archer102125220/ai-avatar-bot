import { describe, it, expect, vi } from 'vitest';
import {
  extractToolCallsFromText,
  executeToolCallsLoop
} from '../../../core/brain/tool-calling';
import { BRAIN_ENGINE_TYPE_MAP } from '../../../core/constants';

describe('Unit Test: core/brain/tool-calling.js', () => {
  describe('extractToolCallsFromText', () => {
    it('should parse <tool_call> tags containing JSON name and arguments', () => {
      const text = `
        讓我為您查詢天氣：
        <tool_call>{"name":"get_weather","arguments":{"city":"Tokyo"}}</tool_call>
      `;

      const toolCalls = extractToolCallsFromText(text);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].function.name).toBe('get_weather');
      expect(JSON.parse(toolCalls[0].function.arguments)).toEqual({ city: 'Tokyo' });
    });

    it('should return empty array when no tool_call tags are present', () => {
      expect(extractToolCallsFromText('普通對話內容')).toEqual([]);
      expect(extractToolCallsFromText('')).toEqual([]);
    });
  });

  describe('executeToolCallsLoop', () => {
    it('should execute tool and request second-round summary from AI Provider', async () => {
      const mockTool = {
        name: 'calc_sum',
        description: 'Calculate sum',
        execute: vi.fn().mockResolvedValue({ sum: 42 })
      };

      const emitAnswer = vi.fn();
      const mockAiChat = vi.fn().mockResolvedValue({
        type: 'text',
        content: '計算結果是 42！'
      });

      const brainEngine = {
        getToolByName: vi.fn().mockReturnValue(mockTool),
        executeTool: vi.fn().mockResolvedValue({ sum: 42 }),
        aiProvider: { chat: mockAiChat },
        emitAnswer
      };

      const toolCallResponse = {
        type: 'tool_calls',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'calc_sum', arguments: '{"a":20,"b":22}' }
          }
        ],
        message: { role: 'assistant', content: '' }
      };

      await executeToolCallsLoop(
        brainEngine,
        toolCallResponse,
        [{ role: 'user', content: '20 + 22 是多少？' }],
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      );

      expect(brainEngine.executeTool).toHaveBeenCalledOnce();
      expect(mockAiChat).toHaveBeenCalledOnce();
      expect(emitAnswer).toHaveBeenCalledWith('計算結果是 42！');
    });

    it('should handle tool confirmation when tool.requiresConfirmation is true', async () => {
      const mockTool = {
        name: 'delete_file',
        requiresConfirmation: true
      };

      const offerToolConfirmation = vi.fn();

      const brainEngine = {
        getToolByName: vi.fn().mockReturnValue(mockTool),
        offerToolConfirmation
      };

      const toolCallResponse = {
        type: 'tool_calls',
        toolCalls: [
          {
            id: 'call_del',
            type: 'function',
            function: { name: 'delete_file', arguments: '{"path":"/tmp/a"}' }
          }
        ],
        message: { role: 'assistant', content: '' }
      };

      await executeToolCallsLoop(
        brainEngine,
        toolCallResponse,
        [{ role: 'user', content: '刪除檔案' }],
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      );

      expect(offerToolConfirmation).toHaveBeenCalledOnce();
    });
  });
});
