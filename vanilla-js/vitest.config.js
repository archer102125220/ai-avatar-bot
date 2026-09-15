import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.')
    }
  },
  test: {

    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, 'test/setup.js')],
    include: ['test/**/*.{test,spec}.js'],
    outputFile: resolve(__dirname, 'html/index.html'),
    // api: {
    //   token: false
    // },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: resolve(__dirname, 'coverage'),
      include: ['core/**/*.js'],
      exclude: [
        'core/index.js',
        'core/orchestrator/types.js',
        'core/ui/index.js',
        'core/plugins/index.js',
        'core/i18n/locales/**'
      ]
    }
  }
});
