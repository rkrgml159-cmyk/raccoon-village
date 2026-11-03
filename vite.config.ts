import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: '/raccoon-village/',
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'src/domain'),
      '@render': resolve(__dirname, 'src/render'),
      '@app': resolve(__dirname, 'src/app'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        w: resolve(__dirname, 'w/index.html'),
      },
    },
  },
})
