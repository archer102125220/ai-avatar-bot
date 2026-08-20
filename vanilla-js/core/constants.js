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

