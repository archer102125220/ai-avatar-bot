/**
 * Avatar lifecycle state mapping enum.
 */
export const STATE_MAP = {
  /** Idle state. */
  IDLE: 'idle',
  /** Loading state. */
  LOADING: 'loading',
  /** Ready state. */
  READY: 'ready',
  /** Error state. */
  ERROR: 'error'
} as const;

export type AvatarState = (typeof STATE_MAP)[keyof typeof STATE_MAP];

/**
 * Avatar personality role mode mapping enum.
 */
export const AVATAR_MODE_MAP = {
  /** Companion mode preset bundle. */
  companion: 'companion',
  /** Assistant mode preset bundle. */
  assistant: 'assistant'
} as const;

export type AvatarMode = (typeof AVATAR_MODE_MAP)[keyof typeof AVATAR_MODE_MAP];

/**
 * Default avatar personality role mode.
 */
export const DEFAULT_AVATAR_MODE: AvatarMode = AVATAR_MODE_MAP.assistant;

/**
 * Default flag indicating whether conversation memory module is enabled.
 */
export const DEFAULT_ENABLE_MEMORY = true;

/**
 * Default maximum conversation history turns preserved (1 turn = 1 user message + 1 AI response).
 */
export const DEFAULT_MAX_HISTORY_TURNS = 6;

/**
 * Conversation context compression strategy mapping enum.
 */
export const COMPRESSION_STRATEGY_MAP = {
  /** Sliding window strategy (preserves most recent full dialogue turns within turn and character budget). */
  SLIDING_WINDOW: 'sliding-window',
  /** Rolling summary strategy (automatically summarizes earlier dialogues into system prompts in the background). */
  ROLLING_SUMMARY: 'rolling-summary',
  /** Pass-through mode (no compression, sends entire raw history). */
  NONE: 'none'
} as const;

export type CompressionStrategy =
  (typeof COMPRESSION_STRATEGY_MAP)[keyof typeof COMPRESSION_STRATEGY_MAP];

/**
 * Default conversation context compression strategy.
 */
export const DEFAULT_COMPRESSION_STRATEGY: CompressionStrategy =
  COMPRESSION_STRATEGY_MAP.SLIDING_WINDOW;

/**
 * Default global context total character budget limit.
 */
export const DEFAULT_MAX_TOTAL_CHARS = 4000;

/**
 * Default maximum conversation turns for in-browser WebLLM engine (conserves VRAM).
 */
export const DEFAULT_WEB_LLM_MAX_TURNS = 3;

/**
 * Default character budget limit for in-browser WebLLM engine.
 */
export const DEFAULT_WEB_LLM_MAX_CHARS = 1500;

/**
 * Default maximum conversation turns for cloud AI Provider engine.
 */
export const DEFAULT_AI_PROVIDER_MAX_TURNS = 8;

/**
 * Default character budget limit for cloud AI Provider engine.
 */
export const DEFAULT_AI_PROVIDER_MAX_CHARS = 6000;

/**
 * Default turn threshold to trigger rolling summary updates in the background.
 */
export const DEFAULT_SUMMARY_THRESHOLD_TURNS = 4;

/**
 * Default number of recent full dialogue turns kept intact in rolling summary mode.
 */
export const DEFAULT_SUMMARY_RECENT_TURNS = 2;

/**
 * Default maximum character length limit for generated rolling summary.
 */
export const DEFAULT_SUMMARY_MAX_CHARS = 1000;

/**
 * Default LocalStorage persistence key for conversation memory.
 */
export const DEFAULT_MEMORY_KEY = 'avatar-widget-memory';

/**
 * Current conversation memory schema version.
 */
export const CURRENT_MEMORY_VERSION = 1;

/**
 * Default in-browser LLM model identifier (WebLLM).
 */
export const DEFAULT_LLM_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

/**
 * Default AI Provider server model identifier (e.g. Ollama).
 */
export const DEFAULT_AI_PROVIDER_MODEL = 'qwen2.5:latest';

/**
 * Default maximum generated tokens for in-browser WebLLM engine.
 */
export const DEFAULT_LLM_MAX_TOKENS = 1024;

/**
 * Default maximum generated tokens for cloud AI Provider engine.
 */
export const DEFAULT_AI_PROVIDER_MAX_TOKENS = 2048;

/**
 * Default flag indicating whether auto-continuation is enabled when response is truncated by token limits.
 */
export const DEFAULT_ENABLE_AUTO_CONTINUE = false;

/**
 * Default maximum number of auto-continuation iterations per user turn.
 */
export const DEFAULT_MAX_AUTO_CONTINUATIONS = 3;

/**
 * Auto-continuation output delivery mode mapping enum.
 */
export const AUTO_CONTINUE_MODE_MAP = {
  /** Stream mode: plays TTS and displays text immediately, chaining continuation chunks seamlessly. */
  STREAM: 'stream',
  /** Buffered mode: waits for all continuation segments to complete before rendering audio and text. */
  BUFFERED: 'buffered'
} as const;

export type AutoContinueMode =
  (typeof AUTO_CONTINUE_MODE_MAP)[keyof typeof AUTO_CONTINUE_MODE_MAP];

/**
 * Default auto-continuation output delivery mode.
 */
export const DEFAULT_AUTO_CONTINUE_MODE: AutoContinueMode =
  AUTO_CONTINUE_MODE_MAP.STREAM;

/**
 * Emotion animation target value mapping enum.
 */
export const EMOTION_TARGET_MAP = {
  /** Target value for happy emotion. */
  happy: 0.65,
  /** Target value for surprised emotion. */
  surprised: 0.6,
  /** Target value for sad emotion. */
  sad: 0.5
} as const;

/**
 * Emotion animation target value mapping enum (compatibility alias).
 * @deprecated Use EMOTION_TARGET_MAP instead.
 */
export const EMO_TARGET_MAP = EMOTION_TARGET_MAP;

/**
 * Avatar skin rendering engine mode mapping enum.
 */
export const ENGINE_MODE_MAP = {
  /** 2D Live2D rendering engine mode. */
  twoDimensional: '2d',
  /** 3D VRM rendering engine mode. */
  threeDimensional: '3d'
} as const;

export type EngineMode = (typeof ENGINE_MODE_MAP)[keyof typeof ENGINE_MODE_MAP];

/**
 * Default initial skin rendering engine mode.
 */
export const DEFAULT_START_MODE: EngineMode = ENGINE_MODE_MAP.twoDimensional;

/**
 * Default root URL path for 3D VRMA animation files.
 */
export const DEFAULT_VRMA_ROOT_PATH = '/avatar-skin/3d-model/vrma/';

/**
 * Screen aspect framing fit mode mapping enum.
 */
export const FIT_MODE_MAP = {
  /** Half-body framing mode. */
  HALF: 'half',
  /** Full-body framing mode. */
  FULL: 'full'
} as const;

export type FitMode = (typeof FIT_MODE_MAP)[keyof typeof FIT_MODE_MAP];

/**
 * Default screen framing fit mode.
 */
export const DEFAULT_FIT_MODE: FitMode = FIT_MODE_MAP.FULL;

/**
 * Default 2D Live2D zoom scale in half-body mode.
 */
export const DEFAULT_2D_HALF_ZOOM = 1.9;

/**
 * Default 2D Live2D zoom scale in full-body mode.
 */
export const DEFAULT_2D_FULL_ZOOM = 1.0;

/**
 * Default 2D Live2D zoom scale (linked to default fit mode).
 */
export const DEFAULT_2D_ZOOM: number = DEFAULT_2D_FULL_ZOOM;

/**
 * Default 2D Live2D horizontal offset pixels.
 */
export const DEFAULT_2D_OFFSET_X = 0;

/**
 * Default 2D Live2D vertical offset pixels.
 */
export const DEFAULT_2D_OFFSET_Y = 0;

/**
 * Default 2D Live2D model anchor coordinates in half-body mode.
 */
export const DEFAULT_2D_HALF_ANCHOR = Object.freeze({
  x: 0.5,
  y: 1.0
});

/**
 * Default 2D Live2D model anchor coordinates in full-body mode (y=3.0 reserves top dialogue bubble margin).
 */
export const DEFAULT_2D_FULL_ANCHOR = Object.freeze({
  x: 0.5,
  y: 3.0
});

/**
 * Default 2D Live2D model anchor coordinates (linked to default fit mode).
 */
export const DEFAULT_2D_ANCHOR: Readonly<{ x: number; y: number }> =
  DEFAULT_2D_FULL_ANCHOR;

/**
 * Default 3D VRM camera field of view (FOV) in half-body mode.
 */
export const DEFAULT_3D_HALF_CAMERA_FOV = 26;

/**
 * Default 3D VRM camera field of view (FOV) in full-body mode.
 */
export const DEFAULT_3D_FULL_CAMERA_FOV = 30;

/**
 * Default 3D VRM camera field of view (FOV) (linked to default fit mode).
 */
export const DEFAULT_3D_CAMERA_FOV: number = DEFAULT_3D_FULL_CAMERA_FOV;

/**
 * Default 3D VRM camera near clipping plane distance.
 */
export const DEFAULT_3D_CAMERA_NEAR = 0.1;

/**
 * Default 3D VRM camera far clipping plane distance.
 */
export const DEFAULT_3D_CAMERA_FAR = 20;

/**
 * Default 3D VRM camera world position in half-body mode.
 */
export const DEFAULT_3D_HALF_CAMERA_POSITION = Object.freeze({
  x: 0,
  y: 1.4,
  z: 2.5
});

/**
 * Default 3D VRM camera world position in full-body mode.
 */
export const DEFAULT_3D_FULL_CAMERA_POSITION = Object.freeze({
  x: 0,
  y: 1.0,
  z: 3.5
});

/**
 * Default 3D VRM camera world position (linked to default fit mode).
 */
export const DEFAULT_3D_CAMERA_POSITION: Readonly<{
  x: number;
  y: number;
  z: number;
}> = DEFAULT_3D_FULL_CAMERA_POSITION;

/**
 * Default 3D VRM camera target lookAt coordinates in half-body mode.
 */
export const DEFAULT_3D_HALF_CAMERA_LOOK_AT = Object.freeze({
  x: 0,
  y: 1.2,
  z: 0
});

/**
 * Default 3D VRM camera target lookAt coordinates in full-body mode.
 */
export const DEFAULT_3D_FULL_CAMERA_LOOK_AT = Object.freeze({
  x: 0,
  y: 0.9,
  z: 0
});

/**
 * Default 3D VRM camera target lookAt coordinates (linked to default fit mode).
 */
export const DEFAULT_3D_CAMERA_LOOK_AT: Readonly<{
  x: number;
  y: number;
  z: number;
}> = DEFAULT_3D_FULL_CAMERA_LOOK_AT;

/**
 * Default 3D VRM model world position offset.
 */
export const DEFAULT_3D_MODEL_POSITION = Object.freeze({
  x: 0,
  y: 0,
  z: 0
});

/**
 * Default 3D VRM model scale multipliers.
 */
export const DEFAULT_3D_MODEL_SCALE = Object.freeze({
  x: 1,
  y: 1,
  z: 1
});

/**
 * Default 3D VRM model rotation angles (Euler radians).
 */
export const DEFAULT_3D_MODEL_ROTATION = Object.freeze({
  x: 0,
  y: 3.1,
  z: 0
});

/**
 * Default flag indicating whether 3D VRM avatar eyes track the mouse pointer.
 */
export const DEFAULT_3D_POINTER_LOOK = true;

/**
 * Avatar gender character options mapping enum.
 */
export const GENDER_MAP = {
  /** Female character. */
  female: 'female',
  /** Male character. */
  male: 'male'
} as const;

export type Gender = (typeof GENDER_MAP)[keyof typeof GENDER_MAP];

/**
 * Default character gender.
 */
export const DEFAULT_GENDER: Gender = GENDER_MAP.female;

/**
 * Default female 2D Live2D model descriptor URL.
 */
export const DEFAULT_FEMALE_2D_MODEL_URL =
  '/avatar-skin/2d-model/female/haru_greeter_t03.model3.json';

/**
 * Default male 2D Live2D model descriptor URL.
 */
export const DEFAULT_MALE_2D_MODEL_URL =
  '/avatar-skin/2d-model/male/natori_pro_t06.model3.json';

/**
 * Default 2D Live2D model descriptor URL (linked to default gender).
 */
export const DEFAULT_2D_MODEL_URL: string =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_2D_MODEL_URL
    : DEFAULT_MALE_2D_MODEL_URL;

/**
 * Default female 3D VRM model URL.
 */
export const DEFAULT_FEMALE_3D_MODEL_URL =
  '/avatar-skin/3d-model/HatsuneMiku.vrm';

/**
 * Default male 3D VRM model URL.
 */
export const DEFAULT_MALE_3D_MODEL_URL = '/avatar-skin/3d-model/RockmanEXE.vrm';

/**
 * Default 3D VRM model URL (linked to default gender).
 */
export const DEFAULT_3D_MODEL_URL: string =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_3D_MODEL_URL
    : DEFAULT_MALE_3D_MODEL_URL;

/**
 * Default 3D VRM model URL (compatibility alias).
 */
export const DEFAULT_VRM_URL = DEFAULT_3D_MODEL_URL;

/**
 * Default avatar model URL (linked to default start mode and gender).
 */
export const DEFAULT_MODEL_URL: string = DEFAULT_2D_MODEL_URL;

/**
 * Default flag indicating whether dragging and dropping 3D VRM files onto canvas is enabled.
 */
export const DEFAULT_ENABLE_MODEL_DROP = false;

/**
 * Default flag indicating whether the 2D/3D engine switch button is displayed when both models exist.
 */
export const DEFAULT_ENABLE_ENGINE_TOGGLE = true;

/**
 * Default Text-to-Speech (TTS) API endpoint path.
 */
export const DEFAULT_TTS_ENDPOINT = 'api/tts';

/**
 * Default female neural voice identifier.
 */
export const DEFAULT_FEMALE_NEURAL_VOICE = 'zh-TW-HsiaoChenNeural';

/**
 * Default male neural voice identifier.
 */
export const DEFAULT_MALE_NEURAL_VOICE = 'zh-TW-YunJheNeural';

/**
 * Default neural voice identifier (linked to default gender).
 */
export const DEFAULT_NEURAL_VOICE: string =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_NEURAL_VOICE
    : DEFAULT_MALE_NEURAL_VOICE;

/**
 * Retrieves default neural voice identifier based on gender.
 * @param gender - Character gender ('female' | 'male').
 * @returns Neural voice identifier.
 */
export function getDefaultNeuralVoice(gender: string = DEFAULT_GENDER): string {
  return gender === GENDER_MAP.female
    ? DEFAULT_FEMALE_NEURAL_VOICE
    : DEFAULT_MALE_NEURAL_VOICE;
}

/**
 * Retrieves default 2D Live2D model URL based on gender.
 * @param gender - Character gender ('female' | 'male').
 * @returns 2D model descriptor URL.
 */
export function getDefault2DModelUrl(gender: string = DEFAULT_GENDER): string {
  return gender === GENDER_MAP.female
    ? DEFAULT_FEMALE_2D_MODEL_URL
    : DEFAULT_MALE_2D_MODEL_URL;
}

/**
 * Retrieves default 3D VRM model URL based on gender.
 * @param gender - Character gender ('female' | 'male').
 * @returns 3D model URL.
 */
export function getDefault3DModelUrl(gender: string = DEFAULT_GENDER): string {
  return gender === GENDER_MAP.female
    ? DEFAULT_FEMALE_3D_MODEL_URL
    : DEFAULT_MALE_3D_MODEL_URL;
}

/**
 * Retrieves default model URL based on gender and engine mode.
 * @param gender - Character gender ('female' | 'male').
 * @param engineMode - Engine mode ('2d' | '3d').
 * @returns Model URL.
 */
export function getDefaultModelUrl(
  gender: string = DEFAULT_GENDER,
  engineMode: string = DEFAULT_START_MODE
): string {
  if (engineMode === ENGINE_MODE_MAP.threeDimensional) {
    return getDefault3DModelUrl(gender);
  }
  return getDefault2DModelUrl(gender);
}

/**
 * 2D Live2D transform configuration interface.
 */
export interface Default2DConfig {
  zoom: number;
  offsetX: number;
  offsetY: number;
  anchor: Readonly<{ x: number; y: number }>;
}

/**
 * Retrieves default 2D Live2D transform configuration based on fit mode.
 * @param fitMode - Screen framing fit mode ('half' | 'full').
 * @returns Default 2D transform configuration object.
 */
export function getDefault2DConfig(
  fitMode: string = DEFAULT_FIT_MODE
): Default2DConfig {
  const isHalf = fitMode === FIT_MODE_MAP.HALF;
  return {
    zoom: isHalf === true ? DEFAULT_2D_HALF_ZOOM : DEFAULT_2D_FULL_ZOOM,
    offsetX: DEFAULT_2D_OFFSET_X,
    offsetY: DEFAULT_2D_OFFSET_Y,
    anchor: isHalf === true ? DEFAULT_2D_HALF_ANCHOR : DEFAULT_2D_FULL_ANCHOR
  };
}

/**
 * 3D VRM camera configuration interface.
 */
export interface Default3DCameraConfig {
  fov: number;
  near: number;
  far: number;
  position: Readonly<{ x: number; y: number; z: number }>;
  lookAt: Readonly<{ x: number; y: number; z: number }>;
}

/**
 * Retrieves default 3D VRM camera configuration based on fit mode.
 * @param fitMode - Screen framing fit mode ('half' | 'full').
 * @returns Default 3D camera configuration object.
 */
export function getDefault3DCameraConfig(
  fitMode: string = DEFAULT_FIT_MODE
): Default3DCameraConfig {
  const isHalf = fitMode === FIT_MODE_MAP.HALF;
  return {
    fov:
      isHalf === true ? DEFAULT_3D_HALF_CAMERA_FOV : DEFAULT_3D_FULL_CAMERA_FOV,
    near: DEFAULT_3D_CAMERA_NEAR,
    far: DEFAULT_3D_CAMERA_FAR,
    position:
      isHalf === true
        ? DEFAULT_3D_HALF_CAMERA_POSITION
        : DEFAULT_3D_FULL_CAMERA_POSITION,
    lookAt:
      isHalf === true
        ? DEFAULT_3D_HALF_CAMERA_LOOK_AT
        : DEFAULT_3D_FULL_CAMERA_LOOK_AT
  };
}

/**
 * Tool routing decision mode mapping enum.
 */
export const TOOL_ROUTING_MODE_MAP = {
  /** Client-side rule matcher (0 Token overhead, < 1ms response). */
  CLIENT: 'client',
  /** AI LLM semantic decision (via Function Calling). */
  AI: 'ai',
  /** Dual-track hybrid mode (client rules hit high-confidence patterns, falls back to AI). */
  HYBRID: 'hybrid'
} as const;

export type ToolRoutingMode =
  (typeof TOOL_ROUTING_MODE_MAP)[keyof typeof TOOL_ROUTING_MODE_MAP];

/**
 * Default tool routing decision mode.
 */
export const DEFAULT_TOOL_ROUTING_MODE: ToolRoutingMode =
  TOOL_ROUTING_MODE_MAP.HYBRID;

/**
 * Tool execution result handling mode mapping enum.
 */
export const TOOL_RESULT_MODE_MAP = {
  /** Sends tool execution result back to LLM for natural language summarization. */
  AI_SUMMARY: 'ai_summary',
  /** Directly outputs and displays tool result message without second LLM call. */
  DIRECT: 'direct'
} as const;

export type ToolResultMode =
  (typeof TOOL_RESULT_MODE_MAP)[keyof typeof TOOL_RESULT_MODE_MAP];

/**
 * Default tool result handling mode.
 */
export const DEFAULT_TOOL_RESULT_MODE: ToolResultMode =
  TOOL_RESULT_MODE_MAP.AI_SUMMARY;

/**
 * Default tool confirmation timeout in milliseconds (60 seconds).
 */
export const DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS = 60000;

/**
 * Tool cancellation and expiry reason mapping enum.
 */
export const TOOL_CANCEL_REASON_MAP = {
  /** User explicitly cancelled action (via cancel button or voice/text cancel). */
  USER_CANCEL: 'user_cancel',
  /** Confirmation timed out without response. */
  TIMEOUT: 'timeout',
  /** User sent new input message, cancelling previous unconfirmed action. */
  NEW_INPUT: 'new_input',
  /** User declined consent or terms. */
  CONSENT_DECLINED: 'consent_declined'
} as const;

export type ToolCancelReason =
  (typeof TOOL_CANCEL_REASON_MAP)[keyof typeof TOOL_CANCEL_REASON_MAP];

/**
 * Tool lifecycle event names mapping enum.
 */
export const TOOL_EVENT_MAP = {
  /** Tool execution offer event. */
  OFFER: 'tool_offer',
  /** Additional user input required event. */
  INPUT_REQUIRED: 'tool_input_required',
  /** Tool ambiguity resolution event. */
  AMBIGUOUS: 'tool_ambiguous',
  /** Tool execution confirmed event. */
  CONFIRM: 'tool_confirm',
  /** Tool execution cancelled event. */
  CANCEL: 'tool_cancel',
  /** Tool execution started event. */
  EXECUTE: 'tool_execute',
  /** Tool execution result event. */
  RESULT: 'tool_result'
} as const;

/**
 * Tool Schema supported property types mapping enum.
 */
export const TOOL_SCHEMA_TYPE_MAP = {
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  OBJECT: 'object'
} as const;

/**
 * Tool Schema supported format validations mapping enum.
 */
export const TOOL_SCHEMA_FORMAT_MAP = {
  EMAIL: 'email',
  URL: 'url',
  PHONE: 'phone',
  CONTACT: 'contact'
} as const;

/**
 * Chat message role mapping enum.
 */
export const CHAT_ROLE_MAP = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool'
} as const;

export type ChatRole = (typeof CHAT_ROLE_MAP)[keyof typeof CHAT_ROLE_MAP];

/**
 * Chat message source mapping enum.
 */
export const CHAT_SOURCE_MAP = {
  TOOL: 'tool',
  AI: 'ai',
  SYSTEM: 'system'
} as const;

export type ChatSource = (typeof CHAT_SOURCE_MAP)[keyof typeof CHAT_SOURCE_MAP];

/**
 * LLM inference finish reason mapping enum (OpenAI / WebLLM standard).
 */
export const LLM_FINISH_REASON_MAP = {
  /** Normal completion or stop token reached. */
  STOP: 'stop',
  /** Truncated due to max_tokens limit (triggers auto-continuation). */
  LENGTH: 'length',
  /** Triggered external tool/function calling. */
  TOOL_CALLS: 'tool_calls',
  /** Triggered content safety filter. */
  CONTENT_FILTER: 'content_filter'
} as const;

export type LlmFinishReason =
  (typeof LLM_FINISH_REASON_MAP)[keyof typeof LLM_FINISH_REASON_MAP];

/**
 * LLM inference finish reason mapping enum (compatibility alias).
 */
export const FINISH_REASON_MAP = LLM_FINISH_REASON_MAP;

/**
 * Brain inference and fallback engine type mapping enum.
 */
export const BRAIN_ENGINE_TYPE_MAP = {
  /** Remote AI server provider (e.g. Ollama, vLLM, OpenAI-compatible API). */
  AI_PROVIDER: 'aiProvider',
  /** In-browser WebLLM engine (WebGPU local inference). */
  WEB_LLM: 'webLLM',
  /** Local knowledge base retrieval fallback (Bigram keyword matching). */
  RETRIEVAL: 'retrieval'
} as const;

export type BrainEngineType =
  (typeof BRAIN_ENGINE_TYPE_MAP)[keyof typeof BRAIN_ENGINE_TYPE_MAP];

/**
 * Brain fallback engine type mapping enum (alias).
 */
export const BRAIN_FALLBACK_TYPE_MAP = BRAIN_ENGINE_TYPE_MAP;

/**
 * Checks whether a given WebLLM model supports native Function Calling (tools).
 * WebLLM officially supports Function Calling primarily on Hermes series models.
 * @param model - Model identifier name.
 * @returns Whether model supports Function Calling.
 */
export function isWebLLMFunctionCallingSupported(model?: string): boolean {
  if (typeof model !== 'string' || model === '') {
    return false;
  }
  return /hermes/i.test(model);
}

/**
 * Default list of supported avatar emotions and gestures.
 */
export const DEFAULT_SUPPORTED_EMOTIONS = [
  'happy',
  'surprised',
  'sad',
  'thinking',
  'neutral',
  'wave',
  'bow',
  'relax'
] as const;

/**
 * Default emotion dispatcher tool name.
 */
export const DEFAULT_EMOTION_TOOL_NAME = 'express_emotion';
