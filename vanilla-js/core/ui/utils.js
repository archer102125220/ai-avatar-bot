/**
 * @file UI utility helpers for localized DOM updating, clipboard copying, and skin mode switch button setup.
 * @module core/ui/utils
 */

/**
 * Traverses and updates all elements in the container matching `data-i18n`, `data-i18n-html`, `data-i18n-placeholder`, and `data-i18n-aria`.
 *
 * @param {HTMLElement} container - Target container element containing UI nodes.
 * @param {import('@types').I18nEngine} i18nEngine - Internationalization engine instance.
 * @returns {void}
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
 * Copies the provided string text to the system clipboard using the modern Clipboard API or execCommand fallback.
 *
 * @param {string} text - Text string content to copy to clipboard.
 * @returns {Promise<void>} Resolves when copy operation finishes.
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
 * Initializes and syncs the 2D / 3D model engine toggle button based on model availability and configuration.
 *
 * @param {import('@types').UiContext|null} [context=null] - Shared UI context references (containing uiDom, skinEngine, etc.).
 * @param {boolean} [has2D=false] - Whether 2D Live2D model assets are configured.
 * @param {boolean} [has3D=false] - Whether 3D VRM model assets are configured.
 * @param {boolean} [isEngineToggleEnabled=true] - Whether 2D/3D mode toggling is allowed.
 * @returns {void}
 */
export function initSkinModeChangeButton(
  context = null,
  has2D = false,
  has3D = false,
  isEngineToggleEnabled = true
) {
  const engineButtonEl = context?.uiDom?.engineButtonEl;
  if (engineButtonEl instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar initSkinModeChangeButton] engineButtonEl is not an HTMLElement'
    );
    return;
  }

  const shouldShow =
    isEngineToggleEnabled === true &&
    has2D === true &&
    has3D === true;

  if (shouldShow === true) {
    // Enabled and both models present -> display switch button and sync active mode label
    engineButtonEl.style.display = '';
    if (
      context?.skinEngine?.engineMode ===
      context?.ENGINE_MODE_MAP?.threeDimensional
    ) {
      engineButtonEl.textContent = '3D';
    } else {
      engineButtonEl.textContent = '2D';
    }

    if (typeof engineButtonEl.onclick !== 'function') {
      engineButtonEl.onclick = () => {
        if (
          context?.skinEngine?.engineMode ===
          context?.ENGINE_MODE_MAP?.threeDimensional
        ) {
          context.skinEngine.engineMode =
            context.ENGINE_MODE_MAP.twoDimensional;
        } else if (
          context?.skinEngine !== null &&
          typeof context?.skinEngine === 'object'
        ) {
          context.skinEngine.engineMode =
            context.ENGINE_MODE_MAP.threeDimensional;
        }
      };
    }
  } else {
    engineButtonEl.style.display = 'none';
  }
}


