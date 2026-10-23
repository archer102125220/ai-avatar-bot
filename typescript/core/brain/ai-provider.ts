import {
  CHAT_ROLE_MAP,
  DEFAULT_AI_PROVIDER_MODEL,
  DEFAULT_AI_PROVIDER_MAX_TOKENS,
  LLM_FINISH_REASON_MAP,
  BRAIN_ENGINE_TYPE_MAP,
  AUTO_CONTINUE_MODE_MAP,
  DEFAULT_AUTO_CONTINUE_MODE,
  DEFAULT_MAX_AUTO_CONTINUATIONS
} from '@/core/constants';
import { toOpenAiTools, type ToolDefinition } from '@/core/tools';
import type {
  ReasoningStartInfo,
  ReasoningChunkInfo,
  ReasoningEndInfo
} from '@/core/types';
import type {
  AiProviderOptions,
  AiProviderEngine,
  AiProviderChatResult,
  BrainEngine,
  LLMMessage,
  ParsedToolCall
} from './types';
import { extractToolCallsFromText, executeToolCallsLoop } from './tool-calling';
import {
  getBrainMessage,
  resolveAutoContinuePrompt,
  buildDefaultLLMMessages
} from './messages';
import { StreamParser } from './stream-parser';

export type { AiProviderOptions, AiProviderEngine };

/**
 * Initializes the AI Provider backend connection and client interface.
 *
 * @param setting - AI Provider options.
 * @param brain - Optional parent BrainEngine instance.
 * @returns Initialized AI Provider engine instance.
 */
export async function initAiProvider(
  setting: AiProviderOptions = {},
  brain?: BrainEngine | Record<string, unknown>
): Promise<AiProviderEngine> {
  const {
    enableAiProvider,
    providerEnabled,
    enabled,
    providerBaseUrl = '',
    baseUrl = '',
    providerPingUrl = '',
    pingUrl = '',
    providerChatUrl = '',
    chatUrl = '',
    providerModel = DEFAULT_AI_PROVIDER_MODEL,
    model = '',
    providerCreateFetchSetting = null,
    createFetchSetting = null,
    providerCreateFetchPayload = null,
    createFetchPayload = null,
    providerResponseFormat = null,
    responseFormat = null,
    providerExtractToolCalls = null,
    extractToolCalls = null,

    providerMaxTokens = DEFAULT_AI_PROVIDER_MAX_TOKENS,
    maxTokens,
    providerIsStream = false,
    isStream,

    onConnecting = null,
    onConnected = null,
    onError = null,
    onChatting = null,
    onStreamChatting = null,
    onReasoningStart = null,
    onReasoningChunk = null,
    onReasoningEnd = null,
    reasoning
  } = setting;

  const resolvedBaseUrl = providerBaseUrl || baseUrl || '';
  const resolvedPingUrl = providerPingUrl || pingUrl || '';
  const resolvedChatUrl = providerChatUrl || chatUrl || '';
  const resolvedModel = providerModel || model || DEFAULT_AI_PROVIDER_MODEL;
  const resolvedCreateFetchSetting =
    providerCreateFetchSetting || createFetchSetting || null;
  const resolvedCreateFetchPayload =
    providerCreateFetchPayload || createFetchPayload || null;
  const resolvedResponseFormat =
    providerResponseFormat || responseFormat || null;
  const resolvedExtractToolCalls =
    providerExtractToolCalls || extractToolCalls || null;
  const resolvedMaxTokens =
    typeof providerMaxTokens === 'number' &&
    Number.isFinite(providerMaxTokens) === true &&
    providerMaxTokens > 0
      ? providerMaxTokens
      : typeof maxTokens === 'number' &&
          Number.isFinite(maxTokens) === true &&
          maxTokens > 0
        ? maxTokens
        : DEFAULT_AI_PROVIDER_MAX_TOKENS;
  const resolvedIsStream =
    typeof providerIsStream === 'boolean'
      ? providerIsStream
      : typeof isStream === 'boolean'
        ? isStream
        : false;

  let isEnabled: boolean;
  if (typeof enableAiProvider === 'boolean') {
    isEnabled = enableAiProvider;
  } else if (typeof providerEnabled === 'boolean') {
    isEnabled = providerEnabled;
  } else if (typeof enabled === 'boolean') {
    isEnabled = enabled;
  } else {
    isEnabled = typeof resolvedBaseUrl === 'string' && resolvedBaseUrl !== '';
  }
  let _enabled = isEnabled;

  const aiProvider: AiProviderEngine = {
    baseUrl: resolvedBaseUrl,
    pingUrl: resolvedPingUrl,
    chatUrl: resolvedChatUrl,

    get createFetchSetting() {
      return resolvedCreateFetchSetting;
    },
    get createFetchPayload() {
      return resolvedCreateFetchPayload;
    },
    get responseFormat() {
      return resolvedResponseFormat;
    },
    get extractToolCalls() {
      return resolvedExtractToolCalls;
    },
    get maxTokens() {
      return resolvedMaxTokens;
    },
    get isStream() {
      return resolvedIsStream;
    },

    get onConnecting() {
      return function _onConnecting(...args: unknown[]) {
        if (typeof onConnecting === 'function') {
          return onConnecting(...args);
        }
      };
    },
    get onConnected() {
      return function _onConnected(...args: unknown[]) {
        if (typeof onConnected === 'function') {
          return onConnected(...args);
        }
      };
    },
    get onError() {
      return function _onError(...args: unknown[]) {
        if (typeof onError === 'function') {
          return onError(...args);
        }
      };
    },
    get onChatting() {
      return function _onChatting(...args: unknown[]) {
        if (typeof onChatting === 'function') {
          return onChatting(...args);
        }
      };
    },
    get onStreamChatting() {
      return function _onStreamChatting(...args: unknown[]) {
        if (typeof onStreamChatting === 'function') {
          return onStreamChatting(...args);
        }
      };
    },
    get onReasoningStart() {
      return function _onReasoningStart(info: ReasoningStartInfo) {
        if (typeof onReasoningStart === 'function') {
          onReasoningStart(info);
        } else if (
          typeof (brain as Partial<BrainEngine>)?.onReasoningStart ===
          'function'
        ) {
          (brain as Partial<BrainEngine>).onReasoningStart!(info);
        }
      };
    },
    get onReasoningChunk() {
      return function _onReasoningChunk(info: ReasoningChunkInfo) {
        if (typeof onReasoningChunk === 'function') {
          onReasoningChunk(info);
        } else if (
          typeof (brain as Partial<BrainEngine>)?.onReasoningChunk ===
          'function'
        ) {
          (brain as Partial<BrainEngine>).onReasoningChunk!(info);
        }
      };
    },
    get onReasoningEnd() {
      return function _onReasoningEnd(info: ReasoningEndInfo) {
        if (typeof onReasoningEnd === 'function') {
          onReasoningEnd(info);
        } else if (
          typeof (brain as Partial<BrainEngine>)?.onReasoningEnd ===
          'function'
        ) {
          (brain as Partial<BrainEngine>).onReasoningEnd!(info);
        }
      };
    },
    get reasoning() {
      return reasoning;
    },

    model: resolvedModel,
    get enabled() {
      return _enabled;
    },
    set enabled(value: boolean) {
      if (typeof value === 'boolean') {
        _enabled = value;
      }
    },
    ready: false,
    async ping(fetchSetting: RequestInit | null = null): Promise<boolean> {
      if (this.enabled === false) {
        return false;
      }
      try {
        await this.onConnecting(fetchSetting, this);
        const response = await fetch(
          this.baseUrl + (this.pingUrl || '/api/tags'),
          fetchSetting as RequestInit
        );
        this.ready = response.ok;
        await this.onConnected(response, fetchSetting, this);
        return response.ok;
      } catch (error) {
        console.error(error);
        this.ready = false;
        await this.onError(error, fetchSetting, this);
        return false;
      }
    },
    async chat(
      messages: LLMMessage[] | Array<Record<string, unknown>>,
      onDeltaOrFetchSetting?:
        | ((
            chunkDelta: string,
            accumulatedText: string,
            engine?: unknown,
            brain?: unknown,
            rawChunk?: unknown
          ) => void)
        | unknown,
      tools?: ToolDefinition[]
    ): Promise<AiProviderChatResult> {
      try {
        const onDelta =
          typeof onDeltaOrFetchSetting === 'function'
            ? (onDeltaOrFetchSetting as (
                chunkDelta: string,
                accumulatedText: string,
                engine?: unknown,
                brain?: unknown,
                rawChunk?: unknown
              ) => void)
            : null;
        const fetchSetting =
          typeof onDeltaOrFetchSetting === 'object' &&
          onDeltaOrFetchSetting !== null
            ? (onDeltaOrFetchSetting as RequestInit)
            : null;
        const defaultFetchSetting: RequestInit = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };
        const sanitizedMessages =
          Array.isArray(messages) === true
            ? messages.map((messageItem) => {
                if (typeof messageItem !== 'object' || messageItem === null) {
                  return messageItem;
                }
                const typedItem = messageItem as Record<string, unknown>;
                let safeContent = '';
                if (typeof typedItem.content === 'string') {
                  safeContent = typedItem.content;
                } else if (
                  typeof typedItem.content === 'object' &&
                  typedItem.content !== null
                ) {
                  const contentObj = typedItem.content as Record<
                    string,
                    unknown
                  >;
                  if (typeof contentObj.text === 'string') {
                    safeContent = contentObj.text;
                  } else if (typeof contentObj.content === 'string') {
                    safeContent = contentObj.content;
                  } else {
                    safeContent = JSON.stringify(typedItem.content);
                  }
                } else if (
                  typeof typedItem.content !== 'undefined' &&
                  typedItem.content !== null
                ) {
                  safeContent = String(typedItem.content);
                }
                return {
                  ...typedItem,
                  content: safeContent
                };
              })
            : [];

        const defaultPayload: Record<string, unknown> = {
          model: this.model,
          messages: sanitizedMessages,
          temperature: 0.4,
          max_tokens: this.maxTokens,
          stream: this.isStream,
          ...(this.reasoning?.mode === 'never'
            ? {
                extra_body: { enable_thinking: false },
                enable_thinking: false
              }
            : this.reasoning?.mode === 'always' ||
                this.reasoning?.mode === 'auto'
              ? {
                  extra_body: { enable_thinking: true },
                  enable_thinking: true
                }
              : {})
        };

        if (Array.isArray(tools) === true && tools.length > 0) {
          const openAiTools = toOpenAiTools(tools);
          if (openAiTools.length > 0) {
            defaultPayload.tools = openAiTools;
          }
        }

        let resolvedSetting = fetchSetting;
        const createSettingFn = this.createFetchSetting as
          | ((
              messages: LLMMessage[] | Array<Record<string, unknown>>,
              model: string,
              defaultFetchSetting: RequestInit,
              engine: AiProviderEngine
            ) => Promise<RequestInit> | RequestInit)
          | null;
        if (typeof createSettingFn === 'function') {
          const currentFetchSetting = await createSettingFn(
            messages,
            this.model,
            defaultFetchSetting,
            this
          );
          if (
            typeof currentFetchSetting === 'object' &&
            currentFetchSetting !== null
          ) {
            resolvedSetting = currentFetchSetting;
          }
        }

        if (typeof resolvedSetting !== 'object' || resolvedSetting === null) {
          resolvedSetting = defaultFetchSetting;
        }

        const createPayloadFn = this.createFetchPayload as
          | ((
              messages: LLMMessage[] | Array<Record<string, unknown>>,
              tools: ToolDefinition[] | undefined,
              model: string,
              defaultPayload: Record<string, unknown>,
              fetchSetting: RequestInit,
              engine: AiProviderEngine
            ) =>
              | Promise<BodyInit | null | undefined>
              | BodyInit
              | null
              | undefined)
          | null;
        if (typeof createPayloadFn === 'function') {
          const currentPayload = await createPayloadFn(
            messages,
            tools,
            this.model,
            defaultPayload,
            resolvedSetting,
            this
          );
          if (
            typeof currentPayload !== 'undefined' &&
            currentPayload !== null
          ) {
            resolvedSetting.body = currentPayload;
          }
        }

        if (typeof resolvedSetting.body === 'undefined') {
          resolvedSetting.body = JSON.stringify(defaultPayload);
        }

        const response = await fetch(
          this.baseUrl + (this.chatUrl || '/chat/completions'),
          resolvedSetting
        );

        if (response.ok !== true) {
          let errorMsg = `HTTP ${response.status} ${response.statusText}`;
          try {
            const errorText = await response.text();
            if (typeof errorText === 'string' && errorText !== '') {
              errorMsg += ` - ${errorText}`;
            }
          } catch (_parseError) {
            // Ignore parse error
          }
          throw new Error(errorMsg);
        }

        const formatResponseFn = this.responseFormat as
          | ((
              response: Response,
              fetchSetting: RequestInit,
              messages: LLMMessage[] | Array<Record<string, unknown>>,
              engine: AiProviderEngine
            ) => Promise<unknown> | unknown)
          | null;
        if (typeof formatResponseFn === 'function') {
          return (await formatResponseFn(
            response,
            resolvedSetting,
            messages,
            this
          )) as AiProviderChatResult;
        }

        if (
          this.isStream === true &&
          typeof onDelta === 'function' &&
          response.body &&
          typeof response.body.getReader === 'function'
        ) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          let streamFinishReason: string = LLM_FINISH_REASON_MAP.STOP;
          const toolCallsMap: Record<
            number,
            {
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }
          > = {};
          let hasToolCalls = false;

          const parser = new StreamParser({
            model: this.model,
            mode: this.reasoning?.mode,
            onReasoningStart: (info) => this.onReasoningStart?.(info),
            onReasoningChunk: (info) => this.onReasoningChunk?.(info),
            onReasoningEnd: (info) => this.onReasoningEnd?.(info),
            onAnswerChunk: (chunkDelta, accumulatedAnswer, rawChunk) => {
              onDelta(chunkDelta, accumulatedAnswer, this, brain, rawChunk);
              this.onStreamChatting(chunkDelta, accumulatedAnswer, brain);
            }
          });

          while (true) {
            const { done, value } = await reader.read();
            if (done === true) {
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line === '' || line.startsWith(':')) {
                continue;
              }
              if (line.startsWith('data:')) {
                const dataStr = line.slice(5).trim();
                if (dataStr === '[DONE]') {
                  continue;
                }
                try {
                  const parsed = JSON.parse(dataStr) as {
                    choices?: Array<{
                      delta?: {
                        content?: string;
                        reasoning_content?: string;
                        reasoning?: string;
                        tool_calls?: Array<{
                          index?: number;
                          id?: string;
                          function?: {
                            name?: string;
                            arguments?: string;
                          };
                        }>;
                      };
                      finish_reason?: string;
                    }>;
                  };
                  const choice = parsed?.choices?.[0];
                  if (
                    typeof choice?.finish_reason === 'string' &&
                    choice.finish_reason !== ''
                  ) {
                    streamFinishReason = choice.finish_reason;
                  }
                  const delta = choice?.delta;
                  if (
                    Array.isArray(delta?.tool_calls) === true &&
                    delta.tool_calls.length > 0
                  ) {
                    hasToolCalls = true;
                    delta.tool_calls.forEach((toolCallDelta) => {
                      const callIndex =
                        typeof toolCallDelta.index === 'number'
                          ? toolCallDelta.index
                          : 0;
                      if (toolCallsMap[callIndex] === undefined) {
                        toolCallsMap[callIndex] = {
                          id: toolCallDelta.id || `call_${callIndex}`,
                          type: 'function',
                          function: { name: '', arguments: '' }
                        };
                      }
                      if (
                        typeof toolCallDelta.id === 'string' &&
                        toolCallDelta.id !== ''
                      ) {
                        toolCallsMap[callIndex].id = toolCallDelta.id;
                      }
                      if (typeof toolCallDelta.function?.name === 'string') {
                        toolCallsMap[callIndex].function.name +=
                          toolCallDelta.function.name;
                      }
                      if (
                        typeof toolCallDelta.function?.arguments === 'string'
                      ) {
                        toolCallsMap[callIndex].function.arguments +=
                          toolCallDelta.function.arguments;
                      }
                    });
                  } else {
                    parser.feed(parsed);
                  }
                } catch (_jsonErr) {
                  parser.feed(dataStr);
                }
              }
            }
          }

          if (buffer.trim() !== '') {
            const line = buffer.trim();
            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              if (dataStr !== '[DONE]') {
                try {
                  const parsed = JSON.parse(dataStr);
                  parser.feed(parsed);
                } catch (_e) {
                  parser.feed(dataStr);
                }
              }
            }
          }

          const parseResult = parser.finish();

          if (hasToolCalls === true) {
            const toolCalls = Object.values(toolCallsMap);
            const toolMessage = {
              role: CHAT_ROLE_MAP.ASSISTANT,
              content: parseResult.answer,
              tool_calls: toolCalls
            };
            this.onChatting(toolMessage, messages, brain);
            return {
              type: 'tool_calls',
              toolCalls,
              message: toolMessage,
              finishReason: streamFinishReason
            };
          }

          const fallbackStreamToolCalls = extractToolCallsFromText(
            parseResult.answer
          );
          if (fallbackStreamToolCalls.length > 0) {
            const toolMessage = {
              role: CHAT_ROLE_MAP.ASSISTANT,
              content: parseResult.answer,
              tool_calls: fallbackStreamToolCalls
            };
            this.onChatting(toolMessage, messages, brain);
            return {
              type: 'tool_calls',
              toolCalls: fallbackStreamToolCalls,
              message: toolMessage,
              finishReason: streamFinishReason
            };
          }

          this.onChatting(parseResult.answer, messages, brain);
          return {
            type: 'text',
            content: parseResult.answer,
            reasoning: parseResult.reasoning,
            reasoningTimeMs: parseResult.reasoningTimeMs,
            finishReason: streamFinishReason
          };
        }

        const result = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
              reasoning_content?: string;
              reasoning?: string;
              thinking?: string;
              tool_calls?: unknown[];
            };
            finish_reason?: string;
          }>;
          done_reason?: string;
        };
        let toolCalls: unknown = null;
        const extractToolCallsFn = this.extractToolCalls as
          | ((
              result: unknown,
              engine: AiProviderEngine
            ) => Promise<unknown> | unknown)
          | null;
        if (typeof extractToolCallsFn === 'function') {
          toolCalls = await extractToolCallsFn(result, this);
        } else {
          toolCalls = result?.choices?.[0]?.message?.tool_calls || null;
        }

        const choice = result?.choices?.[0];
        const finishReason =
          typeof choice?.finish_reason === 'string' &&
          choice.finish_reason !== ''
            ? choice.finish_reason
            : typeof result?.done_reason === 'string' &&
                result.done_reason !== ''
              ? result.done_reason
              : LLM_FINISH_REASON_MAP.STOP;

        const rawContent = choice?.message?.content || '';
        const parser = new StreamParser({
          model: this.model,
          mode: this.reasoning?.mode,
          onReasoningStart: (info) => this.onReasoningStart?.(info),
          onReasoningChunk: (info) => this.onReasoningChunk?.(info),
          onReasoningEnd: (info) => this.onReasoningEnd?.(info)
        });
        parser.feed(choice || result || rawContent);
        const parseResult = parser.finish();

        if (
          (toolCalls === null ||
            (Array.isArray(toolCalls) === true && toolCalls.length === 0)) &&
          typeof rawContent === 'string' &&
          rawContent !== ''
        ) {
          const fallbackToolCalls = extractToolCallsFromText(
            parseResult.answer !== '' ? parseResult.answer : rawContent
          );
          if (fallbackToolCalls.length > 0) {
            toolCalls = fallbackToolCalls;
          }
        }

        if (Array.isArray(toolCalls) === true && toolCalls.length > 0) {
          return {
            type: 'tool_calls',
            toolCalls,
            message: choice?.message || {
              role: CHAT_ROLE_MAP.ASSISTANT,
              content: parseResult.answer,
              tool_calls: toolCalls
            },
            finishReason
          };
        }

        this.onChatting(result, messages, brain);
        return {
          type: 'text',
          content: parseResult.answer,
          reasoning: parseResult.reasoning,
          reasoningTimeMs: parseResult.reasoningTimeMs,
          finishReason
        };
      } catch (error) {
        console.error('[AiProvider] 請求或回應解析失敗:', error);
        this.ready = false;
        throw error;
      }
    }
  };

  if (aiProvider?.enabled === true) {
    await aiProvider.ping();
  }

  return aiProvider;
}

/**
 * Executes a conversational query using the server-side AI Provider backend with auto-continuation support.
 *
 * @param brainEngine - Brain engine instance.
 * @param question - User question text.
 */
export async function chatWithAiProvider(
  brainEngine: BrainEngine | Record<string, unknown>,
  question: string
): Promise<string | void> {
  const engine = brainEngine as Partial<BrainEngine>;
  try {
    if (typeof engine.onSpokenDisplayTextChange === 'function') {
      engine.onSpokenDisplayTextChange(
        getBrainMessage(engine, 'brain.thinking')
      );
    }
    if (typeof engine.onEmotionChange === 'function') {
      engine.onEmotionChange('thinking');
    }

    let messages: LLMMessage[];
    if (typeof engine.buildLLMMessages === 'function') {
      messages = await engine.buildLLMMessages(
        question,
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      );
    } else {
      messages = await buildDefaultLLMMessages(
        engine,
        question,
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      );
    }
    const tools =
      typeof engine.getTools === 'function' ? engine.getTools() : [];

    let streamMessageId: string | void = undefined;
    if (engine.aiProvider?.isStream === true) {
      if (typeof engine.onStreamStart === 'function') {
        engine.onStreamStart();
      }
      if (typeof engine.addChatMessage === 'function') {
        streamMessageId = engine.addChatMessage('assistant', '', {
          streaming: true
        });
      }
    }

    const onDeltaCallback =
      engine.aiProvider?.isStream === true
        ? (
            chunkDelta: string,
            currentStreamText: string,
            _engine?: unknown,
            _brain?: unknown,
            rawChunk?: unknown
          ) => {
            if (typeof engine.onSpokenDisplayTextChange === 'function') {
              engine.onSpokenDisplayTextChange(currentStreamText);
            }
            if (
              typeof engine.updateChatMessage === 'function' &&
              typeof streamMessageId === 'string'
            ) {
              engine.updateChatMessage(streamMessageId, currentStreamText, true);
            }
            if (typeof engine.applyEmotionFromText === 'function') {
              engine.applyEmotionFromText(currentStreamText);
            }
            if (typeof engine.onStreamChunk === 'function') {
              engine.onStreamChunk(chunkDelta, rawChunk);
            }
          }
        : null;

    const chatResponse = (await engine.aiProvider?.chat(
      messages,
      onDeltaCallback,
      tools
    )) as
      | {
          type?: string;
          toolCalls?: ParsedToolCall[];
          content?: string;
          reasoning?: string;
          reasoningTimeMs?: number;
          finishReason?: string;
        }
      | string
      | null
      | undefined;

    if (
      typeof chatResponse === 'object' &&
      chatResponse !== null &&
      chatResponse.type === 'tool_calls'
    ) {
      if (
        typeof engine.updateChatMessage === 'function' &&
        typeof streamMessageId === 'string'
      ) {
        engine.updateChatMessage(streamMessageId, '', false);
      }
      return await executeToolCallsLoop(
        engine as BrainEngine,
        chatResponse,
        messages,
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      );
    }

    const initialText =
      typeof chatResponse === 'string'
        ? chatResponse
        : typeof chatResponse?.content === 'string'
          ? chatResponse.content
          : '';
    const chatResponseObj =
      typeof chatResponse === 'object' && chatResponse !== null
        ? chatResponse
        : null;
    let finishReason =
      typeof chatResponseObj?.finishReason === 'string'
        ? chatResponseObj.finishReason
        : LLM_FINISH_REASON_MAP.STOP;
    const initialReasoning =
      typeof chatResponseObj?.reasoning === 'string' &&
      chatResponseObj.reasoning !== ''
        ? chatResponseObj.reasoning
        : undefined;
    const initialReasoningTimeMs =
      typeof chatResponseObj?.reasoningTimeMs === 'number' &&
      Number.isFinite(chatResponseObj.reasoningTimeMs) === true
        ? chatResponseObj.reasoningTimeMs
        : undefined;

    if (initialText.trim() === '') {
      throw new Error(
        'AI Provider 回應為空或格式錯誤 (response is empty or malformed)'
      );
    }

    let accumulatedText = initialText.trim();
    const enableAutoContinue = engine.enableAutoContinue === true;
    const maxAutoContinuations =
      typeof engine.maxAutoContinuations === 'number' &&
      Number.isFinite(engine.maxAutoContinuations) === true &&
      engine.maxAutoContinuations > 0
        ? engine.maxAutoContinuations
        : DEFAULT_MAX_AUTO_CONTINUATIONS;
    const autoContinueMode =
      engine.autoContinueMode || DEFAULT_AUTO_CONTINUE_MODE;

    let continuationIndex = 0;
    let currentMessages = [...messages];
    let currentAssistantContent = initialText.trim();
    let chatMessageId: string | void = undefined;

    if (
      enableAutoContinue === true &&
      finishReason === LLM_FINISH_REASON_MAP.LENGTH
    ) {
      if (autoContinueMode === AUTO_CONTINUE_MODE_MAP.STREAM) {
        if (typeof engine.addChatMessage === 'function') {
          chatMessageId = engine.addChatMessage('assistant', accumulatedText);
        }
        if (typeof engine.applyEmotionFromText === 'function') {
          engine.applyEmotionFromText(accumulatedText);
        }
        if (typeof engine.onSpokenAudioPlayNow === 'function') {
          engine.onSpokenAudioPlayNow(accumulatedText);
        }
      }

      while (
        finishReason === LLM_FINISH_REASON_MAP.LENGTH &&
        continuationIndex < maxAutoContinuations
      ) {
        continuationIndex++;
        const continuePrompt = resolveAutoContinuePrompt(
          engine,
          continuationIndex,
          accumulatedText
        );

        if (typeof engine.onAutoContinueStart === 'function') {
          engine.onAutoContinueStart({
            continuationIndex,
            maxContinuations: maxAutoContinuations,
            accumulatedText
          });
        }

        currentMessages = [
          ...currentMessages,
          {
            role: CHAT_ROLE_MAP.ASSISTANT,
            content: currentAssistantContent
          },
          {
            role: CHAT_ROLE_MAP.USER,
            content: continuePrompt
          }
        ];

        const continueResponse = (await engine.aiProvider?.chat(
          currentMessages,
          null,
          []
        )) as
          | { content?: string; finishReason?: string }
          | string
          | null
          | undefined;

        const nextChunk =
          typeof continueResponse === 'string'
            ? continueResponse
            : typeof continueResponse?.content === 'string'
              ? continueResponse.content
              : '';
        const continueResponseObj =
          typeof continueResponse === 'object' && continueResponse !== null
            ? continueResponse
            : null;
        finishReason =
          typeof continueResponseObj?.finishReason === 'string'
            ? continueResponseObj.finishReason
            : LLM_FINISH_REASON_MAP.STOP;

        if (nextChunk.trim() === '') {
          break;
        }

        accumulatedText += '\n' + nextChunk.trim();
        currentAssistantContent = nextChunk.trim();

        if (typeof engine.onAutoContinueResume === 'function') {
          engine.onAutoContinueResume({
            continuationIndex,
            maxContinuations: maxAutoContinuations,
            accumulatedText,
            chunk: nextChunk.trim()
          });
        }

        if (autoContinueMode === AUTO_CONTINUE_MODE_MAP.STREAM) {
          if (typeof engine.updateChatMessage === 'function') {
            engine.updateChatMessage(
              typeof chatMessageId === 'string' ? chatMessageId : '',
              accumulatedText,
              false
            );
          }
          if (typeof engine.applyEmotionFromText === 'function') {
            engine.applyEmotionFromText(nextChunk.trim());
          }
          if (typeof engine.onSpokenAudioPlayNow === 'function') {
            engine.onSpokenAudioPlayNow(nextChunk.trim());
          }
        }
      }

      if (typeof engine.onAutoContinueEnd === 'function') {
        engine.onAutoContinueEnd({
          totalContinuations: continuationIndex,
          maxContinuations: maxAutoContinuations,
          accumulatedText,
          reason: finishReason
        });
      }

      if (autoContinueMode === AUTO_CONTINUE_MODE_MAP.BUFFERED) {
        if (typeof engine.emitAnswer === 'function') {
          if (
            typeof initialReasoning === 'string' ||
            typeof initialReasoningTimeMs === 'number'
          ) {
            return engine.emitAnswer(
              accumulatedText,
              initialReasoning,
              initialReasoningTimeMs
            );
          }
          return engine.emitAnswer(accumulatedText);
        }
        return;
      } else {
        if (engine.memory?.enabled === true) {
          if (
            typeof initialReasoning === 'string' ||
            typeof initialReasoningTimeMs === 'number'
          ) {
            engine.memory.addTurn(
              'assistant',
              accumulatedText,
              initialReasoning,
              initialReasoningTimeMs
            );
          } else {
            engine.memory.addTurn('assistant', accumulatedText);
          }
        }
        if (typeof engine.triggerRollingSummaryIfNeeded === 'function') {
          engine.triggerRollingSummaryIfNeeded();
        }
        return;
      }
    }

    if (engine.aiProvider?.isStream === true) {
      if (engine.memory?.enabled === true) {
        if (
          typeof initialReasoning === 'string' ||
          typeof initialReasoningTimeMs === 'number'
        ) {
          engine.memory.addTurn(
            'assistant',
            accumulatedText,
            initialReasoning,
            initialReasoningTimeMs
          );
        } else {
          engine.memory.addTurn('assistant', accumulatedText);
        }
      }
      if (
        typeof engine.updateChatMessage === 'function' &&
        typeof streamMessageId === 'string'
      ) {
        engine.updateChatMessage(
          streamMessageId,
          accumulatedText,
          false,
          initialReasoning,
          initialReasoningTimeMs
        );
      }
      if (typeof engine.applyEmotionFromText === 'function') {
        engine.applyEmotionFromText(accumulatedText);
      }
      if (typeof engine.onSpokenAudioPlayNow === 'function') {
        engine.onSpokenAudioPlayNow(accumulatedText);
      }
      if (typeof engine.onStreamEnd === 'function') {
        engine.onStreamEnd(accumulatedText);
      }
      if (typeof engine.triggerRollingSummaryIfNeeded === 'function') {
        engine.triggerRollingSummaryIfNeeded();
      }
      return accumulatedText;
    }

    if (typeof engine.emitAnswer === 'function') {
      if (
        typeof initialReasoning === 'string' ||
        typeof initialReasoningTimeMs === 'number'
      ) {
        return engine.emitAnswer(
          accumulatedText,
          initialReasoning,
          initialReasoningTimeMs
        );
      }
      return engine.emitAnswer(accumulatedText);
    }
  } catch (error) {
    console.error('[AiProvider] chatWithAiProvider 執行失敗:', error);
    throw error;
  }
}
