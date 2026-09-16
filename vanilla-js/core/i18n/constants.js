/**
 * @typedef {import('../../index.d.ts').LocaleLabelInfo} LocaleLabelInfo
 */

/**
 * Default locale code.
 * @type {string}
 */
export const DEFAULT_LOCALE = 'zh-TW';

/**
 * Default list of supported locale codes.
 * @type {string[]}
 */
export const SUPPORTED_LOCALES = ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'];

/**
 * Mapping table of locale codes to display labels.
 * @type {Record<string, LocaleLabelInfo>}
 */
export const LOCALE_LABELS = {
  'zh-TW': { label: '繁體中文', shortLabel: '繁中' },
  'en-US': { label: 'English (US)', shortLabel: 'EN' },
  'ja-JP': { label: '日本語', shortLabel: 'JA' },
  'ko-KR': { label: '한국어', shortLabel: 'KO' }
};
