import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initAvatarBot } from '@/core';
import { ENGINE_MODE_MAP } from '@/core/constants';
import type { AiAvatarWidget } from '@/core/orchestrator';
import type { SkinEngine } from '@/core/skin';

describe('Orchestrator End-to-End Integration Unit Tests (E2E Pipeline)', () => {
  let container: HTMLDivElement;
  let widget: AiAvatarWidget | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'avatar-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (
      typeof widget === 'object' &&
      widget !== null
    ) {
      const skin = widget.skinEngine as unknown as { dispose?: () => void };
      if (typeof skin?.dispose === 'function') {
        skin.dispose();
      }
      widget = null;
    }
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  function createCustomSkinEngine() {
    return (options: unknown): SkinEngine => {
      const { stageEl, aiAvatarWidget } = (options || {}) as {
        stageEl?: HTMLElement;
        aiAvatarWidget?: AiAvatarWidget;
      };

      const resolvedStage = stageEl instanceof HTMLElement ? stageEl : document.createElement('div');
      const canvas = document.createElement('canvas');
      canvas.id = 'mock-canvas';
      resolvedStage.appendChild(canvas);

      setTimeout(() => {
        if (typeof aiAvatarWidget?.onReady === 'function') {
          aiAvatarWidget.onReady(aiAvatarWidget);
        }
      }, 10);

      return {
        stageEl: resolvedStage,
        has2D: true,
        has3D: false,
        setGender: vi.fn(),
        loadVRMFile: vi.fn(),
        fit: vi.fn(),
        updateTransform: vi.fn(),
        setIsSpeaking: vi.fn(),
        dispose: vi.fn(() => {
          canvas.remove();
        })
      } as unknown as SkinEngine;
    };
  }

  it('should mount all core UI DOM nodes, initialize state and trigger onReady', async () => {
    const onReadySpy = vi.fn();

    const initializedWidget = (await initAvatarBot({
      container,
      startMode: ENGINE_MODE_MAP.twoDimensional,
      onReady: onReadySpy,
      customEngines: {
        skin: createCustomSkinEngine()
      }
    })) as AiAvatarWidget;

    widget = initializedWidget;

    // 等待 onReady 回呼
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(onReadySpy).toHaveBeenCalledTimes(1);
    expect(onReadySpy).toHaveBeenCalledWith(initializedWidget);

    // 驗證核心節點已掛載至 container
    expect(container.querySelector('#stage')).not.toBeNull();
    expect(container.querySelector('#control-bar')).not.toBeNull();
    expect(container.querySelector('#bubble')).not.toBeNull();
    expect(container.querySelector('#type-input')).not.toBeNull();
    expect(container.querySelector('#btn-send')).not.toBeNull();
    expect(container.querySelector('#btn-mic')).not.toBeNull();
    expect(container.querySelector('#btn-mute')).not.toBeNull();
    expect(container.querySelector('#btn-history')).not.toBeNull();
    expect(container.querySelector('.aw-minimal')).not.toBeNull();

    // 驗證 widget 介面屬性與引擎關聯
    expect(initializedWidget.container).toBe(container);
    expect(initializedWidget.isMinimal).toBe(false);
    expect(typeof initializedWidget.handleUser).toBe('function');
  });

  it('should process user chat input end-to-end, update bubble and append to history log', async () => {
    widget = (await initAvatarBot({
      container,
      customEngines: {
        skin: createCustomSkinEngine()
      }
    })) as AiAvatarWidget;

    const input = container.querySelector('#type-input') as HTMLInputElement;
    const sendBtn = container.querySelector('#btn-send') as HTMLButtonElement;
    const bubble = container.querySelector('#bubble') as HTMLElement;

    // 模擬使用者輸入內建知識庫問題「這是什麼？」並點擊送出
    input.value = '這是什麼？';
    sendBtn.click();

    // 輸入框送出後清空
    expect(input.value).toBe('');

    // 等待知識庫檢索與對話生成
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 驗證氣泡內容已更新
    expect(bubble.textContent?.trim()).not.toBe('');

    // 驗證歷史紀錄中存在使用者與助理訊息
    const historyBtn = container.querySelector('#btn-history') as HTMLButtonElement;
    historyBtn.click();

    const historyPanel = container.querySelector('#history-panel') as HTMLElement;
    expect(historyPanel.getAttribute('css-is-open')).toBe('true');

    const userMessage = container.querySelector('#history-list .history-item.user');
    expect(userMessage?.textContent).toContain('這是什麼？');

    const botMessage = container.querySelector('#history-list .history-item.assistant');
    expect(botMessage).not.toBeNull();
    expect(botMessage?.textContent?.trim()).not.toBe('');
  });

  it('should toggle minimal mode smoothly via close button and minimal badge', async () => {
    const onMinimalTriggerSpy = vi.fn();

    widget = (await initAvatarBot({
      container,
      onMinimalTrigger: onMinimalTriggerSpy,
      customEngines: {
        skin: createCustomSkinEngine()
      }
    })) as AiAvatarWidget;

    const closeBtn = container.querySelector('#btn-close') as HTMLButtonElement;
    const minimalBadge = container.querySelector('.aw-minimal') as HTMLElement;

    // 1. 點擊右上角收合按鈕
    closeBtn.click();
    expect(widget.isMinimal).toBe(true);
    expect(minimalBadge.style.display).toBe('flex');
    expect(onMinimalTriggerSpy).toHaveBeenCalledWith(true, widget);

    // 2. 點擊懸浮球還原展開
    minimalBadge.click();
    expect(widget.isMinimal).toBe(false);
    expect(minimalBadge.style.display).toBe('none');
    expect(onMinimalTriggerSpy).toHaveBeenCalledWith(false, widget);
  });

  it('should toggle mute state and cycle playback speeds via toolbar buttons', async () => {
    widget = (await initAvatarBot({
      container,
      customEngines: {
        skin: createCustomSkinEngine()
      }
    })) as AiAvatarWidget;

    const muteBtn = container.querySelector('#btn-mute') as HTMLButtonElement;
    const speedBtn = container.querySelector('#btn-speed') as HTMLButtonElement;

    // 初始靜音狀態
    expect(muteBtn.getAttribute('aria-pressed')).toBe('false');

    // 點擊靜音
    muteBtn.click();
    expect(muteBtn.getAttribute('aria-pressed')).toBe('true');

    // 再次點擊解除靜音
    muteBtn.click();
    expect(muteBtn.getAttribute('aria-pressed')).toBe('false');

    // 速度循環 [1.0x -> 1.2x -> 1.4x -> 0.9x -> 1.0x]
    expect(speedBtn.textContent).toContain('1.0×');
    speedBtn.click();
    expect(speedBtn.textContent).toContain('1.2×');
    speedBtn.click();
    expect(speedBtn.textContent).toContain('1.4×');
  });

  it('should handle tool calling with user confirmation workflow end-to-end', async () => {
    let executedCallId: string | null = null;

    widget = (await initAvatarBot({
      container,
      onToolCall: (pendingCall: unknown) => {
        const callObj = pendingCall as { callId?: string };
        if (typeof callObj?.callId === 'string') {
          executedCallId = callObj.callId;
          widget?.toolsEngine?.handleToolResult({
            callId: callObj.callId,
            ok: true,
            message: '工具執行成功！'
          });
        }
      },
      customEngines: {
        skin: createCustomSkinEngine()
      }
    })) as AiAvatarWidget;

    const tool = {
      name: 'take_screenshot',
      label: '畫面截圖',
      description: '截取當前畫面',
      requiresConfirmation: true,
      inputSchema: { type: 'object', properties: {} }
    };

    widget.toolsEngine?.HOST_TOOLS.push(tool);
    widget.toolsEngine?.offerHostTool(tool, '請幫我截圖');

    // 驗證歷史抽屜打開
    const historyPanel = container.querySelector('#history-panel') as HTMLElement;
    expect(historyPanel.getAttribute('css-is-open')).toBe('true');

    // 驗證確認按鈕出現
    const confirmBtn = container.querySelector(
      '#history-list .history-confirm button.confirm'
    ) as HTMLButtonElement;
    expect(confirmBtn).not.toBeNull();

    // 點擊確認執行
    confirmBtn.click();

    expect(executedCallId).not.toBeNull();

    // 驗證歷史紀錄呈現執行成功訊息
    const lastMsg = container.querySelector('#history-list .history-item.assistant:last-child');
    expect(lastMsg?.textContent).toContain('工具執行成功！');
  });

  it('should dispose resources cleanly and unmount when skin dispose is called', async () => {
    widget = (await initAvatarBot({
      container,
      customEngines: {
        skin: createCustomSkinEngine()
      }
    })) as AiAvatarWidget;

    expect(container.children.length).toBeGreaterThan(0);

    const skin = widget.skinEngine as unknown as { dispose?: () => void };
    expect(typeof skin?.dispose).toBe('function');
    skin?.dispose?.();
  });
});
