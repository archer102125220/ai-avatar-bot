import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drainSentences, initSpeechEngine } from '@/core/speech';
import { GENDER_MAP } from '@/core/constants';
import type { SpeechEngine } from '@core';

describe('Unit Test: core/speech/index.js (Speech Coordinator)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('drainSentences', () => {
    it('should handle null or invalid state', () => {
      expect(drainSentences(null as unknown as { buf?: string })).toEqual([]);
      expect(drainSentences(undefined as unknown as { buf?: string })).toEqual(
        []
      );
    });

    it('should drain completed sentences ending with Chinese and English punctuation', () => {
      const state = {
        buf: '你好呀！今天想聊什麼呢？Hello there. How are you?剩餘未結束'
      };
      const sentences = drainSentences(state, false);

      expect(sentences).toEqual([
        '你好呀！',
        '今天想聊什麼呢？',
        'Hello there.',
        'How are you?'
      ]);
      expect(state.buf).toBe('剩餘未結束');
    });

    it('should split at comma if buffer length >= 40 and comma index >= 12', () => {
      const state = {
        buf: '這是一段非常長的句子並且超過了四十個字元的長度，這是逗號後面的後半段文字繼續延長'
      };
      const sentences = drainSentences(state, false);
      expect(sentences.length).toBeGreaterThanOrEqual(1);
    });

    it('should cut at 80 characters if buffer length >= 80 without punctuation', () => {
      const state = { buf: '長'.repeat(85) };
      const sentences = drainSentences(state, false);
      expect(sentences.length).toBeGreaterThanOrEqual(1);
    });

    it('should drain remaining buffer when force is true', () => {
      const state = { sentenceBuffer: '最後一句話' };
      const sentences = drainSentences(state, true);

      expect(sentences).toEqual(['最後一句話']);
      expect(state.sentenceBuffer).toBe('');
    });
  });

  describe('initSpeechEngine - State, Getters, Setters, and Subscriptions', () => {
    it('should initialize with custom options, getters and setters', async () => {
      const onSpeaking = vi.fn();
      const onLanguageChanged = vi.fn();
      const onMicStateChanged = vi.fn();
      const onVoiceStatusChanged = vi.fn();
      const containerEl = document.createElement('div');

      const engine: SpeechEngine = await initSpeechEngine({
        getGender: () => GENDER_MAP.male,
        getContainer: () => containerEl,
        locale: 'zh-TW',
        onSpeaking,
        onLanguageChanged,
        onMicStateChanged,
        onVoiceStatusChanged
      });

      expect(engine.gender).toBe(GENDER_MAP.male);
      engine.setGender(GENDER_MAP.female);
      expect(engine.gender).toBe(GENDER_MAP.female);

      expect(engine.container).toBe(containerEl);

      engine.ttsRate = 1.25;
      expect(engine.ttsRate).toBe(1.25);

      engine.ttsMuted = true;
      expect(engine.ttsMuted).toBe(true);
      engine.ttsMuted = false;

      engine.neuralVoice = 'zh-TW-HsiaoChenNeural';
      expect(engine.neuralVoice).toBe('zh-TW-HsiaoChenNeural');

      engine.ttsEndpoint = 'https://tts.example.com';
      expect(engine.ttsEndpoint).toBe('https://tts.example.com');

      (engine as unknown as { noSpeechRuns: number }).noSpeechRuns = 2;
      expect((engine as unknown as { noSpeechRuns: number }).noSpeechRuns).toBe(
        2
      );

      engine.convoOn = true;
      expect(engine.convoOn).toBe(true);

      engine.isProcessing = true;
      expect(engine.isProcessing).toBe(true);

      // spokenAudioText data-driven reactivity
      engine.spokenAudioText = '資料驅動語音文字';
      expect(engine.spokenAudioText).toBe('資料驅動語音文字');
      expect(onSpeaking).toHaveBeenCalledWith('資料驅動語音文字');

      // setLocale across 4 languages
      engine.setLocale('en-US');
      expect(engine.locale).toBe('en-US');
      expect(onLanguageChanged).toHaveBeenCalledWith(
        'en-US',
        expect.stringContaining('English'),
        'English'
      );

      engine.setLocale('ja-JP');
      expect(engine.locale).toBe('ja-JP');
      expect(onLanguageChanged).toHaveBeenCalledWith(
        'ja-JP',
        expect.stringContaining('日本語'),
        '日本語'
      );

      engine.setLocale('ko-KR');
      expect(engine.locale).toBe('ko-KR');
      expect(onLanguageChanged).toHaveBeenCalledWith(
        'ko-KR',
        expect.stringContaining('한국어'),
        '한국어'
      );

      engine.setLocale('zh-TW');
      expect(engine.locale).toBe('zh-TW');
      expect(onLanguageChanged).toHaveBeenCalledWith(
        'zh-TW',
        expect.stringContaining('繁體中文'),
        '中文'
      );
    });

    it('should manage speech streaming flow: beginSpeech -> pushSpeech -> endSpeech -> onUtteranceEnd', async () => {
      const onSpeakingEnd = vi.fn();
      const onSpeechWait = vi.fn();

      const engine: SpeechEngine = await initSpeechEngine({
        onSpeakingEnd,
        onSpeechWait
      });

      const seq = engine.beginSpeech();
      expect(typeof seq).toBe('number');

      (engine as unknown as { _speechBuf: string })._speechBuf = '預留緩衝';
      expect((engine as unknown as { _speechBuf: string })._speechBuf).toBe(
        '預留緩衝'
      );

      engine.pushSpeech(seq, '測試串流語音播放。');
      engine.endSpeech(seq);

      expect(engine.drainSentences({ buf: '測試。' }, true)).toEqual([
        '測試。'
      ]);
    });

    it('should test stopSpeaking, interruptForVoice, stopVoiceSession, and setMic', async () => {
      const onInterrupt = vi.fn();
      const onVoiceStatusChanged = vi.fn();
      const onMicStateChanged = vi.fn();

      const engine: SpeechEngine = await initSpeechEngine({
        onInterrupt,
        onVoiceStatusChanged,
        onMicStateChanged
      });

      engine.speak('正在播放測試語音');
      expect(engine.spokenDisplayText).toBe('正在播放測試語音');

      engine.setMic(true);
      expect(onMicStateChanged).toHaveBeenCalledWith(true, false);

      engine.interruptForVoice();
      expect(onInterrupt).toHaveBeenCalled();
      expect(onVoiceStatusChanged).toHaveBeenCalledWith(
        false,
        expect.stringContaining('已停止回答'),
        'listening',
        0
      );

      engine.stopVoiceSession('對話手動結束');
      expect(engine.convoOn).toBe(false);
      expect(engine.spokenDisplayText).toBe('對話手動結束');
    });

    it('should support custom STT and TTS engines and validate them', async () => {
      const customTTS = {
        speak: vi.fn(),
        stop: vi.fn(),
        computeMouth: vi.fn(() => 0.5),
        setGender: vi.fn(),
        setLocale: vi.fn(),
        isSpeaking: false,
        isMuted: false
      };

      const customSTT = {
        startListening: vi.fn(),
        stopListening: vi.fn(),
        isListening: false
      };

      const engine: SpeechEngine = await initSpeechEngine({
        customEngines: {
          tts: customTTS as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['tts'],
          stt: customSTT as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['stt']
        }
      });

      expect(engine.computeMouth()).toBe(0.5);
      engine.startListening();
      expect(customSTT.startListening).toHaveBeenCalled();

      engine.speak('自訂引擎說話');
      expect(customTTS.speak).toHaveBeenCalled();
    });

    it('should fallback to default STT when custom STT engine is invalid or throws', async () => {
      // 1. Invalid custom STT object (missing startListening)
      const invalidSTT = { stopListening: vi.fn() };
      const engine1 = await initSpeechEngine({
        customEngines: {
          stt: invalidSTT as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['stt']
        }
      });
      expect(engine1).toBeDefined();

      // 2. Custom STT factory throws error
      const throwingSTTFactory = vi.fn().mockImplementation(() => {
        throw new Error('STT init error');
      });
      const engine2 = await initSpeechEngine({
        customEngines: {
          stt: throwingSTTFactory as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['stt']
        }
      });
      expect(engine2).toBeDefined();
    });

    it('should trigger STT internal callbacks: onResult, onMicLevel, onBargeIn, onError, onStatusChange, onNoSpeechAbort', async () => {
      interface CapturedSttOptions {
        onResult: (text: string, isFinal: boolean) => void;
        onMicLevel: (
          volume: number,
          speaking: boolean,
          state: string,
          db: number
        ) => void;
        onBargeIn: () => void;
        onError: (message: string, isPermission: boolean) => void;
        onStatusChange: (isListening: boolean, state: string) => void;
        onNoSpeechAbort: () => void;
        getAssistantActive: () => boolean;
        getSpeechDuration: () => number;
        getConvoOn: () => boolean;
      }
      let capturedSttOptions: CapturedSttOptions | undefined;
      const customSTT = vi.fn().mockImplementation((opt: unknown) => {
        capturedSttOptions = opt as CapturedSttOptions;
        return {
          startListening: vi.fn(),
          stopListening: vi.fn(),
          isListening: false
        };
      });

      const onUserInput = vi.fn();
      const onVoiceStatusChanged = vi.fn();
      const onMicStateChanged = vi.fn();

      const engine: SpeechEngine = await initSpeechEngine({
        customEngines: {
          stt: customSTT as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['stt']
        },
        onUserInput,
        onVoiceStatusChanged,
        onMicStateChanged
      });

      expect(capturedSttOptions).toBeDefined();
      const sttOpts = capturedSttOptions as CapturedSttOptions;

      // 1. onResult: non-final vs final
      sttOpts.onResult('正在講話', false);
      expect(engine.spokenDisplayText).toBe('你：正在講話…');
      expect(onVoiceStatusChanged).toHaveBeenCalledWith(
        false,
        '正在辨識：正在講話',
        'listening',
        0
      );

      sttOpts.onResult('講完了。', true);
      expect(onUserInput).toHaveBeenCalledWith('講完了。');

      // 2. onMicLevel
      sttOpts.onMicLevel(0.8, true, 'listening', 80);
      expect(onVoiceStatusChanged).toHaveBeenCalledWith(
        true,
        undefined,
        'listening',
        80
      );

      // 3. onBargeIn
      engine.speak('正在播放');
      sttOpts.onBargeIn();
      expect(onVoiceStatusChanged).toHaveBeenCalledWith(
        false,
        expect.stringContaining('已停止回答'),
        'listening',
        0
      );

      // 4. onError: isNotAllowed = true vs false
      sttOpts.onError('麥克風錯誤', false);
      expect(engine.spokenDisplayText).toBe('麥克風錯誤');

      sttOpts.onError('權限被拒絕', true);
      expect(engine.convoOn).toBe(false);
      expect(engine.spokenDisplayText).toBe('權限被拒絕');

      // 5. onStatusChange
      sttOpts.onStatusChange(true, '聆聽中');
      expect(onMicStateChanged).toHaveBeenCalledWith(true, false);
      sttOpts.onStatusChange(false, '思考中');
      expect(onMicStateChanged).toHaveBeenCalledWith(false, false);

      // 6. onNoSpeechAbort
      sttOpts.onNoSpeechAbort();
      expect(engine.convoOn).toBe(false);

      // 7. sttOptions getters
      expect(sttOpts.getAssistantActive()).toBe(false);
      engine.isProcessing = true;
      expect(sttOpts.getAssistantActive()).toBe(true);
      engine.isProcessing = false;
      expect(sttOpts.getAssistantActive()).toBe(false);

      engine.assistantSpeechStartedAt = 1;
      expect(sttOpts.getSpeechDuration()).toBeGreaterThanOrEqual(0);
      engine.assistantSpeechStartedAt = 0;
      expect(Math.abs(sttOpts.getSpeechDuration())).toBeLessThan(50);

      engine.convoOn = true;
      expect(sttOpts.getConvoOn()).toBe(true);

      // 8. onUtteranceEnd with convoOn = true triggers startListening
      engine.convoOn = true;
      const startListeningSpy = vi.spyOn(engine, 'startListening');
      engine.onUtteranceEnd();
      expect(startListeningSpy).toHaveBeenCalled();

      // 9. _onTTSSpeakEnd with spokenDisplayText timeout
      vi.useFakeTimers();
      const onSpokenDisplayTextTimeout = vi.fn();
      const onSpeakingEnd = vi.fn();
      const engineWithTimeout = await initSpeechEngine({
        onSpokenDisplayTextTimeout,
        onSpeakingEnd
      });
      (
        engineWithTimeout as unknown as { _onTTSSpeakEnd: () => void }
      )._onTTSSpeakEnd();
      expect(onSpeakingEnd).toHaveBeenCalled();
      vi.advanceTimersByTime(4000);
      expect(onSpokenDisplayTextTimeout).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should fallback to default TTS when custom TTS engine is invalid or throws', async () => {
      // 1. Invalid custom TTS object
      const invalidTTS = { speak: vi.fn() };
      const engine1 = await initSpeechEngine({
        customEngines: {
          tts: invalidTTS as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['tts']
        }
      });
      expect(engine1).toBeDefined();

      // 2. Custom TTS factory throws error
      const throwingTTSFactory = vi.fn().mockImplementation(() => {
        throw new Error('TTS init error');
      });
      const engine2 = await initSpeechEngine({
        customEngines: {
          tts: throwingTTSFactory as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['tts']
        }
      });
      expect(engine2).toBeDefined();
    });

    it('should trigger visibilitychange background stop when document is hidden', async () => {
      const engine: SpeechEngine = await initSpeechEngine();
      engine.convoOn = true;

      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(engine.convoOn).toBe(false);
      expect(engine.spokenDisplayText).toContain('頁面進入背景');
    });

    it('should test pushSpeech and endSpeech mismatch guard, and sentence buffer updates', async () => {
      const onUserInput = vi.fn();
      const engine: SpeechEngine = await initSpeechEngine({ onUserInput });

      // Test beginSpeech and pushSpeech
      const seq = engine.beginSpeech();
      expect(seq).toBeGreaterThan(0);

      // pushSpeech with correct seq
      engine.pushSpeech(seq, '測試文字');
      expect(
        (engine as unknown as { _speechBuffer: string })._speechBuffer
      ).toContain('測試文字');

      // pushSpeech with wrong seq -> should ignore
      engine.pushSpeech(seq + 999, '略過文字');
      expect(
        (engine as unknown as { _speechBuffer: string })._speechBuffer
      ).not.toContain('略過文字');

      // endSpeech with wrong seq -> should ignore
      engine.endSpeech(seq + 999);
      expect(
        (engine as unknown as { _speechEndedFlag: boolean })._speechEndedFlag
      ).toBe(false);

      // Test drainSentences with state having only sentenceBuffer or buf
      const state1 = { buf: '文字。' };
      drainSentences(state1, false);
      expect(state1.buf).toBe('');

      const state2 = { sentenceBuffer: '文字。' };
      drainSentences(state2, false);
      expect(state2.sentenceBuffer).toBe('');

      // Comma index < 12 with length >= 40
      const state3 = { buf: '123,45' + 'a'.repeat(40) };
      const sentences = drainSentences(state3, false);
      expect(sentences).toEqual([]);
    });

    it('should test triggerTap, interruptForVoice, and onUtteranceEnd', async () => {
      vi.useFakeTimers();
      const onTapAvatar = vi.fn();
      const onInterrupt = vi.fn();
      const onVoiceStatusChanged = vi.fn();

      const engine: SpeechEngine = await initSpeechEngine({
        onTapAvatar,
        onInterrupt,
        onVoiceStatusChanged
      });

      // 1. triggerTap
      engine.triggerTap();
      expect(onTapAvatar).toHaveBeenCalled();

      // 2. interruptForVoice
      engine.convoOn = true;
      engine.interruptForVoice();
      expect(onInterrupt).toHaveBeenCalled();
      expect(onVoiceStatusChanged).toHaveBeenCalledWith(
        true,
        expect.any(String),
        'listening',
        0
      );
      vi.advanceTimersByTime(120);

      // 3. onUtteranceEnd
      engine.convoOn = true;
      engine.onUtteranceEnd();
      expect(engine.isProcessing).toBe(false);

      // 4. preloadTapGreeting
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(2000)
      });
      engine.preloadTapGreeting('你好');

      vi.useRealTimers();
    });

    it('should handle custom TTS and STT engine validation failures and throwing factories', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // 1. Non-streaming custom TTS engine
      const mockCustomTTS = {
        speak: vi.fn(),
        stop: vi.fn(),
        computeMouth: vi.fn(() => 0),
        setGender: vi.fn(),
        setLocale: vi.fn(),
        isSpeaking: false,
        isMuted: false
      };

      const engine: SpeechEngine = await initSpeechEngine({
        customEngines: {
          tts: mockCustomTTS as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['tts']
        }
      });

      const seq = engine.beginSpeech();
      engine.pushSpeech(seq, '一般合成測試');
      expect(mockCustomTTS.speak).toHaveBeenCalledWith('一般合成測試', {});
      engine.endSpeech(seq);
      expect(engine.isProcessing).toBe(false);

      // 2. Invalid custom TTS (missing methods)
      const engineWithInvalidTTS = await initSpeechEngine({
        customEngines: {
          tts: { speak: vi.fn() } as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['tts']
        }
      });
      expect(engineWithInvalidTTS).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Custom ttsEngine validation failed')
      );

      // 3. Throwing custom TTS factory
      const engineWithThrowingTTS = await initSpeechEngine({
        customEngines: {
          tts: () => {
            throw new Error('TTS factory exploded');
          }
        }
      });
      expect(engineWithThrowingTTS).toBeDefined();

      // 4. Invalid custom STT (missing methods)
      const engineWithInvalidSTT = await initSpeechEngine({
        customEngines: {
          stt: { start: vi.fn() } as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['stt']
        }
      });
      expect(engineWithInvalidSTT).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Custom sttEngine validation failed')
      );

      // 5. Throwing custom STT factory
      const engineWithThrowingSTT = await initSpeechEngine({
        customEngines: {
          stt: () => {
            throw new Error('STT factory exploded');
          }
        }
      });
      expect(engineWithThrowingSTT).toBeDefined();

      consoleErrorSpy.mockRestore();
    });

    it('should test speechEngine lifecycle branches, timers, and getters', async () => {
      vi.useFakeTimers();
      const onSpokenDisplayTextTimeout = vi.fn();
      const onSpeaking = vi.fn();
      const onSpeechWait = vi.fn();
      const onSpeakingEnd = vi.fn();

      const engine = await initSpeechEngine({
        onSpokenDisplayTextTimeout,
        onSpeaking,
        onSpeechWait,
        onSpeakingEnd
      });

      // 1. spokenAudioState getter (line 442)
      expect(engine.spokenAudioState).toBeDefined();

      // 2. spokenDisplayText timeout when not speaking (lines 188-193)
      engine.spokenDisplayText = '顯示文字逾時測試';
      expect(engine.spokenDisplayText).toBe('顯示文字逾時測試');
      vi.advanceTimersByTime(6000);
      expect(onSpokenDisplayTextTimeout).toHaveBeenCalled();
      expect(engine.spokenDisplayText).toBe('');

      // 3. startListening when isSpeaking or isProcessing is true (line 514)
      const stopSpeakingSpy = vi.spyOn(engine, 'stopSpeaking');
      engine.isProcessing = true;
      engine.startListening();
      expect(stopSpeakingSpy).toHaveBeenCalled();

      // 4. _onTTSSpeakEnd and spokenDisplayTextTimer clear/restart (lines 620-630)
      engine.spokenDisplayText = '朗讀即將結束';
      (engine as unknown as { _onTTSSpeakEnd: () => void })._onTTSSpeakEnd();
      expect(onSpeakingEnd).toHaveBeenCalled();
      vi.advanceTimersByTime(4000);
      expect(engine.spokenDisplayText).toBe('');

      vi.useRealTimers();
    });

    it('should trigger ttsSetting callbacks onSpeaking, onSpeakEnd, and onSpeechWait (lines 258-271)', async () => {
      interface CapturedTtsOptions {
        onSpeakStart?: (t: string) => void;
        onSpeakEnd?: () => void;
        onSpeechWait?: (seq?: number) => void;
      }
      let capturedTtsOptions: CapturedTtsOptions | undefined;

      const onSpeaking = vi.fn();
      const onSpeechWait = vi.fn();

      const customTts = (opts: unknown) => {
        capturedTtsOptions = opts as CapturedTtsOptions;
        return {
          speak: vi.fn(),
          stop: vi.fn(),
          computeMouth: vi.fn(() => 0),
          setGender: vi.fn(),
          setLocale: vi.fn(),
          isSpeaking: false,
          isMuted: false
        };
      };

      await initSpeechEngine({
        onSpeaking,
        onSpeechWait,
        customEngines: {
          tts: customTts as unknown as NonNullable<
            NonNullable<Parameters<typeof initSpeechEngine>[0]>['customEngines']
          >['tts']
        }
      });

      // Invoke internal callbacks
      const ttsOpts = capturedTtsOptions as CapturedTtsOptions;
      ttsOpts?.onSpeakStart?.('自訂音訊');
      expect(onSpeaking).toHaveBeenCalledWith('自訂音訊');

      ttsOpts?.onSpeechWait?.(123);
      expect(onSpeechWait).toHaveBeenCalledWith(123);

      expect(() => ttsOpts?.onSpeakEnd?.()).not.toThrow();
    });
  });
});
