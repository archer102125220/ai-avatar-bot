export const DEFAULT_TTS_ENDPOINT = 'api/tts';
export const DEFAULT_FEMALE_NEURAL_VOICE = 'zh-TW-HsiaoChenNeural'; // 微軟神經語音「曉臻」
export const DEFAULT_MALE_NEURAL_VOICE = 'zh-TW-YunJheNeural'; // 微軟神經語音「雲哲」

export function initSpeechEngine(setting = {}) {
  // const { ttsEndpoint, safeNeuralVoice } = setting;

  // const speechEngine = {
  //   avatarMode: '', // 不確定？

  //   _mouthTarget: 0.7, // 可能要歸在 skin ?
  //   get mouthTarget() {
  //     return this._mouthTarget;
  //   },
  //   set mouthTarget(newMouthTarget) {
  //     if (typeof newMouthTarget === 'number' || newMouthTarget === null) {
  //       this._mouthTarget = newMouthTarget;
  //     }
  //   },

  //   _mouthValue: 0, // 可能要歸在 skin ?
  //   get mouthValue() {
  //     return this._mouthValue;
  //   },
  //   set mouthValue(newMouthValue) {
  //     if (typeof newMouthValue === 'number' || newMouthValue === null) {
  //       this._mouthValue = newMouthValue;
  //     }
  //   },

  //   _speakSeq: 0,
  //   get speakSeq() {
  //     return this._speakSeq;
  //   },
  //   set speakSeq(newSpeakSeq) {
  //     if (typeof newSpeakSeq === 'number' || newSpeakSeq === null) {
  //       this._speakSeq = newSpeakSeq;
  //     }
  //   },

  //   // ②逐句開講的佇列狀態（var：這檔案有「宣告前就被呼叫」的前例，避 TDZ）
  //   speechQ: [],
  //   speechEnded: false,
  //   isSpeechPlaying: false,
  //   tapDone: false,

  //   speakBrowserTimer: 0,
  //   spokenDisplayTextTimer: 0,

  //   // 控制「點第二下打斷第一下」
  //   _currentFps: 0,
  //   get currentFps() {
  //     return this._currentFps;
  //   },
  //   set currentFps(newCurrentFps) {
  //     if (typeof newCurrentFps === 'number' || newCurrentFps === null) {
  //       this._currentFps = newCurrentFps;
  //     }
  //   },

  //   _currentSource: null,
  //   get currentSource() {
  //     return this._currentSource;
  //   },
  //   set currentSource(newCurrentSource) {
  //     if (typeof newCurrentSource === 'object') {
  //       this._currentSource = newCurrentSource;
  //     }
  //   },

  //   _isSpeaking: false,
  //   get isSpeaking() {
  //     return this._isSpeaking;
  //   },
  //   set isSpeaking(newIsSpeaking) {
  //     if (typeof newIsSpeaking === 'boolean' || newIsSpeaking === null) {
  //       this._isSpeaking = newIsSpeaking;
  //     }
  //   },

  //   _useAudioMouth: false,
  //   get useAudioMouth() {
  //     return this._useAudioMouth;
  //   },
  //   set useAudioMouth(newUseAudioMouth) {
  //     if (typeof newUseAudioMouth === 'boolean' || newUseAudioMouth === null) {
  //       this._newUseAudioMouth = newUseAudioMouth;
  //     }
  //   },

  //   _audioMouth: 0,
  //   get audioMouth() {
  //     return this._audioMouth;
  //   },
  //   set audioMouth(newAudioMouth) {
  //     if (typeof newAudioMouth === 'number' || newAudioMouth === null) {
  //       this._audioMouth = newAudioMouth;
  //     }
  //   },

  //   _ttsMuted: false,
  //   get ttsMuted() {
  //     return this._ttsMuted;
  //   },
  //   set ttsMuted(newTtsMuted) {
  //     if (typeof newTtsMuted === 'boolean' || newTtsMuted === null) {
  //       this._ttsMuted = newTtsMuted;
  //     }
  //   },

  //   // 連續對話（陪伴模式）：她講完 → 自動重開麥。她講話期間不開麥（會聽到自己的聲音）
  //   convoOn: false,
  //   noSpeechRuns: 0,

  //   isListening: false,

  //   // 抓不到神經語音後端就鎖定瀏覽器語音，避免每句都打 404
  //   _neuralDisabled: false,
  //   get neuralDisabled() {
  //     return this._neuralDisabled;
  //   },
  //   set neuralDisabled(newNeuralDisabled) {
  //     if (
  //       typeof newNeuralDisabled === 'boolean' ||
  //       newNeuralDisabled === null
  //     ) {
  //       this._neuralDisabled = newNeuralDisabled;
  //     }
  //   },

  //   _audioCtx: null,
  //   get audioCtx() {
  //     return this._audioCtx;
  //   },
  //   set audioCtx(newAudioCtx = null) {
  //     if (typeof newAudioCtx === 'object') {
  //       this._audioCtx = newAudioCtx;
  //     }
  //   },

  //   _ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
  //   get ttsEndpoint() {
  //     return this._ttsEndpoint;
  //   },
  //   set ttsEndpoint(newTtsEndpoint = '') {
  //     if (typeof newTtsEndpoint === 'string' && newTtsEndpoint !== '') {
  //       this._ttsEndpoint = newTtsEndpoint;
  //     }
  //   },

  //   _neuralVoice: safeNeuralVoice,
  //   get neuralVoice() {
  //     return this._neuralVoice; // 神經語音
  //   },
  //   set neuralVoice(newNeuralVoice = '') {
  //     if (typeof newNeuralVoice === 'string' || newNeuralVoice === null) {
  //       this._neuralVoice = newNeuralVoice;
  //     }
  //   },

  //   _ttVoice: null,
  //   get ttVoice() {
  //     return this._ttVoice;
  //   },
  //   set ttVoice(newTtVoice) {
  //     if (typeof newTtVoice === 'object') {
  //       this._ttVoice = newTtVoice;
  //     }
  //   },

  //   _ttsRate: 1.0,
  //   get ttsRate() {
  //     return this._ttsRate;
  //   },
  //   set ttsRate(newTtsRate) {
  //     if (typeof newTtsRate === 'number' || newTtsRate === null) {
  //       this._ttsRate = newTtsRate;
  //     }
  //   },

  //   _spokenDisplayText: '',
  //   get spokenDisplayText() {
  //     return this._spokenDisplayText;
  //   },
  //   set spokenDisplayText(newSpeakingLabel) {
  //     if (typeof newSpeakingLabel === 'string' || newSpeakingLabel === null) {
  //       this._spokenDisplayText = newSpeakingLabel;

  //       if (typeof this.onSpokenDisplayTextChange === 'function') {
  //         this.onSpokenDisplayTextChange(newSpeakingLabel, aiAvatarWidget);
  //       }
  //     }
  //   },
  //   get speak() {
  //     return function _speak(text) {
  //       return speak(aiAvatarWidget, String(text || '').slice(0, 600));
  //     };
  //   },
  //   _spokenAudioText: '',
  //   get spokenAudioText() {
  //     return this._spokenAudioText;
  //   },
  //   set spokenAudioText(newSpeakingSounds) {
  //     if (typeof newSpeakingSounds === 'string' || newSpeakingSounds === null) {
  //       this._spokenAudioText = newSpeakingSounds;

  //       this.spokenDisplayText = newSpeakingSounds;
  //       if (typeof this.onSpeaking === 'function') {
  //         this.onSpeaking(newSpeakingSounds, aiAvatarWidget);
  //       }
  //       this.speak(newSpeakingSounds);
  //     }
  //   },

  //   _recognition: null,
  //   get recognition() {
  //     return this._recognition;
  //   },
  //   set recognition(newRecognition) {
  //     if (typeof newRecognition === 'object') {
  //       this._recognition = newRecognition;
  //     }
  //   },

  //   get onSpeaking() {
  //     return function (text, currentAiAvatar, ...args) {
  //       if (typeof setting.onSpeaking === 'function') {
  //         return setting.onSpeaking.call(
  //           currentAiAvatar,
  //           text,
  //           currentAiAvatar,
  //           ...args
  //         );
  //       }
  //     };
  //   },
  //   get onSpeakingEnd() {
  //     return function (text, currentAiAvatar, ...args) {
  //       if (typeof setting.onSpeakingEnd === 'function') {
  //         return setting.onSpeakingEnd.call(
  //           currentAiAvatar,
  //           text,
  //           currentAiAvatar,
  //           ...args
  //         );
  //       }
  //     };
  //   },
  //   get onSpokenDisplayTextChange() {
  //     return function _onSpokenDisplayTextChange(
  //       newSpeakingLabel,
  //       currentAiAvatar,
  //       ...args
  //     ) {
  //       uiDom.bubbleEl.textContent = newSpeakingLabel;
  //       uiDom.bubbleEl.classList.add('show');
  //       clearTimeout(this.spokenDisplayTextTimer);
  //       this.spokenDisplayTextTimer = setTimeout(
  //         () => uiDom.bubbleEl.classList.remove('show'),
  //         6000
  //       );

  //       if (typeof setting.onSpokenDisplayTextChange === 'function') {
  //         return setting.onSpokenDisplayTextChange.call(
  //           currentAiAvatar,
  //           newSpeakingLabel,
  //           currentAiAvatar,
  //           ...args
  //         );
  //       }
  //     };
  //   },

  //   _greeting: null, // function
  //   get greeting() {
  //     return this._greeting;
  //   },
  //   set greeting(newGreeting) {
  //     if (typeof newGreeting === 'function' || newGreeting === null) {
  //       this._greeting = newGreeting;
  //     }
  //   },

  //   _companionGreeting: null, // function | string
  //   get companionGreeting() {
  //     return this._companionGreeting;
  //   },
  //   set companionGreeting(newCompanionGreeting) {
  //     if (
  //       typeof newCompanionGreeting === 'function' ||
  //       typeof newCompanionGreeting === 'string' ||
  //       newCompanionGreeting === null
  //     ) {
  //       this._companionGreeting = newCompanionGreeting;
  //     }
  //   },

  //   _assistantGreeting: null, // function | string
  //   get assistantGreeting() {
  //     return this._assistantGreeting;
  //   },
  //   set assistantGreeting(newAssistantGreeting) {
  //     if (
  //       typeof newAssistantGreeting === 'function' ||
  //       typeof newAssistantGreeting === 'string' ||
  //       newAssistantGreeting === null
  //     ) {
  //       this._assistantGreeting = newAssistantGreeting;
  //     }
  //   },
  //   isProcessing: false
  // };

  // return speechEngine;
}
