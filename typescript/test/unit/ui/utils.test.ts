import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateUIStrings,
  copyText,
  initSkinModeChangeButton
} from '@/core/ui/utils';
import { initI18nEngine } from '@/core/i18n';
import { ENGINE_MODE_MAP } from '@/core/constants';
import type { I18nEngine } from '@core';
import type { UiContext } from '@/core/ui/types';

describe('UI Utilities (updateUIStrings, copyText, initSkinModeChangeButton)', () => {
  let container: HTMLElement;
  let i18nEngine: I18nEngine;

  beforeEach(() => {
    container = document.createElement('div');
    i18nEngine = initI18nEngine({ locale: 'zh-TW' });
  });

  describe('updateUIStrings', () => {
    it('should update text, html, placeholder, and aria labels according to data-i18n tags', () => {
      const pText = document.createElement('p');
      pText.setAttribute('data-i18n', 'ui.voice.standby');
      container.appendChild(pText);

      const pHtml = document.createElement('p');
      pHtml.setAttribute('data-i18n-html', 'ui.directWarn');
      container.appendChild(pHtml);

      const input = document.createElement('input');
      input.setAttribute('data-i18n-placeholder', 'ui.input.placeholder');
      container.appendChild(input);

      const btn = document.createElement('button');
      btn.setAttribute('data-i18n-aria', 'ui.mic.ariaLabel');
      container.appendChild(btn);

      updateUIStrings(container, i18nEngine);

      expect(pText.textContent).toBe('即時語音待命');
      expect(pHtml.innerHTML).toContain('embed.js');
      expect(input.getAttribute('placeholder')).toBe('打字問我也可以…');
      expect(btn.getAttribute('aria-label')).toBe('開始即時語音對話');
    });

    it('should do nothing if container or i18nEngine is invalid', () => {
      expect(() => updateUIStrings(null as unknown as HTMLElement, i18nEngine)).not.toThrow();
      expect(() => updateUIStrings(container, null as unknown as Parameters<typeof updateUIStrings>[1])).not.toThrow();
    });
  });

  describe('copyText', () => {
    it('should copy text using navigator.clipboard if available', async () => {
      const originalClipboard = navigator.clipboard;
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true
      });

      await copyText('複製的測試文字');
      expect(writeTextMock).toHaveBeenCalledWith('複製的測試文字');

      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true
      });
    });

    it('should fallback to execCommand if clipboard API is not available', async () => {
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: null,
        configurable: true
      });
      document.execCommand = vi.fn().mockReturnValue(true);

      await copyText('Fallback 複製');
      expect(document.execCommand).toHaveBeenCalledWith('copy');

      Reflect.deleteProperty(document, 'execCommand');
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true
      });
    });
  });

  describe('initSkinModeChangeButton', () => {
    let mockContext: {
      uiDom: { engineButtonEl: HTMLButtonElement };
      ENGINE_MODE_MAP: typeof ENGINE_MODE_MAP;
      skinEngine: {
        engineMode: string;
      };
    };
    let engineButtonEl: HTMLButtonElement;

    beforeEach(() => {
      engineButtonEl = document.createElement('button');
      mockContext = {
        uiDom: { engineButtonEl },
        ENGINE_MODE_MAP,
        skinEngine: {
          engineMode: ENGINE_MODE_MAP.twoDimensional
        }
      };
    });

    it('should display engine toggle button only when has2D, has3D, and isEngineToggleEnabled are all true', () => {
      initSkinModeChangeButton(mockContext as unknown as UiContext, true, true, true);
      expect(engineButtonEl.style.display).toBe('');
      expect(engineButtonEl.textContent).toBe('2D');

      initSkinModeChangeButton(mockContext as unknown as UiContext, true, false, true);
      expect(engineButtonEl.style.display).toBe('none');

      initSkinModeChangeButton(mockContext as unknown as UiContext, false, true, true);
      expect(engineButtonEl.style.display).toBe('none');

      initSkinModeChangeButton(mockContext as unknown as UiContext, true, true, false);
      expect(engineButtonEl.style.display).toBe('none');
    });

    it('should toggle engineMode between 2D and 3D when clicking engine button', () => {
      initSkinModeChangeButton(mockContext as unknown as UiContext, true, true, true);

      // Current mode is 2D, clicking should switch to 3D
      engineButtonEl.click();
      expect(mockContext.skinEngine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);

      // Now mode is 3D, clicking should switch back to 2D
      mockContext.skinEngine.engineMode = ENGINE_MODE_MAP.threeDimensional;
      engineButtonEl.click();
      expect(mockContext.skinEngine.engineMode).toBe(ENGINE_MODE_MAP.twoDimensional);
    });
  });
});
