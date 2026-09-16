import {
  COMPRESSION_STRATEGY_MAP,
  DEFAULT_COMPRESSION_STRATEGY,
  DEFAULT_MAX_TOTAL_CHARS,
  DEFAULT_WEB_LLM_MAX_TURNS,
  DEFAULT_WEB_LLM_MAX_CHARS,
  DEFAULT_AI_PROVIDER_MAX_TURNS,
  DEFAULT_AI_PROVIDER_MAX_CHARS,
  DEFAULT_MAX_HISTORY_TURNS,
  DEFAULT_SUMMARY_RECENT_TURNS,
  DEFAULT_SUMMARY_MAX_CHARS,
  CHAT_ROLE_MAP,
  BRAIN_ENGINE_TYPE_MAP
} from '@/core/constants';

/**
 * Resolved context compression limits and strategy configuration.
 * @typedef {Object} ResolvedCompressionLimits
 * @property {string} strategy - Compression strategy name.
 * @property {number} maxTurns - Maximum conversation turns retained.
 * @property {number} maxTotalChars - Character budget ceiling.
 */

/**
 * Resolves context compression limits for a specific inference engine.
 * Precedence: Engine-specific (`webLlm` / `aiProvider`) -> Global (`maxTurns` / `maxTotalChars`) -> Default values.
 *
 * @param {import('@types').BrainCompressionOptions} [compressionOptions={}] - Compression options.
 * @param {string} [engineType=BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER] - Active inference engine type.
 * @returns {ResolvedCompressionLimits} Resolved limits and strategy configuration.
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
 * Estimates character count of text, message objects, or message arrays.
 *
 * @param {string|Array<Object>|Object} input - Input text, message, or message array.
 * @returns {number} Estimated character count.
 */
export function estimateChars(input) {
  if (typeof input === 'string') {
    return input.length;
  }
  if (Array.isArray(input) === true) {
    let totalChars = 0;
    for (const message of input) {
      totalChars += estimateChars(message);
    }
    return totalChars;
  }
  if (typeof input === 'object' && input !== null) {
    let charCount = 0;
    if (typeof input.content === 'string') {
      charCount += input.content.length;
    }
    if (
      Array.isArray(input.tool_calls) === true &&
      input.tool_calls.length > 0
    ) {
      for (const toolCall of input.tool_calls) {
        if (typeof toolCall?.function?.arguments === 'string') {
          charCount += toolCall.function.arguments.length;
        }
        if (typeof toolCall?.function?.name === 'string') {
          charCount += toolCall.function.name.length;
        }
      }
    }
    return charCount;
  }
  return 0;
}

/**
 * Ensures tool calls and tool responses remain paired in conversation messages to prevent 400 Bad Request errors.
 *
 * @param {Array<Object>} messages - Message array to sanitize.
 * @returns {Array<Object>} Sanitized message array.
 */
export function sanitizeToolCalls(messages) {
  if (Array.isArray(messages) === false || messages.length === 0) {
    return [];
  }

  const validToolCallIds = new Set();
  for (const message of messages) {
    if (
      typeof message === 'object' &&
      message !== null &&
      Array.isArray(message.tool_calls) === true &&
      message.tool_calls.length > 0
    ) {
      for (const toolCall of message.tool_calls) {
        if (typeof toolCall?.id === 'string' && toolCall.id !== '') {
          validToolCallIds.add(toolCall.id);
        }
      }
    }
  }

  const sanitizedMessages = [];
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (typeof message !== 'object' || message === null) {
      continue;
    }

    const isTool =
      message.role === CHAT_ROLE_MAP.TOOL || message.role === 'tool';
    if (isTool === true) {
      const toolCallId = message.tool_call_id;
      // 若該 tool response 沒有對應的 tool_calls 發起者，則捨棄以避免 API 報錯
      if (
        typeof toolCallId !== 'string' ||
        toolCallId === '' ||
        validToolCallIds.has(toolCallId) === false
      ) {
        continue;
      }
    }

    sanitizedMessages.push(message);
  }

  return sanitizedMessages;
}

/**
 * Groups raw sequential conversation messages into complete turns (user question + assistant response + optional tool calls).
 *
 * @param {Array<Object>} historyMessages - History messages array.
 * @returns {Array<Array<Object>>} Grouped turns array.
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

  for (let index = 0; index < historyMessages.length; index++) {
    const message = historyMessages[index];
    if (typeof message !== 'object' || message === null) {
      continue;
    }

    const isUser =
      message.role === CHAT_ROLE_MAP.USER || message.role === 'user';
    // 若遇到新的 user 發言且當前 turn 已有內容，代表進入下一輪
    if (isUser === true && currentTurn.length > 0) {
      turns.push(currentTurn);
      currentTurn = [message];
    } else {
      currentTurn.push(message);
    }
  }

  if (currentTurn.length > 0) {
    turns.push(currentTurn);
  }

  return turns;
}

/**
 * Standard sliding-window conversation compressor preserving complete recent turns up to character budget.
 *
 * @param {Object} params - Compression parameters.
 * @param {Array<Object>} params.messages - Full input messages array.
 * @param {string} [params.systemPrompt] - Resolved system prompt string.
 * @param {number} [params.maxTurns=6] - Maximum allowed historical turns.
 * @param {number} [params.maxTotalChars=4000] - Character budget ceiling.
 * @returns {Array<Object>} Compressed and filtered messages array.
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
  let systemMessage = null;
  let latestUserMessage = null;
  const rawHistory = [];

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (typeof message !== 'object' || message === null) {
      continue;
    }

    const isSystem =
      message.role === CHAT_ROLE_MAP.SYSTEM || message.role === 'system';
    if (isSystem === true && systemMessage === null) {
      systemMessage = message;
      continue;
    }

    // 最後一則如果是 user，作為當前發問保留
    if (index === messages.length - 1) {
      const isUser =
        message.role === CHAT_ROLE_MAP.USER || message.role === 'user';
      if (isUser === true) {
        latestUserMessage = message;
        continue;
      }
    }

    rawHistory.push(message);
  }

  // 若外部有給定 systemPrompt，優先以外部給定之 systemPrompt 為準；否則沿用 messages 中的 systemMessage
  if (typeof systemPrompt === 'string' && systemPrompt !== '') {
    systemMessage = { role: CHAT_ROLE_MAP.SYSTEM, content: systemPrompt };
  }

  // 2. 計算固定開銷（System Prompt 與 最新 User 問題）
  const systemChars = systemMessage !== null ? estimateChars(systemMessage) : 0;
  const latestUserChars =
    latestUserMessage !== null ? estimateChars(latestUserMessage) : 0;
  const reservedChars = systemChars + latestUserChars;

  // 可用歷史預算
  const availableBudget = Math.max(0, maxTotalChars - reservedChars);

  // 3. 將歷史訊息分組為輪次，由新到舊倒推選取
  const turns = groupMessagesIntoTurns(rawHistory);
  const selectedTurns = [];
  let accumulatedChars = 0;

  for (let turnIndex = turns.length - 1; turnIndex >= 0; turnIndex--) {
    // 檢查輪數限制
    if (selectedTurns.length >= maxTurns) {
      break;
    }

    const turn = turns[turnIndex];
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
    for (const message of turn) {
      selectedHistory.push(message);
    }
  }

  // 5. 組裝最終 messages 陣列
  const finalMessages = [];
  if (systemMessage !== null) {
    finalMessages.push(systemMessage);
  }
  for (const message of selectedHistory) {
    finalMessages.push(message);
  }
  if (latestUserMessage !== null) {
    finalMessages.push(latestUserMessage);
  }

  // 6. 安全校驗 Tool Calls
  return sanitizeToolCalls(finalMessages);
}

/**
 * Context payload supplied to custom compression handler functions.
 * @typedef {Object} CompressContext
 * @property {Array<Object>} messages - Raw full messages array (system, history, latest user).
 * @property {string} systemPrompt - Current resolved system prompt.
 * @property {Array<{ role: string, content: string }>} [history] - Raw conversation history.
 * @property {string} [latestQuestion] - Latest user input question.
 * @property {Record<string, any>} [memoryData] - Current memory state data.
 * @property {'aiProvider' | 'webLLM' | string} [provider] - Active provider type.
 * @property {'aiProvider' | 'webLLM' | string} [engineType] - Active engine type alias.
 * @property {string} [model] - Active model identifier.
 * @property {ResolvedCompressionLimits} limits - Resolved upper limits.
 */

/**
 * Custom context compressor function signature.
 * @typedef {(context: CompressContext) => Promise<Array<Object>> | Array<Object>} CustomCompressor
 */

/**
 * Generates an updated rolling summary of conversation turns.
 *
 * @param {Object} params
 * @param {string} [params.oldSummary=''] - Previous summary text.
 * @param {Array<{ role: string, content: string }>} params.newTurns - New unsummarized turns.
 * @param {string} [params.locale='zh-TW'] - Language locale code.
 * @param {Function | null} [params.llmChat=null] - Async LLM completion function for generating summary.
 * @param {Function | null} [params.customGenerator=null] - Custom summary generator function.
 * @returns {Promise<string>} Generated concise summary string.
 */
export async function generateRollingSummary({
  oldSummary = '',
  newTurns = [],
  locale = 'zh-TW',
  llmChat = null,
  customGenerator = null
}) {
  if (Array.isArray(newTurns) === false || newTurns.length === 0) {
    return oldSummary;
  }

  // 1. 若有提供自訂摘要產生器
  if (typeof customGenerator === 'function') {
    try {
      const customResult = await customGenerator({
        oldSummary,
        newTurns,
        locale
      });
      if (typeof customResult === 'string' && customResult.trim() !== '') {
        return customResult.trim();
      }
    } catch (error) {
      console.warn(
        '[generateRollingSummary] customGenerator failed, falling back:',
        error
      );
    }
  }

  // 格式化新對話
  const formattedTurns = newTurns
    .map((message) => {
      const roleLabel =
        message.role === CHAT_ROLE_MAP.USER || message.role === 'user'
          ? '使用者'
          : 'AI';
      return `${roleLabel}: ${message.content}`;
    })
    .join('\n');

  // 2. 若提供 LLM chat 介面，使用輕量 Prompt 進行非同步精煉摘要
  if (typeof llmChat === 'function') {
    try {
      const summaryPrompt = [
        {
          role: CHAT_ROLE_MAP.SYSTEM,
          content:
            '你是一個專業對話記憶管理助手。請將以下對話歷史精煉為一段簡短摘要備忘錄（約 100~200 字），保留使用者偏好、核心事實、重要名詞與決定，不要寒暄與廢話。'
        },
        {
          role: CHAT_ROLE_MAP.USER,
          content: `【前情摘要】\n${oldSummary !== '' ? oldSummary : '（無前情摘要）'}\n\n【新增對話】\n${formattedTurns}\n\n請輸出合併精煉後的最新摘要備忘錄：`
        }
      ];
      const summaryResult = await llmChat(summaryPrompt);
      if (typeof summaryResult === 'string' && summaryResult.trim() !== '') {
        return summaryResult.trim();
      }
    } catch (error) {
      console.warn(
        '[generateRollingSummary] LLM chat summary failed, using fallback heuristic:',
        error
      );
    }
  }

  // 3. Fallback Heuristic 簡易抽取式摘要（當無 LLM 或 API 失敗時保證不中斷）
  const extractedPoints = newTurns
    .filter(
      (message) =>
        typeof message.content === 'string' && message.content.trim() !== ''
    )
    .map((message) => {
      const isUser =
        message.role === CHAT_ROLE_MAP.USER || message.role === 'user';
      const prefix = isUser === true ? '問' : '答';
      const cleanContent = message.content.replace(/\s+/g, ' ').slice(0, 60);
      return `${prefix}: ${cleanContent}`;
    })
    .slice(-4);

  const fallbackSummary = [
    oldSummary !== '' ? oldSummary : '',
    ...extractedPoints
  ]
    .filter(Boolean)
    .join('； ')
    .slice(-DEFAULT_SUMMARY_MAX_CHARS);

  return fallbackSummary;
}

/**
 * Rolling summary compressor that injects background summaries into the system prompt while retaining recent turns.
 *
 * @param {Object} options
 * @param {Array<Object>} options.messages - Raw message array.
 * @param {string} [options.systemPrompt=''] - Base system prompt.
 * @param {string} [options.summary=''] - Accumulated summary context.
 * @param {number} [options.recentTurnsCount=DEFAULT_SUMMARY_RECENT_TURNS] - Recent turns count to keep.
 * @param {number} [options.maxTotalChars=DEFAULT_MAX_TOTAL_CHARS] - Total character budget.
 * @returns {Array<Object>} Compressed message array with injected summary.
 */
export function rollingSummaryCompressor({
  messages,
  systemPrompt = '',
  summary = '',
  recentTurnsCount = DEFAULT_SUMMARY_RECENT_TURNS,
  maxTotalChars = DEFAULT_MAX_TOTAL_CHARS
}) {
  if (Array.isArray(messages) === false || messages.length === 0) {
    return [];
  }

  // 1. 若有給定 systemPrompt 則使用之，否則從 messages 提取原有 system message
  const originalSystemPrompt =
    typeof systemPrompt === 'string' && systemPrompt !== ''
      ? systemPrompt
      : messages.find(
          (message) =>
            message.role === CHAT_ROLE_MAP.SYSTEM || message.role === 'system'
        )?.content || '';

  let enhancedSystemPrompt = originalSystemPrompt;
  if (typeof summary === 'string' && summary.trim() !== '') {
    const summaryBlock = `\n\n【歷史對話前情備忘 / Context Summary】\n${summary.trim()}`;
    if (
      enhancedSystemPrompt.includes(
        '【歷史對話前情備忘 / Context Summary】'
      ) === false
    ) {
      enhancedSystemPrompt = `${enhancedSystemPrompt}${summaryBlock}`;
    }
  }

  // 2. 套用滑動窗口截取最近 recentTurnsCount 輪
  return slidingWindowCompressor({
    messages,
    systemPrompt: enhancedSystemPrompt,
    maxTurns: recentTurnsCount,
    maxTotalChars
  });
}

/**
 * Comprehensive context compression orchestrator dispatching according to configured strategy.
 *
 * @param {Object} context - Compression context descriptor.
 * @param {Array<Object>} context.messages - Raw full messages list.
 * @param {string} [context.systemPrompt] - System prompt.
 * @param {Array<{ role: string, content: string }>} [context.history] - History turns.
 * @param {string} [context.latestQuestion] - Current user question.
 * @param {Record<string, any>} [context.memoryData] - Memory state data.
 * @param {string} [context.provider] - Inference provider identifier.
 * @param {string} [context.engineType] - Engine type identifier.
 * @param {string} [context.model] - Active model identifier.
 * @param {import('@types').BrainCompressionOptions} [context.compressionOptions] - Compression configuration options.
 * @returns {Promise<Array<Object>> | Array<Object>} Compressed messages array.
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
        '[compressContext] customCompressor returned invalid messages array, falling back to strategy pipeline.'
      );
    } catch (error) {
      console.warn(
        '[compressContext] customCompressor execution failed, falling back to strategy pipeline:',
        error
      );
    }
  }

  // 若策略為 ROLLING_SUMMARY，執行滾動摘要壓縮
  if (limits.strategy === COMPRESSION_STRATEGY_MAP.ROLLING_SUMMARY) {
    const summary =
      typeof memoryData?.summary === 'string'
        ? memoryData.summary
        : typeof compressionOptions?.summary === 'string'
          ? compressionOptions.summary
          : '';
    const recentTurnsCount =
      typeof compressionOptions?.recentTurns === 'number' &&
      compressionOptions.recentTurns > 0
        ? compressionOptions.recentTurns
        : DEFAULT_SUMMARY_RECENT_TURNS;

    return rollingSummaryCompressor({
      messages,
      systemPrompt,
      summary,
      recentTurnsCount,
      maxTotalChars: limits.maxTotalChars
    });
  }

  // 預設執行滑動窗口壓縮
  return slidingWindowCompressor({
    messages,
    systemPrompt,
    maxTurns: limits.maxTurns,
    maxTotalChars: limits.maxTotalChars
  });
}
