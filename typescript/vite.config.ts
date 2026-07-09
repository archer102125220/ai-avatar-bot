import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import apiPlugin from '../shared/vite-api-plugin';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'AiAvatarBot',
      fileName: 'ai-avatar-bot'
    }
  },
  plugins: [dts(), apiPlugin()]
});
