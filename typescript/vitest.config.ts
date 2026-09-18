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
    exclude: [
      'test/e2e/**',
      '**/node_modules/**',
      '**/dist/**',

      // [PHASE-2-BENCHMARK-REGISTRY]
      // 階段二標竿測試已全數就位 (38 份單元測試)。
      // 階段三 TDD 翻寫時，每實作一個模組，將該模組自下列清單解除（或於指令直接指定），即啟動紅綠燈驗證：
      'test/unit/constants.test.ts',
      'test/unit/store.test.ts',
      'test/unit/i18n.test.ts',
      'test/unit/tools/**',
      'test/unit/brain/**',
      'test/unit/speech/**',
      'test/unit/plugins/**',
      'test/unit/skin/**',
      'test/unit/orchestrator/**',
      'test/unit/ui/**'
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
