import {
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_ENABLE_MEMORY,
  DEFAULT_MEMORY_KEY,
  CURRENT_MEMORY_VERSION,
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
 * Multi-turn conversation memory data structure.
 * @typedef {import('@types').MemoryData} MemoryData
 */

/**
 * Storage adapter interface for persistent conversation memory.
 * @typedef {import('@types').MemoryAdapter} MemoryAdapter
 */

/**
 * Initialized memory controller instance referencing types/index.d.ts via @types.
 * @typedef {import('@types').MemoryInstance} MemoryInstance
 */

/**
 * Creates default memory data conforming to the latest schema version.
 *
 * @returns {MemoryData} Default memory structure.
 */
export function createDefaultMemoryData() {
  return {
    version: CURRENT_MEMORY_VERSION,
    name: '',
    visits: 0,
    last: 0,
    history: [],
    summary: '',
    lastSummarizedTurnIndex: 0,
    metadata: {}
  };
}

/**
 * Version migration mapping for conversation memory schemas.
 * @type {Record<number, (oldData: any) => MemoryData>}
 */
const MIGRATIONS = {
  // 從 v0 (舊版無版本號) 升級至 v1
  1: (oldData) => {
    const rawHistory = Array.isArray(oldData?.history) === true ? oldData.history : [];
    const sanitizedHistory = rawHistory
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

    return {
      version: 1,
      name: typeof oldData?.name === 'string' ? oldData.name : '',
      visits:
        typeof oldData?.visits === 'number' && Number.isFinite(oldData.visits) === true
          ? oldData.visits
          : 0,
      last:
        typeof oldData?.last === 'number' && Number.isFinite(oldData.last) === true
          ? oldData.last
          : 0,
      history: sanitizedHistory,
      summary: typeof oldData?.summary === 'string' ? oldData.summary : '',
      lastSummarizedTurnIndex:
        typeof oldData?.lastSummarizedTurnIndex === 'number' &&
        Number.isFinite(oldData.lastSummarizedTurnIndex) === true
          ? oldData.lastSummarizedTurnIndex
          : 0,
      metadata:
        typeof oldData?.metadata === 'object' && oldData.metadata !== null
          ? oldData.metadata
          : {}
    };
  }
};

/**
 * Validates and migrates raw stored memory data to the latest schema version.
 *
 * @param {any} rawData - Raw data retrieved from storage.
 * @returns {MemoryData} Migrated memory data object.
 */
export function migrateMemoryData(rawData) {
  if (typeof rawData !== 'object' || rawData === null) {
    return createDefaultMemoryData();
  }

  let currentVersion =
    typeof rawData.version === 'number' && Number.isFinite(rawData.version) === true
      ? rawData.version
      : 0;

  let migratedData = { ...rawData };

  while (currentVersion < CURRENT_MEMORY_VERSION) {
    const nextVersion = currentVersion + 1;
    const migrationFn = MIGRATIONS[nextVersion];

    if (typeof migrationFn === 'function') {
      try {
        migratedData = migrationFn(migratedData);
        currentVersion = nextVersion;
      } catch (err) {
        console.warn(
          `[Memory Migration] Failed migrating to v${nextVersion}:`,
          err
        );
        return createDefaultMemoryData();
      }
    } else {
      migratedData.version = CURRENT_MEMORY_VERSION;
      break;
    }
  }

  migratedData.version = CURRENT_MEMORY_VERSION;

  if (typeof migratedData.name !== 'string') {
    migratedData.name = '';
  }
  if (
    typeof migratedData.visits !== 'number' ||
    Number.isFinite(migratedData.visits) === false
  ) {
    migratedData.visits = 0;
  }
  if (
    typeof migratedData.last !== 'number' ||
    Number.isFinite(migratedData.last) === false
  ) {
    migratedData.last = 0;
  }
  if (Array.isArray(migratedData.history) === false) {
    migratedData.history = [];
  }
  if (typeof migratedData.summary !== 'string') {
    migratedData.summary = '';
  }
  if (
    typeof migratedData.lastSummarizedTurnIndex !== 'number' ||
    Number.isFinite(migratedData.lastSummarizedTurnIndex) === false
  ) {
    migratedData.lastSummarizedTurnIndex = 0;
  }
  if (
    typeof migratedData.metadata !== 'object' ||
    migratedData.metadata === null
  ) {
    migratedData.metadata = {};
  }

  return migratedData;
}

/**
 * Initializes the conversation memory subsystem.
 *
 * @param {Object} [params={}] - Initialization parameters.
 * @param {import('@types').AvatarMode} [params.avatarMode=DEFAULT_AVATAR_MODE] - Avatar persona mode.
 * @param {boolean} [params.enableMemory=DEFAULT_ENABLE_MEMORY] - Whether memory is enabled.
 * @param {string} [params.memoryKey=DEFAULT_MEMORY_KEY] - Storage key identifier.
 * @param {number} [params.maxHistoryTurns=DEFAULT_MAX_HISTORY_TURNS] - Maximum history turns retained.
 * @param {MemoryAdapter | null} [params.memoryAdapter=null] - Custom storage adapter.
 * @returns {MemoryInstance} Initialized memory controller instance.
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
    data: createDefaultMemoryData(),

    load() {
      if (this.enabled === false) {
        return;
      }
      try {
        const localData = this.adapter.load(this.key);
        this.data = migrateMemoryData(localData);
      } catch (_error) {
        this.data = createDefaultMemoryData();
      }
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

    getVersion() {
      return this.data?.version || CURRENT_MEMORY_VERSION;
    },

    getMetadata() {
      return (
        typeof this.data?.metadata === 'object' && this.data.metadata !== null
          ? this.data.metadata
          : {}
      );
    },

    setMetadata(patchOrUpdater) {
      if (this.enabled === false) {
        return;
      }
      const currentMetadata = this.getMetadata();
      if (typeof patchOrUpdater === 'function') {
        const nextMeta = patchOrUpdater(currentMetadata);
        if (typeof nextMeta === 'object' && nextMeta !== null) {
          this.data.metadata = nextMeta;
        }
      } else if (
        typeof patchOrUpdater === 'object' &&
        patchOrUpdater !== null
      ) {
        this.data.metadata = Object.assign({}, currentMetadata, patchOrUpdater);
      }
      this.save();
    },

    clear() {
      this.data = createDefaultMemoryData();
      this.data.visits = 1;
      try {
        if (typeof this.adapter.clear === 'function') {
          this.adapter.clear(this.key);
        }
      } catch (_error) {}
    }
  };

  memory.load();

  return memory;
}


/**
 * Checks and triggers non-blocking background rolling summarization if criteria are met.
 *
 * @param {import('@types').BrainEngine} brainEngine - Brain engine instance.
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
