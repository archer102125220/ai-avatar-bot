import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { avatarBotVitePlugin } from 'ai-avatar-bot-typescript/vite';

export default defineConfig({
  plugins: [
    vue(),
    avatarBotVitePlugin()
  ],
  server: {
    port: 3003,
    open: false
  }
});
