import type { TranslationDictionary } from '../types';
import zhTW from './zh-TW';
import enUS from './en-US';
import jaJP from './ja-JP';
import koKR from './ko-KR';

/**
 * Built-in default translation message dictionaries for standard supported locales.
 */
export const DEFAULT_I18N_MESSAGES: Record<string, TranslationDictionary> = {
  'zh-TW': zhTW,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR
};

export { zhTW, enUS, jaJP, koKR };
export default DEFAULT_I18N_MESSAGES;
