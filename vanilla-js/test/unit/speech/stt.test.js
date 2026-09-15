import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateSTTEngine,
  initDefaultSTTEngine,
  getSttMessage
} from '../../../core/speech/stt';

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
      const msgZh = getSttMessage('zh-TW', 'startFailed', { error: '連線逾時' });
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
      const origRecognition = window.SpeechRecognition;
      // @ts-ignore
      delete window.SpeechRecognition;
      // @ts-ignore
      delete window.webkitSpeechRecognition;

      const stt = initDefaultSTTEngine({
        onError,
        locale: 'zh-TW'
      });

      expect(stt.locale).toBe('zh-TW');
      stt.setLocale('en-US');
      expect(stt.locale).toBe('en-US');

      expect(stt.noSpeechRuns).toBe(0);
      stt.noSpeechRuns = 3;
      expect(stt.noSpeechRuns).toBe(3);
      stt.noSpeechRuns = 'invalid';
      expect(stt.noSpeechRuns).toBe(0);

      // startListening when unsupported
      await stt.startListening();
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('does not support speech recognition'), false);

      window.SpeechRecognition = origRecognition;
    });

    it('should test recognition lifecycle, error handlers, and interim results in startListening', async () => {
      let createdRecognition;
      class MockRecognition {
        constructor() {
          this.continuous = false;
          this.interimResults = true;
          this.lang = 'zh-TW';
          this.maxAlternatives = 1;
          this.onstart = null;
          this.onend = null;
          this.onerror = null;
          this.onresult = null;
          this.onspeechstart = null;
          createdRecognition = this;
        }
        start() {}
        stop() {}
        abort() {}
      }

      window.SpeechRecognition = MockRecognition;

      const onResult = vi.fn();
      const onStatusChange = vi.fn();
      const onError = vi.fn();
      const onNoSpeechAbort = vi.fn();

      const stt = initDefaultSTTEngine({
        onResult,
        onStatusChange,
        onError,
        onNoSpeechAbort,
        getConvoOn: () => true
      });

      await stt.startListening();
      expect(createdRecognition).toBeDefined();

      // trigger onstart
      createdRecognition.onstart();
      expect(stt.isListening).toBe(true);
      expect(onStatusChange).toHaveBeenCalledWith(true, expect.stringContaining('請說話'));

      // trigger onspeechstart
      stt.noSpeechRuns = 2;
      createdRecognition.onspeechstart();
      expect(stt.noSpeechRuns).toBe(0);

      // trigger onresult (interim)
      createdRecognition.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: '你好' }, isFinal: false, length: 1 }]
      });
      expect(onResult).toHaveBeenCalledWith('你好', false, true);

      // trigger onresult (final)
      createdRecognition.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: '你好呀' }, isFinal: true, length: 1 }]
      });
      expect(onResult).toHaveBeenCalledWith('你好呀', true, false);

      // trigger onerror: not-allowed
      createdRecognition.onerror({ error: 'not-allowed' });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('麥克風權限'), true);

      // trigger onerror: no-speech (accumulate to 4 in convo mode)
      stt.noSpeechRuns = 3;
      createdRecognition.onerror({ error: 'no-speech' });
      expect(onNoSpeechAbort).toHaveBeenCalled();

      // trigger onerror: aborted (ignored)
      createdRecognition.onerror({ error: 'aborted' });

      // trigger onend
      createdRecognition.onend();
      expect(stt.isListening).toBe(false);
      expect(onStatusChange).toHaveBeenCalledWith(false, '', false);

      // test stopListening
      stt.stopListening();
      expect(stt.isListening).toBe(false);
    });

    it('should promote interim text to final when elapsed > 2000ms with >= 4 characters', async () => {
      let createdRecognition;
      class MockRecognition {
        constructor() {
          this.start = vi.fn();
          this.stop = vi.fn();
          this.abort = vi.fn();
          createdRecognition = this;
        }
      }
      window.SpeechRecognition = MockRecognition;

      const onResult = vi.fn();
      const stt = initDefaultSTTEngine({ onResult });

      await stt.startListening();

      // First interim result sets interimStartTime
      createdRecognition.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: '測試中' }, isFinal: false, length: 1 }]
      });

      // Advance performance.now by mocking it
      const originalNow = performance.now.bind(performance);
      const mockTime = originalNow() + 2500;
      performance.now = vi.fn(() => mockTime);

      // Second interim with >= 4 characters triggers promotion to final
      createdRecognition.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: '測試中字數大於四' }, isFinal: false, length: 1 }]
      });

      expect(createdRecognition.stop).toHaveBeenCalled();
      expect(onResult).toHaveBeenCalledWith('測試中字數大於四', true, false);

      performance.now = originalNow;
    });

    it('should handle error when recognitionInstance.start() throws', async () => {
      class ThrowingRecognition {
        start() {
          throw new Error('Mic already active');
        }
      }
      window.SpeechRecognition = ThrowingRecognition;

      const onError = vi.fn();
      const stt = initDefaultSTTEngine({ onError });

      await stt.startListening();
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Mic already active'), false);
    });

    it('should cover onend, aborted error, no-speech abort at 4 runs, and empty result in STT engine', async () => {
      let createdRecognition;
      class MockRecognition {
        constructor() {
          this.continuous = false;
          this.interimResults = true;
          this.onstart = null;
          this.onend = null;
          this.onerror = null;
          this.onresult = null;
          createdRecognition = this;
        }
        start() {
          this.onstart();
        }
        stop() {
          this.onend();
        }
      }
      window.SpeechRecognition = MockRecognition;

      const onNoSpeechAbort = vi.fn();
      const onError = vi.fn();
      const onStatusChange = vi.fn();
      const onResult = vi.fn();

      const stt = initDefaultSTTEngine({
        getConvoOn: () => true,
        onNoSpeechAbort,
        onError,
        onStatusChange,
        onResult
      });

      await stt.startListening();

      // 1. onerror with 'aborted'
      createdRecognition.onerror({ error: 'aborted' });
      expect(onError).not.toHaveBeenCalled();

      // 2. onerror with 'no-speech' repeatedly until threshold (>= 4)
      createdRecognition.onerror({ error: 'no-speech' });
      createdRecognition.onerror({ error: 'no-speech' });
      createdRecognition.onerror({ error: 'no-speech' });
      createdRecognition.onerror({ error: 'no-speech' });
      expect(onNoSpeechAbort).toHaveBeenCalled();

      // 3. onresult with empty/whitespace string
      createdRecognition.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: '   ' }, isFinal: false, length: 1 }]
      });
      expect(onResult).not.toHaveBeenCalled();

      // 4. onend when listening
      createdRecognition.onend();
      expect(onStatusChange).toHaveBeenCalledWith(false, '', false);
    });
  });
});
