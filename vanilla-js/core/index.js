import { initAvatarBot } from './orchestrator';
import '../style/style.scss';

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
