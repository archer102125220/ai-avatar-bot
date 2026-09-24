import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateTTSEngine,
  loadVoice,
  splitSentences,
  localeVoice,
  initDefaultTTSEngine
} from '@/core/speech/tts';
import { GENDER_MAP } from '@/core/constants';
import type { TTSEngine } from '@core';

describe('Unit Test: core/speech/tts.js', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateTTSEngine', () => {
    it('should report missing methods when invalid or non-object engine is passed', () => {
      expect(validateTTSEngine(null).isValid).toBe(false);
      expect(validateTTSEngine(null).missing).toContain('engine instance');

      const result = validateTTSEngine({});
      expect(result.isValid).toBe(false);
      expect(result.missing).toContain('speak()');
      expect(result.missing).toContain('stop()');
      expect(result.missing).toContain('computeMouth()');
      expect(result.missing).toContain('setGender()');
      expect(result.missing).toContain('setLocale()');
      expect(result.missing).toContain('isSpeaking');
      expect(result.missing).toContain('isMuted');
    });

    it('should pass validation for valid engine implementation', () => {
      const engine = {
        speak: vi.fn(),
        stop: vi.fn(),
        computeMouth: vi.fn(),
        setGender: vi.fn(),
        setLocale: vi.fn(),
        isSpeaking: false,
        isMuted: false
      };
      const result = validateTTSEngine(engine);
      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe('splitSentences', () => {
    it('should split text into sentences by punctuation marks', () => {
      const text = '你好！我是虛擬人。很高興認識你？今天天氣真好～';
      const sentences = splitSentences(text);

      expect(sentences).toEqual([
        '你好！',
        '我是虛擬人。',
        '很高興認識你？',
        '今天天氣真好～'
      ]);
    });

    it('should split long sentences exceeding 80 characters with comma', () => {
      const longTextWithComma =
        '這是一段非常非常非常長的一段測試用文本用來測試切分機制'.repeat(2) +
        '，' +
        '而後半段依然是非常非常長的一段文字必須要在逗號處切開'.repeat(2);
      const sentences = splitSentences(longTextWithComma);
      expect(sentences.length).toBeGreaterThan(1);
    });

    it('should split long sentences exceeding 80 characters without comma', () => {
      const longTextNoComma = '測試'.repeat(50);
      const sentences = splitSentences(longTextNoComma);
      expect(sentences.length).toBeGreaterThan(1);
    });

    it('should merge very short sentence fragments (< 3 chars)', () => {
      const shortFragments = '好。的。沒問題！';
      const sentences = splitSentences(shortFragments);
      expect(sentences.length).toBeLessThanOrEqual(2);
    });

    it('should merge when sentence count exceeds 10', () => {
      const manySentences = Array.from({ length: 15 }, (_, i) => `第${i}句。`).join('');
      const sentences = splitSentences(manySentences);
      expect(sentences.length).toBeLessThanOrEqual(10);
    });

    it('should return whole text if no punctuation exists', () => {
      expect(splitSentences('這是一段沒有標點符號的文字')).toEqual([
        '這是一段沒有標點符號的文字'
      ]);
      expect(splitSentences('')).toEqual([]);
      expect(splitSentences(null as unknown as string)).toEqual([]);
    });
  });

  describe('localeVoice', () => {
    it('should return correct default neural voices for each supported locale', () => {
      expect(localeVoice('en-US')).toBe('en-US-JennyNeural');
      expect(localeVoice('ja-JP')).toBe('ja-JP-NanamiNeural');
      expect(localeVoice('ko-KR')).toBe('ko-KR-SunHiNeural');
      expect(localeVoice('zh-TW')).toBe('zh-TW-HsiaoChenNeural');
      expect(localeVoice('')).toBe('zh-TW-HsiaoChenNeural');
    });
  });

  describe('loadVoice', () => {
    it('should return null when speechSynthesis is not supported', () => {
      const origSpeech = window.speechSynthesis;
      Reflect.deleteProperty(window, 'speechSynthesis');
      expect(loadVoice('female', 'zh-TW')).toBeNull();
      Object.defineProperty(window, 'speechSynthesis', {
        value: origSpeech,
        configurable: true,
        writable: true
      });
    });

    it('should match en-US male and female voices', () => {
      const mockVoices = [
        { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US' }
      ];
      vi.spyOn(speechSynthesis, 'getVoices').mockReturnValue(mockVoices as unknown as SpeechSynthesisVoice[]);

      const maleVoice = loadVoice(GENDER_MAP.male, 'en-US');
      expect(maleVoice?.name).toContain('Guy');

      const femaleVoice = loadVoice(GENDER_MAP.female, 'en-US');
      expect(femaleVoice?.name).toContain('Jenny');
    });

    it('should match ja-JP male and female voices', () => {
      const mockVoices = [
        { name: 'Microsoft Keita Online (Natural) - Japanese (Japan)', lang: 'ja-JP' },
        { name: 'Microsoft Nanami Online (Natural) - Japanese (Japan)', lang: 'ja-JP' }
      ];
      vi.spyOn(speechSynthesis, 'getVoices').mockReturnValue(mockVoices as unknown as SpeechSynthesisVoice[]);

      const maleVoice = loadVoice(GENDER_MAP.male, 'ja-JP');
      expect(maleVoice?.name).toContain('Keita');

      const femaleVoice = loadVoice(GENDER_MAP.female, 'ja-JP');
      expect(femaleVoice?.name).toContain('Nanami');
    });

    it('should match ko-KR male and female voices', () => {
      const mockVoices = [
        { name: 'Microsoft InJoon Online (Natural) - Korean (Korea)', lang: 'ko-KR' },
        { name: 'Microsoft SunHi Online (Natural) - Korean (Korea)', lang: 'ko-KR' }
      ];
      vi.spyOn(speechSynthesis, 'getVoices').mockReturnValue(mockVoices as unknown as SpeechSynthesisVoice[]);

      const maleVoice = loadVoice(GENDER_MAP.male, 'ko-KR');
      expect(maleVoice?.name).toContain('InJoon');

      const femaleVoice = loadVoice(GENDER_MAP.female, 'ko-KR');
      expect(femaleVoice?.name).toContain('SunHi');
    });

    it('should match zh-TW male and female voices', () => {
      const mockVoices = [
        { name: 'Microsoft YunJhe Online (Natural) - Chinese (Taiwan)', lang: 'zh-TW' },
        { name: 'Microsoft HsiaoChen Online (Natural) - Chinese (Taiwan)', lang: 'zh-TW' }
      ];
      vi.spyOn(speechSynthesis, 'getVoices').mockReturnValue(mockVoices as unknown as SpeechSynthesisVoice[]);

      const maleVoice = loadVoice(GENDER_MAP.male, 'zh-TW');
      expect(maleVoice?.name).toContain('YunJhe');

      const femaleVoice = loadVoice(GENDER_MAP.female, 'zh-TW');
      expect(femaleVoice?.name).toContain('HsiaoChen');
    });
  });

  describe('initDefaultTTSEngine', () => {
    it('should handle isMuted and ttsRate getters and setters', () => {
      const tts: TTSEngine = initDefaultTTSEngine();
      expect(tts.isMuted).toBe(false);

      tts.isMuted = true;
      expect(tts.isMuted).toBe(true);

      expect(tts.ttsRate).toBe(1.0);
      tts.ttsRate = 1.5;
      expect(tts.ttsRate).toBe(1.5);
      // invalid rate guard
      tts.ttsRate = -0.5;
      expect(tts.ttsRate).toBe(1.0);
    });

    it('should early return and trigger onSpeakEnd when isMuted is true in speak()', () => {
      const onSpeakEnd = vi.fn();
      const tts: TTSEngine = initDefaultTTSEngine({ onSpeakEnd });
      tts.isMuted = true;

      tts.speak('這句不會播放');
      expect(onSpeakEnd).toHaveBeenCalled();
    });

    it('should manage beginSpeech, pushSpeech, and endSpeech queue transitions', () => {
      const onSpeechWait = vi.fn();
      const onSpeakEnd = vi.fn();
      const tts: TTSEngine = initDefaultTTSEngine({ onSpeechWait, onSpeakEnd });

      const seq = tts.beginSpeech?.() ?? 1;
      expect(seq).toBeGreaterThan(0);

      // push with wrong seq or empty string
      tts.pushSpeech?.(seq + 99, '無視');
      tts.pushSpeech?.(seq, '   ');

      // push valid text
      tts.pushSpeech?.(seq, '第一句。');
      tts.endSpeech?.(seq);
    });

    it('should compute smooth mouth openness in different speaking states', () => {
      const tts: TTSEngine = initDefaultTTSEngine();

      // State 1: isSpeaking = false (closing mouth)
      tts.setState({ isSpeaking: false, mouthValue: 0.5 });
      const val1 = tts.computeMouth();
      expect(val1).toBeLessThan(0.5);

      // State 2: isSpeaking = true, useAudioMouth = false (browser rhythm simulation)
      tts.setState({ isSpeaking: true, useAudioMouth: false, mouthTarget: 0.8, mouthValue: 0.2 });
      const val2 = tts.computeMouth();
      expect(val2).toBeGreaterThanOrEqual(0);

      // State 3: isSpeaking = true, useAudioMouth = true (audio responsive)
      tts.setState({ isSpeaking: true, useAudioMouth: true, audioMouth: 0.9, mouthValue: 0.3 });
      const val3 = tts.computeMouth();
      expect(val3).toBeGreaterThan(0.3);

      tts.setState({ isSpeaking: true, useAudioMouth: true, audioMouth: 0.1, mouthValue: 0.5 });
      const val4 = tts.computeMouth();
      expect(val4).toBeLessThan(0.5);
    });

    it('should stop active playback and clear state in stop()', () => {
      const tts: TTSEngine = initDefaultTTSEngine();
      tts.setState({
        isSpeaking: true,
        speechQueue: [{ text: '測試', prefetchPromise: null, error: null, instant: false }],
        audioMouth: 0.8,
        mouthValue: 0.8
      });

      tts.stop();

      expect(tts.isSpeaking).toBe(false);
      expect(tts.getState().speechQueue).toEqual([]);
      expect(tts.getState().audioMouth).toBe(0);
      expect(tts.getState().mouthValue).toBe(0);
    });

    it('should update gender and locale with matched voice', () => {
      const tts: TTSEngine = initDefaultTTSEngine();
      tts.setGender(GENDER_MAP.male);
      expect(tts.getState().gender).toBe(GENDER_MAP.male);

      tts.setLocale('ja-JP');
      expect(tts.locale).toBe('ja-JP');
      expect(tts.getState().neuralVoice).toBe('ja-JP-NanamiNeural');
    });

    it('should handle preloadTapGreeting caching and neuralDisabled state', async () => {
      const tts: TTSEngine = initDefaultTTSEngine({ ttsEndpoint: 'https://tts.example.com/api' });

      // neuralDisabled: true
      (tts as unknown as { setState: (s: Record<string, unknown>) => void }).setState({ neuralDisabled: true });
      const resNull = await tts.preloadTapGreeting('哈囉');
      expect(resNull).toBeNull();

      (tts as unknown as { setState: (s: Record<string, unknown>) => void }).setState({ neuralDisabled: false });

      // mock global fetch
      const mockAudioBuffer = { duration: 1.5 };
      (window as unknown as { AudioContext: unknown }).AudioContext = class MockAudioContext {
        decodeAudioData() {
          return Promise.resolve(mockAudioBuffer);
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024)
      });

      const buffer = await tts.preloadTapGreeting('歡迎光臨');
      expect(buffer).toBe(mockAudioBuffer);

      // cached retrieval
      const cached = await tts.preloadTapGreeting('歡迎光臨');
      expect(cached).toBe(mockAudioBuffer);
    });

    it('should trigger onvoiceschanged and playBuffer with audio context during neural speech', async () => {
      const mockBufferSource = {
        buffer: null as AudioBuffer | null,
        playbackRate: { value: 1.0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null
      };

      const mockAnalyser = {
        fftSize: 2048,
        smoothingTimeConstant: 0.8,
        frequencyBinCount: 1024,
        getByteFrequencyData: vi.fn(),
        getByteTimeDomainData: vi.fn(),
        connect: vi.fn()
      };

      const mockAudioBuffer = { duration: 1.0 };
      (window as unknown as { AudioContext: unknown }).AudioContext = class MockAudioContext {
        destination = {};
        state = 'suspended';
        createBufferSource() {
          return mockBufferSource;
        }
        createAnalyser() {
          return mockAnalyser;
        }
        decodeAudioData() {
          return Promise.resolve(mockAudioBuffer);
        }
        resume() {
          this.state = 'running';
          return Promise.resolve();
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024)
      });

      const onSpeakEnd = vi.fn();
      const tts: TTSEngine = initDefaultTTSEngine({
        ttsEndpoint: 'https://tts.example.com/api?existing=1',
        onSpeakEnd
      });

      // Trigger voiceschanged
      if (typeof window.speechSynthesis?.onvoiceschanged === 'function') {
        (window.speechSynthesis as unknown as { onvoiceschanged: () => void }).onvoiceschanged();
      }

      // Speak neural chunk
      tts.speak('神經語音測試');
      // Wait for fetch & decode microtasks and queue processing
      await new Promise((r) => setTimeout(r, 50));

      expect(mockBufferSource.start).toHaveBeenCalled();

      // Trigger onended
      if (typeof mockBufferSource.onended === 'function') {
        mockBufferSource.onended();
      }
      expect(onSpeakEnd).toHaveBeenCalled();
    });

    it('should handle small audio buffer error (< 800 bytes) and HTTP errors in fetchTTSBuffer', async () => {
      (window as unknown as { AudioContext: unknown }).AudioContext = class MockAudioContext {
        decodeAudioData() {
          return Promise.resolve({});
        }
      };

      // 1. Audio too small
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(100) // < 800 bytes
      });

      const tts: TTSEngine = initDefaultTTSEngine({ ttsEndpoint: 'https://tts.example.com/api' });
      await expect(tts.preloadTapGreeting('太短的音訊')).rejects.toThrow('audio too small');

      // 2. HTTP error
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503
      });
      await expect(tts.preloadTapGreeting('伺服器錯誤')).rejects.toThrow('http 503');
    });

    it('should fallback to browser speech synthesis when ttsEndpoint is empty', async () => {
      class MockUtterance {
        static latest: MockUtterance | null = null;
        text: string;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((err: unknown) => void) | null = null;
        constructor(text: string) {
          this.text = text;
          MockUtterance.latest = this;
        }
      }
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = MockUtterance;

      window.speechSynthesis.speak = vi.fn((utt: SpeechSynthesisUtterance) => {
        if (typeof utt.onstart === 'function') {
          utt.onstart({} as SpeechSynthesisEvent);
        }
      });

      const onSpeechWait = vi.fn();
      const onSpeakEnd = vi.fn();
      const tts: TTSEngine = initDefaultTTSEngine({
        ttsEndpoint: '', // Pure browser mode
        onSpeechWait,
        onSpeakEnd
      });

      tts.speak('瀏覽器原生語音合成測試');
      await new Promise((r) => setTimeout(r, 50));
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
      expect(tts.isSpeaking).toBe(true);

      // Trigger onend
      if (typeof MockUtterance.latest?.onend === 'function') {
        MockUtterance.latest.onend();
      }
      expect(tts.isSpeaking).toBe(false);
      expect(onSpeakEnd).toHaveBeenCalled();
    });

    it('should handle onvoiceschanged event and reload browser voice when null', () => {
      let voicesChangedCb: ((ev?: Event) => void) | null = null;
      Object.defineProperty(window.speechSynthesis, 'onvoiceschanged', {
        set(cb: ((ev?: Event) => void) | null) {
          voicesChangedCb = cb;
        },
        get() {
          return voicesChangedCb;
        },
        configurable: true
      });

      const tts: TTSEngine = initDefaultTTSEngine();
      expect(typeof voicesChangedCb).toBe('function');
      (voicesChangedCb as ((ev?: Event) => void) | null)?.();
      expect(tts.getState().browserVoice).toBeDefined();
    });

    it('should handle pending or active speech synthesis cancel and boundary events', async () => {
      class MockUtterance {
        static latest: MockUtterance | null = null;
        text: string;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onboundary: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
          MockUtterance.latest = this;
        }
      }
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = MockUtterance;

      const synth = window.speechSynthesis as unknown as {
        speaking: boolean;
        pending: boolean;
        cancel: ReturnType<typeof vi.fn>;
        resume: ReturnType<typeof vi.fn>;
      };
      synth.speaking = true;
      synth.pending = true;
      window.speechSynthesis.cancel = vi.fn(() => {
        synth.speaking = false;
        synth.pending = false;
      });
      synth.resume = vi.fn(() => {
        throw new Error('Resume failed');
      });

      const onSpeakStart = vi.fn();
      const tts: TTSEngine = initDefaultTTSEngine({
        ttsEndpoint: '',
        onSpeakStart
      });

      tts.speak('測試打斷與邊界事件');
      await new Promise((r) => setTimeout(r, 160));

      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
      expect(tts.isSpeaking).toBe(true);

      // Trigger boundary event
      if (typeof MockUtterance.latest?.onboundary === 'function') {
        MockUtterance.latest.onboundary();
        expect(tts.getState().mouthTarget).toBeGreaterThanOrEqual(0.5);
      }

      // Finish utterance
      if (typeof MockUtterance.latest?.onend === 'function') {
        MockUtterance.latest.onend();
      }
      expect(tts.isSpeaking).toBe(false);
    });

    it('should handle neural TTS rate limiting and network error fallback', async () => {
      const tts: TTSEngine = initDefaultTTSEngine({
        ttsEndpoint: 'https://tts.example.com/api'
      });

      // 1. Rate limited 429
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429
      });
      const seq1 = tts.beginSpeech?.() ?? 1;
      tts.pushSpeech?.(seq1, '頻率限制測試');
      tts.endSpeech?.(seq1);
      await new Promise((r) => setTimeout(r, 50));
      expect((tts.getState() as unknown as { neuralDisabled: boolean }).neuralDisabled).toBe(false);

      // 2. Fatal 404 / Network error disables neural TTS
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404
      });
      const seq2 = tts.beginSpeech?.() ?? 2;
      tts.pushSpeech?.(seq2, '網路錯誤測試');
      tts.endSpeech?.(seq2);
      await new Promise((r) => setTimeout(r, 50));
      expect((tts.getState() as unknown as { neuralDisabled: boolean }).neuralDisabled).toBe(true);
    });

    it('should trigger preloadTapGreeting and instant browser speak when tapGreetingBuffer is null and neural is disabled', async () => {
      class MockUtterance {
        static latest: MockUtterance | null = null;
        text: string;
        onend: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
          MockUtterance.latest = this;
        }
      }
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = MockUtterance;

      const tts: TTSEngine = initDefaultTTSEngine({
        ttsEndpoint: 'https://tts.example.com/api'
      });

      (tts as unknown as { setState: (s: Record<string, unknown>) => void }).setState({
        neuralDisabled: true,
        tapGreetingBuffer: null
      });

      const seq = tts.beginSpeech?.() ?? 1;
      tts.pushSpeech?.(seq, '哈囉你好！', { instant: true });
      tts.endSpeech?.(seq);

      await new Promise((r) => setTimeout(r, 50));
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
      if (MockUtterance.latest?.onend) {
        MockUtterance.latest.onend();
      }
    });

    it('should test fetchTTSBuffer rejection in playNextChunk and onvoiceschanged handler', async () => {
      // 1. fetch rejecting with network error during playNextChunk
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const tts: TTSEngine = initDefaultTTSEngine({
        ttsEndpoint: 'https://tts.example.com/api'
      });

      const seq = tts.beginSpeech?.() ?? 1;
      tts.pushSpeech?.(seq, '斷線合成測試');
      tts.endSpeech?.(seq);

      await new Promise((r) => setTimeout(r, 50));
      expect(window.speechSynthesis.speak).toHaveBeenCalled();

      // 2. onvoiceschanged event handler
      tts.setState({ browserVoice: null });
      if (typeof window.speechSynthesis.onvoiceschanged === 'function') {
        (window.speechSynthesis as unknown as { onvoiceschanged: () => void }).onvoiceschanged();
        expect(tts.getState().browserVoice).toBeDefined();
      }
    });
  });
});
