import { createBaseStore } from '@/core/store';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_LABELS } from './constants';
import { DEFAULT_I18N_MESSAGES } from './locales';
import type {
  LocaleLabelInfo,
  SupportedLocale,
  TranslationDictionary,
  LocaleChangeListener,
  I18nEngineOptions,
  I18nEngineState,
  I18nEngine
} from './types';

export * from './types';
export * from './constants';
export * from './locales';

/**
 * Deeply merges two translation dictionaries without mutating inputs.
 */
function deepMergeDictionary(
  baseDict: TranslationDictionary,
  overrideDict: TranslationDictionary
): TranslationDictionary {
  const result: TranslationDictionary = { ...baseDict };
  for (const key of Object.keys(overrideDict)) {
    const baseVal = result[key];
    const overrideVal = overrideDict[key];
    if (
      typeof baseVal === 'object' &&
      baseVal !== null &&
      Array.isArray(baseVal) === false &&
      typeof overrideVal === 'object' &&
      overrideVal !== null &&
      Array.isArray(overrideVal) === false
    ) {
      result[key] = deepMergeDictionary(
        baseVal as TranslationDictionary,
        overrideVal as TranslationDictionary
      );
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

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

/**
 * Validates whether a custom i18n engine instance satisfies the I18nEngine interface contract.
 *
 * @param engine - Engine instance to validate.
 * @returns Validation result and list of missing members.
 */
export function validateI18nEngine(engine: unknown): {
  isValid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (typeof engine !== 'object' || engine === null) {
    missing.push('engine instance');
    return { isValid: false, missing };
  }
  const record = engine as Record<string, unknown>;
  const requiredMethods = [
    't',
    'translate',
    'setLocale',
    'addMessages',
    'formatParams',
    'resolveLocalized',
    'subscribe',
    'getState',
    'setState'
  ];
  for (const methodName of requiredMethods) {
    if (typeof record[methodName] !== 'function') {
      missing.push(`${methodName}()`);
    }
  }
  const requiredProperties = ['locale', 'messages', 'labels'];
  for (const propName of requiredProperties) {
    if (!(propName in record)) {
      missing.push(propName);
    }
  }
  return { isValid: missing.length === 0, missing };
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

  // Deep-merge built-in dictionaries with user custom dictionary
  const mergedMessages: Record<string, TranslationDictionary> = {};
  for (const supportedLocale of SUPPORTED_LOCALES) {
    const baseLocaleDict = DEFAULT_I18N_MESSAGES[supportedLocale] || {};
    const customLocaleDict =
      typeof customMessages[supportedLocale] === 'object' &&
      customMessages[supportedLocale] !== null
        ? customMessages[supportedLocale]
        : {};
    mergedMessages[supportedLocale] = deepMergeDictionary(
      baseLocaleDict,
      customLocaleDict
    );
  }

  // Include additional custom locales (e.g. user-defined 'fr-FR', 'zh-CN')
  for (const customLocale of Object.keys(customMessages)) {
    if (
      SUPPORTED_LOCALES.includes(customLocale) === false &&
      typeof customMessages[customLocale] === 'object' &&
      customMessages[customLocale] !== null
    ) {
      mergedMessages[customLocale] = deepMergeDictionary(
        {},
        customMessages[customLocale]
      );
    }
  }

  // Clone built-in LOCALE_LABELS per instance and merge custom localeLabels
  const mergedLocaleLabels: Record<string, LocaleLabelInfo> = {};
  for (const localeKey of Object.keys(LOCALE_LABELS)) {
    const builtInLabel = LOCALE_LABELS[localeKey];
    mergedLocaleLabels[localeKey] = {
      label: builtInLabel.label,
      shortLabel: builtInLabel.shortLabel
    };
  }
  if (
    typeof options.localeLabels === 'object' &&
    options.localeLabels !== null
  ) {
    for (const localeKey of Object.keys(options.localeLabels)) {
      const customLabel = options.localeLabels[localeKey];
      if (typeof customLabel === 'object' && customLabel !== null) {
        const baseLabel = mergedLocaleLabels[localeKey];
        const resolvedLabel =
          typeof customLabel.label === 'string' && customLabel.label !== ''
            ? customLabel.label
            : typeof baseLabel?.label === 'string' && baseLabel.label !== ''
              ? baseLabel.label
              : localeKey;
        const resolvedShortLabel =
          typeof customLabel.shortLabel === 'string' &&
          customLabel.shortLabel !== ''
            ? customLabel.shortLabel
            : typeof baseLabel?.shortLabel === 'string' &&
                baseLabel.shortLabel !== ''
              ? baseLabel.shortLabel
              : resolvedLabel;
        mergedLocaleLabels[localeKey] = {
          label: resolvedLabel,
          shortLabel: resolvedShortLabel
        };
      }
    }
  }

  const customTranslateFunction =
    typeof options.t === 'function'
      ? options.t
      : typeof options.translate === 'function'
        ? options.translate
        : null;

  let onLocaleChangeCallback: LocaleChangeListener | null =
    typeof options.onLocaleChange === 'function'
      ? options.onLocaleChange
      : null;

  const store = createBaseStore<I18nEngineState>({
    locale: initialLocale,
    messages: mergedMessages,
    localeLabels: mergedLocaleLabels
  });

  function translate<T = string>(
    key: string,
    params: Record<string, unknown> = {}
  ): T {
    if (customTranslateFunction !== null) {
      return customTranslateFunction(key, params) as unknown as T;
    }

    const state = store.getState();
    const currentLocale =
      typeof state.locale === 'string' && state.locale !== ''
        ? state.locale
        : DEFAULT_LOCALE;
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

  function setLocale(newLocale: SupportedLocale): void {
    if (typeof newLocale === 'string' && newLocale !== '') {
      store.setState({ locale: newLocale });
    }
  }

  function addMessages(
    locale: SupportedLocale,
    newMessages: TranslationDictionary,
    labelInfo?: Partial<LocaleLabelInfo>
  ): void {
    if (
      typeof locale === 'string' &&
      locale !== '' &&
      typeof newMessages === 'object' &&
      newMessages !== null
    ) {
      const state = store.getState();
      const currentLocaleDictionary = state.messages[locale] || {};
      const nextMessages = {
        ...state.messages,
        [locale]: deepMergeDictionary(currentLocaleDictionary, newMessages)
      };

      if (typeof labelInfo === 'object' && labelInfo !== null) {
        const baseLabel = state.localeLabels[locale];
        const resolvedLabel =
          typeof labelInfo.label === 'string' && labelInfo.label !== ''
            ? labelInfo.label
            : typeof baseLabel?.label === 'string' && baseLabel.label !== ''
              ? baseLabel.label
              : locale;
        const resolvedShortLabel =
          typeof labelInfo.shortLabel === 'string' &&
          labelInfo.shortLabel !== ''
            ? labelInfo.shortLabel
            : typeof baseLabel?.shortLabel === 'string' &&
                baseLabel.shortLabel !== ''
              ? baseLabel.shortLabel
              : resolvedLabel;
        store.setState({
          messages: nextMessages,
          localeLabels: {
            ...state.localeLabels,
            [locale]: {
              label: resolvedLabel,
              shortLabel: resolvedShortLabel
            }
          }
        });
      } else {
        store.setState({ messages: nextMessages });
      }
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
      const state = store.getState();
      const currentLocale = state.locale;
      return (
        state.localeLabels[currentLocale] || {
          label: currentLocale,
          shortLabel: currentLocale
        }
      );
    },

    get localeLabels(): Record<string, LocaleLabelInfo> {
      return store.getState().localeLabels;
    },

    get onLocaleChange(): LocaleChangeListener | null {
      return onLocaleChangeCallback;
    },
    set onLocaleChange(listener: LocaleChangeListener | null) {
      onLocaleChangeCallback = typeof listener === 'function' ? listener : null;
    },

    subscribe: store.subscribe,
    getState: store.getState,
    setState: store.setState
  };

  store.subscribe('locale', (newLocale: string, prevLocale: string) => {
    if (typeof onLocaleChangeCallback === 'function') {
      onLocaleChangeCallback(newLocale, i18nEngine.labels, prevLocale);
    }
  });

  return i18nEngine;
}
