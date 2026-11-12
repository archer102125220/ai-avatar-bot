import type { I18nEngine } from '@/core/i18n';
import { ENGINE_MODE_MAP } from '@/core/constants';
import type { UiContext, SkinModeToggleOptions } from './types';

/**
 * Traverses and updates all elements in the container matching `data-i18n`, `data-i18n-html`, `data-i18n-placeholder`, and `data-i18n-aria`.
 */
export function updateUIStrings(
  container: HTMLElement,
  i18nEngine: I18nEngine
): void {
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
 */
export function copyText(text: string): Promise<void> {
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
 * Initializes and syncs the 2D / 3D model skin mode toggle button based on model availability and configuration.
 */
export function initSkinModeChangeButton(
  context: UiContext | null = null,
  options?: SkinModeToggleOptions
): void {
  const skinModeButtonEl = context?.uiDom?.skinModeButtonEl;
  if (skinModeButtonEl instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar initSkinModeChangeButton] skinModeButtonEl is not an HTMLElement'
    );
    return;
  }

  const has2D = options?.has2D === true;
  const has3D = options?.has3D === true;
  const isEngineToggleEnabled = options?.isEngineToggleEnabled !== false;

  const shouldShow =
    isEngineToggleEnabled === true && has2D === true && has3D === true;

  if (shouldShow === true) {
    skinModeButtonEl.style.display = '';
    if (
      context?.skinEngine?.engineMode === ENGINE_MODE_MAP.threeDimensional
    ) {
      skinModeButtonEl.textContent = '3D';
    } else {
      skinModeButtonEl.textContent = '2D';
    }

    if (typeof skinModeButtonEl.onclick !== 'function') {
      skinModeButtonEl.onclick = () => {
        const skinEngine = context?.skinEngine;
        if (typeof skinEngine === 'object' && skinEngine !== null) {
          if (skinEngine.engineMode === ENGINE_MODE_MAP.threeDimensional) {
            skinEngine.engineMode = ENGINE_MODE_MAP.twoDimensional;
          } else {
            skinEngine.engineMode = ENGINE_MODE_MAP.threeDimensional;
          }
        }
      };
    }
  } else {
    skinModeButtonEl.style.display = 'none';
  }
}
