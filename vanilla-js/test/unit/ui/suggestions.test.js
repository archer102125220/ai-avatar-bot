import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderSuggestions } from '@/core/ui/suggestions';
import { initUi } from '@/core/ui/dom';
import { initI18nEngine } from '@/core/i18n';
import { AVATAR_MODE_MAP } from '@/core/constants';


describe('UI Suggestions (renderSuggestions)', () => {
  let container;
  let stageEl;
  let i18nEngine;
  let uiDom;
  let mockContext;

  beforeEach(() => {
    container = document.createElement('div');
    stageEl = document.createElement('div');
    i18nEngine = initI18nEngine({ locale: 'zh-TW' });
    uiDom = initUi(container, stageEl, i18nEngine);

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
    renderSuggestions(mockContext);

    const titleEl = uiDom.suggestionsEl.querySelector('.sg-label');
    expect(titleEl).toBeDefined();
    expect(titleEl.textContent).toContain('你可以問我');

    const suggestionButtons = uiDom.suggestionsEl.querySelectorAll('button.sugg');
    expect(suggestionButtons.length).toBeGreaterThan(0);

    const firstBtn = suggestionButtons[0];
    firstBtn.click();
    expect(mockContext.handleUser).toHaveBeenCalled();
  });

  it('should render default companion suggestions when in companion mode', () => {
    mockContext.avatarMode = AVATAR_MODE_MAP.companion;

    renderSuggestions(mockContext);

    const titleEl = uiDom.suggestionsEl.querySelector('.sg-label');
    expect(titleEl.textContent).toContain('可以跟我聊');

    const suggestionButtons = uiDom.suggestionsEl.querySelectorAll('button.sugg');
    const buttonTexts = Array.from(suggestionButtons).map((b) => b.textContent);
    expect(buttonTexts).toContain('今天過得好嗎？');
  });

  it('should support custom suggestedQuestions array and custom suggestedTitle', () => {
    mockContext.suggestedTitle = '🌟 自訂推薦問答：';
    mockContext.suggestedQuestions = ['自訂問題一？', '自訂問題二？'];

    renderSuggestions(mockContext);

    const titleEl = uiDom.suggestionsEl.querySelector('.sg-label');
    expect(titleEl.textContent).toBe('🌟 自訂推薦問答：');

    const buttons = uiDom.suggestionsEl.querySelectorAll('button.sugg');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toBe('自訂問題一？');

    buttons[0].click();
    expect(mockContext.handleUser).toHaveBeenCalledWith('自訂問題一');
  });

  it('should resolve localized questions from object dictionary', () => {
    mockContext.locale = 'en-US';
    mockContext.suggestedQuestions = {
      'zh-TW': ['中文問題'],
      'en-US': ['English Question?']
    };

    renderSuggestions(mockContext);

    const buttons = uiDom.suggestionsEl.querySelectorAll('button.sugg');
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toBe('English Question?');

    buttons[0].click();
    expect(mockContext.handleUser).toHaveBeenCalledWith('English Question?');
  });
});
