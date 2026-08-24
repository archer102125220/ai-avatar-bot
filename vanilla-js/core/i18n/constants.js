/**
 * @typedef {Object} LocaleLabelInfo
 * @property {string} label - 語系完整名稱 (例如: '繁體中文')。
 * @property {string} shortLabel - 語系簡稱代碼 (例如: '繁中')。
 */

/**
 * 預設語系代碼。
 * @type {string}
 */
export const DEFAULT_LOCALE = 'zh-TW';

/**
 * 預設支援的多語系代碼清單。
 * @type {string[]}
 */
export const SUPPORTED_LOCALES = ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'];

/**
 * 各語系代碼對應的顯示標籤對照表。
 * @type {Record<string, LocaleLabelInfo>}
 */
export const LOCALE_LABELS = {
  'zh-TW': { label: '繁體中文', shortLabel: '繁中' },
  'en-US': { label: 'English (US)', shortLabel: 'EN' },
  'ja-JP': { label: '日本語', shortLabel: 'JA' },
  'ko-KR': { label: '한국어', shortLabel: 'KO' }
};
