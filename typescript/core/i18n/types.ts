import type { SubscribableStore } from '@/core/types';

/**
 * Display label metadata for a locale.
 */
export interface LocaleLabelInfo {
  /** Full human-readable language name (e.g. '繁體中文', 'English (US)'). */
  label: string;
  /** Abbreviated label for compact UI buttons (e.g. '繁中', 'EN'). */
  shortLabel: string;
}

/**
 * Built-in supported locale codes with extensible string autocomplete.
 */
export type SupportedLocale =
  | 'zh-TW'
  | 'en-US'
  | 'ja-JP'
  | 'ko-KR'
  | (string & {});

/**
 * Translation messages dictionary supporting flat dot-keys, string arrays, or nested objects.
 */
export type TranslationDictionary = Record<string, unknown>;

/**
 * Custom translation function signature.
 */
export type TranslateFunction =
  | (<T = string>(key: string, params?: Record<string, unknown>) => T)
  | ((key: string, params?: Record<string, unknown>) => unknown);

/**
 * Callback fired when the active locale changes, providing new locale, resolved labels, and previous locale.
 */
export type LocaleChangeListener = (
  newLocale: string,
  labels: LocaleLabelInfo,
  prevLocale: string
) => void;

/**
 * Options for initializing the standalone Internationalization (i18n) Engine.
 */
export interface I18nEngineOptions {
  /** Initial active locale code (defaults to 'zh-TW'). */
  locale?: SupportedLocale;
  /** Custom translation dictionary messages mapped by locale code. */
  messages?: Record<string, TranslationDictionary>;
  /** Custom display labels mapped by locale code (merged with built-in LOCALE_LABELS). */
  localeLabels?: Record<string, Partial<LocaleLabelInfo>>;
  /** Custom translation function override (shorthand alias for `translate`). */
  t?: TranslateFunction;
  /** Custom translation function override (descriptive name for `t`). */
  translate?: TranslateFunction;
  /** Callback fired when active locale changes, receiving (newLocale, labels, prevLocale). */
  onLocaleChange?: LocaleChangeListener | null;
}

/**
 * Reactive state managed by the I18nEngine store.
 */
export interface I18nEngineState extends Record<string, unknown> {
  /** Current active locale code. */
  locale: string;
  /** Merged translation dictionaries by locale code. */
  messages: Record<string, TranslationDictionary>;
  /** Merged locale display labels by locale code. */
  localeLabels: Record<string, LocaleLabelInfo>;
}

/**
 * Internationalization (i18n) Engine instance interface.
 */
export interface I18nEngine extends SubscribableStore<I18nEngineState> {
  /** Translates a key path with optional parameter interpolation (shorthand). */
  t: <T = string>(key: string, params?: Record<string, unknown>) => T;
  /** Translates a key path with optional parameter interpolation (descriptive). */
  translate: <T = string>(key: string, params?: Record<string, unknown>) => T;
  /** Updates the active locale code and notifies store subscribers. */
  setLocale: (newLocale: SupportedLocale) => void;
  /** Dynamically deep-merges new translation messages (and optional label info) for a locale. */
  addMessages: (
    locale: SupportedLocale,
    newMessages: TranslationDictionary,
    labelInfo?: Partial<LocaleLabelInfo>
  ) => void;
  /** Formats template placeholders ({name} or {{name}}) in a string. */
  formatParams: <T = string>(text: T, params?: Record<string, unknown>) => T;
  /** Resolves a localized value, multi-locale map, or resolver function using current active locale. */
  resolveLocalized: <T = string>(
    value?: T | Record<string, T> | ((args: Record<string, unknown>) => T),
    fallbackValue?: T | ((args: Record<string, unknown>) => T),
    templateContext?: Record<string, unknown>
  ) => T;
  /** Current active locale code (getter / setter). */
  locale: string;
  /** All registered translation dictionaries by locale. */
  readonly messages: Record<string, TranslationDictionary>;
  /** Display label metadata ({ label, shortLabel }) for the current active locale. */
  readonly labels: LocaleLabelInfo;
  /** All registered locale display label mappings. */
  readonly localeLabels: Record<string, LocaleLabelInfo>;
  /** Event callback fired when active locale changes: (newLocale, labels, prevLocale) => void. */
  onLocaleChange: LocaleChangeListener | null;
}
