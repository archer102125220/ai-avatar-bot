import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
      '@core': resolve(import.meta.dirname, 'core'),
      '@test': resolve(import.meta.dirname, 'test'),
      '@style': resolve(import.meta.dirname, 'style'),
      '@types': resolve(import.meta.dirname, 'types')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(import.meta.dirname, 'test/setup.ts')],
    include: ['test/**/*.{test,spec}.{js,ts}'],
    exclude: ['test/e2e/**', '**/node_modules/**', '**/dist/**'],
    outputFile: resolve(import.meta.dirname, 'html/index.html'),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: resolve(import.meta.dirname, 'coverage'),
      include: ['core/**/*.{js,ts}'],
      exclude: [
        'core/index.ts',
        'core/orchestrator/types.ts',
        'core/ui/index.ts',
        'core/plugins/index.ts',
        'core/i18n/locales/**'
      ]
    }
  }
});
