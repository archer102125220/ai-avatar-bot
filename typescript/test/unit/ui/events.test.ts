import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bindTyping, bindUiEvent } from '@/core/ui/events';
import { initUi } from '@/core/ui/dom';
import { initI18nEngine } from '@/core/i18n';
import { STATE_MAP } from '@/core/constants';
import type { I18nEngine } from '@core';
import type { UiContext, UiDom } from '@/core/ui/types';

interface MockSpeechEngine {
  convoOn: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  ttsMuted: boolean;
  ttsRate: number;
  spokenDisplayText: string;
  startListening: ReturnType<typeof vi.fn>;
  stopVoiceSession: ReturnType<typeof vi.fn>;
  stopSpeaking: ReturnType<typeof vi.fn>;
  interruptForVoice: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
}

interface MockBrainEngine {
  chatLog: Array<{ role: string; text: string }>;
  memory?: { clear: ReturnType<typeof vi.fn>; [key: string]: unknown };
  aiProvider?: {
    enabled: boolean;
    ready?: boolean;
    model?: string;
    ping?: ReturnType<typeof vi.fn>;
    [key: string]: unknown;
  };
  llm?: {
    supported: boolean;
    state?: string;
    progress?: number;
    load?: ReturnType<typeof vi.fn>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface MockUiContext {
  uiDom: UiDom;
  i18nEngine: I18nEngine | null;
  isMinimal: boolean;
  isIframe: boolean;
  avatarMode: string;
  locale?: string;
  STATE_MAP: typeof STATE_MAP;
  handleUser: ReturnType<typeof vi.fn>;
  onMinimalTrigger: ReturnType<typeof vi.fn>;
  speechEngine: MockSpeechEngine;
  brainEngine: MockBrainEngine;
  [key: string]: unknown;
}

describe('UI Events Binding', () => {
  let container: HTMLElement;
  let stageEl: HTMLElement;
  let i18nEngine: I18nEngine;
  let uiDom: UiDom;
  let mockContext: MockUiContext;
  const getContext = (ctx: MockUiContext = mockContext) =>
    ctx as unknown as UiContext;

  beforeEach(() => {
    container = document.createElement('div');
    stageEl = document.createElement('div');
    i18nEngine = initI18nEngine({ locale: 'zh-TW' });
    uiDom = initUi(container, stageEl, i18nEngine)!;

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
        llm: { supported: true, state: STATE_MAP.IDLE, load: vi.fn() }
      }
    };
  });

  describe('bindTyping', () => {
    it('should send user text when clicking send button or pressing Enter', () => {
      bindTyping(getContext());

      uiDom.questionInputEl.value = '什麼是 AI 虛擬人？';
      uiDom.sendButtonEl.click();

      expect(mockContext.handleUser).toHaveBeenCalledWith('什麼是 AI 虛擬人？');
      expect(uiDom.questionInputEl.value).toBe('');

      // Test Enter keydown
      uiDom.questionInputEl.value = '測試 Enter 送出';
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      uiDom.questionInputEl.dispatchEvent(enterEvent);

      expect(mockContext.handleUser).toHaveBeenCalledWith('測試 Enter 送出');
      expect(uiDom.questionInputEl.value).toBe('');
    });

    it('should ignore empty text or IME composition Enter key', () => {
      bindTyping(getContext());

      uiDom.questionInputEl.value = '   ';
      uiDom.sendButtonEl.click();
      expect(mockContext.handleUser).not.toHaveBeenCalled();

      // IME composition Enter (keyCode 229)
      uiDom.questionInputEl.value = '輸入中';
      const imeEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      } as KeyboardEventInit & { keyCode: number });
      Object.defineProperty(imeEvent, 'keyCode', { value: 229 });
      uiDom.questionInputEl.dispatchEvent(imeEvent);
      expect(mockContext.handleUser).not.toHaveBeenCalled();
    });
  });

  describe('bindUiEvent', () => {
    it('should toggle minimal mode on minimalEl and closeButtonEl click', () => {
      bindUiEvent(getContext());

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
      expect(mockContext.onMinimalTrigger).toHaveBeenCalledWith(
        true,
        mockContext
      );
    });

    it('should handle mic button click in standard and companion modes', () => {
      bindUiEvent(getContext());

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
      bindUiEvent(getContext());

      uiDom.muteButtonEl.click();
      expect(mockContext.speechEngine.ttsMuted).toBe(true);
      expect(uiDom.muteButtonEl.textContent).toBe('🔇');
      expect(mockContext.speechEngine.stopSpeaking).toHaveBeenCalled();

      uiDom.muteButtonEl.click();
      expect(mockContext.speechEngine.ttsMuted).toBe(false);
      expect(uiDom.muteButtonEl.textContent).toBe('🔊');
    });

    it('should cycle speech rate on speedButtonEl click', () => {
      bindUiEvent(getContext());

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
      bindUiEvent(getContext());

      uiDom.langButtonEl.click();
      expect(i18nEngine.locale).toBe('en-US');

      uiDom.langButtonEl.click();
      expect(i18nEngine.locale).toBe('ja-JP');
    });

    it('should toggle history panel and clear chat logs on history actions', () => {
      bindUiEvent(getContext());

      // Open history
      uiDom.historyButtonEl.click();
      expect(uiDom.historyPanelEl.getAttribute('css-is-open')).toBe('true');

      // Close history via panel close button
      const closeBtn = uiDom.historyPanelEl.querySelector(
        '#btn-history-close'
      ) as HTMLElement;
      closeBtn.click();
      expect(uiDom.historyPanelEl.getAttribute('css-is-open')).toBeNull();

      // Clear history
      const clearBtn = uiDom.historyPanelEl.querySelector(
        '#btn-history-clear'
      ) as HTMLElement;
      clearBtn.click();
      expect(mockContext.brainEngine.memory?.clear).toHaveBeenCalled();
      expect(mockContext.brainEngine.chatLog.length).toBe(0);
    });

    it('should handle companion mode stop voice session and standard mode active stop', () => {
      bindUiEvent(getContext());

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
      const customContext: MockUiContext = {
        ...mockContext,
        i18nEngine: null,
        locale: 'zh-TW'
      };
      bindUiEvent(getContext(customContext));

      // zh-TW -> en-US
      uiDom.langButtonEl.click();
      expect(customContext.locale).toBe('en-US');
      expect(customContext.speechEngine.spokenDisplayText).toBe(
        'Language: English'
      );

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
      expect(customContext.speechEngine.spokenDisplayText).toBe(
        '語言：繁體中文'
      );
    });

    it('should handle AI provider and WebLLM readiness states on btnLlmEl click', async () => {
      bindUiEvent(getContext());

      // 1. AI Provider enabled and ready
      mockContext.brainEngine.aiProvider = {
        enabled: true,
        ready: true,
        model: 'llama3:latest',
        ping: vi.fn().mockResolvedValue(true)
      };
      const pointerEvent = new PointerEvent('click');
      await uiDom.btnLlmEl.onclick?.(pointerEvent);
      expect(uiDom.btnLlmEl.textContent).toBe('🧠✓');
      expect(uiDom.btnLlmEl.getAttribute('css-llm-on')).toBe('true');
      expect(mockContext.speechEngine.spokenDisplayText).toContain(
        'AI 伺服器大腦運作中'
      );

      // 2. AI Provider enabled but not ready
      mockContext.brainEngine.aiProvider.ready = false;
      mockContext.brainEngine.aiProvider.ping = vi
        .fn()
        .mockResolvedValue(false);
      await uiDom.btnLlmEl.onclick?.(pointerEvent);
      expect(uiDom.btnLlmEl.textContent).toBe('🧠✗');
      expect(uiDom.btnLlmEl.getAttribute('css-llm-on')).toBeNull();
      expect(mockContext.speechEngine.spokenDisplayText).toContain(
        'AI 伺服器連不上'
      );

      // 3. WebLLM not supported
      mockContext.brainEngine.aiProvider = { enabled: false };
      mockContext.brainEngine.llm = { supported: false };
      await uiDom.btnLlmEl.onclick?.(pointerEvent);
      expect(mockContext.speechEngine.spokenDisplayText).toContain(
        '這個裝置不支援 WebGPU'
      );

      // 4. WebLLM already ready
      mockContext.brainEngine.llm = { supported: true, state: STATE_MAP.READY };
      await uiDom.btnLlmEl.onclick?.(pointerEvent);
      expect(mockContext.speechEngine.spokenDisplayText).toContain(
        'AI 大腦已啟用'
      );

      // 5. WebLLM loading
      mockContext.brainEngine.llm = {
        supported: true,
        state: STATE_MAP.LOADING,
        progress: 0.45
      };
      await uiDom.btnLlmEl.onclick?.(pointerEvent);
      expect(mockContext.speechEngine.spokenDisplayText).toContain('45%');

      // 6. WebLLM unloaded -> trigger load
      const loadMock = vi.fn();
      mockContext.brainEngine.llm = {
        supported: true,
        state: STATE_MAP.IDLE,
        load: loadMock
      };
      await uiDom.btnLlmEl.onclick?.(pointerEvent);
      expect(loadMock).toHaveBeenCalled();
    });

    it('should handle missing questionInputEl gracefully', () => {
      expect(() => bindTyping(null as unknown as UiContext)).not.toThrow();
      expect(() =>
        bindTyping({ uiDom: { questionInputEl: null } } as unknown as UiContext)
      ).not.toThrow();
    });

    it('should handle history button open, close, and clear in bindUiEvent', () => {
      bindUiEvent(getContext());

      // 1. Open history panel
      uiDom.historyButtonEl.click();
      expect(uiDom.historyPanelEl.getAttribute('css-is-open')).toBe('true');

      // 2. Close history panel with close button
      const btnHistoryClose = uiDom.historyPanelEl.querySelector(
        '#btn-history-close'
      ) as HTMLElement;
      if (btnHistoryClose) {
        btnHistoryClose.click();
        expect(uiDom.historyPanelEl.getAttribute('css-is-open')).toBeNull();
      }

      // 3. Clear history button
      const btnHistoryClear = uiDom.historyPanelEl.querySelector(
        '#btn-history-clear'
      ) as HTMLElement;
      if (btnHistoryClear) {
        btnHistoryClear.click();
        expect(mockContext.brainEngine.memory?.clear).toHaveBeenCalled();
        expect(mockContext.brainEngine.chatLog.length).toBe(0);
        expect(mockContext.speechEngine.spokenDisplayText).toContain('清除');
      }
    });

    it('should test speed cycling, mute toggle without i18nEngine, and non-enter keydowns', () => {
      const customContext: MockUiContext = {
        ...mockContext,
        i18nEngine: null,
        speechEngine: {
          convoOn: false,
          isListening: false,
          isProcessing: false,
          isSpeaking: false,
          ttsRate: 0.9,
          ttsMuted: false,
          spokenDisplayText: '',
          startListening: vi.fn(),
          stopVoiceSession: vi.fn(),
          stopSpeaking: vi.fn(),
          interruptForVoice: vi.fn()
        }
      };

      bindUiEvent(getContext(customContext));
      bindTyping(getContext(customContext));

      // 1. Speed button cycling: 0.9 -> 1.0 -> 1.2 -> 1.4 -> 0.9
      uiDom.speedButtonEl.click();
      expect(customContext.speechEngine.ttsRate).toBe(1.0);
      expect(customContext.speechEngine.spokenDisplayText).toBe('語速：1.0×');

      uiDom.speedButtonEl.click();
      expect(customContext.speechEngine.ttsRate).toBe(1.2);
      expect(customContext.speechEngine.spokenDisplayText).toBe('語速：1.2×');

      uiDom.speedButtonEl.click();
      expect(customContext.speechEngine.ttsRate).toBe(1.4);
      expect(customContext.speechEngine.spokenDisplayText).toBe('語速：1.4×');

      uiDom.speedButtonEl.click();
      expect(customContext.speechEngine.ttsRate).toBe(0.9);
      expect(customContext.speechEngine.spokenDisplayText).toBe('語速：0.9×');

      // 2. Mute button without i18nEngine
      uiDom.muteButtonEl.click();
      expect(customContext.speechEngine.ttsMuted).toBe(true);
      expect(customContext.speechEngine.spokenDisplayText).toBe('已靜音');
      expect(customContext.speechEngine.stopSpeaking).toHaveBeenCalled();

      uiDom.muteButtonEl.click();
      expect(customContext.speechEngine.ttsMuted).toBe(false);
      expect(customContext.speechEngine.spokenDisplayText).toBe('已開啟語音');

      // 3. Non-Enter keydown on input
      uiDom.questionInputEl.value = '測試按鍵';
      const aEvent = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      uiDom.questionInputEl.dispatchEvent(aEvent);
      expect(customContext.handleUser).not.toHaveBeenCalled();

      // 4. Enter with isComposing = true
      const composingEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      Object.defineProperty(composingEvent, 'isComposing', { value: true });
      uiDom.questionInputEl.dispatchEvent(composingEvent);
      expect(customContext.handleUser).not.toHaveBeenCalled();
    });

    it('should handle defensive guards in bindUiEvent when context or sub-engines are null', () => {
      // 1. context is null (line 50)
      expect(() => bindUiEvent(null as unknown as UiContext)).not.toThrow();

      // 2. context with null speechEngine and null brainEngine (lines 77, 120, 148, 242)
      const contextWithoutEngines = {
        uiDom,
        speechEngine: null,
        brainEngine: null
      } as unknown as UiContext;

      bindUiEvent(contextWithoutEngines);

      // Mic button with null speechEngine
      expect(() => uiDom.micButtonEl.click()).not.toThrow();

      // Mute button with null speechEngine
      expect(() => uiDom.muteButtonEl.click()).not.toThrow();

      // Speed button with null speechEngine
      expect(() => uiDom.speedButtonEl.click()).not.toThrow();

      // LLM button with null brainEngine
      expect(() => uiDom.btnLlmEl.click()).not.toThrow();
    });
  });
});
