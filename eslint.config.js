import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      '.superpowers',
      '.claude',
      'dist',
      'node_modules',
      'coverage',
      'test-results',
      'playwright-report',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/domain/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: ['phaser'], patterns: ['phaser/*'] }],
    },
  },
  prettier,
)
