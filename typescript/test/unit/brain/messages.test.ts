import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBrainMessage,
  getWelcomeText,
  resolveAutoContinuePrompt,
  buildDefaultLLMMessages
} from '@/core/brain/messages';
import { AVATAR_MODE_MAP, BRAIN_ENGINE_TYPE_MAP } from '@/core/constants';
import type { BrainEngine } from '@core';

describe('Brain Messages & Prompt Building (Deep Branch Coverage)', () => {
  let mockBrainEngine: any;

  beforeEach(() => {
    mockBrainEngine = {
      locale: 'zh-TW',
      avatarMode: AVATAR_MODE_MAP.assistant,
      gender: 'female',
      knowledge: [{ q: '問題', a: '答案' }],
      memory: {
        enabled: true,
        data: { visits: 1, name: 'Alice', summary: '' }
      },
      chatLog: []
    };
  });

  describe('getBrainMessage', () => {
    it('should use i18nEngine.t if available, otherwise fallback to locale dictionaries or raw key', () => {
      // With i18nEngine
      mockBrainEngine.i18nEngine = {
        t: vi.fn((k: string, p: any) => `translated:${k}:${p?.name || ''}`)
      };
      expect(getBrainMessage(mockBrainEngine as BrainEngine, 'test.key', { name: 'Bob' })).toBe('translated:test.key:Bob');

      // Without i18nEngine, default zh-TW
      delete mockBrainEngine.i18nEngine;
      expect(getBrainMessage(mockBrainEngine as BrainEngine, 'brain.llm.loading')).toBe('開始下載 AI 大腦（約 1GB，只需第一次）…');

      // Unknown key falls back to key itself
      expect(getBrainMessage(mockBrainEngine as BrainEngine, 'unknown.nonexistent.key')).toBe('unknown.nonexistent.key');
    });
  });

  describe('getWelcomeText', () => {
    it('should support top-level welcomeText as string and async Promise', async () => {
      mockBrainEngine.welcomeText = '自訂頂層歡迎詞';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toBe('自訂頂層歡迎詞');

      mockBrainEngine.welcomeText = async () => '非同步歡迎詞';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toBe('非同步歡迎詞');
    });

    it('should support custom avatar mode welcomeText as string and async Promise', async () => {
      delete mockBrainEngine.welcomeText;
      mockBrainEngine.avatarMode = 'customDoc';
      mockBrainEngine.modes = {
        customDoc: { welcomeText: async () => '醫生歡迎您' }
      };

      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toBe('醫生歡迎您');
    });

    it('should resolve companion welcomeText on returning visits across en, ja, ko, zh', async () => {
      mockBrainEngine.avatarMode = AVATAR_MODE_MAP.companion;
      mockBrainEngine.memory.data.visits = 5;

      // en-US with name
      mockBrainEngine.locale = 'en-US';
      mockBrainEngine.memory.data.name = 'Alice';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('Alice, welcome back! This is our 5th visit!');

      // en-US without name
      mockBrainEngine.memory.data.name = '';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('welcome back! This is our 5th visit!');

      // ja-JP
      mockBrainEngine.locale = 'ja-JP';
      mockBrainEngine.memory.data.name = 'サクラ';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('サクラさん、おかえりなさい！5回目の訪問ですね！');

      // ko-KR
      mockBrainEngine.locale = 'ko-KR';
      mockBrainEngine.memory.data.name = '지우';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('지우님, 다시 오신 것을 환영해요! 벌써 5번째 만남이네요!');

      // zh-TW
      mockBrainEngine.locale = 'zh-TW';
      mockBrainEngine.memory.data.name = '小美';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('小美，歡迎回來～這是我們第 5 次見面！');
    });

    it('should resolve companion first visit welcomeText across en, ja, ko, zh', async () => {
      mockBrainEngine.avatarMode = AVATAR_MODE_MAP.companion;
      mockBrainEngine.memory.data.visits = 1;

      mockBrainEngine.locale = 'en-US';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('Hi~ I am your companion avatar!');

      mockBrainEngine.locale = 'ja-JP';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('こんにちは〜！お話し相手のアバターです！');

      mockBrainEngine.locale = 'ko-KR';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('안녕하세요~ 대화형 버추얼 아바타입니다!');

      mockBrainEngine.locale = 'zh-TW';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('嗨～我是這裡的陪聊虛擬人！');
    });

    it('should resolve assistant welcomeText across en, ja, ko, zh', async () => {
      mockBrainEngine.avatarMode = AVATAR_MODE_MAP.assistant;

      mockBrainEngine.locale = 'en-US';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('Click 🎤 to speak');

      mockBrainEngine.locale = 'ja-JP';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('🎤 を押して話すか');

      mockBrainEngine.locale = 'ko-KR';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('🎤를 눌러 말하거나');

      mockBrainEngine.locale = 'zh-TW';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('點 🎤 說話');
    });
  });

  describe('resolveAutoContinuePrompt', () => {
    it('should resolve default auto-continue prompt across languages', () => {
      mockBrainEngine.locale = 'zh-TW';
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 1)).toContain('請接著你剛才尚未說完的內容');

      mockBrainEngine.locale = 'en-US';
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 1)).toContain('Please continue directly');

      mockBrainEngine.locale = 'ja-JP';
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 1)).toContain('先ほどの続きから');

      mockBrainEngine.locale = 'ko-KR';
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 1)).toContain('이전 문장을 반복하지 말고');
    });

    it('should support custom function and string prompt', () => {
      mockBrainEngine.autoContinuePrompt = (_brain: any, index: number, text: string) => `繼續第 ${index} 次：${text}`;
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 2, '前文')).toBe('繼續第 2 次：前文');

      mockBrainEngine.autoContinuePrompt = '自訂接續字串';
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 1)).toBe('自訂接續字串');
    });
  });

  describe('buildDefaultLLMMessages', () => {
    it('should build complete prompt with female/male gender rules in different languages', async () => {
      // Female in EN
      mockBrainEngine.locale = 'en-US';
      mockBrainEngine.gender = 'female';
      mockBrainEngine.customContext = { 'Special Field': ['ValueA', 'ValueB'] };

      const msgsEn = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, 'How are you?');
      expect(msgsEn[0].role).toBe('system');
      expect(msgsEn[0].content).toContain('feminine phrasing');
      expect(msgsEn[0].content).toContain('ValueA、ValueB');
      expect(msgsEn[1].role).toBe('user');
      expect(msgsEn[1].content).toBe('How are you?');

      // Female in JA
      mockBrainEngine.locale = 'ja-JP';
      mockBrainEngine.gender = 'female';
      mockBrainEngine.customContext = null;
      const msgsJaFem = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, 'お元気ですか？');
      expect(msgsJaFem[0].content).toContain('あなたは女性です');
      expect(msgsJaFem[0].content).toContain('【参考資料】');

      // Female in KO
      mockBrainEngine.locale = 'ko-KR';
      mockBrainEngine.gender = 'female';
      const msgsKoFem = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '잘 지내세요?');
      expect(msgsKoFem[0].content).toContain('당신은 여성입니다');
      expect(msgsKoFem[0].content).toContain('【참고자료】');

      // Female in ZH
      mockBrainEngine.locale = 'zh-TW';
      mockBrainEngine.gender = 'female';
      const msgsZhFem = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '你好嗎？');
      expect(msgsZhFem[0].content).toContain('你是一名女性');
      expect(msgsZhFem[0].content).toContain('【參考資料】');

      // Male in EN
      mockBrainEngine.locale = 'en-US';
      mockBrainEngine.gender = 'male';
      const msgsEnMale = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, 'Hello');
      expect(msgsEnMale[0].content).toContain('masculine phrasing');

      // Male in JA
      mockBrainEngine.locale = 'ja-JP';
      mockBrainEngine.gender = 'male';
      const msgsJa = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '元気？');
      expect(msgsJa[0].content).toContain('あなたは男性です');

      // Male in KO
      mockBrainEngine.locale = 'ko-KR';
      mockBrainEngine.gender = 'male';
      const msgsKo = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '안녕');
      expect(msgsKo[0].content).toContain('당신은 남성입니다');

      // Male in ZH
      mockBrainEngine.locale = 'zh-TW';
      mockBrainEngine.gender = 'male';
      const msgsZh = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '你好');
      expect(msgsZh[0].content).toContain('你是一名男性');
    });

    it('should assemble companion persona in companion mode with memory and summary across languages', async () => {
      mockBrainEngine.avatarMode = AVATAR_MODE_MAP.companion;
      mockBrainEngine.memory.data.name = '小美';
      mockBrainEngine.memory.data.summary = '上次聊到喜歡貓咪';
      mockBrainEngine.compression = { strategy: 'rolling-summary' };

      // zh-TW
      mockBrainEngine.locale = 'zh-TW';
      const msgsZh = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '今天好嗎？');
      expect(msgsZh[0].content).toContain('小美');
      expect(msgsZh[0].content).toContain('喜歡貓咪');

      // en-US
      mockBrainEngine.locale = 'en-US';
      const msgsEn = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, 'How is your day?');
      expect(msgsEn[0].content).toContain('visitor\'s name is "小美"');

      // ja-JP
      mockBrainEngine.locale = 'ja-JP';
      const msgsJa = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, 'こんにちは');
      expect(msgsJa[0].content).toContain('訪問者の名前は「小美」です');

      // ko-KR
      mockBrainEngine.locale = 'ko-KR';
      const msgsKo = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '안녕하세요');
      expect(msgsKo[0].content).toContain('방문자의 이름은 "小美"입니다');
    });

    it('should support custom mode with systemPrompt string and localized dictionary', async () => {
      mockBrainEngine.avatarMode = 'docMode';
      mockBrainEngine.modes = {
        docMode: {
          systemPrompt: {
            'zh-TW': '專屬醫生模式：{{RAG}} {{styleRule}}',
            'en-US': 'Dedicated doctor mode: {{RAG}} {{styleRule}}'
          }
        }
      };

      mockBrainEngine.locale = 'zh-TW';
      const msgsZh = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '頭痛');
      expect(msgsZh[0].content).toContain('專屬醫生模式');

      mockBrainEngine.locale = 'en-US';
      const msgsEn = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, 'headache');
      expect(msgsEn[0].content).toContain('Dedicated doctor mode');
    });

    it('should format different historyItem content structures and handle custom systemContextTemplate', async () => {
      // Custom systemContextTemplate with function
      mockBrainEngine.systemContextTemplate = (_brain: any, _rag: any, _style: any) => `[EXPERT TEMPLATE]`;
      mockBrainEngine.memory.enabled = true;
      mockBrainEngine.memory.data = {
        history: [
          { role: 'user', content: '普通字串' },
          { role: 'assistant', content: { text: '巢狀物件字串' } },
          { role: 'user', text: '頂層 text 屬性' },
          { role: 'assistant', content: { detail: '純物件' } },
          { role: 'user', content: 12345 }
        ]
      };

      const msgs = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '專家請回答', BRAIN_ENGINE_TYPE_MAP.WEB_LLM);
      expect(msgs[0].content).toContain('[EXPERT TEMPLATE]');
      expect(msgs.find((m) => m.content === '普通字串')).toBeDefined();
      expect(msgs.find((m) => m.content === '巢狀物件字串')).toBeDefined();
      expect(msgs.find((m) => m.content === '頂層 text 屬性')).toBeDefined();
      expect(msgs.find((m) => m.content === '{"detail":"純物件"}')).toBeDefined();
      expect(msgs.find((m) => m.content === '12345')).toBeDefined();
    });

    it('should test assistant welcome text and default greetings across all locales', async () => {
      mockBrainEngine.avatarMode = AVATAR_MODE_MAP.assistant;

      // 1. assistantWelcomeText as Promise and string
      mockBrainEngine.assistantWelcomeText = async () => '非同步助理歡迎詞';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toBe('非同步助理歡迎詞');

      mockBrainEngine.assistantWelcomeText = '助理字串歡迎詞';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toBe('助理字串歡迎詞');

      delete mockBrainEngine.assistantWelcomeText;

      // 2. Default assistant welcome across locales
      mockBrainEngine.locale = 'en-US';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('Click 🎤 to speak');

      mockBrainEngine.locale = 'ja-JP';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('🎤 を押して話すか');

      mockBrainEngine.locale = 'ko-KR';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('🎤를 눌러 말하거나');

      mockBrainEngine.locale = 'zh-TW';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toContain('點 🎤 說話');
    });

    it('should test companionWelcomeText as Promise and string', async () => {
      mockBrainEngine.avatarMode = AVATAR_MODE_MAP.companion;

      mockBrainEngine.companionWelcomeText = async () => '非同步陪聊歡迎詞';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toBe('非同步陪聊歡迎詞');

      mockBrainEngine.companionWelcomeText = '陪聊字串歡迎詞';
      expect(await getWelcomeText(mockBrainEngine as BrainEngine)).toBe('陪聊字串歡迎詞');
    });

    it('should format RAG knowledge sources with title and url, and test female gender phrasing', async () => {
      mockBrainEngine.knowledge = [
        {
          q: '知識問題',
          a: '知識答案',
          source: { title: '知識庫手冊', url: 'https://kb.example.com' }
        }
      ];

      // Female in EN
      mockBrainEngine.gender = 'female';
      mockBrainEngine.locale = 'en-US';
      const msgsEn = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '知識問題');
      expect(msgsEn[0].content).toContain('來源：知識庫手冊 https://kb.example.com');
      expect(msgsEn[0].content).toContain('You are female');

      // Female in JA
      mockBrainEngine.locale = 'ja-JP';
      const msgsJa = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '知識問題');
      expect(msgsJa[0].content).toContain('あなたは女性です');

      // Female in KO
      mockBrainEngine.locale = 'ko-KR';
      const msgsKo = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '知識問題');
      expect(msgsKo[0].content).toContain('당신은 여성입니다');

      // Female in ZH
      mockBrainEngine.locale = 'zh-TW';
      const msgsZh = await buildDefaultLLMMessages(mockBrainEngine as BrainEngine, '知識問題');
      expect(msgsZh[0].content).toContain('你是一名女性');
    });

    it('should resolve autoContinuePrompt as function, string, or localized object', () => {
      // 1. autoContinuePrompt as function
      mockBrainEngine.autoContinuePrompt = vi.fn((_b: any, idx: number) => `第 ${idx} 續講提示`);
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 1, '第一段')).toBe('第 1 續講提示');

      // 2. autoContinuePrompt as string
      mockBrainEngine.autoContinuePrompt = '固定續講指令';
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 2, '前文')).toBe('固定續講指令');

      // 3. autoContinuePrompt across locales
      delete mockBrainEngine.autoContinuePrompt;
      mockBrainEngine.locale = 'en-US';
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 1, 'text')).toContain('Please continue directly from where you left off');

      mockBrainEngine.locale = 'ja-JP';
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 1, 'text')).toContain('先ほどの続きから');

      mockBrainEngine.locale = 'ko-KR';
      expect(resolveAutoContinuePrompt(mockBrainEngine as BrainEngine, 1, 'text')).toContain('이전 문장을 반복하지 말고');
    });
  });
});
