import '@/style/style.scss';
import type { I18nEngine } from '@/core/i18n';
import { DEFAULT_AVATAR_MODE, AVATAR_MODE_MAP } from '@/core/constants';
import type {
  UiDom,
  VoiceStatusOptions,
  MicStateOptions,
  UpdateBubbleOptions
} from './types';
import type { AvatarMode } from '@/core/types';

/**
 * Initializes and mounts UI elements (dialogue bubble, suggestions container, history panel, control dock) into the target container.
 */
export function initUi(
  container: HTMLElement,
  stageEl: HTMLElement,
  i18nEngine: I18nEngine | null = null
): UiDom | undefined {
  if (container instanceof HTMLElement === false) {
    console.error('[aiAvatar initUi] container is not an HTMLElement');
    return;
  }
  if (stageEl instanceof HTMLElement === false) {
    console.error('[aiAvatar initUi] stageEl is not an HTMLElement');
    return;
  }

  let currentListening = false;
  let currentContinuousMode = false;
  let currentAvatarMode: AvatarMode = DEFAULT_AVATAR_MODE;
  let currentI18nEngine = i18nEngine;

  if (
    ['relative', 'absolute', 'fixed', 'sticky'].includes(
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

  const skinModeButtonEl = document.createElement('button');
  skinModeButtonEl.setAttribute('id', 'btn-engine');
  skinModeButtonEl.setAttribute('aria-label', '切換 2D / 3D 角色');
  skinModeButtonEl.setAttribute('data-i18n-aria', 'ui.engine.ariaLabel');
  skinModeButtonEl.classList.add('ctrl');
  skinModeButtonEl.style.display = 'none';
  skinModeButtonEl.textContent = '2D／3D';

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

  const llmButtonEl = document.createElement('button');
  llmButtonEl.setAttribute('id', 'btn-llm');
  llmButtonEl.setAttribute(
    'aria-label',
    '啟用瀏覽器內 AI 大腦（首次需下載模型）'
  );
  llmButtonEl.setAttribute('data-i18n-aria', 'ui.llm.ariaLabel');
  llmButtonEl.setAttribute('aria-pressed', 'false');
  llmButtonEl.classList.add('ctrl');
  const llmButtonSpanEl = document.createElement('span');
  llmButtonSpanEl.setAttribute('aria-hidden', 'true');
  llmButtonSpanEl.textContent = '🧠';
  llmButtonEl.appendChild(llmButtonSpanEl);

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
  dockRow2El.appendChild(llmButtonEl);
  dockRow2El.appendChild(skinModeButtonEl);
  dockRow2El.appendChild(muteButtonEl);
  dockRow2El.appendChild(speedButtonEl);
  dockRow2El.appendChild(langButtonEl);
  dockRow2El.appendChild(historyButtonEl);
  dockRow2El.appendChild(closeButtonEl);
  container.appendChild(stageEl);
  container.appendChild(directWarnEl);

  const uiDom: UiDom = {
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
    updateVoiceStatus(options?: VoiceStatusOptions) {
      if (typeof options?.i18n === 'object' && options.i18n !== null) {
        currentI18nEngine = options.i18n;
      }
      if (typeof options?.continuousMode === 'boolean') {
        currentContinuousMode = options.continuousMode;
      }
      if (currentContinuousMode === true) {
        voiceLiveEl.setAttribute('css-is-active', 'true');
        if (typeof options?.state === 'string' && options.state !== '') {
          voiceLiveEl.setAttribute('css-state', options.state);
        } else {
          voiceLiveEl.removeAttribute('css-state');
        }
      } else {
        voiceLiveEl.removeAttribute('css-is-active');
        voiceLiveEl.removeAttribute('css-state');
      }
      if (
        voiceStatusEl instanceof HTMLElement &&
        typeof options?.text !== 'undefined'
      ) {
        voiceStatusEl.textContent =
          typeof options.text === 'string' && options.text !== ''
            ? options.text
            : typeof currentI18nEngine?.t === 'function'
              ? currentI18nEngine.t('ui.voice.standby')
              : '即時語音待命';
      }
      if (
        typeof options?.level === 'number' &&
        voiceLevelEl instanceof HTMLElement
      ) {
        voiceLevelEl.style.width =
          Math.max(0, Math.min(100, options.level)) + '%';
      }
    },
    updateMicState(options?: MicStateOptions) {
      if (typeof options?.isListening === 'boolean') {
        currentListening = options.isListening;
      }
      if (typeof options?.continuousMode === 'boolean') {
        currentContinuousMode = options.continuousMode;
      }
      if (
        typeof options?.avatarMode === 'string' &&
        options.avatarMode !== ''
      ) {
        currentAvatarMode = options.avatarMode;
      }
      if (typeof options?.i18n === 'object' && options.i18n !== null) {
        currentI18nEngine = options.i18n;
      }

      if (currentListening === true) {
        micButtonEl.setAttribute('css-state', 'listening');
      } else {
        micButtonEl.removeAttribute('css-state');
      }

      micButtonEl.setAttribute(
        'aria-pressed',
        String(currentContinuousMode === true)
      );

      const translate = (key: string, defaultValue: string) => {
        return typeof currentI18nEngine?.t === 'function'
          ? currentI18nEngine.t(key)
          : defaultValue;
      };

      micButtonEl.textContent =
        currentListening === true
          ? currentAvatarMode === AVATAR_MODE_MAP.companion
            ? translate('ui.mic.chatting', '● 對話中')
            : translate('ui.mic.listening', '● 聆聽中')
          : currentContinuousMode === true
            ? translate('ui.mic.convoStandby', '◌ 對話中')
            : translate('ui.mic.live', '🎙️ 即時');

      if (suggestionsEl instanceof HTMLElement) {
        suggestionsEl.style.display =
          currentListening === true || currentContinuousMode === true
            ? 'none'
            : 'flex';
      }
    },
    updateBubble(text?: string, options?: UpdateBubbleOptions) {
      if (typeof text === 'string' && text !== '') {
        bubbleEl.textContent = text;
      }
      if (typeof options?.show === 'boolean') {
        if (options.show === true) {
          bubbleEl.setAttribute('css-is-show', 'true');
        } else {
          bubbleEl.removeAttribute('css-is-show');
        }
      }
      if (typeof options?.isThinking === 'boolean') {
        if (options.isThinking === true) {
          bubbleEl.setAttribute('css-is-thinking', 'true');
        } else {
          bubbleEl.removeAttribute('css-is-thinking');
        }
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
    get skinModeButtonEl() {
      return skinModeButtonEl;
    },
    get muteButtonEl() {
      return muteButtonEl;
    },
    get llmButtonEl() {
      return llmButtonEl;
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
    }
  };

  return uiDom;
}
