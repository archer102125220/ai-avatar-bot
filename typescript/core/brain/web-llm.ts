import {
  STATE_MAP,
  CHAT_ROLE_MAP,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_FALLBACK_MODEL,
  DEFAULT_LLM_MAX_TOKENS,
  LLM_FINISH_REASON_MAP,
  BRAIN_ENGINE_TYPE_MAP,
  DEFAULT_MAX_AUTO_CONTINUATIONS,
  isWebLLMFunctionCallingSupported,
  REASONING_MODE_MAP
} from '@/core/constants';
import { toOpenAiTools, type ToolDefinition } from '@/core/tools';
import type {
  LlmOomFallbackInfo,
  ReasoningStartInfo,
  ReasoningChunkInfo,
  ReasoningEndInfo
} from '@/core/types';
import type {
  BrainEngine,
  LLMEngineOptions,
  LLMEngine,
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

export type { LLMEngineOptions, LLMEngine };

/**
 * Detects whether an error thrown during WebLLM operations is related to WebGPU memory allocation or OOM.
 *
 * @param error - The candidate error to evaluate.
 * @returns True if error indicates Out-Of-Memory or GPU allocation failure.
 */
export function isOomError(error: unknown): boolean {
  if (typeof error !== 'object' && typeof error !== 'string') {
    return false;
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /out of memory|oom|allocation|allocate|exhausted|buffer.*exceed|device.*lost|gpu.*lost|rangeerror/i.test(
    message
  );
}

interface MLCChatCompletionChoice {
  finish_reason?: string;
  delta?: {
    content?: string;
    tool_calls?: Array<{
      index?: number;
      id?: string;
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
  };
  message?: {
    content?: string;
    tool_calls?: unknown[];
  };
}

interface MLCChatCompletionResult {
  choices?: MLCChatCompletionChoice[];
}

interface MLCEngineInstance {
  chat: {
    completions: {
      create(
        options: Record<string, unknown>
      ): Promise<
        MLCChatCompletionResult | AsyncIterable<MLCChatCompletionResult>
      >;
    };
  };
}

/**
 * Initializes the WebLLM in-browser inference engine.
 *
 * @param setting - WebLLM options.
 * @param brain - Parent Brain engine instance.
 * @returns Initialized WebLLM engine controller.
 */
export function initWebLLM(
  setting: LLMEngineOptions = {},
  brain?: BrainEngine | Record<string, unknown>
): LLMEngine {
  const {
    llmModel,
    model,
    llmFallbackModel,
    fallbackModel,
    enableOomFallback = true,
    llmMaxTokens,
    maxTokens,
    llmIsStream,
    isStream,
    LLMIsStream = true,
    onLoading,
    onLoadProgress,
    onLoaded,
    onLoadError,
    onLlmOomFallback,
    onChatting,
    onStreamChatting,
    onReasoningStart,
    onReasoningChunk,
    onReasoningEnd,
    reasoning,
    temperature
  } = setting;

  const resolvedModel = llmModel || model || DEFAULT_LLM_MODEL;
  const resolvedTemperature =
    typeof temperature === 'number' && Number.isFinite(temperature) === true
      ? temperature
      : 0.6;

  const isFallbackExplicitlyDisabled =
    enableOomFallback === false ||
    llmFallbackModel === null ||
    llmFallbackModel === false ||
    fallbackModel === null ||
    fallbackModel === false;

  const resolvedFallbackModel =
    isFallbackExplicitlyDisabled === false
      ? typeof llmFallbackModel === 'string' && llmFallbackModel !== ''
        ? llmFallbackModel
        : typeof fallbackModel === 'string' && fallbackModel !== ''
          ? fallbackModel
          : DEFAULT_LLM_FALLBACK_MODEL
      : null;

  const resolvedMaxTokens =
    typeof llmMaxTokens === 'number' &&
    Number.isFinite(llmMaxTokens) === true &&
    llmMaxTokens > 0
      ? llmMaxTokens
      : typeof maxTokens === 'number' &&
          Number.isFinite(maxTokens) === true &&
          maxTokens > 0
        ? maxTokens
        : DEFAULT_LLM_MAX_TOKENS;

  const resolvedIsStream =
    typeof llmIsStream === 'boolean'
      ? llmIsStream
      : typeof isStream === 'boolean'
        ? isStream
        : typeof LLMIsStream === 'boolean'
          ? LLMIsStream
          : true;

  let engine: MLCEngineInstance | null = null;
  let loadingPromise: Promise<MLCEngineInstance> | null = null;

  const llm: LLMEngine = {
    get supported(): boolean {
      return typeof navigator !== 'undefined' && 'gpu' in navigator;
    },
    state: STATE_MAP.IDLE,
    progress: 0,
    model: resolvedModel,

    get temperature(): number {
      return resolvedTemperature;
    },
    get maxTokens(): number {
      return resolvedMaxTokens;
    },
    get isStream(): boolean {
      return resolvedIsStream;
    },
    get engine() {
      return engine;
    },

    get onLoading() {
      return function _onLoading(...args: unknown[]) {
        if (typeof onLoading === 'function') {
          return onLoading(...args);
        }
      };
    },
    get onLoadProgress() {
      return function _onLoadProgress(...args: unknown[]) {
        if (typeof onLoadProgress === 'function') {
          return onLoadProgress(...args);
        }
      };
    },
    get onLoaded() {
      return function _onLoaded(...args: unknown[]) {
        if (typeof onLoaded === 'function') {
          return onLoaded(...args);
        }
      };
    },
    get onLoadError() {
      return function _onLoadError(...args: unknown[]) {
        if (typeof onLoadError === 'function') {
          return onLoadError(...args);
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
    get onLlmOomFallback() {
      return function _onLlmOomFallback(info: LlmOomFallbackInfo) {
        if (typeof onLlmOomFallback === 'function') {
          onLlmOomFallback(info);
        } else if (
          typeof (brain as Partial<BrainEngine>)?.onLlmOomFallback ===
          'function'
        ) {
          (brain as Partial<BrainEngine>).onLlmOomFallback!(info);
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
    async load(): Promise<unknown> {
      if (typeof engine === 'object' && engine !== null) {
        return engine;
      }
      if (loadingPromise instanceof Promise === true) {
        return loadingPromise;
      }
      this.state = STATE_MAP.LOADING;
      this.onLoading();

      loadingPromise = (async () => {
        const webllm = await import('@mlc-ai/web-llm');
        const targetPrimaryModel = this.model || resolvedModel;

        const attemptCreateEngine = async (
          modelName: string
        ): Promise<MLCEngineInstance> => {
          const createdEngine = await webllm.CreateMLCEngine(modelName, {
            initProgressCallback: (progressInfo: { progress?: number }) => {
              this.progress = progressInfo.progress || 0;
              this.onLoadProgress(progressInfo);
            }
          });
          return createdEngine as unknown as MLCEngineInstance;
        };

        try {
          const createdEngine = await attemptCreateEngine(targetPrimaryModel);
          engine = createdEngine;
          this.state = STATE_MAP.READY;
          this.onLoaded(engine);
          return engine;
        } catch (primaryError: unknown) {
          const canFallback =
            isFallbackExplicitlyDisabled === false &&
            typeof resolvedFallbackModel === 'string' &&
            resolvedFallbackModel !== '' &&
            resolvedFallbackModel !== targetPrimaryModel &&
            isOomError(primaryError);

          if (canFallback === true && resolvedFallbackModel !== null) {
            console.warn(
              `[WebLLM] 首選模型 (${targetPrimaryModel}) 載入失敗 (OOM/記憶體不足)，嘗試自適應降級至保底模型 (${resolvedFallbackModel}):`,
              primaryError
            );

            const oomInfo: LlmOomFallbackInfo = {
              failedModel: targetPrimaryModel,
              fallbackModel: resolvedFallbackModel,
              error: primaryError
            };
            if (typeof onLlmOomFallback === 'function') {
              onLlmOomFallback(oomInfo);
            } else if (
              typeof (brain as Partial<BrainEngine>)?.onLlmOomFallback ===
              'function'
            ) {
              (brain as Partial<BrainEngine>).onLlmOomFallback!(oomInfo);
            }

            try {
              this.model = resolvedFallbackModel;
              const fallbackEngine =
                await attemptCreateEngine(resolvedFallbackModel);
              engine = fallbackEngine;
              this.state = STATE_MAP.READY;
              this.onLoaded(engine);
              return engine;
            } catch (fallbackError: unknown) {
              console.error(
                `[WebLLM] 降級備選模型 (${resolvedFallbackModel}) 亦載入失敗:`,
                fallbackError
              );
              this.state = STATE_MAP.ERROR;
              this.error = String(fallbackError);
              this.onLoadError(fallbackError, this);
              throw fallbackError;
            }
          }

          console.error('[WebLLM] 模型載入失敗:', primaryError);
          this.state = STATE_MAP.ERROR;
          this.error = String(primaryError);
          this.onLoadError(primaryError, this);
          throw primaryError;
        }
      })();

      return loadingPromise;
    },
    async chat(
      messages: LLMMessage[] | Array<Record<string, unknown>>,
      onDelta?:
        | ((
            chunkDelta: string,
            accumulatedText: string,
            llm?: unknown,
            brain?: unknown,
            rawChunk?: unknown
          ) => void)
        | null,
      tools?: ToolDefinition[]
    ): Promise<unknown> {
      if (typeof engine !== 'object' || engine === null) {
        return null;
      }

      const createOptions: Record<string, unknown> = {
        messages,
        temperature:
          typeof this.temperature === 'number' &&
          Number.isFinite(this.temperature) === true
            ? this.temperature
            : 0.6,
        repetition_penalty: 1.15,
        frequency_penalty: 0.25,
        presence_penalty: 0.15,
        stop: ['<|im_end|>', '<|endoftext|>', '<|im_start|>', '\n\n\n'],
        max_tokens:
          this.reasoning?.mode === REASONING_MODE_MAP.always
            ? Math.min(this.maxTokens, 1024)
            : Math.min(this.maxTokens, 512),
        ...(this.reasoning?.mode === REASONING_MODE_MAP.never
          ? { extra_body: { enable_thinking: false } }
          : this.reasoning?.mode === REASONING_MODE_MAP.always ||
              this.reasoning?.mode === REASONING_MODE_MAP.auto
            ? { extra_body: { enable_thinking: true } }
            : {})
      };

      const supportsFunctionCalling = isWebLLMFunctionCallingSupported(
        this.model
      );

      if (
        supportsFunctionCalling === true &&
        Array.isArray(tools) === true &&
        tools.length > 0
      ) {
        const openAiTools = toOpenAiTools(tools);
        if (openAiTools.length > 0) {
          createOptions.tools = openAiTools;

          if (Array.isArray(messages) === true) {
            const typedMessages = messages as LLMMessage[];
            const systemMsg = typedMessages.find(
              (messageItem) =>
                messageItem.role === CHAT_ROLE_MAP.SYSTEM ||
                messageItem.role === 'system'
            );
            const nonSystemMsgs = typedMessages.filter(
              (messageItem) =>
                messageItem.role !== CHAT_ROLE_MAP.SYSTEM &&
                messageItem.role !== 'system'
            );

            const systemInstruction =
              typeof systemMsg?.content === 'string'
                ? systemMsg.content.trim()
                : '';

            if (systemInstruction !== '') {
              const firstUserIndex = nonSystemMsgs.findIndex(
                (messageItem) =>
                  messageItem.role === CHAT_ROLE_MAP.USER ||
                  messageItem.role === 'user'
              );
              if (firstUserIndex !== -1) {
                createOptions.messages = nonSystemMsgs.map(
                  (messageItem, messageIndex) => {
                    if (messageIndex === firstUserIndex) {
                      return {
                        ...messageItem,
                        content: `[Instruction: ${systemInstruction}]\n\n${String(messageItem.content ?? '')}`
                      };
                    }
                    return messageItem;
                  }
                );
              } else {
                createOptions.messages = [
                  {
                    role: CHAT_ROLE_MAP.USER,
                    content: `[Instruction: ${systemInstruction}]`
                  },
                  ...nonSystemMsgs
                ];
              }
            } else {
              createOptions.messages = nonSystemMsgs;
            }
          }
        }
      }

      const executeChatCompletion = async (
        options: Record<string, unknown>
      ): Promise<unknown> => {
        const hasTools =
          Array.isArray(options.tools) === true && options.tools.length > 0;

        if (
          typeof onDelta !== 'function' ||
          this.isStream === false ||
          hasTools === true
        ) {
          const rawMessages =
            (options.messages as Array<Record<string, unknown>>) || [];
          const normalizedOptions = {
            ...options,
            messages: rawMessages.map(
              (messageItem: Record<string, unknown>) => ({
                ...messageItem,
                content:
                  typeof messageItem?.content === 'string'
                    ? messageItem.content
                    : ''
              })
            )
          };
          const rawResult =
            await engine!.chat.completions.create(normalizedOptions);
          const result = rawResult as MLCChatCompletionResult;
          const choice = result?.choices?.[0];
          const message = choice?.message;
          const finishReason =
            typeof choice?.finish_reason === 'string' &&
            choice.finish_reason !== ''
              ? choice.finish_reason
              : LLM_FINISH_REASON_MAP.STOP;

          if (
            Array.isArray(message?.tool_calls) === true &&
            message.tool_calls.length > 0
          ) {
            const normalizedAssistantMessage = {
              role: CHAT_ROLE_MAP.ASSISTANT,
              content:
                typeof message?.content === 'string' ? message.content : '',
              tool_calls: message.tool_calls
            };
            this.onChatting(result, messages, brain);
            return {
              type: 'tool_calls',
              toolCalls: message.tool_calls,
              message: normalizedAssistantMessage,
              finishReason
            };
          }

          const rawContent = message?.content || '';
          const parser = new StreamParser({
            model: this.model,
            mode: this.reasoning?.mode,
            onReasoningStart: (info) => this.onReasoningStart?.(info),
            onReasoningChunk: (info) => this.onReasoningChunk?.(info),
            onReasoningEnd: (info) => this.onReasoningEnd?.(info)
          });
          parser.feed(choice || message || rawContent);
          const parseResult = parser.finish();

          if (
            Array.isArray(message?.tool_calls) === false ||
            message.tool_calls.length === 0
          ) {
            const fallbackToolCalls = extractToolCallsFromText(
              parseResult.answer !== '' ? parseResult.answer : rawContent
            );
            if (fallbackToolCalls.length > 0) {
              const normalizedAssistantMessage = {
                role: CHAT_ROLE_MAP.ASSISTANT,
                content: parseResult.answer,
                tool_calls: fallbackToolCalls
              };
              this.onChatting(result, messages, brain);
              return {
                type: 'tool_calls',
                toolCalls: fallbackToolCalls,
                message: normalizedAssistantMessage,
                finishReason
              };
            }
          }

          this.onChatting(result, messages, brain);
          return {
            type: 'text',
            content: parseResult.answer,
            reasoning: parseResult.reasoning,
            reasoningTimeMs: parseResult.reasoningTimeMs,
            finishReason
          };
        }

        const rawMessages =
          (options.messages as Array<Record<string, unknown>>) || [];
        const streamOptions = {
          ...options,
          stream: true,
          messages: rawMessages.map((messageItem: Record<string, unknown>) => ({
            ...messageItem,
            content:
              typeof messageItem?.content === 'string'
                ? messageItem.content
                : ''
          }))
        };
        const stream = (await engine!.chat.completions.create(
          streamOptions
        )) as AsyncIterable<MLCChatCompletionResult>;
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
            onDelta(chunkDelta, accumulatedAnswer, llm, brain, rawChunk);
            this.onStreamChatting(chunkDelta, accumulatedAnswer, brain);
          }
        });

        for await (const chunk of stream) {
          if (parser.isFinished() === true) {
            break;
          }
          const choice = chunk?.choices?.[0];
          const delta = choice?.delta;
          if (
            typeof choice?.finish_reason === 'string' &&
            choice.finish_reason !== ''
          ) {
            streamFinishReason = choice.finish_reason;
          }
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
              if (typeof toolCallDelta.function?.arguments === 'string') {
                toolCallsMap[callIndex].function.arguments +=
                  toolCallDelta.function.arguments;
              }
            });
          } else {
            parser.feed(chunk);
            if (parser.isFinished() === true) {
              break;
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
      };

      try {
        const response = (await executeChatCompletion(createOptions)) as
          | {
              type?: string;
              content?: string;
              toolCalls?: unknown[];
              message?: unknown;
              finishReason?: string;
            }
          | string
          | null
          | undefined;
        const textContent =
          typeof response === 'string'
            ? response
            : typeof response?.content === 'string'
              ? response.content
              : '';
        const responseType =
          typeof response === 'object' && response !== null
            ? response.type
            : undefined;
        if (
          createOptions.tools !== undefined &&
          responseType !== 'tool_calls' &&
          (response === null ||
            response === undefined ||
            textContent.trim() === '')
        ) {
          delete createOptions.tools;
          createOptions.messages = messages;
          return await executeChatCompletion(createOptions);
        }
        return response;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          createOptions.tools !== undefined &&
          /not supported for ChatCompletionRequest\.tools|UnsupportedModelIdError|CustomSystemPromptError/i.test(
            errorMessage
          )
        ) {
          console.warn(
            `[AvatarBot] 當前 WebLLM 模型 (${this.model}) 呼叫 Function Calling 發生錯誤，已自動降級為純對話模式。`,
            error
          );
          delete createOptions.tools;
          createOptions.messages = messages;
          return await executeChatCompletion(createOptions);
        }
        console.error('[WebLLM] executeChatCompletion 呼叫失敗:', error);
        throw error;
      }
    }
  };

  return llm;
}

/**
 * Executes a conversational query using the in-browser WebLLM engine with streaming and auto-continuation support.
 *
 * @param brainEngine - Brain engine instance.
 * @param question - User question text.
 */
export async function chatWithWebLLM(
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
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM
      );
    } else {
      messages = await buildDefaultLLMMessages(
        engine,
        question,
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM
      );
    }
    const tools =
      typeof engine.getTools === 'function' ? engine.getTools() : [];

    if (typeof engine.onStreamStart === 'function') {
      engine.onStreamStart();
    }

    const streamMessageId = 'stream-' + Date.now();
    const chatResponse = (await engine.llm?.chat(
      messages,
      (
        chunkDelta: string,
        accumulatedText: string,
        _llm?: unknown,
        _brain?: unknown,
        rawChunk?: unknown
      ) => {
        if (typeof engine.onSpokenDisplayTextChange === 'function') {
          engine.onSpokenDisplayTextChange(accumulatedText);
        }
        if (typeof engine.updateChatMessage === 'function') {
          engine.updateChatMessage(streamMessageId, accumulatedText, true);
        }
        if (typeof engine.applyEmotionFromText === 'function') {
          engine.applyEmotionFromText(accumulatedText);
        }

        if (typeof engine.onStreamChunk === 'function') {
          engine.onStreamChunk(chunkDelta, rawChunk);
        }
      },
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
      if (typeof engine.updateChatMessage === 'function') {
        engine.updateChatMessage(streamMessageId, '', false);
      }
      return await executeToolCallsLoop(
        engine as BrainEngine,
        chatResponse,
        messages,
        BRAIN_ENGINE_TYPE_MAP.WEB_LLM
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
      console.warn('[WebLLM] 端側模型回應為空字串 (empty response)');
      if (typeof engine.onStreamEnd === 'function') {
        engine.onStreamEnd('');
      }
      throw new Error('WebLLM response is empty');
    }

    let accumulatedText = initialText.trim();
    const enableAutoContinue = engine.enableAutoContinue === true;
    const maxAutoContinuations =
      typeof engine.maxAutoContinuations === 'number' &&
      Number.isFinite(engine.maxAutoContinuations) === true &&
      engine.maxAutoContinuations > 0
        ? engine.maxAutoContinuations
        : DEFAULT_MAX_AUTO_CONTINUATIONS;

    let continuationIndex = 0;
    let currentMessages = [...messages];
    let currentAssistantContent = initialText.trim();

    if (
      enableAutoContinue === true &&
      finishReason === LLM_FINISH_REASON_MAP.LENGTH
    ) {
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

        let chunkDeltaBuffer = '';
        const continueResponse = (await engine.llm?.chat(
          currentMessages,
          (
            chunkDelta: string,
            currentStreamText: string,
            _llm?: unknown,
            _brain?: unknown,
            rawChunk?: unknown
          ) => {
            chunkDeltaBuffer = currentStreamText;
            const combinedText = accumulatedText + '\n' + currentStreamText;
            if (typeof engine.onSpokenDisplayTextChange === 'function') {
              engine.onSpokenDisplayTextChange(combinedText);
            }
            if (typeof engine.updateChatMessage === 'function') {
              engine.updateChatMessage(streamMessageId, combinedText, true);
            }
            if (typeof engine.applyEmotionFromText === 'function') {
              engine.applyEmotionFromText(currentStreamText);
            }

            if (typeof engine.onStreamChunk === 'function') {
              engine.onStreamChunk(chunkDelta, rawChunk);
            }
          },
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
              : chunkDeltaBuffer;
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
      }

      if (typeof engine.onAutoContinueEnd === 'function') {
        engine.onAutoContinueEnd({
          totalContinuations: continuationIndex,
          maxContinuations: maxAutoContinuations,
          accumulatedText,
          reason: finishReason
        });
      }
    }

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
    if (typeof engine.updateChatMessage === 'function') {
      engine.updateChatMessage(
        streamMessageId,
        accumulatedText,
        false,
        initialReasoning,
        initialReasoningTimeMs
      );
    }

    if (typeof engine.onStreamEnd === 'function') {
      engine.onStreamEnd(accumulatedText);
    }
    if (typeof engine.triggerRollingSummaryIfNeeded === 'function') {
      engine.triggerRollingSummaryIfNeeded();
    }
    return accumulatedText;
  } catch (error) {
    console.error('[WebLLM] chatWithWebLLM 執行錯誤:', error);
    throw error;
  }
}
