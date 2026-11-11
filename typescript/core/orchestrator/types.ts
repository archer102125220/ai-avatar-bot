import type {
  BrainEngine,
  BrainEngineOptions,
  KnowledgeEntry,
  CustomModeConfig,
  PersonaProfile,
  ModeMemoryBucket,
  MemoryAdapter,
  MemoryData,
  BrainCompressionOptions,
  LLMMessage,
  ChatLogItem,
  AiProviderFetchSettingFactory,
  AiProviderFetchPayloadFactory,
  AiProviderToolCallExtractor
} from '@/core/brain';
import type {
  SpeechEngine,
  SpeechEngineOptions,
  STTEngine,
  STTEngineOptions,
  TTSEngine,
  TTSEngineOptions
} from '@/core/speech';
import type {
  SkinEngine,
  SkinEngineOptions,
  Skin2DConfig,
  Skin3DConfig,
  Renderer2D,
  Renderer3D,
  SkinUnifiedGestureHandler
} from '@/core/skin';
import type {
  ToolsEngine,
  ToolsEngineOptions,
  ToolDefinition,
  ToolEventName,
  ToolOfferInfo,
  ToolInputRequiredInfo,
  ToolAmbiguousInfo,
  ToolConfirmInfo,
  ToolCancelInfo,
  ToolExecuteInfo,
  ToolResultData
} from '@/core/tools';
import type { UiDom, UiContext } from '@/core/ui';
import type { BaseStore } from '@/core/store';
import type { I18nEngine, I18nEngineOptions } from '@/core/i18n';
import {
  AI_PROVIDER_PING_STRATEGY_MAP,
  AI_PROVIDER_STATUS_MAP,
  type AiProviderPingStrategy,
  type AiProviderStatus
} from '@/core/constants';
import type {
  AvatarMode,
  Gender,
  FitMode,
  EngineMode,
  AutoContinueMode,
  ChatRole,
  LocalizableOrResolver,
  DynamicTextOrResolver,
  AutoContinuePromptResolver,
  AutoContinueStartInfo,
  AutoContinueResumeInfo,
  AutoContinueEndInfo,
  ToolNotFoundErrorInfo,
  ToolErrorInfo,
  LlmLoadProgressInfo,
  ReasoningStartInfo,
  ReasoningChunkInfo,
  ReasoningEndInfo,
  ReasoningOptions,
  LlmOomFallbackInfo
} from '@/core/types';

/**
 * Registry of central coordinator sub-engines.
 */
export interface OrchestratorEngines {
  brainEngine: BrainEngine | null;
  speechEngine: SpeechEngine | null;
  skinEngine: SkinEngine | null;
  toolsEngine: ToolsEngine | null;
}

/**
 * Accessor function returning active orchestrator sub-engines.
 */
export type GetEnginesFn = () => OrchestratorEngines;

/**
 * Custom sub-engines injection configuration.
 */
export interface CustomEnginesConfig {
  skin?:
    | SkinEngine
    | ((options: SkinEngineOptions) => Promise<SkinEngine> | SkinEngine)
    | null;
  tools?:
    | ToolsEngine
    | ((options: ToolsEngineOptions) => Promise<ToolsEngine> | ToolsEngine)
    | null;
  brain?:
    | BrainEngine
    | ((options: BrainEngineOptions) => Promise<BrainEngine> | BrainEngine)
    | null;
  speech?:
    | SpeechEngine
    | ((options: SpeechEngineOptions) => Promise<SpeechEngine> | SpeechEngine)
    | null;
  stt?:
    | STTEngine
    | ((options: STTEngineOptions) => Promise<STTEngine> | STTEngine)
    | null;
  tts?:
    | TTSEngine
    | ((options: TTSEngineOptions) => Promise<TTSEngine> | TTSEngine)
    | null;
  i18n?:
    | I18nEngine
    | ((options: I18nEngineOptions) => Promise<I18nEngine> | I18nEngine)
    | null;
}

/**
 * Comprehensive configuration options for initializing the Avatar Bot.
 */
export interface AvatarBotOptions {
  /** HTML container element to mount the avatar widget. */
  container?: HTMLElement | null;
  /** Whether to enable the Cloud AI service provider. */
  enableAiProvider?: boolean;
  /** Base URL for the AI Provider API (e.g. 'http://localhost:11434/api'). */
  aiProviderBaseUrl?: string;
  /** Model identifier for the AI Provider (e.g. 'qwen2.5:latest'). */
  aiProviderModel?: string;
  /**
   * Optional custom HTTP headers sent with AI Provider requests (e.g. Authorization, x-api-key).
   * Automatically applied to both health-check ping and chat completion requests.
   */
  aiProviderHeaders?: Record<string, string>;
  /** Custom fetch configuration object or factory for AI Provider. */
  aiProviderCreateFetchSetting?:
    | AiProviderFetchSettingFactory
    | ((...args: unknown[]) => RequestInit)
    | RequestInit;
  /** Custom fetch payload object or factory for AI Provider. */
  aiProviderCreateFetchPayload?:
    | AiProviderFetchPayloadFactory
    | ((...args: unknown[]) => Record<string, unknown> | BodyInit)
    | Record<string, unknown>
    | BodyInit;
  /** Custom response format ('sse', 'json', or parsing object). */
  aiProviderResponseFormat?: string | Record<string, unknown>;
  /** Maximum token limit for AI Provider responses. */
  aiProviderMaxTokens?: number;
  /** Whether AI Provider should use streaming response. */
  aiProviderIsStream?: boolean;
  /** Custom ping URL endpoint to verify AI Provider connectivity. */
  aiProviderPingUrl?: string;
  /**
   * Health-check ping strategy for AI Provider ('eager' | 'lazy' | 'manual' | false).
   * - 'eager' (default): pings in background during initialization (non-blocking).
   * - 'lazy': pings on first question before dispatching inference.
   * - 'manual' or false: disables automatic pinging; developer calls widget.pingAiProvider() manually.
   */
  aiProviderAutoPing?: AiProviderPingStrategy;
  /** Custom extractor for tool calls from AI Provider chunks. */
  aiProviderExtractToolCalls?:
    AiProviderToolCallExtractor | ((chunk: string) => unknown);
  /** Neural voice model identifier for speech synthesis. */
  neuralVoice?: string;
  /** URL to knowledge base JSON for assistant persona. */
  assistantKnowledgeUrl?: string;
  /**
   * 基礎通用知識庫遠端 URL（跨模式共用，與 sharedKnowledgeUrl 互為別名）。
   */
  knowledgeUrl?: string;
  /** 跨模式通用共用知識庫遠端 URL（等同於 knowledgeUrl）。 */
  sharedKnowledgeUrl?: string;
  /** URL to knowledge base JSON for companion persona. */
  companionKnowledgeUrl?: string;
  /** Preloaded knowledge base data for assistant persona. */
  assistantKnowledge?:
    | KnowledgeEntry[]
    | Record<string, unknown>
    | string
    | null;
  /**
   * 基礎通用知識庫（跨模式共用，與 sharedKnowledge 互為別名）。
   */
  knowledge?: KnowledgeEntry[] | Record<string, unknown> | string | null;
  /** 跨模式通用共用知識庫（等同於 knowledge）。 */
  sharedKnowledge?:
    | KnowledgeEntry[]
    | Record<string, unknown>
    | string
    | null;
  /** Preloaded companion knowledge data. */
  companionKnowledge?:
    KnowledgeEntry[] | Record<string, unknown> | string | null;
  /**
   * RAG 檢索最多注入 Prompt 的候選條目上限（預設 3）。
   * 設為 0 時代表停用知識庫檢索，100% 由模型自主對話推理。
   */
  knowledgeLimit?: number;
  /**
   * `knowledgeLimit` 之語意別名（等同於 knowledgeLimit）。
   */
  ragTopK?: number;
  /**
   * 是否啟用前端相似度過濾，或傳入自訂過濾函數。預設 true。
   * 設為 false 時將跳過前端相似度過濾，將知識庫全量注入 Prompt（全權由雲端大模型推論理解）。
   */
  knowledgeFilter?:
    | boolean
    | ((entry: KnowledgeEntry, question: string) => boolean);
  /** 2D Live2D avatar model configuration file URL (.model3.json). */
  live2dUrl?: string;
  /** Speech synthesis (TTS) API endpoint. */
  ttsEndpoint?: string;
  /** In-browser WebGPU LLM model identifier (MLC format). */
  webLlmModel?: string;
  /** @deprecated 請改用 webLlmModel */
  llmModel?: string;
  /** Fallback in-browser WebGPU LLM model identifier when OOM occurs. Set to null or false to disable. */
  webLlmFallbackModel?: string | null | false;
  /** @deprecated 請改用 webLlmFallbackModel */
  llmFallbackModel?: string | null | false;
  /** Whether to enable automatic WebLLM OOM fallback. Defaults to true. */
  enableOomFallback?: boolean;
  /** Maximum token limit for WebLLM responses. */
  llmMaxTokens?: number;
  /** Whether to preload WebLLM model on initialization. */
  preloadWebLLM?: boolean;
  /** Whether to automatically fallback to WebLLM if AI Provider fails. */
  autoFallbackWebLLM?: boolean;
  /** Whether to enable auto-continuation when output is cut off by token limit. */
  enableAutoContinue?: boolean;
  /** Maximum number of auto-continuation rounds. */
  maxAutoContinuations?: number;
  /** Auto-continuation delivery mode ('stream' | 'buffered'). */
  autoContinueMode?: AutoContinueMode;
  /** Custom auto-continuation prompt string or generator function. */
  autoContinuePrompt?: AutoContinuePromptResolver | null;
  /** Avatar persona mode ('assistant' | 'companion' | custom). */
  avatarMode?: AvatarMode;
  /**
   * 是否在切換模式時隔離各模式的對話歷史紀錄。
   * - `false`（預設）：所有模式共用同一份歷史紀錄（跨模式上下文連貫）。
   * - `true`：各模式開闢獨立的對話歷史，訪客基本資料（姓名/造訪次數）仍維持共享，避免跨人設污染。
   */
  isolateModeHistory?: boolean;
  /** Whether to enable multi-turn persistent conversation memory. */
  enableMemory?: boolean;
  /** Maximum number of history conversation turns retained. */
  maxHistoryTurns?: number;
  /** Storage key for persistent memory in localStorage or custom adapter. */
  memoryKey?: string;
  /** Custom storage adapter for loading and persisting memory. */
  memoryAdapter?: MemoryAdapter;
  /** Declarative custom persona modes registry. */
  modes?: Record<string, CustomModeConfig>;
  /** Initial rendering start mode ('2d' | '3d'). */
  startMode?: EngineMode;
  /** Container fit mode ('half' | 'full'). */
  fitMode?: FitMode;
  /** 2D visual transformation configuration. */
  skin2d?: Skin2DConfig;
  /** 3D VRM model URL. */
  vrmUrl?: string;
  /** 3D visual and animation configuration. */
  skin3d?: Skin3DConfig;
  /** Whether to allow dragging and dropping .vrm files onto canvas to switch models. */
  enableModelDrop?: boolean;
  /** Alias for enableModelDrop. */
  allowModelDrop?: boolean;
  /** Whether to display 2D/3D toggle button when both models are available. */
  enableEngineToggle?: boolean;
  /** Global unified gesture handler interceptor. */
  gesture?: SkinUnifiedGestureHandler;
  /** Whether to start in minimal UI mode. */
  isMinimal?: boolean;
  /** Whether running inside an iframe. */
  isIframe?: boolean;
  /** Language locale code (e.g. 'zh-TW', 'en-US', 'ja-JP', 'ko-KR'). */
  locale?: string;
  /** Custom translation dictionary messages. */
  i18nMessages?: Record<string, Record<string, string>>;
  /** Default avatar gender ('female' | 'male'). */
  gender?: Gender;
  /** Brain gender persona override. */
  brainGender?: Gender | null;
  /** Speech voice gender override. */
  speechGender?: Gender | null;
  /** Skin appearance gender override. */
  skinGender?: Gender | null;
  /** Fallback responses list for companion mode. */
  companionFallback?: Array<string | Record<string, unknown>>;
  /** Custom sub-engines injection configuration. */
  customEngines?: CustomEnginesConfig;
  /** Context compression settings. */
  compression?: BrainCompressionOptions;
  /** System context prompt template for assistant mode. */
  systemContextTemplate?: DynamicTextOrResolver;
  /** System context prompt template for companion mode. */
  companionSystemContextTemplate?: DynamicTextOrResolver;
  /** RAG reference material prompt template. */
  ragTemplate?: DynamicTextOrResolver;
  /** Custom context object appended to LLM prompt. */
  customContext?: Record<string, unknown>;
  /** Multilingual response rule prompt. */
  languageRule?: DynamicTextOrResolver;
  /** Gender-specific prompt rule. */
  genderRule?: DynamicTextOrResolver;
  /** List of registered tools for function calling. */
  tools?: ToolDefinition[];
  /**
   * Configuration for AI reasoning and thinking process.
   * @experimental AI reasoning output is currently an experimental feature and stability may vary across models and runtimes.
   */
  reasoning?: ReasoningOptions;
  /** Whether to enable built-in emotion tool plugin. */
  enableEmotionTools?: boolean;
  /** Options for built-in emotion tool plugin. */
  emotionToolsOptions?: Record<string, unknown>;
  /** Tool confirmation timeout in milliseconds. */
  confirmationTimeoutMs?: number;
  /** Custom message builder function for LLM inference. */
  buildLLMMessages?: (
    ...args: unknown[]
  ) => LLMMessage[] | Promise<LLMMessage[]>;
  /** Welcome message text. */
  welcomeText?: string;
  /** Welcome message text for companion mode. */
  companionWelcomeText?: string;
  /** Welcome message text for assistant mode. */
  assistantWelcomeText?: string;
  /** Spoken audio greeting text. */
  greeting?: string;
  /** Spoken audio greeting text for companion mode. */
  companionGreeting?: string;
  /** Spoken audio greeting text for assistant mode. */
  assistantGreeting?: string;
  /** Suggested questions prompt list. */
  suggestedQuestions?: LocalizableOrResolver<string[]>;
  /** Suggested questions for companion mode. */
  companionSuggestedQuestions?: LocalizableOrResolver<string[]>;
  /** Suggested questions for assistant mode. */
  assistantSuggestedQuestions?: LocalizableOrResolver<string[]>;
  /** Suggested questions section title. */
  suggestedTitle?: LocalizableOrResolver<string>;
  /** Suggested title for companion mode. */
  companionSuggestedTitle?: LocalizableOrResolver<string>;
  /** Suggested title for assistant mode. */
  assistantSuggestedTitle?: LocalizableOrResolver<string>;

  /** Lifecycle callback fired when widget is fully initialized and mounted. */
  onReady?: (widget: AiAvatarWidget, ...args: unknown[]) => void;
  /**
   * Callback fired when minimal UI mode is toggled.
   * @param isMinimal - Whether the widget is now minimized.
   * @param widget - Active AiAvatarWidget controller instance.
   */
  onMinimalTrigger?: (
    isMinimal: boolean,
    widget: unknown,
    ...args: unknown[]
  ) => void;
  /** Global error callback. */
  onError?: (error: Error, widget: AiAvatarWidget, ...args: unknown[]) => void;
  /** Callback fired when WebLLM starts loading. */
  onLlmLoading?: (...args: unknown[]) => void;
  /** Callback fired during WebLLM download/init progress. */
  onLlmLoadProgress?: (
    progress: LlmLoadProgressInfo,
    ...args: unknown[]
  ) => void;
  /** Callback fired when WebLLM completes loading. */
  onLlmLoaded?: (...args: unknown[]) => void;
  /** Callback fired when WebLLM loading fails. */
  onLlmLoadError?: (error: Error, ...args: unknown[]) => void;
  /** Callback fired when WebLLM encounters OOM and switches to fallback model. */
  onLlmOomFallback?: (info: LlmOomFallbackInfo, ...args: unknown[]) => void;
  /**
   * Callback fired when AI reasoning/thinking starts (silent track).
   * @experimental AI reasoning output is currently an experimental feature.
   */
  onReasoningStart?: (info: ReasoningStartInfo, ...args: unknown[]) => void;
  /**
   * Callback fired when AI reasoning/thinking chunk is streamed.
   * @experimental AI reasoning output is currently an experimental feature.
   */
  onReasoningChunk?: (info: ReasoningChunkInfo, ...args: unknown[]) => void;
  /**
   * Callback fired when AI reasoning/thinking process ends.
   * @experimental AI reasoning output is currently an experimental feature.
   */
  onReasoningEnd?: (info: ReasoningEndInfo, ...args: unknown[]) => void;
  /** Callback fired when connecting to AI Provider. */
  onAiProviderConnecting?: (...args: unknown[]) => void;
  /** Callback fired when AI Provider connects successfully. */
  onAiProviderConnected?: (...args: unknown[]) => void;
  /** Callback fired when AI Provider connection or ping fails. */
  onAiProviderError?: (error: Error, ...args: unknown[]) => void;
  /** Callback fired when a new chat message is added. */
  onAddChatMessage?:
    | ((item: ChatLogItem, ...args: unknown[]) => void)
    | ((role: ChatRole, text: string, ...args: unknown[]) => void);
  /** Callback fired when an existing chat message is updated. */
  onUpdateChatMessage?:
    | ((item: ChatLogItem, ...args: unknown[]) => void)
    | ((id: string, text: string, ...args: unknown[]) => void);
  /** Callback fired when conversation history changes. */
  onChatHistoryChanged?: (history: ChatLogItem[], ...args: unknown[]) => void;
  /** Callback fired when spoken subtitle text changes. */
  onSpokenDisplayTextChange?: (text: string, ...args: unknown[]) => void;
  /** Callback fired when spoken subtitle times out. */
  onSpokenDisplayTextTimeout?: (...args: unknown[]) => void;
  /** Callback fired when microphone state changes. */
  onMicStateChanged?: (isListening: boolean, ...args: unknown[]) => void;
  /** Callback fired when voice status changes. */
  onVoiceStatusChanged?: (
    convoOn: boolean,
    text?: string,
    state?: string,
    level?: number,
    ...args: unknown[]
  ) => void;
  /** Callback fired when language changes. */
  onLanguageChanged?: (locale: string, ...args: unknown[]) => void;
  /** Callback fired when speech synthesis starts speaking. */
  onSpeaking?: (text: string, ...args: unknown[]) => void;
  /** Callback fired when speech synthesis finishes speaking. */
  onSpeakingEnd?: (...args: unknown[]) => void;
  /** Callback fired when an answer chunk is streamed. */
  onStreamChunk?: (
    chunkDelta: string,
    rawChunk?: unknown,
    ...args: unknown[]
  ) => void;
  /** Callback fired when LLM stream finishes. */
  onStreamEnd?: (fullText: string, ...args: unknown[]) => void;
  /** Callback fired when auto-continuation starts. */
  onAutoContinueStart?: (
    info: AutoContinueStartInfo,
    ...args: unknown[]
  ) => void;
  /** Callback fired when waiting for continuation stream. */
  onAutoContinueWait?: (
    info: AutoContinueStartInfo,
    ...args: unknown[]
  ) => void;
  /** Callback fired when continuation resumes speaking. */
  onAutoContinueResume?: (
    info: AutoContinueResumeInfo,
    ...args: unknown[]
  ) => void;
  /** Callback fired when auto-continuation completes. */
  onAutoContinueEnd?: (info: AutoContinueEndInfo, ...args: unknown[]) => void;
  /** Callback fired when rolling memory summary updates. */
  onSummaryUpdated?: (summary: string, ...args: unknown[]) => void;
  /** Callback fired when background memory summarization state changes. */
  onSummarizingChange?: (isSummarizing: boolean) => void;
  /** Callback fired when brain falls back between engines. */
  onBrainFallback?: (
    fromEngine: string,
    toEngine: string,
    error: unknown,
    ...args: unknown[]
  ) => void;
  /** Callback fired when a tool is triggered for execution without an inline execute handler. */
  onToolCall?: (
    pendingToolData: Record<string, unknown>,
    widget?: AiAvatarWidget,
    ...args: unknown[]
  ) => void;
  /** Callback fired when a tool execution is offered. */
  onToolOffer?: (
    info: ToolOfferInfo,
    widget?: AiAvatarWidget,
    ...args: unknown[]
  ) => void;
  /** Callback fired when a tool requires missing parameter input from the user. */
  onToolInputRequired?: (
    info: ToolInputRequiredInfo,
    widget?: AiAvatarWidget,
    ...args: unknown[]
  ) => void;
  /** Callback fired when multiple candidate tools match ambiguously. */
  onToolAmbiguous?: (
    info: ToolAmbiguousInfo,
    widget?: AiAvatarWidget,
    ...args: unknown[]
  ) => void;
  /** Callback fired when a tool execution is confirmed by the user. */
  onToolConfirm?: (
    info: ToolConfirmInfo,
    widget?: AiAvatarWidget,
    ...args: unknown[]
  ) => void;
  /** Callback fired when a tool is cancelled or expires. */
  onToolCancel?: (
    info: ToolCancelInfo,
    widget?: AiAvatarWidget,
    ...args: unknown[]
  ) => void;
  /** Callback fired when a tool starts executing. */
  onToolExecute?: (
    info: ToolExecuteInfo,
    widget?: AiAvatarWidget,
    ...args: unknown[]
  ) => void;
  /** Callback fired when a tool execution completes or yields a result. */
  onToolResult?: (
    info: ToolResultData,
    widget?: AiAvatarWidget,
    ...args: unknown[]
  ) => void;
  /** Unified callback fired for any tool lifecycle event in TOOL_EVENT_MAP. */
  onToolEvent?: (
    event: ToolEventName,
    payload: unknown,
    widget?: AiAvatarWidget,
    ...args: unknown[]
  ) => void;
  /** Callback fired when AI requests an unregistered tool. */
  onToolNotFound?: (
    info: ToolNotFoundErrorInfo,
    widget: AiAvatarWidget,
    ...args: unknown[]
  ) => unknown;
  /** Callback fired when a tool execution fails. */
  onToolError?: (
    info: ToolErrorInfo,
    widget: AiAvatarWidget,
    ...args: unknown[]
  ) => unknown;
  /** Callback fired when history panel opens/closes. */
  onSetHistoryOpen?: (isOpen: boolean, ...args: unknown[]) => void;
  /** Callback fired when history panel renders. */
  onRenderHistory?: (...args: unknown[]) => void;
  /** Callback fired when audio playback is triggered. */
  onSpokenAudioPlayNow?: (text: string, ...args: unknown[]) => void;
  /** Callback fired on 3D error. */
  on3DError?: (error: Error, ...args: unknown[]) => void;
  /** Callback fired on 2D error. */
  on2DError?: (error: Error, ...args: unknown[]) => void;
  /** Callback fired on VRM file change failure. */
  onVrmFileChangeFail?: (error: Error, ...args: unknown[]) => void;
  /** Callback fired on VRM file change success. */
  onVrmFileChangeSuccess?: (vrmUrl?: string, ...args: unknown[]) => void;
  /** Callback fired when 2D/3D model mode change starts. */
  onModelChangeStart?: (newMode: EngineMode, ...args: unknown[]) => void;
  /** Callback fired when 2D/3D model mode change ends. */
  onModelChangeEnd?: (
    renderer: Renderer2D | Renderer3D | null,
    newMode: EngineMode,
    ...args: unknown[]
  ) => void;
}

/**
 * Controller instance returned after initializing the AI Avatar Bot widget.
 */
export interface AiAvatarWidget {
  /** Readonly initialization options snapshot. */
  readonly options: AvatarBotOptions;
  readonly DEFAULT_LLM_MODEL: string;
  readonly DEFAULT_LLM_FALLBACK_MODEL: string;
  readonly STATE_MAP: Record<string, string>;
  readonly ENGINE_MODE_MAP: Record<string, string>;
  readonly AVATAR_MODE_MAP: Record<string, string>;
  readonly FIT_MODE_MAP: Record<string, string>;
  readonly BRAIN_ENGINE_TYPE_MAP: Record<string, string>;
  readonly BRAIN_FALLBACK_TYPE_MAP: Record<string, string>;
  readonly AUTO_CONTINUE_MODE_MAP: Record<string, string>;
  readonly LLM_FINISH_REASON_MAP: Record<string, string>;
  readonly FINISH_REASON_MAP: Record<string, string>;
  readonly AI_PROVIDER_STATUS_MAP: typeof AI_PROVIDER_STATUS_MAP;
  readonly AI_PROVIDER_PING_STRATEGY_MAP: typeof AI_PROVIDER_PING_STRATEGY_MAP;
  /** Available persona modes list. */
  readonly availableModes: string[];
  /** Whether the AI Provider has been successfully verified and is ready for inference. */
  readonly isAiProviderReady: boolean;
  /**
   * Manually pings the configured AI Provider to verify server health and model connectivity.
   * Updates `aiProviderStatus` in the root store and returns boolean success.
   * @param fetchSetting - Optional custom fetch options for the ping request.
   * @returns Promise resolving to true if ping succeeded, false otherwise.
   */
  pingAiProvider: (fetchSetting?: RequestInit | null) => Promise<boolean>;
  /**
   * Custom HTTP headers for the AI Provider.
   * Getter returns a frozen read-only record (`Object.freeze`).
   */
  aiProviderHeaders: Readonly<Record<string, string>>;
  /**
   * Helper method to update AI Provider custom headers at runtime.
   * @param newHeaders - New headers record to assign.
   */
  setAiProviderHeaders: (newHeaders: Record<string, string>) => void;
  enableMemory: boolean;
  enableAiProvider: boolean;
  preloadWebLLM: boolean;
  autoFallbackWebLLM: boolean;
  /** Fallback in-browser WebGPU LLM model identifier when OOM occurs. Set to null or false to disable. */
  webLlmFallbackModel?: string | null | false;
  /** @deprecated 請改用 webLlmFallbackModel */
  llmFallbackModel?: string | null | false;
  enableOomFallback?: boolean;
  enableAutoContinue: boolean;
  maxAutoContinuations: number;
  autoContinueMode: AutoContinueMode;
  autoContinuePrompt: AutoContinuePromptResolver | null;
  /** Whether rolling summary is currently running in the background. */
  readonly isSummarizing: boolean;
  /** Resets companion fallback phrase counter to 0. */
  resetCompanionFallback(): void;
  enableModelDrop: boolean;
  enableEngineToggle: boolean;
  /** Mounted root HTML container. */
  readonly container: HTMLElement;
  /** Root reactive store instance for the AI Avatar Bot. */
  readonly store: AvatarBotStore;
  /** UI DOM management helper. */
  readonly uiDom: UiDom;
  /** Internationalization engine instance. */
  readonly i18nEngine: I18nEngine;
  /** Tools and function calling engine instance. */
  readonly toolsEngine: ToolsEngine | null;
  /** Builds LLM messages for question inference. */
  buildLLMMessages?: (
    question?: string,
    engineType?: string,
    ...args: unknown[]
  ) => Promise<LLMMessage[]> | LLMMessage[];
  /** Classifies emotion string from text. */
  classifyEmotion?: (text: string) => string;
  /** Applies emotion to skin from input text. */
  applyEmotionFromText?: (text: string) => void;
  /** Plays a 3D or 2D avatar gesture/animation by name (e.g. 'appearing', 'liked', 'waiting', 'goodbye', 'bow'). */
  playGesture?: (gestureName: string) => void;
  /** Triggers avatar tap interaction, playing the tap gesture and speech greeting. */
  tap?: () => void;
  /** Sends a question to the brain engine and streams / returns response. */
  answerQuestion?: (question: string) => Promise<string | void>;
  /** Main handler for user input text (handles tools, LLM, and UI). */
  handleUser: (text?: string) => Promise<void> | void;
  isIframe: boolean;
  isMinimal: boolean;
  gender: Gender;
  brainGender: Gender | null;
  speechGender: Gender | null;
  skinGender: Gender | null;
  locale: string;
  avatarMode: AvatarMode;
  suggestedQuestions?: LocalizableOrResolver<string[]>;
  companionSuggestedQuestions?: LocalizableOrResolver<string[]>;
  assistantSuggestedQuestions?: LocalizableOrResolver<string[]>;
  suggestedTitle?: LocalizableOrResolver<string>;
  companionSuggestedTitle?: LocalizableOrResolver<string>;
  assistantSuggestedTitle?: LocalizableOrResolver<string>;
  setSuggestedQuestions: (
    questions?: LocalizableOrResolver<string[]>,
    title?: LocalizableOrResolver<string>
  ) => void;
  renderSuggestions: () => void;
  showMinimalEl: () => void;
  hiddenMinimalEl: () => void;
  /** AI Brain engine instance. */
  readonly brainEngine: BrainEngine | null;
  /** Speech synthesis and recognition engine instance. */
  readonly speechEngine: SpeechEngine | null;
  /** 2D / 3D Avatar skin rendering engine instance. */
  readonly skinEngine: SkinEngine | null;
  /** Updates 2D skin configuration. */
  setSkin2d: (config: Partial<Skin2DConfig>) => void;
  /** Updates 3D skin configuration. */
  setSkin3d: (config: Partial<Skin3DConfig>) => void;
  /** Updates container fitting mode ('half' | 'full'). */
  setFitMode: (fitMode: FitMode) => void;
  onReady?: (widget: AiAvatarWidget, ...args: unknown[]) => void;
  onMinimalTrigger?: (
    isMinimal: boolean,
    widget: unknown,
    ...args: unknown[]
  ) => void;
  onError?: (error: Error, widget: AiAvatarWidget, ...args: unknown[]) => void;
  onAiProviderConnecting?: (...args: unknown[]) => void;
  onAiProviderConnected?: (...args: unknown[]) => void;
  onAiProviderError?: (error: Error, ...args: unknown[]) => void;
  onLlmOomFallback?: (info: LlmOomFallbackInfo, ...args: unknown[]) => void;
  /** @experimental AI reasoning output is currently an experimental feature. */
  onReasoningStart?: (info: ReasoningStartInfo, ...args: unknown[]) => void;
  /** @experimental AI reasoning output is currently an experimental feature. */
  onReasoningChunk?: (info: ReasoningChunkInfo, ...args: unknown[]) => void;
  /** @experimental AI reasoning output is currently an experimental feature. */
  onReasoningEnd?: (info: ReasoningEndInfo, ...args: unknown[]) => void;
  onStreamChunk?: (
    chunkDelta: string,
    rawChunk?: unknown,
    ...args: unknown[]
  ) => void;
  /**
   * Configuration for AI reasoning and thinking process.
   * @experimental AI reasoning output is currently an experimental feature.
   */
  readonly reasoning?: ReasoningOptions;
}

/**
 * Reactive state snapshot stored in the avatar bot's root store.
 */
export interface AvatarBotStoreState {
  gender: Gender;
  brainGender: Gender | null;
  speechGender: Gender | null;
  skinGender: Gender | null;
  avatarMode: AvatarMode;
  enableMemory: boolean;
  enableAiProvider: boolean;
  preloadWebLLM: boolean;
  autoFallbackWebLLM: boolean;
  enableAutoContinue: boolean;
  maxAutoContinuations: number;
  autoContinueMode: AutoContinueMode;
  autoContinuePrompt: AutoContinuePromptResolver | null;
  /** AI Provider connection health status ('idle' | 'connecting' | 'connected' | 'error'). */
  aiProviderStatus: AiProviderStatus;
  /** Error message if AI Provider ping or connection failed. */
  aiProviderError: string | null;
  modes: Record<string, CustomModeConfig>;
  locale: string;
  enableModelDrop: boolean;
  enableEngineToggle: boolean;
  /** @experimental AI reasoning output is currently an experimental feature. */
  reasoning?: ReasoningOptions;
  suggestedQuestions?: LocalizableOrResolver<string[]>;
  companionSuggestedQuestions?: LocalizableOrResolver<string[]>;
  assistantSuggestedQuestions?: LocalizableOrResolver<string[]>;
  suggestedTitle?: LocalizableOrResolver<string>;
  companionSuggestedTitle?: LocalizableOrResolver<string>;
  assistantSuggestedTitle?: LocalizableOrResolver<string>;
  [key: string]: unknown;
}

/**
 * Root reactive store instance for the AI Avatar Bot.
 */
export type AvatarBotStore = BaseStore<AvatarBotStoreState>;

export type {
  MemoryData,
  MemoryAdapter,
  BrainEngine,
  BrainEngineOptions,
  CustomModeConfig,
  PersonaProfile,
  ModeMemoryBucket,
  SpeechEngine,
  SpeechEngineOptions as SpeechEngineSetting,
  SpeechEngineOptions,
  SkinEngine,
  SkinEngineOptions,
  ToolsEngine,
  ToolsEngineOptions,
  ToolDefinition,
  ToolEventName,
  ToolOfferInfo,
  ToolInputRequiredInfo,
  ToolAmbiguousInfo,
  ToolConfirmInfo,
  ToolCancelInfo,
  ToolExecuteInfo,
  ToolResultData,
  UiDom,
  UiContext,
  BaseStore,
  I18nEngine,
  AutoContinueMode,
  ReasoningStartInfo,
  ReasoningChunkInfo,
  ReasoningEndInfo,
  ReasoningOptions,
  LlmOomFallbackInfo,
  AiProviderPingStrategy,
  AiProviderStatus
};

export { AI_PROVIDER_PING_STRATEGY_MAP, AI_PROVIDER_STATUS_MAP };
