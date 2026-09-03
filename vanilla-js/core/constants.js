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
 * 預設啟動的渲染引擎模式（拼寫相容別名）。
 * @deprecated 請改用 DEFAULT_START_MODE
 * @type {'2d'|'3d'}
 */
export const DEFALUT_START_MODE = DEFAULT_START_MODE;

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
 * @type {'female'|'male'}
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
 * 預設是否允許使用者拖曳 3D 模型檔案 (.vrm) 至畫布進行即時換裝（預設關閉以符合正式上線產品需求）。
 * @type {boolean}
 */
export const DEFAULT_ENABLE_MODEL_DROP = false;

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
