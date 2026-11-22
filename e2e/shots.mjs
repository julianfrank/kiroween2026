// Screenshots of the entry screens for design review: node e2e/shots.mjs (after npm run build).
// Uses the installed Google Chrome and a fake Prompt API. Writes PNGs to ideas/scary-money-manager/design/shots/.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FILE = pathToFileURL(resolve('dist/index.html')).href;
const OUT = resolve('ideas/scary-money-manager/design/shots');
mkdirSync(OUT, { recursive: true });

/** A fake model: 'download' stops at 62% of a download, 'ready' is already available. */
const fake = (mode) => {
  const session = { prompt: async () => 'ready', destroy() {}, contextUsage: 0, contextWindow: 1e5 };
  const api = {
    availability: async () => (mode === 'download' ? 'downloadable' : 'available'),
    create: (opts) =>
      mode === 'download'
        ? new Promise(() => {
            const listeners = [];
            opts?.monitor?.({ addEventListener: (_t, cb) => listeners.push(cb) });
            setTimeout(() => listeners.forEach((cb) => cb({ loaded: 0.62 })), 50);
          })
        : Promise.resolve(session),
  };
  Object.defineProperty(window, 'LanguageModel', { configurable: true, writable: true, value: api });
};

const browser = await chromium.launch({ channel: 'chrome' });
async function page(mode, width = 1280, height = 800) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript(fake, mode);
  const p = await ctx.newPage();
  await p.goto(FILE);
  return p;
}
const settle = (p) => p.waitForTimeout(1600);

{
  const p = await page('download');
  await p.getByRole('button', { name: 'Download and start' }).click();
  await p.getByText('Downloading model 62%').waitFor();
  await settle(p);
  await p.screenshot({ path: `${OUT}/1-loader.png` });
}
{
  const p = await page('ready');
  await p.getByText('There is no database in this browser yet.').waitFor();
  await p.getByLabel('Password').fill('Kiroween-2026');
  await settle(p);
  await p.screenshot({ path: `${OUT}/2-password.png` });
  await p.getByRole('button', { name: 'Start New Database' }).click();
  await p.getByLabel('Repeat password').fill('Kiroween-2026');
  await p.getByRole('button', { name: 'Create new database' }).click();
  await p.getByRole('heading', { name: 'Set up your opening balances' }).waitFor();
  await p.getByPlaceholder('House, Bank, Cash').fill('Chennai flat');
  await p.getByPlaceholder('40L, 5,00,000').first().fill('85L');
  await p.getByPlaceholder('Home loan, Card').fill('Dubakur Bank - Home Loan');
  await p.getByPlaceholder('40L, 5,00,000').nth(1).fill('30L');
  await settle(p);
  await p.screenshot({ path: `${OUT}/3-setup-unbalanced.png`, fullPage: true });
  await p.getByRole('button', { name: 'Use difference' }).click();
  await settle(p);
  await p.screenshot({ path: `${OUT}/4-setup-balanced.png`, fullPage: true });
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('navigation', { name: 'Main tabs' }).waitFor();
  await settle(p);
  await p.screenshot({ path: `${OUT}/6-main-header.png` });
}
{
  const p = await page('ready', 390, 844);
  await p.getByText('There is no database in this browser yet.').waitFor();
  await settle(p);
  await p.screenshot({ path: `${OUT}/5-password-phone.png` });
}
for (const [label, name] of [['Sample that ends below zero', '7-sample-negative'], ['Sample that ends above zero', '8-sample-positive']]) {
  const p = await page('ready');
  await p.getByLabel('Password').fill('sample-password');
  await p.getByRole('button', { name: 'Try a sample' }).click();
  await p.getByRole('button', { name: label }).click();
  await p.getByRole('navigation', { name: 'Main tabs' }).waitFor();
  await settle(p);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}
await browser.close();
console.log(`Saved to ${OUT}`);
