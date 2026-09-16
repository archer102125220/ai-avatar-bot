import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchKnowledge,
  getBigrams,
  calculateKnowledgeSimilarity,
  scoreKnowledgeEntry,
  getTopKnowledge,
  findBestMatch
} from '@/core/brain/knowledge';


describe('Unit Test: core/brain/knowledge.js', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('fetchKnowledge', () => {
    it('should fetch and parse JSON knowledge base from URL', async () => {
      const mockKnowledge = [{ q: '這是什麼', a: 'AI 語音虛擬人' }];
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => mockKnowledge
      });

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
      global.fetch = vi.fn().mockResolvedValue([]);
      const noJsonResult = await fetchKnowledge('https://nojson.url');
      expect(noJsonResult).toEqual([]);

      // Test response.json() returning non-array
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ not: 'array' })
      });
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
    const knowledgeList = [
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
      const knowledge = [
        { q: 'A', kw: '蘋果', a: '蘋果是水果' },
        { q: 'B', kw: '香蕉', a: '香蕉是黃色的' },
        { q: 'C', kw: '蘋果派', a: '蘋果派是甜點' }
      ];

      const brainEngine = { knowledge };
      const top = getTopKnowledge(brainEngine, '我想吃蘋果', 2);

      expect(top.length).toBe(2);
      expect(top.some((item) => item.a === '蘋果是水果')).toBe(true);

      // Null brainEngine guard
      expect(getTopKnowledge(null, '蘋果', 2)).toEqual([]);
    });

    it('should score knowledge entry with message array question and handle null findBestMatch', () => {
      const entry = { q: '如何安裝', kw: '安裝 install' };

      // Array question format with items and empty array
      const scoreArr = scoreKnowledgeEntry([{ role: 'user', content: '請教如何安裝' }], entry);
      expect(scoreArr).toBeGreaterThan(0.3);

      const scoreEmptyArr = scoreKnowledgeEntry([], entry);
      expect(scoreEmptyArr).toBe(0);

      // Non-string entry properties
      const nonStringEntry = { q: 12345, kw: null };
      const scoreNonString = scoreKnowledgeEntry(12345, nonStringEntry);
      expect(scoreNonString).toBeGreaterThanOrEqual(0);

      // Entry with null q and kw
      const emptyEntry = {};
      expect(scoreKnowledgeEntry('測試', emptyEntry)).toBe(0);

      // findBestMatch with null or undefined
      expect(findBestMatch(null, '查詢')).toEqual({ entry: null, score: 0 });
      expect(findBestMatch(undefined, '查詢')).toEqual({ entry: null, score: 0 });
    });
  });
});
