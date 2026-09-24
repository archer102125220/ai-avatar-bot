import { test, expect } from '@playwright/test';

test.describe('Contract Track A: Toolbar Controls & Drawer Specifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/e2e/harness/contract.html');
    await page.waitForFunction(() => (window as any).__harnessReady === true);
  });

  test('should toggle mute state and update button label and aria-pressed', async ({
    page
  }) => {
    const muteBtn = page.locator('#btn-mute');

    // 初始非靜音
    await expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(muteBtn).toContainText('🔊');

    // 點擊靜音
    await muteBtn.click();
    await expect(muteBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(muteBtn).toContainText('🔇');

    // 再次點擊解除靜音
    await muteBtn.click();
    await expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(muteBtn).toContainText('🔊');
  });

  test('should cycle playback speed steps on click speed button', async ({
    page
  }) => {
    const speedBtn = page.locator('#btn-speed');

    // 預設 1.0×
    await expect(speedBtn).toContainText('1.0×');

    // 點擊依序循環 [1.2×, 1.4×, 0.9×, 1.0×]
    await speedBtn.click();
    await expect(speedBtn).toContainText('1.2×');

    await speedBtn.click();
    await expect(speedBtn).toContainText('1.4×');

    await speedBtn.click();
    await expect(speedBtn).toContainText('0.9×');

    await speedBtn.click();
    await expect(speedBtn).toContainText('1.0×');
  });

  test('should toggle language between supported locales on click lang button', async ({
    page
  }) => {
    const langBtn = page.locator('#btn-lang');

    // 初始為繁體中文標籤 (shortLabel: '繁中')
    await expect(langBtn).toContainText('繁中');

    // 點擊切換為英文 (shortLabel: 'EN')
    await langBtn.click();
    await expect(langBtn).toContainText('EN');
  });

  test('should open and close history panel and clear chat logs', async ({
    page
  }) => {
    // 1. 先發送一條訊息以產生紀錄
    await page.locator('#type-input').fill('紀錄測試');
    await page.locator('#btn-send').click();

    const historyBtn = page.locator('#btn-history');
    const historyPanel = page.locator('#history-panel');
    const historyCloseBtn = page.locator('#btn-history-close');
    const historyClearBtn = page.locator('#btn-history-clear');

    // 2. 開啟歷史面板
    await historyBtn.click();
    await expect(historyPanel).toHaveAttribute('css-is-open', 'true');
    await expect(historyBtn).toHaveAttribute('aria-expanded', 'true');

    // 驗證紀錄列表中有該筆訊息
    const userMsg = page.locator('#history-list .history-item.user');
    await expect(userMsg).toContainText('紀錄測試');

    // 3. 點擊清除紀錄
    await historyClearBtn.click();
    const emptyNotice = page.locator('#history-list .history-empty');
    await expect(emptyNotice).toBeVisible();

    // 4. 關閉歷史面板
    await historyCloseBtn.click();
    await expect(historyPanel).not.toHaveAttribute('css-is-open');
    await expect(historyBtn).toHaveAttribute('aria-expanded', 'false');
  });
});
