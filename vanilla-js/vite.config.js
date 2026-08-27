import { defineConfig } from 'vite';
import { resolve } from 'path';
import apiPlugin from '../shared/vite-api-plugin';
import { avatarBotVitePlugin } from './plugins/vite';

export default defineConfig({
  plugins: [apiPlugin(), avatarBotVitePlugin()],
  publicDir: 'public',
  build: {
    lib: {
      entry: resolve(__dirname, 'core/index.js'),
      name: 'AiAvatarBot',
      fileName: 'ai-avatar-bot'
    }
  }
});
