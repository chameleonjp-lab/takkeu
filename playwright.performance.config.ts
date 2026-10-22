import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/performance', outputDir: 'artifacts/performance-tests', retries: 0, workers: 1, timeout: 90_000,
  reporter: [['list'], ['json', { outputFile: 'artifacts/performance-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4176', video: 'off', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } } },
    { name: 'webkit', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4176 --strictPort', url: 'http://127.0.0.1:4176', reuseExistingServer: false },
});
