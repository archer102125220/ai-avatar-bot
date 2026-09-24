import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderSuggestions } from '@/core/ui/suggestions';
import { initUi } from '@/core/ui/dom';
import { initI18nEngine } from '@/core/i18n';
import { AVATAR_MODE_MAP } from '@/core/constants';
import type { I18nEngine } from '@core';
import type { UiDom } from '@/core/ui/types';

interface MockSuggestionsContext {
  uiDom: UiDom;
  i18nEngine: I18nEngine;
  locale: string;
  avatarMode: string;
  AVATAR_MODE_MAP: typeof AVATAR_MODE_MAP;
  handleUser?: (query: string) => void;
  suggestedTitle?: string | Record<string, string>;
  suggestedQuestions?:
    | string[]
    | Record<string, string[]>
    | ((ctx: MockSuggestionsContext) => string[]);
}

describe('UI Suggestions (renderSuggestions)', () => {
  let container: HTMLElement;
  let stageEl: HTMLElement;
  let i18nEngine: I18nEngine;
  let uiDom: UiDom;
  let mockContext: MockSuggestionsContext;

  beforeEach(() => {
    container = document.createElement('div');
    stageEl = document.createElement('div');
    i18nEngine = initI18nEngine({ locale: 'zh-TW' });
    uiDom = initUi(container, stageEl, i18nEngine)!;

    mockContext = {
      uiDom,
      i18nEngine,
      locale: 'zh-TW',
      avatarMode: AVATAR_MODE_MAP.assistant,
      AVATAR_MODE_MAP,
      handleUser: vi.fn()
    };
  });

  it('should render default assistant suggestions and dispatch handleUser on click', () => {
    renderSuggestions(
      mockContext as unknown as Parameters<typeof renderSuggestions>[0]
    );

    const titleEl = uiDom.suggestionsEl.querySelector('.sg-label');
    expect(titleEl).toBeDefined();
    expect(titleEl?.textContent).toContain('你可以問我');

    const suggestionButtons =
      uiDom.suggestionsEl.querySelectorAll('button.sugg');
    expect(suggestionButtons.length).toBeGreaterThan(0);

    const firstBtn = suggestionButtons[0] as HTMLButtonElement;
    firstBtn.click();
    expect(mockContext.handleUser).toHaveBeenCalled();
  });

  it('should render default companion suggestions when in companion mode', () => {
    mockContext.avatarMode = AVATAR_MODE_MAP.companion;

    renderSuggestions(
      mockContext as unknown as Parameters<typeof renderSuggestions>[0]
    );

    const titleEl = uiDom.suggestionsEl.querySelector('.sg-label');
    expect(titleEl?.textContent).toContain('可以跟我聊');

    const suggestionButtons =
      uiDom.suggestionsEl.querySelectorAll('button.sugg');
    const buttonTexts = Array.from(suggestionButtons).map(
      (b) => (b as HTMLButtonElement).textContent
    );
    expect(buttonTexts).toContain('今天過得好嗎？');
  });

  it('should support custom suggestedQuestions array and custom suggestedTitle', () => {
    mockContext.suggestedTitle = '🌟 自訂推薦問答：';
    mockContext.suggestedQuestions = ['自訂問題 1', '自訂問題 2'];

    renderSuggestions(
      mockContext as unknown as Parameters<typeof renderSuggestions>[0]
    );

    const titleEl = uiDom.suggestionsEl.querySelector('.sg-label');
    expect(titleEl?.textContent).toBe('🌟 自訂推薦問答：');

    const suggestionButtons =
      uiDom.suggestionsEl.querySelectorAll('button.sugg');
    expect(suggestionButtons.length).toBe(2);
    expect((suggestionButtons[0] as HTMLButtonElement).textContent).toBe(
      '自訂問題 1'
    );
    expect((suggestionButtons[1] as HTMLButtonElement).textContent).toBe(
      '自訂問題 2'
    );
  });

  it('should support object dictionary suggestedTitle and localized suggestedQuestions', () => {
    mockContext.locale = 'en-US';
    mockContext.suggestedTitle = {
      'zh-TW': '推薦問題',
      'en-US': 'Recommended Questions'
    };
    mockContext.suggestedQuestions = {
      'zh-TW': ['中文問題？'],
      'en-US': ['English Question?']
    };

    renderSuggestions(
      mockContext as unknown as Parameters<typeof renderSuggestions>[0]
    );

    const buttons = uiDom.suggestionsEl.querySelectorAll('button.sugg');
    expect(buttons.length).toBe(1);
    expect((buttons[0] as HTMLButtonElement).textContent).toBe(
      'English Question?'
    );

    (buttons[0] as HTMLButtonElement).click();
    expect(mockContext.handleUser).toHaveBeenCalledWith('English Question?');
  });

  it('should handle function suggestedQuestions, invalid element guard, and filter non-string items', () => {
    // 1. Invalid suggestions element guard
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderSuggestions(
      null as unknown as Parameters<typeof renderSuggestions>[0]
    );
    renderSuggestions({
      uiDom: { suggestionsEl: null }
    } as unknown as Parameters<typeof renderSuggestions>[0]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    // 2. suggestedQuestions as function
    mockContext.suggestedQuestions = (ctx) => [`動態問題 (${ctx.locale})`];
    renderSuggestions(
      mockContext as unknown as Parameters<typeof renderSuggestions>[0]
    );

    let buttons = uiDom.suggestionsEl.querySelectorAll('button.sugg');
    expect(buttons.length).toBe(1);
    expect((buttons[0] as HTMLButtonElement).textContent).toBe(
      '動態問題 (zh-TW)'
    );

    // 3. Array with non-string and empty string items
    mockContext.suggestedQuestions = [
      null as unknown as string,
      '',
      '有效問題？',
      123 as unknown as string
    ];
    renderSuggestions(
      mockContext as unknown as Parameters<typeof renderSuggestions>[0]
    );

    buttons = uiDom.suggestionsEl.querySelectorAll('button.sugg');
    expect(buttons.length).toBe(1);
    expect((buttons[0] as HTMLButtonElement).textContent).toBe('有效問題？');

    // 4. Click button with trailing fullwidth question mark (should trim ？)
    const handleUserMock = vi.fn();
    mockContext.handleUser = handleUserMock;
    (buttons[0] as HTMLButtonElement).click();
    expect(handleUserMock).toHaveBeenCalledWith('有效問題');

    // 5. Click button when handleUser is undefined
    delete mockContext.handleUser;
    expect(() => {
      (buttons[0] as HTMLButtonElement).click();
    }).not.toThrow();
  });
});
