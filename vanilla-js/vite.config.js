import { defineConfig } from 'vite';
import { resolve } from 'path';
import apiPlugin from '../shared/vite-api-plugin';

export default defineConfig({
  plugins: [apiPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'core/index.js'),
      name: 'AiAvatarBot',
      fileName: 'ai-avatar-bot'
    }
  }
});
