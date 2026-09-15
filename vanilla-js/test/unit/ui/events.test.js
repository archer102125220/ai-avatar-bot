import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bindTyping, bindUiEvent } from '../../../core/ui/events';
import { initUi } from '../../../core/ui/dom';
import { initI18nEngine } from '../../../core/i18n';
import { STATE_MAP } from '../../../core/constants';

describe('UI Events Binding', () => {
  let container;
  let stageEl;
  let i18nEngine;
  let uiDom;
  let mockContext;

  beforeEach(() => {
    container = document.createElement('div');
    stageEl = document.createElement('div');
    i18nEngine = initI18nEngine({ locale: 'zh-TW' });
    uiDom = initUi(container, stageEl, i18nEngine);

    mockContext = {
      uiDom,
      i18nEngine,
      isMinimal: false,
      isIframe: false,
      avatarMode: 'assistant',
      STATE_MAP,
      handleUser: vi.fn(),
      onMinimalTrigger: vi.fn(),
      speechEngine: {
        convoOn: false,
        isListening: false,
        isProcessing: false,
        isSpeaking: false,
        ttsMuted: false,
        ttsRate: 1.0,
        spokenDisplayText: '',
        startListening: vi.fn(),
        stopVoiceSession: vi.fn(),
        stopSpeaking: vi.fn(),
        interruptForVoice: vi.fn()
      },
      brainEngine: {
        chatLog: [{ role: 'user', text: 'hi' }],
        memory: { clear: vi.fn() },
        aiProvider: { enabled: false },
        llm: { supported: true, state: STATE_MAP.UNLOADED, load: vi.fn() }
      }
    };
  });

  describe('bindTyping', () => {
    it('should send user text when clicking send button or pressing Enter', () => {
      bindTyping(mockContext);

      uiDom.questionInputEl.value = '什麼是 AI 虛擬人？';
      uiDom.sendButtonEl.click();

      expect(mockContext.handleUser).toHaveBeenCalledWith('什麼是 AI 虛擬人？');
      expect(uiDom.questionInputEl.value).toBe('');

      // Test Enter keydown
      uiDom.questionInputEl.value = '測試 Enter 送出';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      uiDom.questionInputEl.dispatchEvent(enterEvent);

      expect(mockContext.handleUser).toHaveBeenCalledWith('測試 Enter 送出');
      expect(uiDom.questionInputEl.value).toBe('');
    });

    it('should ignore empty text or IME composition Enter key', () => {
      bindTyping(mockContext);

      uiDom.questionInputEl.value = '   ';
      uiDom.sendButtonEl.click();
      expect(mockContext.handleUser).not.toHaveBeenCalled();

      // IME composition Enter (keyCode 229)
      uiDom.questionInputEl.value = '輸入中';
      const imeEvent = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true });
      uiDom.questionInputEl.dispatchEvent(imeEvent);
      expect(mockContext.handleUser).not.toHaveBeenCalled();
    });
  });

  describe('bindUiEvent', () => {
    it('should toggle minimal mode on minimalEl and closeButtonEl click', () => {
      bindUiEvent(mockContext);

      // Click minimal button to open
      mockContext.isMinimal = true;
      uiDom.minimalEl.click();
      expect(mockContext.isMinimal).toBe(false);

      // Click close button to minimize
      uiDom.closeButtonEl.click();
      expect(mockContext.isMinimal).toBe(true);

      // Test iframe mode close button
      mockContext.isIframe = true;
      uiDom.closeButtonEl.click();
      expect(mockContext.onMinimalTrigger).toHaveBeenCalledWith(true, mockContext);
    });

    it('should handle mic button click in standard and companion modes', () => {
      bindUiEvent(mockContext);

      // Standard mode: start listening
      uiDom.micButtonEl.click();
      expect(mockContext.speechEngine.startListening).toHaveBeenCalled();

      // Standard mode: when speaking, interrupt and start listening
      mockContext.speechEngine.isSpeaking = true;
      uiDom.micButtonEl.click();
      expect(mockContext.speechEngine.interruptForVoice).toHaveBeenCalled();

      // Companion mode: start listening when idle
      mockContext.avatarMode = 'companion';
      mockContext.speechEngine.isSpeaking = false;
      mockContext.speechEngine.isListening = false;
      mockContext.speechEngine.isProcessing = false;
      uiDom.micButtonEl.click();
      expect(mockContext.speechEngine.convoOn).toBe(true);
      expect(mockContext.speechEngine.startListening).toHaveBeenCalled();
    });

    it('should toggle mute state and update button icon on muteButtonEl click', () => {
      bindUiEvent(mockContext);

      uiDom.muteButtonEl.click();
      expect(mockContext.speechEngine.ttsMuted).toBe(true);
      expect(uiDom.muteButtonEl.textContent).toBe('🔇');
      expect(mockContext.speechEngine.stopSpeaking).toHaveBeenCalled();

      uiDom.muteButtonEl.click();
      expect(mockContext.speechEngine.ttsMuted).toBe(false);
      expect(uiDom.muteButtonEl.textContent).toBe('🔊');
    });

    it('should cycle speech rate on speedButtonEl click', () => {
      bindUiEvent(mockContext);

      expect(mockContext.speechEngine.ttsRate).toBe(1.0);
      uiDom.speedButtonEl.click();
      expect(mockContext.speechEngine.ttsRate).toBe(1.2);
      expect(uiDom.speedButtonEl.textContent).toBe('1.2×');

      uiDom.speedButtonEl.click();
      expect(mockContext.speechEngine.ttsRate).toBe(1.4);
      expect(uiDom.speedButtonEl.textContent).toBe('1.4×');

      uiDom.speedButtonEl.click();
      expect(mockContext.speechEngine.ttsRate).toBe(0.9);
      expect(uiDom.speedButtonEl.textContent).toBe('0.9×');
    });

    it('should cycle languages on langButtonEl click', () => {
      bindUiEvent(mockContext);

      uiDom.langButtonEl.click();
      expect(i18nEngine.locale).toBe('en-US');

      uiDom.langButtonEl.click();
      expect(i18nEngine.locale).toBe('ja-JP');
    });

    it('should toggle history panel and clear chat logs on history actions', () => {
      bindUiEvent(mockContext);

      // Open history
      uiDom.historyButtonEl.click();
      expect(uiDom.historyPanelEl.getAttribute('css-is-open')).toBe('true');

      // Close history via panel close button
      const closeBtn = uiDom.historyPanelEl.querySelector('#btn-history-close');
      closeBtn.click();
      expect(uiDom.historyPanelEl.getAttribute('css-is-open')).toBeNull();

      // Clear history
      const clearBtn = uiDom.historyPanelEl.querySelector('#btn-history-clear');
      clearBtn.click();
      expect(mockContext.brainEngine.memory.clear).toHaveBeenCalled();
      expect(mockContext.brainEngine.chatLog.length).toBe(0);
    });

    it('should handle companion mode stop voice session and standard mode active stop', () => {
      bindUiEvent(mockContext);

      // Companion mode active -> stop session
      mockContext.avatarMode = 'companion';
      mockContext.speechEngine.isListening = true;
      mockContext.speechEngine.isProcessing = false;
      uiDom.micButtonEl.click();
      expect(mockContext.speechEngine.convoOn).toBe(false);
      expect(mockContext.speechEngine.stopVoiceSession).toHaveBeenCalled();

      // Standard mode active -> stop session
      mockContext.avatarMode = 'assistant';
      mockContext.speechEngine.isListening = true;
      uiDom.micButtonEl.click();
      expect(mockContext.speechEngine.stopVoiceSession).toHaveBeenCalled();
    });

    it('should cycle languages without i18nEngine and format fallback strings', () => {
      const customContext = {
        ...mockContext,
        i18nEngine: null,
        locale: 'zh-TW'
      };
      bindUiEvent(customContext);

      // zh-TW -> en-US
      uiDom.langButtonEl.click();
      expect(customContext.locale).toBe('en-US');
      expect(customContext.speechEngine.spokenDisplayText).toBe('Language: English');

      // en-US -> ja-JP
      uiDom.langButtonEl.click();
      expect(customContext.locale).toBe('ja-JP');
      expect(customContext.speechEngine.spokenDisplayText).toBe('言語：日本語');

      // ja-JP -> ko-KR
      uiDom.langButtonEl.click();
      expect(customContext.locale).toBe('ko-KR');
      expect(customContext.speechEngine.spokenDisplayText).toBe('언어: 한국어');

      // ko-KR -> zh-TW
      uiDom.langButtonEl.click();
      expect(customContext.locale).toBe('zh-TW');
      expect(customContext.speechEngine.spokenDisplayText).toBe('語言：繁體中文');
    });

    it('should handle AI provider and WebLLM readiness states on btnLlmEl click', async () => {
      bindUiEvent(mockContext);

      // 1. AI Provider enabled and ready
      mockContext.brainEngine.aiProvider = {
        enabled: true,
        ready: true,
        model: 'llama3:latest',
        ping: vi.fn().mockResolvedValue(true)
      };
      await uiDom.btnLlmEl.onclick();
      expect(uiDom.btnLlmEl.textContent).toBe('🧠✓');
      expect(uiDom.btnLlmEl.getAttribute('css-llm-on')).toBe('true');
      expect(mockContext.speechEngine.spokenDisplayText).toContain('AI 伺服器大腦運作中');

      // 2. AI Provider enabled but not ready
      mockContext.brainEngine.aiProvider.ready = false;
      mockContext.brainEngine.aiProvider.ping = vi.fn().mockResolvedValue(false);
      await uiDom.btnLlmEl.onclick();
      expect(uiDom.btnLlmEl.textContent).toBe('🧠✗');
      expect(uiDom.btnLlmEl.getAttribute('css-llm-on')).toBeNull();
      expect(mockContext.speechEngine.spokenDisplayText).toContain('AI 伺服器連不上');

      // 3. WebLLM not supported
      mockContext.brainEngine.aiProvider = { enabled: false };
      mockContext.brainEngine.llm = { supported: false };
      await uiDom.btnLlmEl.onclick();
      expect(mockContext.speechEngine.spokenDisplayText).toContain('這個裝置不支援 WebGPU');

      // 4. WebLLM already ready
      mockContext.brainEngine.llm = { supported: true, state: STATE_MAP.READY };
      await uiDom.btnLlmEl.onclick();
      expect(mockContext.speechEngine.spokenDisplayText).toContain('AI 大腦已啟用');

      // 5. WebLLM loading
      mockContext.brainEngine.llm = { supported: true, state: STATE_MAP.LOADING, progress: 0.45 };
      await uiDom.btnLlmEl.onclick();
      expect(mockContext.speechEngine.spokenDisplayText).toContain('45%');

      // 6. WebLLM unloaded -> trigger load
      mockContext.brainEngine.llm = { supported: true, state: STATE_MAP.UNLOADED, load: vi.fn() };
      await uiDom.btnLlmEl.onclick();
      expect(mockContext.brainEngine.llm.load).toHaveBeenCalled();
    });

    it('should handle missing questionInputEl gracefully', () => {
      expect(() => bindTyping(null)).not.toThrow();
      expect(() => bindTyping({ uiDom: { questionInputEl: null } })).not.toThrow();
    });
  });
});
