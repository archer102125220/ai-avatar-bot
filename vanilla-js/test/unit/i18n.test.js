import { describe, it, expect, vi } from 'vitest';
import {
  initI18nEngine,
  resolveLocalized,
  formatParams,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_LABELS
} from '@/core/i18n';


describe('Unit Test: core/i18n/index.js', () => {
  describe('formatParams', () => {
    it('should replace single curly brace placeholder {name}', () => {
      const result = formatParams('Hello, {name}!', { name: 'Alice' });
      expect(result).toBe('Hello, Alice!');
    });

    it('should replace double curly brace placeholder {{name}}', () => {
      const result = formatParams('歡迎，{{user}}！您的餘額是 {{amount}} 元', {
        user: '小明',
        amount: 100
      });
      expect(result).toBe('歡迎，小明！您的餘額是 100 元');
    });

    it('should keep placeholder if param is not provided', () => {
      const result = formatParams('Hello, {name}! Today is {day}.', {
        name: 'Bob'
      });
      expect(result).toBe('Hello, Bob! Today is {day}.');
    });

    it('should return non-string inputs unchanged', () => {
      expect(formatParams(123)).toBe(123);
      expect(formatParams(null)).toBeNull();
      expect(formatParams(undefined)).toBeUndefined();
    });
  });

  describe('resolveLocalized', () => {
    it('should execute function value with templateContext', () => {
      const valueFn = vi.fn((ctx) => `你好，${ctx.username}`);
      const result = resolveLocalized(valueFn, 'zh-TW', undefined, {
        username: '王小美'
      });

      expect(result).toBe('你好，王小美');
      expect(valueFn).toHaveBeenCalledWith({ username: '王小美' });
    });

    it('should resolve localized object by current locale', () => {
      const localizedObj = {
        'zh-TW': '早安',
        'en-US': 'Good morning',
        'ja-JP': 'おはよう'
      };

      expect(resolveLocalized(localizedObj, 'en-US')).toBe('Good morning');
      expect(resolveLocalized(localizedObj, 'ja-JP')).toBe('おはよう');
    });

    it('should fallback to DEFAULT_LOCALE if current locale is missing', () => {
      const localizedObj = {
        'zh-TW': '預設早安',
        'ja-JP': 'おはよう'
      };

      expect(resolveLocalized(localizedObj, 'fr-FR')).toBe('預設早安');
    });

    it('should fallback to first available key if DEFAULT_LOCALE is also missing', () => {
      const localizedObj = {
        'de-DE': 'Guten Morgen'
      };

      expect(resolveLocalized(localizedObj, 'fr-FR')).toBe('Guten Morgen');
    });

    it('should return fallbackValue if value is undefined', () => {
      expect(resolveLocalized(undefined, 'zh-TW', '預設回退')).toBe(
        '預設回退'
      );
      expect(
        resolveLocalized(undefined, 'zh-TW', (ctx) => `回退 ${ctx.id}`, {
          id: 42
        })
      ).toBe('回退 42');
    });
  });

  describe('initI18nEngine', () => {
    it('should initialize with default locale (zh-TW)', () => {
      const i18n = initI18nEngine();
      expect(i18n.locale).toBe(DEFAULT_LOCALE);
      expect(i18n.labels).toEqual(LOCALE_LABELS[DEFAULT_LOCALE]);
      expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
    });

    it('should initialize with specified custom locale', () => {
      const i18n = initI18nEngine({ locale: 'en-US' });
      expect(i18n.locale).toBe('en-US');
      expect(i18n.labels).toEqual(LOCALE_LABELS['en-US']);
    });

    it('should translate nested key path and interpolate params', () => {
      const i18n = initI18nEngine({
        locale: 'en-US',
        messages: {
          'en-US': {
            greeting: {
              welcome: 'Welcome, {name}!'
            }
          }
        }
      });

      expect(i18n.t('greeting.welcome', { name: 'Parker' })).toBe(
        'Welcome, Parker!'
      );
      expect(i18n.translate('greeting.welcome', { name: 'Parker' })).toBe(
        'Welcome, Parker!'
      );
    });

    it('should fallback to DEFAULT_LOCALE if key is missing in active locale', () => {
      const i18n = initI18nEngine({
        locale: 'en-US',
        messages: {
          'zh-TW': {
            system: {
              status: '系統正常'
            }
          },
          'en-US': {}
        }
      });

      expect(i18n.t('system.status')).toBe('系統正常');
    });

    it('should fallback to key itself if key is missing across all dictionaries', () => {
      const i18n = initI18nEngine();
      expect(i18n.t('non.existent.key')).toBe('non.existent.key');
    });

    it('should support array messages translation', () => {
      const i18n = initI18nEngine({
        locale: 'zh-TW',
        messages: {
          'zh-TW': {
            suggestions: ['早安 {name}', '我想了解功能']
          }
        }
      });

      expect(i18n.t('suggestions', { name: '小華' })).toEqual([
        '早安 小華',
        '我想了解功能'
      ]);
    });

    it('should dynamically switch locale with setLocale and trigger subscription', () => {
      const i18n = initI18nEngine({ locale: 'zh-TW' });
      const localeListener = vi.fn();

      const unsubscribe = i18n.subscribe('locale', localeListener);

      i18n.setLocale('ja-JP');
      expect(i18n.locale).toBe('ja-JP');
      expect(localeListener).toHaveBeenCalledTimes(1);
      expect(localeListener).toHaveBeenCalledWith(
        'ja-JP',
        LOCALE_LABELS['ja-JP'],
        'zh-TW'
      );

      // Setter 支援
      i18n.locale = 'en-US';
      expect(i18n.locale).toBe('en-US');
      expect(localeListener).toHaveBeenCalledTimes(2);

      unsubscribe();
      i18n.setLocale('zh-TW');
      expect(localeListener).toHaveBeenCalledTimes(2);
    });

    it('should dynamically merge new messages with addMessages', () => {
      const i18n = initI18nEngine({ locale: 'zh-TW' });

      i18n.addMessages('zh-TW', {
        customModule: {
          action: '執行動作'
        }
      });

      expect(i18n.t('customModule.action')).toBe('執行動作');
    });

    it('should support custom translation function override', () => {
      const customT = vi.fn((key) => `[CUSTOM] ${key}`);
      const i18n = initI18nEngine({ t: customT });

      expect(i18n.t('some.key')).toBe('[CUSTOM] some.key');
      expect(customT).toHaveBeenCalledWith('some.key', {});
    });

    it('should expose instance resolveLocalized, messages and generic subscribe', () => {
      const i18n = initI18nEngine({ locale: 'zh-TW' });
      expect(i18n.messages).toBeDefined();
      expect(i18n.messages['zh-TW']).toBeDefined();

      const localizedVal = i18n.resolveLocalized({
        'zh-TW': '你好',
        'en-US': 'Hello'
      });
      expect(localizedVal).toBe('你好');

      const genericListener = vi.fn();
      const unsub = i18n.subscribe((state) => state.locale, genericListener);
      i18n.setLocale('en-US');
      expect(genericListener).toHaveBeenCalledWith('en-US', 'zh-TW');
      unsub();
    });
  });
});
