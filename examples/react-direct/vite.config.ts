import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { avatarBotVitePlugin } from 'ai-avatar-bot-typescript/vite';

export default defineConfig({
  plugins: [
    react(),
    avatarBotVitePlugin()
  ],
  server: {
    port: 3002,
    open: false
  }
});
