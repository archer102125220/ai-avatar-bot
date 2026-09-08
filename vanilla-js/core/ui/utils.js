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
 * 根據是否具備 2D 與 3D 模型設定，初始化切換引擎模式的按鈕。
 * @param {import('./index').UiContext|null} context - 應用程式的共用狀態與參考（需包含 uiDom, skinEngine 等）。
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
