/**
 * Type definitions for ai-avatar-bot-vanilla-js
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
  showMinimalEl: () => void;
  hiddenMinimalEl: () => void;
  readonly brainEngine: any;
  readonly speechEngine: any;
  readonly skinEngine: any;
  setSkin2d: (config: Partial<Skin2DConfig>) => void;
  setSkin3d: (config: Partial<Skin3DConfig>) => void;
  setFitMode: (fitMode: string) => void;
  onReady?: (widget: AiAvatarWidget) => void;
  onMinimalTrigger?: (isMinimal: boolean, widget: AiAvatarWidget) => void;
  onError?: (error: Error, widget: AiAvatarWidget) => void;
}

export function initAvatarBot(rawOptions?: AvatarBotOptions): Promise<AiAvatarWidget | void>;
export function createAvatarBot(rawOptions?: AvatarBotOptions): Promise<AiAvatarWidget | void>;

export default initAvatarBot;

export * from './core/constants';
export * from './core/i18n';
export * from './core/brain';
export * from './core/speech';
export * from './core/skin';
export * from './core/tools';
export * from './core/plugins';
export * from './core/orchestrator';
