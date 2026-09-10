import { defineConfig } from 'vite';
import { resolve } from 'path';
import apiPlugin from '../shared/vite-api-plugin';
import { avatarBotVitePlugin } from './plugins/vite';

export default defineConfig({
  plugins: [apiPlugin(), avatarBotVitePlugin()],
  publicDir: 'public',
  build: {
    lib: {
      entry: {
        'ai-avatar-bot': resolve(__dirname, 'core/index.js'),
        brain: resolve(__dirname, 'core/brain/index.js'),
        skin: resolve(__dirname, 'core/skin/index.js'),
        speech: resolve(__dirname, 'core/speech/index.js'),
        tools: resolve(__dirname, 'core/tools/index.js'),
        i18n: resolve(__dirname, 'core/i18n/index.js'),
        plugins: resolve(__dirname, 'core/plugins/index.js'),
        constants: resolve(__dirname, 'core/constants.js')
      },
      name: 'AiAvatarBot',
      fileName: (format, entryName) =>
        format === 'es' ? `${entryName}.js` : `${entryName}.cjs`
    },
    rollupOptions: {
      output: {
        exports: 'named',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'style.css';
          }
          return '[name].[ext]';
        }
      }
    }
  }
});
