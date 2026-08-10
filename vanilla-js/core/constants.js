/**
 * 虛擬形象狀態映射表。
 * @readonly
 * @enum {string}
 */
export const STATE_MAP = {
  /** 閒置狀態 */
  IDLE: 'idle',
  /** 載入中狀態 */
  LOADING: 'loading',
  /** 準備就緒狀態 */
  READY: 'ready',
  /** 發生錯誤狀態 */
  ERROR: 'error'
};

/**
 * 虛擬形象角色模式映射表。
 * @readonly
 * @enum {string}
 */
export const AVATAR_MODE_MAP = {
  /** 陪伴模式 */
  companion: 'companion',
  /** 助理模式 */
  assistant: 'assistant'
};

/**
 * 預設虛擬形象模式。
 * @type {AVATAR_MODE_MAP}
 */
export const DEFAULT_AVATAR_MODE = AVATAR_MODE_MAP.assistant;

/**
 * 預設用於網頁端推論的 LLM 模型（例如 WebLLM）。
 * @type {string}
 */
export const DEFAULT_LLM_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

/**
 * 預設用於 API 提供者的 AI 模型（例如 Ollama）。
 * @type {string}
 */
export const DEFAULT_AI_PROVIDER_MODEL = 'qwen2.5:latest';

/**
 * 情緒目標值映射表。
 * @readonly
 * @enum {number}
 */
export const EMO_TARGET_MAP = {
  /** 快樂情緒的目標值 */
  happy: 0.65,
  /** 驚訝情緒的目標值 */
  surprised: 0.6,
  /** 悲傷情緒的目標值 */
  sad: 0.5
};

/**
 * 虛擬形象渲染引擎模式映射表。
 * @readonly
 * @enum {string}
 */
export const ENGINE_MODE_MAP = {
  /** 2D 渲染引擎模式 */
  twoDimensional: '2d',
  /** 3D 渲染引擎模式 */
  threeDimensional: '3d'
};

/**
 * 預設啟動的渲染引擎模式。
 * @type {ENGINE_MODE_MAP}
 */
export const DEFALUT_START_MODE = ENGINE_MODE_MAP.twoDimensional;

/**
 * 畫面顯示比例模式映射表。
 * @readonly
 * @enum {string}
 */
export const FIT_MODE_MAP = {
  /** 半身顯示模式 */
  HALF: 'half',
  /** 全身顯示模式 */
  FULL: 'full'
};

/**
 * 預設畫面顯示比例模式。
 * @type {FIT_MODE_MAP}
 */
export const DEFAULT_FIT_MODE = FIT_MODE_MAP.HALF;

/**
 * 性別選項映射表。
 * @readonly
 * @enum {string}
 */
export const GENDER_MAP = {
  /** 女性 */
  female: 'female',
  /** 男性 */
  male: 'male'
};

/**
 * 預設性別。
 * @type {GENDER_MAP}
 */
export const DEFAULT_GENDER = GENDER_MAP.female;

/**
 * 預設女性 2D Live2D 模型的 URL 路徑。
 * @type {string}
 */
export const DEFAULT_FEMALE_MODEL_URL =
  '/avatar-skin/2d-model/female/haru_greeter_t03.model3.json';

/**
 * 預設男性 2D Live2D 模型的 URL 路徑。
 * @type {string}
 */
export const DEFAULT_MALE_MODEL_URL =
  '/avatar-skin/2d-model/male/natori_pro_t06.model3.json';

/**
 * 預設語音合成 (TTS) API 終端節點。
 * @type {string}
 */
export const DEFAULT_TTS_ENDPOINT = 'api/tts';

/**
 * 預設女性神經語音 ID。（例如微軟神經語音「曉臻」）
 * @type {string}
 */
export const DEFAULT_FEMALE_NEURAL_VOICE = 'zh-TW-HsiaoChenNeural'; // 微軟神經語音「曉臻」

/**
 * 預設男性神經語音 ID。（例如微軟神經語音「雲哲」）
 * @type {string}
 */
export const DEFAULT_MALE_NEURAL_VOICE = 'zh-TW-YunJheNeural'; // 微軟神經語音「雲哲」
