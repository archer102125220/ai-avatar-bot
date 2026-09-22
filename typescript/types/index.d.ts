/**
 * Type definitions for ai-avatar-bot-vanilla-js
 *
 * Interactive 2D (Live2D) and 3D (VRM) AI Avatar Bot with Voice STT/TTS,
 * In-Browser WebGPU WebLLM, Cloud AI Brain, Conversation Memory, and Function Calling.
 */

// ============================================================================
// Core / Store Types
// ============================================================================

import type { BaseStore as CoreBaseStore } from '@/core/store';
export type { StoreListener, PropertyListener, Selector } from '@/core/store';
export type BaseStore<T extends object = any> = CoreBaseStore<T>;

// ============================================================================
// Memory & Personas
// ============================================================================

export type {
  AvatarMode,
  ChatHistoryItem,
  MemoryData,
  MemoryAdapter,
  MemoryInstance
} from '@/core/brain';

// ============================================================================
// Skin Subsystem Types (2D Live2D & 3D VRM)
// ============================================================================

export type {
  Skin2DModeConfig,
  Skin2DConfig,
  Skin3DCameraConfig,
  Skin3DModelConfig,
  Skin3DModeConfig,
  Skin3DConfig,
  VRMSettings,
  Renderer2D,
  Renderer3D,
  SkinEngineState,
  SkinEngineOptions,
  SkinEmotionBlendState,
  SkinEngine
} from '@/core/skin';

// ============================================================================
// Speech Subsystem Types (STT & TTS)
// ============================================================================

export type {
  STTEngineState,
  STTEngineOptions,
  STTEngine,
  TTSSpeakOptions,
  TTSSpeechQueueItem,
  TTSEngineState,
  TTSEngineOptions,
  TTSEngine,
  SpokenAudioState,
  SpeechEngineState,
  SpeechEngineOptions,
  SpeechEngine,
  ISpeechRecognition,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent
} from '@/core/speech';


// ============================================================================
// Tools & Function Calling Subsystem Types
// ============================================================================

export type {
  ToolSchemaProperty,
  ToolSchema,
  ToolExecutePayload,
  ToolDefinition,
  ToolScoreResult,
  ToolRouteCandidate,
  ToolRouteResult,
  ToolValidationResult,
  ToolExtractResult,
  ToolResultData,
  PendingToolInput,
  PendingToolChoice,
  ToolsEngineSetting,
  ToolsEngine,
  OpenAIToolProperty,
  OpenAITool
} from '@/core/tools';

// ============================================================================
// Plugin Types
// ============================================================================

export type { EmotionToolsPluginOptions } from '@/core/plugins/emotion-tools';

/**
 * Common configuration options for build tool plugins (Vite, Webpack, Next.js, Nuxt, Nitro, Analog).
 */
export interface AvatarBotPluginOptions {
  /** Virtual URL route intercepted to serve avatar skin assets (default: '/avatar-skin'). */
  route?: string;
  /** Physical directory path where avatar-skin model files are stored. */
  assetsDir?: string;
  /** Public directory name for Next.js / framework builds (default: 'public'). */
  publicDir?: string;
  /** Whether to automatically sync assets during build (default: true). */
  autoSync?: boolean;
  /** Whether to suppress console log output (default: false). */
  silent?: boolean;
  /** Cache-Control max-age in seconds for static assets (default: 2592000). */
  maxAge?: number;
  /** Whether to overwrite existing destination files (default: true). */
  overwrite?: boolean;
}

// ============================================================================
// I18n Subsystem Types
// ============================================================================

export type {
  LocaleLabelInfo,
  TranslationDictionary,
  TranslateFunction,
  LocaleChangeListener,
  I18nEngineOptions,
  I18nEngineState,
  I18nEngine
} from '@/core/i18n';

// ============================================================================
// ============================================================================
// Brain Subsystem Types (LLM, AI Provider, RAG, Memory)
// ============================================================================

export type {
  KnowledgeEntry,
  LLMMessage,
  BrainCompressionOptions,
  ChatLogItem,
  AddChatMessageOptions,
  ParsedToolCall,
  LLMEngineOptions,
  LLMEngine,
  AiProviderOptions,
  AiProviderEngine,
  BrainEngineOptions,
  BrainEngine
} from '@/core/brain';

// ============================================================================
// UI Subsystem Types
// ============================================================================

export type { UiDom, UiContext } from '@/core/ui';


// ============================================================================
// Top-Level Orchestrator & Widget Types
// ============================================================================

/**
 * Custom sub-engines injection configuration.
 */
export interface CustomEnginesConfig {
  skin?: any;
  tools?: any;
  brain?: any;
  stt?: any;
  tts?: any;
  i18n?: any;
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
    ((...args: any[]) => RequestInit) | RequestInit;
  /** Custom fetch payload object or factory for AI Provider. */
  aiProviderCreateFetchPayload?:
    ((...args: any[]) => Record<string, any>) | Record<string, any>;
  /** Custom response format ('sse', 'json', or parsing object). */
  aiProviderResponseFormat?: string | Record<string, any>;
  /** Maximum token limit for AI Provider responses. */
  aiProviderMaxTokens?: number;
  /** Whether AI Provider should use streaming response. */
  aiProviderStream?: boolean;
  /** Custom extractor for tool calls from AI Provider chunks. */
  aiProviderExtractToolCalls?: (chunk: string) => any;
  /** Neural voice model identifier for speech synthesis. */
  neuralVoice?: string;
  /** URL to knowledge base JSON for assistant persona. */
  knowledgeUrl?: string;
  /** URL to knowledge base JSON for companion persona. */
  companionKnowledgeUrl?: string;
  /** Preloaded knowledge base data. */
  knowledge?: KnowledgeEntry[] | Record<string, any> | string | null;
  /** Preloaded companion knowledge data. */
  companionKnowledge?: KnowledgeEntry[] | Record<string, any> | string | null;
  /** 2D or 3D avatar model URL. */
  modelUrl?: string;
  /** Speech synthesis (TTS) API endpoint. */
  ttsEndpoint?: string;
  /** In-browser WebLLM model identifier (e.g. 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'). */
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
  autoContinueMode?: 'stream' | 'buffered';
  /** Custom auto-continuation prompt string or generator function. */
  autoContinuePrompt?: string | ((...args: any[]) => string) | null;
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
  modes?: Record<string, any>;
  /** Initial rendering start mode ('2d' | '3d'). */
  startMode?: string;
  /** Container fit mode ('half' | 'full'). */
  fitMode?: string;
  /** 2D visual transformation configuration. */
  skin2d?: Skin2DConfig;
  /** Alias for skin2d.zoom. */
  zoom?: number;
  /** Alias for skin2d.offsetX. */
  offsetX?: number;
  /** Alias for skin2d.offsetY. */
  offsetY?: number;
  /** Alias for skin2d.anchor. */
  anchor?: { x?: number; y?: number };
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
  gesture3D?: Record<string, any>;
  /** Custom 2D gesture data. */
  gesture2D?: Record<string, any>;
  /** Whether to start in minimal UI mode. */
  isMinimal?: boolean;
  /** Whether running inside an iframe. */
  isIframe?: boolean;
  /** Language locale code (e.g. 'zh-TW', 'en-US', 'ja-JP', 'ko-KR'). */
  locale?: string;
  /** Custom translation dictionary messages. */
  i18nMessages?: Record<string, Record<string, string>>;
  /** Default avatar gender ('female' | 'male'). */
  gender?: string;
  /** Brain gender persona override. */
  brainGender?: string | null;
  /** Speech voice gender override. */
  speechGender?: string | null;
  /** Skin appearance gender override. */
  skinGender?: string | null;
  /** Fallback responses list for companion mode. */
  companionFallback?: Array<string | Record<string, any>>;
  /** Custom sub-engines injection configuration. */
  customEngines?: CustomEnginesConfig;
  /** Context compression settings. */
  compression?: BrainCompressionOptions;
  /** System context prompt template for assistant mode. */
  systemContextTemplate?: string | ((...args: any[]) => string);
  /** System context prompt template for companion mode. */
  companionSystemContextTemplate?: string | ((...args: any[]) => string);
  /** RAG reference material prompt template. */
  ragTemplate?: string | ((...args: any[]) => string);
  /** Custom context object appended to LLM prompt. */
  customContext?: Record<string, any>;
  /** Multilingual response rule prompt. */
  languageRule?: string | ((...args: any[]) => string);
  /** Gender-specific prompt rule. */
  genderRule?: string | ((...args: any[]) => string);
  /** List of registered tools for function calling. */
  tools?: ToolDefinition[];
  /** Alias for tools. */
  hostTools?: ToolDefinition[];
  /** Whether to enable built-in emotion tool plugin. */
  enableEmotionTools?: boolean;
  /** Options for built-in emotion tool plugin. */
  emotionToolsOptions?: Record<string, any>;
  /** Tool confirmation timeout in milliseconds. */
  confirmationTimeoutMs?: number;
  /** Alias for confirmationTimeoutMs. */
  toolConfirmationTimeoutMs?: number;
  /** Custom message builder function for LLM inference. */
  buildLLMMessages?: (...args: any[]) => any[];
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
  suggestedQuestions?:
    string[] | Record<string, string[]> | ((context: any) => string[]);
  /** Suggested questions for companion mode. */
  companionSuggestedQuestions?:
    string[] | Record<string, string[]> | ((context: any) => string[]);
  /** Suggested questions for assistant mode. */
  assistantSuggestedQuestions?:
    string[] | Record<string, string[]> | ((context: any) => string[]);
  /** Suggested questions section title. */
  suggestedTitle?: string | Record<string, string> | ((context: any) => string);
  /** Suggested title for companion mode. */
  companionSuggestedTitle?:
    string | Record<string, string> | ((context: any) => string);
  /** Suggested title for assistant mode. */
  assistantSuggestedTitle?:
    string | Record<string, string> | ((context: any) => string);
  /** Lifecycle callback fired when widget is fully initialized and mounted. */
  onReady?: (widget: AiAvatarWidget) => void;
  /** Callback fired when minimal UI mode is toggled. */
  onMinimalTrigger?: (isMinimal: boolean, widget: any) => void;
  /** Global error callback. */
  onError?: (error: Error, widget: AiAvatarWidget) => void;
  /** Callback fired when WebLLM starts loading. */
  onLlmLoading?: () => void;
  /** Callback fired during WebLLM download/init progress. */
  onLlmLoadProgress?: (progress: number) => void;
  /** Callback fired when WebLLM completes loading. */
  onLlmLoaded?: () => void;
  /** Callback fired when WebLLM loading fails. */
  onLlmLoadError?: (error: Error) => void;
  /** Callback fired when connecting to AI Provider. */
  onAiProviderConnecting?: () => void;
  /** Callback fired when AI Provider connects successfully. */
  onAiProviderConnected?: () => void;
  /** Callback fired when a new chat message is added. */
  onAddChatMessage?: (role: string, text: string) => void;
  /** Callback fired when an existing chat message is updated. */
  onUpdateChatMessage?: (id: string, text: string) => void;
  /** Callback fired when conversation history changes. */
  onChatHistoryChanged?: (history: any[]) => void;
  /** Callback fired when spoken subtitle text changes. */
  onSpokenDisplayTextChange?: (text: string) => void;
  /** Callback fired when spoken subtitle times out. */
  onSpokenDisplayTextTimeout?: () => void;
  /** Callback fired when microphone state changes. */
  onMicStateChanged?: (isListening: boolean) => void;
  /** Callback fired when voice status changes. */
  onVoiceStatusChanged?: (status: any) => void;
  /** Callback fired when language changes. */
  onLanguageChanged?: (locale: string) => void;
  /** Callback fired when speech synthesis starts speaking. */
  onSpeaking?: (text: string) => void;
  /** Callback fired when speech synthesis finishes speaking. */
  onSpeakingEnd?: () => void;
  /** Callback fired when LLM stream finishes. */
  onStreamEnd?: (fullText: string) => void;
  /** Callback fired when auto-continuation starts. */
  onAutoContinueStart?: (info: any) => void;
  /** Callback fired when waiting for continuation stream. */
  onAutoContinueWait?: (info: any) => void;
  /** Callback fired when continuation resumes speaking. */
  onAutoContinueResume?: (info: any) => void;
  /** Callback fired when auto-continuation completes. */
  onAutoContinueEnd?: (info: any) => void;
  /** Callback fired when rolling memory summary updates. */
  onSummaryUpdated?: (summary: string) => void;
  /** Callback fired when brain falls back between engines. */
  onBrainFallback?: (fromEngine: string, toEngine: string, error: any) => void;
  /** Callback fired when a tool call is executed. */
  onToolCall?: (toolCall: any) => void;
  /** Callback fired when AI requests an unregistered tool. */
  onToolNotFound?: (info: any, widget: AiAvatarWidget) => any;
  /** Callback fired when a tool execution fails. */
  onToolError?: (info: any, widget: AiAvatarWidget) => any;
  /** Callback fired when history panel opens/closes. */
  onSetHistoryOpen?: (isOpen: boolean) => void;
  /** Callback fired when history panel renders. */
  onRenderHistory?: () => void;
  /** Callback fired when audio playback is triggered. */
  onSpokenAudioPlayNow?: (text: string) => void;
  /** Callback fired on 3D error. */
  onThreeDimensionalError?: (error: Error) => void;
  /** Callback fired on 2D error. */
  onTwoDimensionalError?: (error: Error) => void;
  /** Callback fired on VRM file change failure. */
  VRMFileChangeFail?: (error: Error) => void;
  /** Callback fired on VRM file change success. */
  VRMFileChangeSuccess?: (vrmUrl?: string) => void;
  /** Callback fired when 2D/3D model mode change starts. */
  onModelChangeStart?: (newMode: string) => void;
  /** Callback fired when 2D/3D model mode change ends. */
  onModelChangeEnd?: (renderer: any, newMode: string) => void;
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
  autoContinuePrompt: string | ((...args: any[]) => string) | null;
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
  buildLLMMessages: (...args: any[]) => any[];
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
  gender: string;
  brainGender: string | null;
  speechGender: string | null;
  skinGender: string | null;
  locale: string;
  avatarMode: AvatarMode;
  suggestedQuestions?:
    string[] | Record<string, string[]> | ((context: any) => string[]);
  companionSuggestedQuestions?:
    string[] | Record<string, string[]> | ((context: any) => string[]);
  assistantSuggestedQuestions?:
    string[] | Record<string, string[]> | ((context: any) => string[]);
  suggestedTitle?: string | Record<string, string> | ((context: any) => string);
  companionSuggestedTitle?:
    string | Record<string, string> | ((context: any) => string);
  assistantSuggestedTitle?:
    string | Record<string, string> | ((context: any) => string);
  setSuggestedQuestions: (
    questions?:
      string[] | Record<string, string[]> | ((context: any) => string[]),
    title?: string | Record<string, string> | ((context: any) => string)
  ) => void;
  renderSuggestions: () => void;
  showMinimalEl: () => void;
  hiddenMinimalEl: () => void;
  /** AI Brain engine instance. */
  readonly brainEngine: BrainEngine;
  /** Speech synthesis and recognition engine instance. */
  readonly speechEngine: SpeechEngine;
  /** 2D / 3D Avatar skin rendering engine instance. */
  readonly skinEngine: SkinEngine;
  /** Updates 2D skin configuration. */
  setSkin2d: (config: Partial<Skin2DConfig>) => void;
  /** Updates 3D skin configuration. */
  setSkin3d: (config: Partial<Skin3DConfig>) => void;
  /** Updates container fitting mode ('half' | 'full'). */
  setFitMode: (fitMode: string) => void;
  onReady?: (widget: AiAvatarWidget) => void;
  onMinimalTrigger?: (isMinimal: boolean, widget: any) => void;
  onError?: (error: Error, widget: AiAvatarWidget) => void;
}

// ============================================================================
// Top-Level Factory Functions
// ============================================================================

/**
 * Initializes and mounts a new AI Avatar Bot instance.
 *
 * @param rawOptions - Configuration options for initializing the avatar bot.
 * @returns Promise resolving to the initialized AiAvatarWidget controller, or void on failure.
 *
 * @example
 * ```javascript
 * import { createAvatarBot } from 'ai-avatar-bot-vanilla-js';
 *
 * const bot = await createAvatarBot({
 *   container: document.getElementById('avatar-container'),
 *   startMode: '3d',
 *   vrmUrl: '/avatar-skin/3d-model/HatsuneMiku.vrm',
 *   enableAiProvider: true,
 *   aiProviderBaseUrl: 'http://localhost:11434/api',
 *   aiProviderModel: 'qwen2.5:latest'
 * });
 * ```
 */
export function initAvatarBot(
  rawOptions?: AvatarBotOptions
): Promise<AiAvatarWidget | void>;

/**
 * Alias for `initAvatarBot`. Creates and initializes a new AI Avatar Bot widget instance.
 *
 * @param rawOptions - Configuration options for initializing the avatar bot.
 * @returns Promise resolving to the initialized AiAvatarWidget controller, or void on failure.
 */
export function createAvatarBot(
  rawOptions?: AvatarBotOptions
): Promise<AiAvatarWidget | void>;

export default initAvatarBot;

// ============================================================================
// Constants Exports
// ============================================================================

export const STATE_MAP: Record<string, string>;
export const AVATAR_MODE_MAP: Record<string, string>;
export const DEFAULT_AVATAR_MODE: string;
export const DEFAULT_ENABLE_MEMORY: boolean;
export const DEFAULT_MAX_HISTORY_TURNS: number;
export const COMPRESSION_STRATEGY_MAP: Record<string, string>;
export const DEFAULT_COMPRESSION_STRATEGY: string;
export const DEFAULT_MAX_TOTAL_CHARS: number;
export const DEFAULT_WEB_LLM_MAX_TURNS: number;
export const DEFAULT_WEB_LLM_MAX_CHARS: number;
export const DEFAULT_AI_PROVIDER_MAX_TURNS: number;
export const DEFAULT_AI_PROVIDER_MAX_CHARS: number;
export const DEFAULT_SUMMARY_THRESHOLD_TURNS: number;
export const DEFAULT_SUMMARY_RECENT_TURNS: number;
export const DEFAULT_SUMMARY_MAX_CHARS: number;
export const DEFAULT_MEMORY_KEY: string;
export const CURRENT_MEMORY_VERSION: number;
export const DEFAULT_LLM_MODEL: string;
export const DEFAULT_AI_PROVIDER_MODEL: string;
export const DEFAULT_LLM_MAX_TOKENS: number;
export const DEFAULT_AI_PROVIDER_MAX_TOKENS: number;
export const DEFAULT_ENABLE_AUTO_CONTINUE: boolean;
export const DEFAULT_MAX_AUTO_CONTINUATIONS: number;
export const AUTO_CONTINUE_MODE_MAP: Record<string, string>;
export const DEFAULT_AUTO_CONTINUE_MODE: string;
export const EMOTION_TARGET_MAP: Record<string, number>;
export const EMO_TARGET_MAP: Record<string, number>;
export const ENGINE_MODE_MAP: Record<string, string>;
export const DEFAULT_START_MODE: string;
export const DEFAULT_VRMA_ROOT_PATH: string;
export const FIT_MODE_MAP: Record<string, string>;
export const DEFAULT_FIT_MODE: string;
export const DEFAULT_2D_HALF_ZOOM: number;
export const DEFAULT_2D_FULL_ZOOM: number;
export const DEFAULT_2D_ZOOM: number;
export const DEFAULT_2D_OFFSET_X: number;
export const DEFAULT_2D_OFFSET_Y: number;
export const DEFAULT_2D_HALF_ANCHOR: Readonly<{ x: number; y: number }>;
export const DEFAULT_2D_FULL_ANCHOR: Readonly<{ x: number; y: number }>;
export const DEFAULT_2D_ANCHOR: Readonly<{ x: number; y: number }>;
export const DEFAULT_3D_HALF_CAMERA_FOV: number;
export const DEFAULT_3D_FULL_CAMERA_FOV: number;
export const DEFAULT_3D_CAMERA_FOV: number;
export const DEFAULT_3D_CAMERA_NEAR: number;
export const DEFAULT_3D_CAMERA_FAR: number;
export const DEFAULT_3D_HALF_CAMERA_POSITION: Readonly<{
  x: number;
  y: number;
  z: number;
}>;
export const DEFAULT_3D_FULL_CAMERA_POSITION: Readonly<{
  x: number;
  y: number;
  z: number;
}>;
export const DEFAULT_3D_CAMERA_POSITION: Readonly<{
  x: number;
  y: number;
  z: number;
}>;
export const DEFAULT_3D_HALF_CAMERA_LOOK_AT: Readonly<{
  x: number;
  y: number;
  z: number;
}>;
export const DEFAULT_3D_FULL_CAMERA_LOOK_AT: Readonly<{
  x: number;
  y: number;
  z: number;
}>;
export const DEFAULT_3D_CAMERA_LOOK_AT: Readonly<{
  x: number;
  y: number;
  z: number;
}>;
export const DEFAULT_3D_MODEL_POSITION: Readonly<{
  x: number;
  y: number;
  z: number;
}>;
export const DEFAULT_3D_MODEL_SCALE: Readonly<{
  x: number;
  y: number;
  z: number;
}>;
export const DEFAULT_3D_MODEL_ROTATION: Readonly<{
  x: number;
  y: number;
  z: number;
}>;
export const DEFAULT_3D_POINTER_LOOK: boolean;
export const GENDER_MAP: Record<string, string>;
export const DEFAULT_GENDER: string;
export const DEFAULT_FEMALE_2D_MODEL_URL: string;
export const DEFAULT_MALE_2D_MODEL_URL: string;
export const DEFAULT_2D_MODEL_URL: string;
export const DEFAULT_FEMALE_3D_MODEL_URL: string;
export const DEFAULT_MALE_3D_MODEL_URL: string;
export const DEFAULT_3D_MODEL_URL: string;
export const DEFAULT_VRM_URL: string;
export const DEFAULT_MODEL_URL: string;
export const DEFAULT_ENABLE_MODEL_DROP: boolean;
export const DEFAULT_ENABLE_ENGINE_TOGGLE: boolean;
export const DEFAULT_TTS_ENDPOINT: string;
export const DEFAULT_FEMALE_NEURAL_VOICE: string;
export const DEFAULT_MALE_NEURAL_VOICE: string;
export const DEFAULT_NEURAL_VOICE: string;

export function getDefaultNeuralVoice(gender?: string): string;
export function getDefault2DModelUrl(gender?: string): string;
export function getDefault3DModelUrl(gender?: string): string;
export function getDefaultModelUrl(
  gender?: string,
  engineMode?: string
): string;
export function getDefault2DConfig(fitMode?: string): {
  zoom: number;
  offsetX: number;
  offsetY: number;
  anchor: Readonly<{ x: number; y: number }>;
};
export function getDefault3DCameraConfig(fitMode?: string): {
  fov: number;
  near: number;
  far: number;
  position: Readonly<{ x: number; y: number; z: number }>;
  lookAt: Readonly<{ x: number; y: number; z: number }>;
};

export const TOOL_ROUTING_MODE_MAP: Record<string, string>;
export const DEFAULT_TOOL_ROUTING_MODE: string;
export const TOOL_RESULT_MODE_MAP: Record<string, string>;
export const DEFAULT_TOOL_RESULT_MODE: string;
export const DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS: number;
export const TOOL_CANCEL_REASON_MAP: Record<string, string>;
export const TOOL_EVENT_MAP: Record<string, string>;
export const TOOL_SCHEMA_TYPE_MAP: Record<string, string>;
export const TOOL_SCHEMA_FORMAT_MAP: Record<string, string>;
export const CHAT_ROLE_MAP: Record<string, string>;
export const CHAT_SOURCE_MAP: Record<string, string>;
export const LLM_FINISH_REASON_MAP: Record<string, string>;
export const FINISH_REASON_MAP: Record<string, string>;
export const BRAIN_ENGINE_TYPE_MAP: Record<string, string>;
export const BRAIN_FALLBACK_TYPE_MAP: Record<string, string>;
export function isWebLLMFunctionCallingSupported(model: string): boolean;
export const DEFAULT_SUPPORTED_EMOTIONS: string[];
export const DEFAULT_EMOTION_TOOL_NAME: string;
export const DEFAULT_LOCALE: string;
export const SUPPORTED_LOCALES: string[];
export const LOCALE_LABELS: Record<string, LocaleLabelInfo>;

// ============================================================================
// Sub-Engine Factory & Utility Function Exports
// ============================================================================

// Store
export function createBaseStore<T = Record<string, any>>(
  initialState?: T
): BaseStore<T>;

// Skin
export function initSkinEngine(setting?: SkinEngineOptions): SkinEngine;
export function createCanvas(container: HTMLElement): HTMLCanvasElement;
export function bootAvatar(
  skinEngine: SkinEngine,
  modelUrl?: string
): Promise<any>;
export function bootVRM(skinEngine: SkinEngine, setting?: any): Promise<any>;
export function loadVRMFile(skinEngine: SkinEngine, file: File): Promise<void>;

// Brain
export function initBrainEngine(
  setting?: BrainEngineOptions
): Promise<BrainEngine>;
export function initWebLLM(
  setting?: LLMEngineOptions,
  brain?: BrainEngine
): LLMEngine;
export function initAiProvider(
  setting?: AiProviderOptions,
  brain?: BrainEngine
): Promise<AiProviderEngine>;
export function initMemory(options?: {
  adapter?: MemoryAdapter;
  storageKey?: string;
  avatarMode?: AvatarMode;
  contextWindow?: number;
}): MemoryInstance;
export function compressContext(params?: BrainCompressionOptions): {
  messages: LLMMessage[];
  stats: {
    originalCount: number;
    compressedCount: number;
    strategy: string;
    preservedTurns?: number;
    maxSummaryChars?: number;
  };
};
export function fetchKnowledge(url?: string): Promise<KnowledgeEntry[]>;
export function findBestMatch(
  knowledge: KnowledgeEntry[],
  query: string
): { entry: KnowledgeEntry | null; score: number };
export function classifyEmotion(text: string): string;
export function applyEmotionFromText(
  brainEngine: BrainEngine,
  text: string
): void;
export function getBrainMessage(locale: string, key: string): string;
export function getWelcomeText(brainEngine: BrainEngine): string;
export function buildDefaultLLMMessages(
  brainEngine: BrainEngine,
  question: string,
  engineType?: string
): LLMMessage[];
export function chatWithWebLLM(
  brainEngine: BrainEngine,
  question: string
): Promise<string | void>;
export function chatWithAiProvider(
  brainEngine: BrainEngine,
  question: string
): Promise<string | void>;

// Speech
export function initSpeechEngine(
  setting?: SpeechEngineOptions
): Promise<SpeechEngine>;
export function initDefaultSTTEngine(setting?: any): any;
export function initDefaultTTSEngine(setting?: any): any;
export function validateSTTEngine(engine: any): {
  isValid: boolean;
  missing: string[];
};
export function validateTTSEngine(engine: any): {
  isValid: boolean;
  missing: string[];
};
export function splitSentences(text: string): string[];
export function drainSentences(
  state: { buf?: string; sentenceBuffer?: string },
  force?: boolean
): string[];
export function getSttMessage(locale: string, key: string): string;

// Tools
export function initToolsEngine(setting?: ToolsEngineSetting): ToolsEngine;
export function validateToolsEngine(engine: any): {
  isValid: boolean;
  missing: string[];
};
export function toOpenAiTools(tools: ToolDefinition[]): any[];
export function getAiAvailableTools(tools: ToolDefinition[]): ToolDefinition[];
export function argumentSummary(
  tool: ToolDefinition,
  args: Record<string, any>
): string;
export function route(tools: ToolDefinition[], queryText: string): any;
export function extract(
  tool: ToolDefinition,
  query: string,
  schema?: any,
  existingArgs?: any,
  targetFields?: string[],
  isContinuation?: boolean
): any;

// I18n
export function initI18nEngine(options?: I18nEngineOptions): I18nEngine;
export function resolveLocalized<T>(
  value: T | Record<string, T> | ((args: any) => T),
  locale?: string,
  fallbackValue?: T | ((args: any) => T),
  templateContext?: any
): T;
export function formatParams(
  text: string,
  params?: Record<string, any>
): string;
export const defaultLocales: Record<string, any>;

// Plugins & Tools Extensions
export function createEmotionToolsPlugin(
  options?: EmotionToolsPluginOptions
): ToolDefinition[];

// UI Layer Utilities
export function initUi(
  container: HTMLElement,
  stateMap?: Record<string, string>
): UiDom;
export function updateUIStrings(
  uiDom: UiDom,
  i18nEngine: I18nEngine,
  stateMap?: Record<string, string>
): void;
export function copyText(
  text: string,
  bubbleEl?: HTMLElement,
  directWarnEl?: HTMLElement,
  i18nEngine?: I18nEngine
): Promise<boolean>;
export function initSkinModeChangeButton(
  engineButtonEl: HTMLButtonElement,
  options?: any
): void;
export function renderSuggestions(context: UiContext): void;
export function setHistoryOpen(isOpen: boolean, context: UiContext): void;
export function renderHistory(context: UiContext): void;
export function bindTyping(context: UiContext): void;
export function bindUiEvent(context: UiContext): void;

// Build Framework Plugins & Node Helpers
export function getAvatarSkinPath(): string;
export function copyDirRecursive(
  src: string,
  dest: string,
  overwrite?: boolean
): void;
export function copyAvatarSkin(
  destDir?: string,
  options?: { overwrite?: boolean; silent?: boolean }
): void;
export function avatarBotVitePlugin(options?: AvatarBotPluginOptions): any;
export class AvatarBotWebpackPlugin {
  constructor(options?: AvatarBotPluginOptions);
  apply(compiler: any): void;
}
export function withAiAvatarBot(
  nextConfig?: any,
  pluginOptions?: AvatarBotPluginOptions
): any;
export const avatarBotNuxtModule: any;
export function createNitroAvatarConfig(options?: AvatarBotPluginOptions): any;
export function avatarBotAnalogPlugin(options?: AvatarBotPluginOptions): any;
