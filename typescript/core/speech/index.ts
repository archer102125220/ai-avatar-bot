import { DEFAULT_TTS_ENDPOINT, GENDER_MAP } from '@/core/constants';
import { createBaseStore } from '@/core/store';
import { getSttMessage, initDefaultSTTEngine, validateSTTEngine } from './stt';
import { splitSentences, initDefaultTTSEngine, validateTTSEngine } from './tts';
import type {
  SpeechEngine,
  SpeechEngineOptions,
  STTEngine,
  TTSEngine,
  SpokenAudioState
} from '@types';

export {
  validateTTSEngine,
  validateSTTEngine,
  initDefaultSTTEngine,
  initDefaultTTSEngine,
  splitSentences,
  getSttMessage
};
export * from './tts';
export * from './stt';

/**
 * Segments a streaming sentence text buffer into ready-to-synthesize sentences.
 * Monitors character accumulation and immediately slices complete sentences upon encountering end punctuation.
 * Features safeguards for long clauses that split early at comma boundaries to reduce initial speech synthesis latency.
 *
 * @param state - State object containing the streaming text buffer.
 * @param force - Whether to forcefully extract all remaining buffer content (e.g. stream finished).
 * @returns Array of sentences ready for TTS synthesis.
 */
export function drainSentences(
  state: { buf?: string; sentenceBuffer?: string },
  force: boolean = false
): string[] {
  if (typeof state !== 'object' || state === null) {
    return [];
  }

  const getSentenceBuffer = (): string =>
    typeof state.buf === 'string'
      ? state.buf
      : typeof state.sentenceBuffer === 'string'
        ? state.sentenceBuffer
        : '';

  const setSentenceBuffer = (value: string): void => {
    if (typeof state.buf === 'string') {
      state.buf = value;
    }
    if (typeof state.sentenceBuffer === 'string') {
      state.sentenceBuffer = value;
    }
  };

  let sentenceBuffer = getSentenceBuffer();
  const extractedSentences: string[] = [];

  while (sentenceBuffer.length > 0) {
    // Look for end-of-sentence punctuation: Chinese punctuation [。！？!?；;\n…\r] or English period + whitespace/newline
    const punctuationMatch = sentenceBuffer.match(/[。！？!?；;\n…\r]|\.\s+/);
    if (
      punctuationMatch !== null &&
      typeof punctuationMatch.index === 'number'
    ) {
      const cutPosition = punctuationMatch.index + punctuationMatch[0].length;
      const sentence = sentenceBuffer.slice(0, cutPosition).trim();
      sentenceBuffer = sentenceBuffer.slice(cutPosition);
      if (sentence !== '') {
        extractedSentences.push(sentence);
      }
    } else if (sentenceBuffer.length >= 40) {
      // If length reaches 40 characters without end punctuation, split early at comma to avoid delay
      const commaMatch = sentenceBuffer.match(/[，,]\s*/);
      if (
        commaMatch !== null &&
        typeof commaMatch.index === 'number' &&
        commaMatch.index >= 12
      ) {
        const cutPosition = commaMatch.index + commaMatch[0].length;
        const sentence = sentenceBuffer.slice(0, cutPosition).trim();
        sentenceBuffer = sentenceBuffer.slice(cutPosition);
        if (sentence !== '') {
          extractedSentences.push(sentence);
        }
      } else if (sentenceBuffer.length >= 80) {
        // 80-character fallback split
        const sentence = sentenceBuffer.slice(0, 80).trim();
        sentenceBuffer = sentenceBuffer.slice(80);
        if (sentence !== '') {
          extractedSentences.push(sentence);
        }
      } else {
        break;
      }
    } else {
      break;
    }
  }

  if (force === true && sentenceBuffer.trim() !== '') {
    extractedSentences.push(sentenceBuffer.trim());
    sentenceBuffer = '';
  }

  setSentenceBuffer(sentenceBuffer);
  return extractedSentences;
}

/**
 * Extended internal interface for SpeechEngine state.
 */
export interface InternalSpeechStoreState {
  isSpeaking: boolean;
  isListening: boolean;
  spokenDisplayText: string;
  spokenAudioState: SpokenAudioState;
  gender: string;
  ttsEndpoint: string;
  neuralVoice: string | undefined;
  speakSeq: number;
  ttsMuted: boolean;
  ttsRate: number;
  convoOn: boolean;
  isProcessing: boolean;
  assistantSpeechStartedAt: number;
  locale: string;
}

/**
 * Extended interface for SpeechEngine with internal helper properties.
 */
export interface InternalSpeechEngine extends SpeechEngine {
  _speechBuffer: string;
  _speechBuf: string;
  _speechQueue: any[];
  _speechEndedFlag: boolean;
  _onTTSSpeakEnd: () => void;
  noSpeechRuns: number;
  onTapTimer: boolean;
}

/**
 * Creates and initializes the central Speech Orchestrator engine coordinating STT and TTS subsystems.
 * Handles speech recognition, audio synthesis, barge-in interrupts, event dispatching, and streaming LLM chunk queuing.
 * Supports custom STT and TTS engine injection via `customEngines`.
 *
 * @param setting - Speech engine initialization options.
 * @returns SpeechEngine controller instance.
 */
export async function initSpeechEngine(setting: SpeechEngineOptions = {}): Promise<SpeechEngine> {
  const { customEngines = {}, ttsEndpoint, neuralVoice } = setting;
  let sttEngine: STTEngine | null = null;
  let ttsEngine: TTSEngine | null = null;

  const store = createBaseStore<InternalSpeechStoreState>({
    isSpeaking: false,
    isListening: false,
    spokenDisplayText: '',
    spokenAudioState: {
      text: '',
      seq: 0,
      options: {}
    },
    gender:
      typeof setting.getGender === 'function'
        ? setting.getGender()
        : GENDER_MAP.female,
    ttsEndpoint:
      typeof ttsEndpoint === 'string' && ttsEndpoint !== ''
        ? ttsEndpoint
        : DEFAULT_TTS_ENDPOINT,
    neuralVoice,
    speakSeq: 0,
    ttsMuted: false,
    ttsRate: 1.0,
    convoOn: false,
    isProcessing: false,
    assistantSpeechStartedAt: 0,
    locale:
      typeof setting.locale === 'string' && setting.locale !== ''
        ? setting.locale
        : 'zh-TW'
  });

  let spokenDisplayTextTimer: ReturnType<typeof setTimeout> | null = null;
  store.subscribe('spokenDisplayText', (displayText: string) => {
    if (typeof displayText === 'string' && displayText !== '') {
      if (typeof setting.onSpokenDisplayTextChange === 'function') {
        setting.onSpokenDisplayTextChange(displayText);
      }
      if (spokenDisplayTextTimer !== null) {
        clearTimeout(spokenDisplayTextTimer);
      }
      spokenDisplayTextTimer = setTimeout(() => {
        if (
          store.getState().isSpeaking !== true &&
          typeof setting.onSpokenDisplayTextTimeout === 'function'
        ) {
          setting.onSpokenDisplayTextTimeout();
          store.setState({ spokenDisplayText: '' });
        }
      }, 6000);
    }
  });

  store.subscribe('gender', (newGender: string) => {
    if (ttsEngine !== null && typeof ttsEngine.setGender === 'function') {
      ttsEngine.setGender(newGender);
    }
  });

  store.subscribe('locale', (newLocale: string) => {
    if (sttEngine !== null && typeof sttEngine.setLocale === 'function') {
      sttEngine.setLocale(newLocale);
    }
    if (ttsEngine !== null && typeof ttsEngine.setLocale === 'function') {
      ttsEngine.setLocale(newLocale);
    }
  });

  store.subscribe('ttsMuted', (isMuted: boolean) => {
    if (ttsEngine !== null) {
      ttsEngine.isMuted = isMuted;
    }
  });

  store.subscribe('ttsRate', (newRate: number) => {
    if (ttsEngine !== null) {
      ttsEngine.ttsRate = newRate;
    }
  });

  store.subscribe('spokenAudioState', (audioState: SpokenAudioState) => {
    if (typeof audioState?.text === 'string' && audioState.text.trim() !== '') {
      store.setState({ spokenDisplayText: audioState.text });
      if (typeof setting.onSpeaking === 'function') {
        setting.onSpeaking(audioState.text);
      }
      speechEngine.speak(
        audioState.text,
        typeof audioState.options === 'object' && audioState.options !== null
          ? audioState.options
          : { instant: true }
      );
    }
  });

  // --- TTS Setup ---
  const ttsOptions = {
    ttsEndpoint:
      typeof ttsEndpoint === 'string' && ttsEndpoint !== ''
        ? ttsEndpoint
        : DEFAULT_TTS_ENDPOINT,
    neuralVoice: neuralVoice,
    gender: store.getState().gender,
    locale: store.getState().locale,
    onSpokenDisplayTextChange: (audioText?: string) => {
      store.setState({ spokenDisplayText: audioText || '' });
    },
    onSpeakStart: (audioText?: string) => {
      if (typeof setting.onSpeaking === 'function' && typeof audioText === 'string') {
        setting.onSpeaking(audioText);
      }
    },
    onSpeakEnd: () => {
      if (typeof (speechEngine as InternalSpeechEngine)._onTTSSpeakEnd === 'function') {
        (speechEngine as InternalSpeechEngine)._onTTSSpeakEnd();
      }
    },
    onSpeechWait: (speechSequenceId?: number) => {
      if (typeof setting.onSpeechWait === 'function') {
        setting.onSpeechWait(speechSequenceId);
      }
    }
  };

  if (typeof customEngines?.tts !== 'undefined' && customEngines.tts !== null) {
    try {
      const customInstance =
        typeof customEngines.tts === 'function'
          ? await customEngines.tts(ttsOptions)
          : customEngines.tts;
      const validation = validateTTSEngine(customInstance);
      if (validation.isValid === true) {
        ttsEngine = customInstance;
      } else {
        console.error(
          `[AvatarBot] Custom ttsEngine validation failed, missing implementations: ${validation.missing.join(', ')}. Falling back to default engine.`
        );
      }
    } catch (error) {
      console.error('[AvatarBot] Error initializing custom ttsEngine:', error);
    }
  }
  if (ttsEngine === null) {
    ttsEngine = initDefaultTTSEngine(ttsOptions);
  }

  if (typeof ttsEngine.subscribe === 'function') {
    ttsEngine.subscribe('isSpeaking', (isSpeakingState: boolean) => {
      store.setState({ isSpeaking: isSpeakingState });
    });
  }

  const speechEngine: InternalSpeechEngine = {
    subscribe: store.subscribe,
    getState: store.getState as () => Record<string, any>,
    setState: store.setState as (updates: Record<string, any> | ((state: Record<string, any>) => Record<string, any>)) => void,

    get gender(): string {
      return store.getState().gender;
    },
    setGender(newGender: string): void {
      store.setState({ gender: newGender });
    },
    get container(): HTMLElement | null {
      return typeof setting.getContainer === 'function'
        ? setting.getContainer()
        : null;
    },

    onVoiceStatusChanged: setting.onVoiceStatusChanged,
    onMicStateChanged: setting.onMicStateChanged,
    onLanguageChanged: setting.onLanguageChanged,

    get ttsEndpoint(): string {
      return store.getState().ttsEndpoint;
    },
    set ttsEndpoint(newEndpoint: string) {
      store.setState({ ttsEndpoint: newEndpoint });
    },

    get neuralVoice(): string {
      return store.getState().neuralVoice || '';
    },
    set neuralVoice(newNeuralVoice: string) {
      store.setState({ neuralVoice: newNeuralVoice });
    },

    get speakSeq(): number {
      return store.getState().speakSeq;
    },
    set speakSeq(newSpeakSeq: number) {
      store.setState({ speakSeq: newSpeakSeq });
    },

    get isSpeaking(): boolean {
      return store.getState().isSpeaking;
    },
    get isListening(): boolean {
      return sttEngine !== null ? sttEngine.isListening : false;
    },

    get ttsMuted(): boolean {
      return store.getState().ttsMuted;
    },
    set ttsMuted(newTtsMuted: boolean) {
      store.setState({ ttsMuted: newTtsMuted });
    },

    get ttsRate(): number {
      return store.getState().ttsRate;
    },
    set ttsRate(newRate: number) {
      const safeRate =
        typeof newRate === 'number' &&
        Number.isFinite(newRate) === true &&
        newRate > 0
          ? newRate
          : 1.0;
      store.setState({ ttsRate: safeRate });
      if (ttsEngine !== null) {
        ttsEngine.ttsRate = safeRate;
      }
    },

    get noSpeechRuns(): number {
      return sttEngine !== null ? sttEngine.noSpeechRuns : 0;
    },
    set noSpeechRuns(value: number) {
      if (sttEngine !== null) {
        sttEngine.noSpeechRuns = value;
      }
    },

    onTapTimer: false,

    get convoOn(): boolean {
      return store.getState().convoOn;
    },
    set convoOn(newConvoOn: boolean) {
      store.setState({ convoOn: newConvoOn });
    },
    get isProcessing(): boolean {
      return store.getState().isProcessing;
    },
    set isProcessing(newIsProcessing: boolean) {
      store.setState({ isProcessing: newIsProcessing });
    },
    get assistantSpeechStartedAt(): number {
      return store.getState().assistantSpeechStartedAt;
    },
    set assistantSpeechStartedAt(timestamp: number) {
      store.setState({ assistantSpeechStartedAt: timestamp });
    },

    get spokenDisplayText(): string {
      return store.getState().spokenDisplayText;
    },
    set spokenDisplayText(newDisplayText: string) {
      store.setState({ spokenDisplayText: newDisplayText });
    },

    speak(text: string, options?: Record<string, any>): void {
      speechEngine.assistantSpeechStartedAt = performance.now();
      if (typeof text === 'string' && text.trim() !== '') {
        speechEngine.spokenDisplayText = text.trim();
      }
      if (ttsEngine !== null) {
        ttsEngine.speak(text, options);
        if (typeof ttsEngine.getState === 'function') {
          speechEngine.speakSeq = ttsEngine.getState().speakSeq;
        }
      }
    },

    get spokenAudioText(): string {
      return store.getState().spokenAudioState?.text || '';
    },
    set spokenAudioText(newAudioText: string) {
      const safeText = typeof newAudioText === 'string' ? newAudioText : '';
      store.setState((prevState) => ({
        spokenAudioState: {
          text: safeText,
          seq: (prevState.spokenAudioState?.seq || 0) + 1,
          options: { instant: true },
          timestamp: Date.now()
        }
      }));
    },

    get spokenAudioState(): SpokenAudioState {
      return store.getState().spokenAudioState;
    },

    stopSpeaking(): void {
      speechEngine.speakSeq++;
      speechEngine._speechEndedFlag = false;
      if (ttsEngine !== null) {
        ttsEngine.stop();
      }
    },

    interruptForVoice(): void {
      speechEngine.speakSeq++;
      if (typeof setting.onInterrupt === 'function') {
        setting.onInterrupt();
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
        if (
          speechEngine.convoOn === true &&
          speechEngine.isListening !== true
        ) {
          speechEngine.startListening();
        }
      }, 100);
    },

    computeMouth(): number {
      return ttsEngine !== null ? ttsEngine.computeMouth() : 0;
    },

    triggerTap(): void {
      if (typeof setting.onTapAvatar === 'function') {
        setting.onTapAvatar();
      }
    },

    stopVoiceSession(message?: string): void {
      speechEngine.convoOn = false;
      speechEngine.isProcessing = false;
      speechEngine.stopSpeaking();
      if (sttEngine !== null && typeof sttEngine.stopListening === 'function') {
        sttEngine.stopListening();
      }
      if (typeof speechEngine.onVoiceStatusChanged === 'function') {
        speechEngine.onVoiceStatusChanged(false, '', '', 0);
      }
      if (typeof message === 'string' && message !== '') {
        speechEngine.spokenDisplayText = message;
      }
    },

    setMic(isListening: boolean): void {
      if (typeof speechEngine.onMicStateChanged === 'function') {
        speechEngine.onMicStateChanged(isListening, speechEngine.convoOn);
      }
    },

    startListening(): void {
      if (
        speechEngine.isSpeaking === true ||
        speechEngine.isProcessing === true
      ) {
        speechEngine.stopSpeaking();
      }
      if (
        sttEngine !== null &&
        typeof sttEngine.startListening === 'function'
      ) {
        sttEngine.startListening();
      }
    },

    preloadTapGreeting(text: string): Promise<any> | void {
      if (typeof ttsEngine?.preloadTapGreeting === 'function') {
        return ttsEngine.preloadTapGreeting(text);
      }
    },

    get locale(): string {
      return store.getState().locale;
    },
    setLocale(locale: string): void {
      store.setState({ locale });
      if (typeof speechEngine.onLanguageChanged === 'function') {
        let label = '語音預設';
        let shortLabel = '';
        if (/en/i.test(locale)) {
          label = '英文 (English)';
          shortLabel = 'English';
        } else if (/ja/i.test(locale)) {
          label = '日文 (日本語)';
          shortLabel = '日本語';
        } else if (/ko/i.test(locale)) {
          label = '韓文 (한국어)';
          shortLabel = '한국어';
        } else if (/zh/i.test(locale)) {
          label = '繁體中文';
          shortLabel = '中文';
        }
        speechEngine.onLanguageChanged(locale, label, shortLabel);
      }
    },

    _speechBuffer: '',
    get _speechBuf(): string {
      return this._speechBuffer;
    },
    set _speechBuf(bufferText: string) {
      this._speechBuffer = bufferText;
    },
    _speechQueue: [],

    drainSentences(state: { buf?: string; sentenceBuffer?: string }, force?: boolean): string[] {
      return drainSentences(state, force);
    },

    beginSpeech(): number {
      speechEngine.stopSpeaking();
      speechEngine._speechBuffer = '';
      speechEngine._speechEndedFlag = false;
      if (ttsEngine !== null && typeof ttsEngine.beginSpeech === 'function') {
        speechEngine.speakSeq = ttsEngine.beginSpeech();
      } else {
        speechEngine.speakSeq++;
      }
      return speechEngine.speakSeq;
    },

    pushSpeech(speechSequenceId: number, text: string, options: Record<string, any> = {}): void {
      if (speechSequenceId !== speechEngine.speakSeq) {
        return;
      }
      speechEngine._speechBuffer += text;

      if (ttsEngine !== null) {
        if (typeof ttsEngine.pushSpeech === 'function') {
          ttsEngine.pushSpeech(speechSequenceId, text, options);
        } else {
          ttsEngine.speak(text, options);
        }
      }
    },

    _speechEndedFlag: false,
    endSpeech(speechSequenceId: number): void {
      if (speechSequenceId !== speechEngine.speakSeq) {
        return;
      }
      speechEngine._speechEndedFlag = true;
      if (ttsEngine !== null) {
        if (typeof ttsEngine.endSpeech === 'function') {
          ttsEngine.endSpeech(speechSequenceId);
        } else {
          if (ttsEngine.isSpeaking !== true) {
            speechEngine.onUtteranceEnd();
          }
        }
      }
    },

    _onTTSSpeakEnd(): void {
      speechEngine.onUtteranceEnd();
      if (spokenDisplayTextTimer !== null) {
        clearTimeout(spokenDisplayTextTimer);
      }
      spokenDisplayTextTimer = setTimeout(() => {
        if (typeof setting.onSpokenDisplayTextTimeout === 'function') {
          setting.onSpokenDisplayTextTimeout();
          store.setState({ spokenDisplayText: '' });
        }
      }, 4000);
      if (typeof setting.onSpeakingEnd === 'function') {
        setting.onSpeakingEnd();
      }
    },

    onUtteranceEnd(): void {
      speechEngine.isProcessing = false;
      speechEngine._speechEndedFlag = false;
      if (speechEngine.convoOn === true && speechEngine.isListening !== true) {
        speechEngine.startListening();
      }
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden === true && speechEngine.convoOn === true) {
        speechEngine.stopVoiceSession(
          getSttMessage(speechEngine.locale, 'bgStop')
        );
      }
    });
  }

  // --- STT Setup ---
  const sttOptions = {
    locale: store.getState().locale,
    getAssistantActive: () =>
      speechEngine.isSpeaking === true || speechEngine.isProcessing === true,
    getSpeechDuration: () =>
      performance.now() -
      (typeof speechEngine.assistantSpeechStartedAt === 'number' &&
      speechEngine.assistantSpeechStartedAt > 0
        ? speechEngine.assistantSpeechStartedAt
        : performance.now()),
    getConvoOn: () => speechEngine.convoOn,
    onResult: (text: string, isFinal: boolean) => {
      if (isFinal === true) {
        if (typeof setting.onUserInput === 'function') {
          setting.onUserInput(text);
        }
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
    onMicLevel: (_rmsLevel: number, showVoiceUI: boolean, stateString: string, levelAmp: number) => {
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
    onError: (errorMessage: string, isNotAllowed: boolean) => {
      if (isNotAllowed === true) {
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
    onStatusChange: (isListening: boolean, statusMessage?: string) => {
      if (typeof speechEngine.onMicStateChanged === 'function') {
        speechEngine.onMicStateChanged(isListening, speechEngine.convoOn);
      }
      if (
        typeof statusMessage === 'string' &&
        statusMessage !== '' &&
        typeof speechEngine.onVoiceStatusChanged === 'function'
      ) {
        speechEngine.onVoiceStatusChanged(
          speechEngine.convoOn,
          statusMessage,
          isListening === true ? 'listening' : 'thinking',
          0
        );
      }
    },
    onNoSpeechAbort: () => {
      speechEngine.stopVoiceSession(
        getSttMessage(speechEngine.locale, 'noSpeechAbort')
      );
    }
  };

  if (typeof customEngines?.stt !== 'undefined' && customEngines.stt !== null) {
    try {
      const customInstance =
        typeof customEngines.stt === 'function'
          ? await customEngines.stt(sttOptions)
          : customEngines.stt;
      const validation = validateSTTEngine(customInstance);
      if (validation.isValid === true) {
        sttEngine = customInstance;
      } else {
        console.error(
          `[AvatarBot] Custom sttEngine validation failed, missing implementations: ${validation.missing.join(', ')}. Falling back to default engine.`
        );
      }
    } catch (error) {
      console.error('[AvatarBot] Error initializing custom sttEngine:', error);
    }
  }
  if (sttEngine === null) {
    sttEngine = initDefaultSTTEngine(sttOptions);
  }

  return speechEngine;
}
