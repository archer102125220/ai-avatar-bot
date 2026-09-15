import { describe, it, expect, vi } from 'vitest';
import {
  validateTTSEngine,
  loadVoice,
  splitSentences,
  initDefaultTTSEngine
} from '../../../core/speech/tts';
import { GENDER_MAP } from '../../../core/constants';

describe('Unit Test: core/speech/tts.js', () => {
  describe('validateTTSEngine', () => {
    it('should report missing methods when invalid engine is passed', () => {
      const result = validateTTSEngine({});
      expect(result.isValid).toBe(false);
      expect(result.missing).toContain('speak()');
      expect(result.missing).toContain('stop()');
      expect(result.missing).toContain('computeMouth()');
      expect(result.missing).toContain('isSpeaking');
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

    it('should return whole text if no punctuation exists', () => {
      expect(splitSentences('這是一段沒有標點符號的文字')).toEqual([
        '這是一段沒有標點符號的文字'
      ]);
    });
  });

  describe('loadVoice', () => {
    it('should load matching voice from speechSynthesis.getVoices()', () => {
      const voice = loadVoice(GENDER_MAP.female, 'zh-TW');
      expect(voice).not.toBeNull();
      expect(voice?.lang).toBe('zh-TW');
    });
  });

  describe('initDefaultTTSEngine', () => {
    it('should initialize TTS engine and handle speak and stop lifecycle', () => {
      const onSpokenDisplayTextChange = vi.fn();
      const onSpeakStart = vi.fn();
      const onSpeakEnd = vi.fn();

      const tts = initDefaultTTSEngine({
        gender: GENDER_MAP.female,
        locale: 'zh-TW',
        onSpokenDisplayTextChange,
        onSpeakStart,
        onSpeakEnd
      });

      expect(tts.isSpeaking).toBe(false);
      expect(tts.isMuted).toBe(false);

      tts.speak('你好，歡迎使用 AI Avatar');
      expect(onSpokenDisplayTextChange).toHaveBeenCalledWith(
        '你好，歡迎使用 AI Avatar'
      );

      tts.stop();
      expect(tts.isSpeaking).toBe(false);
    });

    it('should compute mouth openness value within 0 to 1', () => {
      const tts = initDefaultTTSEngine();
      const mouthValue = tts.computeMouth();
      expect(typeof mouthValue).toBe('number');
      expect(mouthValue).toBeGreaterThanOrEqual(0);
      expect(mouthValue).toBeLessThanOrEqual(1);
    });

    it('should support updating gender and locale', () => {
      const tts = initDefaultTTSEngine();
      tts.setGender(GENDER_MAP.male);
      tts.setLocale('en-US');

      const state = tts.getState();
      expect(state.gender).toBe(GENDER_MAP.male);
      expect(state.locale).toBe('en-US');
    });
  });
});
