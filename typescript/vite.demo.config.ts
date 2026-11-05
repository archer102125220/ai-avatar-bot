/**
 * @file Vite 線上展示站打包配置檔 (Vercel SPA Demo Build Configuration)
 *
 * 【設計背景與原因】：
 * 1. 與 `vite.config.ts`（Library 模式，外部化大型 Peer 依賴）分離，專責將 `index.html`
 *    打包為可獨立運行於瀏覽器的靜態單頁應用（輸出至 `dist-demo/`）。
 * 2. 內建 `avatarBotVitePlugin()`，在構建完成時自動將 `avatar-skin/` 內建 2D/3D 模型與動作資產
 *    完整同步至 `dist-demo/avatar-skin/`，確保部署至 Vercel 後零 404。
 * 3. 設定 `target: 'es2022'` 原生支援 `index.html` 中的 Top-level `await` 語法。
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { avatarBotVitePlugin } from './plugins/vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
      '@core': resolve(import.meta.dirname, 'core'),
      '@test': resolve(import.meta.dirname, 'test'),
      '@style': resolve(import.meta.dirname, 'style')
    }
  },
  plugins: [avatarBotVitePlugin()],
  publicDir: 'public',
  build: {
    target: 'es2022',
    outDir: 'dist-demo',
    emptyOutDir: true,
    copyPublicDir: true
  }
});

