import { defineConfig } from 'vite';
import analog from '@analogjs/platform';
import { avatarBotAnalogPlugin, getAnalogNitroConfig } from 'ai-avatar-bot-typescript/analog';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    analog({
      ssr: false,
      nitro: {
        ...getAnalogNitroConfig()
      }
    }),
    avatarBotAnalogPlugin()
  ]
});
