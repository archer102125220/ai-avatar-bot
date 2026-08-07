import { initBrainEngine } from './brain';
import { initSkinEngine } from './skin';
import { initSpeechEngine } from './speech';
import {
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_AI_PROVIDER_MODEL,
  STATE_MAP,
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  GENDER_MAP,
  DEFAULT_GENDER,
  DEFAULT_TTS_ENDPOINT,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE
} from './constants';

import {
  initUi,
  renderHistory,
  renderSuggestions,
  bindTyping,
  bindUiEvent,
  initSkinModeChangeButton
} from './ui';
import { initToolsEngine } from './tools';
import { createBaseStore } from './store';

import '../style/style.scss';

export * from './constants';

export async function initAvatarBot(optiopns = {}) {
  if (typeof window !== 'object') {
    return;
  }

  function callOptionEvent(eventName, ...args) {
    if (typeof optiopns[eventName] === 'function') {
      return optiopns[eventName].call(this, ...args);
    }
  }

  const {
    container = null,
    aiProviderBaseUrl = '',
    aiProviderModel = DEFAULT_AI_PROVIDER_MODEL,
    aiProviderCreatedFetchSetting,
    aiProviderCreatedFetchPayload,
    aiProviderMaxTokens,
    aiProviderStream,
    neuralVoice = '',
    knowledgeUrl = '',
    companionKnowledgeUrl = '',
    modelUrl,
    ttsEndpoint = DEFAULT_TTS_ENDPOINT, // 沒設→試同站相對路徑；抓不到→自動退回瀏覽器語音（純前端可用）
    llmModel = DEFAULT_LLM_MODEL,
    avatarMode = DEFAULT_AVATAR_MODE,
    knowledge = null,
    companionKnowledge = null,
    startMode,
    fitMode,
    vrmUrl,
    gesture2D,
    isMinimal = false,
    isIframe = false,
    gender = '',
    companionFallback = []
  } = optiopns;

  if (container instanceof HTMLElement === false) {
    throw new Error('container must be an HTMLElement');
  }

  let safeGender = DEFAULT_GENDER;
  if (gender === GENDER_MAP.female || gender === GENDER_MAP.male) {
    safeGender = gender;
  }

  let safeNeuralVoice = neuralVoice;
  if (typeof neuralVoice !== 'string' || neuralVoice === '') {
    if (safeGender === GENDER_MAP.female) {
      safeNeuralVoice = DEFAULT_FEMALE_NEURAL_VOICE;
    } else {
      safeNeuralVoice = DEFAULT_MALE_NEURAL_VOICE;
    }
  }

  let initialMinimal = false;
  if (isIframe === true) {
    initialMinimal = false;
  } else if (isMinimal === true) {
    initialMinimal = true;
  }

  let uiDom = null;

  let brainEngine = null;
  let speechEngine = null;
  let skinEngine = null;
  let toolsEngine = null;

  const rootStore = createBaseStore({
    gender: safeGender,
    avatarMode: avatarMode || DEFAULT_AVATAR_MODE
  });

  const aiAvatarWidget = {
    get optiopns() {
      return optiopns;
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

    get container() {
      return container;
    },

    get uiDom() {
      return uiDom;
    },

    get toolsEngine() {
      return toolsEngine;
    },

    get classifyEmotion() {
      return aiAvatarWidget.brainEngine.classifyEmotion;
    },

    get setEmotionFromText() {
      return aiAvatarWidget.brainEngine.setEmotionFromText;
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
      this.skinEngine.stageEl.style.left = '100vw';
      this.skinEngine.stageEl.style.opacity = 0;
      this.skinEngine.stageEl.style.userSelect = 'none';
      // this.skinEngine.stageEl.style.display = "none";
      this.uiDom.minimalEl.style.display = 'flex';
    },
    hiddenMinimalEl() {
      this.skinEngine.stageEl.style.left = '';
      this.skinEngine.stageEl.style.opacity = 1;
      this.skinEngine.stageEl.style.userSelect = 'auto';
      // this.skinEngine.stageEl.style.display = "block";
      this.uiDom.minimalEl.style.display = 'none';
    },

    get gender() {
      return rootStore.getState().gender;
    },
    set gender(newGender = '') {
      if (Object.values(GENDER_MAP).includes(newGender)) {
        rootStore.setState({ gender: newGender });
      }
    },

    get avatarMode() {
      return rootStore.getState().avatarMode;
    },
    set avatarMode(newAvatarMode = '') {
      if (typeof newAvatarMode === 'string' && newAvatarMode !== '') {
        if (Object.values(AVATAR_MODE_MAP).includes(newAvatarMode)) {
          rootStore.setState({ avatarMode: newAvatarMode });
        } else {
          rootStore.setState({ avatarMode: AVATAR_MODE_MAP.assistant });
        }
      }
    },

    get brainEngine() {
      return brainEngine;
    },
    get speechEngine() {
      return speechEngine;
    },
    get skinEngine() {
      return skinEngine;
    }
  };

  rootStore.subscribe('gender', (newGender) => {
    aiAvatarWidget.speechEngine.setGender(newGender);
    aiAvatarWidget.skinEngine.setGender(newGender);
  });

  const stageEl = document.createElement('div');
  stageEl.setAttribute('id', 'stage');

  brainEngine = await initBrainEngine({
    llmModel,
    avatarMode,
    knowledgeUrl,
    companionKnowledgeUrl,
    knowledge,
    companionKnowledge,
    companionFallback,
    aiProviderBaseUrl,
    aiProviderModel,
    aiProviderCreatedFetchSetting,
    aiProviderCreatedFetchPayload,
    aiProviderMaxTokens,
    aiProviderStream,

    welcomeText: optiopns.welcomeText,
    companionWelcomeText: optiopns.companionWelcomeText,
    assistantWelcomeText: optiopns.assistantWelcomeText,

    onLlmLoading() {
      aiAvatarWidget.speechEngine.spokenDisplayText =
        '開始下載 AI 大腦（約 1GB，只需第一次）…';
      callOptionEvent.call(this, 'onLlmLoading');
    },
    onLlmLoadProgress(p) {
      uiDom.btnLlmEl.textContent =
        '🧠 ' + Math.round((p.progress || 0) * 100) + '%';
      callOptionEvent.call(this, 'onLlmLoadProgress', p);
    },
    onLlmLoaded() {
      uiDom.btnLlmEl.textContent = '🧠✓';
      uiDom.btnLlmEl.setAttribute('css-llm-on', 'true');
      aiAvatarWidget.speechEngine.spokenAudioText =
        'AI 大腦啟用完成，現在我可以聊得更自然囉！';
      aiAvatarWidget.speechEngine.spokenDisplayText =
        'AI 大腦啟用完成，現在我可以聊得更自然囉！';
      callOptionEvent.call(this, 'onLlmLoaded');
    },
    onLlmLoadError(error) {
      uiDom.btnLlmEl.textContent = '🧠✗';
      aiAvatarWidget.speechEngine.spokenDisplayText =
        'AI 大腦載入失敗：' + (error?.message || error);
      callOptionEvent.call(this, 'onLlmLoadError', error);
    },
    onAiProviderConnecting() {
      const btnLlmEl = uiDom.btnLlmEl;
      if (btnLlmEl instanceof HTMLElement) {
        btnLlmEl.textContent = '🧠…';
        btnLlmEl.title = 'AI 伺服器大腦（連線中）';
      }
      callOptionEvent.call(this, 'onAiProviderConnecting');
    },
    onAiProviderConnected(response, _fetchSetting, aiProvider) {
      const ok = response?.ok || false;
      const btnLlmEl = uiDom.btnLlmEl;

      if (btnLlmEl instanceof HTMLElement) {
        btnLlmEl.textContent = ok === true ? '🧠✓' : '🧠✗';
        if (ok === true) {
          btnLlmEl.setAttribute('css-llm-on', 'true');
        } else {
          btnLlmEl.removeAttribute('css-llm-on');
        }
        btnLlmEl.setAttribute('aria-pressed', String(ok === true));
        if (ok === true) {
          btnLlmEl.title = 'AI 伺服器：已連線 ' + aiProvider.model;
        } else {
          btnLlmEl.title = 'AI 伺服器連不上（檢查 AI 伺服器是否在跑 / CORS）';
        }
      }
      if (ok === true) {
        setTimeout(() => {
          aiAvatarWidget.speechEngine.spokenDisplayText =
            '已接上 AI 伺服器大腦（' +
            brainEngine.aiProvider.model +
            '）🧠 問我問題吧！';
        }, 1300);
      }
      callOptionEvent.call(
        this,
        'onAiProviderConnected',
        response,
        _fetchSetting,
        aiProvider
      );
    },
    onAddChatMessage(item) {
      if (
        aiAvatarWidget.uiDom.historyPanelEl?.getAttribute('css-is-open') ===
        'true'
      ) {
        renderHistory(aiAvatarWidget);
      }
      callOptionEvent.call(this, 'onAddChatMessage', item);
    },
    onUpdateChatMessage(item) {
      if (
        aiAvatarWidget.uiDom.historyPanelEl?.getAttribute('css-is-open') ===
        'true'
      ) {
        renderHistory(aiAvatarWidget);
      }
      callOptionEvent.call(this, 'onUpdateChatMessage', item);
    },
    onChatHistoryChanged(chatLog) {
      // 這邊可以讓開發者自行註冊或給未來的全域事件處理用
      callOptionEvent.call(this, 'onChatHistoryChanged', chatLog);
    },
    getSkin: () => skinEngine,
    getSpeech: () => speechEngine
  });

  speechEngine = initSpeechEngine({
    ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    neuralVoice: safeNeuralVoice,
    getGender: () => rootStore.getState().gender,
    greeting: optiopns.greeting,
    companionGreeting: optiopns.companionGreeting,
    assistantGreeting: optiopns.assistantGreeting,
    onSpokenDisplayTextChange(newSpeakingLabel) {
      uiDom.bubbleEl.textContent = newSpeakingLabel;
      uiDom.bubbleEl.setAttribute('css-is-show', 'true');
      callOptionEvent.call(this, 'onSpokenDisplayTextChange', newSpeakingLabel);
    },
    onSpokenDisplayTextTimeout() {
      uiDom.bubbleEl.removeAttribute('css-is-show');
      callOptionEvent.call(this, 'onSpokenDisplayTextTimeout');
    },
    onMicStateChanged(isListening, convoOn) {
      if (typeof uiDom.updateMicState === 'function') {
        const isCompanion = avatarMode === AVATAR_MODE_MAP.companion;
        uiDom.updateMicState(isListening, convoOn, isCompanion);
      }
      callOptionEvent.call(this, 'onMicStateChanged', isListening, convoOn);
    },
    onVoiceStatusChanged(convoOn, text, state, level) {
      if (typeof uiDom.updateVoiceStatus === 'function') {
        uiDom.updateVoiceStatus(convoOn, text, state, level);
      }
      callOptionEvent.call(
        this,
        'onVoiceStatusChanged',
        convoOn,
        text,
        state,
        level
      );
    },
    getSkin: () => skinEngine,
    getBrain: () => brainEngine,
    getTools: () => toolsEngine,
    getAvatarMode: () => avatarMode,
    getAvatarModel: () => skinEngine.avatarModel,
    setEmotionFromText: (text) => {
      if (typeof brainEngine?.setEmotionFromText === 'function') {
        brainEngine.setEmotionFromText(text);
      }
    },
    getContainer: () => container,
    onLanguageChanged(locale, localeLabel) {
      if (uiDom.langButtonEl instanceof HTMLButtonElement) {
        uiDom.langButtonEl.textContent = localeLabel;
      }
      callOptionEvent.call(this, 'onLanguageChanged', locale, localeLabel);
    }
  });

  toolsEngine = initToolsEngine({
    getBrain: () => brainEngine,
    getSpeech: () => speechEngine,
    onToolCall: (pending) => {
      callOptionEvent.call(this, 'onToolCall', pending, aiAvatarWidget);
    },
    onAddChatMessage(role, text, options) {
      callOptionEvent.call(this, 'onAddChatMessage', role, text, options);
      return brainEngine.addChatMessage(role, text, options);
    },
    onUpdateChatMessage(id, text, append) {
      callOptionEvent.call(this, 'onUpdateChatMessage', id, text, append);
      return brainEngine.updateChatMessage(id, text, append);
    },
    onSetHistoryOpen(isOpen) {
      if (uiDom.historyPanelEl instanceof HTMLElement) {
        if (isOpen === true) {
          uiDom.historyPanelEl.setAttribute('css-is-open', 'true');
        } else {
          uiDom.historyPanelEl.removeAttribute('css-is-open');
        }
        if (uiDom.historyPanelEl.getAttribute('css-is-open') === 'true') {
          renderHistory(aiAvatarWidget);
        }
      }
      callOptionEvent.call(this, 'onSetHistoryOpen', isOpen);
    },
    onRenderHistory() {
      renderHistory(aiAvatarWidget);
      callOptionEvent.call(this, 'onRenderHistory');
    },
    onSpeak(text) {
      speechEngine.speak(text);
      callOptionEvent.call(this, 'onSpeak', text);
    }
  });

  skinEngine = initSkinEngine({
    stageEl,
    modelUrl,
    startMode,
    fitMode,
    vrmUrl,
    gesture2D,
    get gender() {
      return rootStore.getState().gender;
    },
    computeMouth() {
      return aiAvatarWidget.speechEngine.computeMouth();
    },
    async onMounted() {
      aiAvatarWidget.speechEngine.spokenDisplayText =
        await aiAvatarWidget.brainEngine.getWelcomeText();
      if (typeof aiAvatarWidget.onReady === 'function') {
        aiAvatarWidget.onReady(aiAvatarWidget);
      }
    },
    onThreeDimensionalError(error) {
      if (typeof aiAvatarWidget.onError === 'function') {
        aiAvatarWidget.onError(error, aiAvatarWidget);
      }
      callOptionEvent.call(this, 'onThreeDimensionalError', error);
    },
    onTwoDimensionalError(error) {
      const directWarnEl = aiAvatarWidget?.uiDom?.directWarnEl;
      if (
        directWarnEl instanceof HTMLParagraphElement ||
        directWarnEl instanceof HTMLDivElement
      ) {
        directWarnEl.textContent = '2D 啟動失敗：' + (error?.message || error);
        directWarnEl.style.display = 'flex';
      }
      if (typeof aiAvatarWidget.onError === 'function') {
        aiAvatarWidget.onError(error, aiAvatarWidget);
      }
      callOptionEvent.call(this, 'onTwoDimensionalError', error);
    },
    VRMFileChangeFail(error) {
      console.error(error);
      aiAvatarWidget.speechEngine.spokenDisplayText = error.message;
      if (typeof aiAvatarWidget.onError === 'function') {
        aiAvatarWidget.onError(error, aiAvatarWidget);
      }
      callOptionEvent.call(this, 'VRMFileChangeFail', error);
    },
    VRMFileChangeSuccess() {
      const engineButtonEl = aiAvatarWidget?.uiDom?.engineButtonEl;

      // 換上後也顯示 2D/3D 切換鈕
      if (engineButtonEl instanceof HTMLElement) {
        engineButtonEl.style.display = '';
        if (typeof engineButtonEl.onclick !== 'function') {
          engineButtonEl.onclick = () => {
            if (
              aiAvatarWidget.skinEngine.engineMode ===
              ENGINE_MODE_MAP.threeDimensional
            ) {
              aiAvatarWidget.skinEngine.engineMode =
                ENGINE_MODE_MAP.twoDimensional;
            } else {
              aiAvatarWidget.skinEngine.engineMode =
                ENGINE_MODE_MAP.threeDimensional;
            }
          };
        }
      }
      speechEngine.spokenDisplayText = '換上你的角色了！🎭';
      callOptionEvent.call(this, 'VRMFileChangeSuccess');
    },
    onModelChangeStart(newEngineMode) {
      if (uiDom.engineButtonEl instanceof HTMLElement) {
        if (newEngineMode === ENGINE_MODE_MAP.threeDimensional) {
          uiDom.engineButtonEl.textContent = '3D';
        } else {
          uiDom.engineButtonEl.textContent = '2D';
        }
      }
      callOptionEvent.call(this, 'onModelChangeStart', newEngineMode);
    },
    onModelChangeEnd() {
      if (skinEngine.engineMode === ENGINE_MODE_MAP.threeDimensional) {
        uiDom.engineButtonEl.textContent = '3D';
      } else {
        uiDom.engineButtonEl.textContent = '2D';
      }

      skinEngine.avatarModel.on('hit', () => speechEngine.onTap());
      if (skinEngine.engineMode === ENGINE_MODE_MAP.threeDimensional) {
        skinEngine.renderer.canvas.addEventListener('pointerdown', () => {
          skinEngine.renderer.playGesture(
            skinEngine.renderer.TAP_GESTURES[
              Math.floor(
                Math.random() * skinEngine.renderer.TAP_GESTURES.length
              )
            ]
          );
          speechEngine.onTap();
        });
      } else {
        skinEngine.renderer.canvas.addEventListener('pointerdown', () =>
          speechEngine.onTap()
        );
      }
      callOptionEvent.call(this, 'onModelChangeEnd');
    }
  });

  uiDom = initUi(container, stageEl);

  // 初始化 UI 語音狀態
  uiDom.updateVoiceStatus(
    aiAvatarWidget.speechEngine.convoOn,
    '即時語音待命',
    '',
    0
  );

  document.addEventListener('visibilitychange', () => {
    if (
      document.hidden === true &&
      aiAvatarWidget.speechEngine.convoOn === true
    ) {
      aiAvatarWidget.speechEngine.stopVoiceSession(
        '頁面進入背景，即時語音已停止。'
      );
    }
  });

  if (typeof optiopns.onReady === 'function') {
    aiAvatarWidget.onReady = optiopns.onReady.bind(aiAvatarWidget);
  }

  if (typeof optiopns.buildLLMMessages === 'function') {
    aiAvatarWidget.buildLLMMessages =
      optiopns.buildLLMMessages.bind(aiAvatarWidget);
  } else {
    aiAvatarWidget.buildLLMMessages =
      aiAvatarWidget.brainEngine.defaultBuildLLMMessages.bind(aiAvatarWidget);
  }

  if (typeof optiopns.onMinimalTrigger === 'function') {
    aiAvatarWidget.onMinimalTrigger =
      optiopns.onMinimalTrigger.bind(aiAvatarWidget);
  }

  initSkinModeChangeButton(aiAvatarWidget, skinEngine.has2D, skinEngine.has3D);
  renderSuggestions(aiAvatarWidget);
  bindTyping(aiAvatarWidget);
  bindUiEvent(aiAvatarWidget);
  aiAvatarWidget.speechEngine.setMic(false); // 依模式套按鈕字樣（🎤 說話 / 💬 對話）

  ['dragenter', 'dragover'].forEach((eventName) =>
    container.addEventListener(eventName, (event) => {
      event.preventDefault();
    })
  );
  container.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event?.dataTransfer?.files?.[0];
    if (file instanceof window.File) {
      skinEngine.loadVRMFile(file);
    }
  });

  if (aiAvatarWidget.isIframe === true) {
    aiAvatarWidget.onMinimalTrigger(isMinimal, aiAvatarWidget);
    aiAvatarWidget.hiddenMinimalEl();
  } else {
    aiAvatarWidget.isMinimal = isMinimal;
  }

  return aiAvatarWidget;
}

export default initAvatarBot;
