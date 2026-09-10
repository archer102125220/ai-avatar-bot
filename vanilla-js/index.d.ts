/**
 * Comprehensive TypeScript definitions for ai-avatar-bot-vanilla-js
 */

export type AvatarMode = 'assistant' | 'companion' | (string & {});

export interface MemoryData {
  version: number;
  name: string;
  visits: number;
  last: number;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  summary?: string;
  lastSummarizedTurnIndex?: number;
  metadata?: Record<string, any>;
}

export interface MemoryAdapter {
  load(key: string): MemoryData | null | Promise<MemoryData | null>;
  save(key: string, data: MemoryData): void | Promise<void>;
  clear(key: string): void | Promise<void>;
}

export interface CustomEnginesConfig {
  skin?: any;
  tools?: any;
  brain?: any;
  stt?: any;
  tts?: any;
  i18n?: any;
}

export interface Skin2DModeConfig {
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  anchor?: { x?: number; y?: number };
}

export interface Skin2DConfig {
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  anchor?: { x?: number; y?: number };
  half?: Skin2DModeConfig;
  full?: Skin2DModeConfig;
}

export interface Skin3DCameraConfig {
  fov?: number;
  near?: number;
  far?: number;
  position?: { x: number; y: number; z: number } | [number, number, number];
  lookAt?: { x: number; y: number; z: number } | [number, number, number];
}

export interface Skin3DModelConfig {
  position?: { x: number; y: number; z: number } | [number, number, number];
  scale?: { x: number; y: number; z: number } | [number, number, number] | number;
  rotation?: { x: number; y: number; z: number } | [number, number, number];
}

export interface Skin3DModeConfig {
  camera?: Skin3DCameraConfig;
  model?: Skin3DModelConfig;
}

export interface Skin3DConfig {
  camera?: Skin3DCameraConfig;
  model?: Skin3DModelConfig;
  half?: Skin3DModeConfig;
  full?: Skin3DModeConfig;
  pointerLook?: boolean;
  bow?: string;
  wave?: string;
  thinking?: string;
  look?: string;
  relax?: string;
  surprised?: string;
  vrmaRootPath?: string;
}

export interface SkinEngineOptions {
  stageEl: HTMLElement;
  modelUrl?: string;
  startMode?: string;
  fitMode?: string;
  skin2d?: Skin2DConfig;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  anchor?: { x: number; y: number };
  vrmUrl?: string;
  skin3d?: Skin3DConfig;
  camera?: Skin3DCameraConfig;
  modelTransform?: Skin3DModelConfig;
  pointerLook?: boolean;
  gesture3D?: (skinEngine: SkinEngine, emotionName: string) => void;
  gesture2D?: (skinEngine: SkinEngine, emotionName: string) => void;
  computeMouth?: (skinEngine: SkinEngine) => number | Promise<number>;
  onThreeDimensionalError?: (error: Error, skinEngine: SkinEngine) => void;
  onTwoDimensionalError?: (error: Error, skinEngine: SkinEngine) => void;
  VRMFileChangeFail?: (error: Error) => void;
  VRMFileChangeSuccess?: (vrmUrl?: string) => void;
  onMounted?: () => void;
  gender?: string;
  onGesture?: (gestureName: string, skinEngine: SkinEngine) => void;
  onGestureError?: (error: Error, gestureName: string, skinEngine: SkinEngine) => void;
  onGestureEnd?: (gestureName: string, skinEngine: SkinEngine) => void;
  onModelChangeStart?: (mode: string) => void;
  onModelChange?: (mode: string) => void;
  onModelChangeEnd?: (renderer: any, mode: string) => void;
  onModelChangeError?: (error: Error) => void;
}

export interface SpokenAudioState {
  text: string;
  seq: number;
  options?: Record<string, any>;
  timestamp?: number;
}

export interface SpeechEngine {
  subscribe(selector: any, callback?: Function): () => void;
  getState(): Record<string, any>;
  setState(updates: Record<string, any> | ((state: Record<string, any>) => Record<string, any>)): void;
  gender: string;
  setGender(gender: string): void;
  container: HTMLElement | null;
  ttsEndpoint: string;
  neuralVoice: string;
  speakSeq: number;
  isSpeaking: boolean;
  isListening: boolean;
  ttsMuted: boolean;
  ttsRate: number;
  convoOn: boolean;
  isProcessing: boolean;
  assistantSpeechStartedAt: number;
  spokenDisplayText: string;
  spokenAudioText: string;
  spokenAudioState: SpokenAudioState;
  speak(text: string, options?: Record<string, any>): void;
  stopSpeaking(): void;
  interruptForVoice(): void;
  computeMouth(): number[];
  triggerTap(): void;
  stopVoiceSession(message?: string): void;
  setMic(isListening: boolean): void;
  startListening(): void;
  preloadTapGreeting(text: string): Promise<any> | void;
  locale: string;
  setLocale(locale: string): void;
  onVoiceStatusChanged?: (convoOn: boolean, text: string, state: string, level: number) => void;
  onMicStateChanged?: (isListening: boolean, convoOn: boolean) => void;
  onLanguageChanged?: (locale: string, label: string, shortLabel?: string) => void;
}

export interface SkinEngine {
  readonly stageEl: HTMLElement;
  readonly has2D: boolean;
  readonly has3D: boolean;
  engineMode: string;
  avatarModel: any;
  renderer: any;
  setGender(gender: string): void;
  loadVRMFile(file: File): void;
  getState(): Record<string, any>;
  setState(updates: Record<string, any> | ((state: Record<string, any>) => Record<string, any>)): void;
  subscribe(listener: (state: any, prevState: any) => void): () => void;
  setEmotion(emotion: string): void;
  setIsSpeaking(isSpeaking: boolean): void;
  setFitMode(fitMode: string): void;
  setSkin2d(updates: Partial<Skin2DConfig>): void;
  setSkin3d(updates: Partial<Skin3DConfig>): void;
  skin2d: Skin2DConfig;
  skin3d: Skin3DConfig;
  gender: string;
  modelUrl: string;
  vrmUrl: string;
  gesture3D(emotionName: string): void;
  gesture2D(emotionName: string): void;
  gesture(emotionName: string): Promise<void>;
  gestureName: string;
  startMode: string;
  fitMode: string;
  emo: { name: string; target: number; weight: number; applied: string };
  computeMouth?: (skinEngine: SkinEngine) => number | Promise<number>;
  onMounted?: () => void;
  onThreeDimensionalError?: (error: Error, skinEngine: SkinEngine) => void;
  onTwoDimensionalError?: (error: Error, skinEngine: SkinEngine) => void;
  VRMFileChangeFail?: (error: Error) => void;
  VRMFileChangeSuccess?: (vrmUrl: string) => void;
  onGesture?: (gestureName: string, skinEngine: SkinEngine) => void;
  onGestureError?: (error: Error, gestureName: string, skinEngine: SkinEngine) => void;
  onGestureEnd?: (gestureName: string, skinEngine: SkinEngine) => void;
  onModelChangeStart?: (mode: string) => void;
  onModelChange?: (mode: string) => void;
  onModelChangeEnd?: (renderer: any, mode: string) => void;
  onModelChangeError?: (error: Error) => void;
  switching?: boolean | null;
  lipIds?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  routingMode?: 'ai' | 'client' | 'hybrid' | string;
  resultMode?: 'ai_summary' | 'direct' | string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  execute: (payload: any, context?: any) => Promise<any> | any;
}

export interface AvatarBotOptions {
  container?: HTMLElement | null;
  enableAiProvider?: boolean;
  aiProviderBaseUrl?: string;
  aiProviderModel?: string;
  aiProviderCreateFetchSetting?: ((...args: any[]) => RequestInit) | RequestInit;
  aiProviderCreateFetchPayload?: ((...args: any[]) => Record<string, any>) | Record<string, any>;
  aiProviderResponseFormat?: string | Record<string, any>;
  aiProviderMaxTokens?: number;
  aiProviderStream?: boolean;
  aiProviderExtractToolCalls?: (chunk: string) => any;
  neuralVoice?: string;
  knowledgeUrl?: string;
  companionKnowledgeUrl?: string;
  modelUrl?: string;
  ttsEndpoint?: string;
  llmModel?: string;
  llmMaxTokens?: number;
  preloadWebLLM?: boolean;
  autoFallbackWebLLM?: boolean;
  enableAutoContinue?: boolean;
  maxAutoContinuations?: number;
  autoContinueMode?: 'stream' | 'buffered';
  autoContinuePrompt?: string | ((...args: any[]) => string);
  avatarMode?: AvatarMode;
  enableMemory?: boolean;
  maxHistoryTurns?: number;
  memoryKey?: string;
  memoryAdapter?: MemoryAdapter;
  modes?: Record<string, any>;
  knowledge?: Record<string, any> | Array<any> | string | null;
  companionKnowledge?: Record<string, any> | Array<any> | string | null;
  startMode?: string;
  fitMode?: string;
  skin2d?: Skin2DConfig;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  anchor?: { x?: number; y?: number };
  vrmUrl?: string;
  skin3d?: Skin3DConfig;
  camera?: Skin3DCameraConfig;
  modelTransform?: Skin3DModelConfig;
  pointerLook?: boolean;
  enableModelDrop?: boolean;
  allowModelDrop?: boolean;
  enableEngineToggle?: boolean;
  gesture3D?: Record<string, any>;
  gesture2D?: Record<string, any>;
  isMinimal?: boolean;
  isIframe?: boolean;
  locale?: string;
  i18nMessages?: Record<string, Record<string, string>>;
  gender?: string;
  brainGender?: string | null;
  speechGender?: string | null;
  skinGender?: string | null;
  companionFallback?: Array<string | Record<string, any>>;
  customEngines?: CustomEnginesConfig;
  compression?: {
    strategy?: 'sliding-window' | 'rolling-summary' | 'none' | string;
    maxTurns?: number;
    maxTotalChars?: number;
    webLlm?: { maxTurns?: number; maxTotalChars?: number };
    aiProvider?: { maxTurns?: number; maxTotalChars?: number };
    customCompressor?: (params: any) => Promise<any[]> | any[];
  };
  systemContextTemplate?: string | ((...args: any[]) => string);
  companionSystemContextTemplate?: string | ((...args: any[]) => string);
  ragTemplate?: string | ((...args: any[]) => string);
  customContext?: Record<string, any>;
  languageRule?: string | ((...args: any[]) => string);
  genderRule?: string | ((...args: any[]) => string);
  tools?: ToolDefinition[];
  hostTools?: ToolDefinition[];
  enableEmotionTools?: boolean;
  emotionToolsOptions?: Record<string, any>;
  confirmationTimeoutMs?: number;
  toolConfirmationTimeoutMs?: number;
  buildLLMMessages?: (...args: any[]) => any[];
  welcomeText?: string;
  companionWelcomeText?: string;
  assistantWelcomeText?: string;
  greeting?: string;
  companionGreeting?: string;
  assistantGreeting?: string;
  suggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  companionSuggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  assistantSuggestedQuestions?: string[] | Record<string, string[]> | ((context: any) => string[]);
  suggestedTitle?: string | Record<string, string> | ((context: any) => string);
  companionSuggestedTitle?: string | Record<string, string> | ((context: any) => string);
  assistantSuggestedTitle?: string | Record<string, string> | ((context: any) => string);
  onReady?: (widget: AiAvatarWidget) => void;
  onMinimalTrigger?: (isMinimal: boolean, widget: AiAvatarWidget) => void;
  onError?: (error: Error, widget: AiAvatarWidget) => void;
  onLlmLoading?: () => void;
  onLlmLoadProgress?: (progress: number) => void;
  onLlmLoaded?: () => void;
  onLlmLoadError?: (error: Error) => void;
  onAiProviderConnecting?: () => void;
  onAiProviderConnected?: () => void;
  onAddChatMessage?: (role: string, text: string) => void;
  onUpdateChatMessage?: (id: string, text: string) => void;
  onChatHistoryChanged?: (history: any[]) => void;
  onSpokenDisplayTextChange?: (text: string) => void;
  onSpokenDisplayTextTimeout?: () => void;
  onMicStateChanged?: (isListening: boolean) => void;
  onVoiceStatusChanged?: (status: any) => void;
  onLanguageChanged?: (locale: string) => void;
  onSpeaking?: (text: string) => void;
  onSpeakingEnd?: () => void;
  onStreamEnd?: (fullText: string) => void;
  onAutoContinueStart?: (info: any) => void;
  onAutoContinueWait?: (info: any) => void;
  onAutoContinueResume?: (info: any) => void;
  onAutoContinueEnd?: (info: any) => void;
  onSummaryUpdated?: (summary: string) => void;
  onBrainFallback?: (fromEngine: string, toEngine: string, error: any) => void;
  onToolCall?: (toolCall: any) => void;
  onToolNotFound?: (info: any, widget: AiAvatarWidget) => any;
  onToolError?: (info: any, widget: AiAvatarWidget) => any;
  onSetHistoryOpen?: (isOpen: boolean) => void;
  onRenderHistory?: () => void;
  onSpokenAudioPlayNow?: (text: string) => void;
  onThreeDimensionalError?: (error: Error) => void;
  onTwoDimensionalError?: (error: Error) => void;
  VRMFileChangeFail?: (error: Error) => void;
  VRMFileChangeSuccess?: (vrmUrl?: string) => void;
  onModelChangeStart?: (newMode: string) => void;
  onModelChangeEnd?: (renderer: any, newMode: string) => void;
}

export interface AiAvatarWidget {
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
  readonly container: HTMLElement;
  readonly uiDom: any;
  readonly i18nEngine: any;
  readonly toolsEngine: any;
  buildLLMMessages: (...args: any[]) => any[];
  classifyEmotion: (text: string) => string;
  applyEmotionFromText: (text: string) => void;
  answerQuestion: (question: string) => Promise<string | void>;
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
  readonly brainEngine: any;
  readonly speechEngine: SpeechEngine;
  readonly skinEngine: SkinEngine;
  setSkin2d: (config: Partial<Skin2DConfig>) => void;
  setSkin3d: (config: Partial<Skin3DConfig>) => void;
  setFitMode: (fitMode: string) => void;
  onReady?: (widget: AiAvatarWidget) => void;
  onMinimalTrigger?: (isMinimal: boolean, widget: AiAvatarWidget) => void;
  onError?: (error: Error, widget: AiAvatarWidget) => void;
}

// Top-level / Root exports
export function initAvatarBot(rawOptions?: AvatarBotOptions): Promise<AiAvatarWidget | void>;
export function createAvatarBot(rawOptions?: AvatarBotOptions): Promise<AiAvatarWidget | void>;
export default initAvatarBot;

// Core constants
export const GENDER_MAP: Record<string, string>;
export const AVATAR_MODE_MAP: Record<string, string>;
export const ENGINE_MODE_MAP: Record<string, string>;
export const FIT_MODE_MAP: Record<string, string>;
export const STATE_MAP: Record<string, string>;
export const BRAIN_ENGINE_TYPE_MAP: Record<string, string>;
export const BRAIN_FALLBACK_TYPE_MAP: Record<string, string>;
export const AUTO_CONTINUE_MODE_MAP: Record<string, string>;
export const COMPRESSION_STRATEGY_MAP: Record<string, string>;
export const LLM_FINISH_REASON_MAP: Record<string, string>;
export const FINISH_REASON_MAP: Record<string, string>;
export const TOOL_CANCEL_REASON_MAP: Record<string, string>;
export const TOOL_RESULT_MODE_MAP: Record<string, string>;
export const TOOL_ROUTING_MODE_MAP: Record<string, string>;
export const TOOL_SCHEMA_FORMAT_MAP: Record<string, string>;
export const TOOL_SCHEMA_TYPE_MAP: Record<string, string>;
export const TOOL_EVENT_MAP: Record<string, string>;
export const SUPPORTED_LOCALES: string[];
export const LOCALE_LABELS: Record<string, string>;
export const DEFAULT_LOCALE: string;
export const DEFAULT_LLM_MODEL: string;
export const DEFAULT_AI_PROVIDER_MODEL: string;

// Sub-engine factories & helpers
export function initSkinEngine(setting?: SkinEngineOptions): SkinEngine;
export function createCanvas(container: HTMLElement): HTMLCanvasElement;
export function bootAvatar(skinEngine: SkinEngine, modelUrl?: string): Promise<any>;
export function bootVRM(skinEngine: SkinEngine, setting?: any): Promise<any>;
export function loadVRMFile(skinEngine: SkinEngine, file: File): Promise<void>;

export function initBrainEngine(options?: any): any;
export function initWebLLM(setting?: any, brain?: any): any;
export function initAiProvider(setting?: any, brain?: any): any;
export function initMemory(options?: any): any;
export function compressContext(params?: any): any;

export function initSpeechEngine(setting?: any): any;
export function initDefaultSTTEngine(setting?: any): any;
export function initDefaultTTSEngine(setting?: any): any;
export function splitSentences(text: string): string[];

export function initToolsEngine(setting?: any): any;
export function toOpenAiTools(tools: any[]): any[];
export function getAiAvailableTools(tools: any[]): any[];

export function initI18nEngine(options?: any): any;
export const defaultLocales: Record<string, any>;
