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
import type { LLMMessage, MemoryData } from '@/core/brain/types';

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
      expect(aiProviderLimits.strategy).toBe(COMPRESSION_STRATEGY_MAP.SLIDING_WINDOW);
    });

    it('should respect custom options override', () => {
      const limits = resolveCompressionLimits(
        {
          strategy: COMPRESSION_STRATEGY_MAP.ROLLING_SUMMARY,
          maxTurns: 10,
          maxTotalChars: 5000,
          webLlm: { maxTurns: 3, maxTotalChars: 1500 }
        },
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM
      );
      expect(limits.strategy).toBe(COMPRESSION_STRATEGY_MAP.ROLLING_SUMMARY);
      expect(limits.maxTurns).toBe(3);
      expect(limits.maxTotalChars).toBe(1500);
    });
  });

  describe('estimateChars', () => {
    it('should correctly sum string contents including tool_calls and tool arguments', () => {
      const emptyCount = estimateChars([]);
      expect(emptyCount).toBe(0);

      const count = estimateChars([
        { role: 'user', content: '嗨' },
        {
          role: 'assistant',
          content: '哈囉世界',
          tool_calls: [
            {
              id: 'c1',
              type: 'function',
              function: { name: 'getWeather', arguments: '{"city":"Taipei"}' }
            }
          ]
        }
      ]);
      expect(count).toBeGreaterThan(0);
      expect(
        estimateChars({
          role: 'tool',
          content: '天氣晴朗',
          tool_call_id: 'call_12345678'
        })
      ).toBe(4);
    });
  });

  describe('sanitizeToolCalls', () => {
    it('should strip orphaned tool responses without matching tool_call id', () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: '查詢天氣' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'weather', arguments: '{}' }
            }
          ]
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
      const messages: LLMMessage[] = [
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
      const messages: LLMMessage[] = [
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
      const messages: LLMMessage[] = [
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
      const newTurns: LLMMessage[] = [
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
      const messages: LLMMessage[] = [
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
      const messages: LLMMessage[] = [
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

      const messages: LLMMessage[] = [
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

    it('should handle customCompressor error/invalid return, rolling summary strategy, and empty input guards', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // 1. Empty messages guard
      expect(await compressContext({ messages: [] })).toEqual([]);
      expect(
        await compressContext({
          messages: null as unknown as LLMMessage[]
        })
      ).toEqual([]);
      expect(slidingWindowCompressor({ messages: [] })).toEqual([]);
      expect(rollingSummaryCompressor({ messages: [] })).toEqual([]);

      const sampleMessages: LLMMessage[] = [
        { role: 'system', content: '系統設定' },
        { role: 'user', content: '用戶問題' },
        { role: 'assistant', content: '助手回答' }
      ];

      // 2. customCompressor throwing error -> falls back to sliding window
      const throwingCompressor = vi.fn().mockRejectedValue(new Error('Compression failure'));
      const fallbackResult1 = await compressContext({
        messages: sampleMessages,
        compressionOptions: { customCompressor: throwingCompressor }
      });
      expect(fallbackResult1).toHaveLength(3);
      expect(warnSpy).toHaveBeenCalled();

      // 3. customCompressor returning empty/invalid -> falls back
      const invalidCompressor = vi.fn().mockResolvedValue([]);
      const fallbackResult2 = await compressContext({
        messages: sampleMessages,
        compressionOptions: { customCompressor: invalidCompressor }
      });
      expect(fallbackResult2).toHaveLength(3);

      // 4. ROLLING_SUMMARY strategy via memoryData.summary and custom recentTurns
      const memoryDataMock: MemoryData = {
        version: 1,
        name: 'test',
        visits: 1,
        last: Date.now(),
        history: [],
        summary: '用戶是工程師',
        facts: [],
        session: {}
      };
      const rollingResult = await compressContext({
        messages: sampleMessages,
        memoryData: memoryDataMock,
        compressionOptions: {
          strategy: COMPRESSION_STRATEGY_MAP.ROLLING_SUMMARY,
          recentTurns: 2
        }
      });
      expect(rollingResult[0].content).toContain('用戶是工程師');

      // 5. generateRollingSummary with llmChat throwing error -> heuristic fallback
      const failingLlmChat = vi.fn().mockRejectedValue(new Error('LLM error'));
      const summaryResult = await generateRollingSummary({
        oldSummary: '',
        newTurns: [{ role: 'user', content: '今天想吃拉麵' }],
        llmChat: failingLlmChat
      });
      expect(summaryResult).toContain('拉麵');

      warnSpy.mockRestore();
    });
  });
});
