// ui.js
export function initUi(container, stageEl) {
  if (container instanceof HTMLElement === false) {
    console.error('[aiAvatar initUi] container is not an HTMLElement');
    return;
  }
  if (stageEl instanceof HTMLElement === false) {
    console.error('[aiAvatar initUi] stageEl is not an HTMLElement');
    return;
  }

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
  historyPanelEl.setAttribute('aria-hidden', 'true');
  historyPanelEl.innerHTML = `
    <div class="history-head">
      <div class="history-title">聊天紀錄<span class="history-note">只保留在這次開啟期間</span></div>
      <button class="history-action" id="btn-history-clear" type="button">清除</button>
      <button class="history-action" id="btn-history-close" type="button" aria-label="關閉聊天紀錄">✕</button>
    </div>
    <div id="history-list" role="log" aria-live="polite"></div>
  `;

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
  questionInputEl.setAttribute('maxlength', '200');
  questionInputEl.setAttribute('aria-label', '輸入文字問題');

  const sendButtonEl = document.createElement('button');
  sendButtonEl.setAttribute('id', 'btn-send');
  sendButtonEl.classList.add('ctrl');
  sendButtonEl.classList.add('primary');
  sendButtonEl.setAttribute('aria-label', '送出文字問題');
  const sendButtonSpan = document.createElement('span');
  sendButtonSpan.setAttribute('aria-hidden', 'true');
  sendButtonSpan.textContent = '➤';
  sendButtonEl.appendChild(sendButtonSpan);

  const dockRow2El = document.createElement('div');
  dockRow2El.classList.add('dock-row');
  dockRow2El.setAttribute('role', 'toolbar');
  dockRow2El.setAttribute('aria-label', '虛擬人控制列');

  const micButtonEl = document.createElement('button');
  micButtonEl.setAttribute('id', 'btn-mic');
  micButtonEl.setAttribute('aria-label', '開始即時語音對話');
  micButtonEl.setAttribute('aria-pressed', 'false');
  micButtonEl.classList.add('ctrl');
  micButtonEl.classList.add('primary');
  const micButtonSpanEl = document.createElement('span');
  micButtonSpanEl.setAttribute('aria-hidden', 'true');
  micButtonSpanEl.textContent = '🎙️';
  micButtonEl.appendChild(micButtonSpanEl);
  micButtonEl.appendChild(document.createTextNode(' 即時'));

  const engineButtonEl = document.createElement('button');
  engineButtonEl.setAttribute('id', 'btn-engine');
  engineButtonEl.setAttribute('aria-label', '切換 2D / 3D 角色');
  engineButtonEl.classList.add('ctrl');
  engineButtonEl.style.display = 'none';
  engineButtonEl.textContent = '2D／3D';

  const muteButtonEl = document.createElement('button');
  muteButtonEl.setAttribute('id', 'btn-mute');
  muteButtonEl.setAttribute('aria-label', '靜音');
  muteButtonEl.setAttribute('aria-pressed', 'false');
  muteButtonEl.classList.add('ctrl');
  const muteButtonSpanEl = document.createElement('span');
  muteButtonSpanEl.setAttribute('aria-hidden', 'true');
  muteButtonSpanEl.textContent = '🔊';
  muteButtonEl.appendChild(muteButtonSpanEl);

  const btnLlmEl = document.createElement('button');
  btnLlmEl.setAttribute('id', 'btn-llm');
  btnLlmEl.setAttribute('aria-label', '啟用瀏覽器內 AI 大腦（首次需下載模型）');
  btnLlmEl.setAttribute('aria-pressed', 'false');
  btnLlmEl.classList.add('ctrl');
  const btnLlmSpanEl = document.createElement('span');
  btnLlmSpanEl.setAttribute('aria-hidden', 'true');
  btnLlmSpanEl.textContent = '🧠';
  btnLlmEl.appendChild(btnLlmSpanEl);

  const speedButtonEl = document.createElement('button');
  speedButtonEl.setAttribute('id', 'btn-speed');
  speedButtonEl.setAttribute('aria-label', '調整語速');
  speedButtonEl.setAttribute('aria-pressed', 'false');
  speedButtonEl.classList.add('ctrl');
  const speedButtonSpanEl = document.createElement('span');
  speedButtonSpanEl.setAttribute('aria-hidden', 'true');
  speedButtonSpanEl.textContent = '1.0×';
  speedButtonEl.append(speedButtonSpanEl);

  const langButtonEl = document.createElement('button');
  langButtonEl.setAttribute('id', 'btn-lang');
  langButtonEl.setAttribute('aria-label', '切換對話語言');
  langButtonEl.classList.add('ctrl');
  langButtonEl.textContent = '中';

  const historyButtonEl = document.createElement('button');
  historyButtonEl.setAttribute('id', 'btn-history');
  historyButtonEl.setAttribute('aria-label', '開啟聊天紀錄');
  historyButtonEl.setAttribute('aria-expanded', 'false');
  historyButtonEl.classList.add('ctrl');
  const historyButtonSpanEl = document.createElement('span');
  historyButtonSpanEl.setAttribute('aria-hidden', 'true');
  historyButtonSpanEl.textContent = '☰';
  historyButtonEl.appendChild(historyButtonSpanEl);

  const closeButtonEl = document.createElement('button');
  closeButtonEl.setAttribute('id', 'btn-close');
  closeButtonEl.setAttribute('aria-label', '收起助理');
  closeButtonEl.classList.add('ctrl');
  const closeButtonSpanEl = document.createElement('span');
  closeButtonSpanEl.setAttribute('aria-hidden', 'true');
  closeButtonSpanEl.textContent = '✕';
  closeButtonEl.appendChild(closeButtonSpanEl);

  const directWarnEl = document.createElement('p');
  directWarnEl.setAttribute('id', 'direct-warn');
  directWarnEl.textContent = '請透過 <code>embed.js</code> 載入此元件。';

  const minimalEl = document.createElement('button');
  minimalEl.type = 'button';
  minimalEl.className = 'aw-minimal';
  minimalEl.setAttribute('aria-label', '開啟 AI 虛擬人助理');
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
    updateVoiceStatus(convoOn, text, state, level) {
      if (convoOn) {
        voiceLiveEl.setAttribute('css-is-active', 'true');
        if (state) {
          voiceLiveEl.setAttribute('css-state', state);
        } else {
          voiceLiveEl.removeAttribute('css-state');
        }
      } else {
        voiceLiveEl.removeAttribute('css-is-active');
        voiceLiveEl.removeAttribute('css-state');
      }
      if (voiceStatusEl && text !== undefined) {
        voiceStatusEl.textContent = text || '即時語音待命';
      }
      if (typeof level === 'number' && voiceLevelEl) {
        voiceLevelEl.style.width = Math.max(0, Math.min(100, level)) + '%';
      }
    },
    updateMicState(isListening, convoOn, isCompanion) {
      if (isListening === true) {
        micButtonEl.setAttribute('css-state', 'listening');
      } else {
        micButtonEl.removeAttribute('css-state');
      }

      micButtonEl.setAttribute('aria-pressed', String(!!convoOn));

      micButtonEl.textContent =
        isListening === true
          ? isCompanion
            ? '● 對話中'
            : '● 聆聽中'
          : convoOn
            ? '◌ 對話中'
            : '🎙️ 即時';

      if (suggestionsEl) {
        suggestionsEl.style.display = isListening || convoOn ? 'none' : 'flex';
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

export function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText)
    return navigator.clipboard.writeText(text);
  const box = document.createElement('textarea');
  box.value = text;
  box.style.position = 'fixed';
  box.style.opacity = '0';
  document.body.appendChild(box);
  box.select();
  try {
    document.execCommand('copy');
  } finally {
    box.remove();
  }
  return Promise.resolve();
}

export function setHistoryOpen(aiAvatarWidget, open) {
  const panel = aiAvatarWidget.uiDom.historyPanelEl;
  const btn = aiAvatarWidget.uiDom.historyButtonEl;
  const suggestions = aiAvatarWidget.uiDom.suggestionsEl;
  const bubble = aiAvatarWidget.uiDom.bubbleEl;

  if (panel instanceof HTMLElement && btn instanceof HTMLElement) {
    if (open) {
      panel.setAttribute('css-is-open', 'true');
    } else {
      panel.removeAttribute('css-is-open');
    }
    panel.setAttribute('aria-hidden', String(!open));
    btn.setAttribute('aria-expanded', String(!!open));
  }

  if (suggestions instanceof HTMLElement) {
    suggestions.style.display = open
      ? 'none'
      : aiAvatarWidget.speechEngine.isListening ||
          aiAvatarWidget.speechEngine.convoOn
        ? 'none'
        : 'flex';
  }

  if (bubble instanceof HTMLElement) {
    if (open) {
      bubble.style.opacity = '0';
      bubble.style.pointerEvents = 'none';
      renderHistory(aiAvatarWidget);
    } else {
      bubble.style.opacity = '';
      bubble.style.pointerEvents = '';
    }
  }
}

export function renderHistory(aiAvatarWidget) {
  const list =
    aiAvatarWidget.uiDom.historyPanelEl?.querySelector('#history-list');
  if (!list) return;

  list.replaceChildren();

  if (!aiAvatarWidget.brainEngine.chatLog || !aiAvatarWidget.brainEngine.chatLog.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = '還沒有對話。問我一個問題，紀錄會出現在這裡。';
    list.appendChild(empty);
    return;
  }

  aiAvatarWidget.brainEngine.chatLog.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-item ' + item.role;

    const msg = document.createElement('div');
    msg.className = 'history-message';
    msg.textContent = item.text || (item.streaming ? '…' : '');
    row.appendChild(msg);

    if (item.pendingTool) {
      const confirm = document.createElement('div');
      confirm.className = 'history-confirm';
      const yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'confirm';
      yes.textContent = '確認執行';
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'cancel';
      no.textContent = '取消';
      
      yes.onclick = () => aiAvatarWidget.toolsEngine.executePendingTool(item.id);
      no.onclick = () => aiAvatarWidget.toolsEngine.cancelPendingTool(item.id);

      confirm.append(yes, no);
      row.appendChild(confirm);
    } else if (item.pendingChoices && item.pendingChoices.length) {
      const choices = document.createElement('div');
      choices.className = 'history-confirm';
      item.pendingChoices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'confirm';
        button.textContent = choice.tool.label;
        button.onclick = () => aiAvatarWidget.toolsEngine.chooseTool(item.id, index);
        choices.appendChild(button);
      });
      row.appendChild(choices);
    }

    if (item.role === 'assistant' && item.text && !item.streaming) {
      const tools = document.createElement('div');
      tools.className = 'history-tools';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'history-tool';
      copy.textContent = '複製';
      const replay = document.createElement('button');
      replay.type = 'button';
      replay.className = 'history-tool';
      replay.textContent = '重播';

      copy.onclick = () => {
        copyText(item.text).then(() => {
          aiAvatarWidget.speechEngine.spokenDisplayText = '已複製回答';
        });
      };
      replay.onclick = () => {
        aiAvatarWidget.speechEngine.speak(item.text);
      };

      tools.append(copy, replay);
      row.appendChild(tools);
    }

    list.appendChild(row);
  });

  list.scrollTop = list.scrollHeight;
}

export function initSkinModeChangeButton(aiAvatarWidget = null, has2D, has3D) {
  const engineButtonEl = aiAvatarWidget?.uiDom?.engineButtonEl;
  if (engineButtonEl instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar initSkinModeChangeButton] engineButtonEl is not an HTMLElement'
    );
    return;
  }

  if (
    typeof has2D === 'string' &&
    has2D !== '' &&
    typeof has3D === 'string' &&
    has3D !== ''
  ) {
    // 兩個皮都給 → 顯示切換鈕，讓使用者即時切
    if (engineButtonEl instanceof HTMLElement) {
      engineButtonEl.style.display = '';
      engineButtonEl.onclick = () => {
        aiAvatarWidget.skinEngine.engineMode = aiAvatarWidget.ENGINE_MODE_MAP.threeDimensional
          ? aiAvatarWidget.ENGINE_MODE_MAP.twoDimensional
          : aiAvatarWidget.ENGINE_MODE_MAP.threeDimensional;
      };
    }
  }
}

export function renderSuggestions(aiAvatarWidget = null) {
  const suggestions = aiAvatarWidget.uiDom.suggestionsEl;
  if (suggestions instanceof HTMLElement === false) {
    console.warn(
      '[aiAvatar renderSuggestions] aiAvatarWidget.suggestionsEl is not an HTMLElement'
    );
    return;
  }

  const SUGGESTIONS =
    Array.isArray(aiAvatarWidget.suggestedQuestions) &&
    aiAvatarWidget.suggestedQuestions.length > 0
      ? aiAvatarWidget.suggestedQuestions
      : aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion
        ? Array.isArray(aiAvatarWidget.companionSuggestedQuestions) &&
          aiAvatarWidget.companionSuggestedQuestions.length > 0
          ? aiAvatarWidget.companionSuggestedQuestions
          : ['今天過得好嗎？', '跟我聊聊天', '說個笑話', '你會記得我嗎？']
        : Array.isArray(aiAvatarWidget.assistantSuggestedQuestions) &&
            aiAvatarWidget.assistantSuggestedQuestions.length > 0
          ? aiAvatarWidget.assistantSuggestedQuestions
          : [
              '怎麼安裝？',
              '怎麼換成我的角色？',
              '要不要錢？',
              '麥克風怎麼用？',
              '我可以說什麼？'
            ];

  const label = document.createElement('p');
  label.classList.add('sg-label');
  label.textContent =
    aiAvatarWidget.suggestedTitle ||
    (aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion
      ? aiAvatarWidget.companionSuggestedTitle || '💬 可以跟我聊：'
      : aiAvatarWidget.assistantSuggestedTitle || '💬 你可以問我：');

  suggestions.appendChild(label);
  SUGGESTIONS.forEach((suggestion) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('sugg');
    button.textContent = suggestion;
    button.onclick = () => {
      aiAvatarWidget.speechEngine.handleUser(suggestion.replace(/？$/, ''));
    };
    suggestions.appendChild(button);
  });
}

export function bindTyping(aiAvatarWidget = null) {
  const typeInput = aiAvatarWidget?.uiDom?.questionInputEl;
  if (typeInput instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar bindTyping] aiAvatarWidget?.uiDom?.questionInputEl is not an HTMLElement'
    );
    return;
  }

  const send = () => {
    const text = typeInput.value.trim();
    if (typeof text !== 'string' || text === '') {
      return;
    }
    typeInput.value = '';
    aiAvatarWidget.speechEngine.handleUser(text);
  };
  aiAvatarWidget.uiDom.sendButtonEl.onclick = send;
  typeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      send();
    }
  });
}

export function bindUiEvent(aiAvatarWidget = null) {
  const uiDom = aiAvatarWidget?.uiDom || {};

  if (uiDom.minimalEl instanceof HTMLElement) {
    uiDom.minimalEl.onclick = function () {
      aiAvatarWidget.isMinimal = false;
    };
  }

  // ===== 控制列 =====
  if (uiDom.closeButtonEl instanceof HTMLElement) {
    uiDom.closeButtonEl.onclick = () => {
      if (aiAvatarWidget.isIframe === true) {
        aiAvatarWidget.onMinimalTrigger(true, aiAvatarWidget);
      } else {
        aiAvatarWidget.isMinimal = true;
      }
    };
  }

  if (uiDom.micButtonEl instanceof HTMLElement) {
        uiDom.micButtonEl.onclick = () => {
      if (aiAvatarWidget.avatarMode === 'companion') {
        const isIdle = !aiAvatarWidget.speechEngine.isListening && !aiAvatarWidget.speechEngine.isProcessing;
        if (isIdle) {
          aiAvatarWidget.speechEngine.convoOn = true;
          aiAvatarWidget.speechEngine.noSpeechRuns = 0;
          aiAvatarWidget.speechEngine.startListening();
        } else {
          aiAvatarWidget.speechEngine.convoOn = false;
          aiAvatarWidget.speechEngine.stopVoiceSession('即時語音對話已結束。');
        }
        return;
      }
      
      // 非 companion 模式
      if (aiAvatarWidget.speechEngine.isSpeaking) {
        aiAvatarWidget.speechEngine.interruptForVoice();
        aiAvatarWidget.speechEngine.startListening();
      } else {
        const isActive = aiAvatarWidget.speechEngine.isListening || aiAvatarWidget.speechEngine.isProcessing;
        if (isActive) {
          aiAvatarWidget.speechEngine.stopVoiceSession('即時語音對話已結束。');
        } else {
          aiAvatarWidget.speechEngine.startListening();
        }
      }
    };
  }

  if (uiDom.muteButtonEl instanceof HTMLElement) {
    uiDom.muteButtonEl.onclick = (event) => {
      const el = event.target;
      aiAvatarWidget.speechEngine.ttsMuted =
        !aiAvatarWidget.speechEngine.ttsMuted;
      el.textContent = aiAvatarWidget.speechEngine.ttsMuted ? '🔇' : '🔊';
      el.setAttribute(
        'aria-pressed',
        String(aiAvatarWidget.speechEngine.ttsMuted)
      );
      if (aiAvatarWidget.speechEngine.ttsMuted === true) {
        aiAvatarWidget.speechEngine.stopSpeaking(); // 立刻停掉正在播的（神經語音 + 瀏覽器語音）
      }
      aiAvatarWidget.speechEngine.spokenDisplayText = aiAvatarWidget
        .speechEngine.ttsMuted
        ? '已靜音'
        : '已開啟語音';
    };
  }

  if (uiDom.speedButtonEl instanceof HTMLElement) {
    uiDom.speedButtonEl.onclick = (event) => {
      const el = event.target;
      const steps = [0.9, 1.0, 1.2, 1.4];
      aiAvatarWidget.speechEngine.ttsRate =
        steps[
          (steps.indexOf(aiAvatarWidget.speechEngine.ttsRate) + 1) %
            steps.length
        ] || 1.0;
      el.textContent = aiAvatarWidget.speechEngine.ttsRate.toFixed(1) + '×';
      aiAvatarWidget.speechEngine.spokenDisplayText =
        '語速：' + aiAvatarWidget.speechEngine.ttsRate.toFixed(1) + '×';
    };
  }

  if (uiDom.langButtonEl instanceof HTMLElement) {
    uiDom.langButtonEl.onclick = () => {
      const locales = ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'];
      const current = aiAvatarWidget.speechEngine.currentLocale || 'zh-TW';
      const next = locales[(locales.indexOf(current) + 1) % locales.length];
      aiAvatarWidget.speechEngine.setLocale(next);

      let msg = '語言：繁體中文';
      if (next === 'en-US') msg = 'Language: English';
      else if (next === 'ja-JP') msg = '言語：日本語';
      else if (next === 'ko-KR') msg = '언어: 한국어';

      aiAvatarWidget.speechEngine.spokenDisplayText = msg;
    };
  }

  if (uiDom.historyButtonEl instanceof HTMLElement) {
    uiDom.historyButtonEl.onclick = () => {
      const isOpen = uiDom.historyPanelEl?.getAttribute('css-is-open') === 'true';
      setHistoryOpen(aiAvatarWidget, !isOpen);
    };
  }

  if (uiDom.historyPanelEl instanceof HTMLElement) {
    const btnHistoryClose =
      uiDom.historyPanelEl.querySelector('#btn-history-close');
    const btnHistoryClear =
      uiDom.historyPanelEl.querySelector('#btn-history-clear');

    if (btnHistoryClose) {
      btnHistoryClose.onclick = () => setHistoryOpen(aiAvatarWidget, false);
    }
    if (btnHistoryClear) {
      btnHistoryClear.onclick = () => {
        aiAvatarWidget.brainEngine.chatLog.length = 0;
        renderHistory(aiAvatarWidget);
        aiAvatarWidget.speechEngine.spokenDisplayText = '已清除這次的聊天紀錄';
      };
    }
  }

  if (uiDom.btnLlmEl instanceof HTMLElement) {
    uiDom.btnLlmEl.onclick = async (event) => {
      const el = event.target;

      // 啟用 AI 伺服器模式時：🧠 用來顯示狀態 / 重新連線，不下載 WebLLM
      if (aiAvatarWidget.brainEngine.aiProvider?.enabled === true) {
        const ok =
          aiAvatarWidget.brainEngine.aiProvider.ready ||
          (await aiAvatarWidget.brainEngine.aiProvider.ping());
        // el.textContent = ok ? '🧠本機' : '🧠✗';
        el.textContent = ok ? '🧠✓' : '🧠✗';
        if (ok) {
          el.setAttribute('css-llm-on', 'true');
        } else {
          el.removeAttribute('css-llm-on');
        }
        el.setAttribute('aria-pressed', String(ok));
        aiAvatarWidget.speechEngine.spokenDisplayText = ok
          ? 'AI 伺服器大腦運作中（' +
            aiAvatarWidget.brainEngine.aiProvider.model +
            '）🧠'
          : 'AI 伺服器連不上：確認 AI 伺服器在跑、且 AI_PROVIDER_ORIGINS 已允許這個網站。';

        return;
      }
      if (aiAvatarWidget.brainEngine.llm?.supported !== true) {
        aiAvatarWidget.speechEngine.spokenDisplayText =
          '這個裝置不支援 WebGPU，先用知識庫模式就好（功能一樣可用）。';
        return;
      }
      if (aiAvatarWidget.brainEngine.llm?.state === aiAvatarWidget.STATE_MAP.READY) {
        aiAvatarWidget.speechEngine.spokenDisplayText =
          'AI 大腦已啟用，問我問題吧 🧠';
        return;
      } else if (aiAvatarWidget.brainEngine.llm?.state === aiAvatarWidget.STATE_MAP.LOADING) {
        aiAvatarWidget.speechEngine.spokenDisplayText =
          'AI 大腦載入中… ' +
          Math.round(aiAvatarWidget.brainEngine.llm.progress * 100) +
          '%';
        return;
      }

      await aiAvatarWidget.brainEngine.llm.load();
    };
  }
}
