import { createBaseStore } from '../store';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_LABELS } from './constants';
import zhTW from './locales/zh-TW';
import enUS from './locales/en-US';
import jaJP from './locales/ja-JP';
import koKR from './locales/ko-KR';

export * from './constants';

export const defaultLocales = {
  'zh-TW': zhTW,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR
};

/**
 * 通用多語系值解析工具函式。
 * 支援「函式 / 多語系物件 / 單一值 / 回退值」的安全解析。
 *
 * @template T
 * @param {T | Record<string, T> | ((args: any) => T)} [value] - 欲解析的值、多語系物件或函式。
 * @param {string} [locale=DEFAULT_LOCALE] - 當前語系代碼。
 * @param {T | ((args: any) => T)} [fallbackValue] - 當解析不到時的回退值或回退函式。
 * @param {any} [templateContext={}] - 傳遞給函式的上下文參數物件。
 * @returns {T} 解析後的最終值。
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
 * 格式化字串中的變數標記 (例如將 "{name}" 或 "{{name}}" 替換為實際名稱)。
 *
 * @param {string} text - 原始字串。
 * @param {Record<string, any>} [params={}] - 替換參數。
 * @returns {string} 替換後的字串。
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
 * @typedef {Object} I18nEngineOptions
 * @property {string} [locale=DEFAULT_LOCALE] - 預設語系代碼。
 * @property {Record<string, Record<string, any>>} [messages={}] - 自訂/覆寫的語系字典。
 * @property {((key: string, params?: Record<string, any>) => any)} [t] - 自訂外部翻譯函式 (簡短別名)。
 * @property {((key: string, params?: Record<string, any>) => any)} [translate] - 自訂外部翻譯函式。
 */

/**
 * @typedef {Object} I18nEngineState
 * @property {string} locale - 當前語系代碼。
 * @property {Record<string, Record<string, any>>} messages - 當前所有載入的字典資料。
 */

/**
 * @typedef {Object} I18nEngine
 * @property {((key: string, params?: Record<string, any>) => any)} t - 翻譯指定鍵值。
 * @property {((key: string, params?: Record<string, any>) => any)} translate - 翻譯指定鍵值。
 * @property {((newLocale: string) => void)} setLocale - 動態切換語系。
 * @property {((locale: string, newMessages: Record<string, any>) => void)} addMessages - 動態新增或覆寫語系字典內容。
 * @property {typeof formatParams} formatParams - 格式化變數標記。
 * @property {<T>(value: T | Record<string, T> | ((args: any) => T), fallbackValue?: T | ((args: any) => T), templateContext?: any) => T} resolveLocalized - 使用當前語系解析多語系值。
 * @property {string} locale - 當前語系代碼。
 * @property {Record<string, Record<string, any>>} messages - 所有載入的字典資料。
 * @property {{label: string, shortLabel: string}} labels - 當前語系的顯示標籤資訊。
 * @property {(selector: any, callback?: Function) => () => void} subscribe - 訂閱狀態變更。
 * @property {() => I18nEngineState} getState - 取得內部狀態。
 * @property {(updates: Partial<I18nEngineState> | ((state: I18nEngineState) => Partial<I18nEngineState>)) => void} setState - 覆寫或更新部分狀態。
 */

/**
 * 初始化獨立的多語系引擎 (i18nEngine)。
 *
 * @param {I18nEngineOptions} [options={}] - 初始化選項。
 * @returns {I18nEngine} i18nEngine 實例。
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

  // 合併內建字典與使用者自訂字典
  const mergedMessages = {};
  for (const supportedLocale of SUPPORTED_LOCALES) {
    mergedMessages[supportedLocale] = {
      ...(defaultLocales[supportedLocale] || {}),
      ...(customMessages[supportedLocale] || {})
    };
  }

  // 納入其他非預設語系（例如使用者自行加入 'fr-FR' 等）
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
   * 翻譯指定鍵值。
   *
   * @param {string} key - 字典鍵值 (例如: 'ui.history.title')。
   * @param {Record<string, any>} [params={}] - 變數替換參數。
   * @returns {any} 翻譯後的字串或陣列。
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
   * 動態切換語系。
   *
   * @param {string} newLocale - 新的語系代碼。
   */
  function setLocale(newLocale) {
    if (typeof newLocale === 'string' && newLocale !== '') {
      store.setState({ locale: newLocale });
    }
  }

  /**
   * 動態新增或覆寫語系字典內容。
   *
   * @param {string} locale - 目標語系代碼。
   * @param {Record<string, any>} newMessages - 字典內容。
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
