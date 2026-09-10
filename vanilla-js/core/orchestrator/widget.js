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
  DEFAULT_ENABLE_MODEL_DROP
} from '../constants';

/**
 * 建立並封裝對外公開的 AiAvatarWidget 實例物件。
 *
 * @param {Object} params
 * @param {import('./types').AvatarBotOptions} params.options - 原始設定選項
 * @param {HTMLElement} params.container - Widget 根容器 DOM
 * @param {import('../store').BaseStore} params.rootStore - 狀態管理 Store
 * @param {any} params.i18nEngine - 多語系引擎實例
 * @param {boolean} params.initialMinimal - 初始是否為極簡模式
 * @param {() => any} params.getUiDom - 取得 UI DOM 物件的函式
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - 取得各引擎實例的函式
 * @param {(text: string) => Promise<void>|void} params.handleUser - 使用者輸入處理函式
 * @param {(enabled: boolean) => void} [params.updateModelDropListeners] - 更新模型拖曳換裝監聽器的函式
 * @returns {import('./types').AiAvatarWidget}
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
}) {
  const isIframe = options?.isIframe === true;

  const aiAvatarWidget = {
    get options() {
      return options;
    },

    get DEFAULT_LLM_MODEL() {
      return DEFAULT_LLM_MODEL;
    },
    get STATE_MAP() {
      return STATE_MAP;
    },
    get ENGINE_MODE_MAP() {
      return ENGINE_MODE_MAP;
    },
    get AVATAR_MODE_MAP() {
      return AVATAR_MODE_MAP;
    },
    get FIT_MODE_MAP() {
      return FIT_MODE_MAP;
    },
    get BRAIN_ENGINE_TYPE_MAP() {
      return BRAIN_ENGINE_TYPE_MAP;
    },
    get BRAIN_FALLBACK_TYPE_MAP() {
      return BRAIN_FALLBACK_TYPE_MAP;
    },
    get AUTO_CONTINUE_MODE_MAP() {
      return AUTO_CONTINUE_MODE_MAP;
    },
    get LLM_FINISH_REASON_MAP() {
      return LLM_FINISH_REASON_MAP;
    },
    get FINISH_REASON_MAP() {
      return FINISH_REASON_MAP;
    },

    get container() {
      return container;
    },

    get uiDom() {
      return getUiDom();
    },

    get i18nEngine() {
      return i18nEngine;
    },

    get toolsEngine() {
      return getEngines().toolsEngine;
    },

    get buildLLMMessages() {
      const brain = getEngines().brainEngine;
      return brain?.buildLLMMessages || brain?.buildDefaultLLMMessages;
    },

    get classifyEmotion() {
      return getEngines().brainEngine?.classifyEmotion;
    },

    get applyEmotionFromText() {
      return getEngines().brainEngine?.applyEmotionFromText;
    },

    get answerQuestion() {
      return getEngines().brainEngine?.answerQuestion;
    },

    handleUser: (text) => {
      return handleUser(text);
    },

    get isIframe() {
      return isIframe;
    },

    _isMinimal: initialMinimal,
    get isMinimal() {
      return this._isMinimal;
    },
    set isMinimal(newIsMinimal) {
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
    showMinimalEl() {
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
    hiddenMinimalEl() {
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

    get gender() {
      return rootStore.getState().gender;
    },
    set gender(newGender = '') {
      if (
        typeof newGender === 'string' &&
        newGender !== '' &&
        Object.values(GENDER_MAP).includes(newGender)
      ) {
        rootStore.setState({ gender: newGender });
      }
    },

    get brainGender() {
      return rootStore.getState().brainGender;
    },
    set brainGender(newBrainGender = null) {
      if (
        newBrainGender === null ||
        (typeof newBrainGender === 'string' &&
          newBrainGender !== '' &&
          Object.values(GENDER_MAP).includes(newBrainGender))
      ) {
        rootStore.setState({ brainGender: newBrainGender });
      }
    },

    get speechGender() {
      return rootStore.getState().speechGender;
    },
    set speechGender(newSpeechGender = null) {
      if (
        newSpeechGender === null ||
        (typeof newSpeechGender === 'string' &&
          newSpeechGender !== '' &&
          Object.values(GENDER_MAP).includes(newSpeechGender))
      ) {
        rootStore.setState({ speechGender: newSpeechGender });
      }
    },

    get skinGender() {
      return rootStore.getState().skinGender;
    },
    set skinGender(newSkinGender = null) {
      if (
        newSkinGender === null ||
        (typeof newSkinGender === 'string' &&
          newSkinGender !== '' &&
          Object.values(GENDER_MAP).includes(newSkinGender))
      ) {
        rootStore.setState({ skinGender: newSkinGender });
      }
    },

    get locale() {
      return typeof i18nEngine?.locale === 'string' && i18nEngine.locale !== ''
        ? i18nEngine.locale
        : rootStore.getState().locale;
    },
    set locale(newLocale = '') {
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

    get availableModes() {
      const currentModes = rootStore.getState().modes || {};
      return Array.from(
        new Set([
          ...Object.values(AVATAR_MODE_MAP),
          ...Object.keys(currentModes)
        ])
      );
    },

    get avatarMode() {
      return rootStore.getState().avatarMode;
    },
    set avatarMode(targetAvatarMode = '') {
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

    get enableMemory() {
      const brain = getEngines().brainEngine;
      return (
        brain?.memory?.enabled ??
        rootStore.getState().enableMemory ??
        DEFAULT_ENABLE_MEMORY
      );
    },
    set enableMemory(newEnableMemory) {
      if (typeof newEnableMemory === 'boolean') {
        rootStore.setState({ enableMemory: newEnableMemory });
        const brain = getEngines().brainEngine;
        if (brain?.memory !== null && typeof brain?.memory === 'object') {
          brain.memory.enabled = newEnableMemory;
        }
      }
    },

    get enableAiProvider() {
      const brain = getEngines().brainEngine;
      return (
        brain?.enableAiProvider ??
        rootStore.getState().enableAiProvider ??
        false
      );
    },
    set enableAiProvider(newEnableAiProvider) {
      if (typeof newEnableAiProvider === 'boolean') {
        rootStore.setState({ enableAiProvider: newEnableAiProvider });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.enableAiProvider = newEnableAiProvider;
        }
      }
    },

    get preloadWebLLM() {
      const brain = getEngines().brainEngine;
      return (
        brain?.preloadWebLLM ?? rootStore.getState().preloadWebLLM ?? false
      );
    },
    set preloadWebLLM(newPreloadWebLLM) {
      if (typeof newPreloadWebLLM === 'boolean') {
        rootStore.setState({ preloadWebLLM: newPreloadWebLLM });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.preloadWebLLM = newPreloadWebLLM;
        }
      }
    },

    get autoFallbackWebLLM() {
      const brain = getEngines().brainEngine;
      return (
        brain?.autoFallbackWebLLM ??
        rootStore.getState().autoFallbackWebLLM ??
        true
      );
    },
    set autoFallbackWebLLM(newAutoFallbackWebLLM) {
      if (typeof newAutoFallbackWebLLM === 'boolean') {
        rootStore.setState({ autoFallbackWebLLM: newAutoFallbackWebLLM });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.autoFallbackWebLLM = newAutoFallbackWebLLM;
        }
      }
    },

    get enableAutoContinue() {
      const brain = getEngines().brainEngine;
      return (
        brain?.enableAutoContinue ??
        rootStore.getState().enableAutoContinue ??
        DEFAULT_ENABLE_AUTO_CONTINUE
      );
    },
    set enableAutoContinue(newEnableAutoContinue) {
      if (typeof newEnableAutoContinue === 'boolean') {
        rootStore.setState({ enableAutoContinue: newEnableAutoContinue });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.enableAutoContinue = newEnableAutoContinue;
        }
      }
    },

    get maxAutoContinuations() {
      const brain = getEngines().brainEngine;
      return (
        brain?.maxAutoContinuations ??
        rootStore.getState().maxAutoContinuations ??
        DEFAULT_MAX_AUTO_CONTINUATIONS
      );
    },
    set maxAutoContinuations(newMax) {
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

    get autoContinueMode() {
      const brain = getEngines().brainEngine;
      return (
        brain?.autoContinueMode ??
        rootStore.getState().autoContinueMode ??
        DEFAULT_AUTO_CONTINUE_MODE
      );
    },
    set autoContinueMode(newMode) {
      if (
        typeof newMode === 'string' &&
        Object.values(AUTO_CONTINUE_MODE_MAP).includes(newMode) === true
      ) {
        rootStore.setState({ autoContinueMode: newMode });
        const brain = getEngines().brainEngine;
        if (brain !== null && typeof brain === 'object') {
          brain.autoContinueMode = newMode;
        }
      }
    },

    get autoContinuePrompt() {
      const brain = getEngines().brainEngine;
      return (
        brain?.autoContinuePrompt ??
        rootStore.getState().autoContinuePrompt ??
        null
      );
    },
    set autoContinuePrompt(newPrompt) {
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

    get enableModelDrop() {
      return rootStore.getState().enableModelDrop ?? DEFAULT_ENABLE_MODEL_DROP;
    },
    set enableModelDrop(newEnableModelDrop) {
      if (typeof newEnableModelDrop === 'boolean') {
        rootStore.setState({ enableModelDrop: newEnableModelDrop });
        if (typeof updateModelDropListeners === 'function') {
          updateModelDropListeners(newEnableModelDrop);
        }
      }
    },

    get brainEngine() {
      return getEngines().brainEngine;
    },
    get speechEngine() {
      return getEngines().speechEngine;
    },
    get skinEngine() {
      return getEngines().skinEngine;
    },

    get suggestedQuestions() {
      return options.suggestedQuestions;
    },
    get companionSuggestedQuestions() {
      return options.companionSuggestedQuestions;
    },
    get assistantSuggestedQuestions() {
      return options.assistantSuggestedQuestions;
    },
    get suggestedTitle() {
      return options.suggestedTitle;
    },
    get companionSuggestedTitle() {
      return options.companionSuggestedTitle;
    },
    get assistantSuggestedTitle() {
      return options.assistantSuggestedTitle;
    },

    setSkin2d(config = {}) {
      const skin = getEngines().skinEngine;
      if (typeof skin?.setSkin2d === 'function') {
        skin.setSkin2d(config);
      }
    },

    setSkin3d(config = {}) {
      const skin = getEngines().skinEngine;
      if (typeof skin?.setSkin3d === 'function') {
        skin.setSkin3d(config);
      }
    },

    setFitMode(fitMode) {
      const skin = getEngines().skinEngine;
      if (typeof skin?.setFitMode === 'function') {
        skin.setFitMode(fitMode);
      }
    }
  };

  return aiAvatarWidget;
}
