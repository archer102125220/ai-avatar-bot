import {
  CHAT_SOURCE_MAP,
  DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS,
  TOOL_CANCEL_REASON_MAP,
  TOOL_RESULT_MODE_MAP
} from '@/core/constants';
import { getAiAvailableTools, toOpenAiTools, argumentSummary } from './schema';
import { route } from './router';
import { extract } from './validator';

export * from './utils';
export * from './schema';
export * from './router';
export * from './validator';

/**
 * State of a tool execution pending missing parameter input from user.
 * @typedef {import('../../index.d.ts').PendingToolInput} PendingToolInput
 */

/**
 * State of multiple ambiguous tool candidates presented to the user.
 * @typedef {import('../../index.d.ts').PendingToolChoice} PendingToolChoice
 */

/**
 * Result data payload when a tool finishes execution.
 * @typedef {import('../../index.d.ts').ToolResultData} ToolResultData
 */

/**
 * Settings for initializing the ToolsEngine.
 * @typedef {import('../../index.d.ts').ToolsEngineSetting} ToolsEngineSetting
 */

/**
 * Tools Engine instance for parameter extraction, intent routing, and function execution.
 * @typedef {import('../../index.d.ts').ToolsEngine} ToolsEngine
 */

/**
 * Creates and initializes the Tools Engine instance for host tool routing, parameter extraction, and execution.
 *
 * @param {ToolsEngineSetting} [setting={}] - Engine configuration options and event callbacks.
 * @returns {ToolsEngine} Tools engine controller instance.
 */
export function initToolsEngine(setting = {}) {
  function routeHostTool(queryText) {
    return route(toolsEngine.HOST_TOOLS, queryText);
  }

  function parameterPrompt(tool, propertyName, errorText) {
    const propertySchema = tool.inputSchema.properties[propertyName] || {};
    const label = propertySchema.title || propertyName;
    const choices =
      Array.isArray(propertySchema.enum) === true &&
      propertySchema.enum.length > 0
        ? `（可選：${propertySchema.enum.join('、')}）`
        : '';
    const errorPrefix =
      typeof errorText === 'string' && errorText !== '' ? `${errorText}。` : '';
    return `${errorPrefix}執行「${tool.label}」前，請提供${label}${choices}。`;
  }

  function prepareTool(tool, query, routeMeta, existingArgs) {
    const extractedParams = extract(
      tool,
      query,
      {},
      existingArgs || {},
      null,
      false
    );
    if (extractedParams.missing.length > 0) {
      toolsEngine.pendingToolInput = {
        tool,
        query,
        routeMeta: routeMeta || {},
        args: extractedParams.args,
        missing: extractedParams.missing
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
      return;
    }
    toolsEngine.pendingToolInput = null;
    offerHostTool(tool, query, routeMeta, extractedParams.args);
  }

  function continueToolInput(inputText) {
    if (
      typeof toolsEngine.pendingToolInput !== 'object' ||
      toolsEngine.pendingToolInput === null
    ) {
      return false;
    }
    if (
      /^(取消|不要|算了|cancel)$/i.test(String(inputText || '').trim()) === true
    ) {
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
      return true;
    }
    const pendingInput = toolsEngine.pendingToolInput;
    const missingField = pendingInput.missing[0];
    const extractedParams = extract(
      pendingInput.tool,
      inputText,
      {},
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
      return true;
    }
    prepareTool(
      pendingInput.tool,
      pendingInput.query,
      pendingInput.routeMeta,
      extractedParams.args
    );
    return true;
  }

  function offerToolChoices(query, candidates) {
    const candidateChoices = candidates.slice(0, 3);
    const choiceMessage = `我找到幾個可能的操作，請選擇：${candidateChoices
      .map(
        (choiceItem, choiceIndex) =>
          `${choiceIndex + 1}「${choiceItem.tool.label}」`
      )
      .join('、')}`;

    let messageId;
    if (typeof toolsEngine.onAddChatMessage === 'function') {
      messageId = toolsEngine.onAddChatMessage('assistant', choiceMessage, {
        pendingChoices: candidateChoices,
        source: 'tool'
      });
    }

    if (typeof messageId !== 'undefined') {
      const chatMessage = setting
        .getChatLog()
        .find((entry) => entry.id === messageId);
      if (typeof chatMessage === 'object' && chatMessage !== null) {
        chatMessage.choiceQuery = query;
      }
    }

    toolsEngine.pendingToolChoice = { messageId, choices: candidateChoices };

    if (typeof toolsEngine.onSetHistoryOpen === 'function') {
      toolsEngine.onSetHistoryOpen(true);
    }
    if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
      toolsEngine.onSpokenAudioPlayNow(choiceMessage);
    }
  }

  function continueToolChoice(inputText) {
    if (
      typeof toolsEngine.pendingToolChoice !== 'object' ||
      toolsEngine.pendingToolChoice === null
    ) {
      return false;
    }
    if (
      /^(取消|不要|算了|cancel)$/i.test(String(inputText || '').trim()) === true
    ) {
      const chatMessage = setting
        .getChatLog()
        .find((entry) => entry.id === toolsEngine.pendingToolChoice.messageId);
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
            candidateItem.tool.name === routedResult.match.tool.name
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

  function chooseTool(messageId, choiceIndex) {
    const chatMessage = setting
      .getChatLog()
      .find((entry) => entry.id === messageId);
    if (
      typeof chatMessage !== 'object' ||
      chatMessage === null ||
      Array.isArray(chatMessage.pendingChoices) === false ||
      chatMessage.pendingChoices[choiceIndex] === undefined
    ) {
      return;
    }
    const selectedChoice = chatMessage.pendingChoices[choiceIndex];
    chatMessage.pendingChoices = null;
    chatMessage.text = `已選擇「${selectedChoice.tool.label}」。`;
    toolsEngine.pendingToolChoice = null;
    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }
    prepareTool(
      selectedChoice.tool,
      chatMessage.choiceQuery || '',
      { confidence: selectedChoice.score, reason: 'user_choice' },
      {}
    );
  }

  function offerHostTool(tool, query, routeMeta, args, options) {
    const callId =
      typeof options?.callId === 'string' && options.callId !== ''
        ? options.callId
        : `tool-${Date.now()}-${setting.getChatSeq()}`;
    const history = setting
      .getChatLog()
      .slice(-12)
      .map((chatItem) => ({ role: chatItem.role, text: chatItem.text }))
      .filter(
        (chatItem) => typeof chatItem.text === 'string' && chatItem.text !== ''
      );

    const source =
      typeof options?.source === 'string' && options.source !== ''
        ? options.source
        : CHAT_SOURCE_MAP.TOOL;

    const pendingToolData = {
      callId,
      name: tool.name,
      label: tool.label,
      tool,
      input: {
        query,
        context: {},
        args: args || {},
        route: routeMeta || {},
        history
      },
      source,
      toolCallId: options?.toolCallId || null,
      onConfirmResume:
        typeof options?.onConfirmResume === 'function'
          ? options.onConfirmResume
          : null
    };
    const summary = argumentSummary(tool, args || {});

    if (tool.requiresConfirmation === true) {
      const confirmationMessage = `要幫你執行「${tool.label}」嗎？${summary !== '' ? '\n' + summary : ''}`;
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
      if (typeof setting.onToolOffer === 'function') {
        setting.onToolOffer({
          name: tool.name,
          confirmation: true,
          toolCallId: options?.toolCallId || null
        });
      }
    } else {
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage(
          'assistant',
          `正在執行「${tool.label}」…`,
          { id: callId, source }
        );
      }
      if (typeof tool.execute === 'function') {
        executeToolDirectly(tool, args || {}, pendingToolData);
      } else if (typeof setting.onToolCall === 'function') {
        setting.onToolCall(pendingToolData);
      }
      if (typeof setting.onToolOffer === 'function') {
        setting.onToolOffer({
          name: tool.name,
          confirmation: false,
          toolCallId: options?.toolCallId || null
        });
      }
    }
  }

  async function executeToolDirectly(tool, args, pendingToolData = {}) {
    if (typeof tool?.execute !== 'function') {
      return null;
    }
    const resolvedContext =
      typeof pendingToolData?.input?.context === 'object' &&
      pendingToolData.input.context !== null
        ? pendingToolData.input.context
        : typeof pendingToolData?.context === 'object' &&
            pendingToolData.context !== null
          ? pendingToolData.context
          : {};
    const resolvedQuery =
      typeof pendingToolData?.input?.query === 'string'
        ? pendingToolData.input.query
        : typeof pendingToolData?.query === 'string'
          ? pendingToolData.query
          : '';

    try {
      const result = await tool.execute({
        args,
        context: resolvedContext,
        query: resolvedQuery
      });

      if (typeof pendingToolData?.onConfirmResume === 'function') {
        pendingToolData.onConfirmResume(result);
      } else if (tool.resultMode !== TOOL_RESULT_MODE_MAP.AI_SUMMARY) {
        const message =
          typeof result === 'string'
            ? result
            : typeof result?.message === 'string' && result.message !== ''
              ? result.message
              : '已完成。';
        handleToolResult({
          ok: true,
          message,
          callId: pendingToolData?.callId,
          name: tool.name
        });
      }
      return result;
    } catch (error) {
      const errorMessage = String(error?.message || error || '執行錯誤');
      if (typeof pendingToolData?.onConfirmResume === 'function') {
        pendingToolData.onConfirmResume({ ok: false, error: errorMessage });
      } else if (tool.resultMode !== TOOL_RESULT_MODE_MAP.AI_SUMMARY) {
        handleToolResult({
          ok: false,
          error: errorMessage,
          callId: pendingToolData?.callId,
          name: tool.name
        });
      }
      return { ok: false, error: errorMessage };
    }
  }

  function executePendingTool(messageId) {
    clearConfirmationTimer();
    const chatMessage = setting
      .getChatLog()
      .find((msg) => msg.id === messageId);
    if (
      typeof chatMessage !== 'object' ||
      chatMessage === null ||
      typeof chatMessage.pendingTool !== 'object' ||
      chatMessage.pendingTool === null
    ) {
      return;
    }
    const pendingToolData = chatMessage.pendingTool;
    chatMessage.pendingTool = null;
    toolsEngine.pendingToolConfirmation = '';
    chatMessage.text = `正在執行「${pendingToolData.label}」…`;
    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }

    if (typeof pendingToolData.tool?.execute === 'function') {
      executeToolDirectly(
        pendingToolData.tool,
        pendingToolData.input.args,
        pendingToolData
      );
    } else if (typeof setting.onToolCall === 'function') {
      setting.onToolCall(pendingToolData);
    }

    if (typeof setting.onToolConfirm === 'function') {
      setting.onToolConfirm({
        name: pendingToolData.name,
        toolCallId: pendingToolData.toolCallId
      });
    }
  }

  function cancelPendingTool(messageId, options) {
    clearConfirmationTimer();
    const chatMessage = setting
      .getChatLog()
      .find((msg) => msg.id === messageId);
    if (
      typeof chatMessage !== 'object' ||
      chatMessage === null ||
      typeof chatMessage.pendingTool !== 'object' ||
      chatMessage.pendingTool === null
    ) {
      return;
    }
    const pendingToolData = chatMessage.pendingTool;
    const cancelReason = options?.reason || TOOL_CANCEL_REASON_MAP.USER_CANCEL;
    chatMessage.pendingTool = null;
    toolsEngine.pendingToolConfirmation = '';

    if (cancelReason === TOOL_CANCEL_REASON_MAP.TIMEOUT) {
      chatMessage.text = '操作已逾時失效。';
      chatMessage.timedOut = true;
    } else if (cancelReason === TOOL_CANCEL_REASON_MAP.NEW_INPUT) {
      chatMessage.text = '已取消（已轉移話題）。';
      chatMessage.cancelled = true;
    } else {
      chatMessage.text = '好的，已取消。';
      if (
        typeof setting.isConvoOn === 'function' &&
        setting.isConvoOn() === true
      ) {
        if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
          toolsEngine.onSpokenAudioPlayNow('好的，已取消。');
        }
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

    if (typeof setting.onToolCancel === 'function') {
      setting.onToolCancel({
        name: pendingToolData.name,
        reason: cancelReason,
        toolCallId: pendingToolData.toolCallId
      });
    }
  }

  function continueToolConfirmation(inputText) {
    if (
      typeof toolsEngine.pendingToolConfirmation !== 'string' ||
      toolsEngine.pendingToolConfirmation === ''
    ) {
      return false;
    }
    const trimmedAnswer = String(inputText || '').trim();
    if (
      /^(確認|確定|執行|可以|好|好的|yes|ok)$/i.test(trimmedAnswer) === true
    ) {
      executePendingTool(toolsEngine.pendingToolConfirmation);
      return true;
    }
    if (/^(取消|不要|算了|否|no|cancel)$/i.test(trimmedAnswer) === true) {
      cancelPendingTool(toolsEngine.pendingToolConfirmation, {
        reason: TOOL_CANCEL_REASON_MAP.USER_CANCEL
      });
      return true;
    }

    // If user inputs a completely new message, automatically cancel previous pending tool and allow main flow to process new input
    cancelPendingTool(toolsEngine.pendingToolConfirmation, {
      reason: TOOL_CANCEL_REASON_MAP.NEW_INPUT
    });
    return false;
  }

  function handleToolResult(resultData) {
    const messageText =
      resultData.ok === false
        ? `執行失敗：${String(resultData.error || '未知錯誤')}`
        : String(resultData.message || '已完成。');
    const existingMessage = setting
      .getChatLog()
      .find((msg) => msg.id === resultData.callId);

    if (typeof existingMessage === 'object' && existingMessage !== null) {
      if (typeof toolsEngine.onUpdateChatMessage === 'function') {
        toolsEngine.onUpdateChatMessage(existingMessage.id, messageText, false);
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
  }

  let currentConfirmationTimeoutMs =
    typeof setting.confirmationTimeoutMs === 'number' &&
    Number.isFinite(setting.confirmationTimeoutMs) === true &&
    setting.confirmationTimeoutMs > 0
      ? setting.confirmationTimeoutMs
      : DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS;

  let confirmationTimer = null;

  function clearConfirmationTimer() {
    if (confirmationTimer !== null) {
      clearTimeout(confirmationTimer);
      confirmationTimer = null;
    }
  }

  function startConfirmationTimer(messageId, timeoutMs) {
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

  const toolsEngine = {
    HOST_TOOLS: [],
    pendingToolInput: null,
    pendingToolChoice: null,
    pendingToolConfirmation: null,

    get confirmationTimeoutMs() {
      return currentConfirmationTimeoutMs;
    },
    set confirmationTimeoutMs(value) {
      if (
        typeof value === 'number' &&
        Number.isFinite(value) === true &&
        value > 0
      ) {
        currentConfirmationTimeoutMs = value;
      }
    },

    get onAddChatMessage() {
      return setting.onAddChatMessage;
    },
    get onUpdateChatMessage() {
      return setting.onUpdateChatMessage;
    },
    get onSetHistoryOpen() {
      return setting.onSetHistoryOpen;
    },
    get onRenderHistory() {
      return setting.onRenderHistory;
    },
    get onSpokenAudioPlayNow() {
      return setting.onSpokenAudioPlayNow;
    },

    routeHostTool,
    getAiAvailableTools: () => getAiAvailableTools(toolsEngine.HOST_TOOLS),
    toOpenAiTools: () => toOpenAiTools(toolsEngine.HOST_TOOLS),
    parameterPrompt,
    prepareTool,
    continueToolInput,
    offerToolChoices,
    continueToolChoice,
    chooseTool,
    offerHostTool,
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
 * @param {ToolsEngine | Record<string, any> | null | undefined} engine - Engine instance to validate.
 * @returns {{ isValid: boolean, missing: string[] }} Validation result and missing method names list.
 */
export function validateToolsEngine(engine) {
  if (typeof engine !== 'object' || engine === null) {
    return { isValid: false, missing: ['engine object'] };
  }
  const requiredMethods = [
    'routeHostTool',
    'prepareTool',
    'continueToolInput',
    'offerToolChoices',
    'continueToolChoice',
    'chooseTool',
    'offerHostTool',
    'executePendingTool',
    'cancelPendingTool',
    'continueToolConfirmation',
    'handleToolResult'
  ];
  const missingMethods = [];
  requiredMethods.forEach((methodName) => {
    if (typeof engine[methodName] !== 'function') {
      missingMethods.push(methodName);
    }
  });
  return { isValid: missingMethods.length === 0, missing: missingMethods };
}
