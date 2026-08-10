import {
  DEFAULT_TTS_ENDPOINT,
  GENDER_MAP,
  AVATAR_MODE_MAP
} from '../constants';
import { createBaseStore } from '../store';
import { initDefaultSTTEngine, validateSTTEngine } from './stt';
import { splitSentences, initDefaultTTSEngine, validateTTSEngine } from './tts';

export { validateTTSEngine, validateSTTEngine };

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

  speechEngine.isProcessing = true;

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
    return;
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

export async function initSpeechEngine(setting = {}) {
  const { customEngines = {}, ttsEndpoint, neuralVoice } = setting;
  let sttEngine = null;
  let ttsEngine = null;

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
      ttsEngine.setGender(newGender);
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

    _ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    get ttsEndpoint() {
      return this._ttsEndpoint;
    },
    set ttsEndpoint(val) {
      this._ttsEndpoint = val;
    },

    _neuralVoice: neuralVoice,
    get neuralVoice() {
      return this._neuralVoice;
    },
    set neuralVoice(val) {
      this._neuralVoice = val;
    },

    _speakSeq: 0,
    get speakSeq() {
      return this._speakSeq;
    },
    set speakSeq(newSpeakSeq) {
      this._speakSeq = newSpeakSeq;
    },

    get isSpeaking() {
      return ttsEngine.isSpeaking;
    },
    get isListening() {
      return sttEngine.isListening;
    },

    _ttsMuted: false,
    get ttsMuted() {
      return this._ttsMuted;
    },
    set ttsMuted(newTtsMuted) {
      this._ttsMuted = newTtsMuted;
      ttsEngine.isMuted = newTtsMuted;
    },

    convoOn: false,
    isProcessing: false,
    assistantSpeechStartedAt: 0,

    _spokenDisplayText: '',
    get spokenDisplayText() {
      return this._spokenDisplayText;
    },
    set spokenDisplayText(newSpeakingLabel) {
      this._spokenDisplayText = newSpeakingLabel;
      if (typeof setting.onSpokenDisplayTextChange === 'function') {
        setting.onSpokenDisplayTextChange(newSpeakingLabel);
      }
    },

    speak: (text, options) => {
      speechEngine.assistantSpeechStartedAt = performance.now();
      ttsEngine.speak(text, options);
    },

    _spokenAudioText: '',
    get spokenAudioText() {
      return this._spokenAudioText;
    },
    set spokenAudioText(newSpeakingSounds) {
      this._spokenAudioText = newSpeakingSounds;
      this.spokenDisplayText = newSpeakingSounds;
      if (typeof setting.onSpeaking === 'function') {
        setting.onSpeaking(newSpeakingSounds);
      }
      speechEngine.speak(newSpeakingSounds);
    },

    stopSpeaking: () => {
      speechEngine.speakSeq++;
      ttsEngine.stop();
    },

    interruptForVoice: () => {
      speechEngine.speakSeq++;
      if (typeof speechEngine.brain?.llm?.controller?.abort === 'function') {
        try {
          speechEngine.brain.llm.controller.abort();
        } catch (_error) {}
      }
      speechEngine.stopSpeaking();
      speechEngine.isProcessing = false;
      if (typeof speechEngine.onVoiceStatusChanged === 'function') {
        speechEngine.onVoiceStatusChanged(
          speechEngine.convoOn,
          '已停止回答，請繼續說…',
          'listening',
          0
        );
      }
      setTimeout(() => {
        if (speechEngine.convoOn === true && !speechEngine.isListening) {
          speechEngine.startListening();
        }
      }, 100);
    },

    computeMouth: () => ttsEngine.computeMouth(),

    onTap: () => onTap(speechEngine),

    stopVoiceSession: (message) => {
      speechEngine.convoOn = false;
      speechEngine.isProcessing = false;
      speechEngine.stopSpeaking();
      sttEngine.stopListening();
      if (typeof speechEngine.onVoiceStatusChanged === 'function') {
        speechEngine.onVoiceStatusChanged(false, '', '', 0);
      }
      if (typeof message === 'string' && message !== '') {
        speechEngine.spokenDisplayText = message;
      }
    },

    setMic: (isListening) => {
      if (typeof speechEngine.onMicStateChanged === 'function') {
        speechEngine.onMicStateChanged(isListening, speechEngine.convoOn);
      }
    },

    startListening: () => {
      if (speechEngine.isSpeaking || speechEngine.isProcessing) {
        speechEngine.stopSpeaking();
      }
      sttEngine.startListening();
    },

    preloadTapGreeting: (text) => {
      if (typeof ttsEngine.preloadTapGreeting === 'function') {
        return ttsEngine.preloadTapGreeting(text);
      }
    },

    setLocale: (locale) => {
      ttsEngine.setLocale(locale);
      if (typeof speechEngine.onLanguageChanged === 'function') {
        let label = '語音預設';
        if (/en/i.test(locale)) label = '英文 (English)';
        else if (/ja/i.test(locale)) label = '日文 (日本語)';
        else if (/ko/i.test(locale)) label = '韓文 (한국어)';
        else if (/zh/i.test(locale)) label = '繁體中文';
        speechEngine.onLanguageChanged(locale, label);
      }
    },

    _speechBuf: '',
    _speechQueue: [],

    drainSentences: (state, force) => {
      const parts = splitSentences(state.buf);
      if (parts.length > 1 || (force && parts.length > 0)) {
        const out = force ? parts : parts.slice(0, parts.length - 1);
        state.buf = force ? '' : parts[parts.length - 1];
        return out;
      }
      return [];
    },

    beginSpeech: () => {
      speechEngine.stopSpeaking();
      speechEngine._speechBuf = '';
      speechEngine._speechQueue = [];
      speechEngine.speakSeq++;
      return speechEngine.speakSeq;
    },

    pushSpeech: (sid, text, options) => {
      if (sid !== speechEngine.speakSeq) return;
      speechEngine._speechBuf += text;
      speechEngine._speechQueue.push(text);

      if (!ttsEngine.isSpeaking) {
        speechEngine._playNextQueue(sid, options);
      }
    },

    _playNextQueue: (sid, options) => {
      if (sid !== speechEngine.speakSeq) return;
      if (speechEngine._speechQueue.length > 0) {
        const sentence = speechEngine._speechQueue.shift();
        speechEngine.speak(sentence, options);
      } else {
        if (speechEngine._speechEndedFlag) {
          speechEngine.onUtteranceEnd();
        }
      }
    },

    _onTTSSpeakEnd: () => {
      if (speechEngine._speechQueue.length > 0) {
        speechEngine._playNextQueue(speechEngine.speakSeq, {});
      } else if (speechEngine._speechEndedFlag) {
        speechEngine.onUtteranceEnd();
      } else {
        if (typeof setting.onSpeakingEnd === 'function') {
          setting.onSpeakingEnd();
        }
      }
    },

    _speechEndedFlag: false,
    endSpeech: (sid) => {
      if (sid !== speechEngine.speakSeq) return;
      speechEngine._speechEndedFlag = true;
      if (!ttsEngine.isSpeaking && speechEngine._speechQueue.length === 0) {
        speechEngine.onUtteranceEnd();
      }
    },

    onUtteranceEnd: () => {
      speechEngine.isProcessing = false;
      speechEngine._speechEndedFlag = false;
      if (speechEngine.convoOn && !speechEngine.isListening) {
        speechEngine.startListening();
      }
    },

    handleUser: (text) => handleUser(speechEngine, text),

    _greeting: null,
    get greeting() {
      return this._greeting;
    },
    set greeting(val) {
      this._greeting = val;
    },

    _companionGreeting: null,
    get companionGreeting() {
      return this._companionGreeting;
    },
    set companionGreeting(val) {
      this._companionGreeting = val;
    },

    _assistantGreeting: null,
    get assistantGreeting() {
      return this._assistantGreeting;
    },
    set assistantGreeting(val) {
      this._assistantGreeting = val;
    }
  };

  if (typeof setting.greeting === 'function')
    speechEngine.greeting = setting.greeting.bind();
  if (typeof setting.companionGreeting === 'function')
    speechEngine.companionGreeting = setting.companionGreeting.bind();
  else if (typeof setting.companionGreeting === 'string')
    speechEngine.companionGreeting = setting.companionGreeting;
  if (typeof setting.assistantGreeting === 'function')
    speechEngine.assistantGreeting = setting.assistantGreeting.bind();
  else if (typeof setting.assistantGreeting === 'string')
    speechEngine.assistantGreeting = setting.assistantGreeting;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden === true && speechEngine.convoOn === true) {
      speechEngine.stopVoiceSession('頁面進入背景，即時語音已停止。');
    }
  });

  // --- TTS Setup ---
  const ttsOptions = {
    ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    neuralVoice: neuralVoice,
    gender: speechEngine.gender,
    onSpeakStart: () => {
      // Tap motion trigger when speaking starts
      if (typeof speechEngine.skin?.avatarModel?.motion === 'function') {
        try {
          speechEngine.skin.avatarModel.motion('Tap');
        } catch (_e) {}
      }
    },
    onSpeakEnd: () => {
      if (typeof speechEngine._onTTSSpeakEnd === 'function') {
        speechEngine._onTTSSpeakEnd();
      }
    },
    onSpokenDisplayTextChange: (text) => {
      speechEngine.spokenDisplayText = text;
    }
  };

  if (typeof customEngines?.tts !== 'undefined' && customEngines.tts !== null) {
    try {
      const customInstance =
        typeof customEngines.tts === 'function'
          ? await customEngines.tts(ttsOptions)
          : customEngines.tts;
      const validation = validateTTSEngine(customInstance);
      if (validation.isValid) {
        ttsEngine = customInstance;
      } else {
        console.error(
          `[AvatarBot] 自訂 ttsEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
        );
      }
    } catch (e) {
      console.error('[AvatarBot] 初始化自訂 ttsEngine 發生錯誤:', e);
    }
  }
  if (!ttsEngine) {
    ttsEngine = initDefaultTTSEngine(ttsOptions);
  }

  // --- STT Setup ---
  const sttOptions = {
    getAssistantActive: () =>
      speechEngine.isSpeaking || speechEngine.isProcessing,
    getSpeechDuration: () =>
      performance.now() -
      (speechEngine.assistantSpeechStartedAt || performance.now()),
    getConvoOn: () => speechEngine.convoOn,
    onResult: (text, isFinal) => {
      if (isFinal) {
        speechEngine.handleUser(text);
      } else {
        speechEngine.spokenDisplayText = '你：' + text + '…';
        if (typeof speechEngine.onVoiceStatusChanged === 'function') {
          speechEngine.onVoiceStatusChanged(
            speechEngine.convoOn,
            '正在辨識：' + text,
            'listening',
            0
          );
        }
      }
    },
    onMicLevel: (rms, showVoiceUI, stateString, levelAmp) => {
      if (typeof speechEngine.onVoiceStatusChanged === 'function') {
        speechEngine.onVoiceStatusChanged(
          showVoiceUI,
          undefined,
          stateString,
          levelAmp
        );
      }
    },
    onBargeIn: () => {
      if (typeof speechEngine.interruptForVoice === 'function') {
        speechEngine.interruptForVoice();
      }
    },
    onError: (errorMessage, isNotAllowed) => {
      if (isNotAllowed) {
        speechEngine.convoOn = false;
        speechEngine.spokenDisplayText = errorMessage;
        if (typeof speechEngine.onVoiceStatusChanged === 'function') {
          speechEngine.onVoiceStatusChanged(
            speechEngine.convoOn,
            '麥克風權限被拒絕',
            '',
            0
          );
        }
      } else {
        speechEngine.spokenDisplayText = errorMessage;
      }
    },
    onStatusChange: (isListening, statusMessage) => {
      if (typeof speechEngine.onMicStateChanged === 'function') {
        speechEngine.onMicStateChanged(isListening, speechEngine.convoOn);
      }
      if (
        statusMessage &&
        typeof speechEngine.onVoiceStatusChanged === 'function'
      ) {
        speechEngine.onVoiceStatusChanged(
          speechEngine.convoOn,
          statusMessage,
          isListening ? 'listening' : 'thinking',
          0
        );
      }
    },
    onNoSpeechAbort: () => {
      speechEngine.stopVoiceSession('連續幾次沒有聽到聲音，即時對話已暫停。');
    }
  };

  if (typeof customEngines?.stt !== 'undefined' && customEngines.stt !== null) {
    try {
      const customInstance =
        typeof customEngines.stt === 'function'
          ? await customEngines.stt(sttOptions)
          : customEngines.stt;
      const validation = validateSTTEngine(customInstance);
      if (validation.isValid) {
        sttEngine = customInstance;
      } else {
        console.error(
          `[AvatarBot] 自訂 sttEngine 驗證失敗，缺少以下實作: ${validation.missing.join(', ')}。將退回使用預設引擎。`
        );
      }
    } catch (e) {
      console.error('[AvatarBot] 初始化自訂 sttEngine 發生錯誤:', e);
    }
  }
  if (!sttEngine) {
    sttEngine = initDefaultSTTEngine(sttOptions);
  }

  return speechEngine;
}
