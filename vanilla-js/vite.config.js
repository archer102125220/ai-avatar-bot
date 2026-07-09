import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'core/index.js'),
      name: 'AiAvatarBot',
      fileName: 'ai-avatar-bot'
    }
  }
});
