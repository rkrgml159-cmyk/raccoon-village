import { defineConfig } from '@playwright/test'

const executablePath = process.env.PW_CHROMIUM

export default defineConfig({
  testDir: 'tests/e2e',
  snapshotPathTemplate: 'tests/capture/baseline/{arg}-{projectName}{ext}',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: {
    baseURL: 'http://localhost:4173',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173/raccoon-village/',
    reuseExistingServer: !process.env.CI,
  },
})
