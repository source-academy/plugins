// @ts-check

import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettierFlat from 'eslint-config-prettier/flat';
import * as importPlugin from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: ['.yarn', '.pnp*', '**/dist', '**/node_modules', '**/coverage'],
  },
  eslintConfigPrettierFlat,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/first': 'warn',
      'import/newline-after-import': 'warn',
      'import/no-duplicates': ['warn', { 'prefer-inline': false }],
      'import/no-useless-path-segments': 'error',
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          named: {
            import: true,
            types: 'types-last',
          },
          alphabetize: {
            order: 'asc',
            orderImportKind: 'asc',
          },
        },
      ],

      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'commander',
              message: 'Use @commander-js/extra-typings instead!',
            },
          ],
        },
      ],
    },
  },
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-explicit-any': 'off', // was error
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
    },
  },
  {
    files: ['**/__tests__/**/*.test.{ts,tsx}'],
    extends: [vitest.configs.recommended],
    plugins: {
      vitest,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',

      'vitest/prefer-describe-function-title': 'warn',
      'vitest/prefer-import-in-mock': 'error',
      'vitest/prefer-vi-mocked': 'warn',
      'vitest/valid-title': ['warn', { ignoreTypeOfDescribeName: true }],
    },
  },
  {
    files: ['**/*.{js,cjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
