import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchKnowledge,
  getBigrams,
  calculateKnowledgeSimilarity,
  scoreKnowledgeEntry,
  getTopKnowledge,
  findBestMatch
} from '@/core/brain/knowledge';
import type { KnowledgeEntry } from '@core';

describe('Unit Test: core/brain/knowledge.js', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('fetchKnowledge', () => {
    it('should fetch and parse JSON knowledge base from URL', async () => {
      const mockKnowledge: KnowledgeEntry[] = [{ q: '這是什麼', a: 'AI 語音虛擬人' }];
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => mockKnowledge
      } as any);

      const result = await fetchKnowledge('https://example.com/kb.json');
      expect(result).toEqual(mockKnowledge);
    });

    it('should return empty array on fetch error or invalid URL', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const result = await fetchKnowledge('https://invalid.url');
      expect(result).toEqual([]);

      const emptyResult = await fetchKnowledge('');
      expect(emptyResult).toEqual([]);

      // Test response without json function
      global.fetch = vi.fn().mockResolvedValue([] as any);
      const noJsonResult = await fetchKnowledge('https://nojson.url');
      expect(noJsonResult).toEqual([]);

      // Test response.json() returning non-array
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ not: 'array' })
      } as any);
      const nonArrayResult = await fetchKnowledge('https://nonarray.url');
      expect(nonArrayResult).toEqual([]);
    });
  });

  describe('getBigrams & calculateKnowledgeSimilarity', () => {
    it('should generate bigram pairs from Chinese and alphanumeric text', () => {
      const bigrams = getBigrams('語音虛擬人');
      expect(bigrams).toEqual(['語音', '音虛', '虛擬', '擬人']);

      // Single character normalized text
      expect(getBigrams('A')).toEqual(['a']);
      expect(getBigrams('')).toEqual([]);
      // @ts-ignore: Defensive runtime type checking test
      expect(getBigrams(null)).toEqual([]);
    });

    it('should calculate similarity between query and target string', () => {
      const scoreHigh = calculateKnowledgeSimilarity('語音虛擬人', '語音虛擬人元件');
      const scoreLow = calculateKnowledgeSimilarity('語音虛擬人', '今天吃什麼晚餐');

      expect(scoreHigh).toBeGreaterThan(0.5);
      expect(scoreLow).toBe(0);

      // Empty queries
      expect(calculateKnowledgeSimilarity('', '目標文字')).toBe(0);
      expect(calculateKnowledgeSimilarity('查詢', '')).toBe(0);
    });
  });

  describe('scoreKnowledgeEntry & findBestMatch', () => {
    const knowledgeList: KnowledgeEntry[] = [
      { q: '怎麼安裝到專案？', kw: '安裝 引入 install npm', a: '使用 yarn add @avatar/sdk' },
      { q: '支援 3D 嗎？', kw: '3D VRM 模型', a: '支援 Live2D 與 VRM 3D 模型' }
    ];

    it('should score knowledge entry higher when keywords or questions match', () => {
      const score = scoreKnowledgeEntry('我想知道怎麼安裝', knowledgeList[0]);
      expect(score).toBeGreaterThan(0.3);
    });

    it('should find best matching entry for user question', () => {
      const { entry, score } = findBestMatch(knowledgeList, '你們有支援 3D VRM 嗎？');
      expect(entry).toBe(knowledgeList[1]);
      expect(score).toBeGreaterThan(0.3);
    });
  });

  describe('getTopKnowledge', () => {
    it('should return top K relevant entries sorted by score', () => {
      const knowledge: KnowledgeEntry[] = [
        { q: 'A', kw: '蘋果', a: '蘋果是水果' },
        { q: 'B', kw: '香蕉', a: '香蕉是黃色的' },
        { q: 'C', kw: '蘋果派', a: '蘋果派是甜點' }
      ];

      const brainEngine = { knowledge };
      const top = getTopKnowledge(brainEngine as any, '我想吃蘋果', 2);

      expect(top.length).toBe(2);
      expect(top.some((item) => item.a === '蘋果是水果')).toBe(true);

      // Null brainEngine guard
      // @ts-ignore: Defensive runtime type checking test
      expect(getTopKnowledge(null, '蘋果', 2)).toEqual([]);
    });

    it('should score knowledge entry with message array question and handle null findBestMatch', () => {
      const entry: KnowledgeEntry = { q: '如何安裝', kw: '安裝 install', a: '' };

      // Array question format with items and empty array
      // @ts-ignore: Testing message array input format
      const scoreArr = scoreKnowledgeEntry([{ role: 'user', content: '請教如何安裝' }], entry);
      expect(scoreArr).toBeGreaterThan(0.3);

      // @ts-ignore: Testing empty message array input format
      const scoreEmptyArr = scoreKnowledgeEntry([], entry);
      expect(scoreEmptyArr).toBe(0);

      // Non-string entry properties
      const nonStringEntry = { q: 12345, kw: null };
      // @ts-ignore: Defensive runtime type checking test
      const scoreNonString = scoreKnowledgeEntry(12345, nonStringEntry);
      expect(scoreNonString).toBeGreaterThanOrEqual(0);

      // Entry with null q and kw
      const emptyEntry = {};
      // @ts-ignore: Defensive runtime type checking test
      expect(scoreKnowledgeEntry('測試', emptyEntry)).toBe(0);

      // findBestMatch with null or undefined
      // @ts-ignore: Defensive runtime type checking test
      expect(findBestMatch(null, '查詢')).toEqual({ entry: null, score: 0 });
      // @ts-ignore: Defensive runtime type checking test
      expect(findBestMatch(undefined, '查詢')).toEqual({ entry: null, score: 0 });
    });
  });
});
