/**
 * @typedef {import('./dom').UiDom} UiDom
 */

/**
 * 傳遞給 UI 模組的應用程式狀態與參考集合
 * @typedef {Object} UiContext
 * @property {UiDom} uiDom - UI DOM 元素與控制方法
 * @property {Object} [speechEngine] - 語音引擎實例
 * @property {Object} [brainEngine] - AI 大腦引擎實例
 * @property {Object} [toolsEngine] - 工具引擎實例
 * @property {Object} [skinEngine] - 外觀引擎實例
 * @property {Object} [i18nEngine] - 多語系引擎實例
 * @property {string} [locale] - 當前語系代碼
 * @property {string[]} [suggestedQuestions] - 建議對話列表
 * @property {string} [suggestedTitle] - 建議對話標題
 * @property {string[]} [companionSuggestedQuestions] - 陪伴模式的建議對話列表
 * @property {string} [companionSuggestedTitle] - 陪伴模式的建議對話標題
 * @property {string[]} [assistantSuggestedQuestions] - 助理模式的建議對話列表
 * @property {string} [assistantSuggestedTitle] - 助理模式的建議對話標題
 * @property {string} [avatarMode] - 虛擬人模式 ('companion' | 'assistant')
 * @property {Object} [AVATAR_MODE_MAP] - 虛擬人模式常數對應表
 * @property {Object} [ENGINE_MODE_MAP] - 引擎模式常數對應表
 * @property {Object} [STATE_MAP] - 狀態常數對應表
 * @property {boolean} [isMinimal] - 是否處於最小化狀態
 * @property {boolean} [isIframe] - 是否在 iframe 中執行
 * @property {(text: string) => Promise<void>|void} [handleUser] - 處理使用者輸入文字的主方法
 * @property {(isMinimal: boolean, context: UiContext) => void} [onMinimalTrigger] - 最小化觸發回呼函數
 */

export * from './dom';
export * from './history';
export * from './suggestions';
export * from './events';
export * from './utils';
