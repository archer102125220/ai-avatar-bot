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
import type { BrainCompressionOptions, LLMMessage } from './types';

/**
 * Resolved context compression limits and strategy configuration.
 */
export interface ResolvedCompressionLimits {
  strategy: string;
  maxTurns: number;
  maxTotalChars: number;
}

/**
 * Resolves context compression limits for a specific inference engine.
 * Precedence: Engine-specific (`webLlm` / `aiProvider`) -> Global (`maxTurns` / `maxTotalChars`) -> Default values.
 *
 * @param compressionOptions - Compression options.
 * @param engineType - Active inference engine type.
 * @returns Resolved limits and strategy configuration.
 */
export function resolveCompressionLimits(
  compressionOptions: BrainCompressionOptions = {},
  engineType: string = BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
): ResolvedCompressionLimits {
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

  const fallbackMaxTurns =
    isWebLLM === true
      ? DEFAULT_WEB_LLM_MAX_TURNS
      : DEFAULT_AI_PROVIDER_MAX_TURNS;
  const fallbackMaxChars =
    isWebLLM === true
      ? DEFAULT_WEB_LLM_MAX_CHARS
      : DEFAULT_AI_PROVIDER_MAX_CHARS;

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
 * @param input - Input text, message, or message array.
 * @returns Estimated character count.
 */
export function estimateChars(input: unknown): number {
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
    const inputObj = input as Record<string, unknown>;
    let charCount = 0;
    if (typeof inputObj.content === 'string') {
      charCount += inputObj.content.length;
    }
    if (
      Array.isArray(inputObj.tool_calls) === true &&
      inputObj.tool_calls.length > 0
    ) {
      for (const toolCall of inputObj.tool_calls) {
        if (typeof toolCall === 'object' && toolCall !== null) {
          const fn = (
            toolCall as { function?: { name?: string; arguments?: string } }
          ).function;
          if (typeof fn?.arguments === 'string') {
            charCount += fn.arguments.length;
          }
          if (typeof fn?.name === 'string') {
            charCount += fn.name.length;
          }
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
 * @param messages - Message array to sanitize.
 * @returns Sanitized message array.
 */
export function sanitizeToolCalls(messages: LLMMessage[]): LLMMessage[] {
  if (Array.isArray(messages) === false || messages.length === 0) {
    return [];
  }

  const validToolCallIds = new Set<string>();
  for (const message of messages) {
    if (
      typeof message === 'object' &&
      message !== null &&
      Array.isArray(message.tool_calls) === true &&
      message.tool_calls.length > 0
    ) {
      for (const toolCall of message.tool_calls as Array<{ id?: string }>) {
        if (typeof toolCall?.id === 'string' && toolCall.id !== '') {
          validToolCallIds.add(toolCall.id);
        }
      }
    }
  }

  const sanitizedMessages: LLMMessage[] = [];
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (typeof message !== 'object' || message === null) {
      continue;
    }

    const isTool =
      message.role === CHAT_ROLE_MAP.TOOL || message.role === 'tool';
    if (isTool === true) {
      const toolCallId = message.tool_call_id;
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
 * @param historyMessages - History messages array.
 * @returns Grouped turns array.
 */
export function groupMessagesIntoTurns(
  historyMessages: LLMMessage[]
): LLMMessage[][] {
  if (
    Array.isArray(historyMessages) === false ||
    historyMessages.length === 0
  ) {
    return [];
  }

  const turns: LLMMessage[][] = [];
  let currentTurn: LLMMessage[] = [];

  for (let index = 0; index < historyMessages.length; index++) {
    const message = historyMessages[index];
    if (typeof message !== 'object' || message === null) {
      continue;
    }

    const isUser =
      message.role === CHAT_ROLE_MAP.USER || message.role === 'user';
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
 * Compresses context by preserving the system prompt, most recent complete conversation turns, and the latest user turn.
 *
 * @param options - Sliding window compression options.
 * @returns Compressed messages array.
 */
export function slidingWindowCompressor({
  messages,
  systemPrompt = '',
  maxTurns = DEFAULT_MAX_HISTORY_TURNS,
  maxTotalChars = DEFAULT_MAX_TOTAL_CHARS
}: {
  messages: LLMMessage[];
  systemPrompt?: string;
  maxTurns?: number;
  maxTotalChars?: number;
}): LLMMessage[] {
  if (Array.isArray(messages) === false || messages.length === 0) {
    return [];
  }

  let systemMessage: LLMMessage | null = null;
  let latestUserMessage: LLMMessage | null = null;
  const rawHistory: LLMMessage[] = [];

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

  if (typeof systemPrompt === 'string' && systemPrompt !== '') {
    systemMessage = { role: CHAT_ROLE_MAP.SYSTEM, content: systemPrompt };
  }

  const systemChars = systemMessage !== null ? estimateChars(systemMessage) : 0;
  const latestUserChars =
    latestUserMessage !== null ? estimateChars(latestUserMessage) : 0;
  const reservedChars = systemChars + latestUserChars;

  const availableBudget = Math.max(0, maxTotalChars - reservedChars);

  const turns = groupMessagesIntoTurns(rawHistory);
  const selectedTurns: LLMMessage[][] = [];
  let accumulatedChars = 0;

  for (let turnIndex = turns.length - 1; turnIndex >= 0; turnIndex--) {
    if (selectedTurns.length >= maxTurns) {
      break;
    }

    const turn = turns[turnIndex];
    const turnChars = estimateChars(turn);

    if (
      selectedTurns.length > 0 &&
      accumulatedChars + turnChars > availableBudget
    ) {
      break;
    }

    selectedTurns.unshift(turn);
    accumulatedChars += turnChars;
  }

  const selectedHistory: LLMMessage[] = [];
  for (const turn of selectedTurns) {
    for (const message of turn) {
      selectedHistory.push(message);
    }
  }

  const finalMessages: LLMMessage[] = [];
  if (systemMessage !== null) {
    finalMessages.push(systemMessage);
  }
  for (const message of selectedHistory) {
    finalMessages.push(message);
  }
  if (latestUserMessage !== null) {
    finalMessages.push(latestUserMessage);
  }

  return sanitizeToolCalls(finalMessages);
}

/**
 * Generates an updated rolling summary of conversation turns.
 *
 * @param params - Summary generation parameters.
 * @returns Generated concise summary string.
 */
export async function generateRollingSummary({
  oldSummary = '',
  newTurns = [],
  locale = 'zh-TW',
  llmChat = null,
  customGenerator = null
}: {
  oldSummary?: string;
  newTurns?: LLMMessage[] | Array<{ role: string; content: string }>;
  locale?: string;
  llmChat?:
    | ((
        promptMsgs: Array<{ role: string; content: string }>
      ) => Promise<string>)
    | null;
  customGenerator?:
    | ((params: {
        oldSummary: string;
        newTurns: LLMMessage[] | Array<{ role: string; content: string }>;
        locale: string;
      }) => Promise<string> | string)
    | null;
}): Promise<string> {
  if (Array.isArray(newTurns) === false || newTurns.length === 0) {
    return oldSummary;
  }

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

  const formattedTurns = newTurns
    .map((message) => {
      const roleLabel =
        message.role === CHAT_ROLE_MAP.USER || message.role === 'user'
          ? '使用者'
          : 'AI';
      const contentStr =
        typeof message.content === 'string' ? message.content : '';
      return `${roleLabel}: ${contentStr}`;
    })
    .join('\n');

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

  const extractedPoints = newTurns
    .filter(
      (message) =>
        typeof message.content === 'string' && message.content.trim() !== ''
    )
    .map((message) => {
      const isUser =
        message.role === CHAT_ROLE_MAP.USER || message.role === 'user';
      const prefix = isUser === true ? '問' : '答';
      const contentStr =
        typeof message.content === 'string' ? message.content : '';
      const cleanContent = contentStr.replace(/\s+/g, ' ').slice(0, 60);
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
 * @param options - Rolling summary compressor parameters.
 * @returns Compressed message array with injected summary.
 */
export function rollingSummaryCompressor({
  messages,
  systemPrompt = '',
  summary = '',
  recentTurnsCount = DEFAULT_SUMMARY_RECENT_TURNS,
  maxTotalChars = DEFAULT_MAX_TOTAL_CHARS
}: {
  messages: LLMMessage[];
  systemPrompt?: string;
  summary?: string;
  recentTurnsCount?: number;
  maxTotalChars?: number;
}): LLMMessage[] {
  if (Array.isArray(messages) === false || messages.length === 0) {
    return [];
  }

  const originalSystemPrompt =
    typeof systemPrompt === 'string' && systemPrompt !== ''
      ? systemPrompt
      : (messages.find(
          (message) =>
            message.role === CHAT_ROLE_MAP.SYSTEM || message.role === 'system'
        )?.content as string) || '';

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
 * @param context - Compression context descriptor.
 * @returns Compressed messages array.
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
}: {
  messages: LLMMessage[];
  systemPrompt?: string;
  history?: Array<{ role: string; content: string }>;
  latestQuestion?: string;
  memoryData?: Record<string, unknown>;
  provider?: string;
  engineType?: string;
  model?: string;
  compressionOptions?: BrainCompressionOptions;
}): Promise<LLMMessage[]> {
  if (Array.isArray(messages) === false || messages.length === 0) {
    return [];
  }

  const effectiveEngineType =
    engineType || provider || BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER;
  const limits = resolveCompressionLimits(
    compressionOptions,
    effectiveEngineType
  );

  if (limits.strategy === COMPRESSION_STRATEGY_MAP.NONE) {
    return sanitizeToolCalls(messages);
  }

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

  if (limits.strategy === COMPRESSION_STRATEGY_MAP.ROLLING_SUMMARY) {
    const summary =
      typeof memoryData?.summary === 'string'
        ? memoryData.summary
        : typeof (compressionOptions as Record<string, unknown>)?.summary ===
            'string'
          ? ((compressionOptions as Record<string, unknown>).summary as string)
          : '';
    const recentTurnsCount =
      typeof (compressionOptions as Record<string, unknown>)?.recentTurns ===
        'number' &&
      ((compressionOptions as Record<string, unknown>).recentTurns as number) >
        0
        ? ((compressionOptions as Record<string, unknown>)
            .recentTurns as number)
        : DEFAULT_SUMMARY_RECENT_TURNS;

    return rollingSummaryCompressor({
      messages,
      systemPrompt,
      summary,
      recentTurnsCount,
      maxTotalChars: limits.maxTotalChars
    });
  }

  return slidingWindowCompressor({
    messages,
    systemPrompt,
    maxTurns: limits.maxTurns,
    maxTotalChars: limits.maxTotalChars
  });
}
