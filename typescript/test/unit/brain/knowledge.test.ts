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
      const mockKnowledge: KnowledgeEntry[] = [
        { q: '這是什麼', a: 'AI 語音虛擬人' }
      ];
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => mockKnowledge
      } as unknown as Response);

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
      global.fetch = vi.fn().mockResolvedValue([] as unknown as Response);
      const noJsonResult = await fetchKnowledge('https://nojson.url');
      expect(noJsonResult).toEqual([]);

      // Test response.json() returning non-array
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ not: 'array' })
      } as unknown as Response);
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
      expect(getBigrams(null as unknown as string)).toEqual([]);
    });

    it('should calculate similarity between query and target string', () => {
      const scoreHigh = calculateKnowledgeSimilarity(
        '語音虛擬人',
        '語音虛擬人元件'
      );
      const scoreLow = calculateKnowledgeSimilarity(
        '語音虛擬人',
        '今天吃什麼晚餐'
      );

      expect(scoreHigh).toBeGreaterThan(0.5);
      expect(scoreLow).toBe(0);

      // Empty queries
      expect(calculateKnowledgeSimilarity('', '目標文字')).toBe(0);
      expect(calculateKnowledgeSimilarity('查詢', '')).toBe(0);
    });
  });

  describe('scoreKnowledgeEntry & findBestMatch', () => {
    const knowledgeList: KnowledgeEntry[] = [
      {
        q: '怎麼安裝到專案？',
        kw: '安裝 引入 install npm',
        a: '使用 yarn add @avatar/sdk'
      },
      { q: '支援 3D 嗎？', kw: '3D VRM 模型', a: '支援 Live2D 與 VRM 3D 模型' }
    ];

    it('should score knowledge entry higher when keywords or questions match', () => {
      const score = scoreKnowledgeEntry('我想知道怎麼安裝', knowledgeList[0]);
      expect(score).toBeGreaterThan(0.3);
    });

    it('should find best matching entry for user question', () => {
      const { entry, score } = findBestMatch(
        knowledgeList,
        '你們有支援 3D VRM 嗎？'
      );
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
      const top = getTopKnowledge(
        brainEngine as unknown as Parameters<typeof getTopKnowledge>[0],
        '我想吃蘋果',
        2
      );

      expect(top.length).toBe(2);
      expect(top.some((item) => item.a === '蘋果是水果')).toBe(true);

      // Null brainEngine guard
      expect(
        getTopKnowledge(
          null as unknown as Parameters<typeof getTopKnowledge>[0],
          '蘋果',
          2
        )
      ).toEqual([]);
    });

    it('should prioritize assistantKnowledge over deprecated knowledge', () => {
      const assistantKnowledge: KnowledgeEntry[] = [
        { q: '新版', kw: '新版', a: '來自 assistantKnowledge' }
      ];
      const legacyKnowledge: KnowledgeEntry[] = [
        { q: '舊版', kw: '舊版', a: '來自 knowledge' }
      ];

      const brainEngine = {
        assistantKnowledge,
        knowledge: legacyKnowledge
      };

      const top = getTopKnowledge(
        brainEngine as unknown as Parameters<typeof getTopKnowledge>[0],
        '新版',
        1
      );
      expect(top[0].a).toBe('來自 assistantKnowledge');
      expect(top[0].tier).toBe('mode');
    });

    it('should return empty array when limit or knowledgeLimit is 0', () => {
      const brainEngine = {
        knowledge: [{ q: '問題', a: '回答' }],
        knowledgeLimit: 0
      };
      expect(
        getTopKnowledge(
          brainEngine as unknown as Parameters<typeof getTopKnowledge>[0],
          '問題'
        )
      ).toEqual([]);

      expect(
        getTopKnowledge(
          { knowledge: [{ q: '問題', a: '回答' }] } as unknown as Parameters<
            typeof getTopKnowledge
          >[0],
          '問題',
          0
        )
      ).toEqual([]);
    });

    it('should support knowledgeFilter: false bypass mode without score filtering', () => {
      const brainEngine = {
        knowledgeFilter: false,
        avatarMode: 'assistant',
        assistantKnowledge: [
          { q: '專屬A', a: '內容A' },
          { q: '共用重複', a: '專屬版本' }
        ],
        sharedKnowledge: [
          { q: '共用重複', a: '專屬版本' }, // duplicate, should be skipped
          { q: '常識B', a: '內容B' }
        ]
      };

      const top = getTopKnowledge(
        brainEngine as unknown as Parameters<typeof getTopKnowledge>[0],
        '隨便不相關的問題',
        5
      );

      // Should bypass similarity filtering and retain all items deduplicated
      expect(top).toHaveLength(3);
      expect(top[0].q).toBe('專屬A');
      expect(top[0].tier).toBe('mode');
      expect(top[1].q).toBe('共用重複');
      expect(top[1].tier).toBe('mode');
      expect(top[2].q).toBe('常識B');
      expect(top[2].tier).toBe('shared');
    });

    it('should support companion mode and custom mode knowledge pools with stratified slot allocation', () => {
      // 1. Companion mode
      const companionEngine = {
        avatarMode: 'companion',
        companionKnowledge: [{ q: '陪伴問題', kw: '陪伴', a: '陪伴回答' }],
        sharedKnowledge: [{ q: '共用問題', kw: '共用', a: '共用回答' }]
      };
      const companionTop = getTopKnowledge(
        companionEngine as unknown as Parameters<typeof getTopKnowledge>[0],
        '陪伴'
      );
      expect(companionTop[0].a).toBe('陪伴回答');
      expect(companionTop[0].tier).toBe('mode');

      // 2. Custom mode
      const customEngine = {
        avatarMode: 'tour',
        modes: {
          tour: {
            knowledge: [{ q: '景點在哪', kw: '景點 旅遊', a: '在台北市' }]
          }
        },
        sharedKnowledge: [{ q: '通用常識', kw: '常識', a: '常識內容' }]
      };
      const customTop = getTopKnowledge(
        customEngine as unknown as Parameters<typeof getTopKnowledge>[0],
        '景點',
        2
      );
      expect(customTop[0].a).toBe('在台北市');
      expect(customTop[0].tier).toBe('mode');

      // 3. Custom filter function
      const filterEngine = {
        knowledge: [
          { q: '蘋果', kw: '蘋果', a: '紅色的' },
          { q: '西瓜', kw: '西瓜', a: '綠色的' }
        ],
        knowledgeFilter: (entry: KnowledgeEntry) => entry.q !== '蘋果'
      };
      const filteredTop = getTopKnowledge(
        filterEngine as unknown as Parameters<typeof getTopKnowledge>[0],
        '我想吃蘋果和西瓜',
        2
      );
      expect(filteredTop.some((item) => item.q === '蘋果')).toBe(false);
      expect(filteredTop.some((item) => item.q === '西瓜')).toBe(true);
    });

    it('should score knowledge entry with message array question and handle null findBestMatch', () => {
      const entry: KnowledgeEntry = {
        q: '如何安裝',
        kw: '安裝 install',
        a: ''
      };

      // Array question format with items and empty array
      const scoreArr = scoreKnowledgeEntry(
        [{ content: '請教如何安裝' }],
        entry
      );
      expect(scoreArr).toBeGreaterThan(0.3);

      const scoreEmptyArr = scoreKnowledgeEntry([], entry);
      expect(scoreEmptyArr).toBe(0);

      // Question with empty content in array
      const scoreEmptyContent = scoreKnowledgeEntry([{ content: '' }], entry);
      expect(scoreEmptyContent).toBe(0);

      // Non-string / null question fallback
      const scoreNullQuestion = scoreKnowledgeEntry(
        null as unknown as string,
        entry
      );
      expect(scoreNullQuestion).toBe(0);

      const scoreUndefinedQuestion = scoreKnowledgeEntry(
        undefined as unknown as string,
        entry
      );
      expect(scoreUndefinedQuestion).toBe(0);

      // Non-string entry properties
      const nonStringEntry = {
        q: 12345,
        kw: null
      } as unknown as KnowledgeEntry;
      const scoreNonString = scoreKnowledgeEntry(
        12345 as unknown as string,
        nonStringEntry
      );
      expect(scoreNonString).toBeGreaterThanOrEqual(0);

      // Entry with null q and kw
      const emptyEntry = {} as unknown as KnowledgeEntry;
      expect(scoreKnowledgeEntry('測試', emptyEntry)).toBe(0);

      // findBestMatch with null or undefined
      expect(
        findBestMatch(null as unknown as KnowledgeEntry[], '查詢')
      ).toEqual({ entry: null, score: 0 });
      expect(
        findBestMatch(undefined as unknown as KnowledgeEntry[], '查詢')
      ).toEqual({ entry: null, score: 0 });
    });
  });
});
