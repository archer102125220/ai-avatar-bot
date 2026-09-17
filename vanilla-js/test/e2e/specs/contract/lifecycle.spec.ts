import { test, expect } from '@playwright/test';

test.describe('Contract Track A: Lifecycle & Mount Specifications', () => {
  test('should mount widget successfully and invoke onReady callback', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/contract.html');

    // 等待沙盒初始化就緒
    await page.waitForFunction(() => (window as any).__harnessReady === true);

    // 驗證根節點與核心 UI 成功掛載
    const app = page.locator('#app');
    await expect(app).toBeAttached();

    const stage = page.locator('#stage');
    await expect(stage).toBeAttached();

    const controlBar = page.locator('#control-bar');
    await expect(controlBar).toBeAttached();
  });

  test('should support starting in minimal mode via initial options', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/contract.html');
    await page.waitForFunction(() => (window as any).__harnessReady === true);

    // 以 isMinimal: true 初始化
    await page.evaluate(async () => {
      await (window as any).initHarness({
        isMinimal: true
      });
    });

    await page.waitForFunction(() => (window as any).__harnessReady === true);

    // 驗證最小化懸浮按鈕可見
    const minimalBtn = page.locator('.aw-minimal');
    await expect(minimalBtn).toBeAttached();
  });

  test('should safely re-mount with different options without throwing errors', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/contract.html');
    await page.waitForFunction(() => (window as any).__harnessReady === true);

    const reInitResult = await page.evaluate(async () => {
      try {
        await (window as any).initHarness({
          gender: 'female',
          locale: 'en-US'
        });
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message };
      }
    });

    expect(reInitResult.success).toBe(true);
    await expect(page.locator('#btn-send')).toBeAttached();
  });
});
