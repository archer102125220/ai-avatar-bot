import { resolveLocalized } from '@/core/i18n';
import type { UiContext } from './types';

/**
 * Renders suggested dialogue prompts and titles based on the current persona mode ('companion' | 'assistant') and i18n configuration.
 */
export function renderSuggestions(context: UiContext | null = null): void {
  const suggestionsEl = context?.uiDom?.suggestionsEl;
  if (suggestionsEl instanceof HTMLElement === false) {
    console.warn(
      '[aiAvatar renderSuggestions] context.suggestionsEl is not an HTMLElement'
    );
    return;
  }

  suggestionsEl.replaceChildren();

  const i18n = context?.i18nEngine;
  const locale =
    typeof context?.locale === 'string' && context.locale !== ''
      ? context.locale
      : typeof i18n?.locale === 'string' && i18n.locale !== ''
        ? i18n.locale
        : 'zh-TW';

  const templateContext = { locale, avatarMode: context?.avatarMode };

  const fallbackAssistantSuggestions = [
    '這是什麼？',
    '怎麼安裝到專案？',
    '支援 3D 與換角色嗎？',
    'AI 大腦是如何運作的？',
    '怎麼使用工具調用？',
    '需要架後端嗎？'
  ];

  const fallbackCompanionSuggestions = [
    '今天過得好嗎？',
    '跟我聊聊天',
    '說個笑話',
    '你會記得我嗎？',
    '誇誇我'
  ];

  const defaultAssistantSuggestions =
    typeof i18n?.t === 'function'
      ? i18n.t<string[]>('suggestions.items.assistant')
      : fallbackAssistantSuggestions;

  const defaultCompanionSuggestions =
    typeof i18n?.t === 'function'
      ? i18n.t<string[]>('suggestions.items.companion')
      : fallbackCompanionSuggestions;

  const defaultAssistantTitle =
    typeof i18n?.t === 'function'
      ? i18n.t('suggestions.title.assistant')
      : '💬 你可以問我：';

  const defaultCompanionTitle =
    typeof i18n?.t === 'function'
      ? i18n.t('suggestions.title.companion')
      : '💬 可以跟我聊：';

  let resolvedSuggestions: unknown[] | string[] = [];
  if (
    Array.isArray(context?.suggestedQuestions) === true &&
    context.suggestedQuestions.length > 0
  ) {
    resolvedSuggestions = context.suggestedQuestions;
  } else if (
    typeof context?.suggestedQuestions === 'object' &&
    context.suggestedQuestions !== null
  ) {
    resolvedSuggestions = resolveLocalized<string[]>(
      context.suggestedQuestions,
      locale,
      defaultAssistantSuggestions,
      templateContext
    );
  } else if (typeof context?.suggestedQuestions === 'function') {
    resolvedSuggestions = resolveLocalized<string[]>(
      context.suggestedQuestions,
      locale,
      defaultAssistantSuggestions,
      templateContext
    );
  } else if (context?.avatarMode === context?.AVATAR_MODE_MAP?.companion) {
    resolvedSuggestions = resolveLocalized<string[]>(
      context?.companionSuggestedQuestions,
      locale,
      defaultCompanionSuggestions,
      templateContext
    );
  } else {
    resolvedSuggestions = resolveLocalized<string[]>(
      context?.assistantSuggestedQuestions,
      locale,
      defaultAssistantSuggestions,
      templateContext
    );
  }

  let titleText: string = '';
  if (
    typeof context?.suggestedTitle !== 'undefined' &&
    context?.suggestedTitle !== null
  ) {
    titleText = resolveLocalized(
      context.suggestedTitle,
      locale,
      defaultAssistantTitle,
      templateContext
    );
  } else if (context?.avatarMode === context?.AVATAR_MODE_MAP?.companion) {
    titleText = resolveLocalized(
      context?.companionSuggestedTitle,
      locale,
      defaultCompanionTitle,
      templateContext
    );
  } else {
    titleText = resolveLocalized(
      context?.assistantSuggestedTitle,
      locale,
      defaultAssistantTitle,
      templateContext
    );
  }

  const titleLabelEl = document.createElement('p');
  titleLabelEl.classList.add('sg-label');
  titleLabelEl.textContent =
    typeof titleText === 'string' && titleText !== ''
      ? titleText
      : defaultAssistantTitle;

  suggestionsEl.appendChild(titleLabelEl);
  if (
    Array.isArray(resolvedSuggestions) === true &&
    resolvedSuggestions.length > 0
  ) {
    resolvedSuggestions.forEach((suggestion: unknown) => {
      if (typeof suggestion !== 'string' || suggestion === '') {
        return;
      }
      const suggestionButtonEl = document.createElement('button');
      suggestionButtonEl.type = 'button';
      suggestionButtonEl.classList.add('sugg');
      suggestionButtonEl.textContent = suggestion;
      suggestionButtonEl.onclick = () => {
        if (typeof context?.handleUser === 'function') {
          context.handleUser(suggestion.replace(/？$/, ''));
        }
      };
      suggestionsEl.appendChild(suggestionButtonEl);
    });
  }
}
