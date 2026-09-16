import { createBaseStore } from '@/core/store';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_LABELS } from './constants';
import zhTW from './locales/zh-TW';
import enUS from './locales/en-US';
import jaJP from './locales/ja-JP';
import koKR from './locales/ko-KR';

export * from './constants';

/**
 * Built-in default dictionary mappings for standard supported locales.
 * @type {Record<string, Record<string, any>>}
 */
export const defaultLocales = {
  'zh-TW': zhTW,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR
};

/**
 * Universal localized value resolver utility.
 * Safely resolves values from functions, multi-locale objects, literal values, or fallbacks.
 *
 * @template T
 * @param {T | Record<string, T> | ((args: any) => T)} [value] - Target value, multi-locale mapping object, or resolver function.
 * @param {string} [locale=DEFAULT_LOCALE] - Current active locale code.
 * @param {T | ((args: any) => T)} [fallbackValue] - Fallback value or fallback function when unresolved.
 * @param {any} [templateContext={}] - Context arguments object passed to resolver functions.
 * @returns {T} Resolved final localized value.
 */
export function resolveLocalized(
  value,
  locale = DEFAULT_LOCALE,
  fallbackValue = undefined,
  templateContext = {}
) {
  if (typeof value === 'function') {
    return value(templateContext);
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(value) === false
  ) {
    if (typeof value[locale] !== 'undefined') {
      return typeof value[locale] === 'function'
        ? value[locale](templateContext)
        : value[locale];
    }
    if (typeof value[DEFAULT_LOCALE] !== 'undefined') {
      return typeof value[DEFAULT_LOCALE] === 'function'
        ? value[DEFAULT_LOCALE](templateContext)
        : value[DEFAULT_LOCALE];
    }
    const firstKey = Object.keys(value)[0];
    if (typeof firstKey === 'string' && firstKey !== '') {
      return typeof value[firstKey] === 'function'
        ? value[firstKey](templateContext)
        : value[firstKey];
    }
  }

  if (typeof value !== 'undefined' && value !== null) {
    return value;
  }

  if (typeof fallbackValue === 'function') {
    return fallbackValue(templateContext);
  }

  return fallbackValue;
}

/**
 * Formats template parameters in a string (e.g. replacing "{name}" or "{{name}}" with parameter values).
 *
 * @param {string} text - Source template string.
 * @param {Record<string, any>} [params={}] - Key-value replacement parameters.
 * @returns {string} Formatted output string.
 */
export function formatParams(text, params = {}) {
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
 * @param {Record<string, any>} dictionary - Dictionary object.
 * @param {string} keyPath - Key path string (e.g. 'ui.history.title').
 * @returns {any} Value or undefined.
 */
function getFromDictionary(dictionary, keyPath) {
  if (typeof dictionary !== 'object' || dictionary === null) {
    return undefined;
  }
  if (typeof dictionary[keyPath] !== 'undefined') {
    return dictionary[keyPath];
  }
  const keySegments = keyPath.split('.');
  let currentDictionary = dictionary;
  for (const segment of keySegments) {
    if (typeof currentDictionary !== 'object' || currentDictionary === null) {
      return undefined;
    }
    currentDictionary = currentDictionary[segment];
  }
  return currentDictionary;
}

/**
 * @typedef {import('@types').I18nEngineOptions} I18nEngineOptions
 * @typedef {import('@types').I18nEngineState} I18nEngineState
 * @typedef {import('@types').I18nEngine} I18nEngine
 */

/**
 * Initializes the standalone Internationalization (i18n) Engine.
 *
 * @param {I18nEngineOptions} [options={}] - Initialization options.
 * @returns {I18nEngine} Standalone i18n engine instance.
 */
export function initI18nEngine(options = {}) {
  const initialLocale =
    typeof options.locale === 'string' && options.locale !== ''
      ? options.locale
      : DEFAULT_LOCALE;

  const customMessages =
    typeof options.messages === 'object' && options.messages !== null
      ? options.messages
      : {};

  // Merge built-in dictionaries with user custom dictionary
  const mergedMessages = {};
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

  const store = createBaseStore({
    locale: initialLocale,
    messages: mergedMessages
  });

  /**
   * Translates a dictionary key with optional parameter substitution.
   *
   * @param {string} key - Dictionary key (e.g. 'ui.history.title').
   * @param {Record<string, any>} [params={}] - Parameter substitution map.
   * @returns {any} Translated string or string array.
   */
  function translate(key, params = {}) {
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

  /**
   * Dynamically switches the active locale.
   *
   * @param {string} newLocale - New locale code.
   */
  function setLocale(newLocale) {
    if (typeof newLocale === 'string' && newLocale !== '') {
      store.setState({ locale: newLocale });
    }
  }

  /**
   * Dynamically registers or overrides translation messages for a locale.
   *
   * @param {string} locale - Target locale code.
   * @param {Record<string, any>} newMessages - Dictionary content map.
   */
  function addMessages(locale, newMessages) {
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

  const i18nEngine = {
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

    get locale() {
      return store.getState().locale;
    },
    set locale(newLocale) {
      setLocale(newLocale);
    },

    get messages() {
      return store.getState().messages;
    },

    get labels() {
      return (
        LOCALE_LABELS[store.getState().locale] || {
          label: store.getState().locale,
          shortLabel: store.getState().locale
        }
      );
    },

    subscribe(key, listener) {
      if (key === 'locale') {
        return store.subscribe('locale', (newLocale, prevLocale) => {
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
