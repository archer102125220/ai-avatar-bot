import type { SubscribableStore, Gender } from '@/core/types';

/**
 * Web Speech API SpeechRecognition Alternative result.
 */
export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

/**
 * Web Speech API SpeechRecognition Result item.
 */
export interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

/**
 * Web Speech API SpeechRecognition ResultList collection.
 */
export interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

/**
 * Web Speech API SpeechRecognition event payload.
 */
export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

/**
 * Web Speech API SpeechRecognition error event payload.
 */
export interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

/**
 * Web Speech API SpeechRecognition interface.
 */
export interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onaudiostart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onaudioend?: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/**
 * Speech-to-Text (STT) engine internal state.
 */
export interface STTEngineState {
  /** Microphone media stream instance. */
  micStream: MediaStream | null;
  /** AudioContext instance for microphone audio graph. */
  micAudioCtx: AudioContext | null;
  /** AnalyserNode for audio volume and frequency analysis. */
  micAnalyser: AnalyserNode | null;
  /** Byte frequency data array. */
  micData: Uint8Array | null;
  /** Computed dynamic microphone noise floor level. */
  micNoiseFloor: number;
  /** Consecutive detected speech frame counter. */
  voiceFrames: number;
  /** Timestamp (ms) of the last barge-in trigger. */
  lastBargeIn: number;
  /** Animation frame request ID for microphone volume monitoring. */
  micRaf: number;
  /** Web Speech API SpeechRecognition instance. */
  recognition: ISpeechRecognition | null;
  /** Whether the STT engine is actively listening. */
  isListening: boolean;
  /** Current language locale code (e.g. 'zh-TW', 'en-US'). */
  locale: string;
  /** Consecutive no-speech count. */
  noSpeechRuns: number;
  /** Timestamp (ms) of the last recognition restart. */
  lastRestart: number;
  /** Timestamp (ms) when speech recognition started. */
  speechStartTime: number;
  /** Timestamp (ms) when interim result was first received. */
  interimStartTime: number;
  /** Hint / subtitle text emitted by speech recognition. */
  spokenDisplayText: string;
  /** Whether speech recognition was intentionally aborted. */
  isAborted: boolean;
}

/**
 * Options for configuring the STTEngine.
 */
export interface STTEngineOptions {
  /** Callback fired when speech recognition produces text results. */
  onResult?: (text: string, isFinal: boolean, isInterim?: boolean) => void;
  /** Callback fired with real-time microphone volume level and speech activity state. */
  onMicLevel?: (
    rms: number,
    showVoiceUI: boolean,
    stateString: string,
    levelAmp: number
  ) => void;
  /** Callback fired when user voice barge-in is detected. */
  onBargeIn?: () => void;
  /** Callback fired when speech recognition encounters an error. */
  onError?: (errorMessage: string, isNotAllowed: boolean) => void;
  /** Callback fired when speech recognition listening state changes. */
  onStatusChange?: (
    isListening: boolean,
    statusMessage?: string,
    isAborted?: boolean
  ) => void;
  /** Callback fired when recognition stops due to consecutive no-speech timeouts. */
  onNoSpeechAbort?: () => void;
  /** Function to check whether avatar assistant is currently active / speaking. */
  getAssistantActive?: () => boolean;
  /** Function returning assistant speech duration in ms. */
  getSpeechDuration?: () => number;
  /** Function returning whether continuous conversation mode is active. */
  getConvoOn?: () => boolean;
  /** Initial language locale code (e.g. 'zh-TW', 'en-US'). */
  locale?: string;
}

/**
 * Speech-to-Text (STT) engine controller.
 */
export interface STTEngine extends SubscribableStore<STTEngineState> {
  /** Current language locale. */
  locale: string;
  /** Sets active language locale. */
  setLocale(locale: string): void;
  /** Whether microphone is actively listening. */
  readonly isListening: boolean;
  /** Consecutive no-speech count. */
  noSpeechRuns: number;
  /** Starts microphone listening. */
  startListening(): Promise<void>;
  /** Stops microphone listening. */
  stopListening(): void;
}

/**
 * Options for TTS speech synthesis playback.
 */
export interface TTSSpeakOptions {
  /** Whether to play immediately, bypassing sequential queue scheduling. */
  instant?: boolean;
  /** Whether to synchronize and update subtitle display text. */
  updateDisplay?: boolean;
}

/**
 * Item queued in the TTS synthesis queue.
 */
export interface TTSSpeechQueueItem {
  text: string;
  prefetchPromise: Promise<AudioBuffer | null> | null;
  error: Error | null;
  instant: boolean;
}

/**
 * Text-to-Speech (TTS) engine internal state.
 */
export interface TTSEngineState {
  /** Neural TTS API endpoint URL. */
  ttsEndpoint: string;
  /** Neural voice model name. */
  neuralVoice: string;
  /** Voice gender ('female' | 'male'). */
  gender: Gender;
  /** Language locale code (e.g. 'zh-TW', 'en-US'). */
  locale: string;
  /** Whether speech audio is currently playing. */
  isSpeaking: boolean;
  /** Whether audio output is muted. */
  isMuted: boolean;
  /** Speech sentence queue. */
  speechQueue: TTSSpeechQueueItem[];
  /** Browser SpeechSynthesisVoice instance. */
  browserVoice: SpeechSynthesisVoice | null;
  /** Current speech sequence ID. */
  speakSeq: number;
  /** Speech playback rate multiplier. */
  ttsRate: number;
  /** Target mouth viseme value. */
  mouthTarget: number;
  /** Current smoothed mouth viseme opening value (0 to 1). */
  mouthValue: number;
  /** Real-time audio energy mouth opening value. */
  audioMouth: number;
  /** Whether real-time audio energy drives mouth viseme. */
  useAudioMouth: boolean;
}

/**
 * Options for configuring the TTSEngine.
 */
export interface TTSEngineOptions {
  /** Neural TTS API endpoint URL. */
  ttsEndpoint?: string;
  /** Neural voice model identifier. */
  neuralVoice?: string;
  /** Voice gender ('female' | 'male'). */
  gender?: Gender;
  /** Language locale code. */
  locale?: string;
  /** Callback fired when speech synthesis playback begins. */
  onSpeakStart?: (audioText?: string) => void;
  /** Callback fired when speech synthesis playback completes. */
  onSpeakEnd?: () => void;
  /** Callback fired when speech queue is waiting for next streaming text chunk. */
  onSpeechWait?: (speechSequenceId?: number) => void;
  /** Callback fired when currently spoken subtitle text changes. */
  onSpokenDisplayTextChange?: (text: string) => void;
}

/**
 * Text-to-Speech (TTS) engine controller.
 */
export interface TTSEngine extends SubscribableStore<TTSEngineState> {
  /** Whether audio is currently speaking. */
  readonly isSpeaking: boolean;
  /** Whether audio is muted. */
  isMuted: boolean;
  /** Current language locale code. */
  readonly locale: string;
  /** TTS playback rate multiplier. */
  ttsRate?: number;
  /** Synthesizes and speaks the given text. */
  speak(text: string, options?: TTSSpeakOptions): void;
  /** Stops ongoing speech playback immediately. */
  stop(): void;
  /** Computes and returns the current mouth opening amplitude (0 to 1). */
  computeMouth(): number;
  /** Sets speech voice gender. */
  setGender(gender: Gender): void;
  /** Sets speech language locale. */
  setLocale(locale: string): void;
  /** Preloads audio greeting for tap interaction. */
  preloadTapGreeting(text: string): Promise<AudioBuffer | null>;
  /** Begins a new speech sequence stream. */
  beginSpeech?(): number;
  /** Pushes a text chunk to speech queue. */
  pushSpeech?(
    speechSequenceId: number,
    text: string,
    options?: TTSSpeakOptions
  ): void;
  /** Ends speech sequence stream. */
  endSpeech?(speechSequenceId: number): void;
}

/**
 * Spoken audio state intent object for triggering speech synthesis.
 */
export interface SpokenAudioState {
  /** Text to synthesize into speech. */
  text: string;
  /** Sequence increment ID. */
  seq: number;
  /** Additional speech options. */
  options?: TTSSpeakOptions;
  /** Timestamp (ms) when speech was triggered. */
  timestamp?: number;
}

/**
 * State snapshot of the central SpeechEngine.
 */
export interface SpeechEngineState {
  isSpeaking: boolean;
  isListening: boolean;
  spokenDisplayText: string;
  spokenAudioState: SpokenAudioState;
  gender: Gender;
  ttsEndpoint: string;
  neuralVoice?: string;
  speakSeq: number;
  ttsMuted: boolean;
  ttsRate: number;
  convoOn: boolean;
  isProcessing: boolean;
  assistantSpeechStartedAt: number;
  locale: string;
}

/**
 * Options for initializing the SpeechEngine.
 */
export interface SpeechEngineOptions {
  /** Custom STT and TTS engine instances or factory functions. */
  customEngines?: {
    stt?:
      | STTEngine
      | ((options: STTEngineOptions) => Promise<STTEngine> | STTEngine);
    tts?:
      | TTSEngine
      | ((options: TTSEngineOptions) => Promise<TTSEngine> | TTSEngine);
  };
  /** TTS API endpoint URL. */
  ttsEndpoint?: string;
  /** Neural voice model name identifier. */
  neuralVoice?: string;
  /** Language locale code (e.g., 'zh-TW', 'en-US'). */
  locale?: string;
  /** Function to get current avatar gender. */
  getGender?: () => Gender;
  /** Function to get avatar root container element. */
  getContainer?: () => HTMLElement | null;
  /** Callback fired when voice recognition / conversation status changes. */
  onVoiceStatusChanged?: (
    convoOn: boolean,
    text?: string,
    state?: string,
    level?: number
  ) => void;
  /** Callback fired when microphone listening state changes. */
  onMicStateChanged?: (isListening: boolean, convoOn: boolean) => void;
  /** Callback fired when active speech language changes. */
  onLanguageChanged?: (
    locale: string,
    label: string,
    shortLabel?: string
  ) => void;
  /** Callback fired when spoken subtitle text changes. */
  onSpokenDisplayTextChange?: (displayText: string) => void;
  /** Callback fired when subtitle bubble times out. */
  onSpokenDisplayTextTimeout?: () => void;
  /** Callback fired when audio speech playback begins. */
  onSpeaking?: (audioText: string) => void;
  /** Callback fired when audio speech playback completely ends. */
  onSpeakingEnd?: () => void;
  /** Callback fired when speech queue is temporarily idle waiting for streaming LLM chunks. */
  onSpeechWait?: (speechSequenceId?: number) => void;
  /** Callback fired when user speech recognition emits final text. */
  onUserInput?: (text: string) => void;
  /** Callback fired when user taps on the avatar. */
  onTapAvatar?: () => void;
  /** Callback fired when ongoing speech is interrupted by user voice barge-in. */
  onInterrupt?: () => void;
}

/**
 * Central speech orchestrator controlling Speech-to-Text (STT) and Text-to-Speech (TTS).
 */
export interface SpeechEngine extends SubscribableStore<SpeechEngineState> {
  /** Current speech gender. */
  gender: Gender;
  /** Sets speech voice gender. */
  setGender(gender: Gender): void;
  /** Root container DOM element. */
  readonly container: HTMLElement | null;
  /** TTS synthesis endpoint. */
  ttsEndpoint: string;
  /** Neural voice identifier. */
  neuralVoice?: string;
  /** Current speech sequence tracking ID. */
  speakSeq: number;
  /** Whether TTS audio is currently speaking. */
  readonly isSpeaking: boolean;
  /** Whether STT microphone is actively listening. */
  readonly isListening: boolean;
  /** Whether TTS speech is muted. */
  ttsMuted: boolean;
  /** Internal debounce flag for avatar tap interaction. */
  onTapTimer?: boolean;
  /** TTS playback rate multiplier (default 1.0). */
  ttsRate: number;
  /** Number of consecutive voice recognition turns without speech detected. */
  noSpeechRuns: number;
  /** Whether continuous voice conversation mode is enabled. */
  convoOn: boolean;
  /** Whether speech pipeline is currently processing. */
  isProcessing: boolean;
  /** Timestamp when assistant speech started. */
  assistantSpeechStartedAt: number;
  /** Currently displayed subtitle text on screen. */
  spokenDisplayText: string;
  /** Audio text trigger property. Setting a string auto-increments sequence and triggers speech. */
  spokenAudioText: string;
  /** Reactive speech state intent object. */
  spokenAudioState: SpokenAudioState;
  /** Speaks the specified text immediately. */
  speak(text: string, options?: TTSSpeakOptions): void;
  /** Stops ongoing speech playback immediately. */
  stopSpeaking(): void;
  /** Interrupts speech playback and transitions to voice listening (barge-in). */
  interruptForVoice(): void;
  /** Computes current mouth opening value (0 to 1) for lip sync. */
  computeMouth(): number;
  /** Triggers avatar tap interaction event. */
  triggerTap(): void;
  /** Stops voice session. */
  stopVoiceSession(message?: string): void;
  /** Updates microphone state and notifies subscribers. */
  setMic(isListening: boolean): void;
  /** Starts microphone listening. */
  startListening(): void;
  /** Preloads audio greeting for tap interaction. */
  preloadTapGreeting(text: string): Promise<AudioBuffer | null> | void;
  /** Active language locale. */
  locale: string;
  /** Sets speech language locale. */
  setLocale(locale: string): void;
  /** Splits streaming sentence buffer into speakable sentences. */
  drainSentences(
    state: { buf?: string; sentenceBuffer?: string },
    force?: boolean
  ): string[];
  /** Begins a new speech utterance stream and returns sequence ID. */
  beginSpeech(): number;
  /** Pushes a text chunk into the speech queue. */
  pushSpeech(
    speechSequenceId: number,
    text: string,
    options?: TTSSpeakOptions
  ): void;
  /** Ends speech sequence stream. */
  endSpeech(speechSequenceId: number): void;
  /** Callback fired when an utterance ends. */
  onUtteranceEnd(): void;
  /** Callback for voice status change. */
  onVoiceStatusChanged?: (
    convoOn: boolean,
    text?: string,
    state?: string,
    level?: number
  ) => void;
  /** Callback for mic state change. */
  onMicStateChanged?: (isListening: boolean, convoOn: boolean) => void;
  /** Callback for language change. */
  onLanguageChanged?: (
    locale: string,
    label: string,
    shortLabel?: string
  ) => void;
}
