// ui.js
export function initUi(container) {
  if (container instanceof HTMLElement === false) {
    console.error('[aiAvatar initUi] container is not an HTMLElement');
    return;
  }

  if (
    ['relative', 'absolute', 'fixed'].includes(
      getComputedStyle(container).position
    ) === false
  ) {
    container.style.position = 'relative';
  }

  const stageEl = document.createElement('div');
  stageEl.setAttribute('id', 'stage');
  const bubbleEl = document.createElement('p');
  bubbleEl.setAttribute('id', 'bubble');
  const suggestionsEl = document.createElement('div');
  suggestionsEl.setAttribute('id', 'suggestions');
  const controlBarEl = document.createElement('div');
  controlBarEl.setAttribute('id', 'control-bar');
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
  micButtonEl.setAttribute('aria-label', '開始語音對話');
  micButtonEl.classList.add('ctrl');
  micButtonEl.classList.add('primary');
  const micButtonSpanEl = document.createElement('span');
  micButtonSpanEl.setAttribute('aria-hidden', 'true');
  micButtonSpanEl.textContent = '🎤 說話';
  micButtonEl.appendChild(micButtonSpanEl);

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
  stageEl.appendChild(controlBarEl);
  controlBarEl.appendChild(dockRow1El);
  controlBarEl.appendChild(dockRow2El);
  dockRow1El.appendChild(questionInputEl);
  dockRow1El.appendChild(sendButtonEl);
  dockRow2El.appendChild(micButtonEl);
  dockRow2El.appendChild(btnLlmEl);
  dockRow2El.appendChild(engineButtonEl);
  dockRow2El.appendChild(muteButtonEl);
  dockRow2El.appendChild(speedButtonEl);
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
