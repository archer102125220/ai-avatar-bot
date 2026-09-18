import { AVATAR_MODE_MAP } from '@/core/constants';
import { resolveLocalized } from '@/core/i18n';
import { callOptionEvent } from './options';
import type { AiAvatarWidget, AvatarBotOptions, BaseStore, I18nEngine } from '@types';

export interface TapAvatarParams {
  widget?: AiAvatarWidget;
  getWidget?: () => AiAvatarWidget;
  options: AvatarBotOptions;
  rootStore: BaseStore;
  i18nEngine: I18nEngine;
  getEngines: () => {
    brainEngine: any;
    speechEngine: any;
    skinEngine: any;
    toolsEngine?: any;
  };
}

/**
 * Creates the avatar tap interaction event handler (`onTapAvatar`).
 */
export function createTapAvatarHandler({
  widget,
  getWidget,
  options,
  rootStore,
  i18nEngine,
  getEngines
}: TapAvatarParams): () => void {
  const resolveWidget =
    typeof getWidget === 'function' ? getWidget : () => widget as AiAvatarWidget;

  return function onTapAvatar(): void {
    const { brainEngine, speechEngine, skinEngine } = getEngines();

    callOptionEvent(options, resolveWidget(), 'onTapAvatar');
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
      greeting =
        resolveLocalized(
          currentModeConfig.greeting,
          currentLocale,
          '你好～',
          templateContext
        ) || '你好～';
    } else if (
      typeof options.greeting !== 'undefined' &&
      options.greeting !== null
    ) {
      greeting =
        resolveLocalized(
          options.greeting,
          currentLocale,
          '你好～',
          templateContext
        ) || '你好～';
    } else if (currentAvatarMode === AVATAR_MODE_MAP.companion) {
      let defaultCompanionGreeting: string;
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

      greeting =
        resolveLocalized(
          options.companionGreeting,
          currentLocale,
          defaultCompanionGreeting,
          templateContext
        ) || defaultCompanionGreeting;
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
          '안녕하세요~ ai-avatar-bot-vanilla-js 아바타입니다. 설치 방법, 3D 전환, 도구機能 등을 편하게 물어보세요!';
      }

      greeting =
        resolveLocalized(
          options.assistantGreeting,
          currentLocale,
          defaultAssistantGreeting,
          templateContext
        ) || defaultAssistantGreeting;
    }

    if (speechEngine !== null && typeof speechEngine === 'object') {
      speechEngine.spokenAudioText = greeting;
    }
  };
}

export interface ModelDropParams {
  container: HTMLElement;
  getSkinEngine: () => any;
}

/**
 * Creates drag-and-drop event handlers for dynamically loading 3D VRM models onto the avatar canvas.
 */
export function createModelDropHandler({ container, getSkinEngine }: ModelDropParams): (enabled: boolean) => void {
  function handleDragPrevent(event: DragEvent): void {
    event.preventDefault();
  }

  function handleModelDrop(event: DragEvent): void {
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

  return function updateModelDropListeners(enabled: boolean): void {
    if (container instanceof HTMLElement === false) {
      return;
    }
    if (enabled === true) {
      container.addEventListener('dragenter', handleDragPrevent as EventListener);
      container.addEventListener('dragover', handleDragPrevent as EventListener);
      container.addEventListener('drop', handleModelDrop as EventListener);
    } else {
      container.removeEventListener('dragenter', handleDragPrevent as EventListener);
      container.removeEventListener('dragover', handleDragPrevent as EventListener);
      container.removeEventListener('drop', handleModelDrop as EventListener);
    }
  };
}
