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

/**
 * Avatar persona mode: built-in presets or any custom registered mode string.
 */
export type AvatarMode = 'assistant' | 'companion' | (string & {});

/**
 * Conversation turn item stored in history.
 */
export interface ChatHistoryItem {
  /** Role of the speaker. */
  role: 'user' | 'assistant' | 'system' | 'tool' | (string & {});
  /** Text content of the message. */
  content: string;
  /** Optional metadata or timestamp. */
  [key: string]: any;
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
  metadata?: Record<string, any>;
}

/**
 * Custom storage adapter interface for loading, saving, and clearing persistent memory.
 */
export interface MemoryAdapter {
  /**
   * Loads memory data for a given key.
   * @param key - Storage identifier key.
   * @returns The loaded MemoryData object or null if not found.
   */
  load(key: string): MemoryData | null | Promise<MemoryData | null> | any;

  /**
   * Saves memory data for a given key.
   * @param key - Storage identifier key.
   * @param data - The MemoryData object to persist.
   */
  save(key: string, data: MemoryData | any): void | Promise<void>;

  /**
   * Clears memory data for a given key.
   * @param key - Storage identifier key.
   */
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
  getMetadata(): Record<string, any>;
  /** Sets or updates memory metadata dictionary. */
  setMetadata(
    patchOrUpdater:
      Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)
  ): void;
}

// ============================================================================
// Skin Subsystem Types (2D Live2D & 3D VRM)
// ============================================================================

/**
 * 2D visual transformation settings for a specific display mode (half / full).
 */
export interface Skin2DModeConfig {
  /** Zoom scale multiplier (e.g., 1.9 for half-body, 1.0 for full-body). */
  zoom?: number;
  /** Horizontal offset in pixels. */
  offsetX?: number;
  /** Vertical offset in pixels. */
  offsetY?: number;
  /** Model anchor point { x, y } (e.g., { x: 0.5, y: 1.0 } for half, { x: 0.5, y: 3.0 } for full). */
  anchor?: { x?: number; y?: number };
}

/**
 * Comprehensive 2D visual configuration object.
 */
export interface Skin2DConfig {
  /** Default zoom multiplier when mode-specific override is not provided. */
  zoom?: number;
  /** Default horizontal offset in pixels. */
  offsetX?: number;
  /** Default vertical offset in pixels. */
  offsetY?: number;
  /** Default model anchor point. */
  anchor?: { x?: number; y?: number };
  /** Half-body mode specific overrides. */
  half?: Skin2DModeConfig;
  /** Full-body mode specific overrides. */
  full?: Skin2DModeConfig;
}

/**
 * 3D camera transformation and field-of-view configuration.
 */
export interface Skin3DCameraConfig {
  /** Camera field of view (FOV in degrees, e.g., 26 for half, 30 for full). */
  fov?: number;
  /** Near clipping plane distance. */
  near?: number;
  /** Far clipping plane distance. */
  far?: number;
  /** World position coordinates { x, y, z } or [x, y, z] array. */
  position?: { x: number; y: number; z: number } | [number, number, number];
  /** Look-at target coordinates { x, y, z } or [x, y, z] array. */
  lookAt?: { x: number; y: number; z: number } | [number, number, number];
}

/**
 * 3D VRM model spatial transformation configuration.
 */
export interface Skin3DModelConfig {
  /** World position offset coordinates. */
  position?: { x: number; y: number; z: number } | [number, number, number];
  /** Model scale multiplier or { x, y, z } axes vector. */
  scale?:
    { x: number; y: number; z: number } | [number, number, number] | number;
  /** Model rotation Euler angles in radians. */
  rotation?: { x: number; y: number; z: number } | [number, number, number];
}

/**
 * 3D visual configuration for a specific display mode (half / full).
 */
export interface Skin3DModeConfig {
  /** Camera configuration overrides for this mode. */
  camera?: Skin3DCameraConfig;
  /** Model transformation overrides for this mode. */
  model?: Skin3DModelConfig;
}

/**
 * Comprehensive 3D VRM visual and animation configuration object.
 */
export interface Skin3DConfig {
  /** Global camera configuration. */
  camera?: Skin3DCameraConfig;
  /** Global model spatial transformation. */
  model?: Skin3DModelConfig;
  /** Half-body mode specific overrides. */
  half?: Skin3DModeConfig;
  /** Full-body mode specific overrides. */
  full?: Skin3DModeConfig;
  /** Whether to enable 3D eye gaze and head tracking towards the mouse cursor. */
  pointerLook?: boolean;
  /** URL to bow animation file (.vrma). */
  bow?: string;
  /** URL to wave animation file (.vrma). */
  wave?: string;
  /** URL to thinking animation file (.vrma). */
  thinking?: string;
  /** URL to look-around animation file (.vrma). */
  look?: string;
  /** URL to relax / idle animation file (.vrma). */
  relax?: string;
  /** URL to surprised animation file (.vrma). */
  surprised?: string;
  /** Root directory URL path for VRMA animation files. */
  vrmaRootPath?: string;
}

/**
 * VRM settings and animation URL configuration.
 */
export interface VRMSettings extends Skin3DConfig {}

/**
 * 2D Live2D renderer controller instance.
 */
export interface Renderer2D {
  /** Canvas element used for rendering. */
  readonly canvas: HTMLCanvasElement;
  /** Live2D model instance. */
  readonly avatarModel: any;
  /** PIXI Application instance. */
  readonly pixiApp: any;
  /** Re-calculates and applies fitting transform. */
  fit(): void;
  /** Updates 2D visual transformation configuration. */
  updateTransform(config: Partial<Skin2DConfig>): void;
  /** Disposes resources, listeners, and PIXI application. */
  dispose(): void;
}

/**
 * 3D VRM renderer controller instance.
 */
export interface Renderer3D {
  /** Loaded GLTF object instance. */
  readonly gltf: any;
  /** Loaded VRM model instance. */
  readonly vrm: any;
  /** Supported tap gesture action keys. */
  readonly TAP_GESTURES: string[];
  /** Canvas element used for rendering. */
  readonly canvas: HTMLCanvasElement;
  /** THREE.PerspectiveCamera instance. */
  readonly camera: any;
  /** THREE.Scene instance. */
  readonly scene: any;
  /** Plays a named 3D gesture animation (e.g. 'wave', 'bow'). */
  readonly playGesture: (gestureName: string) => void;
  /** Pauses or resumes animation rendering loop. */
  setPaused(isPaused: boolean): void;
  /** Updates 3D visual transformation configuration. */
  updateTransform(config: Partial<Skin3DConfig>): void;
  /** Disposes resources, WebGL context, and scene meshes. */
  dispose(): void;
}

/**
 * Initialization options for creating a SkinEngine.
 */
export interface SkinEngineOptions {
  /** HTML container element where canvas will be mounted. */
  stageEl: HTMLElement;
  /** URL to the 2D Live2D model (.model3.json). */
  modelUrl?: string;
  /** Initial engine rendering mode ('2d' | '3d'). */
  startMode?: string;
  /** Initial container fitting mode ('half' | 'full'). */
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
  anchor?: { x: number; y: number };
  /** URL to the 3D VRM model (.vrm). */
  vrmUrl?: string;
  /** 3D visual and animation configuration. */
  skin3d?: Skin3DConfig;
  /** Alias for skin3d.camera. */
  camera?: Skin3DCameraConfig;
  /** Alias for skin3d.model. */
  modelTransform?: Skin3DModelConfig;
  /** Alias for skin3d.pointerLook. */
  pointerLook?: boolean;
  /** Custom 3D gesture handler. */
  gesture3D?: (skinEngine: SkinEngine, emotionName: string) => void;
  /** Custom 2D gesture handler. */
  gesture2D?: (skinEngine: SkinEngine, emotionName: string) => void;
  /** Function to compute mouth open amplitude for lip sync. */
  computeMouth?: (skinEngine: SkinEngine) => number | Promise<number>;
  /** Callback fired when 3D initialization encounters an error. */
  onThreeDimensionalError?: (error: Error, skinEngine: SkinEngine) => void;
  /** Callback fired when 2D initialization encounters an error. */
  onTwoDimensionalError?: (error: Error, skinEngine: SkinEngine) => void;
  /** Callback fired when loading a custom dropped VRM file fails. */
  VRMFileChangeFail?: (error: Error) => void;
  /** Callback fired when loading a custom dropped VRM file succeeds. */
  VRMFileChangeSuccess?: (vrmUrl?: string) => void;
  /** Callback fired when avatar model is mounted and rendered. */
  onMounted?: () => void;
  /** Default avatar gender ('female' | 'male'). */
  gender?: string;
  /** Callback fired when a gesture starts playing. */
  onGesture?: (gestureName: string, skinEngine: SkinEngine) => void;
  /** Callback fired when a gesture encounters an error. */
  onGestureError?: (
    error: Error,
    gestureName: string,
    skinEngine: SkinEngine
  ) => void;
  /** Callback fired when a gesture completes. */
  onGestureEnd?: (gestureName: string, skinEngine: SkinEngine) => void;
  /** Callback fired when model mode switch begins. */
  onModelChangeStart?: (mode: string) => void;
  /** Alias for onModelChangeStart. */
  onModelChange?: (mode: string) => void;
  /** Callback fired when model mode switch finishes. */
  onModelChangeEnd?: (
    renderer: Renderer2D | Renderer3D | null,
    mode: string
  ) => void;
  /** Callback fired when model mode switch fails. */
  onModelChangeError?: (error: Error) => void;
}

/**
 * Skin Engine controller for managing 2D Live2D and 3D VRM avatar rendering.
 */
export interface SkinEngine {
  /** HTML container element. */
  readonly stageEl: HTMLElement;
  /** Whether 2D model URL is configured. */
  readonly has2D: boolean;
  /** Whether 3D model URL is configured. */
  readonly has3D: boolean;
  /** Current engine mode ('2d' | '3d'). Setter triggers asynchronous renderer switch. */
  engineMode: string;
  /** Loaded avatar model instance. */
  avatarModel: any;
  /** Active renderer instance (Renderer2D or Renderer3D). */
  renderer: Renderer2D | Renderer3D | null;
  /** Switches avatar gender and updates default model URLs. */
  setGender(gender: string): void;
  /** Loads and replaces active VRM model with a local File object. */
  loadVRMFile(file: File): void;
  /** Retrieves current store state. */
  getState(): Record<string, any>;
  /** Updates store state. */
  setState(
    updates:
      | Record<string, any>
      | ((state: Record<string, any>) => Record<string, any>)
  ): void;
  /** Subscribes to store state updates. */
  subscribe(listener: (state: any, prevState: any) => void): () => void;
  /** Sets active facial emotion and auto-resets after timeout. */
  setEmotion(emotion: string): void;
  /** Updates speaking status for lip sync and emotion reset. */
  setIsSpeaking(isSpeaking: boolean): void;
  /** Sets container fit mode ('half' | 'full'). */
  setFitMode(fitMode: string): void;
  /** Partially updates 2D visual configuration. */
  setSkin2d(updates: Partial<Skin2DConfig>): void;
  /** Partially updates 3D visual configuration. */
  setSkin3d(updates: Partial<Skin3DConfig>): void;
  /** Current 2D visual configuration. */
  readonly skin2d: Skin2DConfig;
  /** Current 3D visual configuration. */
  readonly skin3d: Skin3DConfig;
  /** Current gender setting. */
  readonly gender: string;
  /** 2D model URL. */
  modelUrl: string;
  /** 3D VRM model URL. */
  vrmUrl: string;
  /** Triggers a 3D gesture / emotion motion. */
  gesture3D(emotionName: string): void;
  /** Triggers a 2D gesture / emotion motion. */
  gesture2D(emotionName: string): void;
  /** Plays a gesture on the current active engine (2D or 3D). */
  gesture(emotionName: string): Promise<void>;
  /** Current active gesture / emotion name. Setting triggers onGesture lifecycle. */
  gestureName: string;
  /** Initial rendering start mode. */
  readonly startMode: string;
  /** Active fitting mode ('half' | 'full'). */
  fitMode: string;
  /** Emotion blend weight state for animation loop easing. */
  emo: { name: string; target: number; weight: number; applied: string };
  /** Function to compute mouth open amplitude. */
  computeMouth?: (skinEngine: SkinEngine) => number | Promise<number>;
  /** Callback fired when avatar is mounted. */
  onMounted?: () => void;
  /** Callback fired on 3D error. */
  onThreeDimensionalError?: (error: Error, skinEngine: SkinEngine) => void;
  /** Callback fired on 2D error. */
  onTwoDimensionalError?: (error: Error, skinEngine: SkinEngine) => void;
  /** Callback fired on VRM file load failure. */
  VRMFileChangeFail?: (error: Error) => void;
  /** Callback fired on VRM file load success. */
  VRMFileChangeSuccess?: (vrmUrl: string) => void;
  /** Callback fired on gesture start. */
  onGesture?: (gestureName: string, skinEngine: SkinEngine) => void;
  /** Callback fired on gesture error. */
  onGestureError?: (
    error: Error,
    gestureName: string,
    skinEngine: SkinEngine
  ) => void;
  /** Callback fired on gesture end. */
  onGestureEnd?: (gestureName: string, skinEngine: SkinEngine) => void;
  /** Callback fired when mode change starts. */
  onModelChangeStart?: (mode: string) => void;
  /** Alias for onModelChangeStart. */
  onModelChange?: (mode: string) => void;
  /** Callback fired when mode change ends. */
  onModelChangeEnd?: (
    renderer: Renderer2D | Renderer3D | null,
    mode: string
  ) => void;
  /** Callback fired on mode change error. */
  onModelChangeError?: (error: Error) => void;
  /** Whether engine is currently switching between 2D and 3D. */
  switching?: boolean | null;
  /** List of Live2D lip sync parameter IDs. */
  lipIds?: string[];
}

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
// Brain Subsystem Types (LLM, AI Provider, RAG, Memory)
// ============================================================================

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
    [key: string]: any;
  };
  /** Optional metadata tags or category. */
  [key: string]: any;
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
  /** Custom compression function. */
  customCompressor?: (params: any) => Promise<any[]> | any[];
}

/**
 * Options for initializing the BrainEngine.
 */
export interface BrainEngineOptions {
  enableMemory?: boolean;
  maxHistoryTurns?: number;
  memoryKey?: string;
  memoryAdapter?: MemoryAdapter;
  compression?: BrainCompressionOptions;
  modes?: Record<string, any>;
  llmModel?: string;
  preloadWebLLM?: boolean;
  autoFallbackWebLLM?: boolean;
  knowledge?: KnowledgeEntry[] | Record<string, any> | string | null;
  knowledgeUrl?: string;
  companionKnowledge?: KnowledgeEntry[] | Record<string, any> | string | null;
  companionKnowledgeUrl?: string;
  companionFallback?:
    Array<string | Record<string, any>> | ((context: any) => string);
  companionFallbackContext?: string | ((context: any) => string);
  assistantFallbackContext?: string | ((context: any) => string);
  enableAiProvider?: boolean;
  aiProviderModel?: string;
  aiProviderBaseUrl?: string;
  welcomeText?: string | ((context: any) => string);
  companionWelcomeText?: string | ((context: any) => string);
  assistantWelcomeText?: string | ((context: any) => string);
  llmMaxTokens?: number;
  llmIsStream?: boolean;
  onLlmLoading?: () => void;
  onLlmLoadProgress?: (progress: number) => void;
  onLlmLoaded?: () => void;
  onLlmLoadError?: (error: Error) => void;
  onLlmChatting?: () => void;
  onLlmStreamChatting?: () => void;
  onAiProviderConnecting?: () => void;
  onAiProviderConnected?: () => void;
  onAiProviderError?: (error: Error) => void;
  onAiProviderChatting?: () => void;
  onAiProviderStreamChatting?: () => void;
  onAddChatMessage?: (
    role: string,
    text: string,
    options?: Record<string, any>
  ) => string | void;
  onUpdateChatMessage?: (id: string, text: string, streaming?: boolean) => void;
  onChatHistoryChanged?: (history: any[]) => void;
  onSpokenAudioPlayNow?: (text: string) => void;
  onSpokenDisplayTextChange?: (text: string) => void;
  onSpokenAudioTextChange?: (text: string) => void;
  onEmotionChange?: (emotion: string) => void;
  onSummaryUpdated?: (summary: string) => void;
  onStreamStart?: () => void;
  onStreamChunk?: (chunk: string) => void;
  onStreamEnd?: (fullText: string) => void;
  onAutoContinueStart?: (info: {
    continuationIndex: number;
    maxContinuations: number;
    accumulatedText: string;
  }) => void;
  onAutoContinueWait?: (info: {
    continuationIndex: number;
    maxContinuations: number;
    accumulatedText: string;
  }) => void;
  onAutoContinueResume?: (info: {
    continuationIndex: number;
    maxContinuations: number;
    accumulatedText: string;
    chunk: string;
  }) => void;
  onAutoContinueEnd?: (info: {
    totalContinuations: number;
    maxContinuations: number;
    accumulatedText: string;
    reason: string;
  }) => void;
  aiProviderCreateFetchSetting?:
    ((...args: any[]) => RequestInit) | RequestInit;
  aiProviderCreateFetchPayload?:
    ((...args: any[]) => Record<string, any>) | Record<string, any>;
  aiProviderResponseFormat?: string | Record<string, any>;
  aiProviderPingUrl?: string;
  aiProviderChatUrl?: string;
  aiProviderMaxTokens?: number;
  aiProviderIsStream?: boolean;
  aiProviderExtractToolCalls?: (chunk: string) => any;
  getTools?: () => ToolDefinition[];
  getToolByName?: (name: string) => ToolDefinition | null;
  offerToolConfirmation?: Function;
  executeTool?: Function;
  buildLLMMessages?: (question: string, engineType: string) => any[];
  i18nEngine?: I18nEngine;
  locale?: string;
  systemContextTemplate?: string | ((...args: any[]) => string);
  companionSystemContextTemplate?: string | ((...args: any[]) => string);
  ragTemplate?: string | ((...args: any[]) => string);
  customContext?: Record<string, any>;
  languageRule?: string | ((...args: any[]) => string);
  gender?: string;
  genderRule?: string | ((...args: any[]) => string);
  enableAutoContinue?: boolean;
  maxAutoContinuations?: number;
  autoContinueMode?: 'stream' | 'buffered';
  autoContinuePrompt?: string | ((...args: any[]) => string) | null;
  onBrainFallback?: (fromEngine: string, toEngine: string, error: any) => void;
  onToolNotFound?: (
    info: { toolName: string; args: any; toolCall: any },
    widget: AiAvatarWidget
  ) => any;
  onToolError?: (
    info: {
      tool: any;
      toolName: string;
      args: any;
      toolCall: any;
      error: Error;
    },
    widget: AiAvatarWidget
  ) => any;
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
  modes: Record<string, any>;
  readonly availableModes: string[];
  enableMemory: boolean;
  enableAiProvider: boolean;
  preloadWebLLM: boolean;
  autoFallbackWebLLM: boolean;
  enableAutoContinue: boolean;
  maxAutoContinuations: number;
  autoContinueMode: 'stream' | 'buffered';
  autoContinuePrompt: string | Function | null;
  _isSummarizing?: boolean;
  knowledgeUrl?: string;
  knowledge: KnowledgeEntry[];
  companionKnowledgeUrl?: string;
  companionKnowledge: KnowledgeEntry[];
  companionFallback?: any;
  companionFallbackIdx: number;
  companionFallbackContext?: string | Function;
  assistantFallbackContext?: string | Function;
  getTools: () => ToolDefinition[];
  getToolByName: ((name: string) => ToolDefinition | null) | null;
  offerToolConfirmation: Function | null;
  executeTool: Function | null;
  onLlmLoading: Function | null;
  onLlmLoadProgress: Function | null;
  onLlmLoaded: Function | null;
  onLlmLoadError: Function | null;
  onLlmChatting: Function | null;
  onLlmStreamChatting: Function | null;
  onAiProviderConnecting: Function | null;
  onAiProviderConnected: Function | null;
  onAiProviderError: Function | null;
  onAiProviderChatting: Function | null;
  onAiProviderStreamChatting: Function | null;
  onAddChatMessage: Function | null;
  onUpdateChatMessage: Function | null;
  onChatHistoryChanged: Function | null;
  onSpokenAudioPlayNow: Function | null;
  onSpokenDisplayTextChange: Function | null;
  onSpokenAudioTextChange: Function | null;
  onEmotionChange: Function | null;
  onSummaryUpdated: Function | null;
  onStreamStart: Function | null;
  onStreamChunk: Function | null;
  onStreamEnd: Function | null;
  onAutoContinueStart: Function | null;
  onAutoContinueWait: Function | null;
  onAutoContinueResume: Function | null;
  onAutoContinueEnd: Function | null;
  onBrainFallback: Function | null;
  onToolNotFound: Function | null;
  onToolError: Function | null;
  chatLog: any[];
  chatSeq: number;
  welcomeText: string | Function | null;
  companionWelcomeText: string | Function | null;
  assistantWelcomeText: string | Function | null;
  buildLLMMessages: (question: string, engineType: string) => any[];
  readonly buildDefaultLLMMessages: (
    question: string,
    engineType: string
  ) => any[];
  getWelcomeText(): string;
  classifyEmotion(text: string): string;
  applyEmotionFromText(text: string): void;
  answerQuestion(question: string): Promise<string | void>;
  emitAnswer(text: string): void;
  getRetrievalAnswer(rawQuestion: string): string;
  getCompanionFallbackResponse(question: string): string;
  chatWithAiProvider(question: string): Promise<string | void>;
  chatWithWebLLM(question: string): Promise<string | void>;
  triggerRollingSummaryIfNeeded(): Promise<void>;
  addChatMessage(
    role: string,
    text: string,
    options?: Record<string, any>
  ): string;
  updateChatMessage(id: string, text: string, streaming?: boolean): void;
  locale: string;
  setLocale(locale: string): void;
  gender?: string;
  setGender(gender: string): void;
  systemContextTemplate?: string | Function;
  companionSystemContextTemplate?: string | Function;
  ragTemplate?: string | Function;
  customContext?: Record<string, any> | null;
  languageRule?: string | Function;
  genderRule?: string | Function;
  compression: BrainCompressionOptions;
  i18nEngine: I18nEngine | null;
  readonly llm: any;
  readonly memory: MemoryInstance | null;
  readonly aiProvider: any;
}

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
export function initWebLLM(setting?: any, brain?: any): any;
export function initAiProvider(setting?: any, brain?: any): Promise<any>;
export function initMemory(options?: any): MemoryInstance;
export function compressContext(params?: any): any;
export function fetchKnowledge(url?: string): Promise<KnowledgeEntry[]>;
export function findBestMatch(
  knowledge: KnowledgeEntry[],
  query: string
): KnowledgeEntry | null;
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
): any[];
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
