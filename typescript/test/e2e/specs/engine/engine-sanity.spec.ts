import { test, expect } from '@playwright/test';

test.describe('Phase 1: Real Engine Smoke Sanity Check (Track B)', () => {
  test('should load engine harness and mount real stage container', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/engine.html');

    // 驗證容器存在
    const app = page.locator('#app');
    await expect(app).toBeAttached();

    // 驗證真實 stage 節點生成
    const stage = page.locator('#stage');
    await expect(stage).toBeAttached();

    // 驗證 AudioContext 支援
    const hasAudioContext = await page.evaluate(() => {
      return typeof window.AudioContext === 'function';
    });
    expect(hasAudioContext).toBe(true);
  });
});
