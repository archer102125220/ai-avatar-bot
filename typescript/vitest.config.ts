import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
      '@core': resolve(import.meta.dirname, 'core'),
      '@test': resolve(import.meta.dirname, 'test'),
      '@style': resolve(import.meta.dirname, 'style')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(import.meta.dirname, 'test/setup.ts')],
    include: ['test/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'test/e2e/**',
      '**/node_modules/**',
      '**/dist/**',

      // [PHASE-3-STEP-1-UNLOCKED]
      // 已完成實作並解鎖驗證：
      // - test/unit/constants.test.ts
      // - test/unit/store.test.ts
      // - test/unit/i18n.test.ts
      // [PHASE-3-STEP-2-UNLOCKED]
      // - test/unit/tools/**
      // [PHASE-3-STEP-3-UNLOCKED]
      // - test/unit/brain/**
      // [PHASE-3-STEP-4-UNLOCKED]
      // - test/unit/speech/**
      // [PHASE-3-STEP-5-UNLOCKED]
      // - test/unit/plugins/**
      // [PHASE-3-STEP-7-UNLOCKED]
      // - test/unit/orchestrator/**
      // [PHASE-3-STEP-8-UNLOCKED]
      // - test/unit/ui/**
    ],
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
