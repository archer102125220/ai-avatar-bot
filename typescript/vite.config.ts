/**
 * @file Vite 主庫打包配置檔 (多 Entry 模組化建構：ESM / CommonJS / TypeScript 定義檔)
 *
 * 【設計背景與原因】：
 * 1. 支援現代前端專案（Vite / Webpack / Next.js）與 ESM CDN（jsDelivr +esm）的按需引入（Tree-shaking）。
 * 2. 獨立導出各子模組（./brain、./skin、./speech、./tools、./i18n 等），讓純邏輯使用者無需載入龐大渲染引擎。
 * 3. 搭配 vite-plugin-dts 自動生成對應的 .d.ts 型別定義檔。
 * 4. 外部化大型依賴（Three.js、WebLLM 等），避免多重實例衝突並大幅縮減套件體積。
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import apiPlugin from '../shared/vite-api-plugin.ts';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
      '@core': resolve(import.meta.dirname, 'core'),
      '@test': resolve(import.meta.dirname, 'test'),
      '@style': resolve(import.meta.dirname, 'style')
    }
  },
  plugins: [
    // 自動生成 TypeScript .d.ts 型別定義檔並保持目錄層級結構
    dts({
      include: ['core', 'env.d.ts'],
      entryRoot: 'core'
    }),
    apiPlugin()
  ],
  publicDir: 'public',
  build: {
    // 避免將 demo 專屬的 public 靜態資源複製進發布目錄
    copyPublicDir: false,
    lib: {
      // 多入口配置：支援按需引用各子模組
      entry: {
        'ai-avatar-bot': resolve(import.meta.dirname, 'core/main.ts'),
        brain: resolve(import.meta.dirname, 'core/brain/index.ts'),
        skin: resolve(import.meta.dirname, 'core/skin/index.ts'),
        speech: resolve(import.meta.dirname, 'core/speech/index.ts'),
        tools: resolve(import.meta.dirname, 'core/tools/index.ts'),
        i18n: resolve(import.meta.dirname, 'core/i18n/index.ts'),
        plugins: resolve(import.meta.dirname, 'core/plugins/index.ts'),
        constants: resolve(import.meta.dirname, 'core/constants.ts')
      },
      name: 'AiAvatarBot',
      // 同步輸出現代 ESM (.js) 與 CommonJS (.cjs)
      fileName: (format, entryName) =>
        format === 'es' ? `${entryName}.js` : `${entryName}.cjs`
    },
    rollupOptions: {
      // 外部化大型依賴：避免打包進宿主專案自帶的 Three.js / WebLLM，杜絕多重實例衝突
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
        // 統一樣式輸出檔名為 ai-avatar-bot.css
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'ai-avatar-bot.css';
          }
          return '[name].[ext]';
        }
      }
    }
  }
});
