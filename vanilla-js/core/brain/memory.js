import {
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_ENABLE_MEMORY,
  DEFAULT_MEMORY_KEY,
  DEFAULT_MAX_HISTORY_TURNS,
  DEFAULT_SUMMARY_THRESHOLD_TURNS,
  COMPRESSION_STRATEGY_MAP,
  BRAIN_ENGINE_TYPE_MAP,
  STATE_MAP
} from '../constants.js';
import {
  resolveCompressionLimits,
  generateRollingSummary
} from './compression.js';

/**
 * 記憶模組實例 (MemoryInstance)
 * @typedef {Object} MemoryInstance
 * @property {string} key - 本機儲存或識別鍵名
 * @property {boolean} enabled - 是否啟用記憶模組
 * @property {number} maxHistoryTurns - 保留最大歷史對話輪數
 * @property {Object} adapter - 儲存轉接器實例
 * @property {Object} data - 記憶資料
 * @property {string} data.name - 使用者名稱
 * @property {number} data.visits - 訪問次數
 * @property {number} data.last - 最後訪問時間戳
 * @property {Array<{role: string, content: string}>} data.history - 對話歷史
 * @property {string} [data.summary] - 滾動對話摘要
 * @property {number} [data.lastSummarizedTurnIndex] - 上次摘要時的輪次索引
 * @property {() => void} load - 載入記憶
 * @property {() => void} save - 儲存記憶
 * @property {(role: string, content: string) => void} addTurn - 新增對話輪次
 * @property {(name: string) => void} captureName - 擷取名稱
 * @property {() => void} clear - 清除記憶
 */

/**
 * 初始化記憶模組
 * @param {Object} [params={}] - 參數
 * @param {string} [params.avatarMode=DEFAULT_AVATAR_MODE] - 虛擬人模式
 * @param {boolean} [params.enableMemory=DEFAULT_ENABLE_MEMORY] - 是否啟用記憶模組
 * @param {string} [params.memoryKey=DEFAULT_MEMORY_KEY] - 記憶模組儲存 Key
 * @param {number} [params.maxHistoryTurns=DEFAULT_MAX_HISTORY_TURNS] - 保留最大輪數
 * @param {Object} [params.memoryAdapter] - 自訂儲存轉接器
 * @returns {MemoryInstance} 記憶模組實例
 */
export function initMemory({
  avatarMode = DEFAULT_AVATAR_MODE,
  enableMemory = DEFAULT_ENABLE_MEMORY,
  memoryKey = DEFAULT_MEMORY_KEY,
  maxHistoryTurns = DEFAULT_MAX_HISTORY_TURNS,
  memoryAdapter = null
} = {}) {
  const isEnabled =
    typeof enableMemory === 'boolean'
      ? enableMemory
      : avatarMode === AVATAR_MODE_MAP.companion;

  const defaultLocalStorageAdapter = {
    load(storageKey) {
      try {
        if (typeof localStorage !== 'undefined') {
          const rawData = localStorage.getItem(storageKey);
          return rawData !== null ? JSON.parse(rawData) : null;
        }
      } catch (_error) {}
      return null;
    },
    save(storageKey, data) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(data));
        }
      } catch (_error) {}
    },
    clear(storageKey) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(storageKey);
        }
      } catch (_error) {}
    }
  };

  const adapter =
    typeof memoryAdapter === 'object' && memoryAdapter !== null
      ? memoryAdapter
      : defaultLocalStorageAdapter;

  const memory = {
    key:
      typeof memoryKey === 'string' && memoryKey !== ''
        ? memoryKey
        : DEFAULT_MEMORY_KEY,
    enabled: isEnabled,
    maxHistoryTurns:
      typeof maxHistoryTurns === 'number' && maxHistoryTurns > 0
        ? maxHistoryTurns
        : DEFAULT_MAX_HISTORY_TURNS,
    adapter,
    data: {
      name: '',
      visits: 0,
      last: 0,
      history: [],
      summary: '',
      lastSummarizedTurnIndex: 0
    },

    load() {
      if (this.enabled === false) {
        return;
      }
      try {
        const localData = this.adapter.load(this.key);
        if (typeof localData === 'object' && localData !== null) {
          this.data = Object.assign(this.data, localData);
          if (Array.isArray(this.data.history) === true) {
            this.data.history = this.data.history
              .filter((item) => typeof item === 'object' && item !== null)
              .map((item) => {
                let safeContent = '';
                if (typeof item.content === 'string') {
                  safeContent = item.content;
                } else if (typeof item.content?.text === 'string') {
                  safeContent = item.content.text;
                } else if (typeof item.text === 'string') {
                  safeContent = item.text;
                } else if (
                  typeof item.content === 'object' &&
                  item.content !== null
                ) {
                  safeContent = JSON.stringify(item.content);
                } else if (
                  typeof item.content !== 'undefined' &&
                  item.content !== null
                ) {
                  safeContent = String(item.content);
                }
                return {
                  role: item.role === 'user' ? 'user' : 'assistant',
                  content: safeContent
                };
              });
          }
        }
      } catch (_error) {}
      this.data.visits = (this.data.visits || 0) + 1;
      this.save();
    },

    save() {
      if (this.enabled === false) {
        return;
      }
      try {
        this.data.last = Date.now();
        this.adapter.save(this.key, this.data);
      } catch (_error) {}
    },

    addTurn(role, content) {
      if (
        this.enabled === false ||
        typeof content !== 'string' ||
        content === ''
      ) {
        return;
      }
      this.data.history.push({ role, content: String(content) });
      if (this.data.history.length > 100) {
        this.data.history.splice(0, this.data.history.length - 100);
      }
      this.save();
    },

    captureName(text) {
      if (this.enabled === false) {
        return;
      }
      const match = /(?:我叫|我是|叫我)\s*([^\s，。、,.!！?？的]{1,10})/.exec(
        text || ''
      );
      if (match !== null && /誰|什麼|不知|沒有/.test(match[1]) === false) {
        this.data.name = match[1];
        this.save();
      }
    },

    clear() {
      this.data = {
        name: '',
        visits: 1,
        last: 0,
        history: [],
        summary: '',
        lastSummarizedTurnIndex: 0
      };
      try {
        if (typeof this.adapter.clear === 'function') {
          this.adapter.clear(this.key);
        } else if (typeof this.adapter.wipe === 'function') {
          this.adapter.wipe(this.key);
        }
      } catch (_error) {}
    }
  };

  memory.load();

  return memory;
}

/**
 * 檢查並觸發背景非同步滾動摘要更新 (Non-blocking Background Summarization)
 *
 * @param {Object} brainEngine - 大腦引擎實例
 * @returns {Promise<void>}
 */
export async function triggerRollingSummaryIfNeeded(brainEngine) {
  if (
    typeof brainEngine !== 'object' ||
    brainEngine === null ||
    brainEngine.memory?.enabled !== true ||
    brainEngine._isSummarizing === true
  ) {
    return;
  }

  const compressionOptions = brainEngine.compression || {};
  const currentEngineType =
    brainEngine.aiProvider?.enabled === true &&
    brainEngine.aiProvider.ready === true
      ? BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      : BRAIN_ENGINE_TYPE_MAP.WEB_LLM;

  const limits = resolveCompressionLimits(
    compressionOptions,
    currentEngineType
  );
  if (limits.strategy !== COMPRESSION_STRATEGY_MAP.ROLLING_SUMMARY) {
    return;
  }

  const history = brainEngine.memory.data.history || [];
  const threshold =
    typeof compressionOptions.summaryThresholdTurns === 'number' &&
    compressionOptions.summaryThresholdTurns > 0
      ? compressionOptions.summaryThresholdTurns
      : DEFAULT_SUMMARY_THRESHOLD_TURNS;

  const lastIndex =
    typeof brainEngine.memory.data.lastSummarizedTurnIndex === 'number'
      ? brainEngine.memory.data.lastSummarizedTurnIndex
      : 0;
  const unsummarizedCount = history.length - lastIndex;

  // 每 2 則訊息 (user + assistant) 視為一整輪
  const unsummarizedTurns = Math.floor(unsummarizedCount / 2);
  if (unsummarizedTurns < threshold) {
    return;
  }

  brainEngine._isSummarizing = true;

  // 使用 setTimeout 確保摘要在背景執行，不阻礙任何當前任務
  setTimeout(async () => {
    try {
      const oldSummary = brainEngine.memory.data.summary || '';
      const newTurns = history.slice(lastIndex);

      let llmChat = null;
      if (
        brainEngine.aiProvider?.enabled === true &&
        brainEngine.aiProvider.ready === true &&
        typeof brainEngine.aiProvider.chat === 'function'
      ) {
        llmChat = async (promptMsgs) => {
          const summaryResponse = await brainEngine.aiProvider.chat(promptMsgs);
          return typeof summaryResponse === 'string'
            ? summaryResponse
            : typeof summaryResponse?.content === 'string'
              ? summaryResponse.content
              : '';
        };
      } else if (
        brainEngine.llm?.state === STATE_MAP.READY &&
        typeof brainEngine.llm?.engine?.chat?.completions?.create === 'function'
      ) {
        llmChat = async (promptMsgs) => {
          const completionResult =
            await brainEngine.llm.engine.chat.completions.create({
              messages: promptMsgs,
              temperature: 0.3
            });
          return completionResult?.choices?.[0]?.message?.content || '';
        };
      }

      const newSummary = await generateRollingSummary({
        oldSummary,
        newTurns,
        locale: brainEngine.locale,
        llmChat,
        customGenerator: compressionOptions.summaryGenerator
      });

      if (typeof newSummary === 'string' && newSummary.trim() !== '') {
        brainEngine.memory.data.summary = newSummary.trim();
        brainEngine.memory.data.lastSummarizedTurnIndex = history.length;
        brainEngine.memory.save();

        if (typeof brainEngine.onSummaryUpdated === 'function') {
          brainEngine.onSummaryUpdated(newSummary.trim());
        }
      }
    } catch (summaryError) {
      console.warn(
        '[triggerRollingSummaryIfNeeded] Background summarization failed:',
        summaryError
      );
    } finally {
      brainEngine._isSummarizing = false;
    }
  }, 50);
}
