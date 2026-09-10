import { resolveLocalized } from '../i18n';

/**
 * 渲染建議對話選項。
 * 會根據使用者設定或助理模式（companion/assistant）顯示預設的建議選項。
 *
 * @param {import('./index').UiContext|null} [context=null] - 應用程式的共用狀態與參考。
 */
export function renderSuggestions(context = null) {
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
      ? i18n.t('suggestions.items.assistant')
      : fallbackAssistantSuggestions;

  const defaultCompanionSuggestions =
    typeof i18n?.t === 'function'
      ? i18n.t('suggestions.items.companion')
      : fallbackCompanionSuggestions;

  const defaultAssistantTitle =
    typeof i18n?.t === 'function'
      ? i18n.t('suggestions.title.assistant')
      : '💬 你可以問我：';

  const defaultCompanionTitle =
    typeof i18n?.t === 'function'
      ? i18n.t('suggestions.title.companion')
      : '💬 可以跟我聊：';

  let resolvedSuggestions;
  if (
    Array.isArray(context?.suggestedQuestions) === true &&
    context.suggestedQuestions.length > 0
  ) {
    resolvedSuggestions = context.suggestedQuestions;
  } else if (
    typeof context?.suggestedQuestions === 'object' &&
    context.suggestedQuestions !== null
  ) {
    resolvedSuggestions = resolveLocalized(
      context.suggestedQuestions,
      locale,
      defaultAssistantSuggestions,
      templateContext
    );
  } else if (typeof context?.suggestedQuestions === 'function') {
    resolvedSuggestions = resolveLocalized(
      context.suggestedQuestions,
      locale,
      defaultAssistantSuggestions,
      templateContext
    );
  } else if (context?.avatarMode === context?.AVATAR_MODE_MAP?.companion) {
    resolvedSuggestions = resolveLocalized(
      context?.companionSuggestedQuestions,
      locale,
      defaultCompanionSuggestions,
      templateContext
    );
  } else {
    resolvedSuggestions = resolveLocalized(
      context?.assistantSuggestedQuestions,
      locale,
      defaultAssistantSuggestions,
      templateContext
    );
  }

  let titleText;
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
    resolvedSuggestions.forEach((suggestion) => {
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
