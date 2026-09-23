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
      // @ts-ignore: Defensive runtime type checking test
      expect(drainSentences(null)).toEqual([]);
      // @ts-ignore: Defensive runtime type checking test
      expect(drainSentences(undefined)).toEqual([]);
    });

    it('should drain completed sentences ending with Chinese and English punctuation', () => {
      const state = { buf: '你好呀！今天想聊什麼呢？Hello there. How are you?剩餘未結束' };
      const sentences = drainSentences(state, false);

      expect(sentences).toEqual(['你好呀！', '今天想聊什麼呢？', 'Hello there.', 'How are you?']);
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

      (engine as any).noSpeechRuns = 2;
      expect((engine as any).noSpeechRuns).toBe(2);

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
      expect(onLanguageChanged).toHaveBeenCalledWith('en-US', expect.stringContaining('English'), 'English');

      engine.setLocale('ja-JP');
      expect(engine.locale).toBe('ja-JP');
      expect(onLanguageChanged).toHaveBeenCalledWith('ja-JP', expect.stringContaining('日本語'), '日本語');

      engine.setLocale('ko-KR');
      expect(engine.locale).toBe('ko-KR');
      expect(onLanguageChanged).toHaveBeenCalledWith('ko-KR', expect.stringContaining('한국어'), '한국어');

      engine.setLocale('zh-TW');
      expect(engine.locale).toBe('zh-TW');
      expect(onLanguageChanged).toHaveBeenCalledWith('zh-TW', expect.stringContaining('繁體中文'), '中文');
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

      (engine as any)._speechBuf = '預留緩衝';
      expect((engine as any)._speechBuf).toBe('預留緩衝');

      engine.pushSpeech(seq, '測試串流語音播放。');
      engine.endSpeech(seq);

      expect(engine.drainSentences({ buf: '測試。' }, true)).toEqual(['測試。']);
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
      expect(onVoiceStatusChanged).toHaveBeenCalledWith(false, expect.stringContaining('已停止回答'), 'listening', 0);

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
          tts: customTTS as any,
          stt: customSTT as any
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
        customEngines: { stt: invalidSTT as any }
      });
      expect(engine1).toBeDefined();

      // 2. Custom STT factory throws error
      const throwingSTTFactory = vi.fn().mockImplementation(() => {
        throw new Error('STT init error');
      });
      const engine2 = await initSpeechEngine({
        customEngines: { stt: throwingSTTFactory as any }
      });
      expect(engine2).toBeDefined();
    });

    it('should trigger STT internal callbacks: onResult, onMicLevel, onBargeIn, onError, onStatusChange, onNoSpeechAbort', async () => {
      let capturedSttOptions: any = null;
      const customSTT = vi.fn().mockImplementation((opt: any) => {
        capturedSttOptions = opt;
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
        customEngines: { stt: customSTT as any },
        onUserInput,
        onVoiceStatusChanged,
        onMicStateChanged
      });

      expect(capturedSttOptions).toBeDefined();

      // 1. onResult: non-final vs final
      capturedSttOptions.onResult('正在講話', false);
      expect(engine.spokenDisplayText).toBe('你：正在講話…');
      expect(onVoiceStatusChanged).toHaveBeenCalledWith(false, '正在辨識：正在講話', 'listening', 0);

      capturedSttOptions.onResult('講完了。', true);
      expect(onUserInput).toHaveBeenCalledWith('講完了。');

      // 2. onMicLevel
      capturedSttOptions.onMicLevel(0.8, true, 'listening', 80);
      expect(onVoiceStatusChanged).toHaveBeenCalledWith(true, undefined, 'listening', 80);

      // 3. onBargeIn
      engine.speak('正在播放');
      capturedSttOptions.onBargeIn();
      expect(onVoiceStatusChanged).toHaveBeenCalledWith(false, expect.stringContaining('已停止回答'), 'listening', 0);

      // 4. onError: isNotAllowed = true vs false
      capturedSttOptions.onError('麥克風錯誤', false);
      expect(engine.spokenDisplayText).toBe('麥克風錯誤');

      capturedSttOptions.onError('權限被拒絕', true);
      expect(engine.convoOn).toBe(false);
      expect(engine.spokenDisplayText).toBe('權限被拒絕');

      // 5. onStatusChange
      capturedSttOptions.onStatusChange(true, '聆聽中');
      expect(onMicStateChanged).toHaveBeenCalledWith(true, false);
      capturedSttOptions.onStatusChange(false, '思考中');
      expect(onMicStateChanged).toHaveBeenCalledWith(false, false);

      // 6. onNoSpeechAbort
      capturedSttOptions.onNoSpeechAbort();
      expect(engine.convoOn).toBe(false);

      // 7. sttOptions getters
      expect(capturedSttOptions.getAssistantActive()).toBe(false);
      engine.isProcessing = true;
      expect(capturedSttOptions.getAssistantActive()).toBe(true);
      engine.isProcessing = false;
      expect(capturedSttOptions.getAssistantActive()).toBe(false);

      engine.assistantSpeechStartedAt = 1;
      expect(capturedSttOptions.getSpeechDuration()).toBeGreaterThanOrEqual(0);
      engine.assistantSpeechStartedAt = 0;
      expect(Math.abs(capturedSttOptions.getSpeechDuration())).toBeLessThan(50);

      engine.convoOn = true;
      expect(capturedSttOptions.getConvoOn()).toBe(true);

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
      (engineWithTimeout as any)._onTTSSpeakEnd();
      expect(onSpeakingEnd).toHaveBeenCalled();
      vi.advanceTimersByTime(4000);
      expect(onSpokenDisplayTextTimeout).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should fallback to default TTS when custom TTS engine is invalid or throws', async () => {
      // 1. Invalid custom TTS object
      const invalidTTS = { speak: vi.fn() };
      const engine1 = await initSpeechEngine({
        customEngines: { tts: invalidTTS as any }
      });
      expect(engine1).toBeDefined();

      // 2. Custom TTS factory throws error
      const throwingTTSFactory = vi.fn().mockImplementation(() => {
        throw new Error('TTS init error');
      });
      const engine2 = await initSpeechEngine({
        customEngines: { tts: throwingTTSFactory as any }
      });
      expect(engine2).toBeDefined();
    });

    it('should trigger visibilitychange background stop when document is hidden', async () => {
      const engine: SpeechEngine = await initSpeechEngine();
      engine.convoOn = true;

      Object.defineProperty(document, 'hidden', { value: true, writable: true });
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
      expect((engine as any)._speechBuffer).toContain('測試文字');

      // pushSpeech with wrong seq -> should ignore
      engine.pushSpeech(seq + 999, '略過文字');
      expect((engine as any)._speechBuffer).not.toContain('略過文字');

      // endSpeech with wrong seq -> should ignore
      engine.endSpeech(seq + 999);
      expect((engine as any)._speechEndedFlag).toBe(false);

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
      expect(onVoiceStatusChanged).toHaveBeenCalledWith(true, expect.any(String), 'listening', 0);
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
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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
        customEngines: { tts: mockCustomTTS as any }
      });

      const seq = engine.beginSpeech();
      engine.pushSpeech(seq, '一般合成測試');
      expect(mockCustomTTS.speak).toHaveBeenCalledWith('一般合成測試', {});
      engine.endSpeech(seq);
      expect(engine.isProcessing).toBe(false);

      // 2. Invalid custom TTS (missing methods)
      const engineWithInvalidTTS = await initSpeechEngine({
        customEngines: { tts: { speak: vi.fn() } as any }
      });
      expect(engineWithInvalidTTS).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Custom ttsEngine validation failed'));

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
        customEngines: { stt: { start: vi.fn() } as any }
      });
      expect(engineWithInvalidSTT).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Custom sttEngine validation failed'));

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
  });
});
