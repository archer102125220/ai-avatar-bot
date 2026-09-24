import { describe, it, expect, vi } from 'vitest';
import { normalizeOptions, callOptionEvent } from '@/core/orchestrator/options';
import {
  DEFAULT_AVATAR_MODE,
  GENDER_MAP,
  DEFAULT_GENDER,
  getDefaultNeuralVoice,
  DEFAULT_AUTO_CONTINUE_MODE
} from '@/core/constants';
import type { AvatarBotOptions, CustomEnginesConfig } from '@core';

describe('Orchestrator Options & Configuration', () => {
  describe('callOptionEvent', () => {
    it('should invoke the specified option callback with context and arguments', () => {
      const callback = vi.fn(function (this: { name: string }, a: number, b: number) {
        return `${this.name}:${a + b}`;
      });
      const options = { onCustomEvent: callback };
      const context = { name: 'TestContext' };

      const result = callOptionEvent(options, context, 'onCustomEvent', 10, 20);

      expect(callback).toHaveBeenCalledWith(10, 20);
      expect(result).toBe('TestContext:30');
    });

    it('should safely do nothing and return undefined if options is invalid or callback does not exist', () => {
      expect(callOptionEvent(null, {}, 'onTest')).toBeUndefined();
      expect(callOptionEvent({}, {}, 'onMissing')).toBeUndefined();
      expect(callOptionEvent({ notAFunc: 123 }, {}, 'notAFunc')).toBeUndefined();
    });
  });

  describe('normalizeOptions', () => {
    it('should throw an error if container is not an HTMLElement', () => {
      expect(() => normalizeOptions({} as unknown as AvatarBotOptions)).toThrow('container must be an HTMLElement');
      expect(() => normalizeOptions({ container: null } as unknown as AvatarBotOptions)).toThrow('container must be an HTMLElement');
      expect(() => normalizeOptions({ container: {} } as unknown as AvatarBotOptions)).toThrow('container must be an HTMLElement');
    });

    it('should throw a TypeError if avatarMode is invalid', () => {
      const container = document.createElement('div');
      expect(() =>
        normalizeOptions({
          container,
          avatarMode: 'invalid_mode' as unknown as AvatarBotOptions['avatarMode']
        })
      ).toThrowError(/Invalid avatarMode "invalid_mode"/);
    });

    it('should accept custom avatar modes defined in options.modes', () => {
      const container = document.createElement('div');
      const normalized = normalizeOptions({
        container,
        avatarMode: 'doctor',
        modes: {
          doctor: { greeting: '醫生模式' }
        }
      });

      expect(normalized.targetAvatarMode).toBe('doctor');
      expect(normalized.rootStore.getState().avatarMode).toBe('doctor');
    });

    it('should apply defaults for all standard options', () => {
      const container = document.createElement('div');
      const normalized = normalizeOptions({ container });

      expect(normalized.container).toBe(container);
      expect(normalized.targetAvatarMode).toBe(DEFAULT_AVATAR_MODE);
      expect(normalized.safeGender).toBe(DEFAULT_GENDER);
      expect(normalized.safeNeuralVoice).toBe(getDefaultNeuralVoice(DEFAULT_GENDER));
      expect(normalized.initialMinimal).toBe(false);
      expect(normalized.isModelDropEnabled).toBe(false);
      expect(normalized.isEngineToggleEnabled).toBe(true);

      const state = normalized.rootStore.getState();
      expect(state.gender).toBe(DEFAULT_GENDER);
      expect(state.brainGender).toBeNull();
      expect(state.speechGender).toBeNull();
      expect(state.skinGender).toBeNull();
      expect(state.avatarMode).toBe(DEFAULT_AVATAR_MODE);
      expect(state.enableMemory).toBe(true);
      expect(state.enableAiProvider).toBe(false);
      expect(state.preloadWebLLM).toBe(false);
      expect(state.autoFallbackWebLLM).toBe(true);
      expect(state.enableAutoContinue).toBe(false);
      expect(state.maxAutoContinuations).toBe(3);
      expect(state.autoContinueMode).toBe(DEFAULT_AUTO_CONTINUE_MODE);
      expect(state.locale).toBe('zh-TW');
    });

    it('should sanitize gender and derive default neural voice', () => {
      const container = document.createElement('div');
      const normalizedMale = normalizeOptions({
        container,
        gender: GENDER_MAP.male
      });

      expect(normalizedMale.safeGender).toBe(GENDER_MAP.male);
      expect(normalizedMale.safeNeuralVoice).toBe(getDefaultNeuralVoice(GENDER_MAP.male));

      const normalizedFemale = normalizeOptions({
        container,
        gender: GENDER_MAP.female
      });

      expect(normalizedFemale.safeGender).toBe(GENDER_MAP.female);
      expect(normalizedFemale.safeNeuralVoice).toBe(getDefaultNeuralVoice(GENDER_MAP.female));

      const normalizedCustomVoice = normalizeOptions({
        container,
        gender: GENDER_MAP.male,
        neuralVoice: 'custom-neural-voice'
      });
      expect(normalizedCustomVoice.safeNeuralVoice).toBe('custom-neural-voice');
    });

    it('should compute initialMinimal correctly based on isMinimal and isIframe', () => {
      const container = document.createElement('div');

      const norm1 = normalizeOptions({ container, isMinimal: true });
      expect(norm1.initialMinimal).toBe(true);

      const norm2 = normalizeOptions({ container, isMinimal: true, isIframe: true });
      expect(norm2.initialMinimal).toBe(false); // isIframe overrides isMinimal

      const norm3 = normalizeOptions({ container, isMinimal: false, isIframe: false });
      expect(norm3.initialMinimal).toBe(false);
    });

    it('should initialize custom i18n engine if provided as function or object', () => {
      const container = document.createElement('div');

      const customI18nFactory = vi.fn((opts: { locale: string; messages?: Record<string, unknown> }) => ({
        locale: opts.locale,
        t: (k: string) => `custom:${k}`,
        addMessages: vi.fn(),
        setLocale: vi.fn(),
        subscribe: vi.fn(),
        subscribeMessages: vi.fn()
      }));

      const normWithFactory = normalizeOptions({
        container,
        locale: 'en-US',
        customEngines: { i18n: customI18nFactory as unknown as CustomEnginesConfig['i18n'] }
      });

      expect(customI18nFactory).toHaveBeenCalledWith({
        locale: 'en-US',
        messages: undefined
      });
      expect(normWithFactory.i18nEngine.locale).toBe('en-US');
      expect(normWithFactory.i18nEngine.t('hello')).toBe('custom:hello');

      const customI18nObj = {
        locale: 'ja-JP',
        t: (k: string) => `ja:${k}`,
        addMessages: vi.fn(),
        setLocale: vi.fn(),
        subscribe: vi.fn(),
        subscribeMessages: vi.fn()
      };

      const normWithObj = normalizeOptions({
        container,
        customEngines: { i18n: customI18nObj as unknown as CustomEnginesConfig['i18n'] }
      });

      expect(normWithObj.i18nEngine).toBe(customI18nObj);
    });

    it('should resolve enableAiProvider from aiProviderBaseUrl if enableAiProvider is not explicitly boolean', () => {
      const container = document.createElement('div');

      const normWithoutUrl = normalizeOptions({ container });
      expect(normWithoutUrl.rootStore.getState().enableAiProvider).toBe(false);

      const normWithUrl = normalizeOptions({
        container,
        aiProviderBaseUrl: 'https://api.example.com/ai'
      });
      expect(normWithUrl.rootStore.getState().enableAiProvider).toBe(true);

      const normExplicitFalse = normalizeOptions({
        container,
        enableAiProvider: false,
        aiProviderBaseUrl: 'https://api.example.com/ai'
      });
      expect(normExplicitFalse.rootStore.getState().enableAiProvider).toBe(false);
    });

    it('should configure autoContinue options, autoContinueMode, and custom prompt', () => {
      const container = document.createElement('div');

      const norm = normalizeOptions({
        container,
        enableAutoContinue: true,
        maxAutoContinuations: -1, // invalid -> fallback to default (3)
        autoContinueMode: 'invalid_mode' as unknown as AvatarBotOptions['autoContinueMode'],
        autoContinuePrompt: '請接續回答'
      });

      const state = norm.rootStore.getState();
      expect(state.enableAutoContinue).toBe(true);
      expect(state.maxAutoContinuations).toBe(3);
      expect(state.autoContinueMode).toBe(DEFAULT_AUTO_CONTINUE_MODE);
      expect(state.autoContinuePrompt).toBe('請接續回答');
    });

    it('should retain customEngines inside rawOptions and initialize custom i18n', () => {
      const container = document.createElement('div');

      const mockBrain = { query: vi.fn() };
      const mockSpeech = { speak: vi.fn() };
      const mockSkin = { render: vi.fn() };
      const mockTools = { execute: vi.fn() };

      const customEngines = {
        brain: vi.fn(() => mockBrain),
        speech: vi.fn(() => mockSpeech),
        skin: vi.fn(() => mockSkin),
        tools: vi.fn(() => mockTools)
      };

      const norm = normalizeOptions({
        container,
        customEngines: customEngines as unknown as CustomEnginesConfig
      });

      expect(norm.rawOptions.customEngines).toBe(customEngines);
    });

    it('should test preloadWebLLM, autoFallbackWebLLM, autoContinuePrompt function, and specific component gender overrides', () => {
      const container = document.createElement('div');
      const promptFn = (accum: string) => `繼續：${accum}`;

      const norm = normalizeOptions({
        container,
        preloadWebLLM: true,
        autoFallbackWebLLM: false,
        autoContinuePrompt: promptFn,
        locale: 'en-US',
        enableModelDrop: true,
        enableEngineToggle: false,
        skinGender: 'male',
        brainGender: 'female',
        speechGender: 'male'
      } as AvatarBotOptions);

      const state = norm.rootStore.getState();
      expect(state.preloadWebLLM).toBe(true);
      expect(state.autoFallbackWebLLM).toBe(false);
      expect(state.autoContinuePrompt).toBe(promptFn);
      expect(state.locale).toBe('en-US');
      expect(state.enableModelDrop).toBe(true);
      expect(state.enableEngineToggle).toBe(false);
      expect(state.skinGender).toBe('male');
      expect(state.brainGender).toBe('female');
      expect(state.speechGender).toBe('male');
    });
  });
});
