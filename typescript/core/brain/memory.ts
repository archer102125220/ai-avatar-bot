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
  BrainEngine,
  ChatHistoryItem
} from './types';
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
const MIGRATIONS: Record<
  number,
  (oldData: Record<string, unknown>) => MemoryData
> = {
  1: (oldData: Record<string, unknown>): MemoryData => {
    const rawHistory = Array.isArray(oldData?.history) ? oldData.history : [];
    const sanitizedHistory = rawHistory
      .filter((item: unknown) => typeof item === 'object' && item !== null)
      .map((itemObj: unknown) => {
        const item = itemObj as Record<string, unknown>;
        let safeContent = '';
        if (typeof item.content === 'string') {
          safeContent = item.content;
        } else if (
          typeof item.content === 'object' &&
          item.content !== null &&
          typeof (item.content as { text?: unknown }).text === 'string'
        ) {
          safeContent = (item.content as { text: string }).text;
        } else if (typeof item.text === 'string') {
          safeContent = item.text;
        } else if (typeof item.content === 'object' && item.content !== null) {
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
        typeof oldData?.visits === 'number' &&
        Number.isFinite(oldData.visits) === true
          ? oldData.visits
          : 0,
      last:
        typeof oldData?.last === 'number' &&
        Number.isFinite(oldData.last) === true
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
          ? (oldData.metadata as Record<string, unknown>)
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

  const rawObj = rawData as Record<string, unknown>;
  let currentVersion =
    typeof rawObj.version === 'number' &&
    Number.isFinite(rawObj.version) === true
      ? rawObj.version
      : 0;

  let migratedData: Record<string, unknown> = { ...rawObj };

  while (currentVersion < CURRENT_MEMORY_VERSION) {
    const nextVersion = currentVersion + 1;
    const migrationFn = MIGRATIONS[nextVersion];

    if (typeof migrationFn === 'function') {
      try {
        const result = migrationFn(migratedData);
        migratedData = result as unknown as Record<string, unknown>;
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

  const validatedMemoryData: MemoryData = {
    version: CURRENT_MEMORY_VERSION,
    name: typeof migratedData.name === 'string' ? migratedData.name : '',
    visits:
      typeof migratedData.visits === 'number' &&
      Number.isFinite(migratedData.visits) === true
        ? migratedData.visits
        : 0,
    last:
      typeof migratedData.last === 'number' &&
      Number.isFinite(migratedData.last) === true
        ? migratedData.last
        : 0,
    history: Array.isArray(migratedData.history)
      ? (migratedData.history as ChatHistoryItem[])
      : [],
    summary:
      typeof migratedData.summary === 'string' ? migratedData.summary : '',
    lastSummarizedTurnIndex:
      typeof migratedData.lastSummarizedTurnIndex === 'number' &&
      Number.isFinite(migratedData.lastSummarizedTurnIndex) === true
        ? migratedData.lastSummarizedTurnIndex
        : 0,
    metadata:
      typeof migratedData.metadata === 'object' &&
      migratedData.metadata !== null
        ? (migratedData.metadata as Record<string, unknown>)
        : {}
  };

  return validatedMemoryData;
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

    save(): Promise<void> | void {
      if (this.enabled === false) {
        return;
      }
      try {
        this.data.last = Date.now();
        return this.adapter.save(this.key, this.data);
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

    getMetadata(): Record<string, unknown> {
      return typeof this.data?.metadata === 'object' &&
        this.data.metadata !== null
        ? this.data.metadata
        : {};
    },

    setMetadata(
      patchOrUpdater:
        | Record<string, unknown>
        | ((prev: Record<string, unknown>) => Record<string, unknown>)
    ): void {
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

    clear(): Promise<void> | void {
      this.data = createDefaultMemoryData();
      this.data.visits = 1;
      try {
        if (typeof this.adapter.clear === 'function') {
          return this.adapter.clear(this.key);
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
  brainEngine: BrainEngine | Record<string, unknown> | null | undefined
): Promise<void> {
  const engine = brainEngine as Partial<BrainEngine> | null | undefined;
  if (
    typeof engine !== 'object' ||
    engine === null ||
    typeof engine.memory !== 'object' ||
    engine.memory === null ||
    engine.memory.enabled !== true ||
    engine._isSummarizing === true
  ) {
    return;
  }

  const memory = engine.memory;
  const compressionOptions = engine.compression || {};
  const currentEngineType =
    engine.aiProvider?.enabled === true && engine.aiProvider.ready === true
      ? BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      : BRAIN_ENGINE_TYPE_MAP.WEB_LLM;

  const limits = resolveCompressionLimits(
    compressionOptions,
    currentEngineType
  );
  if (limits.strategy !== COMPRESSION_STRATEGY_MAP.ROLLING_SUMMARY) {
    return;
  }

  const history = memory.data.history || [];
  const threshold =
    typeof compressionOptions.summaryThresholdTurns === 'number' &&
    compressionOptions.summaryThresholdTurns > 0
      ? compressionOptions.summaryThresholdTurns
      : DEFAULT_SUMMARY_THRESHOLD_TURNS;

  const lastIndex =
    typeof memory.data.lastSummarizedTurnIndex === 'number'
      ? memory.data.lastSummarizedTurnIndex
      : 0;
  const unsummarizedCount = history.length - lastIndex;

  const unsummarizedTurns = Math.floor(unsummarizedCount / 2);
  if (unsummarizedTurns < threshold) {
    return;
  }

  engine._isSummarizing = true;

  setTimeout(async () => {
    try {
      const activeMemory = engine.memory;
      if (typeof activeMemory !== 'object' || activeMemory === null) {
        return;
      }
      const oldSummary = activeMemory.data.summary || '';
      const newTurns = history.slice(lastIndex);

      let llmChat:
        | ((
            promptMsgs: Array<{ role: string; content: string }>
          ) => Promise<string>)
        | null = null;
      const aiProvider = engine.aiProvider;
      const llm = engine.llm;
      if (
        typeof aiProvider === 'object' &&
        aiProvider !== null &&
        aiProvider.enabled === true &&
        aiProvider.ready === true &&
        typeof aiProvider.chat === 'function'
      ) {
        llmChat = async (
          promptMsgs: Array<{ role: string; content: string }>
        ): Promise<string> => {
          const summaryResponse = await aiProvider.chat(promptMsgs);
          if (typeof summaryResponse === 'string') {
            return summaryResponse;
          }
          if (
            typeof summaryResponse === 'object' &&
            summaryResponse !== null &&
            'content' in summaryResponse &&
            typeof (summaryResponse as { content: unknown }).content ===
              'string'
          ) {
            return (summaryResponse as { content: string }).content;
          }
          return '';
        };
      } else if (
        typeof llm === 'object' &&
        llm !== null &&
        llm.state === STATE_MAP.READY &&
        typeof llm.engine?.chat?.completions?.create === 'function'
      ) {
        llmChat = async (
          promptMsgs: Array<{ role: string; content: string }>
        ): Promise<string> => {
          const completionResult = (await llm.engine!.chat!.completions!.create(
            {
              messages: promptMsgs,
              temperature: 0.3
            }
          )) as {
            choices?: Array<{
              message?: {
                content?: string | null;
              };
            }>;
          };
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
        activeMemory.data.summary = newSummary.trim();
        activeMemory.data.lastSummarizedTurnIndex = history.length;
        activeMemory.save();

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
