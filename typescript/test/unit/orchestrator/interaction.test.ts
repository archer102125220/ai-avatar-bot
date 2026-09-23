import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTapAvatarHandler,
  createModelDropHandler
} from '@/core/orchestrator/interaction';
import { createBaseStore } from '@/core/store';
import { initI18nEngine } from '@/core/i18n';
import { AVATAR_MODE_MAP } from '@/core/constants';
import type { I18nEngine } from '@core';

describe('Orchestrator Interactions (Deep Branch Coverage)', () => {
  let rootStore: any;
  let i18nEngine: I18nEngine;
  let mockWidget: any;
  let mockEngines: any;

  beforeEach(() => {
    rootStore = createBaseStore({
      gender: 'female',
      avatarMode: AVATAR_MODE_MAP.assistant,
      locale: 'zh-TW',
      enableMemory: true
    });

    i18nEngine = initI18nEngine({ locale: 'zh-TW' });

    mockWidget = { name: 'MockWidget' };

    mockEngines = {
      brainEngine: {
        memory: {
          enabled: true,
          data: { visits: 3, name: 'Alice' }
        }
      },
      speechEngine: {
        onTapTimer: false,
        spokenAudioText: ''
      },
      skinEngine: {
        avatarModel: {
          motion: vi.fn()
        },
        loadVRMFile: vi.fn()
      }
    };
  });

  const getEngines = () => mockEngines;
  const getWidget = () => mockWidget;

  describe('createTapAvatarHandler greetings across modes and locales', () => {
    it('should resolve custom mode greeting if configured', () => {
      rootStore.setState({ avatarMode: 'customMode' });
      const options = {
        modes: {
          customMode: { greeting: '自訂模式問候語' }
        }
      };

      const onTap = createTapAvatarHandler({
        getWidget,
        options,
        rootStore,
        i18nEngine,
        getEngines
      });

      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toBe('自訂模式問候語');
    });

    it('should resolve top-level options.greeting if provided', () => {
      const options = {
        greeting: '頂層通用問候語'
      };

      const onTap = createTapAvatarHandler({
        getWidget,
        options,
        rootStore,
        i18nEngine,
        getEngines
      });

      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toBe('頂層通用問候語');
    });

    it('should resolve companion greeting with and without user name in en, ja, ko, zh', () => {
      rootStore.setState({ avatarMode: AVATAR_MODE_MAP.companion });

      // en-US with name
      i18nEngine.setLocale('en-US');
      const onTap = createTapAvatarHandler({
        getWidget,
        options: {},
        rootStore,
        i18nEngine,
        getEngines
      });
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('Alice~');

      // en-US without name
      mockEngines.brainEngine.memory.data.name = '';
      mockEngines.speechEngine.onTapTimer = false;
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('Hello~');

      // ja-JP
      i18nEngine.setLocale('ja-JP');
      mockEngines.brainEngine.memory.data.name = 'タロウ';
      mockEngines.speechEngine.onTapTimer = false;
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('タロウさん〜');

      mockEngines.brainEngine.memory.data.name = '';
      mockEngines.speechEngine.onTapTimer = false;
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('こんにちは〜');

      // ko-KR
      i18nEngine.setLocale('ko-KR');
      mockEngines.brainEngine.memory.data.name = '민수';
      mockEngines.speechEngine.onTapTimer = false;
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('민수님~');

      mockEngines.brainEngine.memory.data.name = '';
      mockEngines.speechEngine.onTapTimer = false;
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('안녕하세요~');

      // zh-TW
      i18nEngine.setLocale('zh-TW');
      mockEngines.brainEngine.memory.data.name = '小明';
      mockEngines.speechEngine.onTapTimer = false;
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('小明～');

      mockEngines.brainEngine.memory.data.name = '';
      mockEngines.speechEngine.onTapTimer = false;
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('你好～');
    });

    it('should resolve assistant greeting in en, ja, ko, zh', () => {
      rootStore.setState({ avatarMode: AVATAR_MODE_MAP.assistant });

      // en-US
      i18nEngine.setLocale('en-US');
      const onTap = createTapAvatarHandler({
        getWidget,
        options: {},
        rootStore,
        i18nEngine,
        getEngines
      });
      onTap();

      expect(mockEngines.speechEngine.spokenAudioText).toContain('Hello~ I am the');

      // ja-JP
      i18nEngine.setLocale('ja-JP');
      mockEngines.speechEngine.onTapTimer = false;
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('こんにちは〜！');

      // ko-KR
      i18nEngine.setLocale('ko-KR');
      mockEngines.speechEngine.onTapTimer = false;
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('안녕하세요~');

      // zh-TW
      i18nEngine.setLocale('zh-TW');
      mockEngines.speechEngine.onTapTimer = false;
      onTap();
      expect(mockEngines.speechEngine.spokenAudioText).toContain('你好～我是');
    });
  });

  describe('createModelDropHandler edge cases', () => {
    it('should safely return if container is invalid', () => {
      const updateListeners = createModelDropHandler({
        // @ts-ignore: Defensive runtime type checking test
        container: null,
        getSkinEngine: () => mockEngines.skinEngine
      });

      expect(() => updateListeners(true)).not.toThrow();
    });

    it('should ignore drop event if dropped item is not a File instance', () => {
      const container = document.createElement('div');
      const updateListeners = createModelDropHandler({
        container,
        getSkinEngine: () => mockEngines.skinEngine
      });

      updateListeners(true);

      // Test dragenter and dragover preventDefault
      const dragenterEvent = new Event('dragenter', { cancelable: true });
      const dragoverEvent = new Event('dragover', { cancelable: true });
      container.dispatchEvent(dragenterEvent);
      container.dispatchEvent(dragoverEvent);
      expect(dragenterEvent.defaultPrevented).toBe(true);
      expect(dragoverEvent.defaultPrevented).toBe(true);

      const dropEvent = new Event('drop');
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [{ notAFile: true }] }
      });

      container.dispatchEvent(dropEvent);
      expect(mockEngines.skinEngine.loadVRMFile).not.toHaveBeenCalled();

      // Remove listeners
      updateListeners(false);
    });

    it('should handle onTapTimer guard, avatarModel motion error, and timer reset', () => {
      vi.useFakeTimers();

      // Catch error when avatarModel.motion throws
      mockEngines.skinEngine.avatarModel.motion = vi.fn().mockImplementation(() => {
        throw new Error('Motion error');
      });

      const onTap = createTapAvatarHandler({
        widget: mockWidget,
        options: { onTapAvatar: vi.fn() } as any,
        rootStore,
        i18nEngine,
        getEngines
      });

      onTap();
      expect(mockEngines.speechEngine.onTapTimer).toBe(true);

      // Subsequent tap within timer should return early
      mockEngines.speechEngine.spokenAudioText = 'changed';
      onTap();
      // Should not re-run greeting logic while onTapTimer is true
      expect(mockEngines.speechEngine.spokenAudioText).toBe('changed');

      // Advance timer by 400ms
      vi.advanceTimersByTime(400);
      expect(mockEngines.speechEngine.onTapTimer).toBe(false);

      vi.useRealTimers();
    });
  });
});
