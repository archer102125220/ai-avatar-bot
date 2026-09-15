import { describe, it, expect } from 'vitest';
import {
  getBrainMessage,
  getWelcomeText,
  resolveAutoContinuePrompt,
  buildDefaultLLMMessages
} from '../../../core/brain/messages';
import { GENDER_MAP, BRAIN_ENGINE_TYPE_MAP } from '../../../core/constants';

describe('Unit Test: core/brain/messages.js', () => {
  describe('getBrainMessage', () => {
    it('should return localized message with parameter interpolation', () => {
      const brainEngine = { locale: 'zh-TW' };
      const msg = getBrainMessage(brainEngine, 'welcome', { name: '小明' });
      expect(typeof msg).toBe('string');
    });
  });

  describe('getWelcomeText', () => {
    it('should generate welcome text based on locale and memory visits', async () => {
      const brainEngine = {
        locale: 'zh-TW',
        avatarMode: 'assistant',
        memory: {
          enabled: true,
          data: { visits: 1, name: 'Parker' }
        }
      };

      const welcome = await getWelcomeText(brainEngine);
      expect(typeof welcome).toBe('string');
      expect(welcome.length).toBeGreaterThan(0);
    });

    it('should support custom welcomeText function', async () => {
      const brainEngine = {
        locale: 'zh-TW',
        welcomeText: (ctx) => `哈囉 ${ctx.name}，這是你的第 ${ctx.visits} 次訪問！`,
        memory: {
          enabled: true,
          data: { visits: 3, name: 'Alice' }
        }
      };

      const welcome = await getWelcomeText(brainEngine);
      expect(welcome).toBe('哈囉 Alice，這是你的第 3 次訪問！');
    });
  });

  describe('resolveAutoContinuePrompt', () => {
    it('should return localized default auto continue prompt', () => {
      const promptZh = resolveAutoContinuePrompt({ locale: 'zh-TW' }, 1, '');
      expect(promptZh).toContain('繼續');

      const promptEn = resolveAutoContinuePrompt({ locale: 'en-US' }, 1, '');
      expect(promptEn).toContain('continue');
    });

    it('should support custom function prompt', () => {
      const customFn = (ctx, idx, text) => `Custom prompt turn ${idx}: ${text}`;
      const prompt = resolveAutoContinuePrompt(
        { autoContinuePrompt: customFn, locale: 'zh-TW' },
        2,
        '已生成的內容'
      );
      expect(prompt).toBe('Custom prompt turn 2: 已生成的內容');
    });
  });

  describe('buildDefaultLLMMessages', () => {
    it('should build messages array containing system prompt and user question', async () => {
      const brainEngine = {
        locale: 'zh-TW',
        gender: GENDER_MAP.female,
        knowledge: [],
        memory: {
          enabled: true,
          data: {
            history: [{ role: 'user', content: '之前說過的話' }],
            summary: ''
          }
        },
        compression: {}
      };

      const messages = await buildDefaultLLMMessages(
        brainEngine,
        '今天天氣如何？',
        BRAIN_ENGINE_TYPE_MAP.AI_PROVIDER
      );

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('女性');
      expect(messages[messages.length - 1]).toEqual({
        role: 'user',
        content: '今天天氣如何？'
      });
    });
  });
});
