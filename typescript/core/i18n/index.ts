import {
  createBaseStore,
  StoreListener,
  PropertyListener,
  Selector
} from '@/core/store';
import type { SubscribableStore } from '@/core/types';
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

export type TranslationDictionary = Record<string, unknown>;

/**
 * Built-in default dictionary mappings for standard supported locales.
 */
export const defaultLocales: Record<string, TranslationDictionary> = {
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
export function resolveLocalized<T = string>(
  value?: T | Record<string, T> | ((args: Record<string, unknown>) => T),
  locale: string = DEFAULT_LOCALE,
  fallbackValue?: T | ((args: Record<string, unknown>) => T),
  templateContext: Record<string, unknown> = {}
): T {
  if (typeof value === 'function') {
    return (value as (args: Record<string, unknown>) => T)(templateContext);
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(value) === false
  ) {
    const record = value as Record<string, unknown>;
    if (typeof record[locale] !== 'undefined') {
      const locVal = record[locale];
      return typeof locVal === 'function'
        ? (locVal as (args: Record<string, unknown>) => T)(templateContext)
        : (locVal as T);
    }
    if (typeof record[DEFAULT_LOCALE] !== 'undefined') {
      const defVal = record[DEFAULT_LOCALE];
      return typeof defVal === 'function'
        ? (defVal as (args: Record<string, unknown>) => T)(templateContext)
        : (defVal as T);
    }
    const firstKey = Object.keys(record)[0];
    if (typeof firstKey === 'string' && firstKey !== '') {
      const firstVal = record[firstKey];
      return typeof firstVal === 'function'
        ? (firstVal as (args: Record<string, unknown>) => T)(templateContext)
        : (firstVal as T);
    }
  }

  if (typeof value !== 'undefined' && value !== null) {
    return value as T;
  }

  if (typeof fallbackValue === 'function') {
    return (fallbackValue as (args: Record<string, unknown>) => T)(
      templateContext
    );
  }

  return fallbackValue as T;
}

/**
 * Formats template parameters in a string (e.g. replacing "{name}" or "{{name}}" with parameter values).
 *
 * @param text - Source template string.
 * @param params - Key-value replacement parameters.
 * @returns Formatted output string.
 */
export function formatParams<T = string>(
  text: T,
  params: Record<string, unknown> = {}
): T {
  if (typeof text !== 'string') {
    return text;
  }
  return text.replace(/\{\{?(\w+)\}?\}/g, (match, key) => {
    return typeof params[key] !== 'undefined' && params[key] !== null
      ? String(params[key])
      : match;
  }) as unknown as T;
}

/**
 * Retrieves a nested value from a dictionary using dot notation or direct key lookup.
 *
 * @param dictionary - Dictionary object.
 * @param keyPath - Key path string (e.g. 'ui.history.title').
 * @returns Value or undefined.
 */
function getFromDictionary(
  dictionary: TranslationDictionary | undefined | null,
  keyPath: string
): unknown {
  if (typeof dictionary !== 'object' || dictionary === null) {
    return undefined;
  }
  if (typeof dictionary[keyPath] !== 'undefined') {
    return dictionary[keyPath];
  }
  const keySegments = keyPath.split('.');
  let currentDictionary: unknown = dictionary;
  for (const segment of keySegments) {
    if (typeof currentDictionary !== 'object' || currentDictionary === null) {
      return undefined;
    }
    currentDictionary = (currentDictionary as Record<string, unknown>)[segment];
  }
  return currentDictionary;
}

export type TranslateFunction = <T = string>(
  key: string,
  params?: Record<string, unknown>
) => T;

export interface I18nEngineOptions {
  locale?: string;
  messages?: Record<string, TranslationDictionary>;
  t?: TranslateFunction;
  translate?: TranslateFunction;
}

export interface I18nEngineState extends Record<string, unknown> {
  locale: string;
  messages: Record<string, TranslationDictionary>;
}

export type LocaleChangeListener = (
  newLocale: string,
  labels: LocaleLabelInfo,
  prevLocale: string
) => void;

export interface I18nEngine extends SubscribableStore<I18nEngineState> {
  t: <T = string>(key: string, params?: Record<string, unknown>) => T;
  translate: <T = string>(key: string, params?: Record<string, unknown>) => T;
  setLocale: (newLocale: string) => void;
  addMessages: (locale: string, newMessages: TranslationDictionary) => void;
  formatParams: <T = string>(text: T, params?: Record<string, unknown>) => T;
  resolveLocalized: <T = string>(
    value?: T | Record<string, T> | ((args: Record<string, unknown>) => T),
    fallbackValue?: T | ((args: Record<string, unknown>) => T),
    templateContext?: Record<string, unknown>
  ) => T;
  locale: string;
  messages: Record<string, TranslationDictionary>;
  labels: LocaleLabelInfo;
  subscribe: {
    (key: 'locale', listener: LocaleChangeListener): () => void;
    (listener: StoreListener<I18nEngineState>): () => void;
    <K extends keyof I18nEngineState>(
      key: K,
      callback: PropertyListener<I18nEngineState[K]>
    ): () => void;
    <V>(
      selector: Selector<I18nEngineState, V>,
      callback: PropertyListener<V>
    ): () => void;
    (selectorOrKey: unknown, callback?: unknown): () => void;
  };
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
  const mergedMessages: Record<string, TranslationDictionary> = {};
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

  function translate<T = string>(
    key: string,
    params: Record<string, unknown> = {}
  ): T {
    if (customTranslateFunction !== null) {
      return customTranslateFunction(key, params) as unknown as T;
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
      return formatParams(messageValue, params) as unknown as T;
    }

    if (Array.isArray(messageValue) === true) {
      return messageValue.map((messageItem) =>
        typeof messageItem === 'string'
          ? formatParams(messageItem, params)
          : messageItem
      ) as unknown as T;
    }

    return messageValue as unknown as T;
  }

  function setLocale(newLocale: string): void {
    if (typeof newLocale === 'string' && newLocale !== '') {
      store.setState({ locale: newLocale });
    }
  }

  function addMessages(
    locale: string,
    newMessages: TranslationDictionary
  ): void {
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

    get messages(): Record<string, TranslationDictionary> {
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

    subscribe(key: unknown, listener?: unknown): () => void {
      if (key === 'locale' && typeof listener === 'function') {
        return store.subscribe(
          'locale',
          (newLocale: unknown, prevLocale: unknown) => {
            const locStr = String(newLocale);
            const localeLabels = LOCALE_LABELS[locStr] || {
              label: locStr,
              shortLabel: locStr
            };
            (listener as LocaleChangeListener)(
              locStr,
              localeLabels,
              String(prevLocale)
            );
          }
        );
      }
      return (store.subscribe as (k: unknown, l?: unknown) => () => void)(
        key,
        listener
      );
    },
    getState: store.getState,
    setState: store.setState
  };

  return i18nEngine;
}
