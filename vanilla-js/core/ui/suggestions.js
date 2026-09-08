import { resolveLocalized } from '../i18n';

/**
 * 渲染建議對話選項。
 * 會根據使用者設定或助理模式（companion/assistant）顯示預設的建議選項。
 * @param {import('./index').UiContext|null} context - 應用程式的共用狀態與參考。
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

  const locale = context?.locale || context?.i18nEngine?.locale || 'zh-TW';
  const templateContext = { locale, avatarMode: context?.avatarMode };

  let defaultSuggestions = [
    '這是什麼？',
    '怎麼安裝到專案？',
    '支援 3D 與換角色嗎？',
    'AI 大腦是如何運作的？',
    '怎麼使用工具調用？',
    '需要架後端嗎？'
  ];

  if (/en/i.test(locale)) {
    defaultSuggestions = [
      'What is this?',
      'How to install to project?',
      'Supports 3D & custom models?',
      'How does the AI Brain work?',
      'How to use Function Calling?',
      'Does it require a backend?'
    ];
  } else if (/ja/i.test(locale)) {
    defaultSuggestions = [
      'これは何ですか？',
      'プロジェクトへの導入方法は？',
      '3D対応やアバター変更は？',
      'AIブレインの仕組みは？',
      'ツール呼び出しの使い方は？',
      'バックエンドは必要？'
    ];
  } else if (/ko/i.test(locale)) {
    defaultSuggestions = [
      '이것은 무엇인가요?',
      '프로젝트에 어떻게 설치하나요?',
      '3D 지원 및 캐릭터 변경은?',
      'AI 브레인은 어떻게 작동하나요?',
      '도구 호출은 어떻게 쓰나요?',
      '백엔드가 필요한가요?'
    ];
  }

  let defaultCompanionSuggestions = [
    '今天過得好嗎？',
    '跟我聊聊天',
    '說個笑話',
    '你會記得我嗎？',
    '誇誇我'
  ];
  if (/en/i.test(locale)) {
    defaultCompanionSuggestions = [
      'How is your day?',
      'Chat with me',
      'Tell a joke',
      'Will you remember me?',
      'Praise me'
    ];
  } else if (/ja/i.test(locale)) {
    defaultCompanionSuggestions = [
      '今日の調子はどう？',
      'お話ししよう',
      '面白い話をして',
      '私のこと覚えてる？',
      '褒めて'
    ];
  } else if (/ko/i.test(locale)) {
    defaultCompanionSuggestions = [
      '오늘 기분 어때?',
      '나랑 이야기하자',
      '재미있는 이야기 해줘',
      '나 기억해?',
      '칭찬해줘'
    ];
  }

  let resolvedSuggestions;
  if (
    Array.isArray(context?.suggestedQuestions) &&
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
      defaultSuggestions,
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
      defaultSuggestions,
      templateContext
    );
  }

  let defaultTitle = '💬 你可以問我：';
  if (/en/i.test(locale)) {
    defaultTitle = '💬 You can ask me:';
  } else if (/ja/i.test(locale)) {
    defaultTitle = '💬 よくある質問：';
  } else if (/ko/i.test(locale)) {
    defaultTitle = '💬 이런 질문을 해보세요:';
  }

  let defaultCompanionTitle = '💬 可以跟我聊：';
  if (/en/i.test(locale)) {
    defaultCompanionTitle = '💬 Chat with me about:';
  } else if (/ja/i.test(locale)) {
    defaultCompanionTitle = '💬 こんな話題で話せます：';
  } else if (/ko/i.test(locale)) {
    defaultCompanionTitle = '💬 저와 이런 이야기를 해보세요:';
  }

  let titleText;
  if (
    typeof context?.suggestedTitle !== 'undefined' &&
    context?.suggestedTitle !== null
  ) {
    titleText = resolveLocalized(
      context.suggestedTitle,
      locale,
      defaultTitle,
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
      defaultTitle,
      templateContext
    );
  }

  const titleLabelEl = document.createElement('p');
  titleLabelEl.classList.add('sg-label');
  titleLabelEl.textContent = titleText;

  suggestionsEl.appendChild(titleLabelEl);
  if (Array.isArray(resolvedSuggestions) && resolvedSuggestions.length > 0) {
    resolvedSuggestions.forEach((suggestion) => {
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
