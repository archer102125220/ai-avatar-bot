import { test, expect } from '@playwright/test';

test.describe('Contract Track A: Chat Flow & Text Input Specifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/e2e/harness/contract.html');
    await page.waitForFunction(() => (window as any).__harnessReady === true);
  });

  test('should submit message on click send button and clear input', async ({
    page
  }) => {
    const input = page.locator('#type-input');
    const sendBtn = page.locator('#btn-send');

    await input.fill('你好，我是測試使用者');
    await sendBtn.click();

    // 驗證輸入框已被清空
    await expect(input).toHaveValue('');

    // 等待對話氣泡更新
    const bubble = page.locator('#bubble');
    await expect(bubble).toBeVisible();

    // 檢查聊天紀錄面板中是否記錄了使用者與機器人訊息
    const historyBtn = page.locator('#btn-history');
    await historyBtn.click();

    const historyPanel = page.locator('#history-panel');
    await expect(historyPanel).toHaveAttribute('css-is-open', 'true');

    const userMessage = page
      .locator('#history-list .history-item.user')
      .first();
    await expect(userMessage).toContainText('你好，我是測試使用者');

    const botMessage = page
      .locator('#history-list .history-item.assistant')
      .first();
    await expect(botMessage).toBeVisible();
    await expect(botMessage).toContainText('你好，我是測試使用者');
  });

  test('should submit message when pressing Enter key in input box', async ({
    page
  }) => {
    const input = page.locator('#type-input');

    await input.fill('按 Enter 送出測試');
    await input.press('Enter');

    // 驗證輸入框被清空
    await expect(input).toHaveValue('');

    // 打開歷史紀錄驗證該筆對話
    await page.locator('#btn-history').click();
    const userMessage = page.locator('#history-list .history-item.user').last();
    await expect(userMessage).toContainText('按 Enter 送出測試');
  });

  test('should not submit message when input is only whitespace', async ({
    page
  }) => {
    const input = page.locator('#type-input');
    const sendBtn = page.locator('#btn-send');

    await input.fill('   ');
    await sendBtn.click();

    // 打開歷史紀錄，確認沒有空白訊息被送出
    await page.locator('#btn-history').click();
    const emptyNotice = page.locator('#history-list .history-empty');
    await expect(emptyNotice).toBeVisible();
  });
});
