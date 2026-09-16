/**
 * @file UI history module providing slide-out panel rendering, message timeline, and pending tool confirmation controls.
 * @module core/ui/history
 */

import { copyText } from './utils';

/**
 * Toggles the open/closed state of the conversation history panel and synchronizes aria attributes and related elements.
 *
 * @param {import('@types').UiContext} context - Shared UI context state and engine references.
 * @param {boolean} open - Whether to open (`true`) or close (`false`) the history panel.
 * @returns {void}
 */
export function setHistoryOpen(context, open) {
  const historyPanelEl = context.uiDom.historyPanelEl;
  const historyButtonEl = context.uiDom.historyButtonEl;
  const suggestionsEl = context.uiDom.suggestionsEl;
  const bubbleEl = context.uiDom.bubbleEl;

  if (
    historyPanelEl instanceof HTMLElement &&
    historyButtonEl instanceof HTMLElement
  ) {
    if (open === true) {
      historyPanelEl.setAttribute('css-is-open', 'true');
    } else {
      historyPanelEl.removeAttribute('css-is-open');
    }
    historyPanelEl.inert = open !== true;
    historyButtonEl.setAttribute('aria-expanded', String(open === true));
  }

  if (suggestionsEl instanceof HTMLElement) {
    suggestionsEl.style.display =
      open === true
        ? 'none'
        : context.speechEngine.isListening === true ||
            context.speechEngine.convoOn === true
          ? 'none'
          : 'flex';
  }

  if (bubbleEl instanceof HTMLElement) {
    if (open === true) {
      bubbleEl.style.opacity = '0';
      bubbleEl.style.pointerEvents = 'none';
      renderHistory(context);
    } else {
      bubbleEl.style.opacity = '';
      bubbleEl.style.pointerEvents = '';
    }
  }
}

/**
 * Renders or refreshes the multi-turn chat history message timeline, pending tool confirmations, and copy/replay actions.
 *
 * @param {import('@types').UiContext} context - Shared UI context state and engine references.
 * @returns {void}
 */
export function renderHistory(context) {
  const historyListEl =
    context.uiDom.historyPanelEl?.querySelector('#history-list');
  if (historyListEl instanceof HTMLElement === false) {
    return;
  }

  const translate = (key, defaultValue) => {
    return typeof context.i18nEngine?.t === 'function'
      ? context.i18nEngine.t(key)
      : defaultValue;
  };

  historyListEl.replaceChildren();

  if (
    Array.isArray(context.brainEngine.chatLog) === false ||
    context.brainEngine.chatLog.length === 0
  ) {
    const emptyLogEl = document.createElement('div');
    emptyLogEl.className = 'history-empty';
    emptyLogEl.textContent = translate(
      'ui.history.empty',
      '還沒有對話。問我一個問題，紀錄會出現在這裡。'
    );
    historyListEl.appendChild(emptyLogEl);
    return;
  }

  context.brainEngine.chatLog.forEach((chatItem) => {
    const historyItemRowEl = document.createElement('div');
    historyItemRowEl.className = 'history-item ' + chatItem.role;

    const messageEl = document.createElement('div');
    messageEl.className = 'history-message';
    messageEl.textContent =
      typeof chatItem.text === 'string' && chatItem.text !== ''
        ? chatItem.text
        : chatItem.streaming === true
          ? '…'
          : '';
    historyItemRowEl.appendChild(messageEl);

    if (
      typeof chatItem.pendingTool !== 'undefined' &&
      chatItem.pendingTool !== null
    ) {
      const confirmContainerEl = document.createElement('div');
      confirmContainerEl.className = 'history-confirm';
      const confirmButtonEl = document.createElement('button');
      confirmButtonEl.type = 'button';
      confirmButtonEl.className = 'confirm';
      confirmButtonEl.textContent = translate('ui.history.confirm', '確認執行');
      const cancelButtonEl = document.createElement('button');
      cancelButtonEl.type = 'button';
      cancelButtonEl.className = 'cancel';
      cancelButtonEl.textContent = translate('ui.history.cancel', '取消');

      const isInactive =
        chatItem.cancelled === true ||
        chatItem.timedOut === true ||
        chatItem.executed === true;

      if (isInactive === true) {
        confirmButtonEl.disabled = true;
        confirmButtonEl.setAttribute('disabled', 'true');
        cancelButtonEl.disabled = true;
        cancelButtonEl.setAttribute('disabled', 'true');
        confirmContainerEl.setAttribute('css-disabled', 'true');

        if (chatItem.timedOut === true) {
          confirmButtonEl.textContent = translate(
            'ui.history.timedOut',
            '已逾時'
          );
        } else if (chatItem.cancelled === true) {
          cancelButtonEl.textContent = translate(
            'ui.history.cancelled',
            '已取消'
          );
        }
      } else {
        confirmButtonEl.onclick = () => {
          context.toolsEngine.executePendingTool(chatItem.id);
        };
        cancelButtonEl.onclick = () => {
          context.toolsEngine.cancelPendingTool(chatItem.id);
        };
      }

      confirmContainerEl.append(confirmButtonEl, cancelButtonEl);
      historyItemRowEl.appendChild(confirmContainerEl);
    } else if (
      Array.isArray(chatItem.pendingChoices) &&
      chatItem.pendingChoices.length > 0
    ) {
      const choicesContainerEl = document.createElement('div');
      choicesContainerEl.className = 'history-confirm';
      chatItem.pendingChoices.forEach((choice, index) => {
        const choiceButtonEl = document.createElement('button');
        choiceButtonEl.type = 'button';
        choiceButtonEl.className = 'confirm';
        choiceButtonEl.textContent = choice.tool.label;
        choiceButtonEl.onclick = () => {
          context.toolsEngine.chooseTool(chatItem.id, index);
        };
        choicesContainerEl.appendChild(choiceButtonEl);
      });
      historyItemRowEl.appendChild(choicesContainerEl);
    }

    if (
      chatItem.role === 'assistant' &&
      typeof chatItem.text === 'string' &&
      chatItem.text !== '' &&
      chatItem.streaming !== true
    ) {
      const toolsContainerEl = document.createElement('div');
      toolsContainerEl.className = 'history-tools';
      const copyButtonEl = document.createElement('button');
      copyButtonEl.type = 'button';
      copyButtonEl.className = 'history-tool';
      copyButtonEl.textContent = translate('ui.history.copy', '複製');
      const replayButtonEl = document.createElement('button');
      replayButtonEl.type = 'button';
      replayButtonEl.className = 'history-tool';
      replayButtonEl.textContent = translate('ui.history.replay', '重播');

      copyButtonEl.onclick = () => {
        copyText(chatItem.text).then(() => {
          context.speechEngine.spokenDisplayText = translate(
            'ui.history.copied',
            '已複製回答'
          );
        });
      };
      replayButtonEl.onclick = () => {
        context.speechEngine.speak(chatItem.text);
      };

      toolsContainerEl.append(copyButtonEl, replayButtonEl);
      historyItemRowEl.appendChild(toolsContainerEl);
    }

    historyListEl.appendChild(historyItemRowEl);
  });

  historyListEl.scrollTop = historyListEl.scrollHeight;
}
