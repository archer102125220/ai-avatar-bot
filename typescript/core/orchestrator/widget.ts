import {
  DEFAULT_LLM_MODEL,
  STATE_MAP,
  ENGINE_MODE_MAP,
  AVATAR_MODE_MAP,
  FIT_MODE_MAP,
  BRAIN_ENGINE_TYPE_MAP,
  BRAIN_FALLBACK_TYPE_MAP,
  AUTO_CONTINUE_MODE_MAP,
  LLM_FINISH_REASON_MAP,
  FINISH_REASON_MAP,
  GENDER_MAP,
  DEFAULT_ENABLE_MEMORY,
  DEFAULT_ENABLE_AUTO_CONTINUE,
  DEFAULT_MAX_AUTO_CONTINUATIONS,
  DEFAULT_AUTO_CONTINUE_MODE,
  DEFAULT_ENABLE_MODEL_DROP,
  DEFAULT_ENABLE_ENGINE_TOGGLE
} from '@/core/constants';
import { initSkinModeChangeButton, renderSuggestions, type UiDom } from '@/core/ui';
import type { I18nEngine } from '@/core/i18n';
import type { BrainEngine, LLMMessage } from '@/core/brain';
import type { SpeechEngine } from '@/core/speech';
import type { SkinEngine, Skin2DConfig, Skin3DConfig } from '@/core/skin';
import type { ToolsEngine } from '@/core/tools';
import type {
  AiAvatarWidget,
  AvatarBotOptions,
  AvatarBotStore,
  AutoContinueMode
} from './types';

export interface CreateAvatarWidgetParams {
  options: AvatarBotOptions;
  container: HTMLElement;
  rootStore: AvatarBotStore;
  i18nEngine: I18nEngine;
  initialMinimal: boolean;
  getUiDom: () => UiDom;
  getEngines: () => {
    brainEngine: BrainEngine | null;
    speechEngine: SpeechEngine | null;
    skinEngine: SkinEngine | null;
    toolsEngine: ToolsEngine | null;
  };
  handleUser: (text?: string) => Promise<void> | void;
  updateModelDropListeners?: (enabled: boolean) => void;
}

/**
 * Constructs and encapsulates the public AiAvatarWidget controller instance.
 */
export function createAvatarWidget({
  options,
  container,
  rootStore,
  i18nEngine,
  initialMinimal,
  getUiDom,
  getEngines,
  handleUser,
  updateModelDropListeners
}: CreateAvatarWidgetParams): AiAvatarWidget {
  const isIframe = options?.isIframe === true;

  const aiAvatarWidget: AiAvatarWidget & { _isMinimal: boolean } = {
    get options(): AvatarBotOptions {
      return options;
    },

    get DEFAULT_LLM_MODEL(): string {
      return DEFAULT_LLM_MODEL;
    },
    get STATE_MAP(): Record<string, string> {
      return STATE_MAP;
    },
    get ENGINE_MODE_MAP(): Record<string, string> {
      return ENGINE_MODE_MAP;
    },
    get AVATAR_MODE_MAP(): Record<string, string> {
      return AVATAR_MODE_MAP;
    },
    get FIT_MODE_MAP(): Record<string, string> {
      return FIT_MODE_MAP;
    },
    get BRAIN_ENGINE_TYPE_MAP(): Record<string, string> {
      return BRAIN_ENGINE_TYPE_MAP;
    },
    get BRAIN_FALLBACK_TYPE_MAP(): Record<string, string> {
      return BRAIN_FALLBACK_TYPE_MAP;
    },
    get AUTO_CONTINUE_MODE_MAP(): Record<string, string> {
      return AUTO_CONTINUE_MODE_MAP;
    },
    get LLM_FINISH_REASON_MAP(): Record<string, string> {
      return LLM_FINISH_REASON_MAP;
    },
    get FINISH_REASON_MAP(): Record<string, string> {
      return FINISH_REASON_MAP;
    },

    get container(): HTMLElement {
      return container;
    },

    get uiDom(): UiDom {
      return getUiDom();
    },

    get i18nEngine(): I18nEngine {
      return i18nEngine;
    },

    get toolsEngine(): ToolsEngine | null {
      return getEngines().toolsEngine;
    },

    get buildLLMMessages():
      | ((
          question?: string,
          engineType?: string,
          ...args: unknown[]
        ) => Promise<LLMMessage[]> | LLMMessage[])
      | undefined {
      const brain = getEngines().brainEngine;
      if (typeof brain?.buildLLMMessages === 'function') {
        return (question?: string, engineType?: string, ...args: unknown[]) =>
          brain.buildLLMMessages(question ?? '', engineType ?? '', ...args);
      }
      const brainRecord = brain as Record<string, unknown> | null;
      if (typeof brainRecord?.buildDefaultLLMMessages === 'function') {
        return (question?: string, engineType?: string, ...args: unknown[]) =>
          (
            brainRecord.buildDefaultLLMMessages as (
              q?: string,
              e?: string,
              ...rest: unknown[]
            ) => Promise<LLMMessage[]> | LLMMessage[]
          )(question, engineType, ...args);
      }
      return undefined;
    },

    get classifyEmotion(): ((text: string) => string) | undefined {
      return getEngines().brainEngine?.classifyEmotion;
    },

    get applyEmotionFromText(): ((text: string) => void) | undefined {
      return getEngines().brainEngine?.applyEmotionFromText;
    },

    get answerQuestion():
      | ((question: string) => Promise<string | void>)
      | undefined {
      return getEngines().brainEngine?.answerQuestion;
    },

    handleUser: (text?: string) => {
      return handleUser(text);
    },

    get isIframe(): boolean {
      return isIframe;
    },

    _isMinimal: initialMinimal,
    get isMinimal(): boolean {
      return this._isMinimal;
    },
    set isMinimal(newIsMinimal: boolean) {
      if (typeof newIsMinimal === 'boolean') {
        this._isMinimal = newIsMinimal;

        if (typeof this.onMinimalTrigger === 'function') {
          this.onMinimalTrigger(newIsMinimal, this);
        }

        if (newIsMinimal === false) {
          this.hiddenMinimalEl();
        } else {
          this.showMinimalEl();
        }
      }
    },
    showMinimalEl(): void {
      const skinEngine = getEngines().skinEngine;
      const uiDom = getUiDom();
      if (skinEngine?.stageEl instanceof HTMLElement) {
        skinEngine.stageEl.style.left = '100vw';
        skinEngine.stageEl.style.opacity = '0';
        skinEngine.stageEl.style.userSelect = 'none';
      }
      if (uiDom?.minimalEl instanceof HTMLElement) {
        uiDom.minimalEl.style.display = 'flex';
      }
    },
    hiddenMinimalEl(): void {
      const skinEngine = getEngines().skinEngine;
      const uiDom = getUiDom();
      if (skinEngine?.stageEl instanceof HTMLElement) {
        skinEngine.stageEl.style.left = '';
        skinEngine.stageEl.style.opacity = '1';
        skinEngine.stageEl.style.userSelect = 'auto';
      }
      if (uiDom?.minimalEl instanceof HTMLElement) {
        uiDom.minimalEl.style.display = 'none';
      }
    },

    get gender(): string {
      return rootStore.getState().gender;
    },
    set gender(newGender: string) {
      if (
        typeof newGender === 'string' &&
        newGender !== '' &&
        (Object.values(GENDER_MAP) as string[]).includes(newGender)
      ) {
        rootStore.setState({ gender: newGender });
      }
    },

    get brainGender(): string | null {
      return rootStore.getState().brainGender;
    },
    set brainGender(newBrainGender: string | null) {
      if (
        newBrainGender === null ||
        (typeof newBrainGender === 'string' &&
          newBrainGender !== '' &&
          (Object.values(GENDER_MAP) as string[]).includes(newBrainGender))
      ) {
        rootStore.setState({ brainGender: newBrainGender });
      }
    },

    get speechGender(): string | null {
      return rootStore.getState().speechGender;
    },
    set speechGender(newSpeechGender: string | null) {
      if (
        newSpeechGender === null ||
        (typeof newSpeechGender === 'string' &&
          newSpeechGender !== '' &&
          (Object.values(GENDER_MAP) as string[]).includes(newSpeechGender))
      ) {
        rootStore.setState({ speechGender: newSpeechGender });
      }
    },

    get skinGender(): string | null {
      return rootStore.getState().skinGender;
    },
    set skinGender(newSkinGender: string | null) {
      if (
        newSkinGender === null ||
        (typeof newSkinGender === 'string' &&
          newSkinGender !== '' &&
          (Object.values(GENDER_MAP) as string[]).includes(newSkinGender))
      ) {
        rootStore.setState({ skinGender: newSkinGender });
      }
    },

    get locale(): string {
      return typeof i18nEngine?.locale === 'string' && i18nEngine.locale !== ''
        ? i18nEngine.locale
        : rootStore.getState().locale;
    },
    set locale(newLocale: string) {
      if (typeof newLocale === 'string' && newLocale !== '') {
        if (
          i18nEngine !== null &&
          typeof i18nEngine === 'object' &&
          typeof i18nEngine.setLocale === 'function'
        ) {
          i18nEngine.setLocale(newLocale);
        } else {
          rootStore.setState({ locale: newLocale });
        }
      }
    },

    get availableModes(): string[] {
      const currentModes = rootStore.getState().modes || {};
      return Array.from(
        new Set([
          ...Object.values(AVATAR_MODE_MAP),
          ...Object.keys(currentModes)
        ])
      );
    },

    get avatarMode(): string {
      return rootStore.getState().avatarMode;
    },
    set avatarMode(targetAvatarMode: string) {
      if (typeof targetAvatarMode === 'string' && targetAvatarMode !== '') {
        const currentAvailableModes = this.availableModes;
        if (currentAvailableModes.includes(targetAvatarMode) === false) {
          throw new TypeError(
            `[ai-avatar-bot] Invalid avatarMode "${targetAvatarMode}". Expected one of: [${currentAvailableModes.join(', ')}].`
          );
        }
        rootStore.setState({ avatarMode: targetAvatarMode });
      }
    },

    get enableMemory(): boolean {
      const brain = getEngines().brainEngine;
      return (
        brain?.memory?.enabled ??
        rootStore.getState().enableMemory ??
        DEFAULT_ENABLE_MEMORY
      );
    },
    set enableMemory(newEnableMemory: boolean) {
      if (typeof newEnableMemory === 'boolean') {
        rootStore.setState({ enableMemory: newEnableMemory });
        const brain = getEngines().brainEngine;
        if (brain?.memory !== null && typeof brain?.memory === 'object') {
          brain.memory.enabled = newEnableMemory;
        }
      }
    },

    get enableAiProvider(): boolean {
      const brain = getEngines().brainEngine;
      return (
        brain?.enableAiProvider ??
        rootStore.getState().enableAiProvider ??
        false
      );
    },
    set enableAiProvider(newEnableAiProvider: boolean) {
      if (typeof newEnableAiProvider === 'boolean') {
        rootStore.setState({ enableAiProvider: newEnableAiProvider });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.enableAiProvider = newEnableAiProvider;
        }
      }
    },

    get preloadWebLLM(): boolean {
      const brain = getEngines().brainEngine;
      return (
        brain?.preloadWebLLM ?? rootStore.getState().preloadWebLLM ?? false
      );
    },
    set preloadWebLLM(newPreloadWebLLM: boolean) {
      if (typeof newPreloadWebLLM === 'boolean') {
        rootStore.setState({ preloadWebLLM: newPreloadWebLLM });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.preloadWebLLM = newPreloadWebLLM;
        }
      }
    },

    get autoFallbackWebLLM(): boolean {
      const brain = getEngines().brainEngine;
      return (
        brain?.autoFallbackWebLLM ??
        rootStore.getState().autoFallbackWebLLM ??
        true
      );
    },
    set autoFallbackWebLLM(newAutoFallbackWebLLM: boolean) {
      if (typeof newAutoFallbackWebLLM === 'boolean') {
        rootStore.setState({ autoFallbackWebLLM: newAutoFallbackWebLLM });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.autoFallbackWebLLM = newAutoFallbackWebLLM;
        }
      }
    },

    get enableAutoContinue(): boolean {
      const brain = getEngines().brainEngine;
      return (
        brain?.enableAutoContinue ??
        rootStore.getState().enableAutoContinue ??
        DEFAULT_ENABLE_AUTO_CONTINUE
      );
    },
    set enableAutoContinue(newEnableAutoContinue: boolean) {
      if (typeof newEnableAutoContinue === 'boolean') {
        rootStore.setState({ enableAutoContinue: newEnableAutoContinue });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.enableAutoContinue = newEnableAutoContinue;
        }
      }
    },

    get maxAutoContinuations(): number {
      const brain = getEngines().brainEngine;
      return (
        brain?.maxAutoContinuations ??
        rootStore.getState().maxAutoContinuations ??
        DEFAULT_MAX_AUTO_CONTINUATIONS
      );
    },
    set maxAutoContinuations(newMax: number) {
      if (
        typeof newMax === 'number' &&
        Number.isFinite(newMax) === true &&
        newMax > 0
      ) {
        rootStore.setState({ maxAutoContinuations: newMax });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.maxAutoContinuations = newMax;
        }
      }
    },

    get autoContinueMode(): AutoContinueMode {
      const brain = getEngines().brainEngine;
      return (
        brain?.autoContinueMode ??
        rootStore.getState().autoContinueMode ??
        DEFAULT_AUTO_CONTINUE_MODE
      );
    },
    set autoContinueMode(newMode: AutoContinueMode) {
      if (
        typeof newMode === 'string' &&
        (Object.values(AUTO_CONTINUE_MODE_MAP) as string[]).includes(
          newMode
        ) === true
      ) {
        rootStore.setState({ autoContinueMode: newMode });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.autoContinueMode = newMode;
        }
      }
    },

    get autoContinuePrompt(): string | ((...args: unknown[]) => string) | null {
      const brain = getEngines().brainEngine;
      return (
        brain?.autoContinuePrompt ??
        rootStore.getState().autoContinuePrompt ??
        null
      );
    },
    set autoContinuePrompt(
      newPrompt: string | ((...args: unknown[]) => string) | null
    ) {
      if (
        typeof newPrompt === 'string' ||
        typeof newPrompt === 'function' ||
        newPrompt === null
      ) {
        rootStore.setState({ autoContinuePrompt: newPrompt });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.autoContinuePrompt = newPrompt;
        }
      }
    },

    get enableModelDrop(): boolean {
      return rootStore.getState().enableModelDrop ?? DEFAULT_ENABLE_MODEL_DROP;
    },
    set enableModelDrop(newEnableModelDrop: boolean) {
      if (typeof newEnableModelDrop === 'boolean') {
        rootStore.setState({ enableModelDrop: newEnableModelDrop });
        if (typeof updateModelDropListeners === 'function') {
          updateModelDropListeners(newEnableModelDrop);
        }
      }
    },

    get enableEngineToggle(): boolean {
      return (
        rootStore.getState().enableEngineToggle ?? DEFAULT_ENABLE_ENGINE_TOGGLE
      );
    },
    set enableEngineToggle(newEnableEngineToggle: boolean) {
      if (typeof newEnableEngineToggle === 'boolean') {
        rootStore.setState({ enableEngineToggle: newEnableEngineToggle });
        const { skinEngine } = getEngines();
        initSkinModeChangeButton(
          aiAvatarWidget,
          skinEngine?.has2D === true,
          skinEngine?.has3D === true,
          newEnableEngineToggle
        );
      }
    },

    get brainEngine(): BrainEngine {
      return getEngines().brainEngine as BrainEngine;
    },
    get speechEngine(): SpeechEngine {
      return getEngines().speechEngine as SpeechEngine;
    },
    get skinEngine(): SkinEngine {
      return getEngines().skinEngine as SkinEngine;
    },

    get suggestedQuestions() {
      return rootStore.getState().suggestedQuestions;
    },
    set suggestedQuestions(newQuestions) {
      options.suggestedQuestions = newQuestions;
      rootStore.setState({ suggestedQuestions: newQuestions });
    },
    get companionSuggestedQuestions() {
      return rootStore.getState().companionSuggestedQuestions;
    },
    set companionSuggestedQuestions(newQuestions) {
      options.companionSuggestedQuestions = newQuestions;
      rootStore.setState({ companionSuggestedQuestions: newQuestions });
    },
    get assistantSuggestedQuestions() {
      return rootStore.getState().assistantSuggestedQuestions;
    },
    set assistantSuggestedQuestions(newQuestions) {
      options.assistantSuggestedQuestions = newQuestions;
      rootStore.setState({ assistantSuggestedQuestions: newQuestions });
    },
    get suggestedTitle() {
      return rootStore.getState().suggestedTitle;
    },
    set suggestedTitle(newTitle) {
      options.suggestedTitle = newTitle;
      rootStore.setState({ suggestedTitle: newTitle });
    },
    get companionSuggestedTitle() {
      return rootStore.getState().companionSuggestedTitle;
    },
    set companionSuggestedTitle(newTitle) {
      options.companionSuggestedTitle = newTitle;
      rootStore.setState({ companionSuggestedTitle: newTitle });
    },
    get assistantSuggestedTitle() {
      return rootStore.getState().assistantSuggestedTitle;
    },
    set assistantSuggestedTitle(newTitle) {
      options.assistantSuggestedTitle = newTitle;
      rootStore.setState({ assistantSuggestedTitle: newTitle });
    },

    setSuggestedQuestions(questions, title) {
      const updates: Record<string, unknown> = {};
      if (typeof questions !== 'undefined') {
        options.suggestedQuestions = questions;
        updates.suggestedQuestions = questions;
      }
      if (typeof title !== 'undefined') {
        options.suggestedTitle = title;
        updates.suggestedTitle = title;
      }
      rootStore.setState(updates);
    },

    renderSuggestions(): void {
      renderSuggestions(aiAvatarWidget);
    },

    setSkin2d(config: Partial<Skin2DConfig> = {}): void {
      const skin = getEngines().skinEngine;
      if (typeof skin?.setSkin2d === 'function') {
        skin.setSkin2d(config);
      }
    },

    setSkin3d(config: Partial<Skin3DConfig> = {}): void {
      const skin = getEngines().skinEngine;
      if (typeof skin?.setSkin3d === 'function') {
        skin.setSkin3d(config);
      }
    },

    setFitMode(fitMode: string): void {
      const skin = getEngines().skinEngine;
      if (typeof skin?.setFitMode === 'function') {
        skin.setFitMode(fitMode);
      }
    }
  };

  return aiAvatarWidget;
}
