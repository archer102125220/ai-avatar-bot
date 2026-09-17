import { describe, it, expect, vi } from 'vitest';
import { classifyEmotion, applyEmotionFromText } from '@/core/brain/emotion';

describe('Unit Test: core/brain/emotion.js', () => {
  describe('classifyEmotion', () => {
    it('should classify happy emotion for joyful expressions and greetings', () => {
      expect(classifyEmotion('太好了，很高興認識你！🎉')).toBe('happy');
      expect(classifyEmotion('謝謝你，沒問題！')).toBe('happy');
      expect(classifyEmotion('恭喜完成任務！')).toBe('happy');
    });

    it('should classify sad emotion for regrets and errors', () => {
      expect(classifyEmotion('非常抱歉，這個功能暫時失敗了。')).toBe('sad');
      expect(classifyEmotion('真可惜，連不上伺服器。')).toBe('sad');
    });

    it('should classify surprised emotion for shock and disbelief', () => {
      expect(classifyEmotion('哇！沒想到居然可以這樣做！？')).toBe('surprised');
      expect(classifyEmotion('真的嗎？！太不可思議了！')).toBe('surprised');
    });

    it('should return neutral for standard plain statements', () => {
      expect(classifyEmotion('台北今天氣溫攝氏 24 度。')).toBe('neutral');
      expect(classifyEmotion('')).toBe('neutral');
      // @ts-ignore: Defensive runtime type checking test for null input
      expect(classifyEmotion(null)).toBe('neutral');
      // @ts-ignore: Defensive runtime type checking test for undefined input
      expect(classifyEmotion(undefined)).toBe('neutral');
      // Sad and happy count tie / balanced
      expect(classifyEmotion('謝謝你，但是連不上伺服器。')).toBe('happy');
      expect(classifyEmotion('抱歉失敗了，謝謝大家！')).toBe('sad');
    });
  });

  describe('applyEmotionFromText', () => {
    it('should trigger onEmotionChange callback on brainEngine', () => {
      const onEmotionChange = vi.fn();
      const brainEngine = { onEmotionChange };

      applyEmotionFromText(brainEngine as any, '太棒了，完成囉！');
      expect(onEmotionChange).toHaveBeenCalledWith('happy');
    });

    it('should handle null or invalid brainEngine safely without errors', () => {
      // @ts-ignore: Defensive runtime type checking test
      expect(() => applyEmotionFromText(null, '太棒了')).not.toThrow();
      // @ts-ignore: Defensive runtime type checking test
      expect(() => applyEmotionFromText({}, '太棒了')).not.toThrow();
      // @ts-ignore: Defensive runtime type checking test
      expect(() => applyEmotionFromText({ onEmotionChange: null }, '太棒了')).not.toThrow();
    });
  });
});
