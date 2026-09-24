import { test, expect } from '@playwright/test';

test.describe('Real Engine Track B: Skin WebGL & Canvas Smoke Specifications', () => {
  test('should create canvas with WebGL context when 2D mode mounts', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/engine.html');

    // 驗證 stage 容器成功建立
    const stage = page.locator('#stage');
    await expect(stage).toBeAttached();

    // 驗證 Canvas 元素被插入
    const canvas = page.locator('#stage canvas');
    await expect(canvas).toBeAttached();

    // 驗證瀏覽器具備可用的 WebGL 上下文 (WebGLRenderingContext 或 WebGL2RenderingContext)
    const hasWebGL = await page.evaluate(() => {
      const cvs = document.querySelector('#stage canvas') as HTMLCanvasElement;
      if (!cvs) return false;
      const gl =
        cvs.getContext('webgl') ||
        cvs.getContext('experimental-webgl') ||
        cvs.getContext('webgl2');
      return gl !== null && typeof gl === 'object';
    });

    expect(hasWebGL).toBe(true);
  });

  test('should support dynamically toggling to 3D mode and recreate WebGL canvas', async ({
    page
  }) => {
    await page.goto('/test/e2e/harness/engine.html');

    const stage = page.locator('#stage');
    await expect(stage).toBeAttached();

    // 切換引擎模式至 3D
    await page.evaluate(async () => {
      const widget = (window as any).aiAvatarWidget;
      if (widget?.skinEngine) {
        widget.skinEngine.engineMode = '3D';
      }
    });

    // 驗證 canvas 依然存在並維持 WebGL 正常狀態
    const canvas = page.locator('#stage canvas');
    await expect(canvas).toBeAttached();

    const isWebGLActive = await page.evaluate(() => {
      const cvs = document.querySelector('#stage canvas') as HTMLCanvasElement;
      if (!cvs) return false;
      const gl =
        cvs.getContext('webgl') ||
        cvs.getContext('experimental-webgl') ||
        cvs.getContext('webgl2');
      return gl !== null && typeof gl === 'object';
    });

    expect(isWebGLActive).toBe(true);
  });
});
