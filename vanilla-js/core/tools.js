export function initToolsManager() {}

import { addChatMessage, updateChatMessage } from './brain.js';
import { setHistoryOpen, renderHistory } from './ui.js';

export function routeHostTool(aiAvatarWidget, text) {
  if (!window.AvatarToolRouter) return { match: null, ambiguous: [] };
  return window.AvatarToolRouter.route(aiAvatarWidget.brainEngine.HOST_TOOLS, text);
}

export function parameterPrompt(tool, name, errorText) {
  const property = tool.inputSchema.properties[name] || {};
  const label = property.title || name;
  const choices =
    property.enum && property.enum.length
      ? '（可選：' + property.enum.join('、') + '）'
      : '';
  return (
    (errorText ? errorText + '。' : '') +
    '執行「' +
    tool.label +
    '」前，請提供' +
    label +
    choices +
    '。'
  );
}

export function prepareTool(aiAvatarWidget, tool, query, routeMeta, existingArgs) {
  const extracted = window.AvatarToolRouter.extract(
    tool,
    query,
    {},
    existingArgs || {},
    null,
    false
  );
  if (extracted.missing.length) {
    aiAvatarWidget.brainEngine.pendingToolInput = {
      tool,
      query,
      routeMeta,
      args: extracted.args,
      missing: extracted.missing
    };
    const prompt = parameterPrompt(
      tool,
      extracted.missing[0],
      extracted.errors[0] || ''
    );
    addChatMessage(aiAvatarWidget, 'assistant', prompt, { source: 'tool' });
    aiAvatarWidget.speechEngine.speak(prompt);
    return;
  }
  aiAvatarWidget.brainEngine.pendingToolInput = null;
  offerHostTool(aiAvatarWidget, tool, query, routeMeta, extracted.args);
}

export function continueToolInput(aiAvatarWidget, text) {
  if (!aiAvatarWidget.brainEngine.pendingToolInput) return false;
  if (/^(取消|不要|算了|cancel)$/i.test(String(text || '').trim())) {
    aiAvatarWidget.brainEngine.pendingToolInput = null;
    const message = '好的，已取消這個操作。';
    addChatMessage(aiAvatarWidget, 'assistant', message, { source: 'tool' });
    aiAvatarWidget.speechEngine.speak(message);
    return true;
  }
  const pending = aiAvatarWidget.brainEngine.pendingToolInput;
  const field = pending.missing[0];
  const extracted = window.AvatarToolRouter.extract(
    pending.tool,
    text,
    {},
    pending.args,
    [field],
    true
  );
  if (extracted.missing.length) {
    pending.args = extracted.args;
    pending.missing = extracted.missing;
    const prompt = parameterPrompt(
      pending.tool,
      extracted.missing[0],
      extracted.errors[0] || '輸入格式不正確'
    );
    addChatMessage(aiAvatarWidget, 'assistant', prompt, { source: 'tool' });
    aiAvatarWidget.speechEngine.speak(prompt);
    return true;
  }
  prepareTool(
    aiAvatarWidget,
    pending.tool,
    pending.query,
    pending.routeMeta,
    extracted.args
  );
  return true;
}

export function offerToolChoices(aiAvatarWidget, query, candidates) {
  const choices = candidates.slice(0, 3);
  const message =
    '我找到幾個可能的操作，請選擇：' +
    choices
      .map((item, index) => index + 1 + '「' + item.tool.label + '」')
      .join('、');
  const id = addChatMessage(aiAvatarWidget, 'assistant', message, {
    pendingChoices: choices,
    source: 'tool'
  });
  const item = aiAvatarWidget.brainEngine.chatLog.find((entry) => entry.id === id);
  if (item) item.choiceQuery = query;
  aiAvatarWidget.brainEngine.pendingToolChoice = { messageId: id, choices };
  setHistoryOpen(aiAvatarWidget, true);
  aiAvatarWidget.speechEngine.speak(message);
}

export function continueToolChoice(aiAvatarWidget, text) {
  if (!aiAvatarWidget.brainEngine.pendingToolChoice) return false;
  if (/^(取消|不要|算了|cancel)$/i.test(String(text || '').trim())) {
    const item = aiAvatarWidget.brainEngine.chatLog.find(
      (entry) => entry.id === aiAvatarWidget.brainEngine.pendingToolChoice.messageId
    );
    if (item) {
      item.pendingChoices = null;
      item.text = '好的，已取消。';
    }
    aiAvatarWidget.brainEngine.pendingToolChoice = null;
    renderHistory(aiAvatarWidget);
    const message = '好的，已取消這個操作。';
    aiAvatarWidget.speechEngine.speak(message);
    return true;
  }
  let index = /(?:第一|1|一)/.test(text)
    ? 0
    : /(?:第二|2|二)/.test(text)
      ? 1
      : /(?:第三|3|三)/.test(text)
        ? 2
        : -1;
  if (index < 0) {
    const routed = window.AvatarToolRouter.route(
      aiAvatarWidget.brainEngine.pendingToolChoice.choices.map((item) => item.tool),
      text
    );
    if (routed.match)
      index = aiAvatarWidget.brainEngine.pendingToolChoice.choices.findIndex(
        (item) => item.tool.name === routed.match.tool.name
      );
  }
  if (index >= 0 && aiAvatarWidget.brainEngine.pendingToolChoice.choices[index]) {
    chooseTool(
      aiAvatarWidget,
      aiAvatarWidget.brainEngine.pendingToolChoice.messageId,
      index
    );
    return true;
  }
  const prompt = '請說「第一個、第二個、第三個」，或點選你要的操作。';
  addChatMessage(aiAvatarWidget, 'assistant', prompt, { source: 'tool' });
  aiAvatarWidget.speechEngine.speak(prompt);
  return true;
}

export function chooseTool(aiAvatarWidget, messageId, index) {
  const item = aiAvatarWidget.brainEngine.chatLog.find((entry) => entry.id === messageId);
  if (!item || !item.pendingChoices || !item.pendingChoices[index]) return;
  const selected = item.pendingChoices[index];
  item.pendingChoices = null;
  item.text = '已選擇「' + selected.tool.label + '」。';
  aiAvatarWidget.brainEngine.pendingToolChoice = null;
  renderHistory(aiAvatarWidget);
  prepareTool(
    aiAvatarWidget,
    selected.tool,
    item.choiceQuery || '',
    { confidence: selected.score, reason: 'user_choice' },
    {}
  );
}

export function offerHostTool(aiAvatarWidget, tool, query, routeMeta, args) {
  const callId = 'tool-' + Date.now() + '-' + ++aiAvatarWidget.chatSeq;
  const history = aiAvatarWidget.brainEngine.chatLog
    .slice(-12)
    .map((item) => ({ role: item.role, text: item.text }))
    .filter((item) => item.text);
  const pending = {
    callId,
    name: tool.name,
    label: tool.label,
    input: {
      query,
      context: {},
      args: args || {},
      route: routeMeta || {},
      history
    }
  };
  const summary = window.AvatarToolRouter.argumentSummary(tool, args || {});

  if (tool.requiresConfirmation) {
    const confirmation =
      '要幫你執行「' + tool.label + '」嗎？' + (summary ? '\n' + summary : '');
    addChatMessage(aiAvatarWidget, 'assistant', confirmation, {
      id: callId,
      pendingTool: pending,
      source: 'tool'
    });
    aiAvatarWidget.brainEngine.pendingToolConfirmation = callId;
    setHistoryOpen(aiAvatarWidget, true);
    aiAvatarWidget.speechEngine.speak(confirmation);
  } else {
    addChatMessage(
      aiAvatarWidget,
      'assistant',
      '正在執行「' + tool.label + '」…',
      { id: callId, source: 'tool' }
    );
    if (typeof aiAvatarWidget.optiopns.onToolCall === 'function') {
      aiAvatarWidget.optiopns.onToolCall(pending, aiAvatarWidget);
    }
  }
}

export function executePendingTool(aiAvatarWidget, messageId) {
  const item = aiAvatarWidget.brainEngine.chatLog.find((m) => m.id === messageId);
  if (!item || !item.pendingTool) return;
  const pending = item.pendingTool;
  item.pendingTool = null;
  aiAvatarWidget.brainEngine.pendingToolConfirmation = '';
  item.text = '正在執行「' + pending.label + '」…';
  renderHistory(aiAvatarWidget);
  if (typeof aiAvatarWidget.optiopns.onToolCall === 'function') {
    aiAvatarWidget.optiopns.onToolCall(pending, aiAvatarWidget);
  }
}

export function cancelPendingTool(aiAvatarWidget, messageId) {
  const item = aiAvatarWidget.brainEngine.chatLog.find((m) => m.id === messageId);
  if (!item || !item.pendingTool) return;
  item.pendingTool = null;
  aiAvatarWidget.brainEngine.pendingToolConfirmation = '';
  item.text = '好的，已取消。';
  renderHistory(aiAvatarWidget);
  if (aiAvatarWidget.speechEngine.convoOn) {
    aiAvatarWidget.speechEngine.speak('好的，已取消。');
  }
}

export function continueToolConfirmation(aiAvatarWidget, text) {
  if (!aiAvatarWidget.brainEngine.pendingToolConfirmation) return false;
  const answer = String(text || '').trim();
  if (/^(確認|確定|執行|可以|好|好的|yes|ok)$/i.test(answer)) {
    executePendingTool(aiAvatarWidget, aiAvatarWidget.brainEngine.pendingToolConfirmation);
    return true;
  }
  if (/^(取消|不要|算了|否|no|cancel)$/i.test(answer)) {
    cancelPendingTool(aiAvatarWidget, aiAvatarWidget.brainEngine.pendingToolConfirmation);
    return true;
  }
  const prompt = '請說「確認」或「取消」，也可以點選按鈕。';
  addChatMessage(aiAvatarWidget, 'assistant', prompt, { source: 'tool' });
  aiAvatarWidget.speechEngine.speak(prompt);
  return true;
}

export function handleToolResult(aiAvatarWidget, d) {
  const text =
    d.ok === false
      ? '執行失敗：' + String(d.error || '未知錯誤')
      : String(d.message || '已完成。');
  const existing = aiAvatarWidget.brainEngine.chatLog.find((m) => m.id === d.callId);
  if (existing) {
    updateChatMessage(aiAvatarWidget, existing.id, text, false);
  } else {
    addChatMessage(aiAvatarWidget, 'assistant', text, { source: 'tool' });
  }
  aiAvatarWidget.speechEngine.speak(text);
}

