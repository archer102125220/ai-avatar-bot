import { describe, it, expect, vi } from 'vitest';
import {
  resolveCompressionLimits,
  estimateChars,
  sanitizeToolCalls,
  groupMessagesIntoTurns,
  slidingWindowCompressor,
  rollingSummaryCompressor,
  generateRollingSummary,
  compressContext
} from '@/core/brain/compression';
import {
  BRAIN_ENGINE_TYPE_MAP,
  COMPRESSION_STRATEGY_MAP,
  DEFAULT_WEB_LLM_MAX_TURNS,
  DEFAULT_AI_PROVIDER_MAX_TURNS
} from '@/core/constants';


describe('Unit Test: core/brain/compression.js', () => {
  describe('resolveCompressionLimits', () => {
    it('should resolve limits according to engineType (WebLLM vs AIProvider)', () => {
      const webLlmLimits = resolveCompressionLimits(
        {},
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM
      );
      expect(webLlmLimits.maxTurns).toBe(DEFAULT_WEB_LLM_MAX_TURNS);
      expect(webLlmLimits.strategy).toBe(COMPRESSION_STRATEGY_MAP.SLIDING_WINDOW);

      const aiProviderLimits = resolveCompressionLimits(
        {},
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      );
      expect(aiProviderLimits.maxTurns).toBe(DEFAULT_AI_PROVIDER_MAX_TURNS);
    });

    it('should prioritize custom specific engine settings over global defaults', () => {
      const limits = resolveCompressionLimits(
        {
          maxTurns: 5,
          webLlm: { maxTurns: 2, maxTotalChars: 500 }
        },
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM
      );

      expect(limits.maxTurns).toBe(2);
      expect(limits.maxTotalChars).toBe(500);
    });
  });

  describe('estimateChars', () => {
    it('should calculate character count for string, array, and tool call objects', () => {
      expect(estimateChars('Hello')).toBe(5);
      expect(estimateChars([{ content: 'ABC' }, { content: '1234' }])).toBe(7);
      expect(
        estimateChars({
          content: 'Hi',
          tool_calls: [{ function: { name: 'get_weather', arguments: '{"city":"Tokyo"}' } }]
        })
      ).toBe(2 + 11 + 16);
    });
  });

  describe('sanitizeToolCalls', () => {
    it('should strip orphaned tool responses without matching tool_call id', () => {
      const messages = [
        { role: 'user', content: '查詢天氣' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'call_1', function: { name: 'weather', arguments: '{}' } }]
        },
        { role: 'tool', tool_call_id: 'call_1', content: '晴天' },
        { role: 'tool', tool_call_id: 'orphan_call', content: '孤立結果' }
      ];

      const sanitized = sanitizeToolCalls(messages);
      expect(sanitized).toHaveLength(3);
      expect(sanitized.some((m) => m.tool_call_id === 'orphan_call')).toBe(false);
    });
  });

  describe('groupMessagesIntoTurns', () => {
    it('should group conversation items into logical user-led turns', () => {
      const messages = [
        { role: 'user', content: '問題 1' },
        { role: 'assistant', content: '回答 1' },
        { role: 'user', content: '問題 2' },
        { role: 'assistant', content: '回答 2' }
      ];

      const turns = groupMessagesIntoTurns(messages);
      expect(turns).toHaveLength(2);
      expect(turns[0]).toHaveLength(2);
      expect(turns[1]).toHaveLength(2);
    });
  });

  describe('slidingWindowCompressor', () => {
    it('should preserve complete dialogue turns and slice from newest to oldest', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: '第一問' },
        { role: 'assistant', content: '第一答' },
        { role: 'user', content: '第二問' },
        { role: 'assistant', content: '第二答' },
        { role: 'user', content: '第三問' }
      ];

      const result = slidingWindowCompressor({
        messages,
        maxTurns: 1,
        maxTotalChars: 10000
      });

      // 應保留 system, 第二問/第二答 (1 輪歷史), 最新第三問
      expect(result).toHaveLength(4);
      expect(result[0].role).toBe('system');
      expect(result[1].content).toBe('第二問');
      expect(result[2].content).toBe('第二答');
      expect(result[3].content).toBe('第三問');
    });

    it('should respect maxTotalChars budget limit by dropping older turns', () => {
      const messages = [
        { role: 'system', content: 'Sys' },
        { role: 'user', content: '舊問題 1' },
        { role: 'assistant', content: '舊回答 1' },
        { role: 'user', content: '較新問題 2' },
        { role: 'assistant', content: '較新回答 2' },
        { role: 'user', content: '最新問題' }
      ];

      // 預算只夠容納 1 輪對話（最新問題 + 較新問題 2 + 系統提示），舊問題 1 應被修剪
      const result = slidingWindowCompressor({
        messages,
        maxTurns: 5,
        maxTotalChars: 20
      });

      expect(result).toHaveLength(4);
      expect(result[0].role).toBe('system');
      expect(result[1].content).toBe('較新問題 2');
      expect(result[2].content).toBe('較新回答 2');
      expect(result[3].content).toBe('最新問題');
    });
  });

  describe('generateRollingSummary & rollingSummaryCompressor', () => {
    it('should generate summary using fallback heuristic when llmChat is not provided', async () => {
      const newTurns = [
        { role: 'user', content: '我想學習 JavaScript' },
        { role: 'assistant', content: '推薦從基礎語法與 DOM 操作開始。' }
      ];

      const summary = await generateRollingSummary({
        oldSummary: '',
        newTurns,
        locale: 'zh-TW'
      });

      expect(summary).toContain('JavaScript');
    });

    it('should generate summary using customGenerator if provided', async () => {
      const customGenerator = vi.fn().mockResolvedValue('自訂精煉摘要');
      const summary = await generateRollingSummary({
        oldSummary: '舊摘要',
        newTurns: [{ role: 'user', content: '新對話' }],
        customGenerator
      });

      expect(summary).toBe('自訂精煉摘要');
      expect(customGenerator).toHaveBeenCalledOnce();
    });

    it('should inject summary into system prompt in rollingSummaryCompressor', () => {
      const messages = [
        { role: 'system', content: 'Base system prompt' },
        { role: 'user', content: '最後問題' }
      ];

      const compressed = rollingSummaryCompressor({
        messages,
        summary: '用戶喜好喝拿鐵咖啡'
      });

      expect(compressed[0].content).toContain('【歷史對話前情備忘 / Context Summary】');
      expect(compressed[0].content).toContain('用戶喜好喝拿鐵咖啡');
    });
  });

  describe('compressContext', () => {
    it('should bypass compression when strategy is NONE', async () => {
      const messages = [
        { role: 'user', content: 'A' },
        { role: 'assistant', content: 'B' }
      ];

      const result = await compressContext({
        messages,
        compressionOptions: { strategy: COMPRESSION_STRATEGY_MAP.NONE },
        engineType: BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      });

      expect(result).toEqual(messages);
    });

    it('should execute customCompressor when provided', async () => {
      const customCompressor = vi.fn().mockResolvedValue([
        { role: 'system', content: 'Custom compressed system' },
        { role: 'user', content: 'Hello' }
      ]);

      const messages = [
        { role: 'system', content: 'Default' },
        { role: 'user', content: 'Hello' }
      ];

      const result = await compressContext({
        messages,
        compressionOptions: { customCompressor },
        engineType: BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      });

      expect(customCompressor).toHaveBeenCalledOnce();
      expect(result[0].content).toBe('Custom compressed system');
    });
  });
});
