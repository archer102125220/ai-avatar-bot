import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import apiPlugin from '../shared/vite-api-plugin';

export default defineConfig({
  plugins: [dts(), apiPlugin()],
  publicDir: 'public',
  build: {
    lib: {
      entry: resolve(__dirname, 'core/main.ts'),
      name: 'AiAvatarBot',
      fileName: 'ai-avatar-bot'
    }
  }
});
