import type {
  BrainEngine,
  BrainEngineOptions,
  KnowledgeEntry,
  MemoryAdapter,
  MemoryData,
  BrainCompressionOptions,
  LLMMessage
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
  Skin3DCameraConfig,
  Skin3DModelConfig
} from '@/core/skin';
import type {
  ToolsEngine,
  ToolsEngineSetting,
  ToolDefinition
} from '@/core/tools';
import type { UiDom, UiContext } from '@/core/ui';
import type { BaseStore } from '@/core/store';
import type { I18nEngine } from '@/core/i18n';
import type {
  AvatarMode,
  Gender,
  FitMode,
  EngineMode,
  AutoContinueMode,
  LocalizableOrResolver,
  DynamicTextOrResolver,
  AutoContinueStartInfo,
  AutoContinueResumeInfo,
  AutoContinueEndInfo,
  ToolNotFoundErrorInfo,
  ToolErrorInfo,
  LlmLoadProgressInfo,
  Point2D
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
    | ((options: unknown) => Promise<SkinEngine> | SkinEngine)
    | null;
  tools?:
    | ToolsEngine
    | ((options: unknown) => Promise<ToolsEngine> | ToolsEngine)
    | null;
  brain?:
    | BrainEngine
    | ((options: unknown) => Promise<BrainEngine> | BrainEngine)
    | null;
  stt?:
    | STTEngine
    | ((options: STTEngineOptions) => Promise<STTEngine> | STTEngine)
    | null;
  tts?:
    | TTSEngine
    | ((options: TTSEngineOptions) => Promise<TTSEngine> | TTSEngine)
    | null;
  i18n?: I18nEngine | null | unknown;
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
  /** Custom fetch configuration object or factory for AI Provider. */
  aiProviderCreateFetchSetting?:
    | ((...args: unknown[]) => RequestInit)
    | RequestInit;
  /** Custom fetch payload object or factory for AI Provider. */
  aiProviderCreateFetchPayload?:
    | ((...args: unknown[]) => Record<string, unknown> | BodyInit)
    | Record<string, unknown>;
  /** Custom response format ('sse', 'json', or parsing object). */
  aiProviderResponseFormat?: string | Record<string, unknown>;
  /** Maximum token limit for AI Provider responses. */
  aiProviderMaxTokens?: number;
  /** Whether AI Provider should use streaming response. */
  aiProviderStream?: boolean;
  /** Custom extractor for tool calls from AI Provider chunks. */
  aiProviderExtractToolCalls?: (chunk: string) => unknown;
  /** Neural voice model identifier for speech synthesis. */
  neuralVoice?: string;
  /** URL to knowledge base JSON for assistant persona. */
  knowledgeUrl?: string;
  /** URL to knowledge base JSON for companion persona. */
  companionKnowledgeUrl?: string;
  /** Preloaded knowledge base data. */
  knowledge?: KnowledgeEntry[] | Record<string, unknown> | string | null;
  /** Preloaded companion knowledge data. */
  companionKnowledge?:
    | KnowledgeEntry[]
    | Record<string, unknown>
    | string
    | null;
  /** 2D or 3D avatar model URL. */
  modelUrl?: string;
  /** Speech synthesis (TTS) API endpoint. */
  ttsEndpoint?: string;
  /** In-browser WebLLM model identifier. */
  llmModel?: string;
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
  autoContinuePrompt?: DynamicTextOrResolver | null;
  /** Avatar persona mode ('assistant' | 'companion' | custom). */
  avatarMode?: AvatarMode;
  /** Whether to enable multi-turn persistent conversation memory. */
  enableMemory?: boolean;
  /** Maximum number of history conversation turns retained. */
  maxHistoryTurns?: number;
  /** Storage key for persistent memory in localStorage or custom adapter. */
  memoryKey?: string;
  /** Custom storage adapter for loading and persisting memory. */
  memoryAdapter?: MemoryAdapter;
  /** Declarative custom persona modes registry. */
  modes?: Record<string, unknown>;
  /** Initial rendering start mode ('2d' | '3d'). */
  startMode?: EngineMode;
  /** Container fit mode ('half' | 'full'). */
  fitMode?: FitMode;
  /** 2D visual transformation configuration. */
  skin2d?: Skin2DConfig;
  /** Alias for skin2d.zoom. */
  zoom?: number;
  /** Alias for skin2d.offsetX. */
  offsetX?: number;
  /** Alias for skin2d.offsetY. */
  offsetY?: number;
  /** Alias for skin2d.anchor. */
  anchor?: Point2D;
  /** 3D VRM model URL. */
  vrmUrl?: string;
  /** 3D visual and animation configuration. */
  skin3d?: Skin3DConfig;
  /** Alias for skin3d.camera. */
  camera?: Skin3DCameraConfig;
  /** Alias for skin3d.model. */
  modelTransform?: Skin3DModelConfig;
  /** Alias for skin3d.pointerLook. */
  pointerLook?: boolean;
  /** Whether to allow dragging and dropping .vrm files onto canvas to switch models. */
  enableModelDrop?: boolean;
  /** Alias for enableModelDrop. */
  allowModelDrop?: boolean;
  /** Whether to display 2D/3D toggle button when both models are available. */
  enableEngineToggle?: boolean;
  /** Custom 3D gesture data. */
  gesture3D?: Record<string, unknown>;
  /** Custom 2D gesture data. */
  gesture2D?: Record<string, unknown>;
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
  /** Alias for tools. */
  hostTools?: ToolDefinition[];
  /** Whether to enable built-in emotion tool plugin. */
  enableEmotionTools?: boolean;
  /** Options for built-in emotion tool plugin. */
  emotionToolsOptions?: Record<string, unknown>;
  /** Tool confirmation timeout in milliseconds. */
  confirmationTimeoutMs?: number;
  /** Alias for confirmationTimeoutMs. */
  toolConfirmationTimeoutMs?: number;
  /** Custom message builder function for LLM inference. */
  buildLLMMessages?: (...args: unknown[]) => LLMMessage[] | Promise<LLMMessage[]>;
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
  /** Callback fired when minimal UI mode is toggled. */
  onMinimalTrigger?: (isMinimal: boolean, widget: unknown, ...args: unknown[]) => void;
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
  /** Callback fired when connecting to AI Provider. */
  onAiProviderConnecting?: (...args: unknown[]) => void;
  /** Callback fired when AI Provider connects successfully. */
  onAiProviderConnected?: (...args: unknown[]) => void;
  /** Callback fired when a new chat message is added. */
  onAddChatMessage?: (role: string, text: string, ...args: unknown[]) => void;
  /** Callback fired when an existing chat message is updated. */
  onUpdateChatMessage?: (id: string, text: string, ...args: unknown[]) => void;
  /** Callback fired when conversation history changes. */
  onChatHistoryChanged?: (history: unknown[], ...args: unknown[]) => void;
  /** Callback fired when spoken subtitle text changes. */
  onSpokenDisplayTextChange?: (text: string, ...args: unknown[]) => void;
  /** Callback fired when spoken subtitle times out. */
  onSpokenDisplayTextTimeout?: (...args: unknown[]) => void;
  /** Callback fired when microphone state changes. */
  onMicStateChanged?: (isListening: boolean, ...args: unknown[]) => void;
  /** Callback fired when voice status changes. */
  onVoiceStatusChanged?: (status: unknown, ...args: unknown[]) => void;
  /** Callback fired when language changes. */
  onLanguageChanged?: (locale: string, ...args: unknown[]) => void;
  /** Callback fired when speech synthesis starts speaking. */
  onSpeaking?: (text: string, ...args: unknown[]) => void;
  /** Callback fired when speech synthesis finishes speaking. */
  onSpeakingEnd?: (...args: unknown[]) => void;
  /** Callback fired when LLM stream finishes. */
  onStreamEnd?: (fullText: string, ...args: unknown[]) => void;
  /** Callback fired when auto-continuation starts. */
  onAutoContinueStart?: (info: AutoContinueStartInfo, ...args: unknown[]) => void;
  /** Callback fired when waiting for continuation stream. */
  onAutoContinueWait?: (info: AutoContinueStartInfo, ...args: unknown[]) => void;
  /** Callback fired when continuation resumes speaking. */
  onAutoContinueResume?: (info: AutoContinueResumeInfo, ...args: unknown[]) => void;
  /** Callback fired when auto-continuation completes. */
  onAutoContinueEnd?: (info: AutoContinueEndInfo, ...args: unknown[]) => void;
  /** Callback fired when rolling memory summary updates. */
  onSummaryUpdated?: (summary: string, ...args: unknown[]) => void;
  /** Callback fired when brain falls back between engines. */
  onBrainFallback?: (
    fromEngine: string,
    toEngine: string,
    error: unknown,
    ...args: unknown[]
  ) => void;
  /** Callback fired when a tool call is executed. */
  onToolCall?: (toolCall: unknown, ...args: unknown[]) => void;
  /** Callback fired when AI requests an unregistered tool. */
  onToolNotFound?: (info: ToolNotFoundErrorInfo, widget: AiAvatarWidget, ...args: unknown[]) => unknown;
  /** Callback fired when a tool execution fails. */
  onToolError?: (info: ToolErrorInfo, widget: AiAvatarWidget, ...args: unknown[]) => unknown;
  /** Callback fired when history panel opens/closes. */
  onSetHistoryOpen?: (isOpen: boolean, ...args: unknown[]) => void;
  /** Callback fired when history panel renders. */
  onRenderHistory?: (...args: unknown[]) => void;
  /** Callback fired when audio playback is triggered. */
  onSpokenAudioPlayNow?: (text: string, ...args: unknown[]) => void;
  /** Callback fired on 3D error. */
  onThreeDimensionalError?: (error: Error, ...args: unknown[]) => void;
  /** Callback fired on 2D error. */
  onTwoDimensionalError?: (error: Error, ...args: unknown[]) => void;
  /** Callback fired on VRM file change failure. */
  VRMFileChangeFail?: (error: Error, ...args: unknown[]) => void;
  /** Callback fired on VRM file change success. */
  VRMFileChangeSuccess?: (vrmUrl?: string, ...args: unknown[]) => void;
  /** Callback fired when 2D/3D model mode change starts. */
  onModelChangeStart?: (newMode: string, ...args: unknown[]) => void;
  /** Callback fired when 2D/3D model mode change ends. */
  onModelChangeEnd?: (renderer: unknown, newMode: string, ...args: unknown[]) => void;
}

/**
 * Controller instance returned after initializing the AI Avatar Bot widget.
 */
export interface AiAvatarWidget {
  /** Readonly initialization options snapshot. */
  readonly options: AvatarBotOptions;
  readonly DEFAULT_LLM_MODEL: string;
  readonly STATE_MAP: Record<string, string>;
  readonly ENGINE_MODE_MAP: Record<string, string>;
  readonly AVATAR_MODE_MAP: Record<string, string>;
  readonly FIT_MODE_MAP: Record<string, string>;
  readonly BRAIN_ENGINE_TYPE_MAP: Record<string, string>;
  readonly BRAIN_FALLBACK_TYPE_MAP: Record<string, string>;
  readonly AUTO_CONTINUE_MODE_MAP: Record<string, string>;
  readonly LLM_FINISH_REASON_MAP: Record<string, string>;
  readonly FINISH_REASON_MAP: Record<string, string>;
  /** Available persona modes list. */
  readonly availableModes: string[];
  enableMemory: boolean;
  enableAiProvider: boolean;
  preloadWebLLM: boolean;
  autoFallbackWebLLM: boolean;
  enableAutoContinue: boolean;
  maxAutoContinuations: number;
  autoContinueMode: 'stream' | 'buffered';
  autoContinuePrompt: string | ((...args: unknown[]) => string) | null;
  enableModelDrop: boolean;
  enableEngineToggle: boolean;
  /** Mounted root HTML container. */
  readonly container: HTMLElement;
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
  onMinimalTrigger?: (isMinimal: boolean, widget: unknown, ...args: unknown[]) => void;
  onError?: (error: Error, widget: AiAvatarWidget, ...args: unknown[]) => void;
}

export type {
  MemoryData,
  MemoryAdapter,
  BrainEngine,
  BrainEngineOptions,
  SpeechEngine,
  SpeechEngineOptions as SpeechEngineSetting,
  SpeechEngineOptions,
  SkinEngine,
  SkinEngineOptions,
  ToolsEngine,
  ToolsEngineSetting,
  ToolDefinition,
  UiDom,
  UiContext,
  BaseStore,
  I18nEngine
};
