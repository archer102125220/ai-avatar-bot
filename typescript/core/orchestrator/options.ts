import { initI18nEngine } from '@/core/i18n';
import { createBaseStore } from '@/core/store';
import {
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  GENDER_MAP,
  DEFAULT_GENDER,
  getDefaultNeuralVoice,
  DEFAULT_ENABLE_MODEL_DROP,
  DEFAULT_ENABLE_ENGINE_TOGGLE,
  DEFAULT_ENABLE_AUTO_CONTINUE,
  DEFAULT_MAX_AUTO_CONTINUATIONS,
  AUTO_CONTINUE_MODE_MAP,
  DEFAULT_AUTO_CONTINUE_MODE,
  DEFAULT_ENABLE_MEMORY
} from '@/core/constants';
import type { AvatarBotOptions, BaseStore, I18nEngine } from '@types';

/**
 * Safely invokes a user-defined event callback function with optional context and arguments.
 */
export function callOptionEvent(
  options: Record<string, any> | undefined | null,
  context: any,
  eventName: string,
  ...eventArguments: any[]
): any {
  if (
    typeof options === 'object' &&
    options !== null &&
    typeof options[eventName] === 'function'
  ) {
    return options[eventName].call(context, ...eventArguments);
  }
}

export interface NormalizedOptionsResult {
  rawOptions: AvatarBotOptions;
  container: HTMLElement;
  rootStore: BaseStore;
  i18nEngine: I18nEngine;
  initialMinimal: boolean;
  isModelDropEnabled: boolean;
  isEngineToggleEnabled: boolean;
  safeGender: string;
  safeNeuralVoice: string;
  targetAvatarMode: string;
}

/**
 * Validates and normalizes raw AvatarBotOptions, initializing the root reactive store and i18n engine.
 */
export function normalizeOptions(rawOptions: AvatarBotOptions = {}): NormalizedOptionsResult {
  const {
    container = null,
    enableAiProvider,
    aiProviderBaseUrl = '',
    neuralVoice = '',
    preloadWebLLM = false,
    autoFallbackWebLLM = true,
    enableAutoContinue = DEFAULT_ENABLE_AUTO_CONTINUE,
    maxAutoContinuations = DEFAULT_MAX_AUTO_CONTINUATIONS,
    autoContinueMode = DEFAULT_AUTO_CONTINUE_MODE,
    autoContinuePrompt,
    avatarMode = DEFAULT_AVATAR_MODE,
    enableMemory = DEFAULT_ENABLE_MEMORY,
    modes = null,
    enableModelDrop = DEFAULT_ENABLE_MODEL_DROP,
    allowModelDrop,
    enableEngineToggle = DEFAULT_ENABLE_ENGINE_TOGGLE,
    isMinimal = false,
    isIframe = false,
    locale = 'zh-TW',
    gender = '',
    brainGender = null,
    speechGender = null,
    skinGender = null,
    customEngines = {}
  } = rawOptions;

  if (container instanceof HTMLElement === false) {
    throw new Error('container must be an HTMLElement');
  }

  const customModeKeys =
    typeof modes === 'object' && modes !== null ? Object.keys(modes) : [];
  const initialAvailableModes = Array.from(
    new Set([...Object.values(AVATAR_MODE_MAP), ...customModeKeys])
  );

  const targetAvatarMode =
    typeof avatarMode === 'string' && avatarMode !== ''
      ? avatarMode
      : DEFAULT_AVATAR_MODE;
  if (initialAvailableModes.includes(targetAvatarMode) === false) {
    throw new TypeError(
      `[ai-avatar-bot] Invalid avatarMode "${targetAvatarMode}". Expected one of: [${initialAvailableModes.join(', ')}].`
    );
  }

  let safeGender = DEFAULT_GENDER;
  if (gender === GENDER_MAP.female || gender === GENDER_MAP.male) {
    safeGender = gender;
  }

  let safeNeuralVoice = neuralVoice;
  if (typeof neuralVoice !== 'string' || neuralVoice === '') {
    safeNeuralVoice = getDefaultNeuralVoice(safeGender);
  }

  let initialMinimal = false;
  if (isIframe === true) {
    initialMinimal = false;
  } else if (isMinimal === true) {
    initialMinimal = true;
  }

  let i18nEngine: I18nEngine;
  if (
    typeof customEngines?.i18n === 'function' ||
    (typeof customEngines?.i18n === 'object' && customEngines?.i18n !== null)
  ) {
    i18nEngine =
      typeof customEngines.i18n === 'function'
        ? (customEngines.i18n as any)({
            locale:
              typeof locale === 'string' && locale !== '' ? locale : 'zh-TW',
            messages: rawOptions.i18nMessages
          })
        : (customEngines.i18n as any);
  } else {
    i18nEngine = initI18nEngine({
      locale: typeof locale === 'string' && locale !== '' ? locale : 'zh-TW',
      messages: rawOptions.i18nMessages
    });
  }

  const isModelDropEnabled =
    typeof allowModelDrop === 'boolean'
      ? allowModelDrop
      : typeof enableModelDrop === 'boolean'
        ? enableModelDrop
        : DEFAULT_ENABLE_MODEL_DROP;

  const isEngineToggleEnabled =
    typeof enableEngineToggle === 'boolean'
      ? enableEngineToggle
      : DEFAULT_ENABLE_ENGINE_TOGGLE;

  const rootStore = createBaseStore({
    gender: safeGender,
    brainGender:
      typeof brainGender === 'string' &&
      brainGender !== '' &&
      (Object.values(GENDER_MAP) as string[]).includes(brainGender)
        ? brainGender
        : null,
    speechGender:
      typeof speechGender === 'string' &&
      speechGender !== '' &&
      (Object.values(GENDER_MAP) as string[]).includes(speechGender)
        ? speechGender
        : null,
    skinGender:
      typeof skinGender === 'string' &&
      skinGender !== '' &&
      (Object.values(GENDER_MAP) as string[]).includes(skinGender)
        ? skinGender
        : null,
    avatarMode: targetAvatarMode,
    enableMemory:
      typeof enableMemory === 'boolean' ? enableMemory : DEFAULT_ENABLE_MEMORY,
    enableAiProvider:
      typeof enableAiProvider === 'boolean'
        ? enableAiProvider
        : typeof aiProviderBaseUrl === 'string' && aiProviderBaseUrl !== '',
    preloadWebLLM: typeof preloadWebLLM === 'boolean' ? preloadWebLLM : false,
    autoFallbackWebLLM:
      typeof autoFallbackWebLLM === 'boolean' ? autoFallbackWebLLM : true,
    enableAutoContinue:
      typeof enableAutoContinue === 'boolean'
        ? enableAutoContinue
        : DEFAULT_ENABLE_AUTO_CONTINUE,
    maxAutoContinuations:
      typeof maxAutoContinuations === 'number' &&
      Number.isFinite(maxAutoContinuations) === true &&
      maxAutoContinuations > 0
        ? maxAutoContinuations
        : DEFAULT_MAX_AUTO_CONTINUATIONS,
    autoContinueMode:
      typeof autoContinueMode === 'string' &&
      (Object.values(AUTO_CONTINUE_MODE_MAP) as string[]).includes(autoContinueMode) === true
        ? autoContinueMode
        : DEFAULT_AUTO_CONTINUE_MODE,
    autoContinuePrompt:
      typeof autoContinuePrompt === 'string' ||
      typeof autoContinuePrompt === 'function'
        ? autoContinuePrompt
        : null,
    modes: typeof modes === 'object' && modes !== null ? modes : {},
    locale:
      typeof i18nEngine?.locale === 'string' && i18nEngine.locale !== ''
        ? i18nEngine.locale
        : typeof locale === 'string' && locale !== ''
          ? locale
          : 'zh-TW',
    enableModelDrop: isModelDropEnabled,
    enableEngineToggle: isEngineToggleEnabled,
    suggestedQuestions: rawOptions.suggestedQuestions,
    companionSuggestedQuestions: rawOptions.companionSuggestedQuestions,
    assistantSuggestedQuestions: rawOptions.assistantSuggestedQuestions,
    suggestedTitle: rawOptions.suggestedTitle,
    companionSuggestedTitle: rawOptions.companionSuggestedTitle,
    assistantSuggestedTitle: rawOptions.assistantSuggestedTitle
  });

  return {
    rawOptions,
    container,
    rootStore,
    i18nEngine,
    initialMinimal,
    isModelDropEnabled,
    isEngineToggleEnabled,
    safeGender,
    safeNeuralVoice,
    targetAvatarMode
  };
}
