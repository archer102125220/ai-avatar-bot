import { test, expect } from '@playwright/test';

test.describe('Phase 4: Release Bundle Dist Smoke Specifications', () => {
  test('should load production bundle from /dist/ai-avatar-bot.js and mount successfully', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/dist.html');

    // 驗證 dist 模組成功 import 並執行 onReady
    await page.waitForFunction(() => (window as any).__distLoaded === true);

    const hasError = await page.evaluate(() => (window as any).__distError);
    expect(hasError).toBeNull();

    // 驗證核心 DOM 與控制按鈕完全健全
    const stage = page.locator('#stage');
    const input = page.locator('#type-input');
    const sendBtn = page.locator('#btn-send');
    const micBtn = page.locator('#btn-mic');

    await expect(stage).toBeAttached();
    await expect(input).toBeVisible();
    await expect(sendBtn).toBeVisible();
    await expect(micBtn).toBeVisible();
  });
});
