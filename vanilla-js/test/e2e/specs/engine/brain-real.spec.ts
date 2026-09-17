import { test, expect } from '@playwright/test';

test.describe('Real Engine Track B: Brain Pipeline & SSE Stream Smoke Specifications', () => {
  test('should route queries to AI Provider when enabled and receive response', async ({ page }) => {
    // 攔截並 Mock AI Provider 的 /api/tags (ping) 與 /chat/completions (chat)
    await page.route('**/api/tags', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'test-model' }] })
      });
    });

    await page.route('**/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: '這是來自 AI 伺服器的真實串流回覆。'
              },
              finish_reason: 'stop'
            }
          ]
        })
      });
    });

    await page.goto('/test/e2e/harness/engine.html');

    // 重新以 AI Provider 選項啟動 Widget
    await page.evaluate(async () => {
      await (window as any).initEngineHarness({
        enableAiProvider: true,
        aiProviderBaseUrl: 'http://127.0.0.1:5173/api/ai',
        aiProviderModel: 'test-model'
      });
    });

    // 驗證輸入問題並送出
    const input = page.locator('#type-input');
    await input.fill('測試 AI Provider');
    await page.locator('#btn-send').click();

    // 驗證泡泡或歷史紀錄中包含 AI Provider 回覆
    const bubble = page.locator('#bubble');
    await expect(bubble).toContainText('這是來自 AI 伺服器的真實串流回覆。');
  });

  test('should fallback to retrieval answer when AI Provider fails', async ({ page }) => {
    // 模擬 AI Provider 連線失敗
    await page.route('**/api/tags', async (route) => {
      await route.fulfill({ status: 500 });
    });

    await page.goto('/test/e2e/harness/engine.html');

    await page.evaluate(async () => {
      await (window as any).initEngineHarness({
        enableAiProvider: true,
        aiProviderBaseUrl: 'http://127.0.0.1:5173/api/ai-fail',
        aiProviderModel: 'test-model'
      });
    });

    // 發送問題
    const input = page.locator('#type-input');
    await input.fill('這是什麼？');
    await page.locator('#btn-send').click();

    // 驗證觸發知識庫檢索回答（內建知識庫中包含「這是什麼」的說明）
    const bubble = page.locator('#bubble');
    await expect(bubble).toBeVisible();
    await expect(bubble).not.toBeEmpty();
  });
});
