import { SUPPORTED_LOCALES } from '../i18n';
import { setHistoryOpen, renderHistory } from './history';

/**
 * 綁定文字輸入框與發送按鈕的事件。
 * 處理使用者的文字輸入並觸發對話引擎。
 * @param {import('./index').UiContext|null} context - 應用程式的共用狀態與參考。
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
 * @param {import('./index').UiContext|null} context - 應用程式的共用狀態與參考。
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
        if (typeof context.brainEngine?.memory?.clear === 'function') {
          context.brainEngine.memory.clear();
        }
        if (Array.isArray(context.brainEngine?.chatLog) === true) {
          context.brainEngine.chatLog.length = 0;
        }
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
