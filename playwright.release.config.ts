import { defineConfig } from '@playwright/test';
export default defineConfig({
  captureGitInfo: { commit: true, diff: false },
  testDir: './tests/release', testMatch: '**/*.spec.ts', outputDir: 'artifacts/release-tests', retries: 0, workers: 1, forbidOnly: !!process.env.CI,
  reporter: [['list'], ['json', { outputFile: 'artifacts/release-results.json' }]],
  projects: [{ name: 'chromium', use: { browserName: 'chromium', launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: [
    { command: 'node scripts/serve-built.mjs artifacts/root-dist / 4174', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
    { command: 'node scripts/serve-built.mjs dist /takkeu/ 4175', url: 'http://127.0.0.1:4175/takkeu/', reuseExistingServer: false },
  ],
  use: { screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
