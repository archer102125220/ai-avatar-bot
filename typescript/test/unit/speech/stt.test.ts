import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateSTTEngine,
  initDefaultSTTEngine,
  getSttMessage
} from '@/core/speech/stt';
import type { STTEngine } from '@core';

describe('Unit Test: core/speech/stt.js', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateSTTEngine', () => {
    it('should report missing methods when invalid or non-object engine is passed', () => {
      expect(validateSTTEngine(null).isValid).toBe(false);
      expect(validateSTTEngine(null).missing).toContain('engine instance');

      const result = validateSTTEngine({});
      expect(result.isValid).toBe(false);
      expect(result.missing).toContain('startListening()');
      expect(result.missing).toContain('stopListening()');
      expect(result.missing).toContain('isListening');
    });

    it('should pass validation for valid engine implementation', () => {
      const engine = {
        startListening: vi.fn(),
        stopListening: vi.fn(),
        isListening: false
      };
      const result = validateSTTEngine(engine);
      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe('getSttMessage', () => {
    it('should retrieve localized messages for all 4 supported locales and format parameters', () => {
      const msgZh = getSttMessage('zh-TW', 'startFailed', {
        error: '連線逾時'
      });
      expect(msgZh).toContain('語音辨識啟動失敗：連線逾時');

      const msgEn = getSttMessage('en-US', 'startFailed', { error: 'Timeout' });
      expect(msgEn).toContain('Failed to start speech recognition: Timeout');

      const msgJa = getSttMessage('ja-JP', 'startFailed', { error: 'エラー' });
      expect(msgJa).toContain('音声認識の開始に失敗しました：エラー');

      const msgKo = getSttMessage('ko-KR', 'startFailed', { error: '오류' });
      expect(msgKo).toContain('음성 인식 시작 실패: 오류');
    });

    it('should fallback to zh-TW for unknown locale or missing keys', () => {
      const msg = getSttMessage('fr-FR', 'listening');
      expect(msg).toBe('請說話，可以隨時插話…');
    });
  });

  describe('initDefaultSTTEngine', () => {
    it('should handle locale, noSpeechRuns getters/setters and unsupported speech recognition', async () => {
      const onError = vi.fn();
      const origRecognition = (
        window as unknown as { SpeechRecognition?: unknown }
      ).SpeechRecognition;
      Reflect.deleteProperty(window, 'SpeechRecognition');
      Reflect.deleteProperty(window, 'webkitSpeechRecognition');

      const stt: STTEngine = initDefaultSTTEngine({
        onError,
        locale: 'zh-TW'
      });

      expect(stt.locale).toBe('zh-TW');
      stt.setLocale('en-US');
      expect(stt.locale).toBe('en-US');

      expect(stt.noSpeechRuns).toBe(0);
      stt.noSpeechRuns = 3;
      expect(stt.noSpeechRuns).toBe(3);
      stt.noSpeechRuns = 'invalid' as unknown as number;
      expect(stt.noSpeechRuns).toBe(0);

      // startListening when unsupported
      await stt.startListening();
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('does not support speech recognition'),
        false
      );

      Object.defineProperty(window, 'SpeechRecognition', {
        value: origRecognition,
        configurable: true,
        writable: true
      });
    });

    it('should test recognition lifecycle, error handlers, and interim results in startListening', async () => {
      class MockRecognition {
        continuous = false;
        interimResults = true;
        lang = 'zh-TW';
        maxAlternatives = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((err: { error: string }) => void) | null = null;
        onresult:
          | ((res: {
              resultIndex: number;
              results: Array<
                Record<number, { transcript: string }> & {
                  isFinal: boolean;
                  length: number;
                }
              >;
            }) => void)
          | null = null;
        onspeechstart: (() => void) | null = null;
        static latest: MockRecognition | null = null;
        constructor() {
          MockRecognition.latest = this;
        }
        start() {}
        stop() {}
        abort() {}
      }

      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
        MockRecognition;

      const onResult = vi.fn();
      const onStatusChange = vi.fn();
      const onError = vi.fn();
      const onNoSpeechAbort = vi.fn();

      const stt: STTEngine = initDefaultSTTEngine({
        onResult,
        onStatusChange,
        onError,
        onNoSpeechAbort,
        getConvoOn: () => true
      });

      await stt.startListening();
      const rec = MockRecognition.latest;
      expect(rec).toBeDefined();

      // trigger onstart
      rec?.onstart?.();
      expect(stt.isListening).toBe(true);
      expect(onStatusChange).toHaveBeenCalledWith(
        true,
        expect.stringContaining('請說話')
      );

      // trigger onspeechstart
      stt.noSpeechRuns = 2;
      rec?.onspeechstart?.();
      expect(stt.noSpeechRuns).toBe(0);

      // trigger onresult (interim)
      rec?.onresult?.({
        resultIndex: 0,
        results: [{ 0: { transcript: '你好' }, isFinal: false, length: 1 }]
      });
      expect(onResult).toHaveBeenCalledWith('你好', false, true);

      // trigger onresult (final)
      rec?.onresult?.({
        resultIndex: 0,
        results: [{ 0: { transcript: '你好呀' }, isFinal: true, length: 1 }]
      });
      expect(onResult).toHaveBeenCalledWith('你好呀', true, false);

      // trigger onerror: not-allowed
      rec?.onerror?.({ error: 'not-allowed' });
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('麥克風權限'),
        true
      );

      // trigger onerror: no-speech (accumulate to 4 in convo mode)
      stt.noSpeechRuns = 3;
      rec?.onerror?.({ error: 'no-speech' });
      expect(onNoSpeechAbort).toHaveBeenCalled();

      // trigger onerror: aborted (ignored)
      rec?.onerror?.({ error: 'aborted' });

      // trigger onend
      rec?.onend?.();
      expect(stt.isListening).toBe(false);
      expect(onStatusChange).toHaveBeenCalledWith(false, '', false);

      // test stopListening
      stt.stopListening();
      expect(stt.isListening).toBe(false);
    });

    it('should promote interim text to final when elapsed > 2000ms with >= 4 characters', async () => {
      class MockRecognition {
        start = vi.fn();
        stop = vi.fn();
        abort = vi.fn();
        onresult:
          | ((res: {
              resultIndex: number;
              results: Array<
                Record<number, { transcript: string }> & {
                  isFinal: boolean;
                  length: number;
                }
              >;
            }) => void)
          | null = null;
        static latest: MockRecognition | null = null;
        constructor() {
          MockRecognition.latest = this;
        }
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
        MockRecognition;

      const onResult = vi.fn();
      const stt: STTEngine = initDefaultSTTEngine({ onResult });

      await stt.startListening();
      const rec = MockRecognition.latest;

      // First interim result sets interimStartTime
      rec?.onresult?.({
        resultIndex: 0,
        results: [{ 0: { transcript: '測試中' }, isFinal: false, length: 1 }]
      });

      // Advance performance.now by mocking it
      const originalNow = performance.now.bind(performance);
      const mockTime = originalNow() + 2500;
      performance.now = vi.fn(() => mockTime);

      // Second interim with >= 4 characters triggers promotion to final
      rec?.onresult?.({
        resultIndex: 0,
        results: [
          { 0: { transcript: '測試中字數大於四' }, isFinal: false, length: 1 }
        ]
      });

      expect(rec?.stop).toHaveBeenCalled();
      expect(onResult).toHaveBeenCalledWith('測試中字數大於四', true, false);

      performance.now = originalNow;
    });

    it('should handle error when recognitionInstance.start() throws', async () => {
      class ThrowingRecognition {
        start() {
          throw new Error('Mic already active');
        }
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
        ThrowingRecognition;

      const onError = vi.fn();
      const stt: STTEngine = initDefaultSTTEngine({ onError });

      await stt.startListening();
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('Mic already active'),
        false
      );
    });

    it('should cover onend, aborted error, no-speech abort at 4 runs, and empty result in STT engine', async () => {
      class MockRecognition {
        continuous = false;
        interimResults = true;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((err: { error: string }) => void) | null = null;
        onresult:
          | ((res: {
              resultIndex: number;
              results: Array<
                Record<number, { transcript: string }> & {
                  isFinal: boolean;
                  length: number;
                }
              >;
            }) => void)
          | null = null;
        static latest: MockRecognition | null = null;
        constructor() {
          MockRecognition.latest = this;
        }
        start() {
          if (typeof this.onstart === 'function') {
            this.onstart();
          }
        }
        stop() {
          if (typeof this.onend === 'function') {
            this.onend();
          }
        }
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
        MockRecognition;

      const onNoSpeechAbort = vi.fn();
      const onError = vi.fn();
      const onStatusChange = vi.fn();
      const onResult = vi.fn();

      const stt: STTEngine = initDefaultSTTEngine({
        getConvoOn: () => true,
        onNoSpeechAbort,
        onError,
        onStatusChange,
        onResult
      });

      await stt.startListening();
      const rec = MockRecognition.latest;

      // 1. onerror with 'aborted'
      rec?.onerror?.({ error: 'aborted' });
      expect(onError).not.toHaveBeenCalled();

      // 2. onerror with 'no-speech' repeatedly until threshold (>= 4)
      rec?.onerror?.({ error: 'no-speech' });
      rec?.onerror?.({ error: 'no-speech' });
      rec?.onerror?.({ error: 'no-speech' });
      rec?.onerror?.({ error: 'no-speech' });
      expect(onNoSpeechAbort).toHaveBeenCalled();

      // 3. onresult with empty/whitespace string
      rec?.onresult?.({
        resultIndex: 0,
        results: [{ 0: { transcript: '   ' }, isFinal: false, length: 1 }]
      });
      expect(onResult).not.toHaveBeenCalled();

      // 4. onend when listening
      rec?.onend?.();
      expect(onStatusChange).toHaveBeenCalledWith(false, '', false);
    });

    it('should handle mic permission error and active recognition abortion', async () => {
      class MockRecognition {
        continuous = false;
        interimResults = true;
        abort = vi.fn();
        start = vi.fn();
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
        MockRecognition;

      const origMediaDevices = navigator.mediaDevices;
      (navigator as unknown as { mediaDevices?: unknown }).mediaDevices = {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied'))
      };

      const onError = vi.fn();
      const stt: STTEngine = initDefaultSTTEngine({ onError, locale: 'zh-TW' });

      await stt.startListening();
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('無法啟動語音功能'),
        true
      );

      // Restore getUserMedia
      (navigator as unknown as { mediaDevices?: unknown }).mediaDevices =
        origMediaDevices;
    });

    it('should handle onerror with not-allowed', async () => {
      class MockRecognition {
        continuous = false;
        interimResults = true;
        start = vi.fn();
        abort = vi.fn();
        onerror: ((err: { error: string }) => void) | null = null;
        static latest: MockRecognition | null = null;
        constructor() {
          MockRecognition.latest = this;
        }
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
        MockRecognition;

      const origMediaDevices = navigator.mediaDevices;
      (navigator as unknown as { mediaDevices?: unknown }).mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue({
          getAudioTracks: () => [{ stop: vi.fn() }]
        })
      };

      const onError = vi.fn();
      const stt: STTEngine = initDefaultSTTEngine({ onError, locale: 'zh-TW' });
      await stt.startListening();

      if (typeof MockRecognition.latest?.onerror === 'function') {
        MockRecognition.latest.onerror({ error: 'not-allowed' });
      }
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('我需要麥克風權限'),
        true
      );

      (navigator as unknown as { mediaDevices?: unknown }).mediaDevices =
        origMediaDevices;
    });

    it('should monitor mic level, calculate RMS and trigger barge-in when assistant is active', async () => {
      let rafCallback: FrameRequestCallback | null = null;
      vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn((cb: FrameRequestCallback) => {
          rafCallback = cb;
          return 101;
        })
      );
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      let mockFreqData = new Uint8Array(256).fill(130); // Low background noise
      const mockAnalyser = {
        fftSize: 256,
        smoothingTimeConstant: 0.35,
        getByteFrequencyData: vi.fn((arr: Uint8Array) => {
          arr.set(mockFreqData);
        })
      };

      const mockTrack = { stop: vi.fn() };
      const mockStream = {
        getTracks: () => [mockTrack]
      };

      const mockAudioCtx = {
        state: 'suspended',
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: () => mockAnalyser,
        createMediaStreamSource: () => ({
          connect: vi.fn()
        })
      };

      class MockAudioContext {
        constructor() {
          return mockAudioCtx;
        }
      }
      (window as unknown as { AudioContext?: unknown }).AudioContext =
        MockAudioContext;
      (navigator as unknown as { mediaDevices?: unknown }).mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      };

      class MockRecognition {
        start = vi.fn();
        abort = vi.fn();
        onspeechstart = null;
      }
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition =
        MockRecognition;

      const onMicLevel = vi.fn();
      const onBargeIn = vi.fn();

      const stt: STTEngine = initDefaultSTTEngine({
        onMicLevel,
        onBargeIn,
        getAssistantActive: () => true,
        getSpeechDuration: () => 2000,
        getConvoOn: () => true
      });

      const originalNow = performance.now;
      performance.now = vi.fn(() => 5000);

      await stt.startListening();
      expect(mockAudioCtx.resume).toHaveBeenCalled();
      expect(onMicLevel).toHaveBeenCalled();

      // Establish low noise floor
      for (let i = 0; i < 5; i++) {
        (rafCallback as FrameRequestCallback | null)?.(0);
      }

      // Now switch to loud speech (sample = 255)
      mockFreqData = new Uint8Array(256).fill(255);
      for (let i = 0; i < 12; i++) {
        (rafCallback as FrameRequestCallback | null)?.(0);
      }
      expect(onBargeIn).toHaveBeenCalled();

      // Test stopListening cleaning up audio context & media tracks
      stt.stopListening();
      expect(window.cancelAnimationFrame).toHaveBeenCalledWith(101);
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(mockAudioCtx.close).toHaveBeenCalled();

      performance.now = originalNow;
    });

    it('should throw media-not-supported error when getUserMedia is missing', async () => {
      const origMediaDevices = navigator.mediaDevices;
      Reflect.deleteProperty(navigator, 'mediaDevices');

      const onError = vi.fn();
      const stt: STTEngine = initDefaultSTTEngine({ onError });
      await stt.startListening();

      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('無法啟動語音功能'),
        true
      );
      Object.defineProperty(navigator, 'mediaDevices', {
        value: origMediaDevices,
        configurable: true,
        writable: true
      });
    });

    it('should abort existing recognition on startListening, handle onend when convoOn is false, and ignore aborted errors', async () => {
      class MockSpeechRecognition {
        continuous = false;
        interimResults = true;
        lang = 'zh-TW';
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((err: { error: string }) => void) | null = null;
        abort = vi.fn();
        start = vi.fn();
        static instances: MockSpeechRecognition[] = [];
        constructor() {
          MockSpeechRecognition.instances.push(this);
        }
      }
      MockSpeechRecognition.instances = [];

      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition =
        MockSpeechRecognition;
      (navigator as unknown as { mediaDevices?: unknown }).mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      };

      const onError = vi.fn();
      const onStatusChange = vi.fn();
      const convoOn = false;

      const stt: STTEngine = initDefaultSTTEngine({
        onError,
        onStatusChange,
        getConvoOn: () => convoOn
      });

      // 1. First startListening call
      await stt.startListening();
      const firstRec = MockSpeechRecognition.instances[0];
      firstRec.onstart?.();
      expect(stt.isListening).toBe(true);

      // 2. Second startListening call while first is still active -> aborts first
      await stt.startListening();
      expect(firstRec.abort).toHaveBeenCalled();
      const secondRec = MockSpeechRecognition.instances[1];
      secondRec.onstart?.();

      // 3. onerror with error === 'aborted' -> ignored
      secondRec.onerror?.({ error: 'aborted' });
      expect(onError).not.toHaveBeenCalled();

      // 4. onend when convoOn is false -> triggers stopMicMonitor
      secondRec.onend?.();
      expect(stt.isListening).toBe(false);
      expect(onStatusChange).toHaveBeenCalledWith(false, '', false);
    });
  });
});
