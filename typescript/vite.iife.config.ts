/**
 * @file Vite IIFE 獨立打包配置檔 (專供傳統瀏覽器 CDN 全域引用)
 *
 * 【設計背景與原因】：
 * 1. 在 vite.config.ts 中，我們採用了多 Entry 打包（ai-avatar-bot、brain、skin、speech 等）
 *    以支援現代 npm 與 ESM CDN 的 Subpath 按需引入。但 Rollup 規範限制「多 Entry 不支援輸出 UMD/IIFE 格式」。
 * 2. 為了讓習慣使用傳統 `<script src="...">` 標籤的開發者能直接在瀏覽器環境掛載 `window.AiAvatarBot`，
 *    我們透過此獨立設定檔產出單一 IIFE Bundle (`dist/ai-avatar-bot.iife.js`)。
 * 3. 配合 package.json 的 "unpkg" 與 "jsdelivr" 欄位，使用者直接引用 CDN 網址時會自動載入此產物。
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
      '@core': resolve(import.meta.dirname, 'core'),
      '@test': resolve(import.meta.dirname, 'test'),
      '@style': resolve(import.meta.dirname, 'style')
    }
  },
  build: {
    // 關鍵設定：保留主建構（multi-entry ESM/CJS）產出的 dist 目錄，不進行清空
    emptyOutDir: false,
    // 避免將展示用 public 靜態資源拷貝進發布目錄
    copyPublicDir: false,
    lib: {
      // 僅針對核心主入口進行單檔打包
      entry: resolve(import.meta.dirname, 'core/main.ts'),
      // 全域變數名稱：載入後可在瀏覽器中直接透過 window.AiAvatarBot 調用
      name: 'AiAvatarBot',
      formats: ['iife'],
      fileName: () => 'ai-avatar-bot.iife.js'
    },
    rollupOptions: {
      // 外部化大型依賴：避免打包進重複的 Three.js / WebLLM / Pixi.js 導致體積暴增或實例衝突
      external: [
        'three',
        /^three\/.*/,
        '@pixiv/three-vrm',
        '@pixiv/three-vrm-animation',
        '@mlc-ai/web-llm',
        'pixi.js',
        'pixi-live2d-display'
      ],
      output: {
        exports: 'named',
        // 確保 CSS 輸出檔名與主建構產生的 ai-avatar-bot.css 一致
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'ai-avatar-bot.css';
          }
          return '[name].[ext]';
        },
        // 對應外部依賴在全域環境（window）中的變數名稱
        globals: {
          three: 'THREE',
          '@pixiv/three-vrm': 'THREE_VRM',
          '@pixiv/three-vrm-animation': 'THREE_VRM_ANIMATION',
          '@mlc-ai/web-llm': 'webllm',
          'pixi.js': 'PIXI',
          'pixi-live2d-display': 'PIXI.live2d'
        }
      }
    }
  }
});
