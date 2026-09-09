import { AVATAR_MODE_MAP } from '../constants';
import { resolveLocalized } from '../i18n';
import { callOptionEvent } from './options';

/**
 * 建立點擊 Avatar 虛擬人的互動事件處理函式 (onTapAvatar)。
 *
 * @param {Object} params
 * @param {import('./types').AiAvatarWidget} params.widget - Widget 實例
 * @param {import('./types').AvatarBotOptions} params.options - 原始設定選項
 * @param {import('../store').BaseStore} params.rootStore - 狀態 Store
 * @param {any} params.i18nEngine - 多語系引擎實例
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - 取得各引擎實例的函式
 * @returns {() => void} onTapAvatar 函式
 */
export function createTapAvatarHandler({
  widget,
  options,
  rootStore,
  i18nEngine,
  getEngines
}) {
  return function onTapAvatar() {
    const { brainEngine, speechEngine, skinEngine } = getEngines();

    callOptionEvent(options, widget, 'onTapAvatar');
    if (speechEngine?.onTapTimer === true) {
      return;
    }
    if (speechEngine !== null && typeof speechEngine === 'object') {
      speechEngine.onTapTimer = true;
      setTimeout(() => {
        speechEngine.onTapTimer = false;
      }, 400);
    }

    if (
      typeof skinEngine?.avatarModel === 'object' &&
      skinEngine.avatarModel !== null
    ) {
      try {
        skinEngine.avatarModel.motion('Tap');
      } catch (_error) {}
    }

    let greeting = '你好～';
    const currentLocale =
      typeof i18nEngine?.locale === 'string' && i18nEngine.locale !== ''
        ? i18nEngine.locale
        : typeof rootStore.getState().locale === 'string' &&
            rootStore.getState().locale !== ''
          ? rootStore.getState().locale
          : 'zh-TW';
    const currentAvatarMode = rootStore.getState().avatarMode;
    const templateContext = {
      isMemoryEnabled: brainEngine?.memory?.enabled,
      isCompanion: currentAvatarMode === AVATAR_MODE_MAP.companion,
      visits: brainEngine?.memory?.data?.visits,
      name: brainEngine?.memory?.data?.name,
      locale: currentLocale
    };

    const currentModeConfig = options.modes?.[currentAvatarMode];
    if (
      typeof currentModeConfig?.greeting !== 'undefined' &&
      currentModeConfig?.greeting !== null
    ) {
      greeting = resolveLocalized(
        currentModeConfig.greeting,
        currentLocale,
        '你好～',
        templateContext
      );
    } else if (
      typeof options.greeting !== 'undefined' &&
      options.greeting !== null
    ) {
      greeting = resolveLocalized(
        options.greeting,
        currentLocale,
        '你好～',
        templateContext
      );
    } else if (currentAvatarMode === AVATAR_MODE_MAP.companion) {
      let defaultCompanionGreeting;
      const userName =
        typeof brainEngine?.memory?.data?.name === 'string' &&
        brainEngine.memory.data.name !== ''
          ? brainEngine.memory.data.name
          : '';
      if (/en/i.test(currentLocale) === true) {
        defaultCompanionGreeting =
          (userName !== '' ? userName + '~ ' : 'Hello~ ') +
          'We can chat about anything! Click 💬 to start.';
      } else if (/ja/i.test(currentLocale) === true) {
        defaultCompanionGreeting =
          (userName !== '' ? userName + 'さん〜 ' : 'こんにちは〜 ') +
          '何でもお話ししましょう！💬 を押してスタートです。';
      } else if (/ko/i.test(currentLocale) === true) {
        defaultCompanionGreeting =
          (userName !== '' ? userName + '님~ ' : '안녕하세요~ ') +
          '무엇이든 이야기해요! 💬를 누르면開始해요.';
      } else {
        defaultCompanionGreeting =
          (userName !== '' ? userName + '～' : '你好～') +
          '想聊什麼都可以，點 💬 我們就開始！';
      }

      greeting = resolveLocalized(
        options.companionGreeting,
        currentLocale,
        defaultCompanionGreeting,
        templateContext
      );
    } else if (currentAvatarMode === AVATAR_MODE_MAP.assistant) {
      let defaultAssistantGreeting =
        '你好～我是 ai-avatar-bot-vanilla-js 虛擬人，問我怎麼安裝、切換 3D 或工具調用都行！';
      if (/en/i.test(currentLocale) === true) {
        defaultAssistantGreeting =
          'Hello~ I am the ai-avatar-bot-vanilla-js avatar. Ask me how to install, switch 3D, or use tools!';
      } else if (/ja/i.test(currentLocale) === true) {
        defaultAssistantGreeting =
          'こんにちは〜！ai-avatar-bot-vanilla-js アバターです。導入方法や3D切り替え、ツール機能について何でも聞いてください！';
      } else if (/ko/i.test(currentLocale) === true) {
        defaultAssistantGreeting =
          '안녕하세요~ ai-avatar-bot-vanilla-js 아바타입니다. 설치 방법, 3D 전환, 도구 기능 등을 편하게 물어보세요!';
      }

      greeting = resolveLocalized(
        options.assistantGreeting,
        currentLocale,
        defaultAssistantGreeting,
        templateContext
      );
    }

    if (speechEngine !== null && typeof speechEngine === 'object') {
      speechEngine.spokenAudioText = greeting;
    }
  };
}

/**
 * 建立 VRM 3D 模型檔案拖曳至畫布即時換裝之監聽處理器。
 *
 * @param {Object} params
 * @param {HTMLElement} params.container - Widget 根容器 DOM
 * @param {() => any} params.getSkinEngine - 取得 Skin 引擎實例的函式
 * @returns {{(enabled: boolean): void}} 更新模型拖曳換裝監聽器的函式
 */
export function createModelDropHandler({ container, getSkinEngine }) {
  function handleDragPrevent(event) {
    event.preventDefault();
  }

  function handleModelDrop(event) {
    event.preventDefault();
    const droppedFile = event?.dataTransfer?.files?.[0];
    const skinEngine = getSkinEngine();
    if (
      typeof window !== 'undefined' &&
      droppedFile instanceof window.File &&
      typeof skinEngine?.loadVRMFile === 'function'
    ) {
      skinEngine.loadVRMFile(droppedFile);
    }
  }

  return function updateModelDropListeners(enabled) {
    if (container instanceof HTMLElement === false) {
      return;
    }
    if (enabled === true) {
      container.addEventListener('dragenter', handleDragPrevent);
      container.addEventListener('dragover', handleDragPrevent);
      container.addEventListener('drop', handleModelDrop);
    } else {
      container.removeEventListener('dragenter', handleDragPrevent);
      container.removeEventListener('dragover', handleDragPrevent);
      container.removeEventListener('drop', handleModelDrop);
    }
  };
}
