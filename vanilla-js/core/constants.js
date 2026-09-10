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
 * 虛擬形象角色模式映射表（內建人格預設包）。
 * @readonly
 * @enum {string}
 */
export const AVATAR_MODE_MAP = {
  /** 陪伴模式預設包 */
  companion: 'companion',
  /** 助理模式預設包 */
  assistant: 'assistant'
};

/**
 * 預設虛擬形象模式。
 * @type {'companion'|'assistant'}
 */
export const DEFAULT_AVATAR_MODE = AVATAR_MODE_MAP.assistant;

/**
 * 預設是否啟用記憶體模組（多輪對話與上下文歷史）。
 * @type {boolean}
 */
export const DEFAULT_ENABLE_MEMORY = true;

/**
 * 預設保留最大對話輪數（1 輪包含 1 次使用者發言與 1 次 AI 回覆）。
 * @type {number}
 */
export const DEFAULT_MAX_HISTORY_TURNS = 6;

/**
 * 上下文壓縮策略映射表。
 * @readonly
 * @enum {string}
 */
export const COMPRESSION_STRATEGY_MAP = {
  /** 滑動窗口壓縮策略（依輪數與字元預算由新到舊截取完整對話輪次） */
  SLIDING_WINDOW: 'sliding-window',
  /** 滾動摘要壓縮策略（背景自動摘要對話重點注入系統提示詞） */
  ROLLING_SUMMARY: 'rolling-summary',
  /** 直通模式（不壓縮，全量傳遞） */
  NONE: 'none'
};

/**
 * 預設上下文壓縮策略。
 * @type {'sliding-window'|'rolling-summary'|'none'}
 */
export const DEFAULT_COMPRESSION_STRATEGY =
  COMPRESSION_STRATEGY_MAP.SLIDING_WINDOW;

/**
 * 預設全域上下文總字元預算上限。
 * @type {number}
 */
export const DEFAULT_MAX_TOTAL_CHARS = 4000;

/**
 * 預設端側 WebLLM 引擎最大對話輪數（嚴格控制顯存）。
 * @type {number}
 */
export const DEFAULT_WEB_LLM_MAX_TURNS = 3;

/**
 * 預設端側 WebLLM 引擎最大字元預算上限。
 * @type {number}
 */
export const DEFAULT_WEB_LLM_MAX_CHARS = 1500;

/**
 * 預設雲端 AI Provider 伺服器最大對話輪數。
 * @type {number}
 */
export const DEFAULT_AI_PROVIDER_MAX_TURNS = 8;

/**
 * 預設雲端 AI Provider 伺服器最大字元預算上限。
 * @type {number}
 */
export const DEFAULT_AI_PROVIDER_MAX_CHARS = 6000;

/**
 * 預設滾動摘要觸發輪數門檻（每累積達此輪數則在背景觸發摘要更新）。
 * @type {number}
 */
export const DEFAULT_SUMMARY_THRESHOLD_TURNS = 4;

/**
 * 預設滾動摘要模式下保留的最新完整對話輪數。
 * @type {number}
 */
export const DEFAULT_SUMMARY_RECENT_TURNS = 2;

/**
 * 預設摘要文字長度上限（字元）。
 * @type {number}
 */
export const DEFAULT_SUMMARY_MAX_CHARS = 1000;

/**
 * 預設本機 LocalStorage 記憶體儲存鍵名。
 * @type {string}
 */
export const DEFAULT_MEMORY_KEY = 'avatar-widget-memory';

/**
 * 當前記憶體結構版本號（Schema Version）。
 * @type {number}
 */
export const CURRENT_MEMORY_VERSION = 1;

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
 * 預設端側 WebLLM 引擎單次回答的最大 Token 數。
 * @type {number}
 */
export const DEFAULT_LLM_MAX_TOKENS = 1024;

/**
 * 預設雲端 AI Provider 伺服器單次回答的最大 Token 數。
 * @type {number}
 */
export const DEFAULT_AI_PROVIDER_MAX_TOKENS = 2048;

/**
 * 預設是否在模型回答達到 Token 上限被截斷時啟用自動接續。
 * @type {boolean}
 */
export const DEFAULT_ENABLE_AUTO_CONTINUE = false;

/**
 * 預設單次問題回答的最大自動接續次數上限（防止無限接續循環）。
 * @type {number}
 */
export const DEFAULT_MAX_AUTO_CONTINUATIONS = 3;

/**
 * 自動接續輸出模式映射表。
 * @readonly
 * @enum {string}
 */
export const AUTO_CONTINUE_MODE_MAP = {
  /** 串流即時模式：邊說邊顯示第一段，接續文字抵達時無縫串入既有訊息與語音佇列 */
  STREAM: 'stream',
  /** 緩衝模式：等待所有接續片段全部生成完畢後再一次性輸出語音與文字 */
  BUFFERED: 'buffered'
};

/**
 * 預設自動接續輸出模式。
 * @type {'stream'|'buffered'}
 */
export const DEFAULT_AUTO_CONTINUE_MODE = AUTO_CONTINUE_MODE_MAP.STREAM;

/**
 * 情緒目標值映射表。
 * @readonly
 * @enum {number}
 */
export const EMOTION_TARGET_MAP = {
  /** 快樂情緒的目標值 */
  happy: 0.65,
  /** 驚訝情緒的目標值 */
  surprised: 0.6,
  /** 悲傷情緒的目標值 */
  sad: 0.5
};

/**
 * 情緒目標值映射表（相容別名）。
 * @deprecated 請改用 EMOTION_TARGET_MAP
 * @readonly
 * @enum {number}
 */
export const EMO_TARGET_MAP = EMOTION_TARGET_MAP;

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
 * @type {'2d'|'3d'}
 */
export const DEFAULT_START_MODE = ENGINE_MODE_MAP.twoDimensional;

/**
 * 預設 VRMA 根目錄 URL 路徑。
 * @type {string}
 */
export const DEFAULT_VRMA_ROOT_PATH = '/avatar-skin/3d-model/vrma/';

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
 * @type {'half'|'full'}
 */
export const DEFAULT_FIT_MODE = FIT_MODE_MAP.FULL;

/**
 * 預設 2D Live2D 半身模式縮放倍率。
 * @type {number}
 */
export const DEFAULT_2D_HALF_ZOOM = 1.9;

/**
 * 預設 2D Live2D 全身模式縮放倍率。
 * @type {number}
 */
export const DEFAULT_2D_FULL_ZOOM = 1.0;

/**
 * 預設 2D Live2D 縮放倍率（依據預設畫面比例連動）。
 * @type {number}
 */
export const DEFAULT_2D_ZOOM =
  DEFAULT_FIT_MODE === FIT_MODE_MAP.HALF
    ? DEFAULT_2D_HALF_ZOOM
    : DEFAULT_2D_FULL_ZOOM;

/**
 * 預設 2D Live2D 水平偏移像素。
 * @type {number}
 */
export const DEFAULT_2D_OFFSET_X = 0;

/**
 * 預設 2D Live2D 垂直偏移像素。
 * @type {number}
 */
export const DEFAULT_2D_OFFSET_Y = 0;

/**
 * 預設 2D Live2D 半身模式模型錨點。
 * @type {Readonly<{x: number, y: number}>}
 */
export const DEFAULT_2D_HALF_ANCHOR = Object.freeze({
  x: 0.5,
  y: 1.0
});

/**
 * 預設 2D Live2D 全身模式模型錨點 (y=3.0 保留上方對話框安全邊距)。
 * @type {Readonly<{x: number, y: number}>}
 */
export const DEFAULT_2D_FULL_ANCHOR = Object.freeze({
  x: 0.5,
  y: 3.0
});

/**
 * 預設 2D Live2D 模型錨點（依據預設畫面比例連動）。
 * @type {Readonly<{x: number, y: number}>}
 */
export const DEFAULT_2D_ANCHOR =
  DEFAULT_FIT_MODE === FIT_MODE_MAP.HALF
    ? DEFAULT_2D_HALF_ANCHOR
    : DEFAULT_2D_FULL_ANCHOR;

/**
 * 預設 3D VRM 半身模式攝影機視野 (FOV)。
 * @type {number}
 */
export const DEFAULT_3D_HALF_CAMERA_FOV = 26;

/**
 * 預設 3D VRM 全身模式攝影機視野 (FOV)。
 * @type {number}
 */
export const DEFAULT_3D_FULL_CAMERA_FOV = 30;

/**
 * 預設 3D VRM 攝影機視角視野 (FOV)（依據預設畫面比例連動）。
 * @type {number}
 */
export const DEFAULT_3D_CAMERA_FOV =
  DEFAULT_FIT_MODE === FIT_MODE_MAP.HALF
    ? DEFAULT_3D_HALF_CAMERA_FOV
    : DEFAULT_3D_FULL_CAMERA_FOV;

/**
 * 預設 3D VRM 攝影機近裁剪面距離 (Near)。
 * @type {number}
 */
export const DEFAULT_3D_CAMERA_NEAR = 0.1;

/**
 * 預設 3D VRM 攝影機遠裁剪面距離 (Far)。
 * @type {number}
 */
export const DEFAULT_3D_CAMERA_FAR = 20;

/**
 * 預設 3D VRM 半身模式攝影機世界座標位置。
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_HALF_CAMERA_POSITION = Object.freeze({
  x: 0,
  y: 1.4,
  z: 2.5
});

/**
 * 預設 3D VRM 全身模式攝影機世界座標位置。
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_FULL_CAMERA_POSITION = Object.freeze({
  x: 0,
  y: 1.0,
  z: 3.5
});

/**
 * 預設 3D VRM 攝影機世界座標位置（依據預設畫面比例連動）。
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_CAMERA_POSITION =
  DEFAULT_FIT_MODE === FIT_MODE_MAP.HALF
    ? DEFAULT_3D_HALF_CAMERA_POSITION
    : DEFAULT_3D_FULL_CAMERA_POSITION;

/**
 * 預設 3D VRM 半身模式攝影機注視焦點座標。
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_HALF_CAMERA_LOOK_AT = Object.freeze({
  x: 0,
  y: 1.2,
  z: 0
});

/**
 * 預設 3D VRM 全身模式攝影機注視焦點座標。
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_FULL_CAMERA_LOOK_AT = Object.freeze({
  x: 0,
  y: 0.9,
  z: 0
});

/**
 * 預設 3D VRM 攝影機注視焦點座標（依據預設畫面比例連動）。
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_CAMERA_LOOK_AT =
  DEFAULT_FIT_MODE === FIT_MODE_MAP.HALF
    ? DEFAULT_3D_HALF_CAMERA_LOOK_AT
    : DEFAULT_3D_FULL_CAMERA_LOOK_AT;

/**
 * 預設 3D VRM 模型世界座標偏移。
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_MODEL_POSITION = Object.freeze({
  x: 0,
  y: 0,
  z: 0
});

/**
 * 預設 3D VRM 模型額外縮放比例。
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_MODEL_SCALE = Object.freeze({
  x: 1,
  y: 1,
  z: 1
});

/**
 * 預設 3D VRM 模型旋轉角度 (歐拉角 Euler)。
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const DEFAULT_3D_MODEL_ROTATION = Object.freeze({
  x: 0,
  y: 3.1,
  z: 0
});

/**
 * 預設是否啟用 3D VRM 眼睛跟隨滑鼠游標。
 * @type {boolean}
 */
export const DEFAULT_3D_POINTER_LOOK = true;

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
 * @type {'female'|'male'}
 */
export const DEFAULT_GENDER = GENDER_MAP.female;

/**
 * 預設女性 2D Live2D 模型的 URL 路徑。
 * @type {string}
 */
export const DEFAULT_FEMALE_2D_MODEL_URL =
  '/avatar-skin/2d-model/female/haru_greeter_t03.model3.json';

/**
 * 預設男性 2D Live2D 模型的 URL 路徑。
 * @type {string}
 */
export const DEFAULT_MALE_2D_MODEL_URL =
  '/avatar-skin/2d-model/male/natori_pro_t06.model3.json';

/**
 * 預設 2D Live2D 模型的 URL 路徑（依據預設性別連動）。
 * @type {string}
 */
export const DEFAULT_2D_MODEL_URL =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_2D_MODEL_URL
    : DEFAULT_MALE_2D_MODEL_URL;

/**
 * 預設女性 3D 模型 URL 路徑。
 * @type {string}
 */
export const DEFAULT_FEMALE_3D_MODEL_URL =
  '/avatar-skin/3d-model/HatsuneMiku.vrm';

/**
 * 預設男性 3D 模型 URL 路徑。
 * @type {string}
 */
export const DEFAULT_MALE_3D_MODEL_URL = '/avatar-skin/3d-model/RockmanEXE.vrm';

/**
 * 預設 3D VRM 模型的 URL 路徑（依據預設性別連動）。
 * @type {string}
 */
export const DEFAULT_3D_MODEL_URL =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_3D_MODEL_URL
    : DEFAULT_MALE_3D_MODEL_URL;

/**
 * 預設 3D VRM 模型的 URL 路徑（相容別名）。
 * @type {string}
 */
export const DEFAULT_VRM_URL = DEFAULT_3D_MODEL_URL;

/**
 * 預設虛擬形象模型 URL 路徑（依據預設啟動引擎模式與預設性別連動）。
 * @type {string}
 */
export const DEFAULT_MODEL_URL =
  DEFAULT_START_MODE === ENGINE_MODE_MAP.threeDimensional
    ? DEFAULT_3D_MODEL_URL
    : DEFAULT_2D_MODEL_URL;

/**
 * 預設是否允許使用者拖曳 3D 模型檔案 (.vrm) 至畫布進行即時換裝（預設關閉以符合正式上線產品需求）。
 * @type {boolean}
 */
export const DEFAULT_ENABLE_MODEL_DROP = false;

/**
 * 預設是否在同時具備 2D 與 3D 模型時顯示 2D/3D 切換按鈕。
 * @type {boolean}
 */
export const DEFAULT_ENABLE_ENGINE_TOGGLE = true;

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

/**
 * 預設神經語音 ID（依據預設性別連動）。
 * @type {string}
 */
export const DEFAULT_NEURAL_VOICE =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_NEURAL_VOICE
    : DEFAULT_MALE_NEURAL_VOICE;

/**
 * 依據性別取得預設神經語音 ID。
 * @param {string} [gender=DEFAULT_GENDER] - 角色性別 ('female'|'male')
 * @returns {string} 神經語音 ID
 */
export function getDefaultNeuralVoice(gender = DEFAULT_GENDER) {
  return gender === GENDER_MAP.female
    ? DEFAULT_FEMALE_NEURAL_VOICE
    : DEFAULT_MALE_NEURAL_VOICE;
}

/**
 * 依據性別取得預設 2D Live2D 模型 URL。
 * @param {string} [gender=DEFAULT_GENDER] - 角色性別 ('female'|'male')
 * @returns {string} 2D 模型 URL
 */
export function getDefault2DModelUrl(gender = DEFAULT_GENDER) {
  return gender === GENDER_MAP.female
    ? DEFAULT_FEMALE_2D_MODEL_URL
    : DEFAULT_MALE_2D_MODEL_URL;
}

/**
 * 依據性別取得預設 3D VRM 模型 URL。
 * @param {string} [gender=DEFAULT_GENDER] - 角色性別 ('female'|'male')
 * @returns {string} 3D 模型 URL
 */
export function getDefault3DModelUrl(gender = DEFAULT_GENDER) {
  return gender === GENDER_MAP.female
    ? DEFAULT_FEMALE_3D_MODEL_URL
    : DEFAULT_MALE_3D_MODEL_URL;
}

/**
 * 依據性別與引擎模式取得預設模型 URL。
 * @param {string} [gender=DEFAULT_GENDER] - 角色性別 ('female'|'male')
 * @param {string} [engineMode=DEFAULT_START_MODE] - 引擎模式 ('2d'|'3d')
 * @returns {string} 模型 URL
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
 * 依據畫面比例模式 (fitMode) 取得預設 2D 變換設定。
 * @param {string} [fitMode=DEFAULT_FIT_MODE] - 畫面比例模式 ('half'|'full')
 * @returns {{zoom: number, offsetX: number, offsetY: number, anchor: Readonly<{x: number, y: number}>}} 預設 2D 變換設定物件
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
 * 依據畫面比例模式 (fitMode) 取得預設 3D 攝影機設定。
 * @param {string} [fitMode=DEFAULT_FIT_MODE] - 畫面比例模式 ('half'|'full')
 * @returns {{fov: number, near: number, far: number, position: Readonly<{x: number, y: number, z: number}>, lookAt: Readonly<{x: number, y: number, z: number}>}} 預設 3D 攝影機設定物件
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
 * 工具路由決策模式映射表。
 * @readonly
 * @enum {string}
 */
export const TOOL_ROUTING_MODE_MAP = {
  /** 純前端規則比對（0 Token 消耗，< 1ms 反應） */
  CLIENT: 'client',
  /** 純 AI 大模型語意決策（透過 Function Calling） */
  AI: 'ai',
  /** 雙軌模式（前端高信心直接命中，複雜語句交由 AI 決策） */
  HYBRID: 'hybrid'
};

/**
 * 預設工具路由模式。
 * @type {string}
 */
export const DEFAULT_TOOL_ROUTING_MODE = TOOL_ROUTING_MODE_MAP.HYBRID;

/**
 * 工具執行結果處理模式映射表。
 * @readonly
 * @enum {string}
 */
export const TOOL_RESULT_MODE_MAP = {
  /** 將工具回傳結果送回 AI 大腦進行自然語言摘要 */
  AI_SUMMARY: 'ai_summary',
  /** 直接輸出/顯示工具回傳訊息，不耗費第二次 LLM Token */
  DIRECT: 'direct'
};

/**
 * 預設工具結果處理模式。
 * @type {string}
 */
export const DEFAULT_TOOL_RESULT_MODE = TOOL_RESULT_MODE_MAP.AI_SUMMARY;

/**
 * 預設工具確認逾時時間（毫秒），預設 60 秒。
 * @type {number}
 */
export const DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS = 60000;

/**
 * 工具取消或失效原因映射表。
 * @readonly
 * @enum {string}
 */
export const TOOL_CANCEL_REASON_MAP = {
  /** 使用者主動取消（點擊取消按鈕或語音/打字說取消） */
  USER_CANCEL: 'user_cancel',
  /** 確認逾時失效（超過設定時限未回覆） */
  TIMEOUT: 'timeout',
  /** 使用者輸入新訊息而自動取消前次未完成之操作 */
  NEW_INPUT: 'new_input',
  /** 使用者拒絕授權或同意條款 */
  CONSENT_DECLINED: 'consent_declined'
};

/**
 * 工具生命週期與事件名稱映射表。
 * @readonly
 * @enum {string}
 */
export const TOOL_EVENT_MAP = {
  /** 提議執行工具事件 */
  OFFER: 'tool_offer',
  /** 需使用者補填參數事件 */
  INPUT_REQUIRED: 'tool_input_required',
  /** 工具歧義多選事件 */
  AMBIGUOUS: 'tool_ambiguous',
  /** 確認執行工具事件 */
  CONFIRM: 'tool_confirm',
  /** 取消執行工具事件 */
  CANCEL: 'tool_cancel',
  /** 開始執行工具事件 */
  EXECUTE: 'tool_execute',
  /** 工具執行結果事件 */
  RESULT: 'tool_result'
};

/**
 * 工具 Schema 支援的屬性型別映射表。
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
 * 工具 Schema 支援的格式驗證映射表。
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
 * 對話訊息的角色映射表。
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
 * 對話訊息來源映射表。
 * @readonly
 * @enum {string}
 */
export const CHAT_SOURCE_MAP = {
  TOOL: 'tool',
  AI: 'ai',
  SYSTEM: 'system'
};

/**
 * LLM 模型推論結束原因映射表（符合 OpenAI / WebLLM 標準規範）。
 * @readonly
 * @enum {string}
 */
export const LLM_FINISH_REASON_MAP = {
  /** 正常生成完畢或達到停止詞標記 */
  STOP: 'stop',
  /** 達到單次回答最大 Token 數限制而被截斷（觸發自動接續之關鍵判斷依據） */
  LENGTH: 'length',
  /** 模型觸發外部工具調用 (Function Calling) */
  TOOL_CALLS: 'tool_calls',
  /** 觸發內容安全過濾機制 */
  CONTENT_FILTER: 'content_filter'
};

/**
 * LLM 模型推論結束原因映射表（相容別名）。
 * @readonly
 * @enum {string}
 */
export const FINISH_REASON_MAP = LLM_FINISH_REASON_MAP;

/**
 * 大腦推論與降級引擎類型映射表。
 * @readonly
 * @enum {string}
 */
export const BRAIN_ENGINE_TYPE_MAP = {
  /** 遠端 AI 伺服器提供者 (例如 Ollama, vLLM, OpenAI 相容 API) */
  AI_PROVIDER: 'aiProvider',
  /** 瀏覽器端 WebLLM 引擎 (WebGPU 本地推論) */
  WEB_LLM: 'webLLM',
  /** 本地知識庫檢索式回答 (Bigram 關鍵字比對後備) */
  RETRIEVAL: 'retrieval'
};

/**
 * 大腦降級引擎類型映射表（別名）。
 * @readonly
 * @enum {string}
 */
export const BRAIN_FALLBACK_TYPE_MAP = BRAIN_ENGINE_TYPE_MAP;

/**
 * 檢查指定的 WebLLM 模型是否支援原生 Function Calling (tools)。
 * WebLLM 目前官方主要針對 Hermes 系列模型提供 Function Calling 支援。
 * @param {string} model - 模型名稱
 * @returns {boolean} 是否支援 Function Calling
 */
export function isWebLLMFunctionCallingSupported(model) {
  if (typeof model !== 'string' || model === '') {
    return false;
  }
  return /hermes/i.test(model);
}

/**
 * 預設支援的人像情緒與手勢動作清單。
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
 * 預設情緒工具名稱。
 * @type {string}
 */
export const DEFAULT_EMOTION_TOOL_NAME = 'express_emotion';
