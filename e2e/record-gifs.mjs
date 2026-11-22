// Records three short scenes of the real app (built dist/index.html, installed Chrome, fake Prompt API) as
// frame sequences, for the README GIFs. Then run: python e2e/make-gifs.py
//   node e2e/record-gifs.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FILE = pathToFileURL(resolve('dist/index.html')).href;
const OUT = resolve('.gif-frames');
rmSync(OUT, { recursive: true, force: true });

/** mode 'loading': the model download creeps up and never finishes. mode 'ready': available at once. */
function fakeAi({ mode, replies }) {
  const session = {
    contextUsage: 0,
    contextWindow: 1e5,
    async prompt(input) {
      if (/single word: ready/.test(input)) return 'ready';
      const m = /Message: (".*")$/m.exec(input);
      const said = m ? JSON.parse(m[1]) : '';
      return JSON.stringify(replies[said] ?? { intent: 'other', amount: '', date: '', fromAccount: '', toAccount: '' });
    },
    destroy() {},
  };
  const api = {
    availability: async () => (mode === 'loading' ? 'downloadable' : 'available'),
    create: (opts) =>
      mode === 'loading'
        ? new Promise(() => {
            const listeners = [];
            opts?.monitor?.({ addEventListener: (_t, cb) => listeners.push(cb) });
            let p = 0.18;
            setInterval(() => {
              p = Math.min(0.93, p + 0.012);
              listeners.forEach((cb) => cb({ loaded: p }));
            }, 120);
          })
        : Promise.resolve(session),
  };
  Object.defineProperty(window, 'LanguageModel', { configurable: true, writable: true, value: api });
}

const browser = await chromium.launch({ channel: 'chrome' });

async function open(mode, size, replies = {}) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  await ctx.addInitScript(fakeAi, { mode, replies });
  const page = await ctx.newPage();
  await page.goto(FILE);
  return page;
}

/** Screenshot as fast as Chrome allows for `ms`, keeping each frame's time. */
async function record(page, name, ms, clip) {
  const dir = resolve(OUT, name);
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < ms) {
    await page.screenshot({ path: resolve(dir, `${String(i++).padStart(4, '0')}.png`), clip });
  }
  const seconds = (Date.now() - t0) / 1000;
  writeFileSync(resolve(dir, 'meta.json'), JSON.stringify({ frames: i, seconds }));
  console.log(`${name}: ${i} frames in ${seconds.toFixed(1)} s`);
}

async function sample(page, label) {
  await page.getByLabel('Password').fill('Kiroween-2026');
  await page.getByRole('button', { name: 'Try a sample' }).click();
  await page.getByRole('button', { name: label }).click();
  await page.getByRole('navigation', { name: 'Main tabs' }).waitFor();
}

// 1. The crypt: the model loader with ghosts flying and the ectoplasm bar filling.
{
  const page = await open('loading', { width: 1100, height: 640 });
  await page.getByRole('button', { name: 'Download and start' }).click();
  await page.waitForTimeout(400);
  await record(page, 'crypt', 5200);
}

// 2. The ghost hand-writes a true, funny line about the user's books (positive sample).
{
  const page = await open('ready', { width: 1280, height: 720 });
  await sample(page, 'Sample that ends above zero');
  await page.waitForTimeout(150);
  await record(page, 'ghost-writes', 5600, { x: 120, y: 0, width: 1040, height: 190 });
}

// 3. Lights out: a ₹10 lakh hospital bill takes net worth below zero and the whole app turns dark.
{
  const said = 'Paid 10L for a hospital bill from HDFC Bank';
  const page = await open('ready', { width: 1280, height: 720 }, {
    [said]: { intent: 'expense', amount: '10L', date: '', fromAccount: 'HDFC Bank', toAccount: 'Other Expense' },
  });
  await sample(page, 'Sample that ends above zero');
  await page.waitForTimeout(5200); // let the first note finish writing
  await page.getByRole('navigation', { name: 'Main tabs' }).getByRole('button', { name: 'Daily Updates' }).click();
  const chat = page.getByRole('region', { name: 'Daily Updates chat' });
  await chat.getByLabel('Message').fill(said);
  await chat.getByRole('button', { name: 'Send' }).click();
  await chat.getByRole('button', { name: 'Confirm' }).waitFor();
  await page.waitForTimeout(300);
  const recording = record(page, 'lights-out', 7200);
  await page.waitForTimeout(1300);
  await chat.getByRole('button', { name: 'Confirm' }).click();
  await recording;
}

await browser.close();
