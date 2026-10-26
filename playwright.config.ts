import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Historical verification archives make PR diffs very large in the sparse clone.
  // Keep the tested commit identity; GitHub already retains the complete code diff.
  captureGitInfo: { commit: true, diff: false },
  testDir: './tests/browser',
  fullyParallel: true,
  // Software WebGL browser/context startup is included in each test's timeout.
  // Gameplay timing and performance acceptance use separate explicit checks.
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Concurrent SwiftShader contexts starve each other's GPU readbacks in CI.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } } },
    { name: 'webkit', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
