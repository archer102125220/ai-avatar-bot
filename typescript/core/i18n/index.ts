import { createBaseStore } from '@/core/store';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  LocaleLabelInfo
} from './constants';
import zhTW from './locales/zh-TW';
import enUS from './locales/en-US';
import jaJP from './locales/ja-JP';
import koKR from './locales/ko-KR';

export * from './constants';

/**
 * Built-in default dictionary mappings for standard supported locales.
 */
export const defaultLocales: Record<string, Record<string, any>> = {
  'zh-TW': zhTW,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR
};

/**
 * Universal localized value resolver utility.
 * Safely resolves values from functions, multi-locale objects, literal values, or fallbacks.
 *
 * @param value - Target value, multi-locale mapping object, or resolver function.
 * @param locale - Current active locale code.
 * @param fallbackValue - Fallback value or fallback function when unresolved.
 * @param templateContext - Context arguments object passed to resolver functions.
 * @returns Resolved final localized value.
 */
export function resolveLocalized<T = any>(
  value?: T | Record<string, T> | ((args: any) => T),
  locale: string = DEFAULT_LOCALE,
  fallbackValue?: T | ((args: any) => T),
  templateContext: any = {}
): T | undefined {
  if (typeof value === 'function') {
    return (value as (args: any) => T)(templateContext);
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(value) === false
  ) {
    const record = value as Record<string, any>;
    if (typeof record[locale] !== 'undefined') {
      return typeof record[locale] === 'function'
        ? record[locale](templateContext)
        : record[locale];
    }
    if (typeof record[DEFAULT_LOCALE] !== 'undefined') {
      return typeof record[DEFAULT_LOCALE] === 'function'
        ? record[DEFAULT_LOCALE](templateContext)
        : record[DEFAULT_LOCALE];
    }
    const firstKey = Object.keys(record)[0];
    if (typeof firstKey === 'string' && firstKey !== '') {
      return typeof record[firstKey] === 'function'
        ? record[firstKey](templateContext)
        : record[firstKey];
    }
  }

  if (typeof value !== 'undefined' && value !== null) {
    return value as T;
  }

  if (typeof fallbackValue === 'function') {
    return (fallbackValue as (args: any) => T)(templateContext);
  }

  return fallbackValue;
}

/**
 * Formats template parameters in a string (e.g. replacing "{name}" or "{{name}}" with parameter values).
 *
 * @param text - Source template string.
 * @param params - Key-value replacement parameters.
 * @returns Formatted output string.
 */
export function formatParams(text: string, params: Record<string, any> = {}): string {
  if (typeof text !== 'string') {
    return text;
  }
  return text.replace(/\{\{?(\w+)\}?\}/g, (match, key) => {
    return typeof params[key] !== 'undefined' && params[key] !== null
      ? String(params[key])
      : match;
  });
}

/**
 * Retrieves a nested value from a dictionary using dot notation or direct key lookup.
 *
 * @param dictionary - Dictionary object.
 * @param keyPath - Key path string (e.g. 'ui.history.title').
 * @returns Value or undefined.
 */
function getFromDictionary(
  dictionary: Record<string, any> | undefined | null,
  keyPath: string
): any {
  if (typeof dictionary !== 'object' || dictionary === null) {
    return undefined;
  }
  if (typeof dictionary[keyPath] !== 'undefined') {
    return dictionary[keyPath];
  }
  const keySegments = keyPath.split('.');
  let currentDictionary: any = dictionary;
  for (const segment of keySegments) {
    if (typeof currentDictionary !== 'object' || currentDictionary === null) {
      return undefined;
    }
    currentDictionary = currentDictionary[segment];
  }
  return currentDictionary;
}

export interface I18nEngineOptions {
  locale?: string;
  messages?: Record<string, Record<string, any>>;
  t?: (key: string, params?: Record<string, any>) => any;
  translate?: (key: string, params?: Record<string, any>) => any;
}

export interface I18nEngineState {
  locale: string;
  messages: Record<string, Record<string, any>>;
}

export interface I18nEngine {
  t: (key: string, params?: Record<string, any>) => any;
  translate: (key: string, params?: Record<string, any>) => any;
  setLocale: (newLocale: string) => void;
  addMessages: (locale: string, newMessages: Record<string, any>) => void;
  formatParams: (text: string, params?: Record<string, any>) => string;
  resolveLocalized: <T = any>(
    value?: T | Record<string, T> | ((args: any) => T),
    fallbackValue?: T | ((args: any) => T),
    templateContext?: any
  ) => T | undefined;
  locale: string;
  messages: Record<string, Record<string, any>>;
  labels: LocaleLabelInfo;
  subscribe: (
    key: string | ((state: I18nEngineState, prevState: I18nEngineState) => void),
    listener?: any
  ) => () => void;
  getState: () => I18nEngineState;
  setState: (updates: Partial<I18nEngineState> | ((state: I18nEngineState) => Partial<I18nEngineState>)) => void;
}

/**
 * Initializes the standalone Internationalization (i18n) Engine.
 *
 * @param options - Initialization options.
 * @returns Standalone i18n engine instance.
 */
export function initI18nEngine(options: I18nEngineOptions = {}): I18nEngine {
  const initialLocale =
    typeof options.locale === 'string' && options.locale !== ''
      ? options.locale
      : DEFAULT_LOCALE;

  const customMessages =
    typeof options.messages === 'object' && options.messages !== null
      ? options.messages
      : {};

  // Merge built-in dictionaries with user custom dictionary
  const mergedMessages: Record<string, Record<string, any>> = {};
  for (const supportedLocale of SUPPORTED_LOCALES) {
    mergedMessages[supportedLocale] = {
      ...(defaultLocales[supportedLocale] || {}),
      ...(customMessages[supportedLocale] || {})
    };
  }

  // Include additional custom locales (e.g. user-defined 'fr-FR')
  for (const customLocale in customMessages) {
    if (SUPPORTED_LOCALES.includes(customLocale) === false) {
      mergedMessages[customLocale] = { ...customMessages[customLocale] };
    }
  }

  const customTranslateFunction =
    typeof options.t === 'function'
      ? options.t
      : typeof options.translate === 'function'
        ? options.translate
        : null;

  const store = createBaseStore<I18nEngineState>({
    locale: initialLocale,
    messages: mergedMessages
  });

  function translate(key: string, params: Record<string, any> = {}): any {
    if (customTranslateFunction !== null) {
      return customTranslateFunction(key, params);
    }

    const state = store.getState();
    const currentLocale = state.locale || DEFAULT_LOCALE;
    const dictionary =
      state.messages[currentLocale] || state.messages[DEFAULT_LOCALE] || {};

    let messageValue = getFromDictionary(dictionary, key);
    if (typeof messageValue === 'undefined') {
      messageValue =
        getFromDictionary(state.messages[DEFAULT_LOCALE], key) ?? key;
    }

    if (typeof messageValue === 'string') {
      return formatParams(messageValue, params);
    }

    if (Array.isArray(messageValue) === true) {
      return messageValue.map((messageItem) =>
        typeof messageItem === 'string'
          ? formatParams(messageItem, params)
          : messageItem
      );
    }

    return messageValue;
  }

  function setLocale(newLocale: string): void {
    if (typeof newLocale === 'string' && newLocale !== '') {
      store.setState({ locale: newLocale });
    }
  }

  function addMessages(locale: string, newMessages: Record<string, any>): void {
    if (
      typeof locale === 'string' &&
      typeof newMessages === 'object' &&
      newMessages !== null
    ) {
      const state = store.getState();
      const currentLocaleDictionary = state.messages[locale] || {};
      store.setState({
        messages: {
          ...state.messages,
          [locale]: { ...currentLocaleDictionary, ...newMessages }
        }
      });
    }
  }

  const i18nEngine: I18nEngine = {
    t: translate,
    translate,
    setLocale,
    addMessages,
    formatParams,
    resolveLocalized: (value, fallbackValue, templateContext) =>
      resolveLocalized(
        value,
        store.getState().locale,
        fallbackValue,
        templateContext
      ),

    get locale(): string {
      return store.getState().locale;
    },
    set locale(newLocale: string) {
      setLocale(newLocale);
    },

    get messages(): Record<string, Record<string, any>> {
      return store.getState().messages;
    },

    get labels(): LocaleLabelInfo {
      return (
        LOCALE_LABELS[store.getState().locale] || {
          label: store.getState().locale,
          shortLabel: store.getState().locale
        }
      );
    },

    subscribe(key: any, listener: any): () => void {
      if (key === 'locale' && typeof listener === 'function') {
        return store.subscribe('locale', (newLocale: string, prevLocale: string) => {
          const localeLabels = LOCALE_LABELS[newLocale] || {
            label: newLocale,
            shortLabel: newLocale
          };
          listener(newLocale, localeLabels, prevLocale);
        });
      }
      return store.subscribe(key, listener);
    },
    getState: store.getState,
    setState: store.setState
  };

  return i18nEngine;
}
