import { setEmotionFromText, defaultBuildLLMMessages } from './brain.js';
import { speak, computeMouth, onTap, stopVoiceSession, setMic, startListening, preloadTapGreeting, setLocale } from './speech/index.js';
import {
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_AI_PROVIDER_MODEL,
  STATE_MAP,
  classifyEmotion,
  scoreEntry,
  topK,
  getWelcomeText,
  initBrainEngine,
  addChatMessage,
  updateChatMessage
} from './brain';

import {
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  DEFALUT_START_MODE,
  DEFAULT_FIT_MODE,
  DEFAULT_FEMALE_MODEL_URL,
  DEFAULT_MALE_MODEL_URL,
  GENDER_MAP,
  DEFAULT_GENDER,
  DEFAULT_MODEL_URL,
  initSkinEngine
} from './skin';

import {
  DEFAULT_TTS_ENDPOINT,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE,
  prefetchSpeech,
  splitSentences,
  playBuffer,
  fetchTTSBuffer,
  handleNeuralFail,
  speakBrowserChunk,
  loadVoice,
  initSpeechEngine
} from './speech';

import { initUi, renderHistory, renderSuggestions, bindTyping, bindUiEvent, initSkinModeChangeButton } from './ui';
import { initToolsEngine } from './tools';

import '../style/style.scss';

// M4b：WebLLM（瀏覽器內跑小模型，零金鑰）。函式庫改成「按下🧠才動態 import」，
//    一般訪客（不啟用大腦）不會下載這包 JS。控制權掛到 window.LLM。

// speech.js
export const DEFAULT_NEURAL_VOICE =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_NEURAL_VOICE
    : DEFAULT_MALE_NEURAL_VOICE;

export {
  STATE_MAP,
  AVATAR_MODE_MAP,
  DEFAULT_LLM_MODEL,
  DEFAULT_AI_PROVIDER_MODEL,
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  GENDER_MAP,
  DEFAULT_GENDER,
  DEFALUT_START_MODE,
  DEFAULT_AVATAR_MODE,
  DEFAULT_FIT_MODE,
  DEFAULT_MODEL_URL,
  DEFAULT_FEMALE_MODEL_URL,
  DEFAULT_MALE_MODEL_URL,
  DEFAULT_TTS_ENDPOINT,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE
};



// ui.js | history logic






// Tool router core logic



// brain.js | speech.js


// ui.js
// 切換用：兩個皮都給(data-model + data-vrm) → 長出 2D/3D 切換鈕。
// 預設引擎：data-engine 優先；否則有明確 2D 皮就 2D、只有 3D 就 3D。


// skin.js | speech.js
// 思索很久，考量到計算嘴型的位置是在 skin.js 中的一個動畫循環位置
// 而計算所需的核心數值卻是在 speech.js 中，因此放在整合檔內是目前的最佳解
// ===== 共用：每幀算出嘴巴開合 0..1（2D 寫 ParamMouthOpenY、3D 寫 aa 表情，共用同一套計算）=====
// ui.js


// index.js
export async function initAvatarBot(optiopns = {}) {
  if (typeof window !== 'object') return;

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

  const safeGender =
    gender === GENDER_MAP.female || gender === GENDER_MAP.male
      ? gender
      : DEFAULT_GENDER;
  const safeNeuralVoice =
    neuralVoice ||
    (safeGender === GENDER_MAP.female
      ? DEFAULT_FEMALE_NEURAL_VOICE
      : DEFAULT_MALE_NEURAL_VOICE);

  let uiDom = null;

  let brainEngine = null;
  let speechEngine = null;
  let skinEngine = null;
  let toolsEngine = null;

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
      return classifyEmotion;
    },

    get setEmotionFromText() {
      return function _setEmotionFromText(...args) {
        return setEmotionFromText(this, ...args);
      };
    },

    get isIframe() {
      return isIframe;
    },

    _isMinimal: isIframe === true ? false : isMinimal || false,
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

    _gender: safeGender,
    get gender() {
      return this._gender;
    },
    set gender(newGender = '') {
      if (Object.values(GENDER_MAP).includes(newGender)) {
        this._gender = newGender;
        if (newGender === GENDER_MAP.female) {
          this.speechEngine.neuralVoice = DEFAULT_FEMALE_NEURAL_VOICE;
          this.skinEngine.modelUrl = DEFAULT_FEMALE_MODEL_URL;
        } else if (newGender === GENDER_MAP.male) {
          this.speechEngine.neuralVoice = DEFAULT_MALE_NEURAL_VOICE;
          this.skinEngine.modelUrl = DEFAULT_MALE_MODEL_URL;
        }
      }
    },

    _avatarMode: avatarMode || DEFAULT_AVATAR_MODE,
    get avatarMode() {
      return this._avatarMode;
    },
    set avatarMode(newAvatarMode = '') {
      if (typeof newAvatarMode === 'string' && newAvatarMode !== '') {
        if (Object.values(AVATAR_MODE_MAP).includes(newAvatarMode)) {
          this._avatarMode = newAvatarMode;
        } else {
          this._avatarMode = AVATAR_MODE_MAP.assistant;
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

  const stageEl = document.createElement('div');
  stageEl.setAttribute('id', 'stage');

  brainEngine = await initBrainEngine(
    {
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
      },
      onLlmLoadProgress(p) {
        uiDom.btnLlmEl.textContent =
          '🧠 ' + Math.round((p.progress || 0) * 100) + '%';
      },
      onLlmLoaded() {
        uiDom.btnLlmEl.textContent = '🧠✓';
        uiDom.btnLlmEl.setAttribute('css-llm-on', 'true');
        aiAvatarWidget.speechEngine.spokenAudioText =
          'AI 大腦啟用完成，現在我可以聊得更自然囉！';
        aiAvatarWidget.speechEngine.spokenDisplayText =
          'AI 大腦啟用完成，現在我可以聊得更自然囉！';
      },
      onLlmLoadError(error) {
        uiDom.btnLlmEl.textContent = '🧠✗';
        aiAvatarWidget.speechEngine.spokenDisplayText =
          'AI 大腦載入失敗：' + (error?.message || error);
      },
      onAiProviderConnecting() {
        const btnLlmEl = uiDom.btnLlmEl;
        if (btnLlmEl instanceof HTMLElement) {
          btnLlmEl.textContent = '🧠…';
          btnLlmEl.title = 'AI 伺服器大腦（連線中）';
        }
      },
      onAiProviderConnected(response, _fetchSetting, aiProvider) {
        const ok = response?.ok || false;
        const btnLlmEl = uiDom.btnLlmEl;

        if (btnLlmEl instanceof HTMLElement) {
          btnLlmEl.textContent = ok ? '🧠✓' : '🧠✗';
          if (ok) {
            btnLlmEl.setAttribute('css-llm-on', 'true');
          } else {
            btnLlmEl.removeAttribute('css-llm-on');
          }
          btnLlmEl.setAttribute('aria-pressed', String(ok));
          btnLlmEl.title = ok
            ? 'AI 伺服器：已連線 ' + aiProvider.model
            : 'AI 伺服器連不上（檢查 AI 伺服器是否在跑 / CORS）';
        }
        if (ok === true) {
          setTimeout(() => {
            aiAvatarWidget.speechEngine.spokenDisplayText =
              '已接上 AI 伺服器大腦（' +
              aiAvatarWidget.brainEngine.aiProvider.model +
              '）🧠 問我問題吧！';
          }, 1300);
        }
      },
      onAddChatMessage(item) {
        if (aiAvatarWidget.uiDom.historyPanelEl?.getAttribute('css-is-open') === 'true') {
          renderHistory(aiAvatarWidget);
        }
      },
      onUpdateChatMessage(item) {
        if (aiAvatarWidget.uiDom.historyPanelEl?.getAttribute('css-is-open') === 'true') {
          renderHistory(aiAvatarWidget);
        }
      },
      onChatHistoryChanged(chatLog) {
        // 這邊可以讓開發者自行註冊或給未來的全域事件處理用
      }
    },
    aiAvatarWidget
  );

  speechEngine = initSpeechEngine(
    {
      ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
      neuralVoice: safeNeuralVoice,
      greeting: optiopns.greeting,
      companionGreeting: optiopns.companionGreeting,
      assistantGreeting: optiopns.assistantGreeting,
      onSpokenDisplayTextChange(newSpeakingLabel) {
        uiDom.bubbleEl.textContent = newSpeakingLabel;
        uiDom.bubbleEl.setAttribute('css-is-show', 'true');
      },
      onSpokenDisplayTextTimeout() {
        uiDom.bubbleEl.removeAttribute('css-is-show');
      },
      onMicStateChanged(isListening, convoOn) {
        if (uiDom.updateMicState) {
          const isCompanion = aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion;
          uiDom.updateMicState(isListening, convoOn, isCompanion);
        }
      },
      onVoiceStatusChanged(convoOn, text, state, level) {
        if (uiDom.updateVoiceStatus) {
          uiDom.updateVoiceStatus(convoOn, text, state, level);
        }
      },
      onLanguageChanged(locale, localeLabel) {
        if (uiDom.langButtonEl) {
          uiDom.langButtonEl.textContent = localeLabel;
        }
      },

      // TODO: 待 speak 與其他方法耦合拆解完後改為直接放到 speech.js 檔案中
      speak
    },
    aiAvatarWidget
  );

  toolsEngine = initToolsEngine(
    {
      onAddChatMessage(role, text, options) {
        return addChatMessage(aiAvatarWidget, role, text, options);
      },
      onUpdateChatMessage(id, text, append) {
        return updateChatMessage(aiAvatarWidget, id, text, append);
      },
      onSetHistoryOpen(isOpen) {
        if (uiDom.historyPanelEl) {
          if (isOpen) {
            uiDom.historyPanelEl.setAttribute('css-is-open', 'true');
          } else {
            uiDom.historyPanelEl.removeAttribute('css-is-open');
          }
          if (uiDom.historyPanelEl.getAttribute('css-is-open') === 'true') {
            renderHistory(aiAvatarWidget);
          }
        }
      },
      onRenderHistory() {
        renderHistory(aiAvatarWidget);
      },
      onSpeak(text) {
        aiAvatarWidget.speechEngine.speak(text);
      }
    },
    aiAvatarWidget
  );

  skinEngine = initSkinEngine(
    {
      stageEl,
      modelUrl,
      startMode,
      fitMode,
      vrmUrl,
      gesture2D,
      get gender() {
        return aiAvatarWidget.gender;
      },
      computeMouth() {
        return computeMouth(aiAvatarWidget);
      },
      async onMounted() {
        aiAvatarWidget.speechEngine.spokenDisplayText =
          await getWelcomeText(aiAvatarWidget);
        if (typeof aiAvatarWidget.onReady === 'function') {
          aiAvatarWidget.onReady(aiAvatarWidget);
        }
      },
      onThreeDimensionalError(error) {
        if (typeof aiAvatarWidget.onError === 'function') {
          aiAvatarWidget.onError(error, aiAvatarWidget);
        }
      },
      onTwoDimensionalError(error) {
        const directWarnEl = aiAvatarWidget?.uiDom?.directWarnEl;
        if (
          directWarnEl instanceof HTMLParagraphElement ||
          directWarnEl instanceof HTMLDivElement
        ) {
          directWarnEl.textContent =
            '2D 啟動失敗：' + (error?.message || error);
          directWarnEl.style.display = 'flex';
        }
        if (typeof aiAvatarWidget.onError === 'function') {
          aiAvatarWidget.onError(error, aiAvatarWidget);
        }
      },
      VRMFileChangeFail(error) {
        console.error(error);
        aiAvatarWidget.speechEngine.spokenDisplayText = error.message;
        if (typeof aiAvatarWidget.onError === 'function') {
          aiAvatarWidget.onError(error, aiAvatarWidget);
        }
      },
      VRMFileChangeSuccess() {
        const engineButtonEl = aiAvatarWidget?.uiDom?.engineButtonEl;

        // 換上後也顯示 2D/3D 切換鈕
        if (engineButtonEl instanceof HTMLElement) {
          engineButtonEl.style.display = '';
          if (typeof engineButtonEl.onclick !== 'function') {
            engineButtonEl.onclick = () => {
              aiAvatarWidget.skinEngine.engineMode =
                ENGINE_MODE_MAP.threeDimensional
                  ? ENGINE_MODE_MAP.twoDimensional
                  : ENGINE_MODE_MAP.threeDimensional;
            };
          }
        }
        aiAvatarWidget.speechEngine.spokenDisplayText = '換上你的角色了！🎭';
      },
      onModelChange(newEngineMode) {
        if (aiAvatarWidget.uiDom?.engineButtonEl instanceof HTMLElement) {
          aiAvatarWidget.uiDom.engineButtonEl.textContent =
            newEngineMode === ENGINE_MODE_MAP.threeDimensional ? '3D' : '2D';
        }
      },
      onModelChangeEnd() {
        aiAvatarWidget.uiDom.engineButtonEl.textContent =
          aiAvatarWidget.skinEngine.engineMode ===
          ENGINE_MODE_MAP.threeDimensional
            ? '3D'
            : '2D';

        aiAvatarWidget.skinEngine.avatarModel.on('hit', () =>
          onTap(aiAvatarWidget)
        );
        if (
          aiAvatarWidget.skinEngine.engineMode ===
          ENGINE_MODE_MAP.threeDimensional
        ) {
          aiAvatarWidget.skinEngine.renderer.canvas.addEventListener(
            'pointerdown',
            () => {
              aiAvatarWidget.skinEngine.renderer.playGesture(
                aiAvatarWidget.skinEngine.renderer.TAP_GESTURES[
                  Math.floor(
                    Math.random() *
                      aiAvatarWidget.skinEngine.renderer.TAP_GESTURES.length
                  )
                ]
              );
              onTap(aiAvatarWidget);
            }
          );
        } else {
          aiAvatarWidget.skinEngine.renderer.canvas.addEventListener(
            'pointerdown',
            () => onTap(aiAvatarWidget)
          );
        }
      }
    },
    aiAvatarWidget
  );

  uiDom = initUi(container, stageEl);

  // 初始化 UI 語音狀態
  uiDom.updateVoiceStatus(
    aiAvatarWidget.speechEngine.convoOn,
    '即時語音待命',
    '',
    0
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && aiAvatarWidget.speechEngine.convoOn) {
      stopVoiceSession(aiAvatarWidget, '頁面進入背景，即時語音已停止。');
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
      defaultBuildLLMMessages.bind(aiAvatarWidget);
  }

  if (typeof optiopns.onMinimalTrigger === 'function') {
    aiAvatarWidget.onMinimalTrigger =
      optiopns.onMinimalTrigger.bind(aiAvatarWidget);
  }

  initSkinModeChangeButton(
    aiAvatarWidget,
    skinEngine.has2D,
    skinEngine.has3D
  );
  renderSuggestions(aiAvatarWidget);
  bindTyping(aiAvatarWidget);
  bindUiEvent(aiAvatarWidget);
  setMic(aiAvatarWidget, false); // 依模式套按鈕字樣（🎤 說話 / 💬 對話）

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

