import { GENDER_MAP } from '@/core/constants';
import { createBaseStore } from '@/core/store';
import type {
  TTSEngine,
  TTSEngineOptions,
  TTSEngineState,
  TTSSpeakOptions
} from '@types';

/**
 * Extended internal state for the Text-to-Speech (TTS) engine.
 */
export interface InternalTTSEngineState extends TTSEngineState {
  speechController: any;
  audioCtx: AudioContext | null;
  audioSource: AudioBufferSourceNode | null;
  audioAnalyser: AnalyserNode | null;
  audioDataArray: Uint8Array | null;
  mouthTimer: any;
  isSpeechPlaying: boolean;
  speechEnded: boolean;
  tapDone: boolean;
  speakBrowserTimer: any;
  currentFps: number;
  currentSource: AudioBufferSourceNode | null;
  neuralDisabled: boolean;
  tapGreetingCacheKey: string | null;
  tapGreetingPrep: Promise<AudioBuffer | null> | null;
  tapGreetingBuffer: AudioBuffer | null;
}

/**
 * Validates whether the provided Text-to-Speech (TTS) engine complies with the TTSEngine interface specification.
 *
 * @param engine - TTS engine instance to validate.
 * @returns Object containing validation result and missing properties/methods array.
 */
export function validateTTSEngine(engine: any): {
  isValid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (typeof engine !== 'object' || engine === null) {
    missing.push('engine instance');
  } else {
    ['speak', 'stop', 'computeMouth', 'setGender', 'setLocale'].forEach(
      (methodName) => {
        if (typeof engine[methodName] !== 'function') {
          missing.push(`${methodName}()`);
        }
      }
    );
    ['isSpeaking', 'isMuted'].forEach((propertyName) => {
      if (!(propertyName in engine)) {
        missing.push(propertyName);
      }
    });
  }
  return { isValid: missing.length === 0, missing };
}

/**
 * Loads the matching browser native voice (SpeechSynthesisVoice) based on specified gender and locale.
 * Prioritizes high-quality natural voices by name patterns, falling back to locale-matched default voices.
 *
 * @param gender - Voice gender ('female' | 'male').
 * @param locale - Language locale code (e.g., 'zh-TW', 'en-US', 'ja-JP', 'ko-KR').
 * @returns Matched voice object, or null if unavailable.
 */
export function loadVoice(
  gender: string,
  locale: string = 'zh-TW'
): SpeechSynthesisVoice | null {
  if (
    typeof window === 'undefined' ||
    typeof window.speechSynthesis !== 'object' ||
    window.speechSynthesis === null ||
    typeof window.speechSynthesis.getVoices !== 'function'
  ) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  const findMatchingVoice = (
    voicePattern: RegExp
  ): SpeechSynthesisVoice | undefined =>
    voices.find(
      (voice) =>
        voicePattern.test(`${voice.name} ${voice.lang}`) === true &&
        !/Google/i.test(voice.name)
    );

  const normalizedLocale =
    typeof locale === 'string' && locale !== ''
      ? locale.toLowerCase()
      : 'zh-tw';
  let matchedVoice: SpeechSynthesisVoice | undefined = undefined;

  if (normalizedLocale.startsWith('en') === true) {
    if (gender === GENDER_MAP.male) {
      matchedVoice = findMatchingVoice(/(Guy|Christopher|Eric|Davis).*en/i);
    } else if (gender === GENDER_MAP.female) {
      matchedVoice = findMatchingVoice(/(Jenny|Aria|Sara|Zira).*en/i);
    }
    return (
      matchedVoice ||
      findMatchingVoice(/Microsoft.*en/i) ||
      findMatchingVoice(/en[-_]US/i) ||
      findMatchingVoice(/^en/i) ||
      voices.find((voice) => /en/i.test(voice.lang) === true) ||
      null
    );
  }

  if (normalizedLocale.startsWith('ja') === true) {
    if (gender === GENDER_MAP.male) {
      matchedVoice = findMatchingVoice(/(Keita|Daichi|Ichiro).*ja/i);
    } else if (gender === GENDER_MAP.female) {
      matchedVoice = findMatchingVoice(/(Nanami|Ayumi|Haruka).*ja/i);
    }
    return (
      matchedVoice ||
      findMatchingVoice(/Microsoft.*ja/i) ||
      findMatchingVoice(/ja[-_]JP/i) ||
      findMatchingVoice(/^ja/i) ||
      voices.find((voice) => /ja/i.test(voice.lang) === true) ||
      null
    );
  }

  if (normalizedLocale.startsWith('ko') === true) {
    if (gender === GENDER_MAP.male) {
      matchedVoice = findMatchingVoice(/(InJoon|GookMin).*ko/i);
    } else if (gender === GENDER_MAP.female) {
      matchedVoice = findMatchingVoice(/(SunHi|Heami).*ko/i);
    }
    return (
      matchedVoice ||
      findMatchingVoice(/Microsoft.*ko/i) ||
      findMatchingVoice(/ko[-_]KR/i) ||
      findMatchingVoice(/^ko/i) ||
      voices.find((voice) => /ko/i.test(voice.lang) === true) ||
      null
    );
  }

  if (gender === GENDER_MAP.male) {
    matchedVoice = findMatchingVoice(
      /(YunJhe|YunJian|YunXia|雲哲|雲健|雲夏|Zhiwei|志偉).*zh/i
    );
  } else if (gender === GENDER_MAP.female) {
    matchedVoice =
      findMatchingVoice(/(HsiaoChen|HsiaoYu|曉臻|曉雨).*zh/i) ||
      findMatchingVoice(/(Yating|Hanhan|雅婷|涵涵).*zh[-_]TW/i);
  }

  return (
    matchedVoice ||
    findMatchingVoice(/Microsoft.*zh[-_]TW/i) ||
    findMatchingVoice(/zh[-_]TW/i) ||
    findMatchingVoice(/^zh/i) ||
    voices.find((voice) => /zh/i.test(voice.lang) === true) ||
    null
  );
}

/**
 * Splits a continuous long text into an array of short, speakable sentences for TTS playback.
 * Performs intelligent segmentation based on punctuation marks and sentence length limits, merging short fragments.
 *
 * @param text - Full raw text to segment.
 * @returns Array of segmented speakable sentences.
 */
export function splitSentences(text: string): string[] {
  const sentenceList: string[] = [];
  let currentBuffer = '';
  const rawText = typeof text === 'string' ? text : '';

  for (const character of rawText) {
    currentBuffer += character;
    if (/[。！？!?；;\n…]/.test(character) === true) {
      if (currentBuffer.trim() !== '') {
        sentenceList.push(currentBuffer.trim());
      }
      currentBuffer = '';
    } else if (currentBuffer.length >= 80) {
      const splitIndex = Math.max(
        currentBuffer.lastIndexOf('，'),
        currentBuffer.lastIndexOf(',')
      );
      if (splitIndex > 20) {
        sentenceList.push(currentBuffer.slice(0, splitIndex + 1).trim());
        currentBuffer = currentBuffer.slice(splitIndex + 1);
      } else {
        sentenceList.push(currentBuffer.trim());
        currentBuffer = '';
      }
    }
  }

  if (currentBuffer.trim() !== '') {
    sentenceList.push(currentBuffer.trim());
  }

  const mergedSentences: string[] = [];
  for (const sentence of sentenceList) {
    if (
      mergedSentences.length > 0 &&
      (sentence.length < 3 ||
        mergedSentences[mergedSentences.length - 1].length < 3)
    ) {
      mergedSentences[mergedSentences.length - 1] += sentence;
    } else {
      mergedSentences.push(sentence);
    }
  }

  while (mergedSentences.length > 10) {
    const combinedSentences: string[] = [];
    for (let index = 0; index < mergedSentences.length; index += 2) {
      const nextSentence =
        typeof mergedSentences[index + 1] === 'string'
          ? mergedSentences[index + 1]
          : '';
      combinedSentences.push(mergedSentences[index] + nextSentence);
    }
    mergedSentences.length = 0;
    mergedSentences.push(...combinedSentences);
  }

  return mergedSentences;
}

/**
 * Resolves the default neural voice model identifier for the specified language locale.
 *
 * @param locale - Language locale code (e.g., 'zh-TW', 'en-US', 'ja-JP', 'ko-KR').
 * @returns Default neural voice model identifier string.
 */
export function localeVoice(locale?: string): string {
  const normalizedLocale = typeof locale === 'string' ? locale : '';
  return /^en/i.test(normalizedLocale) === true
    ? 'en-US-JennyNeural'
    : /^ja/i.test(normalizedLocale) === true
      ? 'ja-JP-NanamiNeural'
      : /^ko/i.test(normalizedLocale) === true
        ? 'ko-KR-SunHiNeural'
        : 'zh-TW-HsiaoChenNeural';
}

/**
 * Creates and initializes the default Text-to-Speech (TTS) engine.
 * Manages neural voice API fetching, Web Audio playback, browser SpeechSynthesis fallback, and real-time lip sync viseme computation.
 *
 * @param options - Initialization options and event callbacks.
 * @returns Initialized TTS engine controller instance.
 */
export function initDefaultTTSEngine(
  options: TTSEngineOptions = {}
): TTSEngine {
  const {
    ttsEndpoint = '',
    neuralVoice = '',
    gender = GENDER_MAP.female,
    locale = 'zh-TW',
    onSpeakStart,
    onSpeakEnd,
    onSpeechWait,
    onSpokenDisplayTextChange
  } = options;

  const store = createBaseStore<InternalTTSEngineState>({
    ttsEndpoint,
    neuralVoice,
    gender,
    locale,
    isSpeaking: false,
    isMuted: false,
    speechQueue: [],
    speechController: null,
    audioCtx: null,
    audioSource: null,
    audioAnalyser: null,
    audioDataArray: null,
    mouthTimer: null,
    browserVoice: null,
    speakSeq: 0,
    isSpeechPlaying: false,
    speechEnded: false,
    tapDone: false,
    speakBrowserTimer: 0,
    currentFps: 0,
    currentSource: null,
    neuralDisabled: false,
    tapGreetingCacheKey: null,
    tapGreetingPrep: null,
    tapGreetingBuffer: null,
    ttsRate: 1.0,
    mouthTarget: 0.7,
    mouthValue: 0,
    audioMouth: 0,
    useAudioMouth: false
  });

  const state = store.getState();
  const activeTTSAbortControllers = new Set<AbortController>();

  const engine: TTSEngine = {
    subscribe: store.subscribe,
    getState: store.getState as () => TTSEngineState,
    setState: store.setState as (
      updates:
        | Partial<TTSEngineState>
        | ((state: TTSEngineState) => Partial<TTSEngineState>)
    ) => void,

    get isSpeaking(): boolean {
      return store.getState().isSpeaking;
    },
    get isMuted(): boolean {
      return store.getState().isMuted;
    },
    set isMuted(value: boolean) {
      store.setState({ isMuted: value });
    },

    get ttsRate(): number {
      return store.getState().ttsRate;
    },
    set ttsRate(newRate: number | undefined) {
      store.setState({
        ttsRate:
          typeof newRate === 'number' &&
          Number.isFinite(newRate) === true &&
          newRate > 0
            ? newRate
            : 1.0
      });
    },

    beginSpeech(): number {
      engine.stop();
      state.speechQueue = [];
      state.speechEnded = false;
      state.tapDone = false;
      state.isSpeechPlaying = false;
      state.useAudioMouth = false;
      state.audioMouth = 0;
      state.speakSeq += 1;
      return state.speakSeq;
    },

    pushSpeech(
      speechSequenceId: number,
      text: string,
      pushOptions: TTSSpeakOptions = {}
    ): void {
      if (speechSequenceId !== state.speakSeq || this.isMuted === true) {
        return;
      }
      const safeText = typeof text === 'string' ? text.trim() : '';
      if (safeText === '') {
        return;
      }
      state.speechQueue.push({
        text: safeText,
        prefetchPromise: null,
        error: null,
        instant: Boolean(pushOptions.instant)
      });
      prefetchSpeech(speechSequenceId);
      processSpeechQueue(speechSequenceId);
    },

    endSpeech(speechSequenceId: number): void {
      if (speechSequenceId !== state.speakSeq) {
        return;
      }
      state.speechEnded = true;
      processSpeechQueue(speechSequenceId);
    },

    speak(text: string, speakOptions: TTSSpeakOptions = {}): void {
      if (this.isMuted === true) {
        if (typeof onSpeakEnd === 'function') {
          onSpeakEnd();
        }
        return;
      }

      const safeText = (typeof text === 'string' ? text : '').slice(0, 600);
      if (
        speakOptions.updateDisplay !== false &&
        typeof onSpokenDisplayTextChange === 'function'
      ) {
        onSpokenDisplayTextChange(safeText);
      }

      const speechSequenceId = this.beginSpeech ? this.beginSpeech() : 1;
      for (const sentence of splitSentences(safeText)) {
        if (sentence.trim() === '') {
          continue;
        }
        if (typeof this.pushSpeech === 'function') {
          this.pushSpeech(speechSequenceId, sentence.trim(), speakOptions);
        }
      }
      if (typeof this.endSpeech === 'function') {
        this.endSpeech(speechSequenceId);
      }
    },

    stop(): void {
      state.speakSeq += 1;
      state.speechQueue = [];
      state.speechEnded = true;
      state.isSpeechPlaying = false;
      store.setState({ isSpeaking: false });
      for (const abortController of activeTTSAbortControllers) {
        try {
          abortController.abort();
        } catch (_error) {}
      }
      activeTTSAbortControllers.clear();
      try {
        if (
          typeof window === 'object' &&
          window !== null &&
          'speechSynthesis' in window &&
          window.speechSynthesis !== null
        ) {
          window.speechSynthesis.cancel();
        }
      } catch (_error) {}
      try {
        clearTimeout(state.speakBrowserTimer);
      } catch (_error) {}
      if (state.currentFps > 0) {
        cancelAnimationFrame(state.currentFps);
        state.currentFps = 0;
      }
      if (state.currentSource !== null) {
        try {
          state.currentSource.onended = null;
          state.currentSource.disconnect();
          state.currentSource.stop();
        } catch (_error) {}
        state.currentSource = null;
      }
      state.useAudioMouth = false;
      state.audioMouth = 0;
      state.mouthValue = 0;
    },

    computeMouth(): number {
      const currentState = store.getState();
      if (this.isSpeaking === true && currentState.useAudioMouth === true) {
        // Smooth opening response: lower coefficient to naturally transition without high-frequency jitter
        const smoothingFactor =
          currentState.audioMouth > currentState.mouthValue ? 0.42 : 0.22;
        currentState.mouthValue +=
          (currentState.audioMouth - currentState.mouthValue) * smoothingFactor;
      } else if (this.isSpeaking === true) {
        // Browser voice / fallback mode: sample at natural speaking rhythm (~1.6/sec) with smooth lerp
        const currentTimeInSeconds = performance.now() / 1000;
        const targetMouth =
          0.06 +
          0.68 *
            currentState.mouthTarget *
            Math.pow(Math.sin(currentTimeInSeconds * 5.2), 2);
        currentState.mouthValue +=
          (targetMouth - currentState.mouthValue) * 0.32;
      } else {
        // Smooth fade-out close when stopped speaking
        currentState.mouthValue = Math.max(0, currentState.mouthValue - 0.12);
      }
      return currentState.mouthValue;
    },

    setGender(newGender: string): void {
      store.setState({
        gender: newGender,
        browserVoice: loadVoice(newGender, store.getState().locale)
      });
    },

    get locale(): string {
      const currentLocale = store.getState().locale;
      return typeof currentLocale === 'string' && currentLocale !== ''
        ? currentLocale
        : 'zh-TW';
    },

    setLocale(localeStr: string): void {
      const targetLocale = typeof localeStr === 'string' ? localeStr : '';
      const matchedLocale =
        ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'].find(
          (supportedLocale) =>
            supportedLocale.toLowerCase() === targetLocale.toLowerCase()
        ) || 'zh-TW';
      store.setState({
        locale: matchedLocale,
        neuralVoice: localeVoice(matchedLocale),
        browserVoice: loadVoice(store.getState().gender, matchedLocale)
      });
    },

    preloadTapGreeting(text: string): Promise<AudioBuffer | null> {
      if (state.neuralDisabled === true) {
        return Promise.resolve(null);
      }
      const currentState = store.getState();
      const cacheKey = currentState.neuralVoice + '\n' + text;
      if (
        currentState.tapGreetingPrep !== null &&
        currentState.tapGreetingPrep !== undefined &&
        currentState.tapGreetingCacheKey === cacheKey
      ) {
        return currentState.tapGreetingPrep;
      }
      currentState.tapGreetingCacheKey = cacheKey;
      currentState.tapGreetingBuffer = null;
      currentState.tapGreetingPrep = fetchTTSBuffer(text, true)
        .then((audioBuffer) => {
          if (currentState.tapGreetingCacheKey === cacheKey) {
            currentState.tapGreetingBuffer = audioBuffer;
          }
          return audioBuffer;
        })
        .catch((error: unknown) => {
          if (currentState.tapGreetingCacheKey === cacheKey) {
            currentState.tapGreetingPrep = null;
            currentState.tapGreetingBuffer = null;
          }
          throw error;
        });
      return currentState.tapGreetingPrep;
    }
  };

  const getAudioContext = async (): Promise<AudioContext | null> => {
    const currentState = store.getState();
    const AudioContextClass =
      typeof window === 'object' && window !== null
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : null;
    if (
      typeof AudioContextClass === 'function' &&
      (currentState.audioCtx instanceof AudioContextClass === false ||
        currentState.audioCtx === null)
    ) {
      store.setState({ audioCtx: new AudioContextClass() });
    }
    const currentAudioContext = store.getState().audioCtx;
    if (
      currentAudioContext !== null &&
      typeof currentAudioContext === 'object' &&
      currentAudioContext.state === 'suspended'
    ) {
      try {
        await currentAudioContext.resume();
      } catch (_error) {}
    }
    return currentAudioContext;
  };

  const fetchTTSBuffer = async (
    text: string,
    isPersistent: boolean = false
  ): Promise<AudioBuffer> => {
    const audioContext = await getAudioContext();
    if (audioContext === null) {
      throw new Error('AudioContext not available');
    }
    const currentState = store.getState();
    const abortController = new AbortController();
    if (isPersistent !== true) {
      activeTTSAbortControllers.add(abortController);
    }
    const querySeparator =
      currentState.ttsEndpoint.indexOf('?') < 0 ? '?' : '&';
    try {
      const response = await fetch(
        currentState.ttsEndpoint +
          querySeparator +
          'voice=' +
          encodeURIComponent(currentState.neuralVoice) +
          '&text=' +
          encodeURIComponent(text),
        { signal: abortController.signal }
      );
      if (response.ok === false) {
        throw new Error('http ' + response.status);
      }
      const responseArrayBuffer = await response.arrayBuffer();
      if (responseArrayBuffer.byteLength < 800) {
        throw new Error('audio too small');
      }
      return await audioContext.decodeAudioData(responseArrayBuffer);
    } finally {
      if (isPersistent !== true) {
        activeTTSAbortControllers.delete(abortController);
      }
    }
  };

  const prefetchSpeech = (speechSequenceId: number): void => {
    if (speechSequenceId !== state.speakSeq || state.neuralDisabled === true) {
      return;
    }
    for (const queueItem of state.speechQueue.slice(0, 2)) {
      if (queueItem.prefetchPromise === null && queueItem.error === null) {
        queueItem.prefetchPromise = fetchTTSBuffer(queueItem.text).catch(
          (error: Error) => {
            queueItem.error = error;
            return null;
          }
        );
      }
    }
  };

  const playBuffer = (
    audioBuffer: AudioBuffer,
    onPlayCompleted?: () => void
  ): void => {
    const currentState = store.getState();
    if (currentState.audioCtx === null) {
      return;
    }
    const bufferSourceNode = currentState.audioCtx.createBufferSource();
    bufferSourceNode.buffer = audioBuffer;
    if (typeof currentState.ttsRate === 'number' && currentState.ttsRate > 0) {
      bufferSourceNode.playbackRate.value = currentState.ttsRate;
    }
    const analyserNode = currentState.audioCtx.createAnalyser();
    analyserNode.fftSize = 128;
    analyserNode.smoothingTimeConstant = 0;
    bufferSourceNode.connect(analyserNode);
    analyserNode.connect(currentState.audioCtx.destination);
    const timeDomainData = new Uint8Array(analyserNode.fftSize);
    currentState.currentSource = bufferSourceNode;
    currentState.useAudioMouth = true;
    store.setState({ isSpeaking: true });
    currentState.audioMouth = 0.12;
    currentState.mouthValue = Math.max(currentState.mouthValue, 0.12);

    if (currentState.tapDone !== true) {
      currentState.tapDone = true;
      if (typeof onSpeakStart === 'function') {
        onSpeakStart();
      }
    }

    function runAudioVisualizationLoop(): void {
      if (currentState.currentSource !== bufferSourceNode) {
        return;
      }
      analyserNode.getByteTimeDomainData(timeDomainData);
      let sumOfSquares = 0;
      for (
        let sampleIndex = 0;
        sampleIndex < timeDomainData.length;
        sampleIndex += 1
      ) {
        const normalizedSample = (timeDomainData[sampleIndex] - 128) / 128;
        sumOfSquares += normalizedSample * normalizedSample;
      }
      const rootMeanSquare = Math.sqrt(sumOfSquares / timeDomainData.length);
      currentState.audioMouth = Math.min(
        1,
        Math.max(0, (rootMeanSquare - 0.006) * 5.2)
      );
      currentState.currentFps = requestAnimationFrame(
        runAudioVisualizationLoop
      );
    }
    currentState.currentFps = requestAnimationFrame(runAudioVisualizationLoop);
    bufferSourceNode.onended = () => {
      if (currentState.currentSource !== bufferSourceNode) {
        return;
      }
      if (currentState.currentFps > 0) {
        cancelAnimationFrame(currentState.currentFps);
        currentState.currentFps = 0;
      }
      store.setState({ isSpeaking: false });
      currentState.useAudioMouth = false;
      currentState.audioMouth = 0;
      currentState.currentSource = null;
      if (typeof onPlayCompleted === 'function') {
        onPlayCompleted();
      }
    };
    bufferSourceNode.start(0);
  };

  const handleNeuralVoiceError = (error: unknown): void => {
    const currentState = store.getState();
    const errorMessage =
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : '';
    if (/http 429/.test(errorMessage) === true) {
      console.warn(
        '[AvatarBot] TTS rate limited, falling back to browser synthesis for this sentence'
      );
      return;
    }
    if (
      /http 4\d\d|Failed to fetch|NetworkError|Load failed/i.test(
        errorMessage
      ) === true
    ) {
      currentState.neuralDisabled = true;
    }
    console.warn(
      '[AvatarBot] Neural TTS failed, falling back to browser synthesis:',
      errorMessage
    );
  };

  const speakBrowserChunk = (
    text: string,
    speechSequenceId: number,
    onChunkCompleted?: () => void
  ): void => {
    if (
      engine.isMuted === true ||
      typeof window !== 'object' ||
      window === null ||
      'speechSynthesis' in window === false ||
      window.speechSynthesis === null
    ) {
      if (typeof onChunkCompleted === 'function') {
        onChunkCompleted();
      }
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const currentState = store.getState();
    if (currentState.browserVoice === null) {
      store.setState({ browserVoice: loadVoice(currentState.gender) });
    }
    const currentVoice = store.getState().browserVoice;
    if (currentVoice !== null && currentVoice !== undefined) {
      utterance.voice = currentVoice;
    }
    utterance.lang = currentVoice?.lang || currentState.locale;
    utterance.rate =
      typeof currentState.ttsRate === 'number' && currentState.ttsRate > 0
        ? currentState.ttsRate
        : 1.0;
    utterance.pitch = 1.0;
    utterance.onboundary = () => {
      currentState.mouthTarget = 0.5 + Math.random() * 0.5;
    };
    let isFinished = false;
    const handleFinish = (): void => {
      if (isFinished === true) {
        return;
      }
      isFinished = true;
      store.setState({ isSpeaking: false });
      if (typeof onChunkCompleted === 'function') {
        onChunkCompleted();
      }
    };
    utterance.onend = handleFinish;
    const effectiveRate =
      typeof currentState.ttsRate === 'number' && currentState.ttsRate > 0
        ? currentState.ttsRate
        : 1.0;
    const estimatedDurationMs = Math.min(
      16000,
      Math.max(1200, (text.length * 130) / effectiveRate)
    );

    const playUtterance = (): void => {
      if (speechSequenceId !== state.speakSeq) {
        return;
      }
      try {
        window.speechSynthesis.resume();
      } catch (_error) {}
      window.speechSynthesis.speak(utterance);
      store.setState({ isSpeaking: true });
      currentState.mouthTarget = 0.7;
      if (currentState.tapDone !== true) {
        currentState.tapDone = true;
        if (typeof onSpeakStart === 'function') {
          onSpeakStart();
        }
      }
      currentState.speakBrowserTimer = setTimeout(
        handleFinish,
        estimatedDurationMs
      );
    };
    if (
      window.speechSynthesis.speaking === true ||
      window.speechSynthesis.pending === true
    ) {
      window.speechSynthesis.cancel();
      setTimeout(playUtterance, 120);
    } else {
      playUtterance();
    }
  };

  const processSpeechQueue = async (
    speechSequenceId: number
  ): Promise<void> => {
    if (state.isSpeechPlaying === true || speechSequenceId !== state.speakSeq) {
      return;
    }
    const speechItem = state.speechQueue.shift();
    if (speechItem === undefined) {
      if (state.speechEnded === true) {
        store.setState({ isSpeaking: false });
        if (typeof onSpeakEnd === 'function') {
          onSpeakEnd();
        }
      } else {
        store.setState({ isSpeaking: false });
        if (typeof onSpeechWait === 'function') {
          onSpeechWait(speechSequenceId);
        }
      }
      return;
    }
    state.isSpeechPlaying = true;
    const handleChunkDone = (): void => {
      if (speechSequenceId !== state.speakSeq) {
        return;
      }
      state.isSpeechPlaying = false;
      prefetchSpeech(speechSequenceId);
      processSpeechQueue(speechSequenceId);
    };

    const cachedGreetingKey =
      typeof state.tapGreetingCacheKey === 'string'
        ? state.tapGreetingCacheKey.split('\n')[1]
        : undefined;
    if (
      speechItem.instant === true &&
      state.tapGreetingBuffer === null &&
      speechItem.text === cachedGreetingKey
    ) {
      engine.preloadTapGreeting(speechItem.text);
      speakBrowserChunk(speechItem.text, speechSequenceId, handleChunkDone);
      return;
    }

    let audioBuffer: AudioBuffer | null = null;
    if (state.neuralDisabled !== true && speechItem.error === null) {
      if (speechItem.prefetchPromise === null) {
        speechItem.prefetchPromise = fetchTTSBuffer(speechItem.text).catch(
          (error: Error) => {
            speechItem.error = error;
            return null;
          }
        );
      }
      audioBuffer = await speechItem.prefetchPromise;
    }
    if (speechSequenceId !== state.speakSeq) {
      return;
    }
    if (audioBuffer !== null) {
      prefetchSpeech(speechSequenceId);
      playBuffer(audioBuffer, handleChunkDone);
    } else {
      if (speechItem.error !== null) {
        handleNeuralVoiceError(speechItem.error);
      }
      speakBrowserChunk(speechItem.text, speechSequenceId, handleChunkDone);
    }
  };

  if (
    typeof window === 'object' &&
    window !== null &&
    'speechSynthesis' in window === true &&
    window.speechSynthesis !== null
  ) {
    window.speechSynthesis.onvoiceschanged = () => {
      if (state.browserVoice === null) {
        state.browserVoice = loadVoice(state.gender);
      }
    };
    state.browserVoice = loadVoice(state.gender);
  }

  return engine;
}
