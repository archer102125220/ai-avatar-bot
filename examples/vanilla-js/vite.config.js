import { defineConfig } from 'vite';
import { avatarBotVitePlugin } from '@ai-avatar-bot/sdk/vite';

export default defineConfig({
  plugins: [
    avatarBotVitePlugin()
  ],
  server: {
    port: 3001,
    open: false
  }
});
