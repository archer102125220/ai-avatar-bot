import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initMemory,
  createDefaultMemoryData,
  migrateMemoryData,
  triggerRollingSummaryIfNeeded
} from '@/core/brain/memory';
import {
  CURRENT_MEMORY_VERSION,
  DEFAULT_MEMORY_KEY,
  DEFAULT_MAX_HISTORY_TURNS,
  COMPRESSION_STRATEGY_MAP,
  STATE_MAP
} from '@/core/constants';


describe('Brain Memory Subsystem (Deep Branch Coverage)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('createDefaultMemoryData & migrateMemoryData', () => {
    it('should generate pristine default memory data', () => {
      const data = createDefaultMemoryData();
      expect(data.version).toBe(CURRENT_MEMORY_VERSION);
      expect(data.name).toBe('');
      expect(data.visits).toBe(0);
      expect(data.history).toEqual([]);
      expect(data.metadata).toEqual({});
    });

    it('should safely migrate null, undefined, or old v0 data structures', () => {
      expect(migrateMemoryData(null)).toEqual(createDefaultMemoryData());
      expect(migrateMemoryData(undefined)).toEqual(createDefaultMemoryData());

      const v0Data = {
        name: 'Bob',
        visits: 3,
        last: 123456,
        lastSummarizedTurnIndex: 2,
        metadata: { role: 'admin' },
        summary: '先前摘要',
        history: [
          null,
          'invalid item',
          { role: 'user', content: 'hello' },
          { role: 'assistant', text: 'hi there' },
          { role: 'assistant', content: { text: 'rich object' } },
          { role: 'user', content: { nested: 'data' } },
          { role: 'assistant', content: 999 },
          { role: 'unknown_role', content: 'fallback assistant' }
        ]
      };

      const migrated = migrateMemoryData(v0Data);
      expect(migrated.version).toBe(1);
      expect(migrated.name).toBe('Bob');
      expect(migrated.visits).toBe(3);
      expect(migrated.last).toBe(123456);
      expect(migrated.lastSummarizedTurnIndex).toBe(2);
      expect(migrated.metadata).toEqual({ role: 'admin' });
      expect(migrated.summary).toBe('先前摘要');
      expect(migrated.history.length).toBe(6);
      expect(migrated.history[0].content).toBe('hello');
      expect(migrated.history[1].content).toBe('hi there');
      expect(migrated.history[2].content).toBe('rich object');
      expect(migrated.history[3].content).toBe('{"nested":"data"}');
      expect(migrated.history[4].content).toBe('999');
      expect(migrated.history[5].role).toBe('assistant');
    });

    it('should sanitize invalid property types in migrateMemoryData', () => {
      const corruptedData = {
        version: 1,
        name: 12345, // invalid type
        visits: 'five', // invalid type
        last: null, // invalid type
        history: 'not an array', // invalid type
        summary: {}, // invalid type
        lastSummarizedTurnIndex: NaN, // invalid type
        metadata: 'not an object' // invalid type
      };

      const sanitized = migrateMemoryData(corruptedData);
      expect(sanitized.name).toBe('');
      expect(sanitized.visits).toBe(0);
      expect(sanitized.last).toBe(0);
      expect(sanitized.history).toEqual([]);
      expect(sanitized.summary).toBe('');
      expect(sanitized.lastSummarizedTurnIndex).toBe(0);
      expect(sanitized.metadata).toEqual({});
    });
  });

  describe('initMemory operations and adapters', () => {
    it('should auto-enable memory when avatarMode is companion', () => {
      const memory = initMemory({
        avatarMode: 'companion',
        enableMemory: undefined,
        memoryKey: ''
      });
      expect(memory.enabled).toBe(true);
      expect(memory.key).toBe(DEFAULT_MEMORY_KEY);
      expect(memory.maxHistoryTurns).toBe(DEFAULT_MAX_HISTORY_TURNS);
    });

    it('should stay disabled when enableMemory is false and ignore operations', () => {
      const memory = initMemory({
        enableMemory: false,
        maxHistoryTurns: -5
      });

      expect(memory.enabled).toBe(false);
      expect(memory.maxHistoryTurns).toBe(DEFAULT_MAX_HISTORY_TURNS);

      memory.load();
      memory.save();
      memory.addTurn('user', 'test message');
      memory.captureName('我叫小明');
      memory.setMetadata({ key: 'val' });

      expect(memory.data.history).toEqual([]);
      expect(memory.data.name).toBe('');
    });

    it('should load and save through custom adapter and support versioning/metadata', () => {
      const customStorage = {};
      const customAdapter = {
        load: vi.fn((k) => customStorage[k] || null),
        save: vi.fn((k, d) => {
          customStorage[k] = d;
        }),
        clear: vi.fn((k) => {
          delete customStorage[k];
        })
      };

      const memory = initMemory({
        memoryKey: 'custom_key',
        enableMemory: true,
        memoryAdapter: customAdapter
      });

      expect(memory.getVersion()).toBe(CURRENT_MEMORY_VERSION);
      expect(memory.getMetadata()).toEqual({});

      // setMetadata with object
      memory.setMetadata({ tag: 'vip' });
      expect(memory.getMetadata()).toEqual({ tag: 'vip' });

      // setMetadata with updater function returning valid object
      memory.setMetadata((prev) => ({ ...prev, score: 100 }));
      expect(memory.getMetadata()).toEqual({ tag: 'vip', score: 100 });

      // setMetadata with updater function returning invalid
      memory.setMetadata(() => null);
      expect(memory.getMetadata()).toEqual({ tag: 'vip', score: 100 });

      // captureName variations
      memory.captureName('你好，我叫小華！');
      expect(memory.data.name).toBe('小華');

      memory.captureName('我是大明，很高興見到你');
      expect(memory.data.name).toBe('大明');

      memory.captureName('叫我阿強');
      expect(memory.data.name).toBe('阿強');

      // negative captureName filters
      memory.captureName('我是誰呀？');
      expect(memory.data.name).toBe('阿強'); // unchanged

      memory.captureName('我叫什麼名字呢');
      expect(memory.data.name).toBe('阿強'); // unchanged

      memory.captureName('');
      expect(memory.data.name).toBe('阿強'); // unchanged

      // addTurn ignores non-string or empty content
      memory.addTurn('user', '');
      memory.addTurn('user', null);
      expect(memory.data.history.length).toBe(0);

      // addTurn and 100 items capacity limit
      for (let i = 0; i < 110; i++) {
        memory.addTurn('user', `Message ${i}`);
      }
      expect(memory.data.history.length).toBe(100);
      expect(memory.data.history[99].content).toBe('Message 109');

      // clear
      memory.clear();
      expect(memory.data.visits).toBe(1);
      expect(customAdapter.clear).toHaveBeenCalledWith('custom_key');
    });

    it('should handle localStorage fallback, parsing errors and clear without adapter function', () => {
      // Mock localStorage throwing error on save
      const origSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceeded');
      });

      const memory = initMemory({
        memoryKey: 'local_test_key',
        enableMemory: true
      });

      memory.data.name = 'TestUser';
      memory.save(); // Should not throw

      localStorage.setItem = origSetItem;

      // Mock localStorage containing corrupted JSON
      localStorage.setItem('corrupted_key', '{ invalid json');
      const corruptedMem = initMemory({
        memoryKey: 'corrupted_key',
        enableMemory: true
      });
      expect(corruptedMem.data.visits).toBe(1);

      // Clear with adapter without clear method
      corruptedMem.adapter = {};
      corruptedMem.clear(); // Should not throw
      expect(corruptedMem.data.visits).toBe(1);
    });
  });

  describe('triggerRollingSummaryIfNeeded (Background Summarization)', () => {
    it('should trigger rolling summary when unsummarized turns exceed threshold', async () => {
      vi.useFakeTimers();

      const onSummaryUpdated = vi.fn();
      const mockBrainEngine = {
        locale: 'zh-TW',
        memory: {
          enabled: true,
          data: {
            summary: '舊摘要',
            history: [
              { role: 'user', content: '我喜歡吃蘋果' },
              { role: 'assistant', content: '蘋果很甜' },
              { role: 'user', content: '我也喜歡香蕉' },
              { role: 'assistant', content: '香蕉很有營養' }
            ],
            lastSummarizedTurnIndex: 0
          },
          save: vi.fn()
        },
        compression: {
          strategy: COMPRESSION_STRATEGY_MAP.ROLLING_SUMMARY,
          summaryThresholdTurns: 1
        },
        aiProvider: {
          enabled: true,
          ready: true,
          chat: vi.fn(async () => ({ content: '最新精煉摘要：喜歡蘋果與香蕉' }))
        },
        onSummaryUpdated
      };

      await triggerRollingSummaryIfNeeded(mockBrainEngine);
      expect(mockBrainEngine._isSummarizing).toBe(true);

      // Fast-forward background timer
      await vi.advanceTimersByTimeAsync(100);

      expect(mockBrainEngine.memory.data.summary).toBe('最新精煉摘要：喜歡蘋果與香蕉');
      expect(mockBrainEngine.memory.data.lastSummarizedTurnIndex).toBe(4);
      expect(onSummaryUpdated).toHaveBeenCalledWith('最新精煉摘要：喜歡蘋果與香蕉');
      expect(mockBrainEngine._isSummarizing).toBe(false);

      // Trigger again with empty summary generated (should not update summary)
      mockBrainEngine.compression.summaryGenerator = vi.fn(async () => '');
      mockBrainEngine.memory.data.lastSummarizedTurnIndex = 0;
      await triggerRollingSummaryIfNeeded(mockBrainEngine);
      await vi.advanceTimersByTimeAsync(100);
      expect(mockBrainEngine.memory.data.summary).toBe('最新精煉摘要：喜歡蘋果與香蕉'); // preserved

      vi.useRealTimers();
    });

    it('should support WebLLM engine for background summarization and handle errors', async () => {
      vi.useFakeTimers();

      const mockBrainEngine = {
        locale: 'zh-TW',
        memory: {
          enabled: true,
          data: {
            summary: '',
            history: [
              { role: 'user', content: '第一句' },
              { role: 'assistant', content: '第一句回覆' }
            ],
            lastSummarizedTurnIndex: 0
          },
          save: vi.fn()
        },
        compression: {
          strategy: COMPRESSION_STRATEGY_MAP.ROLLING_SUMMARY,
          summaryThresholdTurns: 1
        },
        aiProvider: { enabled: false },
        llm: {
          state: STATE_MAP.READY,
          engine: {
            chat: {
              completions: {
                create: vi.fn().mockResolvedValue({
                  choices: [{ message: { content: 'WebLLM 產出的摘要' } }]
                })
              }
            }
          }
        }
      };

      await triggerRollingSummaryIfNeeded(mockBrainEngine);
      await vi.advanceTimersByTimeAsync(100);

      expect(mockBrainEngine.memory.data.summary).toBe('WebLLM 產出的摘要');

      // Test error handling
      mockBrainEngine.llm.engine.chat.completions.create.mockRejectedValueOnce(new Error('LLM summary failed'));
      mockBrainEngine.memory.data.lastSummarizedTurnIndex = 0;
      await triggerRollingSummaryIfNeeded(mockBrainEngine);
      await vi.advanceTimersByTimeAsync(100);
      expect(mockBrainEngine._isSummarizing).toBe(false);

      // Test guard conditions
      expect(await triggerRollingSummaryIfNeeded(null)).toBeUndefined();
      expect(await triggerRollingSummaryIfNeeded({ memory: { enabled: false } })).toBeUndefined();
      expect(await triggerRollingSummaryIfNeeded({ memory: { enabled: true }, _isSummarizing: true })).toBeUndefined();
      expect(await triggerRollingSummaryIfNeeded({
        memory: { enabled: true, data: { history: [] } },
        compression: { strategy: 'other' }
      })).toBeUndefined();

      vi.useRealTimers();
    });
  });
});
