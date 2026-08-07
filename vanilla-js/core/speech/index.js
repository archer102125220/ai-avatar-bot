// TODO: 等到環境可以測試麥克風跟喇叭時，要徹底測過這份檔案內部的所有機制有沒有因為重構而出問題
import {
  DEFAULT_TTS_ENDPOINT,
  GENDER_MAP,
  AVATAR_MODE_MAP,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE
} from '../constants';
import { createBaseStore } from '../store';
import {
  loadVoice,
  fetchTTSBuffer,
  computeMouth,
  drainSentences,
  stopSpeaking,
  speak,
  beginSpeech,
  pushSpeech,
  endSpeech,
  onUtteranceEnd,
  pumpSpeech,
  preloadTapGreeting,
  setLocale
} from './tts.js';
import {
  setMic,
  stopVoiceSession,
  interruptForVoice,
  startListening
} from './stt.js';

export async function handleUser(speechEngine, text = '') {
  const rootContainer = speechEngine.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error('[aiAvatar handleUser] rootContainer is not an HTMLElement');
    return;
  }

  if (typeof text === 'string' && text !== '') {
    speechEngine.brain.addChatMessage('user', text);
    speechEngine.spokenDisplayText = '你：' + text;
  }

  if (
    text !== '' &&
    typeof speechEngine.tools.pendingToolConfirmation === 'string' &&
    speechEngine.tools.pendingToolConfirmation !== '' &&
    speechEngine.tools.continueToolConfirmation(text)
  ) {
    return;
  }
  if (
    text !== '' &&
    typeof speechEngine.tools.pendingToolChoice === 'object' &&
    speechEngine.tools.pendingToolChoice !== null &&
    speechEngine.tools.continueToolChoice(text)
  ) {
    return;
  }
  if (
    text !== '' &&
    typeof speechEngine.tools.pendingToolInput === 'object' &&
    speechEngine.tools.pendingToolInput !== null &&
    speechEngine.tools.continueToolInput(text)
  ) {
    return;
  }

  if (speechEngine.brain.mem.isCompanion === true && text !== '') {
    if (/忘記我|清除記憶|forget me/i.test(text) === true) {
      speechEngine.brain.mem.wipe();
      speechEngine.spokenAudioText = '好，我把記憶都清掉了，我們重新認識吧！';
      return;
    }
    speechEngine.brain.mem.captureName(text);
    speechEngine.brain.mem.addTurn('user', text);
  }

  const routedTool = speechEngine.tools.routeHostTool(text);
  if (
    Array.isArray(routedTool.ambiguous) === true &&
    routedTool.ambiguous.length > 0
  ) {
    speechEngine.isProcessing = false;
    speechEngine.tools.offerToolChoices(text, routedTool.ambiguous);
    return;
  }
  if (typeof routedTool.match === 'object' && routedTool.match !== null) {
    speechEngine.isProcessing = false;
    speechEngine.tools.prepareTool(
      routedTool.match.tool,
      text,
      { confidence: routedTool.match.score, reason: routedTool.match.reason },
      {}
    );
    return;
  }

  // speechEngine.isSpeaking = true;
  speechEngine.isProcessing = true; // 回答完成前不要自動重開麥（onUtteranceEnd 會清）

  if (
    typeof speechEngine.skin === 'object' &&
    speechEngine.skin !== null &&
    speechEngine.skin.gestureName !== undefined
  ) {
    speechEngine.skin.gestureName = 'thinking';
  }

  speechEngine.brain.handleAnswer(text);
}

export function onTap(speechEngine) {
  if (speechEngine.onTapTimer === true) {
    return; // 去抖：hit 事件與 pointerdown 可能同時觸發
  }
  speechEngine.onTapTimer = true;
  setTimeout(() => {
    speechEngine.onTapTimer = false;
  }, 400);
  if (
    typeof speechEngine.skin.avatarModel === 'object' &&
    speechEngine.skin.avatarModel !== null
  ) {
    try {
      speechEngine.skin.avatarModel.motion('Tap');
    } catch (_error) {}
  }

  let greeting = '你好～';

  if (typeof speechEngine.greeting === 'function') {
    greeting = speechEngine.greeting({
      isCompanion: speechEngine.brain.mem.isCompanion,
      visits: speechEngine.brain.mem.data.visits,
      name: speechEngine.brain.mem.data.name
    });
  } else if (typeof speechEngine.greeting === 'string') {
    greeting = speechEngine.greeting;
  } else if (speechEngine.avatarMode === AVATAR_MODE_MAP.companion) {
    greeting =
      (typeof speechEngine.brain.mem.data.name === 'string' &&
      speechEngine.brain.mem.data.name !== ''
        ? speechEngine.brain.mem.data.name + '～'
        : '你好～') + '想聊什麼都可以，點 💬 我們就開始！';

    if (typeof speechEngine.companionGreeting === 'function') {
      greeting = speechEngine.companionGreeting({
        isCompanion: speechEngine.brain.mem.isCompanion,
        visits: speechEngine.brain.mem.data.visits,
        name: speechEngine.brain.mem.data.name
      });
    } else if (typeof speechEngine.companionGreeting === 'string') {
      greeting = speechEngine.companionGreeting;
    }
  } else if (speechEngine.avatarMode === AVATAR_MODE_MAP.assistant) {
    greeting =
      '你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！';

    if (typeof speechEngine.assistantGreeting === 'function') {
      greeting = speechEngine.assistantGreeting({
        isCompanion: speechEngine.brain.mem.isCompanion,
        visits: speechEngine.brain.mem.data.visits,
        name: speechEngine.brain.mem.data.name
      });
    } else if (typeof speechEngine.assistantGreeting === 'string') {
      greeting = speechEngine.assistantGreeting;
    }
  }

  speechEngine.spokenAudioText = greeting;
}

export function initSpeechEngine(setting = {}) {
  const { ttsEndpoint, neuralVoice } = setting;

  const store = createBaseStore({
    isSpeaking: false,
    isListening: false
  });

  const speechEngine = {
    subscribe: store.subscribe,
    getState: store.getState,
    setState: store.setState,

    get skin() {
      return setting.getSkin ? setting.getSkin() : null;
    },
    get brain() {
      return setting.getBrain ? setting.getBrain() : null;
    },
    get avatarModel() {
      return setting.getAvatarModel ? setting.getAvatarModel() : null;
    },
    get tools() {
      return setting.getTools ? setting.getTools() : null;
    },
    _gender: setting.getGender ? setting.getGender() : GENDER_MAP.female,
    get gender() {
      return this._gender;
    },
    setGender(newGender) {
      this._gender = newGender;
      if (newGender === GENDER_MAP.female) {
        this.neuralVoice = DEFAULT_FEMALE_NEURAL_VOICE;
      } else if (newGender === GENDER_MAP.male) {
        this.neuralVoice = DEFAULT_MALE_NEURAL_VOICE;
      }
      this.ttVoice = null;
    },
    get avatarMode() {
      return setting.getAvatarMode ? setting.getAvatarMode() : null;
    },
    get setEmotionFromText() {
      return setting.setEmotionFromText;
    },
    get container() {
      return setting.getContainer ? setting.getContainer() : null;
    },
    onVoiceStatusChanged: setting.onVoiceStatusChanged,
    onMicStateChanged: setting.onMicStateChanged,
    onLanguageChanged: setting.onLanguageChanged,

    _mouthTarget: 0.7, // 可能要歸在 skin ?
    get mouthTarget() {
      return this._mouthTarget;
    },
    set mouthTarget(newMouthTarget) {
      if (typeof newMouthTarget === 'number' || newMouthTarget === null) {
        this._mouthTarget = newMouthTarget;
      }
    },

    _mouthValue: 0, // 可能要歸在 skin ?
    get mouthValue() {
      return this._mouthValue;
    },
    set mouthValue(newMouthValue) {
      if (typeof newMouthValue === 'number' || newMouthValue === null) {
        this._mouthValue = newMouthValue;
      }
    },

    _speakSeq: 0,
    get speakSeq() {
      return this._speakSeq;
    },
    set speakSeq(newSpeakSeq) {
      if (typeof newSpeakSeq === 'number' || newSpeakSeq === null) {
        this._speakSeq = newSpeakSeq;
      }
    },

    get fetchTTSBuffer() {
      return function _fetchTTSBuffer() {
        return fetchTTSBuffer(speechEngine, ...arguments);
      };
    },

    // ②逐句開講的佇列狀態（var：這檔案有「宣告前就被呼叫」的前例，避 TDZ）
    speechQ: [],
    speechEnded: false,
    isSpeechPlaying: false,
    tapDone: false,

    speakBrowserTimer: 0,
    spokenDisplayTextTimer: 0,

    // 控制「點第二下打斷第一下」
    _currentFps: 0,
    get currentFps() {
      return this._currentFps;
    },
    set currentFps(newCurrentFps) {
      if (typeof newCurrentFps === 'number' || newCurrentFps === null) {
        this._currentFps = newCurrentFps;
      }
    },

    _currentSource: null,
    get currentSource() {
      return this._currentSource;
    },
    set currentSource(newCurrentSource) {
      if (typeof newCurrentSource === 'object') {
        this._currentSource = newCurrentSource;
      }
    },

    get isSpeaking() {
      return store.getState().isSpeaking;
    },
    set isSpeaking(newIsSpeaking) {
      if (typeof newIsSpeaking === 'boolean' || newIsSpeaking === null) {
        store.setState({ isSpeaking: newIsSpeaking });
      }
    },

    _useAudioMouth: false,
    get useAudioMouth() {
      return this._useAudioMouth;
    },
    set useAudioMouth(newUseAudioMouth) {
      if (typeof newUseAudioMouth === 'boolean' || newUseAudioMouth === null) {
        this._newUseAudioMouth = newUseAudioMouth;
      }
    },

    _audioMouth: 0,
    get audioMouth() {
      return this._audioMouth;
    },
    set audioMouth(newAudioMouth) {
      if (typeof newAudioMouth === 'number' || newAudioMouth === null) {
        this._audioMouth = newAudioMouth;
      }
    },

    _ttsMuted: false,
    get ttsMuted() {
      return this._ttsMuted;
    },
    set ttsMuted(newTtsMuted) {
      if (typeof newTtsMuted === 'boolean' || newTtsMuted === null) {
        this._ttsMuted = newTtsMuted;
      }
    },

    // 連續對話（陪伴模式）：她講完 → 自動重開麥。她講話期間不開麥（會聽到自己的聲音）
    convoOn: false,
    noSpeechRuns: 0,

    get isListening() {
      return store.getState().isListening;
    },
    set isListening(newIsListening) {
      if (typeof newIsListening === 'boolean' || newIsListening === null) {
        store.setState({ isListening: newIsListening });
      }
    },

    // 抓不到神經語音後端就鎖定瀏覽器語音，避免每句打 404
    _neuralDisabled: false,
    get neuralDisabled() {
      return this._neuralDisabled;
    },
    set neuralDisabled(newNeuralDisabled) {
      if (
        typeof newNeuralDisabled === 'boolean' ||
        newNeuralDisabled === null
      ) {
        this._neuralDisabled = newNeuralDisabled;
      }
    },

    _audioCtx: null,
    get audioCtx() {
      return this._audioCtx;
    },
    set audioCtx(newAudioCtx = null) {
      if (typeof newAudioCtx === 'object') {
        this._audioCtx = newAudioCtx;
      }
    },

    _ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    get ttsEndpoint() {
      return this._ttsEndpoint;
    },
    set ttsEndpoint(newTtsEndpoint = '') {
      if (typeof newTtsEndpoint === 'string' && newTtsEndpoint !== '') {
        this._ttsEndpoint = newTtsEndpoint;
      }
    },

    _neuralVoice: neuralVoice,
    get neuralVoice() {
      return this._neuralVoice; // 神經語音
    },
    set neuralVoice(newNeuralVoice = '') {
      if (typeof newNeuralVoice === 'string' || newNeuralVoice === null) {
        this._neuralVoice = newNeuralVoice;
      }
    },

    _ttVoice: null,
    get ttVoice() {
      return this._ttVoice;
    },
    set ttVoice(newTtVoice) {
      if (typeof newTtVoice === 'object') {
        this._ttVoice = newTtVoice;
      }
    },

    _ttsRate: 1.0,
    get ttsRate() {
      return this._ttsRate;
    },
    set ttsRate(newTtsRate) {
      if (typeof newTtsRate === 'number' || newTtsRate === null) {
        this._ttsRate = newTtsRate;
      }
    },

    _spokenDisplayText: '',
    get spokenDisplayText() {
      return this._spokenDisplayText;
    },
    set spokenDisplayText(newSpeakingLabel) {
      if (typeof newSpeakingLabel === 'string' || newSpeakingLabel === null) {
        this._spokenDisplayText = newSpeakingLabel;

        if (typeof this.onSpokenDisplayTextChange === 'function') {
          this.onSpokenDisplayTextChange(newSpeakingLabel);
        }
      }
    },
    speak: (text, options) =>
      speak(speechEngine, String(text || '').slice(0, 600), options),
    _spokenAudioText: '',
    get spokenAudioText() {
      return this._spokenAudioText;
    },
    set spokenAudioText(newSpeakingSounds) {
      if (typeof newSpeakingSounds === 'string' || newSpeakingSounds === null) {
        this._spokenAudioText = newSpeakingSounds;

        this.spokenDisplayText = newSpeakingSounds;
        if (typeof this.onSpeaking === 'function') {
          this.onSpeaking(newSpeakingSounds);
        }
        this.speak(newSpeakingSounds);
      }
    },

    _recognition: null,
    get recognition() {
      return this._recognition;
    },
    set recognition(newRecognition) {
      if (typeof newRecognition === 'object') {
        this._recognition = newRecognition;
      }
    },

    get onSpeaking() {
      return function _onSpeaking(text, ...args) {
        if (typeof setting.onSpeaking === 'function') {
          return setting.onSpeaking(text, ...args);
        }
      };
    },
    get onSpeakingEnd() {
      return function _onSpeakingEnd(text, ...args) {
        if (typeof setting.onSpeakingEnd === 'function') {
          return setting.onSpeakingEnd(text, ...args);
        }
      };
    },
    get onSpokenDisplayTextChange() {
      return function _onSpokenDisplayTextChange(newSpeakingLabel, ...args) {
        clearTimeout(this.spokenDisplayTextTimer);
        this.spokenDisplayTextTimer = setTimeout(
          () => this.onSpokenDisplayTextTimeout(),
          6000
        );

        if (typeof setting.onSpokenDisplayTextChange === 'function') {
          return setting.onSpokenDisplayTextChange(newSpeakingLabel, ...args);
        }
      };
    },
    get onSpokenDisplayTextTimeout() {
      return function _onSpokenDisplayTextTimeout(...args) {
        if (typeof setting.onSpokenDisplayTextTimeout === 'function') {
          return setting.onSpokenDisplayTextTimeout(...args);
        }
      };
    },

    stopSpeaking: () => stopSpeaking(speechEngine),
    interruptForVoice: () => interruptForVoice(speechEngine),
    computeMouth: () => computeMouth(speechEngine),
    onTap: () => onTap(speechEngine),
    stopVoiceSession: (message) => stopVoiceSession(speechEngine, message),
    setMic: (isListening) => setMic(speechEngine, isListening),
    startListening: () => startListening(speechEngine),
    preloadTapGreeting: () => preloadTapGreeting(speechEngine),
    setLocale: (locale) => setLocale(speechEngine, locale),
    pumpSpeech: (sid) => pumpSpeech(speechEngine, sid),
    handleUser: (text) => handleUser(speechEngine, text),
    beginSpeech: () => beginSpeech(speechEngine),
    pushSpeech: (sid, text, options) =>
      pushSpeech(speechEngine, sid, text, options),
    endSpeech: (sid) => endSpeech(speechEngine, sid),
    onUtteranceEnd: () => onUtteranceEnd(speechEngine),
    drainSentences: (state, force) =>
      drainSentences(speechEngine, state, force),

    _greeting: null, // function
    get greeting() {
      return this._greeting;
    },
    set greeting(newGreeting) {
      if (typeof newGreeting === 'function' || newGreeting === null) {
        this._greeting = newGreeting;
      }
    },

    _companionGreeting: null, // function | string
    get companionGreeting() {
      return this._companionGreeting;
    },
    set companionGreeting(newCompanionGreeting) {
      if (
        typeof newCompanionGreeting === 'function' ||
        typeof newCompanionGreeting === 'string' ||
        newCompanionGreeting === null
      ) {
        this._companionGreeting = newCompanionGreeting;
      }
    },

    _assistantGreeting: null, // function | string
    get assistantGreeting() {
      return this._assistantGreeting;
    },
    set assistantGreeting(newAssistantGreeting) {
      if (
        typeof newAssistantGreeting === 'function' ||
        typeof newAssistantGreeting === 'string' ||
        newAssistantGreeting === null
      ) {
        this._assistantGreeting = newAssistantGreeting;
      }
    },
    isProcessing: false
  };

  if (typeof setting.greeting === 'function') {
    speechEngine.greeting = setting.greeting.bind();
  }
  if (typeof setting.companionGreeting === 'function') {
    speechEngine.companionGreeting = setting.companionGreeting.bind();
  } else if (typeof setting.companionGreeting === 'string') {
    speechEngine.companionGreeting = setting.companionGreeting;
  }
  if (typeof setting.assistantGreeting === 'function') {
    speechEngine.assistantGreeting = setting.assistantGreeting.bind();
  } else if (typeof setting.assistantGreeting === 'string') {
    speechEngine.assistantGreeting = setting.assistantGreeting;
  }

  if ('speechSynthesis' in window === true) {
    speechSynthesis.onvoiceschanged = () => {
      if (speechEngine.ttVoice === null) {
        speechEngine.ttVoice = loadVoice(speechEngine.gender);
      }
    };
    speechEngine.ttVoice = loadVoice(speechEngine.gender);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden === true && speechEngine.convoOn === true) {
      speechEngine.stopVoiceSession('頁面進入背景，即時語音已停止。');
    }
  });

  return speechEngine;
}
