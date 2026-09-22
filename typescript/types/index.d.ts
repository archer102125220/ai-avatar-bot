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
  HostTool,
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

export type {
  CustomEnginesConfig,
  AvatarBotOptions,
  AiAvatarWidget,
  OrchestratorEngines,
  GetEnginesFn
} from '@/core/orchestrator/types';

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
): Promise<unknown>;
export function bootVRM(skinEngine: SkinEngine, setting?: unknown): Promise<unknown>;
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
export function initDefaultSTTEngine(setting?: STTEngineOptions): STTEngine;
export function initDefaultTTSEngine(setting?: TTSEngineOptions): TTSEngine;
export function validateSTTEngine(engine: unknown): {
  isValid: boolean;
  missing: string[];
};
export function validateTTSEngine(engine: unknown): {
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
export function validateToolsEngine(engine: unknown): {
  isValid: boolean;
  missing: string[];
};
export function toOpenAiTools(tools: ToolDefinition[]): Record<string, unknown>[];
export function getAiAvailableTools(tools: ToolDefinition[]): ToolDefinition[];
export function argumentSummary(
  tool: ToolDefinition,
  args: Record<string, unknown>
): string;
export function route(tools: ToolDefinition[], queryText: string): unknown;
export function extract(
  tool: ToolDefinition,
  query: string,
  schema?: unknown,
  existingArgs?: unknown,
  targetFields?: string[],
  isContinuation?: boolean
): unknown;

// I18n
export function initI18nEngine(options?: I18nEngineOptions): I18nEngine;
export function resolveLocalized<T>(
  value: T | Record<string, T> | ((args: unknown) => T),
  locale?: string,
  fallbackValue?: T | ((args: unknown) => T),
  templateContext?: unknown
): T;
export function formatParams(
  text: string,
  params?: Record<string, unknown>
): string;
export const defaultLocales: Record<string, unknown>;

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
  options?: Record<string, unknown>
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
export function avatarBotVitePlugin(options?: AvatarBotPluginOptions): unknown;
export class AvatarBotWebpackPlugin {
  constructor(options?: AvatarBotPluginOptions);
  apply(compiler: unknown): void;
}
export function withAiAvatarBot(
  nextConfig?: unknown,
  pluginOptions?: AvatarBotPluginOptions
): unknown;
export const avatarBotNuxtModule: unknown;
export function createNitroAvatarConfig(options?: AvatarBotPluginOptions): unknown;
export function avatarBotAnalogPlugin(options?: AvatarBotPluginOptions): unknown;
