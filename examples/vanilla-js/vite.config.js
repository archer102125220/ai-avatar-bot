import { defineConfig } from 'vite';
import { avatarBotVitePlugin } from 'ai-avatar-bot-typescript/vite';

export default defineConfig({
  plugins: [
    avatarBotVitePlugin()
  ],
  server: {
    port: 3001,
    open: false
  }
});
