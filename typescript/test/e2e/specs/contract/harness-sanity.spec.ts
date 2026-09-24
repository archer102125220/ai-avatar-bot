import { test, expect } from '@playwright/test';

test.describe('Phase 1: E2E Test Infrastructure & Harness Sanity Check', () => {
  test('should load contract harness and mount widget with all core UI elements', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/contract.html');

    // 等待沙盒初始化就緒
    await page.waitForFunction(() => (window as any).__harnessReady === true);

    // 1. 驗證容器與核心 DOM 元素存在
    const app = page.locator('#app');
    await expect(app).toBeAttached();

    const bubble = page.locator('#bubble');
    await expect(bubble).toBeAttached();

    const input = page.locator('#type-input');
    await expect(input).toBeAttached();

    const sendBtn = page.locator('#btn-send');
    await expect(sendBtn).toBeAttached();

    const micBtn = page.locator('#btn-mic');
    await expect(micBtn).toBeAttached();

    const historyBtn = page.locator('#btn-history');
    await expect(historyBtn).toBeAttached();

    const minimalBtn = page.locator('.aw-minimal');
    await expect(minimalBtn).toBeAttached();

    // 2. 驗證無障礙與語意標籤
    await expect(page.getByLabel('輸入文字問題')).toBeAttached();
    await expect(page.getByLabel('送出文字問題')).toBeAttached();
  });

  test('should re-initialize harness smoothly with custom options without errors', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/contract.html');
    await page.waitForFunction(() => (window as any).__harnessReady === true);

    // 透過 window.initHarness 重新掛載
    await page.evaluate(async () => {
      await (window as any).initHarness({
        isMinimal: true
      });
    });

    await page.waitForFunction(() => (window as any).__harnessReady === true);

    // 驗證仍能正常獲取控制項
    await expect(page.locator('#btn-send')).toBeAttached();
    await expect(page.locator('.aw-minimal')).toBeAttached();
  });
});
