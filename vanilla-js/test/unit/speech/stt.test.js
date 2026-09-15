import { describe, it, expect, vi } from 'vitest';
import {
  validateSTTEngine,
  initDefaultSTTEngine,
  getSttMessage
} from '../../../core/speech/stt';

describe('Unit Test: core/speech/stt.js', () => {
  describe('validateSTTEngine', () => {
    it('should report missing methods when invalid engine is passed', () => {
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
    it('should retrieve localized message with parameter formatting', () => {
      const msgZh = getSttMessage('zh-TW', 'startFailed', { error: '連線逾時' });
      expect(msgZh).toContain('語音辨識啟動失敗：連線逾時');

      const msgEn = getSttMessage('en-US', 'startFailed', { error: 'Timeout' });
      expect(msgEn).toContain('Failed to start speech recognition: Timeout');
    });

    it('should fallback to zh-TW for unknown locale', () => {
      const msg = getSttMessage('fr-FR', 'listening');
      expect(msg).toBe('請說話，可以隨時插話…');
    });
  });

  describe('initDefaultSTTEngine', () => {
    it('should initialize STT engine with default state', () => {
      const onResult = vi.fn();
      const onStatusChange = vi.fn();
      const onError = vi.fn();

      const stt = initDefaultSTTEngine({
        onResult,
        onStatusChange,
        onError,
        locale: 'zh-TW'
      });

      expect(stt.isListening).toBe(false);
      expect(typeof stt.startListening).toBe('function');
      expect(typeof stt.stopListening).toBe('function');
    });

    it('should start and stop listening cleanly', async () => {
      const onStatusChange = vi.fn();
      const stt = initDefaultSTTEngine({
        onStatusChange
      });

      await stt.startListening();
      expect(stt.isListening).toBe(true);

      stt.stopListening();
      expect(stt.isListening).toBe(false);
    });
  });
});
