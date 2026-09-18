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
import { toOpenAiTools } from '@/core/tools';
import type { BrainEngine, ToolDefinition } from '@types';
import {
  extractToolCallsFromText,
  executeToolCallsLoop
} from './tool-calling';
import {
  getBrainMessage,
  resolveAutoContinuePrompt,
  buildDefaultLLMMessages
} from './messages';

/**
 * Configuration options for the server-side AI Provider engine.
 */
export interface AiProviderOptions {
  enableAiProvider?: boolean;
  providerEnabled?: boolean;
  enabled?: boolean;
  providerBaseUrl?: string;
  baseUrl?: string;
  providerPingUrl?: string;
  pingUrl?: string;
  providerChatUrl?: string;
  chatUrl?: string;
  providerModel?: string;
  model?: string;
  providerCreateFetchSetting?: ((...args: any[]) => any) | RequestInit | null;
  createFetchSetting?: ((...args: any[]) => any) | RequestInit | null;
  providerCreateFetchPayload?: ((...args: any[]) => any) | Record<string, any> | null;
  createFetchPayload?: ((...args: any[]) => any) | Record<string, any> | null;
  providerResponseFormat?: ((...args: any[]) => any) | string | Record<string, any> | null;
  responseFormat?: ((...args: any[]) => any) | string | Record<string, any> | null;
  providerExtractToolCalls?: ((...args: any[]) => any) | null;
  extractToolCalls?: ((...args: any[]) => any) | null;
  providerMaxTokens?: number;
  maxTokens?: number;
  providerIsStream?: boolean;
  isStream?: boolean;
  onConnecting?: ((...args: any[]) => any) | null;
  onConnected?: ((...args: any[]) => any) | null;
  onError?: ((...args: any[]) => any) | null;
  onChatting?: ((...args: any[]) => any) | null;
  onStreamChatting?: ((...args: any[]) => any) | null;
}

/**
 * AI Provider engine instance interface.
 */
export interface AiProviderEngine {
  baseUrl: string;
  pingUrl: string;
  chatUrl: string;
  readonly createFetchSetting: any;
  readonly createFetchPayload: any;
  readonly responseFormat: any;
  readonly extractToolCalls: any;
  readonly maxTokens: number;
  readonly isStream: boolean;
  readonly onConnecting: (...args: any[]) => any;
  readonly onConnected: (...args: any[]) => any;
  readonly onError: (...args: any[]) => any;
  readonly onChatting: (...args: any[]) => any;
  readonly onStreamChatting: (...args: any[]) => any;
  model: string;
  enabled: boolean;
  ready: boolean;
  ping(fetchSetting?: any): Promise<boolean>;
  chat(
    messages: Array<Record<string, any>>,
    fetchSetting?: any,
    tools?: ToolDefinition[]
  ): Promise<any>;
}

/**
 * Initializes the AI Provider backend connection and client interface.
 *
 * @param setting - AI Provider options.
 * @returns Initialized AI Provider engine instance.
 */
export async function initAiProvider(
  setting: AiProviderOptions = {}
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
    onStreamChatting = null
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
      return function _onConnecting(...args: any[]) {
        if (typeof onConnecting === 'function') {
          return onConnecting(...args);
        }
      };
    },
    get onConnected() {
      return function _onConnected(...args: any[]) {
        if (typeof onConnected === 'function') {
          return onConnected(...args);
        }
      };
    },
    get onError() {
      return function _onError(...args: any[]) {
        if (typeof onError === 'function') {
          return onError(...args);
        }
      };
    },
    get onChatting() {
      return function _onChatting(...args: any[]) {
        if (typeof onChatting === 'function') {
          return onChatting(...args);
        }
      };
    },
    get onStreamChatting() {
      return function _onStreamChatting(...args: any[]) {
        if (typeof onStreamChatting === 'function') {
          return onStreamChatting(...args);
        }
      };
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
    async ping(fetchSetting = null): Promise<boolean> {
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
      messages: Array<Record<string, any>>,
      fetchSetting: any,
      tools?: ToolDefinition[]
    ): Promise<any> {
      try {
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
                let safeContent = '';
                if (typeof messageItem.content === 'string') {
                  safeContent = messageItem.content;
                } else if (
                  typeof messageItem.content === 'object' &&
                  messageItem.content !== null
                ) {
                  if (typeof messageItem.content.text === 'string') {
                    safeContent = messageItem.content.text;
                  } else if (typeof messageItem.content.content === 'string') {
                    safeContent = messageItem.content.content;
                  } else {
                    safeContent = JSON.stringify(messageItem.content);
                  }
                } else if (
                  typeof messageItem.content !== 'undefined' &&
                  messageItem.content !== null
                ) {
                  safeContent = String(messageItem.content);
                }
                return {
                  ...messageItem,
                  content: safeContent
                };
              })
            : [];

        const defaultPayload: Record<string, any> = {
          model: this.model,
          messages: sanitizedMessages,
          temperature: 0.4,
          max_tokens: this.maxTokens,
          stream: this.isStream
        };

        if (Array.isArray(tools) === true && tools.length > 0) {
          const openAiTools = toOpenAiTools(tools);
          if (openAiTools.length > 0) {
            defaultPayload.tools = openAiTools;
          }
        }

        const createSettingFn = this.createFetchSetting;
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
            fetchSetting = currentFetchSetting;
          }
        }

        if (typeof fetchSetting !== 'object' || fetchSetting === null) {
          fetchSetting = defaultFetchSetting;
        }

        const createPayloadFn = this.createFetchPayload;
        if (typeof createPayloadFn === 'function') {
          const currentPayload = await createPayloadFn(
            messages,
            tools,
            this.model,
            defaultPayload,
            fetchSetting,
            this
          );
          if (typeof currentPayload !== 'undefined') {
            fetchSetting.body = currentPayload;
          }
        }

        if (typeof fetchSetting.body === 'undefined') {
          fetchSetting.body = JSON.stringify(defaultPayload);
        }

        const response = await fetch(
          this.baseUrl + (this.chatUrl || '/chat/completions'),
          fetchSetting
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

        const formatResponseFn = this.responseFormat;
        if (typeof formatResponseFn === 'function') {
          return await formatResponseFn(response, fetchSetting, messages, this);
        }

        const result = await response.json();
        let toolCalls: any = null;
        if (typeof this.extractToolCalls === 'function') {
          toolCalls = await this.extractToolCalls(result, this);
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
        if (
          (toolCalls === null ||
            (Array.isArray(toolCalls) === true && toolCalls.length === 0)) &&
          typeof rawContent === 'string' &&
          rawContent !== ''
        ) {
          const fallbackToolCalls = extractToolCallsFromText(rawContent);
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
              content: rawContent,
              tool_calls: toolCalls
            },
            finishReason
          };
        }

        return {
          type: 'text',
          content: rawContent,
          finishReason
        };
      } catch (error) {
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
  brainEngine: BrainEngine | Record<string, any>,
  question: string
): Promise<void> {
  const engine = brainEngine as Record<string, any>;
  try {
    if (typeof engine.onSpokenDisplayTextChange === 'function') {
      engine.onSpokenDisplayTextChange(
        getBrainMessage(engine, 'brain.thinking')
      );
    }
    if (typeof engine.onEmotionChange === 'function') {
      engine.onEmotionChange('thinking');
    }

    let messages: Array<Record<string, any>>;
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

    const chatResponse = await engine.aiProvider.chat(
      messages,
      null,
      tools
    );

    if (
      typeof chatResponse === 'object' &&
      chatResponse !== null &&
      chatResponse.type === 'tool_calls'
    ) {
      return await executeToolCallsLoop(
        engine,
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
    let finishReason =
      typeof chatResponse?.finishReason === 'string'
        ? chatResponse.finishReason
        : LLM_FINISH_REASON_MAP.STOP;

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
    let chatMessageId: any = null;

    if (
      enableAutoContinue === true &&
      finishReason === LLM_FINISH_REASON_MAP.LENGTH
    ) {
      if (autoContinueMode === AUTO_CONTINUE_MODE_MAP.STREAM) {
        if (typeof engine.addChatMessage === 'function') {
          chatMessageId = engine.addChatMessage(
            'assistant',
            accumulatedText
          );
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

        const continueResponse = await engine.aiProvider.chat(
          currentMessages,
          null,
          []
        );

        const nextChunk =
          typeof continueResponse === 'string'
            ? continueResponse
            : typeof continueResponse?.content === 'string'
              ? continueResponse.content
              : '';
        finishReason =
          typeof continueResponse?.finishReason === 'string'
            ? continueResponse.finishReason
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
              chatMessageId,
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
          return engine.emitAnswer(accumulatedText);
        }
        return;
      } else {
        if (engine.memory?.enabled === true) {
          engine.memory.addTurn('assistant', accumulatedText);
        }
        if (typeof engine.triggerRollingSummaryIfNeeded === 'function') {
          engine.triggerRollingSummaryIfNeeded();
        }
        return;
      }
    }

    if (typeof engine.emitAnswer === 'function') {
      return engine.emitAnswer(accumulatedText);
    }
  } catch (error) {
    console.warn('AI Provider error', error);
    throw error;
  }
}
