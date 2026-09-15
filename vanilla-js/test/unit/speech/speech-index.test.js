import { describe, it, expect, vi } from 'vitest';
import { drainSentences, initSpeechEngine } from '../../../core/speech';
import { GENDER_MAP } from '../../../core/constants';

describe('Unit Test: core/speech/index.js', () => {
  describe('drainSentences', () => {
    it('should drain completed sentences ending with punctuation', () => {
      const state = { buf: '你好呀！今天想聊什麼呢？剩餘未結束' };
      const sentences = drainSentences(state, false);

      expect(sentences).toEqual(['你好呀！', '今天想聊什麼呢？']);
      expect(state.buf).toBe('剩餘未結束');
    });

    it('should drain remaining buffer when force is true', () => {
      const state = { buf: '最後一句話' };
      const sentences = drainSentences(state, true);

      expect(sentences).toEqual(['最後一句話']);
      expect(state.buf).toBe('');
    });
  });

  describe('initSpeechEngine', () => {
    it('should initialize speech coordinator engine with STT and TTS', async () => {
      const onSpokenDisplayTextChange = vi.fn();
      const onMicStateChanged = vi.fn();

      const engine = await initSpeechEngine({
        getGender: () => GENDER_MAP.female,
        locale: 'zh-TW',
        onSpokenDisplayTextChange,
        onMicStateChanged
      });

      expect(engine).toBeDefined();
      expect(typeof engine.speak).toBe('function');
      expect(typeof engine.stopSpeaking).toBe('function');
      expect(typeof engine.startListening).toBe('function');
      expect(typeof engine.setMic).toBe('function');
      expect(typeof engine.beginSpeech).toBe('function');
      expect(typeof engine.pushSpeech).toBe('function');
      expect(typeof engine.computeMouth).toBe('function');
    });

    it('should manage streaming speech lifecycle (beginSpeech -> pushSpeech -> endSpeech)', async () => {
      const engine = await initSpeechEngine();
      const seq1 = engine.beginSpeech();
      expect(typeof seq1).toBe('number');

      engine.pushSpeech(seq1, '第一句測試。');
      engine.endSpeech(seq1);

      expect(engine.speakSeq).toBeGreaterThanOrEqual(seq1);

      const seq2 = engine.beginSpeech();
      expect(seq2).toBeGreaterThan(seq1);
    });

    it('should coordinate stopSpeaking and interruptForVoice', async () => {
      const onInterrupt = vi.fn();
      const engine = await initSpeechEngine({ onInterrupt });

      engine.speak('正在播放中');
      expect(engine.spokenDisplayText).toBe('正在播放中');

      engine.stopSpeaking();
      engine.interruptForVoice();
      expect(onInterrupt).toHaveBeenCalled();
    });
  });
});
