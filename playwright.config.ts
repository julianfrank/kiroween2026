import { defineConfig } from '@playwright/test';

// Smoke test of the built single file, opened from disk in the installed Google Chrome.
// The on-device AI is replaced by a scripted fake inside the page (see e2e/smoke.spec.ts).
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    channel: 'chrome',
    headless: true,
    acceptDownloads: true,
    timezoneId: 'America/New_York', // far from IST, to prove dates follow IST and not the machine
  },
});
