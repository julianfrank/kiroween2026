import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FILE = pathToFileURL(resolve('dist/index.html')).href;
const PASSWORD = 'Smoke-test #1';

/** Replies the fake model gives, keyed by the user's message. */
const REPLIES: Record<string, object> = {
  'Paid Rs.800 for groceries yesterday': { intent: 'expense', amount: 'Rs.800', date: 'yesterday', fromAccount: 'Cash', toAccount: 'Food' },
  'Paid 50000 for rent': { intent: 'expense', amount: '50000', date: '', fromAccount: 'Cash', toAccount: 'Rent' },
};

/** Installs a fake Prompt API before the app's script runs. It answers from REPLIES. */
async function fakeAi(context: BrowserContext) {
  await context.addInitScript((replies: Record<string, object>) => {
    const w = window as unknown as { __prompts: string[]; __destroyed: number };
    w.__prompts = [];
    w.__destroyed = 0;
    const session = () => ({
      contextUsage: 0,
      contextWindow: 100000,
      async prompt(input: string) {
        w.__prompts.push(input);
        if (/single word: ready/.test(input)) return 'ready';
        const m = /Message: (".*")$/m.exec(input);
        const message = m ? (JSON.parse(m[1]) as string) : '';
        return JSON.stringify(replies[message] ?? { intent: 'other', amount: '', date: '', fromAccount: '', toAccount: '' });
      },
      destroy() {
        w.__destroyed++;
      },
    });
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      writable: true,
      value: { availability: async () => 'available', create: async () => session() },
    });
  }, REPLIES);
}

/** Fails the test if the page tries to reach the network: the app must be fully offline. */
function noNetwork(page: Page, seen: string[]) {
  page.on('request', (r) => {
    if (!/^(file|blob|data):/.test(r.url())) seen.push(r.url());
  });
}

async function setUp(page: Page) {
  await page.goto(FILE);
  await expect(page.getByText('There is no database in this browser yet.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'crypt');
  await expect(page.locator('.crypt-scene .flyer')).toHaveCount(5);
  const header = page.getByRole('banner', { name: 'About this app' });
  await expect(header).toBeVisible();
  await expect(header.getByText('Scary Money Manager')).toBeVisible(); // books not open yet
  await expect(header).toHaveCSS('position', 'fixed');
  await expect(header.getByRole('link', { name: /Made with Kiro/ })).toHaveAttribute('href', 'https://kiro.dev');
  await expect(header.getByText(/^v\d+\.\d+\.\d+/)).toBeVisible();
  await page.getByPlaceholder('Password', { exact: true }).fill('short');
  await expect(page.getByRole('button', { name: 'Start New Database' })).toHaveCount(0); // 7 characters minimum
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Start New Database' }).click();
  await page.getByPlaceholder('Repeat password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create new database' }).click();

  await expect(page.getByRole('heading', { name: 'Set up your opening balances' })).toBeVisible();
  await page.getByPlaceholder('House, Bank, Cash').fill('Cash');
  await page.getByPlaceholder('40L, 5,00,000').first().fill('50,000');
  await page.getByPlaceholder('Home loan, Card').fill('Loan - Tom');
  await page.getByPlaceholder('40L, 5,00,000').nth(1).fill('10,000');
  await expect(page.getByText('Imbalance: ₹40,000')).toBeVisible();
  await page.getByRole('button', { name: 'Use difference' }).click();
  await expect(page.getByText('Imbalance: ₹0')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('navigation', { name: 'Main tabs' })).toBeVisible();
}

async function say(page: Page, tab: string, message: string) {
  await page.getByRole('navigation', { name: 'Main tabs' }).getByRole('button', { name: tab }).click();
  const chat = page.getByRole('region', { name: `${tab} chat` });
  await chat.getByLabel('Message').fill(message);
  await chat.getByRole('button', { name: 'Send' }).click();
  await chat.getByRole('button', { name: 'Confirm' }).click();
}

test('the single file runs the whole flow offline: setup, chat, theme, charts, export, reload, import', async ({ browser }) => {
  const seen: string[] = [];
  const context = await browser.newContext();
  await fakeAi(context);
  const page = await context.newPage();
  noNetwork(page, seen);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await setUp(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const banner = page.getByRole('banner', { name: 'About this app' });
  await expect(banner).toBeVisible(); // the header stays on the main app too
  await expect(banner.getByText('My Money Manager')).toBeVisible(); // net worth is positive

  // A chat entry: proposed, confirmed, saved, animated, listed with an IST DD/MMM/YYYY date.
  await say(page, 'Daily Updates', 'Paid Rs.800 for groceries yesterday');
  const entries = page.getByRole('list', { name: 'Entries' });
  await expect(entries.getByText(/Paid ₹800 for Food from Cash/)).toBeVisible();
  await expect(entries.getByText(/^\d{2}\/[A-Z][a-z]{2}\/\d{4}$/).first()).toBeVisible();
  await expect(page.getByRole('status', { name: /Money spent: ₹800, Cash to Food/ })).toBeVisible();
  const prompt = await page.evaluate(() => (window as unknown as { __prompts: string[] }).__prompts.at(-1)!);
  expect(prompt).toContain('Indian Standard Time');

  // Spending more than the net worth turns the lights out at once.
  await say(page, 'Daily Updates', 'Paid 50000 for rent');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.ghost-note')).toHaveAttribute('data-state', 'dark');
  await expect(banner.getByText('Scary Money Manager')).toBeVisible(); // net worth went below zero
  await expect(page).toHaveTitle('Scary Money Manager');

  // The dashboard shows the Actual Sankey for this month.
  await page.getByRole('navigation', { name: 'Main tabs' }).getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByRole('img', { name: /^Actual Sankey, total/ })).toBeVisible();

  // Export: one encrypted file, with no names or amounts in it.
  await page.getByRole('navigation', { name: 'Main tabs' }).getByRole('button', { name: 'Data and password' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export file' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^scary-money-manager-\d{4}-\d{2}-\d{2}\.json$/);
  const file = readFileSync(await download.path(), 'utf8');
  expect(JSON.parse(file).format).toBe('scary-money-manager-export');
  for (const secret of ['Cash', 'Loan - Tom', 'Food', 'Kiroween2026', PASSWORD]) expect(file).not.toContain(secret);

  // Reload: the data is still there behind the password.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Enter your password' })).toBeVisible();
  await page.getByPlaceholder('Password', { exact: true }).fill('not it at all');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('Wrong password.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Try again in \d+s/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('navigation', { name: 'Main tabs' }).getByRole('button', { name: 'Daily Updates' }).click();
  await expect(page.getByRole('list', { name: 'Entries' }).getByText(/Paid ₹800 for Food from Cash/)).toBeVisible();

  // Import into a clean profile, from the password screen.
  const clean = await browser.newContext();
  await fakeAi(clean);
  const fresh = await clean.newPage();
  noNetwork(fresh, seen);
  await fresh.goto(FILE);
  await fresh.getByPlaceholder('Password', { exact: true }).fill('wrong-password');
  await fresh.getByRole('button', { name: 'Upload new file' }).click();
  await fresh.getByLabel('File to import').setInputFiles({ name: 'export.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await fresh.getByRole('button', { name: 'Open this file' }).click();
  await expect(fresh.getByText('This password does not open the file. Nothing was changed.')).toBeVisible();
  await fresh.waitForTimeout(1200);
  await fresh.getByPlaceholder('Password', { exact: true }).fill(PASSWORD);
  await fresh.getByRole('button', { name: 'Open this file' }).click();
  await expect(fresh.getByRole('navigation', { name: 'Main tabs' })).toBeVisible();
  await expect(fresh.locator('html')).toHaveAttribute('data-theme', 'dark');
  const destroyed = await fresh.evaluate(() => (window as unknown as { __destroyed: number }).__destroyed);
  expect(destroyed).toBeGreaterThanOrEqual(1); // the AI session was destroyed on import
  await fresh.getByRole('navigation', { name: 'Main tabs' }).getByRole('button', { name: 'Daily Updates' }).click();
  await expect(fresh.getByRole('list', { name: 'Entries' }).getByText(/Paid ₹50,000 for Rent from Cash/)).toBeVisible();

  // Start over from the Data and password tab: back to a fresh password and empty books.
  await fresh.getByRole('navigation', { name: 'Main tabs' }).getByRole('button', { name: 'Data and password' }).click();
  await fresh.getByLabel('Type DELETE to confirm').fill('DELETE');
  await fresh.getByRole('button', { name: 'Delete everything and start fresh' }).click();
  await expect(fresh.getByText('There is no database in this browser yet.')).toBeVisible();
  await fresh.getByPlaceholder('Password', { exact: true }).fill('brand new');
  await fresh.getByRole('button', { name: 'Start New Database' }).click();
  await fresh.getByPlaceholder('Repeat password').fill('brand new');
  await fresh.getByRole('button', { name: 'Create new database' }).click();
  await expect(fresh.getByRole('heading', { name: 'Set up your opening balances' })).toBeVisible();

  // Forgot the password: Start New Database deletes the old one and starts empty.
  await page.reload();
  await page.getByPlaceholder('Password', { exact: true }).fill('a new start');
  await page.getByRole('button', { name: 'Start New Database' }).click();
  await expect(page.getByText(/deletes/)).toBeVisible();
  await page.getByPlaceholder('Repeat password').fill('a new start');
  await page.getByRole('button', { name: 'Delete and start new' }).click();
  await expect(page.getByRole('heading', { name: 'Set up your opening balances' })).toBeVisible();

  expect(seen).toEqual([]);
  expect(errors).toEqual([]);
  await clean.close();
  await context.close();
});

test('both samples open straight into a full set of books', async ({ browser }) => {
  for (const [label, theme, title] of [
    ['Sample that ends below zero', 'dark', 'Scary Money Manager'],
    ['Sample that ends above zero', 'light', 'My Money Manager'],
  ] as const) {
    const context = await browser.newContext();
    await fakeAi(context);
    const page = await context.newPage();
    await page.goto(FILE);
    await page.getByPlaceholder('Password', { exact: true }).fill('sample-password');
    await page.getByRole('button', { name: 'Try a sample' }).click();
    await page.getByRole('button', { name: label }).click();
    await expect(page.getByRole('navigation', { name: 'Main tabs' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByRole('banner', { name: 'About this app' }).getByText(title)).toBeVisible();
    await expect(page.getByRole('img', { name: /^Actual Sankey, total/ })).toBeVisible();
    const tab = (name: string) => page.getByRole('navigation', { name: 'Main tabs' }).getByRole('button', { name });
    await tab('Daily Updates').click();
    await expect(page.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(32); // 7 opening + 25
    await tab('Budgets').click();
    await expect(page.getByRole('list', { name: 'Budgets' }).getByRole('listitem').first()).toBeVisible();
    await tab('Goals').click();
    await expect(page.getByRole('list', { name: 'Goals' }).getByRole('listitem').first()).toBeVisible();
    await page.reload();
    await page.getByPlaceholder('Password', { exact: true }).fill('sample-password');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByRole('navigation', { name: 'Main tabs' })).toBeVisible();
    await context.close();
  }
});

test('a browser without the Prompt API gets a clear message', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    delete (window as unknown as { LanguageModel?: unknown }).LanguageModel;
  });
  const page = await context.newPage();
  await page.goto(FILE);
  await expect(page.getByRole('alert')).toContainText('Open this file in Google Chrome');
  await context.close();
});
