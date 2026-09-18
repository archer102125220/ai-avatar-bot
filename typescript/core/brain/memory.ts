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
} from '@/core/constants';
import type {
  MemoryData,
  MemoryAdapter,
  MemoryInstance,
  AvatarMode,
  BrainEngine
} from '@types';
import {
  resolveCompressionLimits,
  generateRollingSummary
} from './compression';

/**
 * Creates default memory data conforming to the latest schema version.
 *
 * @returns Default memory structure.
 */
export function createDefaultMemoryData(): MemoryData {
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
 */
const MIGRATIONS: Record<number, (oldData: any) => MemoryData> = {
  1: (oldData: any): MemoryData => {
    const rawHistory = Array.isArray(oldData?.history) === true ? oldData.history : [];
    const sanitizedHistory = rawHistory
      .filter((item: unknown) => typeof item === 'object' && item !== null)
      .map((item: any) => {
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
 * @param rawData - Raw data retrieved from storage.
 * @returns Migrated memory data object.
 */
export function migrateMemoryData(rawData: unknown): MemoryData {
  if (typeof rawData !== 'object' || rawData === null) {
    return createDefaultMemoryData();
  }

  const rawObj = rawData as Record<string, any>;
  let currentVersion =
    typeof rawObj.version === 'number' && Number.isFinite(rawObj.version) === true
      ? rawObj.version
      : 0;

  let migratedData: any = { ...rawObj };

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

  return migratedData as MemoryData;
}

/**
 * Initializes the conversation memory subsystem.
 *
 * @param params - Initialization parameters.
 * @returns Initialized memory controller instance.
 */
export function initMemory({
  avatarMode = DEFAULT_AVATAR_MODE as AvatarMode,
  enableMemory = DEFAULT_ENABLE_MEMORY,
  memoryKey = DEFAULT_MEMORY_KEY,
  maxHistoryTurns = DEFAULT_MAX_HISTORY_TURNS,
  memoryAdapter = null
}: {
  avatarMode?: AvatarMode;
  enableMemory?: boolean;
  memoryKey?: string;
  maxHistoryTurns?: number;
  memoryAdapter?: MemoryAdapter | null;
} = {}): MemoryInstance {
  const isEnabled =
    typeof enableMemory === 'boolean'
      ? enableMemory
      : avatarMode === AVATAR_MODE_MAP.companion;

  const defaultLocalStorageAdapter: MemoryAdapter = {
    load(storageKey: string): MemoryData | null {
      try {
        if (typeof localStorage !== 'undefined') {
          const rawData = localStorage.getItem(storageKey);
          return rawData !== null ? (JSON.parse(rawData) as MemoryData) : null;
        }
      } catch (_error) {
        // Fallback on storage read error
      }
      return null;
    },
    save(storageKey: string, data: MemoryData): void {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(data));
        }
      } catch (_error) {
        // Fallback on storage write error
      }
    },
    clear(storageKey: string): void {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(storageKey);
        }
      } catch (_error) {
        // Fallback on storage delete error
      }
    }
  };

  const adapter: MemoryAdapter =
    typeof memoryAdapter === 'object' && memoryAdapter !== null
      ? memoryAdapter
      : defaultLocalStorageAdapter;

  const memory: MemoryInstance = {
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

    load(): void {
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

    save(): void {
      if (this.enabled === false) {
        return;
      }
      try {
        this.data.last = Date.now();
        this.adapter.save(this.key, this.data);
      } catch (_error) {
        // Ignore save error
      }
    },

    addTurn(role: string, content: string): void {
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

    captureName(text: string): void {
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

    getVersion(): number {
      return this.data?.version || CURRENT_MEMORY_VERSION;
    },

    getMetadata(): Record<string, any> {
      return (
        typeof this.data?.metadata === 'object' && this.data.metadata !== null
          ? this.data.metadata
          : {}
      );
    },

    setMetadata(patchOrUpdater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)): void {
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

    clear(): void {
      this.data = createDefaultMemoryData();
      this.data.visits = 1;
      try {
        if (typeof this.adapter.clear === 'function') {
          this.adapter.clear(this.key);
        }
      } catch (_error) {
        // Ignore clear error
      }
    }
  };

  memory.load();

  return memory;
}

/**
 * Checks and triggers non-blocking background rolling summarization if criteria are met.
 *
 * @param brainEngine - Brain engine instance.
 */
export async function triggerRollingSummaryIfNeeded(
  brainEngine: BrainEngine | Record<string, any> | null | undefined
): Promise<void> {
  const engine = brainEngine as Record<string, any>;
  if (
    typeof engine !== 'object' ||
    engine === null ||
    engine.memory?.enabled !== true ||
    engine._isSummarizing === true
  ) {
    return;
  }

  const compressionOptions = engine.compression || {};
  const currentEngineType =
    engine.aiProvider?.enabled === true &&
    engine.aiProvider.ready === true
      ? BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      : BRAIN_ENGINE_TYPE_MAP.WEB_LLM;

  const limits = resolveCompressionLimits(
    compressionOptions,
    currentEngineType
  );
  if (limits.strategy !== COMPRESSION_STRATEGY_MAP.ROLLING_SUMMARY) {
    return;
  }

  const history = engine.memory.data.history || [];
  const threshold =
    typeof compressionOptions.summaryThresholdTurns === 'number' &&
    compressionOptions.summaryThresholdTurns > 0
      ? compressionOptions.summaryThresholdTurns
      : DEFAULT_SUMMARY_THRESHOLD_TURNS;

  const lastIndex =
    typeof engine.memory.data.lastSummarizedTurnIndex === 'number'
      ? engine.memory.data.lastSummarizedTurnIndex
      : 0;
  const unsummarizedCount = history.length - lastIndex;

  const unsummarizedTurns = Math.floor(unsummarizedCount / 2);
  if (unsummarizedTurns < threshold) {
    return;
  }

  engine._isSummarizing = true;

  setTimeout(async () => {
    try {
      const oldSummary = engine.memory.data.summary || '';
      const newTurns = history.slice(lastIndex);

      let llmChat: ((promptMsgs: Array<{ role: string; content: string }>) => Promise<string>) | null = null;
      if (
        engine.aiProvider?.enabled === true &&
        engine.aiProvider.ready === true &&
        typeof engine.aiProvider.chat === 'function'
      ) {
        llmChat = async (promptMsgs: Array<{ role: string; content: string }>): Promise<string> => {
          const summaryResponse = await engine.aiProvider.chat(promptMsgs);
          return typeof summaryResponse === 'string'
            ? summaryResponse
            : typeof summaryResponse?.content === 'string'
              ? summaryResponse.content
              : '';
        };
      } else if (
        engine.llm?.state === STATE_MAP.READY &&
        typeof engine.llm?.engine?.chat?.completions?.create === 'function'
      ) {
        llmChat = async (promptMsgs: Array<{ role: string; content: string }>): Promise<string> => {
          const completionResult =
            await engine.llm.engine.chat.completions.create({
              messages: promptMsgs,
              temperature: 0.3
            });
          return completionResult?.choices?.[0]?.message?.content || '';
        };
      }

      const newSummary = await generateRollingSummary({
        oldSummary,
        newTurns,
        locale: engine.locale,
        llmChat,
        customGenerator: compressionOptions.summaryGenerator
      });

      if (typeof newSummary === 'string' && newSummary.trim() !== '') {
        engine.memory.data.summary = newSummary.trim();
        engine.memory.data.lastSummarizedTurnIndex = history.length;
        engine.memory.save();

        if (typeof engine.onSummaryUpdated === 'function') {
          engine.onSummaryUpdated(newSummary.trim());
        }
      }
    } catch (summaryError) {
      console.warn(
        '[triggerRollingSummaryIfNeeded] Background summarization failed:',
        summaryError
      );
    } finally {
      engine._isSummarizing = false;
    }
  }, 50);
}
