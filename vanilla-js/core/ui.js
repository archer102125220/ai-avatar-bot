/**
 * 虛擬人前端 UI 元素的集合與相關控制方法
 * @typedef {Object} UiDom
 * @property {HTMLElement} stageEl - 3D 或 2D 虛擬人所在的舞台元素
 * @property {HTMLElement} bubbleEl - 對話泡泡元素
 * @property {HTMLElement} suggestionsEl - 建議對話容器元素
 * @property {HTMLElement} historyPanelEl - 聊天紀錄面板元素
 * @property {HTMLElement} voiceLiveEl - 語音即時狀態元素
 * @property {HTMLElement} voiceStatusEl - 語音狀態文字元素
 * @property {HTMLElement} voiceLevelEl - 語音音量條元素
 * @property {(convoOn: boolean, text?: string, state?: string, level?: number, i18n?: Object) => void} updateVoiceStatus - 更新語音狀態 (convoOn, text, state, level, i18n)
 * @property {(isListening: boolean, convoOn: boolean, isCompanion?: boolean, i18n?: Object) => void} updateMicState - 更新麥克風按鈕狀態 (isListening, convoOn, isCompanion, i18n)
 * @property {HTMLElement} controlBarEl - 控制列容器
 * @property {HTMLElement} dockRow1El - 控制列第一排（文字輸入列）
 * @property {HTMLElement} dockRow2El - 控制列第二排（功能按鈕列）
 * @property {HTMLElement} questionInputEl - 文字輸入框
 * @property {HTMLElement} sendButtonEl - 送出按鈕
 * @property {HTMLElement} micButtonEl - 麥克風按鈕
 * @property {HTMLElement} engineButtonEl - 2D/3D 切換按鈕
 * @property {HTMLElement} muteButtonEl - 靜音按鈕
 * @property {HTMLElement} btnLlmEl - AI 大腦啟用按鈕
 * @property {HTMLElement} speedButtonEl - 語速調整按鈕
 * @property {HTMLElement} langButtonEl - 語言切換按鈕
 * @property {HTMLElement} historyButtonEl - 聊天紀錄按鈕
 * @property {HTMLElement} closeButtonEl - 關閉按鈕
 * @property {HTMLElement} directWarnEl - 直接開啟警告提示元素
 * @property {HTMLElement} minimalEl - 最小化時的喚醒按鈕
 * @property {boolean} onTapTimer - 點擊計時器狀態
 */

/**
 * 傳遞給 UI 模組的應用程式狀態與參考集合
 * @typedef {Object} UiContext
 * @property {UiDom} uiDom - UI DOM 元素與控制方法
 * @property {Object} [speechEngine] - 語音引擎實例
 * @property {Object} [brainEngine] - AI 大腦引擎實例
 * @property {Object} [toolsEngine] - 工具引擎實例
 * @property {Object} [skinEngine] - 外觀引擎實例
 * @property {Object} [i18nEngine] - 多語系引擎實例
 * @property {string} [locale] - 當前語系代碼
 * @property {string[]} [suggestedQuestions] - 建議對話列表
 * @property {string} [suggestedTitle] - 建議對話標題
 * @property {string[]} [companionSuggestedQuestions] - 陪伴模式的建議對話列表
 * @property {string} [companionSuggestedTitle] - 陪伴模式的建議對話標題
 * @property {string[]} [assistantSuggestedQuestions] - 助理模式的建議對話列表
 * @property {string} [assistantSuggestedTitle] - 助理模式的建議對話標題
 * @property {string} [avatarMode] - 虛擬人模式 ('companion' | 'assistant')
 * @property {Object} [AVATAR_MODE_MAP] - 虛擬人模式常數對應表
 * @property {Object} [ENGINE_MODE_MAP] - 引擎模式常數對應表
 * @property {Object} [STATE_MAP] - 狀態常數對應表
 * @property {boolean} [isMinimal] - 是否處於最小化狀態
 * @property {boolean} [isIframe] - 是否在 iframe 中執行
 * @property {(text: string) => Promise<void>|void} [handleUser] - 處理使用者輸入文字的主方法
 * @property {(isMinimal: boolean, context: UiContext) => void} [onMinimalTrigger] - 最小化觸發回呼函數
 */

import { resolveLocalized, SUPPORTED_LOCALES } from './i18n';

/**
 * 遍歷並更新容器內所有帶有 data-i18n 屬性的 UI 元素。
 * @param {HTMLElement} container - 包含 UI 元素的容器
 * @param {Object} i18nEngine - 多語系引擎實例
 */
export function updateUIStrings(container, i18nEngine) {
  if (
    container instanceof HTMLElement === false ||
    typeof i18nEngine?.t !== 'function'
  ) {
    return;
  }

  container.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (typeof key === 'string' && key !== '') {
      element.textContent = i18nEngine.t(key);
    }
  });

  container.querySelectorAll('[data-i18n-html]').forEach((element) => {
    const key = element.getAttribute('data-i18n-html');
    if (typeof key === 'string' && key !== '') {
      element.innerHTML = i18nEngine.t(key);
    }
  });

  container.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (typeof key === 'string' && key !== '') {
      element.setAttribute('placeholder', i18nEngine.t(key));
    }
  });

  container.querySelectorAll('[data-i18n-aria]').forEach((element) => {
    const key = element.getAttribute('data-i18n-aria');
    if (typeof key === 'string' && key !== '') {
      element.setAttribute('aria-label', i18nEngine.t(key));
    }
  });
}

/**
 * 初始化使用者介面元件並附加至指定的容器中。
 * @param {HTMLElement} container - 要容納虛擬人助理的主要容器元素。
 * @param {HTMLElement} stageEl - 3D 或 2D 虛擬人所在的舞台元素。
 * @param {Object} [i18nEngine] - 多語系引擎實例。
 * @returns {UiDom|void} 包含各種 UI DOM 元素及控制方法的物件，若參數無效則回傳 undefined。
 */
export function initUi(container, stageEl, i18nEngine = null) {
  if (container instanceof HTMLElement === false) {
    console.error('[aiAvatar initUi] container is not an HTMLElement');
    return;
  }
  if (stageEl instanceof HTMLElement === false) {
    console.error('[aiAvatar initUi] stageEl is not an HTMLElement');
    return;
  }

  let currentListening = false;
  let currentConvoOn = false;
  let currentIsCompanion = false;
  let currentI18nEngine = i18nEngine;

  if (
    ['relative', 'absolute', 'fixed'].includes(
      getComputedStyle(container).position
    ) === false
  ) {
    container.style.position = 'relative';
  }

  const bubbleEl = document.createElement('p');
  bubbleEl.setAttribute('id', 'bubble');
  const suggestionsEl = document.createElement('div');
  suggestionsEl.setAttribute('id', 'suggestions');
  const historyPanelEl = document.createElement('section');
  historyPanelEl.setAttribute('id', 'history-panel');
  historyPanelEl.setAttribute('aria-label', '聊天紀錄');
  historyPanelEl.setAttribute('data-i18n-aria', 'ui.history.title');
  historyPanelEl.inert = true;

  const historyHead = document.createElement('div');
  historyHead.setAttribute('class', 'history-head');
  const historyTitle = document.createElement('p');
  historyTitle.setAttribute('class', 'history-title');
  historyTitle.setAttribute('data-i18n', 'ui.history.title');
  historyTitle.textContent = '聊天紀錄';
  const historyNote = document.createElement('span');
  historyNote.setAttribute('class', 'history-note');
  historyNote.setAttribute('data-i18n', 'ui.history.note');
  historyNote.textContent = '只保留在這次開啟期間';
  historyTitle.appendChild(historyNote);
  const historyClear = document.createElement('button');
  historyClear.setAttribute('class', 'history-action');
  historyClear.setAttribute('id', 'btn-history-clear');
  historyClear.setAttribute('type', 'button');
  historyClear.setAttribute('data-i18n', 'ui.history.clear');
  historyClear.textContent = '清除';
  const historyClose = document.createElement('button');
  historyClose.setAttribute('class', 'history-action');
  historyClose.setAttribute('id', 'btn-history-close');
  historyClose.setAttribute('type', 'button');
  historyClose.setAttribute('aria-label', '關閉聊天紀錄');
  historyClose.setAttribute('data-i18n-aria', 'ui.history.closeAria');
  historyClose.textContent = '✕';
  historyHead.appendChild(historyTitle);
  historyHead.appendChild(historyClear);
  historyHead.appendChild(historyClose);

  const historyList = document.createElement('div');
  historyList.setAttribute('id', 'history-list');
  historyList.setAttribute('role', 'log');
  historyList.setAttribute('aria-live', 'polite');

  historyPanelEl.appendChild(historyHead);
  historyPanelEl.appendChild(historyList);

  const controlBarEl = document.createElement('div');
  controlBarEl.setAttribute('id', 'control-bar');

  const voiceLiveEl = document.createElement('div');
  voiceLiveEl.setAttribute('id', 'voice-live');
  voiceLiveEl.setAttribute('role', 'status');
  voiceLiveEl.setAttribute('aria-live', 'polite');
  const voiceDotEl = document.createElement('span');
  voiceDotEl.classList.add('voice-dot');
  voiceDotEl.setAttribute('aria-hidden', 'true');

  const voiceStatusEl = document.createElement('span');
  voiceStatusEl.setAttribute('id', 'voice-status');
  voiceStatusEl.setAttribute('data-i18n', 'ui.voice.standby');
  voiceStatusEl.textContent = '即時語音待命';

  const voiceMeterEl = document.createElement('span');
  voiceMeterEl.classList.add('voice-meter');
  voiceMeterEl.setAttribute('aria-hidden', 'true');

  const voiceLevelEl = document.createElement('i');
  voiceLevelEl.setAttribute('id', 'voice-level');
  voiceMeterEl.appendChild(voiceLevelEl);

  voiceLiveEl.appendChild(voiceDotEl);
  voiceLiveEl.appendChild(voiceStatusEl);
  voiceLiveEl.appendChild(voiceMeterEl);

  const dockRow1El = document.createElement('div');
  dockRow1El.classList.add('dock-row');

  const questionInputEl = document.createElement('input');
  questionInputEl.setAttribute('id', 'type-input');
  questionInputEl.setAttribute('type', 'text');
  questionInputEl.setAttribute('placeholder', '打字問我也可以…');
  questionInputEl.setAttribute('data-i18n-placeholder', 'ui.input.placeholder');
  questionInputEl.setAttribute('maxlength', '200');
  questionInputEl.setAttribute('aria-label', '輸入文字問題');
  questionInputEl.setAttribute('data-i18n-aria', 'ui.input.ariaLabel');

  const sendButtonEl = document.createElement('button');
  sendButtonEl.setAttribute('id', 'btn-send');
  sendButtonEl.classList.add('ctrl');
  sendButtonEl.classList.add('primary');
  sendButtonEl.setAttribute('aria-label', '送出文字問題');
  sendButtonEl.setAttribute('data-i18n-aria', 'ui.send.ariaLabel');
  const sendButtonSpan = document.createElement('span');
  sendButtonSpan.setAttribute('aria-hidden', 'true');
  sendButtonSpan.textContent = '➤';
  sendButtonEl.appendChild(sendButtonSpan);

  const dockRow2El = document.createElement('div');
  dockRow2El.classList.add('dock-row');
  dockRow2El.setAttribute('role', 'toolbar');
  dockRow2El.setAttribute('aria-label', '虛擬人控制列');
  dockRow2El.setAttribute('data-i18n-aria', 'ui.toolbar.ariaLabel');

  const micButtonEl = document.createElement('button');
  micButtonEl.setAttribute('id', 'btn-mic');
  micButtonEl.setAttribute(
    'aria-label',
    typeof currentI18nEngine?.t === 'function'
      ? currentI18nEngine.t('ui.mic.ariaLabel')
      : '開始即時語音對話'
  );
  micButtonEl.setAttribute('data-i18n-aria', 'ui.mic.ariaLabel');
  micButtonEl.setAttribute('aria-pressed', 'false');
  micButtonEl.classList.add('ctrl');
  micButtonEl.classList.add('primary');
  micButtonEl.textContent =
    typeof currentI18nEngine?.t === 'function'
      ? currentI18nEngine.t('ui.mic.live')
      : '🎙️ 即時';

  const engineButtonEl = document.createElement('button');
  engineButtonEl.setAttribute('id', 'btn-engine');
  engineButtonEl.setAttribute('aria-label', '切換 2D / 3D 角色');
  engineButtonEl.setAttribute('data-i18n-aria', 'ui.engine.ariaLabel');
  engineButtonEl.classList.add('ctrl');
  engineButtonEl.style.display = 'none';
  engineButtonEl.textContent = '2D／3D';

  const muteButtonEl = document.createElement('button');
  muteButtonEl.setAttribute('id', 'btn-mute');
  muteButtonEl.setAttribute('aria-label', '靜音');
  muteButtonEl.setAttribute('data-i18n-aria', 'ui.mute.ariaLabel');
  muteButtonEl.setAttribute('aria-pressed', 'false');
  muteButtonEl.classList.add('ctrl');
  const muteButtonSpanEl = document.createElement('span');
  muteButtonSpanEl.setAttribute('aria-hidden', 'true');
  muteButtonSpanEl.textContent = '🔊';
  muteButtonEl.appendChild(muteButtonSpanEl);

  const btnLlmEl = document.createElement('button');
  btnLlmEl.setAttribute('id', 'btn-llm');
  btnLlmEl.setAttribute('aria-label', '啟用瀏覽器內 AI 大腦（首次需下載模型）');
  btnLlmEl.setAttribute('data-i18n-aria', 'ui.llm.ariaLabel');
  btnLlmEl.setAttribute('aria-pressed', 'false');
  btnLlmEl.classList.add('ctrl');
  const btnLlmSpanEl = document.createElement('span');
  btnLlmSpanEl.setAttribute('aria-hidden', 'true');
  btnLlmSpanEl.textContent = '🧠';
  btnLlmEl.appendChild(btnLlmSpanEl);

  const speedButtonEl = document.createElement('button');
  speedButtonEl.setAttribute('id', 'btn-speed');
  speedButtonEl.setAttribute('aria-label', '調整語速');
  speedButtonEl.setAttribute('data-i18n-aria', 'ui.speed.ariaLabel');
  speedButtonEl.setAttribute('aria-pressed', 'false');
  speedButtonEl.classList.add('ctrl');
  const speedButtonSpanEl = document.createElement('span');
  speedButtonSpanEl.setAttribute('aria-hidden', 'true');
  speedButtonSpanEl.textContent = '1.0×';
  speedButtonEl.append(speedButtonSpanEl);

  const langButtonEl = document.createElement('button');
  langButtonEl.setAttribute('id', 'btn-lang');
  langButtonEl.setAttribute('aria-label', '切換對話語言');
  langButtonEl.setAttribute('data-i18n-aria', 'ui.lang.ariaLabel');
  langButtonEl.setAttribute('data-i18n', 'ui.lang.buttonText');
  langButtonEl.classList.add('ctrl');
  langButtonEl.textContent = '中文';

  const historyButtonEl = document.createElement('button');
  historyButtonEl.setAttribute('id', 'btn-history');
  historyButtonEl.setAttribute('aria-label', '開啟聊天紀錄');
  historyButtonEl.setAttribute('data-i18n-aria', 'ui.history.ariaLabel');
  historyButtonEl.setAttribute('aria-expanded', 'false');
  historyButtonEl.classList.add('ctrl');
  const historyButtonSpanEl = document.createElement('span');
  historyButtonSpanEl.setAttribute('aria-hidden', 'true');
  historyButtonSpanEl.textContent = '☰';
  historyButtonEl.appendChild(historyButtonSpanEl);

  const closeButtonEl = document.createElement('button');
  closeButtonEl.setAttribute('id', 'btn-close');
  closeButtonEl.setAttribute('aria-label', '收起助理');
  closeButtonEl.setAttribute('data-i18n-aria', 'ui.close.ariaLabel');
  closeButtonEl.classList.add('ctrl');
  const closeButtonSpanEl = document.createElement('span');
  closeButtonSpanEl.setAttribute('aria-hidden', 'true');
  closeButtonSpanEl.textContent = '✕';
  closeButtonEl.appendChild(closeButtonSpanEl);

  const directWarnEl = document.createElement('p');
  directWarnEl.setAttribute('id', 'direct-warn');
  directWarnEl.setAttribute('data-i18n-html', 'ui.directWarn');
  directWarnEl.textContent = '請透過 <code>embed.js</code> 載入此元件。';

  const minimalEl = document.createElement('button');
  minimalEl.type = 'button';
  minimalEl.className = 'aw-minimal';
  minimalEl.setAttribute('aria-label', '開啟 AI 虛擬人助理');
  minimalEl.setAttribute('data-i18n-aria', 'ui.minimal.ariaLabel');
  minimalEl.textContent = '💬';

  container.appendChild(minimalEl);

  stageEl.appendChild(bubbleEl);
  stageEl.appendChild(suggestionsEl);
  stageEl.appendChild(historyPanelEl);
  stageEl.appendChild(controlBarEl);
  controlBarEl.appendChild(voiceLiveEl);
  controlBarEl.appendChild(dockRow1El);
  controlBarEl.appendChild(dockRow2El);
  dockRow1El.appendChild(questionInputEl);
  dockRow1El.appendChild(sendButtonEl);
  dockRow2El.appendChild(micButtonEl);
  dockRow2El.appendChild(btnLlmEl);
  dockRow2El.appendChild(engineButtonEl);
  dockRow2El.appendChild(muteButtonEl);
  dockRow2El.appendChild(speedButtonEl);
  dockRow2El.appendChild(langButtonEl);
  dockRow2El.appendChild(historyButtonEl);
  dockRow2El.appendChild(closeButtonEl);
  container.appendChild(stageEl);
  container.appendChild(directWarnEl);

  const uiDom = {
    get stageEl() {
      return stageEl;
    },
    get bubbleEl() {
      return bubbleEl;
    },
    get suggestionsEl() {
      return suggestionsEl;
    },
    get historyPanelEl() {
      return historyPanelEl;
    },
    get voiceLiveEl() {
      return voiceLiveEl;
    },
    get voiceStatusEl() {
      return voiceStatusEl;
    },
    get voiceLevelEl() {
      return voiceLevelEl;
    },
    updateVoiceStatus(convoOn, text, state, level, i18n) {
      if (typeof i18n === 'object' && i18n !== null) {
        currentI18nEngine = i18n;
      }
      if (convoOn === true) {
        voiceLiveEl.setAttribute('css-is-active', 'true');
        if (typeof state === 'string' && state !== '') {
          voiceLiveEl.setAttribute('css-state', state);
        } else {
          voiceLiveEl.removeAttribute('css-state');
        }
      } else {
        voiceLiveEl.removeAttribute('css-is-active');
        voiceLiveEl.removeAttribute('css-state');
      }
      if (voiceStatusEl instanceof HTMLElement && typeof text !== 'undefined') {
        voiceStatusEl.textContent =
          typeof text === 'string' && text !== ''
            ? text
            : typeof currentI18nEngine?.t === 'function'
              ? currentI18nEngine.t('ui.voice.standby')
              : '即時語音待命';
      }
      if (typeof level === 'number' && voiceLevelEl instanceof HTMLElement) {
        voiceLevelEl.style.width = Math.max(0, Math.min(100, level)) + '%';
      }
    },
    updateMicState(isListening, convoOn, isCompanion, i18n) {
      if (typeof isListening === 'boolean') {
        currentListening = isListening;
      }
      if (typeof convoOn === 'boolean') {
        currentConvoOn = convoOn;
      }
      if (typeof isCompanion === 'boolean') {
        currentIsCompanion = isCompanion;
      }
      if (typeof i18n === 'object' && i18n !== null) {
        currentI18nEngine = i18n;
      }

      if (currentListening === true) {
        micButtonEl.setAttribute('css-state', 'listening');
      } else {
        micButtonEl.removeAttribute('css-state');
      }

      micButtonEl.setAttribute('aria-pressed', String(currentConvoOn === true));

      const translate = (key, defaultValue) => {
        return typeof currentI18nEngine?.t === 'function'
          ? currentI18nEngine.t(key)
          : defaultValue;
      };

      micButtonEl.textContent =
        currentListening === true
          ? currentIsCompanion === true
            ? translate('ui.mic.chatting', '● 對話中')
            : translate('ui.mic.listening', '● 聆聽中')
          : currentConvoOn === true
            ? translate('ui.mic.convoStandby', '◌ 對話中')
            : translate('ui.mic.live', '🎙️ 即時');

      if (suggestionsEl instanceof HTMLElement) {
        suggestionsEl.style.display =
          currentListening === true || currentConvoOn === true
            ? 'none'
            : 'flex';
      }
    },
    get controlBarEl() {
      return controlBarEl;
    },
    get dockRow1El() {
      return dockRow1El;
    },
    get dockRow2El() {
      return dockRow2El;
    },
    get questionInputEl() {
      return questionInputEl;
    },
    get sendButtonEl() {
      return sendButtonEl;
    },
    get micButtonEl() {
      return micButtonEl;
    },
    get engineButtonEl() {
      return engineButtonEl;
    },
    get muteButtonEl() {
      return muteButtonEl;
    },
    get btnLlmEl() {
      return btnLlmEl;
    },
    get speedButtonEl() {
      return speedButtonEl;
    },
    get langButtonEl() {
      return langButtonEl;
    },
    get historyButtonEl() {
      return historyButtonEl;
    },
    get closeButtonEl() {
      return closeButtonEl;
    },
    get directWarnEl() {
      return directWarnEl;
    },
    get minimalEl() {
      return minimalEl;
    },
    onTapTimer: false
  };

  return uiDom;
}

/**
 * 複製指定文字到系統剪貼簿。
 * @param {string} text - 要複製的文字內容。
 * @returns {Promise<void>} 複製完成後解析的 Promise。
 */
export function copyText(text) {
  if (
    typeof navigator === 'object' &&
    navigator !== null &&
    typeof navigator.clipboard === 'object' &&
    navigator.clipboard !== null &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    return navigator.clipboard.writeText(text);
  }
  const textAreaElement = document.createElement('textarea');
  textAreaElement.value = text;
  textAreaElement.style.position = 'fixed';
  textAreaElement.style.opacity = '0';
  document.body.appendChild(textAreaElement);
  textAreaElement.select();
  try {
    document.execCommand('copy');
  } finally {
    textAreaElement.remove();
  }
  return Promise.resolve();
}

/**
 * 設定聊天紀錄面板的開關狀態。
 * @param {UiContext} context - 應用程式的共用狀態與參考（需包含 uiDom, speechEngine 等）。
 * @param {boolean} open - true 表示開啟面板，false 表示關閉。
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
 * 渲染或更新聊天紀錄列表。
 * @param {UiContext} context - 應用程式的共用狀態與參考（需包含 uiDom, brainEngine 等）。
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

/**
 * 根據是否具備 2D 與 3D 模型設定，初始化切換引擎模式的按鈕。
 * @param {UiContext|null} context - 應用程式的共用狀態與參考（需包含 uiDom, skinEngine 等）。
 * @param {boolean} [has2D=false] - 是否具備 2D 模型。
 * @param {boolean} [has3D=false] - 是否具備 3D 模型。
 */
export function initSkinModeChangeButton(
  context = null,
  has2D = false,
  has3D = false
) {
  const engineButtonEl = context?.uiDom?.engineButtonEl;
  if (engineButtonEl instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar initSkinModeChangeButton] engineButtonEl is not an HTMLElement'
    );
    return;
  }

  if (has2D === true && has3D === true) {
    // 兩個皮都給 → 顯示切換鈕，讓使用者即時切
    if (engineButtonEl instanceof HTMLElement) {
      engineButtonEl.style.display = '';
      engineButtonEl.onclick = () => {
        context.skinEngine.engineMode =
          context.skinEngine.engineMode ===
          context.ENGINE_MODE_MAP.threeDimensional
            ? context.ENGINE_MODE_MAP.twoDimensional
            : context.ENGINE_MODE_MAP.threeDimensional;
      };
    }
  }
}

/**
 * 渲染建議對話選項。
 * 會根據使用者設定或助理模式（companion/assistant）顯示預設的建議選項。
 * @param {UiContext|null} context - 應用程式的共用狀態與參考。
 */
export function renderSuggestions(context = null) {
  const suggestionsEl = context?.uiDom?.suggestionsEl;
  if (suggestionsEl instanceof HTMLElement === false) {
    console.warn(
      '[aiAvatar renderSuggestions] context.suggestionsEl is not an HTMLElement'
    );
    return;
  }

  suggestionsEl.replaceChildren();

  const locale = context?.locale || context?.i18nEngine?.locale || 'zh-TW';
  const templateContext = { locale, avatarMode: context?.avatarMode };

  let defaultSuggestions = [
    '這是什麼？',
    '怎麼安裝到專案？',
    '支援 3D 與換角色嗎？',
    'AI 大腦是如何運作的？',
    '怎麼使用工具調用？',
    '需要架後端嗎？'
  ];

  if (/en/i.test(locale)) {
    defaultSuggestions = [
      'What is this?',
      'How to install to project?',
      'Supports 3D & custom models?',
      'How does the AI Brain work?',
      'How to use Function Calling?',
      'Does it require a backend?'
    ];
  } else if (/ja/i.test(locale)) {
    defaultSuggestions = [
      'これは何ですか？',
      'プロジェクトへの導入方法は？',
      '3D対応やアバター変更は？',
      'AIブレインの仕組みは？',
      'ツール呼び出しの使い方は？',
      'バックエンドは必要？'
    ];
  } else if (/ko/i.test(locale)) {
    defaultSuggestions = [
      '이것은 무엇인가요?',
      '프로젝트에 어떻게 설치하나요?',
      '3D 지원 및 캐릭터 변경은?',
      'AI 브레인은 어떻게 작동하나요?',
      '도구 호출은 어떻게 쓰나요?',
      '백엔드가 필요한가요?'
    ];
  }

  let defaultCompanionSuggestions = [
    '今天過得好嗎？',
    '跟我聊聊天',
    '說個笑話',
    '你會記得我嗎？',
    '誇誇我'
  ];
  if (/en/i.test(locale)) {
    defaultCompanionSuggestions = [
      'How is your day?',
      'Chat with me',
      'Tell a joke',
      'Will you remember me?',
      'Praise me'
    ];
  } else if (/ja/i.test(locale)) {
    defaultCompanionSuggestions = [
      '今日の調子はどう？',
      'お話ししよう',
      '面白い話をして',
      '私のこと覚えてる？',
      '褒めて'
    ];
  } else if (/ko/i.test(locale)) {
    defaultCompanionSuggestions = [
      '오늘 기분 어때?',
      '나랑 이야기하자',
      '재미있는 이야기 해줘',
      '나 기억해?',
      '칭찬해줘'
    ];
  }

  let resolvedSuggestions;
  if (
    Array.isArray(context?.suggestedQuestions) &&
    context.suggestedQuestions.length > 0
  ) {
    resolvedSuggestions = context.suggestedQuestions;
  } else if (
    typeof context?.suggestedQuestions === 'object' &&
    context.suggestedQuestions !== null
  ) {
    resolvedSuggestions = resolveLocalized(
      context.suggestedQuestions,
      locale,
      defaultSuggestions,
      templateContext
    );
  } else if (context?.avatarMode === context?.AVATAR_MODE_MAP?.companion) {
    resolvedSuggestions = resolveLocalized(
      context?.companionSuggestedQuestions,
      locale,
      defaultCompanionSuggestions,
      templateContext
    );
  } else {
    resolvedSuggestions = resolveLocalized(
      context?.assistantSuggestedQuestions,
      locale,
      defaultSuggestions,
      templateContext
    );
  }

  let defaultTitle = '💬 你可以問我：';
  if (/en/i.test(locale)) {
    defaultTitle = '💬 You can ask me:';
  } else if (/ja/i.test(locale)) {
    defaultTitle = '💬 よくある質問：';
  } else if (/ko/i.test(locale)) {
    defaultTitle = '💬 이런 질문을 해보세요:';
  }

  let defaultCompanionTitle = '💬 可以跟我聊：';
  if (/en/i.test(locale)) {
    defaultCompanionTitle = '💬 Chat with me about:';
  } else if (/ja/i.test(locale)) {
    defaultCompanionTitle = '💬 こんな話題で話せます：';
  } else if (/ko/i.test(locale)) {
    defaultCompanionTitle = '💬 저와 이런 이야기를 해보세요:';
  }

  let titleText;
  if (
    typeof context?.suggestedTitle !== 'undefined' &&
    context?.suggestedTitle !== null
  ) {
    titleText = resolveLocalized(
      context.suggestedTitle,
      locale,
      defaultTitle,
      templateContext
    );
  } else if (context?.avatarMode === context?.AVATAR_MODE_MAP?.companion) {
    titleText = resolveLocalized(
      context?.companionSuggestedTitle,
      locale,
      defaultCompanionTitle,
      templateContext
    );
  } else {
    titleText = resolveLocalized(
      context?.assistantSuggestedTitle,
      locale,
      defaultTitle,
      templateContext
    );
  }

  const titleLabelEl = document.createElement('p');
  titleLabelEl.classList.add('sg-label');
  titleLabelEl.textContent = titleText;

  suggestionsEl.appendChild(titleLabelEl);
  if (Array.isArray(resolvedSuggestions) && resolvedSuggestions.length > 0) {
    resolvedSuggestions.forEach((suggestion) => {
      const suggestionButtonEl = document.createElement('button');
      suggestionButtonEl.type = 'button';
      suggestionButtonEl.classList.add('sugg');
      suggestionButtonEl.textContent = suggestion;
      suggestionButtonEl.onclick = () => {
        if (typeof context?.handleUser === 'function') {
          context.handleUser(suggestion.replace(/？$/, ''));
        }
      };
      suggestionsEl.appendChild(suggestionButtonEl);
    });
  }
}

/**
 * 綁定文字輸入框與發送按鈕的事件。
 * 處理使用者的文字輸入並觸發對話引擎。
 * @param {UiContext|null} context - 應用程式的共用狀態與參考。
 */
export function bindTyping(context = null) {
  const questionInputEl = context?.uiDom?.questionInputEl;
  if (questionInputEl instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar bindTyping] context?.uiDom?.questionInputEl is not an HTMLElement'
    );
    return;
  }

  const handleSendMessage = () => {
    const text = questionInputEl.value.trim();
    if (typeof text !== 'string' || text === '') {
      return;
    }
    questionInputEl.value = '';
    context.handleUser(text);
  };
  context.uiDom.sendButtonEl.onclick = handleSendMessage;
  questionInputEl.addEventListener('keydown', (event) => {
    if (
      event.key === 'Enter' &&
      event.isComposing !== true &&
      event.keyCode !== 229
    ) {
      event.preventDefault();
      handleSendMessage();
    }
  });
}

/**
 * 綁定所有 UI 控制按鈕的點擊事件。
 * 包含語音、靜音、語速、語言切換、大腦（LLM）狀態等互動邏輯。
 * @param {UiContext|null} context - 應用程式的共用狀態與參考。
 */
export function bindUiEvent(context = null) {
  const uiDom = context?.uiDom || {};

  if (uiDom.minimalEl instanceof HTMLElement) {
    uiDom.minimalEl.onclick = function () {
      context.isMinimal = false;
    };
  }

  // ===== 控制列 =====
  if (uiDom.closeButtonEl instanceof HTMLElement) {
    uiDom.closeButtonEl.onclick = () => {
      if (context.isIframe === true) {
        context.onMinimalTrigger(true, context);
      } else {
        context.isMinimal = true;
      }
    };
  }

  if (uiDom.micButtonEl instanceof HTMLElement) {
    uiDom.micButtonEl.onclick = () => {
      const sessionEndedMsg =
        typeof context.i18nEngine?.t === 'function'
          ? context.i18nEngine.t('speech.sessionEnded')
          : '即時語音對話已結束。';

      if (context.avatarMode === 'companion') {
        const isIdle =
          context.speechEngine.isListening !== true &&
          context.speechEngine.isProcessing !== true;
        if (isIdle === true) {
          context.speechEngine.convoOn = true;
          context.speechEngine.noSpeechRuns = 0;
          context.speechEngine.startListening();
        } else {
          context.speechEngine.convoOn = false;
          context.speechEngine.stopVoiceSession(sessionEndedMsg);
        }
        return;
      }

      // 非 companion 模式
      if (context.speechEngine.isSpeaking === true) {
        context.speechEngine.interruptForVoice();
        context.speechEngine.startListening();
      } else {
        const isActive =
          context.speechEngine.isListening === true ||
          context.speechEngine.isProcessing === true;
        if (isActive === true) {
          context.speechEngine.stopVoiceSession(sessionEndedMsg);
        } else {
          context.speechEngine.startListening();
        }
      }
    };
  }

  if (uiDom.muteButtonEl instanceof HTMLElement) {
    uiDom.muteButtonEl.onclick = () => {
      const muteButtonEl = uiDom.muteButtonEl;
      context.speechEngine.ttsMuted = !context.speechEngine.ttsMuted;
      muteButtonEl.textContent =
        context.speechEngine.ttsMuted === true ? '🔇' : '🔊';
      muteButtonEl.setAttribute(
        'aria-pressed',
        String(context.speechEngine.ttsMuted === true)
      );
      if (context.speechEngine.ttsMuted === true) {
        context.speechEngine.stopSpeaking(); // 立刻停掉正在播的（神經語音 + 瀏覽器語音）
      }
      context.speechEngine.spokenDisplayText =
        context.speechEngine.ttsMuted === true
          ? typeof context.i18nEngine?.t === 'function'
            ? context.i18nEngine.t('ui.mute.muted')
            : '已靜音'
          : typeof context.i18nEngine?.t === 'function'
            ? context.i18nEngine.t('ui.mute.unmuted')
            : '已開啟語音';
    };
  }

  if (uiDom.speedButtonEl instanceof HTMLElement) {
    uiDom.speedButtonEl.onclick = () => {
      const speedButtonEl = uiDom.speedButtonEl;
      const steps = [0.9, 1.0, 1.2, 1.4];
      context.speechEngine.ttsRate =
        steps[
          (steps.indexOf(context.speechEngine.ttsRate) + 1) % steps.length
        ] || 1.0;
      speedButtonEl.textContent = context.speechEngine.ttsRate.toFixed(1) + '×';
      context.speechEngine.spokenDisplayText =
        typeof context.i18nEngine?.t === 'function'
          ? context.i18nEngine.t('ui.speed.text', {
              rate: context.speechEngine.ttsRate.toFixed(1)
            })
          : '語速：' + context.speechEngine.ttsRate.toFixed(1) + '×';
    };
  }

  if (uiDom.langButtonEl instanceof HTMLElement) {
    uiDom.langButtonEl.onclick = () => {
      const locales = SUPPORTED_LOCALES || ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'];
      const currentLocale =
        context.locale || context.i18nEngine?.locale || 'zh-TW';
      const nextLocale =
        locales[(locales.indexOf(currentLocale) + 1) % locales.length];

      if (
        context.i18nEngine &&
        typeof context.i18nEngine.setLocale === 'function'
      ) {
        context.i18nEngine.setLocale(nextLocale);
      } else {
        context.locale = nextLocale;
      }

      if (context.speechEngine) {
        context.speechEngine.spokenDisplayText =
          typeof context.i18nEngine?.t === 'function'
            ? context.i18nEngine.t('ui.lang.statusText')
            : nextLocale === 'en-US'
              ? 'Language: English'
              : nextLocale === 'ja-JP'
                ? '言語：日本語'
                : nextLocale === 'ko-KR'
                  ? '언어: 한국어'
                  : '語言：繁體中文';
      }
    };
  }

  if (uiDom.historyButtonEl instanceof HTMLElement) {
    uiDom.historyButtonEl.onclick = () => {
      const isOpen =
        uiDom.historyPanelEl?.getAttribute('css-is-open') === 'true';
      setHistoryOpen(context, !isOpen);
    };
  }

  if (uiDom.historyPanelEl instanceof HTMLElement) {
    const btnHistoryClose =
      uiDom.historyPanelEl.querySelector('#btn-history-close');
    const btnHistoryClear =
      uiDom.historyPanelEl.querySelector('#btn-history-clear');

    if (btnHistoryClose instanceof HTMLElement) {
      btnHistoryClose.onclick = () => {
        setHistoryOpen(context, false);
      };
    }
    if (btnHistoryClear instanceof HTMLElement) {
      btnHistoryClear.onclick = () => {
        context.brainEngine.chatLog.length = 0;
        renderHistory(context);
        context.speechEngine.spokenDisplayText =
          typeof context.i18nEngine?.t === 'function'
            ? context.i18nEngine.t('ui.history.cleared')
            : '已清除這次的聊天紀錄';
      };
    }
  }

  if (uiDom.btnLlmEl instanceof HTMLElement) {
    uiDom.btnLlmEl.onclick = async () => {
      const btnLlmEl = uiDom.btnLlmEl;

      // 啟用 AI 伺服器模式時：🧠 用來顯示狀態 / 重新連線，不下載 WebLLM
      if (context.brainEngine.aiProvider?.enabled === true) {
        const isServerReady =
          context.brainEngine.aiProvider.ready === true ||
          (await context.brainEngine.aiProvider.ping());
        btnLlmEl.textContent = isServerReady === true ? '🧠✓' : '🧠✗';
        if (isServerReady === true) {
          btnLlmEl.setAttribute('css-llm-on', 'true');
        } else {
          btnLlmEl.removeAttribute('css-llm-on');
        }
        btnLlmEl.setAttribute('aria-pressed', String(isServerReady === true));
        context.speechEngine.spokenDisplayText =
          isServerReady === true
            ? 'AI 伺服器大腦運作中（' +
              context.brainEngine.aiProvider.model +
              '）🧠'
            : 'AI 伺服器連不上：確認 AI 伺服器在跑、且 AI_PROVIDER_ORIGINS 已允許這個網站。';

        return;
      }
      if (context.brainEngine.llm?.supported !== true) {
        context.speechEngine.spokenDisplayText =
          '這個裝置不支援 WebGPU，先用知識庫模式就好（功能一樣可用）。';
        return;
      }
      if (context.brainEngine.llm?.state === context.STATE_MAP.READY) {
        context.speechEngine.spokenDisplayText = 'AI 大腦已啟用，問我問題吧 🧠';
        return;
      } else if (context.brainEngine.llm?.state === context.STATE_MAP.LOADING) {
        context.speechEngine.spokenDisplayText =
          'AI 大腦載入中… ' +
          Math.round(context.brainEngine.llm.progress * 100) +
          '%';
        return;
      }

      await context.brainEngine.llm.load();
    };
  }
}
