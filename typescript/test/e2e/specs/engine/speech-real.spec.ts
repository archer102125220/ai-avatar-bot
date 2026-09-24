import { test, expect } from '@playwright/test';

test.describe('Real Engine Track B: Speech Web Audio API Smoke Specifications', () => {
  test('should verify browser AudioContext and AnalyserNode capability', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/engine.html');

    // 驗證現代瀏覽器支援 Web Audio API
    const audioSupport = await page.evaluate(() => {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      const state = ctx.state;
      ctx.close();
      return {
        hasAudioContext: true,
        hasAnalyser: typeof analyser.getByteFrequencyData === 'function',
        state
      };
    });

    expect(audioSupport).not.toBeNull();
    expect(audioSupport?.hasAudioContext).toBe(true);
    expect(audioSupport?.hasAnalyser).toBe(true);
  });

  test('should compute mouth movements smoothly through real speechEngine computeMouth', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/engine.html');

    const mouthValue = await page.evaluate(() => {
      const widget = (window as any).aiAvatarWidget;
      if (!widget?.speechEngine) return null;

      // 模擬語音正在說話狀態
      widget.speechEngine.isSpeaking = true;

      // 呼叫口型運算
      const val1 = widget.speechEngine.computeMouth();
      const val2 = widget.speechEngine.computeMouth();

      widget.speechEngine.isSpeaking = false;
      const val3 = widget.speechEngine.computeMouth();

      return { val1, val2, val3 };
    });

    expect(mouthValue).not.toBeNull();
    expect(typeof mouthValue?.val1).toBe('number');
    expect(typeof mouthValue?.val2).toBe('number');
    expect(typeof mouthValue?.val3).toBe('number');
    expect(Number.isFinite(mouthValue?.val1)).toBe(true);
  });
});
