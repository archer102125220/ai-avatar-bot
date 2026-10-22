import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setHistoryOpen, renderHistory } from '@/core/ui/history';
import { initUi } from '@/core/ui/dom';
import { initI18nEngine } from '@/core/i18n';
import type { I18nEngine } from '@core';
import type { UiContext, UiDom } from '@/core/ui/types';

interface MockUiContext {
  uiDom: UiDom;
  i18nEngine: I18nEngine;
  speechEngine: {
    isListening: boolean;
    convoOn: boolean;
    spokenDisplayText: string;
    speak: ReturnType<typeof vi.fn>;
  };
  brainEngine: {
    chatLog: Array<{
      id: string;
      role: 'user' | 'assistant';
      text: string;
      streaming?: boolean;
      pendingTool?: { name: string };
      timedOut?: boolean;
      cancelled?: boolean;
      pendingChoices?: Array<{ tool: { name: string; label: string } }>;
      reasoning?: string;
      reasoningTimeMs?: number;
      reasoningStreaming?: boolean;
    }>;
  };
  toolsEngine: {
    executePendingTool: ReturnType<typeof vi.fn>;
    cancelPendingTool: ReturnType<typeof vi.fn>;
    chooseTool: ReturnType<typeof vi.fn>;
  };
}

describe('UI Chat History (setHistoryOpen & renderHistory)', () => {
  let container: HTMLElement;
  let stageEl: HTMLElement;
  let i18nEngine: I18nEngine;
  let uiDom: UiDom;
  let mockContext: MockUiContext;
  const getContext = () => mockContext as unknown as UiContext;

  beforeEach(() => {
    container = document.createElement('div');
    stageEl = document.createElement('div');
    i18nEngine = initI18nEngine({ locale: 'zh-TW' });
    uiDom = initUi(container, stageEl, i18nEngine)!;

    mockContext = {
      uiDom,
      i18nEngine,
      speechEngine: {
        isListening: false,
        convoOn: false,
        spokenDisplayText: '',
        speak: vi.fn()
      },
      brainEngine: {
        chatLog: []
      },
      toolsEngine: {
        executePendingTool: vi.fn(),
        cancelPendingTool: vi.fn(),
        chooseTool: vi.fn()
      }
    };
  });

  describe('setHistoryOpen', () => {
    it('should toggle history panel open/closed attributes and accessibility states', () => {
      setHistoryOpen(getContext(), true);

      expect(uiDom.historyPanelEl.getAttribute('css-is-open')).toBe('true');
      expect(uiDom.historyPanelEl.inert).toBe(false);
      expect(uiDom.historyButtonEl.getAttribute('aria-expanded')).toBe('true');
      expect(uiDom.suggestionsEl.style.display).toBe('none');
      expect(uiDom.bubbleEl.style.opacity).toBe('0');

      setHistoryOpen(getContext(), false);

      expect(uiDom.historyPanelEl.getAttribute('css-is-open')).toBeNull();
      expect(uiDom.historyPanelEl.inert).toBe(true);
      expect(uiDom.historyButtonEl.getAttribute('aria-expanded')).toBe('false');
      expect(uiDom.suggestionsEl.style.display).toBe('flex');
      expect(uiDom.bubbleEl.style.opacity).toBe('');
    });
  });

  describe('renderHistory', () => {
    it('should render empty history notice when chatLog is empty', () => {
      mockContext.brainEngine.chatLog = [];
      renderHistory(getContext());

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      expect(historyListEl.children.length).toBe(1);
      expect(historyListEl.querySelector('.history-empty')).toBeDefined();
    });

    it('should render user and assistant chat messages with streaming indicators', () => {
      mockContext.brainEngine.chatLog = [
        { id: '1', role: 'user', text: '你好！' },
        { id: '2', role: 'assistant', text: '你好，很高興為你服務。' },
        { id: '3', role: 'assistant', text: '', streaming: true }
      ];

      renderHistory(getContext());

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      expect(historyListEl.children.length).toBe(3);

      const userRow = historyListEl.children[0]!;
      expect(userRow.className).toContain('history-item user');
      expect(userRow.querySelector('.history-message')?.textContent).toBe(
        '你好！'
      );

      const assistantRow = historyListEl.children[1]!;
      expect(assistantRow.className).toContain('history-item assistant');
      expect(assistantRow.querySelector('.history-message')?.textContent).toBe(
        '你好，很高興為你服務。'
      );

      const streamingRow = historyListEl.children[2]!;
      expect(streamingRow.querySelector('.history-message')?.textContent).toBe(
        '…'
      );
    });

    it('should render tool confirmation buttons and dispatch confirm/cancel actions', () => {
      mockContext.brainEngine.chatLog = [
        {
          id: 'tool_call_1',
          role: 'assistant',
          text: '準備執行工具...',
          pendingTool: { name: 'calculator' }
        }
      ];

      renderHistory(getContext());

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      const confirmContainer = historyListEl.querySelector('.history-confirm')!;
      expect(confirmContainer).toBeDefined();

      const confirmBtn = confirmContainer.querySelector(
        'button.confirm'
      ) as HTMLButtonElement;
      const cancelBtn = confirmContainer.querySelector(
        'button.cancel'
      ) as HTMLButtonElement;

      confirmBtn.click();
      expect(mockContext.toolsEngine.executePendingTool).toHaveBeenCalledWith(
        'tool_call_1'
      );

      cancelBtn.click();
      expect(mockContext.toolsEngine.cancelPendingTool).toHaveBeenCalledWith(
        'tool_call_1'
      );
    });

    it('should render disabled state when tool call has timed out or cancelled', () => {
      // 1. Timed out
      mockContext.brainEngine.chatLog = [
        {
          id: 'tool_call_2',
          role: 'assistant',
          text: '逾時工具',
          pendingTool: { name: 'test' },
          timedOut: true
        },
        {
          id: 'tool_call_3',
          role: 'assistant',
          text: '取消工具',
          pendingTool: { name: 'test' },
          cancelled: true
        }
      ];

      renderHistory(getContext());

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      const confirmBtn = historyListEl.querySelectorAll(
        'button.confirm'
      )[0] as HTMLButtonElement;
      expect(confirmBtn.disabled).toBe(true);
      expect(confirmBtn.textContent).toBe('已逾時');

      const cancelBtn = historyListEl.querySelectorAll(
        'button.cancel'
      )[1] as HTMLButtonElement;
      expect(cancelBtn.disabled).toBe(true);
      expect(cancelBtn.textContent).toBe('已取消');
    });

    it('should render tool choices buttons and dispatch chooseTool on click', () => {
      mockContext.brainEngine.chatLog = [
        {
          id: 'tool_choice_1',
          role: 'assistant',
          text: '請選擇工具',
          pendingChoices: [
            { tool: { name: 'opt_a', label: '選項 A' } },
            { tool: { name: 'opt_b', label: '選項 B' } }
          ]
        }
      ];

      renderHistory(getContext());

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      const choiceBtns = historyListEl.querySelectorAll(
        '.history-confirm button'
      );
      expect(choiceBtns.length).toBe(2);

      (choiceBtns[1] as HTMLElement).click();
      expect(mockContext.toolsEngine.chooseTool).toHaveBeenCalledWith(
        'tool_choice_1',
        1
      );
    });

    it('should render copy and replay buttons for completed assistant messages', async () => {
      // Mock navigator.clipboard
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(true)
        }
      });

      mockContext.brainEngine.chatLog = [
        { id: '1', role: 'assistant', text: '可重播與複製的文字' }
      ];

      renderHistory(getContext());

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      const copyBtn = historyListEl.querySelector(
        '.history-tools button:first-child'
      ) as HTMLElement;
      const replayBtn = historyListEl.querySelector(
        '.history-tools button:last-child'
      ) as HTMLElement;

      expect(copyBtn.textContent).toBe('複製');
      expect(replayBtn.textContent).toBe('重播');

      copyBtn.click();
      await Promise.resolve();
      expect(mockContext.speechEngine.spokenDisplayText).toBe('已複製回答');

      replayBtn.click();
      expect(mockContext.speechEngine.speak).toHaveBeenCalledWith(
        '可重播與複製的文字'
      );
    });

    it('should return early when historyListEl is missing or not HTMLElement', () => {
      const invalidContext = {
        ...mockContext,
        uiDom: {
          ...uiDom,
          historyPanelEl: document.createElement('div')
        }
      } as unknown as UiContext;
      expect(() => renderHistory(invalidContext)).not.toThrow();
    });

    it('should render collapsible thought block with duration when assistant message has reasoning', () => {
      mockContext.brainEngine.chatLog = [
        {
          id: 'msg-reasoning-1',
          role: 'assistant',
          text: '這是回答正文。',
          reasoning: '這是詳細的內心思考與推理推論過程。',
          reasoningTimeMs: 1540
        }
      ];

      renderHistory(getContext());

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      const row = historyListEl.children[0] as HTMLElement;
      expect(row.className).toContain('history-item assistant');

      const thoughtDetails = row.querySelector(
        'details.history-item__thought'
      ) as HTMLDetailsElement;
      expect(thoughtDetails).toBeDefined();

      const summaryEl = thoughtDetails.querySelector(
        'summary.history-item__thought-summary'
      );
      expect(summaryEl?.textContent).toBe('🤔 思考過程 (1.5秒)');

      const contentEl = thoughtDetails.querySelector(
        'div.history-item__thought-content'
      );
      expect(contentEl?.textContent).toBe('這是詳細的內心思考與推理推論過程。');

      const messageEl = row.querySelector('.history-message');
      expect(messageEl?.textContent).toBe('這是回答正文。');
    });

    it('should render thought block without duration when reasoningTimeMs is absent or 0', () => {
      mockContext.brainEngine.chatLog = [
        {
          id: 'msg-reasoning-2',
          role: 'assistant',
          text: '回答。',
          reasoning: '純思考。'
        }
      ];

      renderHistory(getContext());

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      const row = historyListEl.children[0] as HTMLElement;

      const summaryEl = row.querySelector(
        'summary.history-item__thought-summary'
      );
      expect(summaryEl?.textContent).toBe('🤔 思考過程');
    });

    it('should render thinking indicator when reasoning is still streaming without content', () => {
      mockContext.brainEngine.chatLog = [
        {
          id: 'msg-reasoning-streaming',
          role: 'assistant',
          text: '',
          streaming: true,
          reasoningStreaming: true
        }
      ];

      renderHistory(getContext());

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      const row = historyListEl.children[0] as HTMLElement;

      const summaryEl = row.querySelector(
        'summary.history-item__thought-summary'
      );
      expect(summaryEl?.textContent).toBe('🤔 思考中…');

      const contentEl = row.querySelector(
        'div.history-item__thought-content'
      );
      expect(contentEl?.textContent).toBe('…');
    });

    it('should not render thought block for user messages or assistant messages without reasoning', () => {
      mockContext.brainEngine.chatLog = [
        {
          id: 'user-1',
          role: 'user',
          text: '使用者問題',
          reasoning: '不應渲染的使用者思考'
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          text: '普通回答，無思考'
        }
      ];

      renderHistory(getContext());

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      expect(historyListEl.querySelectorAll('details.history-item__thought').length).toBe(0);
    });

    it('should support english localization for thought process and seconds unit', () => {
      const enI18n = initI18nEngine({ locale: 'en-US' });
      const enContext = {
        ...mockContext,
        i18nEngine: enI18n,
        brainEngine: {
          chatLog: [
            {
              id: 'msg-en',
              role: 'assistant',
              text: 'Hello world.',
              reasoning: 'Step by step thinking.',
              reasoningTimeMs: 2300
            }
          ]
        }
      } as unknown as UiContext;

      renderHistory(enContext);

      const historyListEl =
        uiDom.historyPanelEl.querySelector('#history-list')!;
      const summaryEl = historyListEl.querySelector(
        'summary.history-item__thought-summary'
      );
      expect(summaryEl?.textContent).toBe('🤔 Thought Process (2.3s)');
    });
  });
});
