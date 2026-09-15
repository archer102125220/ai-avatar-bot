import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultMemoryData,
  migrateMemoryData,
  initMemory
} from '../../../core/brain/memory';
import { CURRENT_MEMORY_VERSION } from '../../../core/constants';

describe('Unit Test: core/brain/memory.js', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('createDefaultMemoryData', () => {
    it('should generate valid default memory structure', () => {
      const data = createDefaultMemoryData();
      expect(data.version).toBe(CURRENT_MEMORY_VERSION);
      expect(data.name).toBe('');
      expect(data.visits).toBe(0);
      expect(data.history).toEqual([]);
      expect(data.summary).toBe('');
      expect(data.metadata).toEqual({});
    });
  });

  describe('migrateMemoryData', () => {
    it('should return default memory structure when null or invalid is provided', () => {
      expect(migrateMemoryData(null)).toEqual(createDefaultMemoryData());
      expect(migrateMemoryData(undefined)).toEqual(createDefaultMemoryData());
    });

    it('should migrate v0 legacy data to current version with sanitized history', () => {
      const legacyData = {
        name: '小美',
        visits: 5,
        history: [
          { role: 'user', content: '哈囉' },
          { role: 'bot', content: { text: '你好呀！' } }
        ]
      };

      const migrated = migrateMemoryData(legacyData);
      expect(migrated.version).toBe(CURRENT_MEMORY_VERSION);
      expect(migrated.name).toBe('小美');
      expect(migrated.visits).toBe(5);
      expect(migrated.history).toHaveLength(2);
      expect(migrated.history[1].role).toBe('assistant');
      expect(migrated.history[1].content).toBe('你好呀！');
    });
  });

  describe('initMemory', () => {
    it('should load, increment visits, and save to storage adapter', () => {
      const memory = initMemory({
        memoryKey: 'test-avatar-memory',
        enableMemory: true
      });

      // initMemory 內部會自動執行首次 load()
      expect(memory.data.visits).toBe(1);

      memory.addTurn('user', '今天天氣好嗎？');
      memory.addTurn('assistant', '今天天氣晴朗！');

      expect(memory.data.history).toHaveLength(2);

      // 再次手動執行 load() 應累加訪問次數
      memory.load();
      expect(memory.data.visits).toBe(2);
      expect(memory.data.history).toHaveLength(2);
    });

    it('should cap history to 100 turns in raw memory data store', () => {
      const memory = initMemory({
        enableMemory: true
      });

      for (let i = 0; i < 110; i++) {
        memory.addTurn('user', `問題 ${i}`);
      }

      // 記憶庫本體上限為 100 筆對話紀錄
      expect(memory.data.history).toHaveLength(100);
      expect(memory.data.history[0].content).toBe('問題 10');
      expect(memory.data.history[99].content).toBe('問題 109');
    });

    it('should capture username and set custom metadata', () => {
      const memory = initMemory({ enableMemory: true });

      memory.captureName('我是林小明');
      expect(memory.data.name).toBe('林小明');

      memory.setMetadata({ theme: 'dark', score: 100 });
      expect(memory.getMetadata()).toEqual({ theme: 'dark', score: 100 });

      memory.clear();
      expect(memory.data.name).toBe('');
      expect(memory.data.history).toEqual([]);
    });
  });
});
