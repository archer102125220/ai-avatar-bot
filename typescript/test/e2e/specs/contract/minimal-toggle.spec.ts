import { test, expect } from '@playwright/test';

test.describe('Contract Track A: Minimal Toggle & Collapsing Specifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/e2e/harness/contract.html');
    await page.waitForFunction(() => (window as any).__harnessReady === true);
  });

  test('should toggle minimal mode when clicking close button and restore when clicking minimal badge', async ({
    page
  }) => {
    const closeBtn = page.locator('#btn-close');
    const minimalBtn = page.locator('.aw-minimal');

    // 1. 點擊收合按鈕
    await closeBtn.click();

    // 驗證 isMinimal 狀態變更，懸浮球顯示
    await expect(minimalBtn).toHaveCSS('display', 'flex');

    // 2. 點擊懸浮球展開
    await minimalBtn.click();

    // 驗證懸浮球隱藏
    await expect(minimalBtn).toHaveCSS('display', 'none');
  });

  test('should trigger onMinimalTrigger callback when minimal state changes', async ({
    page
  }) => {
    // 重新以自訂 onMinimalTrigger 初始化
    await page.evaluate(async () => {
      (window as any).__minimalTriggers = [];
      await (window as any).initHarness({
        onMinimalTrigger: (isMinimal: boolean) => {
          (window as any).__minimalTriggers.push(isMinimal);
        }
      });
    });

    // 等待初始化就緒並清空初始 trigger 紀錄
    await page.waitForFunction(() => (window as any).__harnessReady === true);
    await page.evaluate(() => {
      (window as any).__minimalTriggers = [];
    });

    // 點擊收起
    await page.locator('#btn-close').click();

    // 點擊展開
    await page.locator('.aw-minimal').click();

    // 驗證回呼按順序觸發 [true, false]
    const triggers = await page.evaluate(() => (window as any).__minimalTriggers);
    expect(triggers).toEqual([true, false]);
  });
});
