import prettier from 'eslint-config-prettier';
import globals from 'globals';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    plugins: {
      unicorn
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-extra-semi': 2,
      semi: [1, 'always'],
      quotes: [1, 'single', { avoidEscape: true }],
      'prefer-const': 2,
      'no-var': 2,
      'no-console': 0,
      'no-const-assign': 2,
      'no-useless-escape': 1,
      'unicorn/escape-case': 1,
      camelcase: 0,
      'no-async-promise-executor': 'off',
      'no-empty': 'off',
      'import/no-mutable-exports': 'off',
      'no-unsafe-optional-chaining': 'off',
      'no-unused-vars': 'off', // Turn off base rule as it conflicts with TS one
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-unused-vars': [
        1,
        {
          vars: 'all',
          args: 'after-used',
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    },
  },
  {
    // Ignore test files from ESLint
    ignores: [
      'tests/**/*.spec.js',
      'tests/**/*.spec.ts',
      '**/__tests__/**',
      'dist/**'
    ]
  },
  prettier
);