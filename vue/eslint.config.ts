import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  {
    plugins: {
      unicorn: (await import('eslint-plugin-unicorn')).default
    },
    rules: {
      // Vue 相關自訂規則
      'vue/no-deprecated-destroyed-lifecycle': 1,
      'vue/no-v-for-template-key-on-child': 0,
      'vue/multi-word-component-names': 0,
      'vue/no-dupe-keys': 1,
      'vue/no-unused-vars': 'off',
      'vue/valid-define-props': 'off',

      // 一般 JS/TS 規則
      'prefer-const': 2,
      'no-var': 2,
      'no-console': 0,
      'no-const-assign': 2,
      'no-useless-escape': 1,
      camelcase: 0,
      'no-async-promise-executor': 'off',
      'no-empty': 'off',
      'import/no-mutable-exports': 'off',
      'no-unsafe-optional-chaining': 'off',

      // Unicorn 規則
      'unicorn/escape-case': 1,

      // TypeScript 專屬規則 (取代原本純 JS 規則)
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      'no-unused-vars': 'off', // 關閉基礎 no-unused-vars 以避免與 TS 版本衝突
      '@typescript-eslint/no-unused-vars': [
        1,
        {
          vars: 'all',
          args: 'after-used',
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],

      // ⚠️ 潛在衝突規則 (已暫時註解)：
      // 這些是 ESLint 的排版規則，因為設定檔最後使用了 `skipFormatting` 交給 Prettier，
      // 如果在這裡設定會與 Prettier 發生衝突。
      // 您原先的 .prettierrc 中已有對應的 "semi": true 與 "singleQuote": true 設定，
      // 因此建議將這三行保持註解，完全由 Prettier 控管排版即可。
      // 'no-extra-semi': 2,
      // semi: [1, 'always'],
      // quotes: [1, 'single', { avoidEscape: true }],
    }
  },

  skipFormatting,
)
