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
    dts({
      include: ['core', 'env.d.ts'],
      entryRoot: 'core'
    }),
    apiPlugin()
  ],
  publicDir: 'public',
  build: {
    copyPublicDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'core/main.ts'),
      name: 'AiAvatarBot',
      fileName: 'ai-avatar-bot'
    },
    rollupOptions: {
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
