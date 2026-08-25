import {
  COMPRESSION_STRATEGY_MAP,
  DEFAULT_COMPRESSION_STRATEGY,
  DEFAULT_MAX_TOTAL_CHARS,
  DEFAULT_WEB_LLM_MAX_TURNS,
  DEFAULT_WEB_LLM_MAX_CHARS,
  DEFAULT_AI_PROVIDER_MAX_TURNS,
  DEFAULT_AI_PROVIDER_MAX_CHARS,
  DEFAULT_MAX_HISTORY_TURNS,
  CHAT_ROLE_MAP,
  BRAIN_ENGINE_TYPE_MAP
} from '../constants.js';

/**
 * 壓縮設定限制解析結果
 * @typedef {Object} ResolvedCompressionLimits
 * @property {string} strategy - 壓縮策略名稱
 * @property {number} maxTurns - 最大歷史輪數
 * @property {number} maxTotalChars - 最大總字元數上限
 */

/**
 * 解析特定推論引擎的上下文壓縮限制
 * 優先級：特定引擎設定 (webLlm / aiProvider) -> 全域設定 (maxTurns / maxTotalChars) -> 內建預設值
 *
 * @param {Object} [compressionOptions={}] - 傳入的壓縮設定
 * @param {string} [engineType=BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER] - 當前推論引擎類型
 * @returns {ResolvedCompressionLimits} 解析後的限制設定
 */
export function resolveCompressionLimits(
  compressionOptions = {},
  engineType = BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
) {
  const options =
    typeof compressionOptions === 'object' && compressionOptions !== null
      ? compressionOptions
      : {};

  const strategy =
    typeof options.strategy === 'string' && options.strategy !== ''
      ? options.strategy
      : DEFAULT_COMPRESSION_STRATEGY;

  const isWebLLM = engineType === BRAIN_ENGINE_TYPE_MAP.WEB_LLM;
  const engineSpecificOptions =
    isWebLLM === true
      ? typeof options.webLlm === 'object' && options.webLlm !== null
        ? options.webLlm
        : {}
      : typeof options.aiProvider === 'object' && options.aiProvider !== null
        ? options.aiProvider
        : {};

  // 預設值依引擎區分
  const fallbackMaxTurns =
    isWebLLM === true
      ? DEFAULT_WEB_LLM_MAX_TURNS
      : DEFAULT_AI_PROVIDER_MAX_TURNS;
  const fallbackMaxChars =
    isWebLLM === true
      ? DEFAULT_WEB_LLM_MAX_CHARS
      : DEFAULT_AI_PROVIDER_MAX_CHARS;

  // 解析 maxTurns: 引擎專屬 -> 全域 -> fallback -> DEFAULT_MAX_HISTORY_TURNS
  let maxTurns = fallbackMaxTurns;
  if (
    typeof engineSpecificOptions.maxTurns === 'number' &&
    Number.isFinite(engineSpecificOptions.maxTurns) === true &&
    engineSpecificOptions.maxTurns > 0
  ) {
    maxTurns = engineSpecificOptions.maxTurns;
  } else if (
    typeof options.maxTurns === 'number' &&
    Number.isFinite(options.maxTurns) === true &&
    options.maxTurns > 0
  ) {
    maxTurns = options.maxTurns;
  } else if (typeof fallbackMaxTurns !== 'number' || fallbackMaxTurns <= 0) {
    maxTurns = DEFAULT_MAX_HISTORY_TURNS;
  }

  // 解析 maxTotalChars: 引擎專屬 -> 全域 -> fallback -> DEFAULT_MAX_TOTAL_CHARS
  let maxTotalChars = fallbackMaxChars;
  if (
    typeof engineSpecificOptions.maxTotalChars === 'number' &&
    Number.isFinite(engineSpecificOptions.maxTotalChars) === true &&
    engineSpecificOptions.maxTotalChars > 0
  ) {
    maxTotalChars = engineSpecificOptions.maxTotalChars;
  } else if (
    typeof options.maxTotalChars === 'number' &&
    Number.isFinite(options.maxTotalChars) === true &&
    options.maxTotalChars > 0
  ) {
    maxTotalChars = options.maxTotalChars;
  } else if (typeof fallbackMaxChars !== 'number' || fallbackMaxChars <= 0) {
    maxTotalChars = DEFAULT_MAX_TOTAL_CHARS;
  }

  return {
    strategy,
    maxTurns,
    maxTotalChars
  };
}

/**
 * 估算訊息或文字長度（字元數）
 *
 * @param {string|Array<Object>|Object} input - 輸入文字或訊息陣列
 * @returns {number} 估計字元數
 */
export function estimateChars(input) {
  if (typeof input === 'string') {
    return input.length;
  }
  if (Array.isArray(input) === true) {
    let total = 0;
    for (const msg of input) {
      total += estimateChars(msg);
    }
    return total;
  }
  if (typeof input === 'object' && input !== null) {
    let count = 0;
    if (typeof input.content === 'string') {
      count += input.content.length;
    }
    if (
      Array.isArray(input.tool_calls) === true &&
      input.tool_calls.length > 0
    ) {
      for (const call of input.tool_calls) {
        if (typeof call?.function?.arguments === 'string') {
          count += call.function.arguments.length;
        }
        if (typeof call?.function?.name === 'string') {
          count += call.function.name.length;
        }
      }
    }
    return count;
  }
  return 0;
}

/**
 * 確保 Tool Calls 訊息成對保留，避免 OpenAI / WebLLM 400 Bad Request
 *
 * @param {Array<Object>} messages - 訊息列表
 * @returns {Array<Object>} 修剪後的安全訊息列表
 */
export function sanitizeToolCalls(messages) {
  if (Array.isArray(messages) === false || messages.length === 0) {
    return [];
  }

  const validToolCallIds = new Set();
  for (const msg of messages) {
    if (
      typeof msg === 'object' &&
      msg !== null &&
      Array.isArray(msg.tool_calls) === true &&
      msg.tool_calls.length > 0
    ) {
      for (const tc of msg.tool_calls) {
        if (typeof tc?.id === 'string' && tc.id !== '') {
          validToolCallIds.add(tc.id);
        }
      }
    }
  }

  const result = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (typeof msg !== 'object' || msg === null) {
      continue;
    }

    const isTool = msg.role === CHAT_ROLE_MAP.TOOL || msg.role === 'tool';
    if (isTool === true) {
      const toolCallId = msg.tool_call_id;
      // 若該 tool response 沒有對應的 tool_calls 發起者，則捨棄以避免 API 報錯
      if (
        typeof toolCallId !== 'string' ||
        toolCallId === '' ||
        validToolCallIds.has(toolCallId) === false
      ) {
        continue;
      }
    }

    result.push(msg);
  }

  return result;
}

/**
 * 將歷史訊息陣列依問答邏輯分組為「輪次 (Turns)」
 * 一個輪次可能包含：
 * 1. 標準輪次：[userMsg, assistantMsg]
 * 2. 工具調用輪次：[userMsg, assistantToolCallMsg, toolMsg..., assistantFinalMsg]
 * 3. 獨立訊息
 *
 * @param {Array<Object>} historyMessages - 歷史對話訊息
 * @returns {Array<Array<Object>>} 分組後的輪次陣列
 */
export function groupMessagesIntoTurns(historyMessages) {
  if (
    Array.isArray(historyMessages) === false ||
    historyMessages.length === 0
  ) {
    return [];
  }

  const turns = [];
  let currentTurn = [];

  for (let i = 0; i < historyMessages.length; i++) {
    const msg = historyMessages[i];
    if (typeof msg !== 'object' || msg === null) {
      continue;
    }

    const isUser = msg.role === CHAT_ROLE_MAP.USER || msg.role === 'user';
    // 若遇到新的 user 發言且當前 turn 已有內容，代表進入下一輪
    if (isUser === true && currentTurn.length > 0) {
      turns.push(currentTurn);
      currentTurn = [msg];
    } else {
      currentTurn.push(msg);
    }
  }

  if (currentTurn.length > 0) {
    turns.push(currentTurn);
  }

  return turns;
}

/**
 * 標準滑動窗口壓縮器 (Sliding Window Compressor)
 * 以「整輪對話 (Complete Turns)」為單位，由新到舊倒推保留。
 *
 * @param {Object} params - 壓縮參數
 * @param {Array<Object>} params.messages - 原始完整訊息陣列
 * @param {string} [params.systemPrompt] - 解析後的系統提示詞
 * @param {number} [params.maxTurns=6] - 最大允許歷史輪數
 * @param {number} [params.maxTotalChars=4000] - 最大允許總字元數預算
 * @returns {Array<Object>} 壓縮過濾後的訊息列表
 */
export function slidingWindowCompressor({
  messages,
  systemPrompt = '',
  maxTurns = DEFAULT_MAX_HISTORY_TURNS,
  maxTotalChars = DEFAULT_MAX_TOTAL_CHARS
}) {
  if (Array.isArray(messages) === false || messages.length === 0) {
    return [];
  }

  // 1. 分離 System 訊息、最新 User 訊息與中間歷史
  let systemMsg = null;
  let latestUserMsg = null;
  const rawHistory = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (typeof msg !== 'object' || msg === null) {
      continue;
    }

    const isSystem = msg.role === CHAT_ROLE_MAP.SYSTEM || msg.role === 'system';
    if (isSystem === true && systemMsg === null) {
      systemMsg = msg;
      continue;
    }

    // 最後一則如果是 user，作為當前發問保留
    if (i === messages.length - 1) {
      const isUser = msg.role === CHAT_ROLE_MAP.USER || msg.role === 'user';
      if (isUser === true) {
        latestUserMsg = msg;
        continue;
      }
    }

    rawHistory.push(msg);
  }

  // 若外部有給定 systemPrompt 且 messages 中無 system message，則建立
  if (
    systemMsg === null &&
    typeof systemPrompt === 'string' &&
    systemPrompt !== ''
  ) {
    systemMsg = { role: CHAT_ROLE_MAP.SYSTEM, content: systemPrompt };
  }

  // 2. 計算固定開銷（System Prompt 與 最新 User 問題）
  const systemChars = systemMsg !== null ? estimateChars(systemMsg) : 0;
  const latestUserChars =
    latestUserMsg !== null ? estimateChars(latestUserMsg) : 0;
  const reservedChars = systemChars + latestUserChars;

  // 可用歷史預算
  const availableBudget = Math.max(0, maxTotalChars - reservedChars);

  // 3. 將歷史訊息分組為輪次，由新到舊倒推選取
  const turns = groupMessagesIntoTurns(rawHistory);
  const selectedTurns = [];
  let accumulatedChars = 0;

  for (let i = turns.length - 1; i >= 0; i--) {
    // 檢查輪數限制
    if (selectedTurns.length >= maxTurns) {
      break;
    }

    const turn = turns[i];
    const turnChars = estimateChars(turn);

    // 檢查字元預算限制（至少保留最新一輪如果空間許可）
    if (
      selectedTurns.length > 0 &&
      accumulatedChars + turnChars > availableBudget
    ) {
      break;
    }

    selectedTurns.unshift(turn);
    accumulatedChars += turnChars;
  }

  // 4. 平鋪選中的輪次
  const selectedHistory = [];
  for (const turn of selectedTurns) {
    for (const msg of turn) {
      selectedHistory.push(msg);
    }
  }

  // 5. 組裝最終 messages 陣列
  const finalMessages = [];
  if (systemMsg !== null) {
    finalMessages.push(systemMsg);
  }
  for (const msg of selectedHistory) {
    finalMessages.push(msg);
  }
  if (latestUserMsg !== null) {
    finalMessages.push(latestUserMsg);
  }

  // 6. 安全校驗 Tool Calls
  return sanitizeToolCalls(finalMessages);
}

/**
 * 上下文壓縮上下文參數
 * @typedef {Object} CompressContext
 * @property {Array<Object>} messages - 原始即將送出的完整訊息陣列 (包含 system, history, current user)
 * @property {string} systemPrompt - 當前解析後的 System Prompt (包含 Persona, RAG 知識庫)
 * @property {Array<{role: string, content: string}>} [history] - 原始歷史對話紀錄
 * @property {string} [latestQuestion] - 使用者當前最新的輸入問題
 * @property {Record<string, any>} [memoryData] - 當前記憶體狀態資料 (例如 name, visits, custom profile)
 * @property {'aiProvider'|'webLLM'|string} [provider] - 當前推論引擎
 * @property {'aiProvider'|'webLLM'|string} [engineType] - 當前推論引擎 (別名)
 * @property {string} [model] - 當前使用的模型名稱
 * @property {ResolvedCompressionLimits} limits - 當前引擎解析後的上限限制
 */

/**
 * 自訂壓縮器回呼函式
 * @typedef {(context: CompressContext) => Promise<Array<Object>>|Array<Object>} CustomCompressor
 */

/**
 * 綜合上下文壓縮調度器 (Context Compression Pipeline)
 *
 * @param {Object} context - 上下文物件
 * @param {Array<Object>} context.messages - 原始完整訊息列表
 * @param {string} [context.systemPrompt] - 系統提示詞
 * @param {Array<{role: string, content: string}>} [context.history] - 原始歷史對話紀錄
 * @param {string} [context.latestQuestion] - 使用者當前最新輸入問題
 * @param {Record<string, any>} [context.memoryData] - 當前記憶體資料
 * @param {string} [context.provider] - 推論引擎提供者類型
 * @param {string} [context.engineType] - 推論引擎類型
 * @param {string} [context.model] - 當前模型名稱
 * @param {Object} [context.compressionOptions] - 壓縮設定
 * @returns {Promise<Array<Object>>|Array<Object>} 壓縮後的訊息列表
 */
export async function compressContext({
  messages,
  systemPrompt = '',
  history = [],
  latestQuestion = '',
  memoryData = {},
  provider = BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER,
  engineType = BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER,
  model = '',
  compressionOptions = {}
}) {
  if (Array.isArray(messages) === false || messages.length === 0) {
    return [];
  }

  const effectiveEngineType =
    engineType || provider || BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER;
  const limits = resolveCompressionLimits(
    compressionOptions,
    effectiveEngineType
  );

  // 若策略為 NONE，直接直通返回 (經 sanitizeToolCalls 確保無孤立 Tool 訊息)
  if (limits.strategy === COMPRESSION_STRATEGY_MAP.NONE) {
    return sanitizeToolCalls(messages);
  }

  // 執行自訂壓縮器（若有提供且為函式）
  if (typeof compressionOptions?.customCompressor === 'function') {
    try {
      const customResult = await compressionOptions.customCompressor({
        messages,
        systemPrompt,
        history,
        latestQuestion,
        memoryData,
        provider: effectiveEngineType,
        engineType: effectiveEngineType,
        model,
        limits
      });
      if (Array.isArray(customResult) === true && customResult.length > 0) {
        return sanitizeToolCalls(customResult);
      }
      console.warn(
        '[compressContext] customCompressor returned invalid messages array, falling back to sliding-window.'
      );
    } catch (error) {
      console.warn(
        '[compressContext] customCompressor execution failed, falling back to sliding-window:',
        error
      );
    }
  }

  // 預設執行滑動窗口壓縮
  return slidingWindowCompressor({
    messages,
    systemPrompt,
    maxTurns: limits.maxTurns,
    maxTotalChars: limits.maxTotalChars
  });
}
