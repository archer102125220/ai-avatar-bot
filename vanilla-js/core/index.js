/**
 * AI Avatar Bot - Web AI Virtual Human SDK for Vanilla JS & modern frontend frameworks.
 *
 * @module ai-avatar-bot
 * @example
 * ```javascript
 * import initAvatarBot from 'ai-avatar-bot';
 *
 * const bot = await initAvatarBot({
 *   container: document.getElementById('avatar-container'),
 *   avatarMode: 'assistant',
 *   llmModel: 'Llama-3.2-1B-Instruct-q4f32_1-MLC'
 * });
 * ```
 */

import { initAvatarBot } from './orchestrator';

import '@/style/style.scss';

export * from './constants';
export * from './i18n';
export * from './brain';
export * from './speech';
export * from './skin';
export * from './tools';
export * from './plugins';
export * from './orchestrator';

export { initAvatarBot, initAvatarBot as createAvatarBot };
export default initAvatarBot;
