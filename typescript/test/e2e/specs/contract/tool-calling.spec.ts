import { test, expect } from '@playwright/test';

test.describe('Contract Track A: Tool Calling & Confirmation Flow Specifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/e2e/harness/contract.html');
    await page.waitForFunction(() => (window as any).__harnessReady === true);
  });

  test('should display confirmation buttons when a tool requires confirmation', async ({
    page
  }) => {
    // 註冊一個需要使用者確認的工具
    await page.evaluate(() => {
      const widget = (window as any).aiAvatarWidget;
      (window as any).__toolCallExecuted = false;

      const tool = {
        name: 'test_action',
        label: '測試功能',
        description: '測試用的功能',
        requiresConfirmation: true,
        inputSchema: { type: 'object', properties: {} }
      };
      widget.toolsEngine.HOST_TOOLS.push(tool);

      // 觸發工具調用
      widget.toolsEngine.offerHostTool(tool, '測試');
    });

    // 驗證歷史紀錄面板自動展開
    const historyPanel = page.locator('#history-panel');
    await expect(historyPanel).toHaveAttribute('css-is-open', 'true');

    // 驗證出現「確認」與「取消」按鈕
    const confirmBtn = page.locator(
      '#history-list .history-confirm button.confirm'
    );
    const cancelBtn = page.locator(
      '#history-list .history-confirm button.cancel'
    );

    await expect(confirmBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    // 點擊「取消」
    await cancelBtn.click();

    // 驗證取消後紀錄更新為取消訊息且確認按鈕消失
    const lastMsg = page
      .locator('#history-list .history-item.assistant')
      .last();
    await expect(lastMsg).toContainText('好的，已取消。');
    await expect(confirmBtn).not.toBeVisible();
  });

  test('should execute tool and handle result when user clicks confirm button', async ({
    page
  }) => {
    // 註冊工具並監聽 onToolCall
    await page.evaluate(() => {
      const widget = (window as any).aiAvatarWidget;
      (window as any).__executedCallId = null;

      widget.options.onToolCall = (pendingCall: any) => {
        (window as any).__executedCallId = pendingCall.callId;
        // 回傳執行成功
        widget.toolsEngine.handleToolResult({
          callId: pendingCall.callId,
          ok: true,
          message: '工具執行成功！'
        });
      };

      const tool = {
        name: 'trigger_smile',
        label: '擺出笑臉',
        description: '讓虛擬人笑一個',
        requiresConfirmation: true,
        inputSchema: { type: 'object', properties: {} }
      };
      widget.toolsEngine.HOST_TOOLS.push(tool);

      widget.toolsEngine.offerHostTool(tool, '笑一個');
    });

    // 點擊「確認執行」按鈕
    const confirmBtn = page.locator(
      '#history-list .history-confirm button.confirm'
    );
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 驗證 onToolCall 回呼被觸發
    const callId = await page.evaluate(() => (window as any).__executedCallId);
    expect(callId).not.toBeNull();

    // 驗證結果訊息呈現在歷史紀錄中
    const resultMsg = page
      .locator('#history-list .history-item.assistant')
      .last();
    await expect(resultMsg).toContainText('工具執行成功！');
  });
});
