/**
 * Type definitions for ai-avatar-bot-vanilla-js
 *
 * Interactive 2D (Live2D) and 3D (VRM) AI Avatar Bot with Voice STT/TTS,
 * In-Browser WebGPU WebLLM, Cloud AI Brain, Conversation Memory, and Function Calling.
 */

// ============================================================================
// Core / Store Types
// ============================================================================

/**
 * Generic reactive state management store interface (Zustand-like pattern).
 * @template T - The state shape object.
 */
export interface BaseStore<T = Record<string, any>> {
  /**
   * Retrieves the current snapshot of the store's state.
   * @returns The current state object.
   */
  getState(): T;

  /**
   * Updates the store state and notifies relevant subscribers if changes occurred.
   * @param updates - Partial state object or updater function receiving previous state.
   */
  setState(updates: Partial<T> | ((state: T) => Partial<T>)): void;

  /**
   * Subscribes to store state mutations.
   * @param selector - Listener callback for all changes, or a state key name, or a selector function.
   * @param callback - Callback triggered when the selected property changes (for key/selector mode).
   * @returns Unsubscribe function.
   */
  subscribe(
    selector: ((state: T, previousState: T) => void) | keyof T | ((state: T) => any),
    callback?: (currentValue: any, previousValue: any) => void
  ): () => void;
}

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
  setMetadata(patchOrUpdater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)): void;
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
  scale?: { x: number; y: number; z: number } | [number, number, number] | number;
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
  onGestureError?: (error: Error, gestureName: string, skinEngine: SkinEngine) => void;
  /** Callback fired when a gesture completes. */
  onGestureEnd?: (gestureName: string, skinEngine: SkinEngine) => void;
  /** Callback fired when model mode switch begins. */
  onModelChangeStart?: (mode: string) => void;
  /** Alias for onModelChangeStart. */
  onModelChange?: (mode: string) => void;
  /** Callback fired when model mode switch finishes. */
  onModelChangeEnd?: (renderer: Renderer2D | Renderer3D | null, mode: string) => void;
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
  setState(updates: Record<string, any> | ((state: Record<string, any>) => Record<string, any>)): void;
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
  onGestureError?: (error: Error, gestureName: string, skinEngine: SkinEngine) => void;
  /** Callback fired on gesture end. */
  onGestureEnd?: (gestureName: string, skinEngine: SkinEngine) => void;
  /** Callback fired when mode change starts. */
  onModelChangeStart?: (mode: string) => void;
  /** Alias for onModelChangeStart. */
  onModelChange?: (mode: string) => void;
  /** Callback fired when mode change ends. */
  onModelChangeEnd?: (renderer: Renderer2D | Renderer3D | null, mode: string) => void;
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

/**
 * Speech-to-Text (STT) engine internal state.
 */
export interface STTEngineState {
  /** Microphone media stream instance. */
  micStream: MediaStream | null;
  /** AudioContext instance for microphone audio graph. */
  micAudioCtx: AudioContext | null;
  /** AnalyserNode for audio volume and frequency analysis. */
  micAnalyser: AnalyserNode | null;
  /** Byte frequency data array. */
  micData: Uint8Array | null;
  /** Computed dynamic microphone noise floor level. */
  micNoiseFloor: number;
  /** Consecutive detected speech frame counter. */
  voiceFrames: number;
  /** Timestamp (ms) of the last barge-in trigger. */
  lastBargeIn: number;
  /** Animation frame request ID for microphone volume monitoring. */
  micRaf: number;
  /** Web Speech API SpeechRecognition instance. */
  recognition: any;
  /** Whether the STT engine is actively listening. */
  isListening: boolean;
  /** Current language locale code (e.g. 'zh-TW', 'en-US'). */
  locale: string;
  /** Consecutive no-speech count. */
  noSpeechRuns: number;
  /** Timestamp (ms) of the last recognition restart. */
  lastRestart: number;
  /** Timestamp (ms) when speech recognition started. */
  speechStartTime: number;
  /** Timestamp (ms) when interim result was first received. */
  interimStartTime: number;
  /** Hint / subtitle text emitted by speech recognition. */
  spokenDisplayText: string;
  /** Whether speech recognition was intentionally aborted. */
  isAborted: boolean;
}

/**
 * Options for configuring the STTEngine.
 */
export interface STTEngineOptions {
  /** Callback fired when speech recognition produces text results. */
  onResult?: (text: string, isFinal: boolean, isInterim?: boolean) => void;
  /** Callback fired with real-time microphone volume level and speech activity state. */
  onMicLevel?: (rms: number, showVoiceUI: boolean, stateString: string, levelAmp: number) => void;
  /** Callback fired when user voice barge-in is detected. */
  onBargeIn?: () => void;
  /** Callback fired when speech recognition encounters an error. */
  onError?: (errorMessage: string, isNotAllowed: boolean) => void;
  /** Callback fired when speech recognition listening state changes. */
  onStatusChange?: (isListening: boolean, statusMessage?: string, isAborted?: boolean) => void;
  /** Callback fired when recognition stops due to consecutive no-speech timeouts. */
  onNoSpeechAbort?: () => void;
  /** Function to check whether avatar assistant is currently active / speaking. */
  getAssistantActive?: () => boolean;
  /** Function returning assistant speech duration in ms. */
  getSpeechDuration?: () => number;
  /** Function returning whether continuous conversation mode is active. */
  getConvoOn?: () => boolean;
  /** Initial language locale code (e.g. 'zh-TW', 'en-US'). */
  locale?: string;
}

/**
 * Speech-to-Text (STT) engine controller.
 */
export interface STTEngine {
  /** Subscribes to STT state changes. */
  subscribe(selector: any, callback?: Function): () => void;
  /** Gets current STT state snapshot. */
  getState(): STTEngineState;
  /** Updates partial STT state. */
  setState(updates: Partial<STTEngineState> | ((state: STTEngineState) => Partial<STTEngineState>)): void;
  /** Current language locale. */
  locale: string;
  /** Sets active language locale. */
  setLocale(locale: string): void;
  /** Whether microphone is actively listening. */
  readonly isListening: boolean;
  /** Consecutive no-speech count. */
  noSpeechRuns: number;
  /** Starts microphone listening. */
  startListening(): Promise<void>;
  /** Stops microphone listening. */
  stopListening(): void;
}

/**
 * Options for TTS speech synthesis playback.
 */
export interface TTSSpeakOptions {
  /** Whether to play immediately, bypassing sequential queue scheduling. */
  instant?: boolean;
  /** Whether to synchronize and update subtitle display text. */
  updateDisplay?: boolean;
}

/**
 * Text-to-Speech (TTS) engine internal state.
 */
export interface TTSEngineState {
  /** Neural TTS API endpoint URL. */
  ttsEndpoint: string;
  /** Neural voice model name. */
  neuralVoice: string;
  /** Voice gender ('female' | 'male'). */
  gender: string;
  /** Language locale code (e.g. 'zh-TW', 'en-US'). */
  locale: string;
  /** Whether speech audio is currently playing. */
  isSpeaking: boolean;
  /** Whether audio output is muted. */
  isMuted: boolean;
  /** Speech sentence queue. */
  speechQueue: Array<{ text: string; prefetchPromise: Promise<AudioBuffer | null> | null; error: Error | null; instant: boolean }>;
  /** Browser SpeechSynthesisVoice instance. */
  browserVoice: any;
  /** Current speech sequence ID. */
  speakSeq: number;
  /** Speech playback rate multiplier. */
  ttsRate: number;
  /** Target mouth viseme value. */
  mouthTarget: number;
  /** Current smoothed mouth viseme opening value (0 to 1). */
  mouthValue: number;
  /** Real-time audio energy mouth opening value. */
  audioMouth: number;
  /** Whether real-time audio energy drives mouth viseme. */
  useAudioMouth: boolean;
}

/**
 * Options for configuring the TTSEngine.
 */
export interface TTSEngineOptions {
  /** Neural TTS API endpoint URL. */
  ttsEndpoint?: string;
  /** Neural voice model identifier. */
  neuralVoice?: string;
  /** Voice gender ('female' | 'male'). */
  gender?: string;
  /** Language locale code. */
  locale?: string;
  /** Callback fired when speech synthesis playback begins. */
  onSpeakStart?: (audioText?: string) => void;
  /** Callback fired when speech synthesis playback completes. */
  onSpeakEnd?: () => void;
  /** Callback fired when speech queue is waiting for next streaming text chunk. */
  onSpeechWait?: (speechSequenceId?: number) => void;
  /** Callback fired when currently spoken subtitle text changes. */
  onSpokenDisplayTextChange?: (text: string) => void;
}

/**
 * Text-to-Speech (TTS) engine controller.
 */
export interface TTSEngine {
  /** Subscribes to TTS state changes. */
  subscribe(selector: any, callback?: Function): () => void;
  /** Gets current TTS state snapshot. */
  getState(): TTSEngineState;
  /** Updates partial TTS state. */
  setState(updates: Partial<TTSEngineState> | ((state: TTSEngineState) => Partial<TTSEngineState>)): void;
  /** Whether audio is currently speaking. */
  readonly isSpeaking: boolean;
  /** Whether audio is muted. */
  isMuted: boolean;
  /** Current language locale code. */
  readonly locale: string;
  /** TTS playback rate multiplier. */
  ttsRate?: number;
  /** Synthesizes and speaks the given text. */
  speak(text: string, options?: TTSSpeakOptions): void;
  /** Stops ongoing speech playback immediately. */
  stop(): void;
  /** Computes and returns the current mouth opening amplitude (0 to 1). */
  computeMouth(): number;
  /** Sets speech voice gender. */
  setGender(gender: string): void;
  /** Sets speech language locale. */
  setLocale(locale: string): void;
  /** Preloads audio greeting for tap interaction. */
  preloadTapGreeting(text: string): Promise<AudioBuffer | null>;
  /** Begins a new speech sequence stream. */
  beginSpeech?(): number;
  /** Pushes a text chunk to speech queue. */
  pushSpeech?(speechSequenceId: number, text: string, options?: TTSSpeakOptions): void;
  /** Ends speech sequence stream. */
  endSpeech?(speechSequenceId: number): void;
}

/**
 * Spoken audio state intent object for triggering speech synthesis.
 */
export interface SpokenAudioState {
  /** Text to synthesize into speech. */
  text: string;
  /** Sequence increment ID. */
  seq: number;
  /** Additional speech options. */
  options?: Record<string, any>;
  /** Timestamp (ms) when speech was triggered. */
  timestamp?: number;
}

/**
 * Options for initializing the SpeechEngine.
 */
export interface SpeechEngineOptions {
  /** Custom STT and TTS engine instances or factory functions. */
  customEngines?: {
    stt?: STTEngine | ((options: STTEngineOptions) => Promise<STTEngine> | STTEngine);
    tts?: TTSEngine | ((options: TTSEngineOptions) => Promise<TTSEngine> | TTSEngine);
  };
  /** TTS API endpoint URL. */
  ttsEndpoint?: string;
  /** Neural voice model name identifier. */
  neuralVoice?: string;
  /** Language locale code (e.g., 'zh-TW', 'en-US'). */
  locale?: string;
  /** Function to get current avatar gender. */
  getGender?: () => string;
  /** Function to get avatar root container element. */
  getContainer?: () => HTMLElement | null;
  /** Callback fired when voice recognition / conversation status changes. */
  onVoiceStatusChanged?: (convoOn: boolean, text?: string, state?: string, level?: number) => void;
  /** Callback fired when microphone listening state changes. */
  onMicStateChanged?: (isListening: boolean, convoOn: boolean) => void;
  /** Callback fired when active speech language changes. */
  onLanguageChanged?: (locale: string, label: string, shortLabel?: string) => void;
  /** Callback fired when spoken subtitle text changes. */
  onSpokenDisplayTextChange?: (displayText: string) => void;
  /** Callback fired when subtitle bubble times out. */
  onSpokenDisplayTextTimeout?: () => void;
  /** Callback fired when audio speech playback begins. */
  onSpeaking?: (audioText: string) => void;
  /** Callback fired when audio speech playback completely ends. */
  onSpeakingEnd?: () => void;
  /** Callback fired when speech queue is temporarily idle waiting for streaming LLM chunks. */
  onSpeechWait?: (speechSequenceId?: number) => void;
  /** Callback fired when user speech recognition emits final text. */
  onUserInput?: (text: string) => void;
  /** Callback fired when user taps on the avatar. */
  onTapAvatar?: () => void;
  /** Callback fired when ongoing speech is interrupted by user voice barge-in. */
  onInterrupt?: () => void;
}

/**
 * Central speech orchestrator controlling Speech-to-Text (STT) and Text-to-Speech (TTS).
 */
export interface SpeechEngine {
  /** Subscribes to store state updates. */
  subscribe(selector: any, callback?: Function): () => void;
  /** Gets current store state snapshot. */
  getState(): Record<string, any>;
  /** Updates store state. */
  setState(updates: Record<string, any> | ((state: Record<string, any>) => Record<string, any>)): void;
  /** Current speech gender. */
  gender: string;
  /** Sets speech voice gender. */
  setGender(gender: string): void;
  /** Root container DOM element. */
  readonly container: HTMLElement | null;
  /** TTS synthesis endpoint. */
  ttsEndpoint: string;
  /** Neural voice identifier. */
  neuralVoice: string;
  /** Current speech sequence tracking ID. */
  speakSeq: number;
  /** Whether TTS audio is currently speaking. */
  readonly isSpeaking: boolean;
  /** Whether STT microphone is actively listening. */
  readonly isListening: boolean;
  /** Whether TTS speech is muted. */
  ttsMuted: boolean;
  /** TTS playback rate multiplier (default 1.0). */
  ttsRate: number;
  /** Whether continuous voice conversation mode is enabled. */
  convoOn: boolean;
  /** Whether speech pipeline is currently processing. */
  isProcessing: boolean;
  /** Timestamp when assistant speech started. */
  assistantSpeechStartedAt: number;
  /** Currently displayed subtitle text on screen. */
  spokenDisplayText: string;
  /** Audio text trigger property. Setting a string auto-increments sequence and triggers speech. */
  spokenAudioText: string;
  /** Reactive speech state intent object. */
  spokenAudioState: SpokenAudioState;
  /** Speaks the specified text immediately. */
  speak(text: string, options?: Record<string, any>): void;
  /** Stops ongoing speech playback immediately. */
  stopSpeaking(): void;
  /** Interrupts speech playback and transitions to voice listening (barge-in). */
  interruptForVoice(): void;
  /** Computes current mouth opening value (0 to 1) for lip sync. */
  computeMouth(): number;
  /** Triggers avatar tap interaction event. */
  triggerTap(): void;
  /** Stops voice session. */
  stopVoiceSession(message?: string): void;
  /** Updates microphone state and notifies subscribers. */
  setMic(isListening: boolean): void;
  /** Starts microphone listening. */
  startListening(): void;
  /** Preloads audio greeting for tap interaction. */
  preloadTapGreeting(text: string): Promise<any> | void;
  /** Active language locale. */
  locale: string;
  /** Sets speech language locale. */
  setLocale(locale: string): void;
  /** Splits streaming sentence buffer into speakable sentences. */
  drainSentences(state: { buf?: string; sentenceBuffer?: string }, force?: boolean): string[];
  /** Begins a new speech utterance stream and returns sequence ID. */
  beginSpeech(): number;
  /** Pushes a text chunk into the speech queue. */
  pushSpeech(speechSequenceId: number, text: string, options?: Record<string, any>): void;
  /** Ends speech sequence stream. */
  endSpeech(speechSequenceId: number): void;
  /** Callback fired when an utterance ends. */
  onUtteranceEnd(): void;
  /** Callback for voice status change. */
  onVoiceStatusChanged?: (convoOn: boolean, text?: string, state?: string, level?: number) => void;
  /** Callback for mic state change. */
  onMicStateChanged?: (isListening: boolean, convoOn: boolean) => void;
  /** Callback for language change. */
  onLanguageChanged?: (locale: string, label: string, shortLabel?: string) => void;
}

// ============================================================================
// Tools & Function Calling Subsystem Types
// ============================================================================

/**
 * Property definition inside a tool's JSON input schema.
 */
export interface ToolSchemaProperty {
  /** Property type ('string' | 'number' | 'integer' | 'boolean'). */
  type?: 'string' | 'number' | 'integer' | 'boolean' | string;
  /** Property display title. */
  title?: string;
  /** Property description for LLM or human prompt. */
  description?: string;
  /** Key to look up property value from session context. */
  contextKey?: string;
  /** Format constraints ('email' | 'url' | 'phone' | 'contact'). */
  format?: 'email' | 'url' | 'phone' | 'contact' | string;
  /** Keyword prefixes indicating this parameter in natural language. */
  prefixes?: string[];
  /** Allowed enumeration values. */
  enum?: string[];
  /** Minimum numeric value. */
  minimum?: number;
  /** Maximum numeric value. */
  maximum?: number;
  /** Maximum string character length. */
  maxLength?: number;
  [key: string]: any;
}

/**
 * JSON input schema for tool parameters.
 */
export interface ToolSchema {
  /** Root schema type (usually 'object'). */
  type?: 'object' | string;
  /** Dictionary of parameter properties. */
  properties?: Record<string, ToolSchemaProperty>;
  /** Array of required parameter names. */
  required?: string[];
  [key: string]: any;
}

/**
 * Declarative definition of a tool callable by the AI or client rules.
 */
export interface ToolDefinition {
  /** Unique tool identifier name. */
  name: string;
  /** Human-readable display label. */
  label?: string;
  /** Detailed description of what the tool does (used by LLM for function calling). */
  description?: string;
  /** Keywords for fuzzy client-side routing. */
  keywords?: string[];
  /** Example phrases for intent similarity routing. */
  examples?: string[];
  /** Keywords that disqualify/exclude this tool. */
  excludeKeywords?: string[];
  /** Tool priority weighting (-10 to 10). */
  priority?: number;
  /** Routing confidence threshold score (0.15 to 0.95). */
  routeThreshold?: number;
  /** Whether execution requires explicit user confirmation. */
  requiresConfirmation?: boolean;
  /** Routing decision mode ('client' | 'ai' | 'hybrid'). */
  routingMode?: 'ai' | 'client' | 'hybrid' | string;
  /** Result handling mode ('ai_summary' | 'direct'). */
  resultMode?: 'ai_summary' | 'direct' | string;
  /** User confirmation timeout in milliseconds (default 60000). */
  confirmationTimeoutMs?: number | null;
  /** Legacy timeout in milliseconds. */
  timeoutMs?: number;
  /** Regex patterns or string keywords for client-side intent routing. */
  patterns?: Array<RegExp | string>;
  /** Execution callback function. */
  execute?: (
    payload: { args: Record<string, any>; context?: any; query?: string } | any,
    context?: any
  ) => Promise<any> | any;
  /** JSON Schema describing the tool's input parameters. */
  inputSchema?: ToolSchema;
}

/**
 * Scoring evaluation result for a tool against a user query.
 */
export interface ToolScoreResult {
  /** Calculated match score (0 to 1). */
  score: number;
  /** Reason for match score calculation. */
  reason: string;
}

/**
 * Candidate tool match returned from routing evaluation.
 */
export interface ToolRouteCandidate {
  /** Candidate tool definition. */
  tool: ToolDefinition;
  /** Match score (0 to 1). */
  score: number;
  /** Reason for match score. */
  reason?: string;
}

/**
 * Result of tool intent routing.
 */
export interface ToolRouteResult {
  /** Best unambiguous matching tool candidate, or null if ambiguous or none matched. */
  match: ToolRouteCandidate | null;
  /** Ambiguous candidate tools presented to the user when scores are close. */
  ambiguous: ToolRouteCandidate[];
  /** All candidates exceeding routing threshold sorted by score descending. */
  candidates: ToolRouteCandidate[];
}

/**
 * Validation result for tool input parameters against its schema.
 */
export interface ToolValidationResult {
  /** Whether all validation checks passed. */
  ok: boolean;
  /** Validated and sanitized argument dictionary. */
  args: Record<string, any>;
  /** Array of validation error messages. */
  errors: string[];
}

/**
 * Parameter extraction result from natural language query.
 */
export interface ToolExtractResult {
  /** Successfully extracted arguments. */
  args: Record<string, any>;
  /** Required parameter names that are missing. */
  missing: string[];
  /** Parameter validation errors encountered during extraction. */
  errors: string[];
}

/**
 * Result data payload when a tool finishes execution.
 */
export interface ToolResultData {
  /** Whether execution succeeded. */
  ok?: boolean;
  /** Error message if execution failed. */
  error?: string;
  /** Success message or result text. */
  message?: string;
  /** Unique tool call identifier. */
  callId: string;
  /** Tool name. */
  name?: string;
}

/**
 * State of a tool execution pending missing parameter input from user.
 */
export interface PendingToolInput {
  /** Tool being prepared. */
  tool: ToolDefinition;
  /** Original user query text. */
  query: string;
  /** Intent routing metadata. */
  routeMeta: Record<string, any>;
  /** Currently collected parameter arguments. */
  args: Record<string, any>;
  /** Missing required parameter names. */
  missing: string[];
}

/**
 * State of multiple ambiguous tool candidates presented to the user.
 */
export interface PendingToolChoice {
  /** Chat message ID containing the choice prompt. */
  messageId: string;
  /** Candidate choices offered to the user. */
  choices: ToolRouteCandidate[];
}

/**
 * Settings for initializing the ToolsEngine.
 */
export interface ToolsEngineSetting {
  /** User confirmation timeout in milliseconds. */
  confirmationTimeoutMs?: number;
  /** Callback to append a chat message. */
  onAddChatMessage?: (role: string, text: string, options?: Record<string, any>) => string | void;
  /** Callback to update an existing chat message. */
  onUpdateChatMessage?: (id: string, text: string, streaming?: boolean) => void;
  /** Callback to set chat history drawer open state. */
  onSetHistoryOpen?: (isOpen: boolean) => void;
  /** Callback to re-render chat history. */
  onRenderHistory?: () => void;
  /** Callback to immediately speak dialogue audio. */
  onSpokenAudioPlayNow?: (text: string) => void;
  /** Callback fired when a tool is triggered for execution. */
  onToolCall?: (pendingToolData: any) => void;
  /** Callback fired when a tool confirmation is offered. */
  onToolOffer?: (offer: { name: string; confirmation: boolean; toolCallId?: string | null }) => void;
  /** Callback fired when a tool execution is confirmed by the user. */
  onToolConfirm?: (confirm: { name: string; toolCallId?: string | null }) => void;
  /** Callback fired when a tool is cancelled. */
  onToolCancel?: (cancel: { name: string; reason: string; toolCallId?: string | null }) => void;
  /** Function returning current chat log array. */
  getChatLog?: () => any[];
  /** Function returning current chat message sequence number. */
  getChatSeq?: () => number;
  /** Function returning whether continuous conversation mode is active. */
  isConvoOn?: () => boolean;
  /** Callback fired when a tool execution completes or yields a result. */
  onToolResult?: (resultData: ToolResultData) => void;
}

/**
 * Tools Engine instance for parameter extraction, intent routing, and function execution.
 */
export interface ToolsEngine {
  /** Registered host tool definitions. */
  HOST_TOOLS: ToolDefinition[];
  /** Active tool pending missing parameter input. */
  pendingToolInput: PendingToolInput | null;
  /** Active ambiguous tool choices pending user selection. */
  pendingToolChoice: PendingToolChoice | null;
  /** Active tool message ID pending user confirmation. */
  pendingToolConfirmation: string | null;
  /** Current confirmation timeout in milliseconds. */
  confirmationTimeoutMs: number;
  /** Registered callback to add a chat message. */
  readonly onAddChatMessage?: (role: string, text: string, options?: Record<string, any>) => string | void;
  /** Registered callback to update a chat message. */
  readonly onUpdateChatMessage?: (id: string, text: string, streaming?: boolean) => void;
  /** Registered callback to set history drawer state. */
  readonly onSetHistoryOpen?: (isOpen: boolean) => void;
  /** Registered callback to render history drawer. */
  readonly onRenderHistory?: () => void;
  /** Registered callback to speak dialogue audio. */
  readonly onSpokenAudioPlayNow?: (text: string) => void;
  /** Routes query to the best host tool candidate. */
  routeHostTool(queryText: string): ToolRouteResult;
  /** Gets tools available for AI model calling. */
  getAiAvailableTools(): ToolDefinition[];
  /** Converts tools to OpenAI-compatible function calling schemas. */
  toOpenAiTools(): any[];
  /** Generates parameter collection prompt for missing field. */
  parameterPrompt(tool: ToolDefinition, propertyName: string, errorText?: string): string;
  /** Prepares a tool for execution by extracting parameters. */
  prepareTool(tool: ToolDefinition, query: string, routeMeta?: any, existingArgs?: Record<string, any>): void;
  /** Continues collecting missing parameters from user input. */
  continueToolInput(inputText: string): boolean;
  /** Offers ambiguous tool choices to the user. */
  offerToolChoices(query: string, candidates: ToolRouteCandidate[]): void;
  /** Processes user response to ambiguous tool choice. */
  continueToolChoice(inputText: string): boolean;
  /** Selects a specific tool choice. */
  chooseTool(messageId: string, choiceIndex: number): void;
  /** Offers host tool execution confirmation or executes directly. */
  offerHostTool(tool: ToolDefinition, query: string, routeMeta?: any, args?: Record<string, any>, options?: any): void;
  /** Executes a confirmed pending tool. */
  executePendingTool(messageId: string): void;
  /** Cancels a pending tool. */
  cancelPendingTool(messageId: string, options?: { reason?: string }): void;
  /** Handles user confirmation answer ('yes', 'no', 'cancel'). */
  continueToolConfirmation(inputText: string): boolean;
  /** Handles tool execution result response. */
  handleToolResult(resultData: ToolResultData): void;
  /** Executes a tool directly with arguments and context. */
  executeToolDirectly(tool: ToolDefinition, args: Record<string, any>, pendingToolData?: any): Promise<any>;
}

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * Options for configuring the emotion and gesture tools plugin.
 */
export interface EmotionToolsPluginOptions {
  /** Function providing the SkinEngine instance when used standalone. */
  getSkinEngine?: () => SkinEngine | null;
  /** List of supported emotion or gesture trigger names. */
  emotions?: string[];
  /** Name of the tool registered for emotion dispatching. */
  toolName?: string;
  /** Natural language description explaining to the LLM when to call this tool. */
  description?: string;
  /** Tool routing decision mode ('ai' | 'client' | 'hybrid'). */
  routingMode?: 'ai' | 'client' | 'hybrid' | string;
  /** Tool execution result handling mode ('ai_summary' | 'direct'). */
  resultMode?: 'ai_summary' | 'direct' | string;
  /** Callback triggered when an emotion action is executed. */
  onEmotionTrigger?: (emotion: string, context?: Record<string, any>) => void;
}

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

/**
 * Display label metadata for a locale.
 */
export interface LocaleLabelInfo {
  /** Full display name (e.g. '繁體中文', 'English (US)'). */
  label: string;
  /** Short abbreviation (e.g. '繁中', 'EN'). */
  shortLabel: string;
}

/**
 * Options for initializing the I18nEngine.
 */
export interface I18nEngineOptions {
  /** Initial locale code (default: 'zh-TW'). */
  locale?: string;
  /** Custom dictionary translations merged with default locales. */
  messages?: Record<string, Record<string, any>>;
  /** Custom translation function. */
  t?: (key: string, params?: Record<string, any>) => any;
  /** Alias for t. */
  translate?: (key: string, params?: Record<string, any>) => any;
}

/**
 * Internal state shape of the I18nEngine.
 */
export interface I18nEngineState {
  locale: string;
  messages: Record<string, Record<string, any>>;
}

/**
 * Internationalization (i18n) Engine controller.
 */
export interface I18nEngine {
  /** Translates a dictionary key with optional parameter substitution. */
  t(key: string, params?: Record<string, any>): any;
  /** Alias for t. */
  translate(key: string, params?: Record<string, any>): any;
  /** Dynamically sets current locale. */
  setLocale(newLocale: string): void;
  /** Dynamically registers or overrides translation messages for a locale. */
  addMessages(locale: string, newMessages: Record<string, any>): void;
  /** Formats a template string by replacing {{key}} tokens with values. */
  formatParams(text: string, params?: Record<string, any>): string;
  /** Resolves a multi-lingual value, object, or function based on current locale. */
  resolveLocalized<T>(value: T | Record<string, T> | ((args: any) => T), fallbackValue?: T | ((args: any) => T), templateContext?: any): T;
  /** Current active locale code. */
  locale: string;
  /** All loaded dictionary translation data. */
  readonly messages: Record<string, Record<string, any>>;
  /** Display label metadata for the active locale. */
  readonly labels: LocaleLabelInfo;
  /** Subscribes to locale and dictionary changes or state selector. */
  subscribe(keyOrSelector: string | ((state: I18nEngineState) => any), listener: Function): () => void;
  /** Retrieves internal state. */
  getState(): I18nEngineState;
  /** Updates internal state. */
  setState(updates: Partial<I18nEngineState> | ((state: I18nEngineState) => Partial<I18nEngineState>)): void;
}

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
  companionFallback?: Array<string | Record<string, any>> | ((context: any) => string);
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
  onAddChatMessage?: (role: string, text: string, options?: Record<string, any>) => string | void;
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
  onAutoContinueStart?: (info: { continuationIndex: number; maxContinuations: number; accumulatedText: string }) => void;
  onAutoContinueWait?: (info: { continuationIndex: number; maxContinuations: number; accumulatedText: string }) => void;
  onAutoContinueResume?: (info: { continuationIndex: number; maxContinuations: number; accumulatedText: string; chunk: string }) => void;
  onAutoContinueEnd?: (info: { totalContinuations: number; maxContinuations: number; accumulatedText: string; reason: string }) => void;
  aiProviderCreateFetchSetting?: ((...args: any[]) => RequestInit) | RequestInit;
  aiProviderCreateFetchPayload?: ((...args: any[]) => Record<string, any>) | Record<string, any>;
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
  onToolNotFound?: (info: { toolName: string; args: any; toolCall: any }, widget: AiAvatarWidget) => any;
  onToolError?: (info: { tool: any; toolName: string; args: any; toolCall: any; error: Error }, widget: AiAvatarWidget) => any;
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
  readonly buildDefaultLLMMessages: (question: string, engineType: string) => any[];
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
  addChatMessage(role: string, text: string, options?: Record<string, any>): string;
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

/**
 * Avatar frontend UI DOM elements and controller methods.
 */
export interface UiDom {
  /** 3D or 2D avatar viewport stage container element. */
  readonly stageEl: HTMLElement;
  /** Dialogue text bubble element. */
  readonly bubbleEl: HTMLElement;
  /** Suggested questions list container element. */
  readonly suggestionsEl: HTMLElement;
  /** Chat history slide-out panel element. */
  readonly historyPanelEl: HTMLElement;
  /** Real-time voice conversation status bar container element. */
  readonly voiceLiveEl: HTMLElement;
  /** Real-time voice state label element. */
  readonly voiceStatusEl: HTMLElement;
  /** Audio volume level meter indicator element. */
  readonly voiceLevelEl: HTMLElement;
  /** Updates voice conversation status bar and volume meter. */
  updateVoiceStatus(convoOn: boolean, text?: string, state?: string, level?: number, i18n?: I18nEngine): void;
  /** Updates microphone button UI state and label. */
  updateMicState(isListening?: boolean, convoOn?: boolean, isCompanion?: boolean, i18n?: I18nEngine): void;
  /** Main control bar container. */
  readonly controlBarEl: HTMLElement;
  /** Text input dock row. */
  readonly dockRow1El: HTMLElement;
  /** Toolbar buttons dock row. */
  readonly dockRow2El: HTMLElement;
  /** Text input field element. */
  readonly questionInputEl: HTMLInputElement;
  /** Message send button element. */
  readonly sendButtonEl: HTMLButtonElement;
  /** Voice conversation microphone button element. */
  readonly micButtonEl: HTMLButtonElement;
  /** 2D / 3D model engine switch button element. */
  readonly engineButtonEl: HTMLButtonElement;
  /** TTS mute toggle button element. */
  readonly muteButtonEl: HTMLButtonElement;
  /** In-browser WebLLM AI brain load/status button element. */
  readonly btnLlmEl: HTMLButtonElement;
  /** Speech rate cycle button element. */
  readonly speedButtonEl: HTMLButtonElement;
  /** Interface language switch button element. */
  readonly langButtonEl: HTMLButtonElement;
  /** Chat history open button element. */
  readonly historyButtonEl: HTMLButtonElement;
  /** Minimize widget close button element. */
  readonly closeButtonEl: HTMLButtonElement;
  /** Direct open warning banner element. */
  readonly directWarnEl: HTMLElement;
  /** Floating circular wake-up trigger button element when minimized. */
  readonly minimalEl: HTMLElement;
  /** Tap timer tracking state. */
  onTapTimer: boolean;
}

/**
 * Contextual state and engine references passed into UI event and rendering handlers.
 */
export interface UiContext {
  /** UI DOM elements and controller methods. */
  uiDom: UiDom;
  /** Speech STT / TTS engine coordinator. */
  speechEngine?: SpeechEngine;
  /** AI Brain LLM and conversation memory engine coordinator. */
  brainEngine?: BrainEngine;
  /** Function Calling and tools engine coordinator. */
  toolsEngine?: ToolsEngine;
  /** Live2D / VRM rendering engine coordinator. */
  skinEngine?: SkinEngine;
  /** Internationalization (i18n) engine instance. */
  i18nEngine?: I18nEngine;
  /** Current active locale code. */
  locale?: string;
  /** Suggested questions list or resolver. */
  suggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  /** Suggested title text or resolver. */
  suggestedTitle?: string | Record<string, string> | ((context: any) => string);
  /** Companion mode suggested questions list or resolver. */
  companionSuggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  /** Companion mode suggested title text or resolver. */
  companionSuggestedTitle?: string | Record<string, string> | ((context: any) => string);
  /** Assistant mode suggested questions list or resolver. */
  assistantSuggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  /** Assistant mode suggested title text or resolver. */
  assistantSuggestedTitle?: string | Record<string, string> | ((context: any) => string);
  /** Current avatar personality mode ('companion' | 'assistant'). */
  avatarMode?: string;
  /** Avatar mode constant mapping. */
  AVATAR_MODE_MAP?: Record<string, string>;
  /** Engine mode constant mapping. */
  ENGINE_MODE_MAP?: Record<string, string>;
  /** Lifecycle state constant mapping. */
  STATE_MAP?: Record<string, string>;
  /** Whether the widget is currently minimized. */
  isMinimal?: boolean;
  /** Whether widget is running inside an iframe embedding container. */
  isIframe?: boolean;
  /** Main handler function for processing user input text. */
  handleUser?: (text: string) => Promise<void> | void;
  /** Callback fired when minimal mode is toggled. */
  onMinimalTrigger?: (isMinimal: boolean, context: UiContext) => void;
}

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
  aiProviderCreateFetchSetting?: ((...args: any[]) => RequestInit) | RequestInit;
  /** Custom fetch payload object or factory for AI Provider. */
  aiProviderCreateFetchPayload?: ((...args: any[]) => Record<string, any>) | Record<string, any>;
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
  suggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  /** Suggested questions for companion mode. */
  companionSuggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  /** Suggested questions for assistant mode. */
  assistantSuggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  /** Suggested questions section title. */
  suggestedTitle?: string | Record<string, string> | ((context: any) => string);
  /** Suggested title for companion mode. */
  companionSuggestedTitle?: string | Record<string, string> | ((context: any) => string);
  /** Suggested title for assistant mode. */
  assistantSuggestedTitle?: string | Record<string, string> | ((context: any) => string);
  /** Lifecycle callback fired when widget is fully initialized and mounted. */
  onReady?: (widget: AiAvatarWidget) => void;
  /** Callback fired when minimal UI mode is toggled. */
  onMinimalTrigger?: (isMinimal: boolean, widget: AiAvatarWidget) => void;
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
  readonly toolsEngine: ToolsEngine;
  /** Builds LLM messages for question inference. */
  buildLLMMessages: (...args: any[]) => any[];
  /** Classifies emotion string from text. */
  classifyEmotion: (text: string) => string;
  /** Applies emotion to skin from input text. */
  applyEmotionFromText: (text: string) => void;
  /** Sends a question to the brain engine and streams / returns response. */
  answerQuestion: (question: string) => Promise<string | void>;
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
  suggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  companionSuggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  assistantSuggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  suggestedTitle?: string | Record<string, string> | ((context: any) => string);
  companionSuggestedTitle?: string | Record<string, string> | ((context: any) => string);
  assistantSuggestedTitle?: string | Record<string, string> | ((context: any) => string);
  setSuggestedQuestions: (
    questions?: string[] | Record<string, string[]> | ((context: any) => string[]),
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
  onMinimalTrigger?: (isMinimal: boolean, widget: AiAvatarWidget) => void;
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
export function initAvatarBot(rawOptions?: AvatarBotOptions): Promise<AiAvatarWidget | void>;

/**
 * Alias for `initAvatarBot`. Creates and initializes a new AI Avatar Bot widget instance.
 *
 * @param rawOptions - Configuration options for initializing the avatar bot.
 * @returns Promise resolving to the initialized AiAvatarWidget controller, or void on failure.
 */
export function createAvatarBot(rawOptions?: AvatarBotOptions): Promise<AiAvatarWidget | void>;

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
export const DEFAULT_3D_HALF_CAMERA_POSITION: Readonly<{ x: number; y: number; z: number }>;
export const DEFAULT_3D_FULL_CAMERA_POSITION: Readonly<{ x: number; y: number; z: number }>;
export const DEFAULT_3D_CAMERA_POSITION: Readonly<{ x: number; y: number; z: number }>;
export const DEFAULT_3D_HALF_CAMERA_LOOK_AT: Readonly<{ x: number; y: number; z: number }>;
export const DEFAULT_3D_FULL_CAMERA_LOOK_AT: Readonly<{ x: number; y: number; z: number }>;
export const DEFAULT_3D_CAMERA_LOOK_AT: Readonly<{ x: number; y: number; z: number }>;
export const DEFAULT_3D_MODEL_POSITION: Readonly<{ x: number; y: number; z: number }>;
export const DEFAULT_3D_MODEL_SCALE: Readonly<{ x: number; y: number; z: number }>;
export const DEFAULT_3D_MODEL_ROTATION: Readonly<{ x: number; y: number; z: number }>;
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
export function getDefaultModelUrl(gender?: string, engineMode?: string): string;
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
export function createBaseStore<T = Record<string, any>>(initialState?: T): BaseStore<T>;

// Skin
export function initSkinEngine(setting?: SkinEngineOptions): SkinEngine;
export function createCanvas(container: HTMLElement): HTMLCanvasElement;
export function bootAvatar(skinEngine: SkinEngine, modelUrl?: string): Promise<any>;
export function bootVRM(skinEngine: SkinEngine, setting?: any): Promise<any>;
export function loadVRMFile(skinEngine: SkinEngine, file: File): Promise<void>;

// Brain
export function initBrainEngine(setting?: BrainEngineOptions): Promise<BrainEngine>;
export function initWebLLM(setting?: any, brain?: any): any;
export function initAiProvider(setting?: any, brain?: any): Promise<any>;
export function initMemory(options?: any): MemoryInstance;
export function compressContext(params?: any): any;
export function fetchKnowledge(url?: string): Promise<KnowledgeEntry[]>;
export function findBestMatch(knowledge: KnowledgeEntry[], query: string): KnowledgeEntry | null;
export function classifyEmotion(text: string): string;
export function applyEmotionFromText(brainEngine: BrainEngine, text: string): void;
export function getBrainMessage(locale: string, key: string): string;
export function getWelcomeText(brainEngine: BrainEngine): string;
export function buildDefaultLLMMessages(brainEngine: BrainEngine, question: string, engineType?: string): any[];
export function chatWithWebLLM(brainEngine: BrainEngine, question: string): Promise<string | void>;
export function chatWithAiProvider(brainEngine: BrainEngine, question: string): Promise<string | void>;

// Speech
export function initSpeechEngine(setting?: SpeechEngineOptions): Promise<SpeechEngine>;
export function initDefaultSTTEngine(setting?: any): any;
export function initDefaultTTSEngine(setting?: any): any;
export function validateSTTEngine(engine: any): { isValid: boolean; missing: string[] };
export function validateTTSEngine(engine: any): { isValid: boolean; missing: string[] };
export function splitSentences(text: string): string[];
export function drainSentences(state: { buf?: string; sentenceBuffer?: string }, force?: boolean): string[];
export function getSttMessage(locale: string, key: string): string;

// Tools
export function initToolsEngine(setting?: ToolsEngineSetting): ToolsEngine;
export function validateToolsEngine(engine: any): { isValid: boolean; missing: string[] };
export function toOpenAiTools(tools: ToolDefinition[]): any[];
export function getAiAvailableTools(tools: ToolDefinition[]): ToolDefinition[];
export function argumentSummary(tool: ToolDefinition, args: Record<string, any>): string;
export function route(tools: ToolDefinition[], queryText: string): any;
export function extract(tool: ToolDefinition, query: string, schema?: any, existingArgs?: any, targetFields?: string[], isContinuation?: boolean): any;

// I18n
export function initI18nEngine(options?: I18nEngineOptions): I18nEngine;
export function resolveLocalized<T>(value: T | Record<string, T> | ((args: any) => T), locale?: string, fallbackValue?: T | ((args: any) => T), templateContext?: any): T;
export function formatParams(text: string, params?: Record<string, any>): string;
export const defaultLocales: Record<string, any>;

// Plugins & Tools Extensions
export function createEmotionToolsPlugin(options?: EmotionToolsPluginOptions): ToolDefinition[];

// UI Layer Utilities
export function initUi(container: HTMLElement, stateMap?: Record<string, string>): UiDom;
export function updateUIStrings(uiDom: UiDom, i18nEngine: I18nEngine, stateMap?: Record<string, string>): void;
export function copyText(text: string, bubbleEl?: HTMLElement, directWarnEl?: HTMLElement, i18nEngine?: I18nEngine): Promise<boolean>;
export function initSkinModeChangeButton(engineButtonEl: HTMLButtonElement, options?: any): void;
export function renderSuggestions(context: UiContext): void;
export function setHistoryOpen(isOpen: boolean, context: UiContext): void;
export function renderHistory(context: UiContext): void;
export function bindTyping(context: UiContext): void;
export function bindUiEvent(context: UiContext): void;

// Build Framework Plugins & Node Helpers
export function getAvatarSkinPath(): string;
export function copyDirRecursive(src: string, dest: string, overwrite?: boolean): void;
export function copyAvatarSkin(destDir?: string, options?: { overwrite?: boolean; silent?: boolean }): void;
export function avatarBotVitePlugin(options?: AvatarBotPluginOptions): any;
export class AvatarBotWebpackPlugin {
  constructor(options?: AvatarBotPluginOptions);
  apply(compiler: any): void;
}
export function withAiAvatarBot(nextConfig?: any, pluginOptions?: AvatarBotPluginOptions): any;
export const avatarBotNuxtModule: any;
export function createNitroAvatarConfig(options?: AvatarBotPluginOptions): any;
export function avatarBotAnalogPlugin(options?: AvatarBotPluginOptions): any;


