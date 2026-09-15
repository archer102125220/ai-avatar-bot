import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initMemory,
  createDefaultMemoryData,
  migrateMemoryData,
  triggerRollingSummaryIfNeeded
} from '../../../core/brain/memory';
import {
  CURRENT_MEMORY_VERSION,
  COMPRESSION_STRATEGY_MAP,
  STATE_MAP
} from '../../../core/constants';

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
        history: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', text: 'hi there' },
          { role: 'assistant', content: { text: 'rich object' } }
        ]
      };

      const migrated = migrateMemoryData(v0Data);
      expect(migrated.version).toBe(1);
      expect(migrated.name).toBe('Bob');
      expect(migrated.visits).toBe(3);
      expect(migrated.history.length).toBe(3);
      expect(migrated.history[1].content).toBe('hi there');
      expect(migrated.history[2].content).toBe('rich object');
    });
  });

  describe('initMemory operations and adapters', () => {
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

      // setMetadata with updater function
      memory.setMetadata((prev) => ({ ...prev, score: 100 }));
      expect(memory.getMetadata()).toEqual({ tag: 'vip', score: 100 });

      // captureName
      memory.captureName('你好，我叫小華！');
      expect(memory.data.name).toBe('小華');

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

    it('should handle localStorage fallback and quota errors gracefully', () => {
      const memory = initMemory({
        memoryKey: 'local_test_key',
        enableMemory: true
      });

      memory.data.name = 'TestUser';
      memory.save();

      const saved = JSON.parse(localStorage.getItem('local_test_key'));
      expect(saved.name).toBe('TestUser');
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
          chat: vi.fn(async () => '最新精煉摘要：喜歡蘋果與香蕉')
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

      vi.useRealTimers();
    });
  });
});
