/**
 * Avatar lifecycle state mapping enum.
 * @readonly
 * @enum {string}
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
};

/**
 * Avatar personality role mode mapping enum.
 * @readonly
 * @enum {string}
 */
export const AVATAR_MODE_MAP = {
  /** Companion mode preset bundle. */
  companion: 'companion',
  /** Assistant mode preset bundle. */
  assistant: 'assistant'
};

/**
 * Default avatar personality role mode.
 * @type {'companion'|'assistant'}
 */
export const DEFAULT_AVATAR_MODE = AVATAR_MODE_MAP.assistant;

/**
 * Default flag indicating whether conversation memory module is enabled.
 * @type {boolean}
 */
export const DEFAULT_ENABLE_MEMORY = true;

/**
 * Default maximum conversation history turns preserved (1 turn = 1 user message + 1 AI response).
 * @type {number}
 */
export const DEFAULT_MAX_HISTORY_TURNS = 6;

/**
 * Conversation context compression strategy mapping enum.
 * @readonly
 * @enum {string}
 */
export const COMPRESSION_STRATEGY_MAP = {
  /** Sliding window strategy (preserves most recent full dialogue turns within turn and character budget). */
  SLIDING_WINDOW: 'sliding-window',
  /** Rolling summary strategy (automatically summarizes earlier dialogues into system prompts in the background). */
  ROLLING_SUMMARY: 'rolling-summary',
  /** Pass-through mode (no compression, sends entire raw history). */
  NONE: 'none'
};

/**
 * Default conversation context compression strategy.
 * @type {'sliding-window'|'rolling-summary'|'none'}
 */
export const DEFAULT_COMPRESSION_STRATEGY =
  COMPRESSION_STRATEGY_MAP.SLIDING_WINDOW;

/**
 * Default global context total character budget limit.
 * @type {number}
 */
export const DEFAULT_MAX_TOTAL_CHARS = 4000;

/**
 * Default maximum conversation turns for in-browser WebLLM engine (conserves VRAM).
 * @type {number}
 */
export const DEFAULT_WEB_LLM_MAX_TURNS = 3;

/**
 * Default character budget limit for in-browser WebLLM engine.
 * @type {number}
 */
export const DEFAULT_WEB_LLM_MAX_CHARS = 1500;

/**
 * Default maximum conversation turns for cloud AI Provider engine.
 * @type {number}
 */
export const DEFAULT_AI_PROVIDER_MAX_TURNS = 8;

/**
 * Default character budget limit for cloud AI Provider engine.
 * @type {number}
 */
export const DEFAULT_AI_PROVIDER_MAX_CHARS = 6000;

/**
 * Default turn threshold to trigger rolling summary updates in the background.
 * @type {number}
 */
export const DEFAULT_SUMMARY_THRESHOLD_TURNS = 4;

/**
 * Default number of recent full dialogue turns kept intact in rolling summary mode.
 * @type {number}
 */
export const DEFAULT_SUMMARY_RECENT_TURNS = 2;

/**
 * Default maximum character length limit for generated rolling summary.
 * @type {number}
 */
export const DEFAULT_SUMMARY_MAX_CHARS = 1000;

/**
 * Default LocalStorage persistence key for conversation memory.
 * @type {string}
 */
export const DEFAULT_MEMORY_KEY = 'avatar-widget-memory';

/**
 * Current conversation memory schema version.
 * @type {number}
 */
export const CURRENT_MEMORY_VERSION = 1;

/**
 * Default in-browser LLM model identifier (WebLLM).
 * @type {string}
 */
export const DEFAULT_LLM_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

/**
 * Default AI Provider server model identifier (e.g. Ollama).
 * @type {string}
 */
export const DEFAULT_AI_PROVIDER_MODEL = 'qwen2.5:latest';

/**
 * Default maximum generated tokens for in-browser WebLLM engine.
 * @type {number}
 */
export const DEFAULT_LLM_MAX_TOKENS = 1024;

/**
 * Default maximum generated tokens for cloud AI Provider engine.
 * @type {number}
 */
export const DEFAULT_AI_PROVIDER_MAX_TOKENS = 2048;

/**
 * Default flag indicating whether auto-continuation is enabled when response is truncated by token limits.
 * @type {boolean}
 */
export const DEFAULT_ENABLE_AUTO_CONTINUE = false;

/**
 * Default maximum number of auto-continuation iterations per user turn.
 * @type {number}
 */
export const DEFAULT_MAX_AUTO_CONTINUATIONS = 3;

/**
 * Auto-continuation output delivery mode mapping enum.
 * @readonly
 * @enum {string}
 */
export const AUTO_CONTINUE_MODE_MAP = {
  /** Stream mode: plays TTS and displays text immediately, chaining continuation chunks seamlessly. */
  STREAM: 'stream',
  /** Buffered mode: waits for all continuation segments to complete before rendering audio and text. */
  BUFFERED: 'buffered'
};

/**
 * Default auto-continuation output delivery mode.
 * @type {'stream'|'buffered'}
 */
export const DEFAULT_AUTO_CONTINUE_MODE = AUTO_CONTINUE_MODE_MAP.STREAM;

/**
 * Emotion animation target value mapping enum.
 * @readonly
 * @enum {number}
 */
export const EMOTION_TARGET_MAP = {
  /** Target value for happy emotion. */
  happy: 0.65,
  /** Target value for surprised emotion. */
  surprised: 0.6,
  /** Target value for sad emotion. */
  sad: 0.5
};

/**
 * Emotion animation target value mapping enum (compatibility alias).
 * @deprecated Use EMOTION_TARGET_MAP instead.
 * @readonly
 * @enum {number}
 */
export const EMO_TARGET_MAP = EMOTION_TARGET_MAP;

/**
 * Avatar skin rendering engine mode mapping enum.
 * @readonly
 * @enum {string}
 */
export const ENGINE_MODE_MAP = {
  /** 2D Live2D rendering engine mode. */
  twoDimensional: '2d',
  /** 3D VRM rendering engine mode. */
  threeDimensional: '3d'
};

/**
 * Default initial skin rendering engine mode.
 * @type {'2d'|'3d'}
 */
export const DEFAULT_START_MODE = ENGINE_MODE_MAP.twoDimensional;

/**
 * Default root URL path for 3D VRMA animation files.
 * @type {string}
 */
export const DEFAULT_VRMA_ROOT_PATH = '/avatar-skin/3d-model/vrma/';

/**
 * Screen aspect framing fit mode mapping enum.
 * @readonly
 * @enum {string}
 */
export const FIT_MODE_MAP = {
  /** Half-body framing mode. */
  HALF: 'half',
  /** Full-body framing mode. */
  FULL: 'full'
};

/**
 * Default screen framing fit mode.
 * @type {'half'|'full'}
 */
export const DEFAULT_FIT_MODE = FIT_MODE_MAP.FULL;

/**
 * Default 2D Live2D zoom scale in half-body mode.
 * @type {number}
 */
export const DEFAULT_2D_HALF_ZOOM = 1.9;

/**
 * Default 2D Live2D zoom scale in full-body mode.
 * @type {number}
 */
export const DEFAULT_2D_FULL_ZOOM = 1.0;

/**
 * Default 2D Live2D zoom scale (linked to default fit mode).
 * @type {number}
 */
export const DEFAULT_2D_ZOOM =
  DEFAULT_FIT_MODE === FIT_MODE_MAP.HALF
    ? DEFAULT_2D_HALF_ZOOM
    : DEFAULT_2D_FULL_ZOOM;

/**
 * Default 2D Live2D horizontal offset pixels.
 * @type {number}
 */
export const DEFAULT_2D_OFFSET_X = 0;

/**
 * Default 2D Live2D vertical offset pixels.
 * @type {number}
 */
export const DEFAULT_2D_OFFSET_Y = 0;

/**
 * Default 2D Live2D model anchor coordinates in half-body mode.
 * @type {Readonly<{x: number, y: number}>}
 */
export const DEFAULT_2D_HALF_ANCHOR = Object.freeze({
  x: 0.5,
  y: 1.0
});

/**
 * Default 2D Live2D model anchor coordinates in full-body mode (y=3.0 reserves top dialogue bubble margin).
 * @type {Readonly<{x: number, y: number}>}
 */
export const DEFAULT_2D_FULL_ANCHOR = Object.freeze({
  x: 0.5,
  y: 3.0
});

/**
 * Default 2D Live2D model anchor coordinates (linked to default fit mode).
 * @type {Readonly<{x: number, y: number}>}
 */
export const DEFAULT_2D_ANCHOR =
  DEFAULT_FIT_MODE === FIT_MODE_MAP.HALF
    ? DEFAULT_2D_HALF_ANCHOR
    : DEFAULT_2D_FULL_ANCHOR;

/**
 * Default 3D VRM camera field of view (FOV) in half-body mode.
 * @type {number}
 */
export const DEFAULT_3D_HALF_CAMERA_FOV = 26;

/**
 * Default 3D VRM camera field of view (FOV) in full-body mode.
 * @type {number}
 */
export const DEFAULT_3D_FULL_CAMERA_FOV = 30;

/**
 * Default 3D VRM camera field of view (FOV) (linked to default fit mode).
 * @type {number}
 */
export const DEFAULT_3D_CAMERA_FOV =
  DEFAULT_FIT_MODE === FIT_MODE_MAP.HALF
    ? DEFAULT_3D_HALF_CAMERA_FOV
    : DEFAULT_3D_FULL_CAMERA_FOV;

/**
 * Default 3D VRM camera near clipping plane distance.
 * @type {number}
 */
export const DEFAULT_3D_CAMERA_NEAR = 0.1;

/**
 * Default 3D VRM camera far clipping plane distance.
 * @type {number}
 */
export const DEFAULT_3D_CAMERA_FAR = 20;

/**
 * Default 3D VRM camera world position in half-body mode.
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_HALF_CAMERA_POSITION = Object.freeze({
  x: 0,
  y: 1.4,
  z: 2.5
});

/**
 * Default 3D VRM camera world position in full-body mode.
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_FULL_CAMERA_POSITION = Object.freeze({
  x: 0,
  y: 1.0,
  z: 3.5
});

/**
 * Default 3D VRM camera world position (linked to default fit mode).
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_CAMERA_POSITION =
  DEFAULT_FIT_MODE === FIT_MODE_MAP.HALF
    ? DEFAULT_3D_HALF_CAMERA_POSITION
    : DEFAULT_3D_FULL_CAMERA_POSITION;

/**
 * Default 3D VRM camera target lookAt coordinates in half-body mode.
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_HALF_CAMERA_LOOK_AT = Object.freeze({
  x: 0,
  y: 1.2,
  z: 0
});

/**
 * Default 3D VRM camera target lookAt coordinates in full-body mode.
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_FULL_CAMERA_LOOK_AT = Object.freeze({
  x: 0,
  y: 0.9,
  z: 0
});

/**
 * Default 3D VRM camera target lookAt coordinates (linked to default fit mode).
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_CAMERA_LOOK_AT =
  DEFAULT_FIT_MODE === FIT_MODE_MAP.HALF
    ? DEFAULT_3D_HALF_CAMERA_LOOK_AT
    : DEFAULT_3D_FULL_CAMERA_LOOK_AT;

/**
 * Default 3D VRM model world position offset.
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_MODEL_POSITION = Object.freeze({
  x: 0,
  y: 0,
  z: 0
});

/**
 * Default 3D VRM model scale multipliers.
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_MODEL_SCALE = Object.freeze({
  x: 1,
  y: 1,
  z: 1
});

/**
 * Default 3D VRM model rotation angles (Euler radians).
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_MODEL_ROTATION = Object.freeze({
  x: 0,
  y: 3.1,
  z: 0
});

/**
 * Default flag indicating whether 3D VRM avatar eyes track the mouse pointer.
 * @type {boolean}
 */
export const DEFAULT_3D_POINTER_LOOK = true;

/**
 * Avatar gender character options mapping enum.
 * @readonly
 * @enum {string}
 */
export const GENDER_MAP = {
  /** Female character. */
  female: 'female',
  /** Male character. */
  male: 'male'
};

/**
 * Default character gender.
 * @type {'female'|'male'}
 */
export const DEFAULT_GENDER = GENDER_MAP.female;

/**
 * Default female 2D Live2D model descriptor URL.
 * @type {string}
 */
export const DEFAULT_FEMALE_2D_MODEL_URL =
  '/avatar-skin/2d-model/female/haru_greeter_t03.model3.json';

/**
 * Default male 2D Live2D model descriptor URL.
 * @type {string}
 */
export const DEFAULT_MALE_2D_MODEL_URL =
  '/avatar-skin/2d-model/male/natori_pro_t06.model3.json';

/**
 * Default 2D Live2D model descriptor URL (linked to default gender).
 * @type {string}
 */
export const DEFAULT_2D_MODEL_URL =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_2D_MODEL_URL
    : DEFAULT_MALE_2D_MODEL_URL;

/**
 * Default female 3D VRM model URL.
 * @type {string}
 */
export const DEFAULT_FEMALE_3D_MODEL_URL =
  '/avatar-skin/3d-model/HatsuneMiku.vrm';

/**
 * Default male 3D VRM model URL.
 * @type {string}
 */
export const DEFAULT_MALE_3D_MODEL_URL = '/avatar-skin/3d-model/RockmanEXE.vrm';

/**
 * Default 3D VRM model URL (linked to default gender).
 * @type {string}
 */
export const DEFAULT_3D_MODEL_URL =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_3D_MODEL_URL
    : DEFAULT_MALE_3D_MODEL_URL;

/**
 * Default 3D VRM model URL (compatibility alias).
 * @type {string}
 */
export const DEFAULT_VRM_URL = DEFAULT_3D_MODEL_URL;

/**
 * Default avatar model URL (linked to default start mode and gender).
 * @type {string}
 */
export const DEFAULT_MODEL_URL =
  DEFAULT_START_MODE === ENGINE_MODE_MAP.threeDimensional
    ? DEFAULT_3D_MODEL_URL
    : DEFAULT_2D_MODEL_URL;

/**
 * Default flag indicating whether dragging and dropping 3D VRM files onto canvas is enabled.
 * @type {boolean}
 */
export const DEFAULT_ENABLE_MODEL_DROP = false;

/**
 * Default flag indicating whether the 2D/3D engine switch button is displayed when both models exist.
 * @type {boolean}
 */
export const DEFAULT_ENABLE_ENGINE_TOGGLE = true;

/**
 * Default Text-to-Speech (TTS) API endpoint path.
 * @type {string}
 */
export const DEFAULT_TTS_ENDPOINT = 'api/tts';

/**
 * Default female neural voice identifier.
 * @type {string}
 */
export const DEFAULT_FEMALE_NEURAL_VOICE = 'zh-TW-HsiaoChenNeural';

/**
 * Default male neural voice identifier.
 * @type {string}
 */
export const DEFAULT_MALE_NEURAL_VOICE = 'zh-TW-YunJheNeural';

/**
 * Default neural voice identifier (linked to default gender).
 * @type {string}
 */
export const DEFAULT_NEURAL_VOICE =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_NEURAL_VOICE
    : DEFAULT_MALE_NEURAL_VOICE;

/**
 * Retrieves default neural voice identifier based on gender.
 * @param {string} [gender=DEFAULT_GENDER] - Character gender ('female' | 'male').
 * @returns {string} Neural voice identifier.
 */
export function getDefaultNeuralVoice(gender = DEFAULT_GENDER) {
  return gender === GENDER_MAP.female
    ? DEFAULT_FEMALE_NEURAL_VOICE
    : DEFAULT_MALE_NEURAL_VOICE;
}

/**
 * Retrieves default 2D Live2D model URL based on gender.
 * @param {string} [gender=DEFAULT_GENDER] - Character gender ('female' | 'male').
 * @returns {string} 2D model descriptor URL.
 */
export function getDefault2DModelUrl(gender = DEFAULT_GENDER) {
  return gender === GENDER_MAP.female
    ? DEFAULT_FEMALE_2D_MODEL_URL
    : DEFAULT_MALE_2D_MODEL_URL;
}

/**
 * Retrieves default 3D VRM model URL based on gender.
 * @param {string} [gender=DEFAULT_GENDER] - Character gender ('female' | 'male').
 * @returns {string} 3D model URL.
 */
export function getDefault3DModelUrl(gender = DEFAULT_GENDER) {
  return gender === GENDER_MAP.female
    ? DEFAULT_FEMALE_3D_MODEL_URL
    : DEFAULT_MALE_3D_MODEL_URL;
}

/**
 * Retrieves default model URL based on gender and engine mode.
 * @param {string} [gender=DEFAULT_GENDER] - Character gender ('female' | 'male').
 * @param {string} [engineMode=DEFAULT_START_MODE] - Engine mode ('2d' | '3d').
 * @returns {string} Model URL.
 */
export function getDefaultModelUrl(
  gender = DEFAULT_GENDER,
  engineMode = DEFAULT_START_MODE
) {
  if (engineMode === ENGINE_MODE_MAP.threeDimensional) {
    return getDefault3DModelUrl(gender);
  }
  return getDefault2DModelUrl(gender);
}

/**
 * Retrieves default 2D Live2D transform configuration based on fit mode.
 * @param {string} [fitMode=DEFAULT_FIT_MODE] - Screen framing fit mode ('half' | 'full').
 * @returns {{zoom: number, offsetX: number, offsetY: number, anchor: Readonly<{x: number, y: number}>}} Default 2D transform configuration object.
 */
export function getDefault2DConfig(fitMode = DEFAULT_FIT_MODE) {
  const isHalf = fitMode === FIT_MODE_MAP.HALF;
  return {
    zoom: isHalf === true ? DEFAULT_2D_HALF_ZOOM : DEFAULT_2D_FULL_ZOOM,
    offsetX: DEFAULT_2D_OFFSET_X,
    offsetY: DEFAULT_2D_OFFSET_Y,
    anchor: isHalf === true ? DEFAULT_2D_HALF_ANCHOR : DEFAULT_2D_FULL_ANCHOR
  };
}

/**
 * Retrieves default 3D VRM camera configuration based on fit mode.
 * @param {string} [fitMode=DEFAULT_FIT_MODE] - Screen framing fit mode ('half' | 'full').
 * @returns {{fov: number, near: number, far: number, position: Readonly<{x: number, y: number, z: number}>, lookAt: Readonly<{x: number, y: number, z: number}>}} Default 3D camera configuration object.
 */
export function getDefault3DCameraConfig(fitMode = DEFAULT_FIT_MODE) {
  const isHalf = fitMode === FIT_MODE_MAP.HALF;
  return {
    fov:
      isHalf === true
        ? DEFAULT_3D_HALF_CAMERA_FOV
        : DEFAULT_3D_FULL_CAMERA_FOV,
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
 * @readonly
 * @enum {string}
 */
export const TOOL_ROUTING_MODE_MAP = {
  /** Client-side rule matcher (0 Token overhead, < 1ms response). */
  CLIENT: 'client',
  /** AI LLM semantic decision (via Function Calling). */
  AI: 'ai',
  /** Dual-track hybrid mode (client rules hit high-confidence patterns, falls back to AI). */
  HYBRID: 'hybrid'
};

/**
 * Default tool routing decision mode.
 * @type {string}
 */
export const DEFAULT_TOOL_ROUTING_MODE = TOOL_ROUTING_MODE_MAP.HYBRID;

/**
 * Tool execution result handling mode mapping enum.
 * @readonly
 * @enum {string}
 */
export const TOOL_RESULT_MODE_MAP = {
  /** Sends tool execution result back to LLM for natural language summarization. */
  AI_SUMMARY: 'ai_summary',
  /** Directly outputs and displays tool result message without second LLM call. */
  DIRECT: 'direct'
};

/**
 * Default tool result handling mode.
 * @type {string}
 */
export const DEFAULT_TOOL_RESULT_MODE = TOOL_RESULT_MODE_MAP.AI_SUMMARY;

/**
 * Default tool confirmation timeout in milliseconds (60 seconds).
 * @type {number}
 */
export const DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS = 60000;

/**
 * Tool cancellation and expiry reason mapping enum.
 * @readonly
 * @enum {string}
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
};

/**
 * Tool lifecycle event names mapping enum.
 * @readonly
 * @enum {string}
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
};

/**
 * Tool Schema supported property types mapping enum.
 * @readonly
 * @enum {string}
 */
export const TOOL_SCHEMA_TYPE_MAP = {
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  OBJECT: 'object'
};

/**
 * Tool Schema supported format validations mapping enum.
 * @readonly
 * @enum {string}
 */
export const TOOL_SCHEMA_FORMAT_MAP = {
  EMAIL: 'email',
  URL: 'url',
  PHONE: 'phone',
  CONTACT: 'contact'
};

/**
 * Chat message role mapping enum.
 * @readonly
 * @enum {string}
 */
export const CHAT_ROLE_MAP = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool'
};

/**
 * Chat message source mapping enum.
 * @readonly
 * @enum {string}
 */
export const CHAT_SOURCE_MAP = {
  TOOL: 'tool',
  AI: 'ai',
  SYSTEM: 'system'
};

/**
 * LLM inference finish reason mapping enum (OpenAI / WebLLM standard).
 * @readonly
 * @enum {string}
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
};

/**
 * LLM inference finish reason mapping enum (compatibility alias).
 * @readonly
 * @enum {string}
 */
export const FINISH_REASON_MAP = LLM_FINISH_REASON_MAP;

/**
 * Brain inference and fallback engine type mapping enum.
 * @readonly
 * @enum {string}
 */
export const BRAIN_ENGINE_TYPE_MAP = {
  /** Remote AI server provider (e.g. Ollama, vLLM, OpenAI-compatible API). */
  AI_PROVIDER: 'aiProvider',
  /** In-browser WebLLM engine (WebGPU local inference). */
  WEB_LLM: 'webLLM',
  /** Local knowledge base retrieval fallback (Bigram keyword matching). */
  RETRIEVAL: 'retrieval'
};

/**
 * Brain fallback engine type mapping enum (alias).
 * @readonly
 * @enum {string}
 */
export const BRAIN_FALLBACK_TYPE_MAP = BRAIN_ENGINE_TYPE_MAP;

/**
 * Checks whether a given WebLLM model supports native Function Calling (tools).
 * WebLLM officially supports Function Calling primarily on Hermes series models.
 * @param {string} model - Model identifier name.
 * @returns {boolean} Whether model supports Function Calling.
 */
export function isWebLLMFunctionCallingSupported(model) {
  if (typeof model !== 'string' || model === '') {
    return false;
  }
  return /hermes/i.test(model);
}

/**
 * Default list of supported avatar emotions and gestures.
 * @type {string[]}
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
];

/**
 * Default emotion dispatcher tool name.
 * @type {string}
 */
export const DEFAULT_EMOTION_TOOL_NAME = 'express_emotion';

