import {
  CHAT_SOURCE_MAP,
  DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS,
  TOOL_CANCEL_REASON_MAP,
  TOOL_EVENT_MAP,
  TOOL_RESULT_MODE_MAP
} from '@/core/constants';
import type {
  ToolsEngine,
  ToolsEngineOptions,
  ToolDefinition,
  ToolRouteCandidate,
  ToolRouteResult,
  ToolResultData,
  ToolEventName,
  ToolOfferInfo,
  ToolInputRequiredInfo,
  ToolAmbiguousInfo,
  ToolConfirmInfo,
  ToolCancelInfo,
  ToolExecuteInfo,
  PendingToolData
} from './types';
import {
  normalizeTool,
  getAiAvailableTools,
  toOpenAiTools,
  argumentSummary
} from './schema';
import { route } from './router';
import { extract } from './validator';

export * from './types';
export * from './utils';
export * from './schema';
export * from './router';
export * from './validator';

/**
 * Creates and initializes the Tools Engine instance for tool routing, parameter extraction, and execution.
 *
 * @param options - Engine configuration options and event callbacks.
 * @returns Tools engine controller instance.
 */
export function initToolsEngine(options: ToolsEngineOptions = {}): ToolsEngine {
  let registeredTools: ToolDefinition[] = Array.isArray(options.tools)
    ? [...options.tools]
    : [];
  const pendingToolsMap = new Map<string, PendingToolData>();

  function resolveContext(
    overrideContext?: Record<string, unknown> | null
  ): Record<string, unknown> {
    const baseContextRaw =
      typeof options.context === 'function'
        ? options.context()
        : options.context;
    const baseContext =
      typeof baseContextRaw === 'object' && baseContextRaw !== null
        ? baseContextRaw
        : {};
    const extraContext =
      typeof overrideContext === 'object' && overrideContext !== null
        ? overrideContext
        : {};
    return {
      ...baseContext,
      ...extraContext
    };
  }

  function isLikelyContextObject(
    obj?: Record<string, unknown> | null
  ): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    return (
      'skinEngine' in obj ||
      'brainEngine' in obj ||
      'speechEngine' in obj ||
      'aiAvatarWidget' in obj ||
      'i18nEngine' in obj
    );
  }

  function emitToolEvent(
    eventName: ToolEventName,
    payload:
      | ToolOfferInfo
      | ToolInputRequiredInfo
      | ToolAmbiguousInfo
      | ToolConfirmInfo
      | ToolCancelInfo
      | ToolExecuteInfo
      | ToolResultData
  ): void {
    switch (eventName) {
      case TOOL_EVENT_MAP.OFFER:
        if (typeof options.onToolOffer === 'function') {
          options.onToolOffer(payload as ToolOfferInfo);
        }
        break;
      case TOOL_EVENT_MAP.INPUT_REQUIRED:
        if (typeof options.onToolInputRequired === 'function') {
          options.onToolInputRequired(payload as ToolInputRequiredInfo);
        }
        break;
      case TOOL_EVENT_MAP.AMBIGUOUS:
        if (typeof options.onToolAmbiguous === 'function') {
          options.onToolAmbiguous(payload as ToolAmbiguousInfo);
        }
        break;
      case TOOL_EVENT_MAP.CONFIRM:
        if (typeof options.onToolConfirm === 'function') {
          options.onToolConfirm(payload as ToolConfirmInfo);
        }
        break;
      case TOOL_EVENT_MAP.CANCEL:
        if (typeof options.onToolCancel === 'function') {
          options.onToolCancel(payload as ToolCancelInfo);
        }
        break;
      case TOOL_EVENT_MAP.EXECUTE:
        if (typeof options.onToolExecute === 'function') {
          options.onToolExecute(payload as ToolExecuteInfo);
        }
        break;
      case TOOL_EVENT_MAP.RESULT:
        if (typeof options.onToolResult === 'function') {
          options.onToolResult(payload as ToolResultData);
        }
        break;
    }
    if (typeof options.onToolEvent === 'function') {
      options.onToolEvent(eventName, payload);
    }
  }

  function getToolByName(name: string): ToolDefinition | null {
    if (typeof name !== 'string' || name.trim() === '') {
      return null;
    }
    const targetName = name.trim();
    const matchedTool = (
      Array.isArray(toolsEngine.tools) ? toolsEngine.tools : []
    ).find(
      (toolItem) =>
        typeof toolItem === 'object' &&
        toolItem !== null &&
        (toolItem.name === targetName ||
          normalizeTool(toolItem).name === targetName)
    );
    if (typeof matchedTool !== 'object' || matchedTool === null) {
      return null;
    }
    return normalizeTool(matchedTool);
  }

  function routeTool(queryText: string): ToolRouteResult {
    return route(toolsEngine.tools, queryText);
  }

  function parameterPrompt(
    tool: ToolDefinition,
    propertyName: string,
    errorText?: string
  ): string {
    const propertySchema = tool.inputSchema?.properties?.[propertyName] || {};
    const label = propertySchema.title || propertyName;
    const choices =
      Array.isArray(propertySchema.enum) === true &&
      propertySchema.enum.length > 0
        ? `（可選：${propertySchema.enum.join('、')}）`
        : '';
    const errorPrefix =
      typeof errorText === 'string' && errorText !== '' ? `${errorText}。` : '';
    return `${errorPrefix}執行「${tool.label || tool.name}」前，請提供${label}${choices}。`;
  }

  function prepareTool(
    tool: ToolDefinition,
    query: string,
    routeMeta?: Record<string, unknown> | null,
    existingArgs?: Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    const isFourthArgContext =
      context === undefined && isLikelyContextObject(existingArgs) === true;
    const resolvedExistingArgs =
      isFourthArgContext === true
        ? {}
        : typeof existingArgs === 'object' && existingArgs !== null
          ? existingArgs
          : {};
    const resolvedContext = resolveContext(
      isFourthArgContext === true ? existingArgs : context
    );

    const extractedParams = extract(
      tool,
      query,
      resolvedContext,
      resolvedExistingArgs,
      null,
      false
    );
    if (extractedParams.missing.length > 0) {
      toolsEngine.pendingToolInput = {
        tool,
        query,
        routeMeta: routeMeta || {},
        args: extractedParams.args,
        missing: extractedParams.missing,
        context: resolvedContext
      };
      const promptMessage = parameterPrompt(
        tool,
        extractedParams.missing[0],
        extractedParams.errors[0] || ''
      );
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', promptMessage, {
          source: 'tool'
        });
      }
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow(promptMessage);
      }
      emitToolEvent(TOOL_EVENT_MAP.INPUT_REQUIRED, {
        name: tool.name,
        field: extractedParams.missing[0]
      });
      return;
    }
    toolsEngine.pendingToolInput = null;
    offerTool(tool, query, routeMeta, extractedParams.args, {
      context: resolvedContext
    });
  }

  function continueToolInput(inputText: string): boolean {
    if (
      typeof toolsEngine.pendingToolInput !== 'object' ||
      toolsEngine.pendingToolInput === null
    ) {
      return false;
    }
    if (
      /^(取消|不要|算了|cancel)$/i.test(String(inputText || '').trim()) === true
    ) {
      const cancelledToolName = toolsEngine.pendingToolInput.tool.name;
      toolsEngine.pendingToolInput = null;
      const cancelMessage = '好的，已取消這個操作。';
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', cancelMessage, {
          source: 'tool'
        });
      }
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow(cancelMessage);
      }
      emitToolEvent(TOOL_EVENT_MAP.CANCEL, {
        name: cancelledToolName,
        reason: TOOL_CANCEL_REASON_MAP.USER_CANCEL,
        toolCallId: null
      });
      return true;
    }
    const pendingInput = toolsEngine.pendingToolInput;
    const resolvedContext = resolveContext(pendingInput.context);
    const missingField = pendingInput.missing[0];
    const extractedParams = extract(
      pendingInput.tool,
      inputText,
      resolvedContext,
      pendingInput.args,
      [missingField],
      true
    );
    if (extractedParams.missing.length > 0) {
      pendingInput.args = extractedParams.args;
      pendingInput.missing = extractedParams.missing;
      const promptMessage = parameterPrompt(
        pendingInput.tool,
        extractedParams.missing[0],
        extractedParams.errors[0] || '輸入格式不正確'
      );
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', promptMessage, {
          source: 'tool'
        });
      }
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow(promptMessage);
      }
      emitToolEvent(TOOL_EVENT_MAP.INPUT_REQUIRED, {
        name: pendingInput.tool.name,
        field: extractedParams.missing[0]
      });
      return true;
    }
    prepareTool(
      pendingInput.tool,
      pendingInput.query,
      pendingInput.routeMeta,
      extractedParams.args,
      resolvedContext
    );
    return true;
  }

  function offerToolChoices(
    query: string,
    candidates: ToolRouteCandidate[],
    context?: Record<string, unknown>
  ): void {
    const candidateChoices = candidates.slice(0, 3);
    const resolvedContext = resolveContext(context);
    const choiceMessage = `我找到幾個可能的操作，請選擇：${candidateChoices
      .map(
        (choiceItem, choiceIndex) =>
          `${choiceIndex + 1}「${choiceItem.tool.label || choiceItem.tool.name}」`
      )
      .join('、')}`;

    let messageId: string | void | undefined;
    if (typeof toolsEngine.onAddChatMessage === 'function') {
      messageId = toolsEngine.onAddChatMessage('assistant', choiceMessage, {
        pendingChoices: candidateChoices,
        source: 'tool'
      });
    }

    if (typeof messageId === 'string' && messageId !== '') {
      const chatLog =
        typeof options.getChatLog === 'function' ? options.getChatLog() : [];
      const chatMessage = chatLog.find(
        (entry: Record<string, unknown>) => entry.id === messageId
      );
      if (typeof chatMessage === 'object' && chatMessage !== null) {
        chatMessage.choiceQuery = query;
      }
    }

    toolsEngine.pendingToolChoice = {
      messageId: typeof messageId === 'string' ? messageId : '',
      choices: candidateChoices,
      query,
      context: resolvedContext
    };

    if (typeof toolsEngine.onSetHistoryOpen === 'function') {
      toolsEngine.onSetHistoryOpen(true);
    }
    if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
      toolsEngine.onSpokenAudioPlayNow(choiceMessage);
    }
    emitToolEvent(TOOL_EVENT_MAP.AMBIGUOUS, {
      names: candidateChoices.map((choiceItem) => choiceItem.tool.name),
      candidates: candidateChoices
    });
  }

  function continueToolChoice(inputText: string): boolean {
    if (
      typeof toolsEngine.pendingToolChoice !== 'object' ||
      toolsEngine.pendingToolChoice === null
    ) {
      return false;
    }
    if (
      /^(取消|不要|算了|cancel)$/i.test(String(inputText || '').trim()) === true
    ) {
      const cancelledChoiceName = toolsEngine.pendingToolChoice.choices
        .map((choiceItem) => choiceItem.tool.name)
        .join(',');
      const chatLog =
        typeof options.getChatLog === 'function' ? options.getChatLog() : [];
      const chatMessage = chatLog.find(
        (entry: Record<string, unknown>) =>
          entry.id === toolsEngine.pendingToolChoice?.messageId
      );
      if (typeof chatMessage === 'object' && chatMessage !== null) {
        chatMessage.pendingChoices = null;
        chatMessage.text = '好的，已取消。';
      }
      toolsEngine.pendingToolChoice = null;

      if (typeof toolsEngine.onRenderHistory === 'function') {
        toolsEngine.onRenderHistory();
      }
      const cancelMessage = '好的，已取消這個操作。';
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow(cancelMessage);
      }
      emitToolEvent(TOOL_EVENT_MAP.CANCEL, {
        name: cancelledChoiceName,
        reason: TOOL_CANCEL_REASON_MAP.USER_CANCEL,
        toolCallId: null
      });
      return true;
    }

    let choiceIndex =
      /(?:第一|1|一)/.test(inputText) === true
        ? 0
        : /(?:第二|2|二)/.test(inputText) === true
          ? 1
          : /(?:第三|3|三)/.test(inputText) === true
            ? 2
            : -1;

    if (choiceIndex < 0) {
      const routedResult = route(
        toolsEngine.pendingToolChoice.choices.map(
          (candidateItem) => candidateItem.tool
        ),
        inputText
      );
      if (routedResult.match !== null) {
        choiceIndex = toolsEngine.pendingToolChoice.choices.findIndex(
          (candidateItem) =>
            candidateItem.tool.name === routedResult.match?.tool.name
        );
      }
    }

    if (
      choiceIndex >= 0 &&
      toolsEngine.pendingToolChoice.choices[choiceIndex] !== undefined
    ) {
      chooseTool(toolsEngine.pendingToolChoice.messageId, choiceIndex);
      return true;
    }

    const promptMessage = '請說「第一個、第二個、第三個」，或點選你要的操作。';
    if (typeof toolsEngine.onAddChatMessage === 'function') {
      toolsEngine.onAddChatMessage('assistant', promptMessage, {
        source: 'tool'
      });
    }
    if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
      toolsEngine.onSpokenAudioPlayNow(promptMessage);
    }
    return true;
  }

  function chooseTool(messageId: string, choiceIndex: number): void {
    const chatLog =
      typeof options.getChatLog === 'function' ? options.getChatLog() : [];
    const chatMessage =
      typeof messageId === 'string' && messageId !== ''
        ? chatLog.find(
            (entry: Record<string, unknown>) => entry.id === messageId
          )
        : undefined;
    const activePendingChoice =
      typeof toolsEngine.pendingToolChoice === 'object' &&
      toolsEngine.pendingToolChoice !== null &&
      toolsEngine.pendingToolChoice.messageId === messageId
        ? toolsEngine.pendingToolChoice
        : null;

    const choicesList =
      typeof chatMessage === 'object' &&
      chatMessage !== null &&
      Array.isArray(chatMessage.pendingChoices) === true
        ? chatMessage.pendingChoices
        : activePendingChoice !== null &&
            Array.isArray(activePendingChoice.choices) === true
          ? activePendingChoice.choices
          : null;

    if (choicesList === null || choicesList[choiceIndex] === undefined) {
      return;
    }

    const selectedChoice = choicesList[choiceIndex];
    const choiceQuery =
      typeof chatMessage === 'object' &&
      chatMessage !== null &&
      typeof chatMessage.choiceQuery === 'string'
        ? chatMessage.choiceQuery
        : typeof activePendingChoice?.query === 'string'
          ? activePendingChoice.query
          : '';
    const choiceContext = activePendingChoice?.context;

    if (typeof chatMessage === 'object' && chatMessage !== null) {
      chatMessage.pendingChoices = null;
      chatMessage.text = `已選擇「${selectedChoice.tool.label || selectedChoice.tool.name}」。`;
    }
    toolsEngine.pendingToolChoice = null;
    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }
    prepareTool(
      selectedChoice.tool,
      choiceQuery,
      { confidence: selectedChoice.score, reason: 'user_choice' },
      {},
      choiceContext
    );
  }

  function offerTool(
    tool: ToolDefinition,
    query: string,
    routeMeta?: Record<string, unknown> | null,
    args?: Record<string, unknown>,
    offerOptions?: {
      callId?: string;
      source?: string;
      toolCallId?: string | null;
      context?: Record<string, unknown>;
      input?: Record<string, unknown>;
      onConfirmResume?: ((result: unknown) => void) | null;
      [key: string]: unknown;
    }
  ): void {
    const seq =
      typeof options.getChatSeq === 'function' ? options.getChatSeq() : 0;
    const callId =
      typeof offerOptions?.callId === 'string' && offerOptions.callId !== ''
        ? offerOptions.callId
        : `tool-${Date.now()}-${seq}`;
    const rawChatLog =
      typeof options.getChatLog === 'function' ? options.getChatLog() : [];
    const history = rawChatLog
      .slice(-12)
      .map((chatItem: Record<string, unknown>) => ({
        role: chatItem.role as string,
        text: chatItem.text as string
      }))
      .filter(
        (chatItem: { role: string; text: string }) =>
          typeof chatItem.text === 'string' && chatItem.text !== ''
      );

    const source =
      typeof offerOptions?.source === 'string' && offerOptions.source !== ''
        ? offerOptions.source
        : CHAT_SOURCE_MAP.TOOL;

    const optionsInput =
      typeof offerOptions?.input === 'object' && offerOptions.input !== null
        ? offerOptions.input
        : null;
    const overrideContext =
      typeof offerOptions?.context === 'object' && offerOptions.context !== null
        ? offerOptions.context
        : typeof optionsInput?.context === 'object' &&
            optionsInput.context !== null
          ? (optionsInput.context as Record<string, unknown>)
          : null;
    const resolvedContext = resolveContext(overrideContext);

    const pendingToolData: PendingToolData = {
      callId,
      name: tool.name,
      label: tool.label || tool.name,
      tool,
      input: {
        query,
        context: resolvedContext,
        args: args || {},
        route: routeMeta || {},
        history
      },
      source,
      toolCallId: offerOptions?.toolCallId || null,
      onConfirmResume:
        typeof offerOptions?.onConfirmResume === 'function'
          ? offerOptions.onConfirmResume
          : null
    };
    const summary = argumentSummary(tool, args || {});

    if (tool.requiresConfirmation === true) {
      pendingToolsMap.set(callId, pendingToolData);
      const confirmationMessage = `要幫你執行「${tool.label || tool.name}」嗎？${summary !== '' ? '\n' + summary : ''}`;
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', confirmationMessage, {
          id: callId,
          pendingTool: pendingToolData,
          source
        });
      }
      toolsEngine.pendingToolConfirmation = callId;
      startConfirmationTimer(callId, tool.confirmationTimeoutMs);

      if (typeof toolsEngine.onSetHistoryOpen === 'function') {
        toolsEngine.onSetHistoryOpen(true);
      }
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow(confirmationMessage);
      }
      emitToolEvent(TOOL_EVENT_MAP.OFFER, {
        name: tool.name,
        confirmation: true,
        confidence: Number(routeMeta?.confidence || 0),
        reason: String(routeMeta?.reason || ''),
        toolCallId: offerOptions?.toolCallId || null
      });
    } else {
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage(
          'assistant',
          `正在執行「${tool.label || tool.name}」…`,
          { id: callId, source }
        );
      }
      emitToolEvent(TOOL_EVENT_MAP.OFFER, {
        name: tool.name,
        confirmation: false,
        confidence: Number(routeMeta?.confidence || 0),
        reason: String(routeMeta?.reason || ''),
        toolCallId: offerOptions?.toolCallId || null
      });
      emitToolEvent(TOOL_EVENT_MAP.EXECUTE, {
        name: tool.name,
        confirmation: false,
        callId,
        toolCallId: offerOptions?.toolCallId || null
      });
      if (typeof tool.execute === 'function') {
        executeToolDirectly(tool, args || {}, pendingToolData);
      } else if (typeof options.onToolCall === 'function') {
        options.onToolCall(pendingToolData);
      }
    }
  }

  async function executeToolDirectly(
    tool: ToolDefinition,
    args: Record<string, unknown>,
    pendingToolData: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (typeof tool?.execute !== 'function') {
      return null;
    }
    const inputObj =
      typeof pendingToolData?.input === 'object' &&
      pendingToolData.input !== null
        ? (pendingToolData.input as Record<string, unknown>)
        : null;
    const rawContext =
      typeof inputObj?.context === 'object' && inputObj.context !== null
        ? (inputObj.context as Record<string, unknown>)
        : typeof pendingToolData?.context === 'object' &&
            pendingToolData.context !== null
          ? (pendingToolData.context as Record<string, unknown>)
          : null;
    const resolvedContext = resolveContext(rawContext);
    const resolvedQuery =
      typeof inputObj?.query === 'string'
        ? inputObj.query
        : typeof pendingToolData?.query === 'string'
          ? pendingToolData.query
          : '';
    const callId = String(pendingToolData?.callId || '');
    const startTime = Date.now();

    try {
      const result = await tool.execute({
        args,
        context: resolvedContext,
        query: resolvedQuery
      });
      const durationMs = Math.max(0, Date.now() - startTime);
      const message =
        typeof result === 'string' && result !== ''
          ? result
          : typeof (result as Record<string, unknown>)?.message === 'string' &&
              (result as Record<string, unknown>).message !== ''
            ? ((result as Record<string, unknown>).message as string)
            : '已完成。';

      if (typeof pendingToolData?.onConfirmResume === 'function') {
        if (callId !== '') {
          const chatLog =
            typeof options.getChatLog === 'function'
              ? options.getChatLog()
              : [];
          const chatMessage = chatLog.find((msg) => msg?.id === callId);
          if (typeof chatMessage === 'object' && chatMessage !== null) {
            chatMessage.executed = true;
            chatMessage.text = message;
          }
          if (typeof toolsEngine.onUpdateChatMessage === 'function') {
            toolsEngine.onUpdateChatMessage(callId, message, {
              streaming: false
            });
          }
          if (typeof toolsEngine.onRenderHistory === 'function') {
            toolsEngine.onRenderHistory();
          }
        }
        (
          pendingToolData.onConfirmResume as (
            toolExecutionResult: unknown
          ) => void
        )(result);
        emitToolEvent(TOOL_EVENT_MAP.RESULT, {
          callId,
          name: tool.name,
          ok: true,
          durationMs,
          message,
          error: undefined
        });
      } else if (tool.resultMode !== TOOL_RESULT_MODE_MAP.AI_SUMMARY) {
        handleToolResult({
          ok: true,
          message,
          callId,
          name: tool.name,
          durationMs
        });
      } else {
        emitToolEvent(TOOL_EVENT_MAP.RESULT, {
          callId,
          name: tool.name,
          ok: true,
          durationMs,
          message,
          error: undefined
        });
      }
      return result;
    } catch (error: unknown) {
      const durationMs = Math.max(0, Date.now() - startTime);
      const errorMessage =
        error instanceof Error ? error.message : String(error || '執行錯誤');
      const failText = `執行失敗：${errorMessage}`;

      if (typeof pendingToolData?.onConfirmResume === 'function') {
        if (callId !== '') {
          const chatLog =
            typeof options.getChatLog === 'function'
              ? options.getChatLog()
              : [];
          const chatMessage = chatLog.find((msg) => msg?.id === callId);
          if (typeof chatMessage === 'object' && chatMessage !== null) {
            chatMessage.executed = true;
            chatMessage.text = failText;
          }
          if (typeof toolsEngine.onUpdateChatMessage === 'function') {
            toolsEngine.onUpdateChatMessage(callId, failText, {
              streaming: false
            });
          }
          if (typeof toolsEngine.onRenderHistory === 'function') {
            toolsEngine.onRenderHistory();
          }
        }
        (
          pendingToolData.onConfirmResume as (
            toolExecutionResult: unknown
          ) => void
        )({
          ok: false,
          error: errorMessage
        });
        emitToolEvent(TOOL_EVENT_MAP.RESULT, {
          callId,
          name: tool.name,
          ok: false,
          durationMs,
          message: undefined,
          error: errorMessage
        });
      } else if (tool.resultMode !== TOOL_RESULT_MODE_MAP.AI_SUMMARY) {
        handleToolResult({
          ok: false,
          error: errorMessage,
          callId,
          name: tool.name,
          durationMs
        });
      } else {
        emitToolEvent(TOOL_EVENT_MAP.RESULT, {
          callId,
          name: tool.name,
          ok: false,
          durationMs,
          message: undefined,
          error: errorMessage
        });
      }
      return { ok: false, error: errorMessage };
    }
  }

  function executePendingTool(messageId: string): void {
    clearConfirmationTimer();
    const chatLog =
      typeof options.getChatLog === 'function' ? options.getChatLog() : [];
    const chatMessage = chatLog.find((msg) => msg?.id === messageId);
    const mapPendingTool = pendingToolsMap.get(messageId);
    const chatPendingTool =
      typeof chatMessage === 'object' &&
      chatMessage !== null &&
      typeof chatMessage.pendingTool === 'object' &&
      chatMessage.pendingTool !== null
        ? (chatMessage.pendingTool as PendingToolData)
        : null;

    const pendingToolData = mapPendingTool || chatPendingTool;
    if (typeof pendingToolData !== 'object' || pendingToolData === null) {
      return;
    }

    pendingToolsMap.delete(messageId);
    toolsEngine.pendingToolConfirmation = '';

    if (typeof chatMessage === 'object' && chatMessage !== null) {
      chatMessage.pendingTool = null;
      chatMessage.text = `正在執行「${pendingToolData.label || pendingToolData.name}」…`;
    }
    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }

    emitToolEvent(TOOL_EVENT_MAP.CONFIRM, {
      name: pendingToolData.name as string,
      toolCallId: pendingToolData.toolCallId
    });
    emitToolEvent(TOOL_EVENT_MAP.EXECUTE, {
      name: pendingToolData.name as string,
      confirmation: true,
      callId: (pendingToolData.callId as string) || messageId,
      toolCallId: pendingToolData.toolCallId
    });

    if (typeof pendingToolData.tool?.execute === 'function') {
      executeToolDirectly(
        pendingToolData.tool,
        pendingToolData.input?.args || {},
        pendingToolData
      );
    } else if (typeof options.onToolCall === 'function') {
      options.onToolCall(pendingToolData);
    }
  }

  function cancelPendingTool(
    messageId: string,
    cancelOptions?: { reason?: string }
  ): void {
    clearConfirmationTimer();
    const chatLog =
      typeof options.getChatLog === 'function' ? options.getChatLog() : [];
    const chatMessage = chatLog.find((msg) => msg?.id === messageId);
    const mapPendingTool = pendingToolsMap.get(messageId);
    const chatPendingTool =
      typeof chatMessage === 'object' &&
      chatMessage !== null &&
      typeof chatMessage.pendingTool === 'object' &&
      chatMessage.pendingTool !== null
        ? (chatMessage.pendingTool as PendingToolData)
        : null;

    const pendingToolData = mapPendingTool || chatPendingTool;
    if (typeof pendingToolData !== 'object' || pendingToolData === null) {
      return;
    }

    const cancelReason =
      cancelOptions?.reason || TOOL_CANCEL_REASON_MAP.USER_CANCEL;
    pendingToolsMap.delete(messageId);
    toolsEngine.pendingToolConfirmation = '';

    if (typeof chatMessage === 'object' && chatMessage !== null) {
      chatMessage.pendingTool = null;
      if (cancelReason === TOOL_CANCEL_REASON_MAP.TIMEOUT) {
        chatMessage.text = '操作已逾時失效。';
        chatMessage.timedOut = true;
      } else if (cancelReason === TOOL_CANCEL_REASON_MAP.NEW_INPUT) {
        chatMessage.text = '已取消（已轉移話題）。';
        chatMessage.cancelled = true;
      } else {
        chatMessage.text = '好的，已取消。';
      }
    }

    if (
      cancelReason !== TOOL_CANCEL_REASON_MAP.TIMEOUT &&
      cancelReason !== TOOL_CANCEL_REASON_MAP.NEW_INPUT &&
      typeof options.isConvoOn === 'function' &&
      options.isConvoOn() === true
    ) {
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow('好的，已取消。');
      }
    }

    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }

    if (typeof pendingToolData.onConfirmResume === 'function') {
      pendingToolData.onConfirmResume({
        cancelled: true,
        reason: cancelReason
      });
    }

    emitToolEvent(TOOL_EVENT_MAP.CANCEL, {
      name: pendingToolData.name as string,
      reason: cancelReason,
      toolCallId: pendingToolData.toolCallId
    });
  }

  function continueToolConfirmation(inputText: string): boolean {
    const confirmationId = toolsEngine.pendingToolConfirmation;
    if (typeof confirmationId !== 'string' || confirmationId === '') {
      return false;
    }
    const trimmedAnswer = String(inputText || '').trim();
    if (
      /^(確認|確定|執行|可以|好|好的|yes|ok)$/i.test(trimmedAnswer) === true
    ) {
      executePendingTool(confirmationId);
      return true;
    }
    if (/^(取消|不要|算了|否|no|cancel)$/i.test(trimmedAnswer) === true) {
      cancelPendingTool(confirmationId, {
        reason: TOOL_CANCEL_REASON_MAP.USER_CANCEL
      });
      return true;
    }
    cancelPendingTool(confirmationId, {
      reason: TOOL_CANCEL_REASON_MAP.NEW_INPUT
    });
    return false;
  }

  function handleToolResult(resultData: ToolResultData): void {
    const messageText =
      resultData.ok === false
        ? `執行失敗：${String(resultData.error || '未知錯誤')}`
        : String(resultData.message || '已完成。');
    const chatLog =
      typeof options.getChatLog === 'function' ? options.getChatLog() : [];
    const existingMessage = chatLog.find(
      (msg) => msg?.id === resultData.callId
    );

    if (typeof existingMessage === 'object' && existingMessage !== null) {
      existingMessage.executed = true;
      existingMessage.text = messageText;
      if (typeof toolsEngine.onUpdateChatMessage === 'function') {
        toolsEngine.onUpdateChatMessage(
          existingMessage.id as string,
          messageText,
          { streaming: false }
        );
      }
    } else {
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', messageText, {
          source: CHAT_SOURCE_MAP.TOOL
        });
      }
    }
    if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
      toolsEngine.onSpokenAudioPlayNow(messageText);
    }
    emitToolEvent(TOOL_EVENT_MAP.RESULT, {
      callId: String(resultData.callId || ''),
      name: resultData.name || '',
      ok: resultData.ok !== false,
      durationMs:
        typeof resultData.durationMs === 'number' &&
        Number.isFinite(resultData.durationMs) === true
          ? resultData.durationMs
          : 0,
      message: resultData.ok === false ? undefined : messageText,
      error:
        resultData.ok === false
          ? String(resultData.error || '未知錯誤')
          : resultData.error
    });
  }

  let currentConfirmationTimeoutMs =
    typeof options.confirmationTimeoutMs === 'number' &&
    Number.isFinite(options.confirmationTimeoutMs) === true &&
    options.confirmationTimeoutMs > 0
      ? options.confirmationTimeoutMs
      : DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS;

  let confirmationTimer: ReturnType<typeof setTimeout> | null = null;

  function clearConfirmationTimer(): void {
    if (confirmationTimer !== null) {
      clearTimeout(confirmationTimer);
      confirmationTimer = null;
    }
  }

  function startConfirmationTimer(
    messageId: string,
    timeoutMs?: number | null
  ): void {
    clearConfirmationTimer();
    const durationMs =
      typeof timeoutMs === 'number' &&
      Number.isFinite(timeoutMs) === true &&
      timeoutMs > 0
        ? timeoutMs
        : currentConfirmationTimeoutMs;

    if (durationMs > 0) {
      confirmationTimer = setTimeout(() => {
        cancelPendingTool(messageId, {
          reason: TOOL_CANCEL_REASON_MAP.TIMEOUT
        });
      }, durationMs);
    }
  }

  const toolsEngine: ToolsEngine = {
    get tools(): ToolDefinition[] {
      return registeredTools;
    },
    set tools(value: ToolDefinition[]) {
      registeredTools = Array.isArray(value) ? value : [];
    },
    get HOST_TOOLS(): ToolDefinition[] {
      return registeredTools;
    },
    set HOST_TOOLS(value: ToolDefinition[]) {
      registeredTools = Array.isArray(value) ? value : [];
    },
    pendingToolInput: null,
    pendingToolChoice: null,
    pendingToolConfirmation: null,

    get confirmationTimeoutMs(): number {
      return currentConfirmationTimeoutMs;
    },
    set confirmationTimeoutMs(value: number) {
      if (
        typeof value === 'number' &&
        Number.isFinite(value) === true &&
        value > 0
      ) {
        currentConfirmationTimeoutMs = value;
      }
    },

    get onAddChatMessage() {
      return options.onAddChatMessage;
    },
    get onUpdateChatMessage() {
      return options.onUpdateChatMessage;
    },
    get onSetHistoryOpen() {
      return options.onSetHistoryOpen;
    },
    get onRenderHistory() {
      return options.onRenderHistory;
    },
    get onSpokenAudioPlayNow() {
      return options.onSpokenAudioPlayNow;
    },

    getToolByName,
    routeTool,
    routeHostTool: routeTool,
    getAiAvailableTools: () => getAiAvailableTools(toolsEngine.tools),
    toOpenAiTools: () => toOpenAiTools(toolsEngine.tools),
    parameterPrompt,
    prepareTool,
    continueToolInput,
    offerToolChoices,
    continueToolChoice,
    chooseTool,
    offerTool,
    offerHostTool: offerTool,
    executePendingTool,
    cancelPendingTool,
    continueToolConfirmation,
    handleToolResult,
    executeToolDirectly
  };

  return toolsEngine;
}

/**
 * Validates whether a custom tools engine satisfies the required ToolsEngine interface methods.
 *
 * @param engine - Engine instance to validate.
 * @returns Validation result and missing method names list.
 */
export function validateToolsEngine(engine: unknown): {
  isValid: boolean;
  missing: string[];
} {
  if (typeof engine !== 'object' || engine === null) {
    return { isValid: false, missing: ['engine object'] };
  }
  const engineObj = engine as Record<string, unknown>;
  const requiredMethods = [
    'routeTool',
    'prepareTool',
    'continueToolInput',
    'offerToolChoices',
    'continueToolChoice',
    'chooseTool',
    'offerTool',
    'executePendingTool',
    'cancelPendingTool',
    'continueToolConfirmation',
    'handleToolResult'
  ];
  const missingMethods: string[] = [];
  requiredMethods.forEach((methodName) => {
    if (methodName === 'routeTool') {
      if (
        typeof engineObj.routeTool !== 'function' &&
        typeof engineObj.routeHostTool !== 'function'
      ) {
        missingMethods.push(methodName);
      }
      return;
    }
    if (methodName === 'offerTool') {
      if (
        typeof engineObj.offerTool !== 'function' &&
        typeof engineObj.offerHostTool !== 'function'
      ) {
        missingMethods.push(methodName);
      }
      return;
    }
    if (typeof engineObj[methodName] !== 'function') {
      missingMethods.push(methodName);
    }
  });
  return { isValid: missingMethods.length === 0, missing: missingMethods };
}
