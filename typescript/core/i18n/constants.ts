import type { LocaleLabelInfo, SupportedLocale } from './types';

export type { LocaleLabelInfo, SupportedLocale };
export { DEFAULT_I18N_MESSAGES } from './locales';

/**
 * Default locale code.
 */
export const DEFAULT_LOCALE: SupportedLocale = 'zh-TW';

/**
 * Default list of supported locale codes.
 */
export const SUPPORTED_LOCALES: SupportedLocale[] = [
  'zh-TW',
  'en-US',
  'ja-JP',
  'ko-KR'
];

/**
 * Mapping table of locale codes to display labels.
 */
export const LOCALE_LABELS: Record<string, LocaleLabelInfo> = {
  'zh-TW': { label: '繁體中文', shortLabel: '繁中' },
  'en-US': { label: 'English (US)', shortLabel: 'EN' },
  'ja-JP': { label: '日本語', shortLabel: 'JA' },
  'ko-KR': { label: '한국어', shortLabel: 'KO' }
};
