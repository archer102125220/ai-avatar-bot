import { SUPPORTED_LOCALES } from '@/core/i18n';
import { setHistoryOpen, renderHistory } from './history';
import type { UiContext } from './types';

/**
 * Binds keyboard Enter key and send button click events for user question submission.
 */
export function bindTyping(context: UiContext | null = null): void {
  if (context === null) {
    return;
  }
  const questionInputEl = context.uiDom?.questionInputEl;
  if (questionInputEl instanceof HTMLInputElement === false) {
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
    if (typeof context.handleUser === 'function') {
      context.handleUser(text);
    }
  };
  if (context.uiDom?.sendButtonEl) {
    context.uiDom.sendButtonEl.onclick = handleSendMessage;
  }
  questionInputEl.addEventListener('keydown', (event: KeyboardEvent) => {
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
 * Binds click events and interactive handlers for toolbar control buttons (mic, mute, speed, lang, history, LLM, minimize).
 */
export function bindUiEvent(context: UiContext | null = null): void {
  if (context === null) {
    return;
  }
  const uiDom = context.uiDom || {};

  if (uiDom.minimalEl instanceof HTMLElement) {
    uiDom.minimalEl.onclick = function () {
      context.isMinimal = false;
    };
  }

  // ===== Control Bar =====
  if (uiDom.closeButtonEl instanceof HTMLElement) {
    uiDom.closeButtonEl.onclick = () => {
      if (context.isIframe === true) {
        if (typeof context.onMinimalTrigger === 'function') {
          context.onMinimalTrigger(true, context);
        }
      } else {
        context.isMinimal = true;
      }
    };
  }

  if (uiDom.micButtonEl instanceof HTMLElement) {
    uiDom.micButtonEl.onclick = () => {
      const speechEngine = context.speechEngine;
      if (!speechEngine) {
        return;
      }
      const sessionEndedMsg =
        typeof context.i18nEngine?.t === 'function'
          ? context.i18nEngine.t('speech.sessionEnded')
          : '即時語音對話已結束。';

      if (context.avatarMode === 'companion') {
        const isIdle =
          speechEngine.isListening !== true &&
          speechEngine.isProcessing !== true;
        if (isIdle === true) {
          speechEngine.convoOn = true;
          speechEngine.noSpeechRuns = 0;
          speechEngine.startListening();
        } else {
          speechEngine.convoOn = false;
          speechEngine.stopVoiceSession(sessionEndedMsg);
        }
        return;
      }

      // Non-companion mode
      if (speechEngine.isSpeaking === true) {
        speechEngine.interruptForVoice();
        speechEngine.startListening();
      } else {
        const isActive =
          speechEngine.isListening === true ||
          speechEngine.isProcessing === true;
        if (isActive === true) {
          speechEngine.stopVoiceSession(sessionEndedMsg);
        } else {
          speechEngine.startListening();
        }
      }
    };
  }

  if (uiDom.muteButtonEl instanceof HTMLElement) {
    uiDom.muteButtonEl.onclick = () => {
      const speechEngine = context.speechEngine;
      if (!speechEngine) {
        return;
      }
      const muteButtonEl = uiDom.muteButtonEl;
      speechEngine.ttsMuted = !speechEngine.ttsMuted;
      muteButtonEl.textContent = speechEngine.ttsMuted === true ? '🔇' : '🔊';
      muteButtonEl.setAttribute(
        'aria-pressed',
        String(speechEngine.ttsMuted === true)
      );
      if (speechEngine.ttsMuted === true) {
        speechEngine.stopSpeaking();
      }
      speechEngine.spokenDisplayText =
        speechEngine.ttsMuted === true
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
      const speechEngine = context.speechEngine;
      if (!speechEngine) {
        return;
      }
      const speedButtonEl = uiDom.speedButtonEl;
      const steps = [0.9, 1.0, 1.2, 1.4];
      speechEngine.ttsRate =
        steps[(steps.indexOf(speechEngine.ttsRate) + 1) % steps.length] || 1.0;
      speedButtonEl.textContent = speechEngine.ttsRate.toFixed(1) + '×';
      speechEngine.spokenDisplayText =
        typeof context.i18nEngine?.t === 'function'
          ? context.i18nEngine.t('ui.speed.text', {
              rate: speechEngine.ttsRate.toFixed(1)
            })
          : '語速：' + speechEngine.ttsRate.toFixed(1) + '×';
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
        if (context.speechEngine) {
          context.speechEngine.spokenDisplayText =
            typeof context.i18nEngine?.t === 'function'
              ? context.i18nEngine.t('ui.history.cleared')
              : '已清除這次的聊天紀錄';
        }
      };
    }
  }

  if (uiDom.btnLlmEl instanceof HTMLElement) {
    uiDom.btnLlmEl.onclick = async () => {
      const btnLlmEl = uiDom.btnLlmEl;
      const brainEngine = context.brainEngine;
      const speechEngine = context.speechEngine;
      if (!brainEngine) {
        return;
      }

      if (brainEngine.aiProvider?.enabled === true) {
        const isServerReady =
          brainEngine.aiProvider.ready === true ||
          (await brainEngine.aiProvider.ping());
        btnLlmEl.textContent = isServerReady === true ? '🧠✓' : '🧠✗';
        if (isServerReady === true) {
          btnLlmEl.setAttribute('css-llm-on', 'true');
        } else {
          btnLlmEl.removeAttribute('css-llm-on');
        }
        btnLlmEl.setAttribute('aria-pressed', String(isServerReady === true));
        if (speechEngine) {
          speechEngine.spokenDisplayText =
            isServerReady === true
              ? 'AI 伺服器大腦運作中（' + brainEngine.aiProvider.model + '）🧠'
              : 'AI 伺服器連不上：確認 AI 伺服器在跑、且 AI_PROVIDER_ORIGINS 已允許這個網站。';
        }

        return;
      }
      if (brainEngine.llm?.supported !== true) {
        if (speechEngine) {
          speechEngine.spokenDisplayText =
            '這個裝置不支援 WebGPU，先用知識庫模式就好（功能一樣可用）。';
        }
        return;
      }
      const readyState = context.STATE_MAP?.READY;
      const loadingState = context.STATE_MAP?.LOADING;
      if (
        typeof readyState === 'string' &&
        brainEngine.llm?.state === readyState
      ) {
        if (speechEngine) {
          speechEngine.spokenDisplayText = 'AI 大腦已啟用，問我問題吧 🧠';
        }
        return;
      } else if (
        typeof loadingState === 'string' &&
        brainEngine.llm?.state === loadingState
      ) {
        if (speechEngine) {
          speechEngine.spokenDisplayText =
            'AI 大腦載入中… ' +
            Math.round((brainEngine.llm.progress ?? 0) * 100) +
            '%';
        }
        return;
      }

      if (typeof brainEngine.llm?.load === 'function') {
        await brainEngine.llm.load();
      }
    };
  }
}
