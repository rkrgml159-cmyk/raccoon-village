import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'src/domain'),
      '@render': resolve(__dirname, 'src/render'),
      '@app': resolve(__dirname, 'src/app'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      thresholds: { lines: 90, branches: 90, functions: 90 },
    },
  },
})
