import {
  CHAT_SOURCE_MAP,
  DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS,
  TOOL_CANCEL_REASON_MAP,
  TOOL_RESULT_MODE_MAP
} from '../constants';
import { getAiAvailableTools, toOpenAiTools, argumentSummary } from './schema';
import { route } from './router';
import { extract } from './validator';

export * from './utils';
export * from './schema';
export * from './router';
export * from './validator';

/**
 * @typedef {object} PendingToolInput
 * @property {import('./schema').ToolDefinition} tool - 執行中的工具
 * @property {string} query - 使用者查詢字串
 * @property {object} routeMeta - 路由相關資訊
 * @property {Record<string, any>} args - 目前已收集的參數
 * @property {string[]} missing - 尚未收集的必填參數
 */

/**
 * @typedef {object} PendingToolChoice
 * @property {string} messageId - 選擇訊息的 ID
 * @property {import('./router').ToolRouteCandidate[]} choices - 提供給使用者的選項清單
 */

/**
 * @typedef {object} ToolResultData
 * @property {boolean} [ok] - 執行是否成功
 * @property {string} [error] - 錯誤訊息
 * @property {string} [message] - 成功訊息
 * @property {string} callId - 呼叫 ID
 * @property {string} [name] - 工具名稱
 */

/**
 * @typedef {object} ToolsEngineSetting
 * @property {number} [confirmationTimeoutMs] - 工具確認的逾時毫秒數
 * @property {function} [onAddChatMessage] - 新增對話訊息的回呼函數
 * @property {function} [onUpdateChatMessage] - 更新對話訊息的回呼函數
 * @property {function} [onSetHistoryOpen] - 設定歷史紀錄面板開啟狀態的回呼函數
 * @property {function} [onRenderHistory] - 觸發重新渲染歷史紀錄的回呼函數
 * @property {function} [onSpokenAudioPlayNow] - 語音播放回呼函數
 * @property {function} [onToolCall] - 工具準備執行時的回呼函數
 * @property {(offer: object) => void} [onToolOffer] - 工具發起確認或準備執行時的回呼函式
 * @property {(confirm: object) => void} [onToolConfirm] - 工具確認執行時的回呼函式
 * @property {(cancel: object) => void} [onToolCancel] - 工具取消時的回呼函式
 * @property {() => Array<object>} getChatLog - 取得對話紀錄陣列
 * @property {() => number} getChatSeq - 取得目前對話序號
 * @property {() => boolean} isConvoOn - 取得是否開啟連續對話
 */

/**
 * @typedef {object} ToolsEngine
 * @property {import('./schema').ToolDefinition[]} HOST_TOOLS - 註冊的宿主工具清單
 * @property {PendingToolInput | null} pendingToolInput - 待補齊參數的工具狀態
 * @property {PendingToolChoice | null} pendingToolChoice - 待選擇的模糊匹配狀態
 * @property {string | null} pendingToolConfirmation - 待確認執行的工具訊息 ID
 * @property {number} confirmationTimeoutMs - 工具確認逾時毫秒數
 * @property {function} onAddChatMessage - 來自 setting 的對應方法
 * @property {function} onUpdateChatMessage - 來自 setting 的對應方法
 * @property {function} onSetHistoryOpen - 來自 setting 的對應方法
 * @property {function} onRenderHistory - 來自 setting 的對應方法
 * @property {function} onSpokenAudioPlayNow - 來自 setting 的對應方法
 * @property {(text: string) => import('./router').ToolRouteResult} routeHostTool - 路由宿主工具
 * @property {() => import('./schema').ToolDefinition[]} getAiAvailableTools - 取得可供 AI 呼叫的工具清單
 * @property {() => Array<object>} toOpenAiTools - 取得 OpenAI 相容 tools 格式清單
 * @property {(tool: import('./schema').ToolDefinition, propertyName: string, errorText?: string) => string} parameterPrompt - 產生補齊參數的提示語
 * @property {(tool: import('./schema').ToolDefinition, query: string, routeMeta?: object, existingArgs?: Record<string, any>) => void} prepareTool - 準備執行工具
 * @property {(inputText: string) => boolean} continueToolInput - 繼續處理工具參數輸入
 * @property {(query: string, candidates: import('./router').ToolRouteCandidate[]) => void} offerToolChoices - 處理工具模糊匹配
 * @property {(inputText: string) => boolean} continueToolChoice - 繼續處理工具選擇
 * @property {(messageId: string, choiceIndex: number) => void} chooseTool - 選擇工具
 * @property {(tool: import('./schema').ToolDefinition, query: string, routeMeta?: object, args?: Record<string, any>, options?: object) => void} offerHostTool - 準備確認執行宿主工具
 * @property {(messageId: string) => void} executePendingTool - 執行待確認工具
 * @property {(messageId: string, options?: { reason?: string }) => void} cancelPendingTool - 取消待確認工具
 * @property {(inputText: string) => boolean} continueToolConfirmation - 繼續處理確認結果
 * @property {(resultData: ToolResultData) => void} handleToolResult - 處理工具執行完畢的回應
 * @property {(tool: import('./schema').ToolDefinition, args: Record<string, any>, pendingToolData: object) => Promise<any>} executeToolDirectly - 直接執行工具
 */

/**
 * 初始化並建立工具執行引擎 (Tools Engine)。
 * 處理工具路由、參數收集、使用者互動 (補齊參數、選擇模糊工具、確認執行) 及最終執行邏輯。
 * @param {ToolsEngineSetting} [setting={}] - 引擎設定物件，包含回呼函數與狀態讀取器
 * @returns {ToolsEngine} 工具引擎實體 (Tools Engine Instance)
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

    // 若使用者輸入其他全新訊息，自動取消前次未完成之操作，並允許主流程繼續處理新訊息
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
 * 驗證自訂 Tools Engine 是否實作了必要的介面
 * @param {object} engine - 待驗證的引擎實例
 * @returns {{isValid: boolean, missing: string[]}} 驗證結果與缺少的實作名稱
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
