import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { avatarBotVitePlugin } from '@ai-avatar-bot/sdk/vite';

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
