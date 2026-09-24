import { initAvatarBot } from './orchestrator';

import '@/style/style.scss';

export * from './types';
export * from './store';
export * from './constants';
export * from './i18n';
export * from './brain';
export * from './speech';
export * from './skin';
export * from './tools';
export * from './plugins';
export * from './orchestrator';
export type { UiDom, UiContext } from './ui';

export type {
  AvatarMode,
  Gender,
  EngineMode,
  FitMode,
  AutoContinueMode,
  ChatRole
} from './types';

export { initAvatarBot, initAvatarBot as createAvatarBot };
export default initAvatarBot;
