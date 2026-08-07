/**
 * @typedef {Object} StateMap
 * @property {'idle'} IDLE - 閒置狀態
 * @property {'loading'} LOADING - 載入中狀態
 * @property {'ready'} READY - 準備就緒狀態
 * @property {'error'} ERROR - 發生錯誤狀態
 */

/**
 * 虛擬形象狀態映射表。
 * @type {StateMap}
 */
export const STATE_MAP = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error'
};

/**
 * @typedef {Object} AvatarModeMap
 * @property {'companion'} companion - 陪伴模式
 * @property {'assistant'} assistant - 助理模式
 */

/**
 * 虛擬形象角色模式映射表。
 * @type {AvatarModeMap}
 */
export const AVATAR_MODE_MAP = {
  companion: 'companion',
  assistant: 'assistant'
};

/**
 * 預設虛擬形象模式。
 * @type {string}
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
 * @typedef {Object} EmoTargetMap
 * @property {0.65} happy - 快樂情緒的目標值
 * @property {0.6} surprised - 驚訝情緒的目標值
 * @property {0.5} sad - 悲傷情緒的目標值
 */

/**
 * 情緒目標值映射表。
 * @type {EmoTargetMap}
 */
export const EMO_TARGET_MAP = {
  happy: 0.65,
  surprised: 0.6,
  sad: 0.5
};

/**
 * @typedef {Object} EngineModeMap
 * @property {'2d'} twoDimensional - 2D 渲染引擎模式
 * @property {'3d'} threeDimensional - 3D 渲染引擎模式
 */

/**
 * 虛擬形象渲染引擎模式映射表。
 * @type {EngineModeMap}
 */
export const ENGINE_MODE_MAP = {
  twoDimensional: '2d',
  threeDimensional: '3d'
};

/**
 * 預設啟動的渲染引擎模式。
 * @type {string}
 */
export const DEFALUT_START_MODE = ENGINE_MODE_MAP.twoDimensional;

/**
 * @typedef {Object} FitModeMap
 * @property {'half'} HALF - 半身顯示模式
 * @property {'full'} FULL - 全身顯示模式
 */

/**
 * 畫面顯示比例模式映射表。
 * @type {FitModeMap}
 */
export const FIT_MODE_MAP = {
  HALF: 'half',
  FULL: 'full'
};

/**
 * 預設畫面顯示比例模式。
 * @type {string}
 */
export const DEFAULT_FIT_MODE = FIT_MODE_MAP.HALF;

/**
 * @typedef {Object} GenderMap
 * @property {'female'} female - 女性
 * @property {'male'} male - 男性
 */

/**
 * 性別選項映射表。
 * @type {GenderMap}
 */
export const GENDER_MAP = {
  female: 'female',
  male: 'male'
};

/**
 * 預設性別。
 * @type {string}
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
