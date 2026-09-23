import type { ToolDefinition, ToolRouteCandidate } from '@/core/tools';
import type { I18nEngine } from '@/core/i18n';
import type {
  AvatarMode,
  PendingToolState,
  AutoContinueStartInfo,
  AutoContinueResumeInfo,
  AutoContinueEndInfo,
  ToolNotFoundErrorInfo,
  ToolErrorInfo,
  LlmLoadProgressInfo,
  ChatRole
} from '@/core/types';

export type {
  AvatarMode,
  PendingToolState,
  AutoContinueStartInfo,
  AutoContinueResumeInfo,
  AutoContinueEndInfo,
  ToolNotFoundErrorInfo,
  ToolErrorInfo,
  LlmLoadProgressInfo
};

/**
 * Conversation turn item stored in memory history.
 */
export interface ChatHistoryItem {
  /** Role of the speaker. */
  role: ChatRole;
  /** Text content of the message. */
  content: string;
  /** Optional metadata or timestamp. */
  [key: string]: unknown;
}

/**
 * Data structure representing persistent user conversation memory.
 */
export interface MemoryData {
  /** Schema structure version number. */
  version: number;
  /** Visitor / user display name. */
  name: string;
  /** Number of visits / conversation sessions. */
  visits: number;
  /** Timestamp (ms) of the last visit. */
  last: number;
  /** Multi-turn conversation history list. */
  history: ChatHistoryItem[];
  /** Rolling conversation summary generated in the background. */
  summary?: string;
  /** Turn index where the last summarization occurred. */
  lastSummarizedTurnIndex?: number;
  /** Custom developer-defined metadata slots. */
  metadata?: Record<string, unknown>;
  /** Index signature for arbitrary metadata keys. */
  [key: string]: unknown;
}

/**
 * Custom storage adapter interface for loading, saving, and clearing persistent memory.
 */
export interface MemoryAdapter {
  /** Loads memory data for a given key. */
  load(key: string): MemoryData | null | Promise<MemoryData | null>;
  /** Saves memory data for a given key. */
  save(key: string, data: MemoryData): void | Promise<void>;
  /** Clears memory data for a given key. */
  clear(key: string): void | Promise<void>;
}

/**
 * Memory subsystem instance controller.
 */
export interface MemoryInstance {
  /** Whether memory is currently enabled. */
  enabled: boolean;
  /** Current memory data payload. */
  data: MemoryData;
  /** Storage key used in storage adapter. */
  key: string;
  /** Maximum number of history turns retained. */
  maxHistoryTurns: number;
  /** Underlying storage adapter. */
  adapter: MemoryAdapter;
  /** Loads memory data from adapter. */
  load(): Promise<MemoryData> | void;
  /** Saves current memory data to adapter. */
  save(): Promise<void> | void;
  /** Clears memory data from adapter. */
  clear(): Promise<void> | void;
  /** Adds a turn to conversation history. */
  addTurn(role: string, content: string): Promise<void> | void;
  /** Captures visitor name from user input. */
  captureName(text: string): void;
  /** Updates user visitor name in memory. */
  setName?(name: string): Promise<void> | void;
  /** Gets current memory schema version. */
  getVersion(): number;
  /** Gets memory metadata dictionary. */
  getMetadata(): Record<string, unknown>;
  /** Sets or updates memory metadata dictionary. */
  setMetadata(
    patchOrUpdater:
      | Record<string, unknown>
      | ((prev: Record<string, unknown>) => Record<string, unknown>)
  ): void;
}

/**
 * Knowledge base entry structure for RAG / retrieval questions.
 */
export interface KnowledgeEntry {
  /** Question or prompt text. */
  q?: string;
  /** Keywords associated with the entry. */
  kw?: string;
  /** Answer or response text. */
  a?: string;
  /** Optional source attribution data. */
  source?: {
    title?: string;
    url?: string;
    [key: string]: unknown;
  };
  /** Optional metadata tags or category. */
  [key: string]: unknown;
}

/**
 * LLM chat message structure used in inference calls.
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | (string & {});
  content: string | unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
  [key: string]: unknown;
}

/**
 * Context compression configuration options.
 */
export interface BrainCompressionOptions {
  /** Compression strategy ('sliding-window' | 'rolling-summary' | 'none'). */
  strategy?: 'sliding-window' | 'rolling-summary' | 'none' | string;
  /** Global maximum history turns. */
  maxTurns?: number;
  /** Global maximum character budget. */
  maxTotalChars?: number;
  /** WebLLM engine specific limits. */
  webLlm?: { maxTurns?: number; maxTotalChars?: number };
  /** AI Provider engine specific limits. */
  aiProvider?: { maxTurns?: number; maxTotalChars?: number };
  /** Threshold turns before triggering background rolling summary. */
  summaryThresholdTurns?: number;
  /** Custom background rolling summary generator function. */
  summaryGenerator?: (
    params: Record<string, unknown>
  ) => Promise<string> | string;
  /** Custom compression function. */
  customCompressor?: (
    params: Record<string, unknown>
  ) => Promise<LLMMessage[]> | LLMMessage[];
}

/**
 * In-memory UI conversation log item.
 */
export interface ChatLogItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  pendingTool?: PendingToolState | null;
  pendingChoices?: ToolRouteCandidate[] | null;
  [key: string]: unknown;
}

/**
 * Options for adding a message to the chat log.
 */
export interface AddChatMessageOptions {
  id?: string;
  streaming?: boolean;
  pendingTool?: PendingToolState | null;
  pendingChoices?: ToolRouteCandidate[] | null;
  [key: string]: unknown;
}

/**
 * Tool call structure parsed from model output.
 */
export interface ParsedToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Options for in-browser WebLLM engine.
 */
export interface LLMEngineOptions {
  llmModel?: string;
  model?: string;
  llmMaxTokens?: number;
  maxTokens?: number;
  llmIsStream?: boolean;
  isStream?: boolean;
  LLMIsStream?: boolean;
  onLoading?: ((...args: unknown[]) => unknown) | null;
  onLoadProgress?: ((...args: unknown[]) => unknown) | null;
  onLoaded?: ((...args: unknown[]) => unknown) | null;
  onLoadError?: ((...args: unknown[]) => unknown) | null;
  onChatting?: ((...args: unknown[]) => unknown) | null;
  onStreamChatting?: ((...args: unknown[]) => unknown) | null;
}

/**
 * In-browser WebLLM engine instance interface.
 */
export interface LLMEngine {
  readonly supported: boolean;
  state: string | number;
  progress: number;
  model: string;
  error?: string;
  readonly maxTokens: number;
  readonly isStream: boolean;
  readonly onLoading: (...args: unknown[]) => unknown;
  readonly onLoadProgress: (...args: unknown[]) => unknown;
  readonly onLoaded: (...args: unknown[]) => unknown;
  readonly onLoadError: (...args: unknown[]) => unknown;
  readonly onChatting: (...args: unknown[]) => unknown;
  readonly onStreamChatting: (...args: unknown[]) => unknown;
  readonly engine?: {
    chat?: {
      completions?: {
        create(options: Record<string, unknown>): Promise<unknown>;
      };
    };
  } | null;
  load(): Promise<unknown>;
  chat(
    messages: LLMMessage[] | Array<Record<string, unknown>>,
    onDelta?:
      | ((
          chunkDelta: string,
          accumulatedText: string,
          llm?: unknown,
          brain?: unknown
        ) => void)
      | null,
    tools?: ToolDefinition[]
  ): Promise<unknown>;
}

/**
 * Options for server-side AI Provider engine.
 */
export interface AiProviderOptions {
  enableAiProvider?: boolean;
  providerEnabled?: boolean;
  enabled?: boolean;
  providerBaseUrl?: string;
  baseUrl?: string;
  providerPingUrl?: string;
  pingUrl?: string;
  providerChatUrl?: string;
  chatUrl?: string;
  providerModel?: string;
  model?: string;
  providerCreateFetchSetting?:
    ((...args: unknown[]) => RequestInit) | RequestInit | null;
  createFetchSetting?:
    ((...args: unknown[]) => RequestInit) | RequestInit | null;
  providerCreateFetchPayload?:
    | ((...args: unknown[]) => Record<string, unknown>)
    | Record<string, unknown>
    | null;
  createFetchPayload?:
    | ((...args: unknown[]) => Record<string, unknown>)
    | Record<string, unknown>
    | null;
  providerResponseFormat?:
    ((...args: unknown[]) => unknown) | string | Record<string, unknown> | null;
  responseFormat?:
    ((...args: unknown[]) => unknown) | string | Record<string, unknown> | null;
  providerExtractToolCalls?: ((...args: unknown[]) => unknown) | null;
  extractToolCalls?: ((...args: unknown[]) => unknown) | null;
  providerMaxTokens?: number;
  maxTokens?: number;
  providerIsStream?: boolean;
  isStream?: boolean;
  onConnecting?: ((...args: unknown[]) => unknown) | null;
  onConnected?: ((...args: unknown[]) => unknown) | null;
  onError?: ((...args: unknown[]) => unknown) | null;
  onChatting?: ((...args: unknown[]) => unknown) | null;
  onStreamChatting?: ((...args: unknown[]) => unknown) | null;
}

/**
 * Server-side AI Provider engine instance interface.
 */
export interface AiProviderEngine {
  baseUrl: string;
  pingUrl: string;
  chatUrl: string;
  readonly createFetchSetting: unknown;
  readonly createFetchPayload: unknown;
  readonly responseFormat: unknown;
  readonly extractToolCalls: unknown;
  readonly maxTokens: number;
  readonly isStream: boolean;
  readonly onConnecting: (...args: unknown[]) => unknown;
  readonly onConnected: (...args: unknown[]) => unknown;
  readonly onError: (...args: unknown[]) => unknown;
  readonly onChatting: (...args: unknown[]) => unknown;
  readonly onStreamChatting: (...args: unknown[]) => unknown;
  model: string;
  enabled: boolean;
  ready: boolean;
  ping(fetchSetting?: unknown): Promise<boolean>;
  chat(
    messages: LLMMessage[] | Array<Record<string, unknown>>,
    fetchSetting?: unknown,
    tools?: ToolDefinition[]
  ): Promise<unknown>;
}

/**
 * Options for initializing the BrainEngine.
 */
export interface BrainEngineOptions {
  enableMemory?: boolean;
  maxHistoryTurns?: number;
  memoryKey?: string;
  memoryAdapter?: MemoryAdapter | null;
  compression?: BrainCompressionOptions;
  modes?: Record<string, unknown>;
  llmModel?: string;
  preloadWebLLM?: boolean;
  autoFallbackWebLLM?: boolean;
  knowledge?: KnowledgeEntry[] | Record<string, unknown> | string | null;
  knowledgeUrl?: string;
  companionKnowledge?:
    KnowledgeEntry[] | Record<string, unknown> | string | null;
  companionKnowledgeUrl?: string;
  companionFallback?:
    Array<string | Record<string, unknown>> | ((context: unknown) => string);
  companionFallbackContext?: string | ((context: unknown) => string);
  assistantFallbackContext?: string | ((context: unknown) => string);
  enableAiProvider?: boolean;
  aiProviderModel?: string;
  aiProviderBaseUrl?: string;
  welcomeText?: string | ((context: unknown) => string) | null;
  companionWelcomeText?: string | ((context: unknown) => string) | null;
  assistantWelcomeText?: string | ((context: unknown) => string) | null;
  llmMaxTokens?: number;
  llmIsStream?: boolean;
  onLlmLoading?: (...args: unknown[]) => unknown;
  onLlmLoadProgress?: (
    progress: LlmLoadProgressInfo,
    ...args: unknown[]
  ) => unknown;
  onLlmLoaded?: (engineInstance?: unknown, ...args: unknown[]) => unknown;
  onLlmLoadError?: (error: Error, ...args: unknown[]) => unknown;
  onLlmChatting?: (response?: unknown, ...args: unknown[]) => unknown;
  onLlmStreamChatting?: (chunk?: unknown, ...args: unknown[]) => unknown;
  onAiProviderConnecting?: (fetchSetting?: unknown, ...args: unknown[]) => unknown;
  onAiProviderConnected?: (response?: unknown, ...args: unknown[]) => unknown;
  onAiProviderError?: (error: Error, ...args: unknown[]) => unknown;
  onAiProviderChatting?: (response?: unknown, ...args: unknown[]) => unknown;
  onAiProviderStreamChatting?: (chunk?: unknown, ...args: unknown[]) => unknown;
  onAddChatMessage?:
    | ((item: ChatLogItem, ...args: unknown[]) => unknown)
    | ((
        role: string,
        text: string,
        options?: AddChatMessageOptions,
        ...args: unknown[]
      ) => unknown);
  onUpdateChatMessage?:
    | ((item: ChatLogItem, ...args: unknown[]) => unknown)
    | ((id: string, text: string, streaming?: boolean, ...args: unknown[]) => unknown);
  onChatHistoryChanged?: (history: ChatLogItem[], ...args: unknown[]) => unknown;
  onSpokenAudioPlayNow?: (text: string, ...args: unknown[]) => unknown;
  onSpokenDisplayTextChange?: (text: string, ...args: unknown[]) => unknown;
  onSpokenAudioTextChange?: (text: string, ...args: unknown[]) => unknown;
  onEmotionChange?: (emotion: string, ...args: unknown[]) => unknown;
  onSummaryUpdated?: (summary: string, ...args: unknown[]) => unknown;
  onStreamStart?: (...args: unknown[]) => unknown;
  onStreamChunk?: (chunk: string, ...args: unknown[]) => unknown;
  onStreamEnd?: (fullText: string, ...args: unknown[]) => unknown;
  onAutoContinueStart?: (
    info: AutoContinueStartInfo,
    ...args: unknown[]
  ) => unknown;
  onAutoContinueWait?: (
    info: AutoContinueStartInfo,
    ...args: unknown[]
  ) => unknown;
  onAutoContinueResume?: (
    info: AutoContinueResumeInfo,
    ...args: unknown[]
  ) => unknown;
  onAutoContinueEnd?: (
    info: AutoContinueEndInfo,
    ...args: unknown[]
  ) => unknown;
  aiProviderCreateFetchSetting?:
    ((...args: unknown[]) => RequestInit) | RequestInit | null;
  aiProviderCreateFetchPayload?:
    | ((...args: unknown[]) => Record<string, unknown>)
    | Record<string, unknown>
    | null;
  aiProviderResponseFormat?: string | Record<string, unknown> | null;
  aiProviderPingUrl?: string;
  aiProviderChatUrl?: string;
  aiProviderMaxTokens?: number;
  aiProviderIsStream?: boolean;
  aiProviderExtractToolCalls?: ((...args: unknown[]) => unknown) | null;
  getTools?: () => ToolDefinition[];
  getToolByName?: (name: string) => ToolDefinition | null;
  offerToolConfirmation?: (
    tool: ToolDefinition,
    args: Record<string, unknown>,
    options?: unknown
  ) => Promise<boolean> | boolean;
  executeTool?: (
    tool: ToolDefinition | string,
    args: Record<string, unknown>,
    options?: unknown
  ) => Promise<unknown> | unknown;
  buildLLMMessages?: (question: string, engineType: string) => LLMMessage[];
  i18nEngine?: I18nEngine | null;
  locale?: string;
  systemContextTemplate?: string | ((...args: unknown[]) => string);
  companionSystemContextTemplate?: string | ((...args: unknown[]) => string);
  ragTemplate?: string | ((...args: unknown[]) => string);
  customContext?: Record<string, unknown> | null;
  languageRule?: string | ((...args: unknown[]) => string);
  gender?: string;
  genderRule?: string | ((...args: unknown[]) => string);
  enableAutoContinue?: boolean;
  maxAutoContinuations?: number;
  autoContinueMode?: 'stream' | 'buffered' | string;
  autoContinuePrompt?: string | ((...args: unknown[]) => string) | null;
  onBrainFallback?: (
    fromEngine: string,
    toEngine: string,
    error: unknown,
    ...args: unknown[]
  ) => unknown;
  onToolNotFound?: (
    info: ToolNotFoundErrorInfo,
    ...args: unknown[]
  ) => unknown;
  onToolError?: (
    info: ToolErrorInfo,
    ...args: unknown[]
  ) => unknown;
}

/**
 * AI Brain Engine instance managing WebLLM, AI Provider, Memory, and RAG.
 */
export interface BrainEngine {
  readonly STATE_MAP: Record<string, string>;
  readonly AVATAR_MODE_MAP: Record<string, string>;
  readonly DEFAULT_AVATAR_MODE: string;
  readonly DEFAULT_LLM_MODEL: string;
  readonly DEFAULT_AI_PROVIDER_MODEL: string;
  readonly BRAIN_ENGINE_TYPE_MAP: Record<string, string>;
  readonly BRAIN_FALLBACK_TYPE_MAP: Record<string, string>;
  readonly LLM_FINISH_REASON_MAP: Record<string, string>;
  readonly FINISH_REASON_MAP: Record<string, string>;
  avatarMode?: AvatarMode;
  modes: Record<string, unknown>;
  readonly availableModes: string[];
  enableMemory: boolean;
  enableAiProvider: boolean;
  preloadWebLLM: boolean;
  autoFallbackWebLLM: boolean;
  enableAutoContinue: boolean;
  maxAutoContinuations: number;
  autoContinueMode: 'stream' | 'buffered' | string;
  autoContinuePrompt: string | ((...args: unknown[]) => string) | null;
  _isSummarizing?: boolean;
  knowledgeUrl?: string;
  knowledge: KnowledgeEntry[];
  companionKnowledgeUrl?: string;
  companionKnowledge: KnowledgeEntry[];
  companionFallback?: unknown;
  companionFallbackIdx: number;
  companionFallbackContext?: string | ((context: unknown) => string);
  assistantFallbackContext?: string | ((context: unknown) => string);
  getTools: () => ToolDefinition[];
  getToolByName: ((name: string) => ToolDefinition | null) | null;
  offerToolConfirmation:
    | ((
        tool: ToolDefinition,
        args: Record<string, unknown>,
        options?: unknown
      ) => Promise<boolean> | boolean)
    | null;
  executeTool:
    | ((
        tool: ToolDefinition | string,
        args: Record<string, unknown>,
        options?: unknown
      ) => Promise<unknown> | unknown)
    | null;
  onLlmLoading: ((...args: unknown[]) => unknown) | null;
  onLlmLoadProgress:
    | ((
        progress: LlmLoadProgressInfo,
        ...args: unknown[]
      ) => unknown)
    | null;
  onLlmLoaded:
    | ((engineInstance?: unknown, ...args: unknown[]) => unknown)
    | null;
  onLlmLoadError: ((error: Error, ...args: unknown[]) => unknown) | null;
  onLlmChatting: ((response?: unknown, ...args: unknown[]) => unknown) | null;
  onLlmStreamChatting:
    | ((chunk?: unknown, ...args: unknown[]) => unknown)
    | null;
  onAiProviderConnecting:
    | ((fetchSetting?: unknown, ...args: unknown[]) => unknown)
    | null;
  onAiProviderConnected:
    | ((response?: unknown, ...args: unknown[]) => unknown)
    | null;
  onAiProviderError: ((error: Error, ...args: unknown[]) => unknown) | null;
  onAiProviderChatting:
    | ((response?: unknown, ...args: unknown[]) => unknown)
    | null;
  onAiProviderStreamChatting:
    | ((chunk?: unknown, ...args: unknown[]) => unknown)
    | null;
  onAddChatMessage:
    | ((item: ChatLogItem, ...args: unknown[]) => unknown)
    | ((
        role: string,
        text: string,
        options?: AddChatMessageOptions,
        ...args: unknown[]
      ) => unknown)
    | null;
  onUpdateChatMessage:
    | ((item: ChatLogItem, ...args: unknown[]) => unknown)
    | ((id: string, text: string, streaming?: boolean, ...args: unknown[]) => unknown)
    | null;
  onChatHistoryChanged:
    | ((history: ChatLogItem[], ...args: unknown[]) => unknown)
    | null;
  onSpokenAudioPlayNow: ((text: string, ...args: unknown[]) => unknown) | null;
  onSpokenDisplayTextChange:
    | ((text: string, ...args: unknown[]) => unknown)
    | null;
  onSpokenAudioTextChange:
    | ((text: string, ...args: unknown[]) => unknown)
    | null;
  onEmotionChange: ((emotion: string, ...args: unknown[]) => unknown) | null;
  onSummaryUpdated: ((summary: string, ...args: unknown[]) => unknown) | null;
  onStreamStart: ((...args: unknown[]) => unknown) | null;
  onStreamChunk: ((chunk: string, ...args: unknown[]) => unknown) | null;
  onStreamEnd: ((fullText: string, ...args: unknown[]) => unknown) | null;
  onAutoContinueStart:
    | ((
        info: AutoContinueStartInfo,
        ...args: unknown[]
      ) => unknown)
    | null;
  onAutoContinueWait:
    | ((
        info: AutoContinueStartInfo,
        ...args: unknown[]
      ) => unknown)
    | null;
  onAutoContinueResume:
    | ((
        info: AutoContinueResumeInfo,
        ...args: unknown[]
      ) => unknown)
    | null;
  onAutoContinueEnd:
    | ((
        info: AutoContinueEndInfo,
        ...args: unknown[]
      ) => unknown)
    | null;
  onBrainFallback:
    | ((
        fromEngine: string,
        toEngine: string,
        error: unknown,
        ...args: unknown[]
      ) => unknown)
    | null;
  onToolNotFound:
    | ((
        info: ToolNotFoundErrorInfo,
        ...args: unknown[]
      ) => unknown)
    | null;
  onToolError:
    | ((
        info: ToolErrorInfo,
        ...args: unknown[]
      ) => unknown)
    | null;
  chatLog: ChatLogItem[];
  chatSeq: number;
  welcomeText: string | ((context: unknown) => string) | null;
  companionWelcomeText: string | ((context: unknown) => string) | null;
  assistantWelcomeText: string | ((context: unknown) => string) | null;
  buildLLMMessages: (
    question: string,
    engineType: string,
    ...args: unknown[]
  ) => Promise<LLMMessage[]> | LLMMessage[];
  readonly buildDefaultLLMMessages: (
    question: string,
    engineType: string,
    ...args: unknown[]
  ) => Promise<LLMMessage[]> | LLMMessage[];
  getWelcomeText(): Promise<string> | string;
  classifyEmotion(text: string): string;
  applyEmotionFromText(text: string): void;
  answerQuestion(question: string): Promise<string | void>;
  emitAnswer(text: string): string | void;
  getRetrievalAnswer(rawQuestion: string): string;
  getCompanionFallbackResponse(question: string): string;
  chatWithAiProvider(question: string): Promise<string | void>;
  chatWithWebLLM(question: string): Promise<string | void>;
  triggerRollingSummaryIfNeeded(): Promise<void>;
  addChatMessage(
    role: string,
    text: string,
    options?: AddChatMessageOptions
  ): string;
  updateChatMessage(id: string, text: string, streaming?: boolean): string;
  locale: string;
  setLocale(locale: string): void;
  gender?: string;
  setGender(gender: string): void;
  systemContextTemplate?: string | ((...args: unknown[]) => string);
  companionSystemContextTemplate?: string | ((...args: unknown[]) => string);
  ragTemplate?: string | ((...args: unknown[]) => string);
  customContext?: Record<string, unknown> | null;
  languageRule?: string | ((...args: unknown[]) => string);
  genderRule?: string | ((...args: unknown[]) => string);
  compression: BrainCompressionOptions;
  i18nEngine: I18nEngine | null;
  readonly llm: LLMEngine | null;
  readonly memory: MemoryInstance | null;
  readonly aiProvider: AiProviderEngine | null;
}
