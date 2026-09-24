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
    lib: {
      entry: resolve(import.meta.dirname, 'core/main.ts'),
      name: 'AiAvatarBot',
      fileName: 'ai-avatar-bot'
    },
    rollupOptions: {
      output: {
        exports: 'named'
      }
    }
  }
});
