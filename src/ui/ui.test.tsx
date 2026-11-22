// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PromptHost } from '../chat/proposal';
import { formatDate, todayIso } from '../dates/dates';
import { buildSetup, differenceEquity, evaluateDraft, type DraftRow } from '../setup/setup';
import type { LoadedData } from '../store/repo';
import type { Vault } from '../store/vault';
import { AppShell } from './AppShell';

afterEach(cleanup);

const TODAY = todayIso();

function row(over: Partial<DraftRow>): DraftRow {
  return { id: Math.random().toString(36).slice(2), kind: 'asset', category: null, name: '', amountText: '', asOfText: '01/Jan/2020', ...over };
}

function world(replies: object[]) {
  const rows = [row({ name: 'Cash', amountText: '1,00,000' }), row({ kind: 'liability', name: 'Loan - Tom', amountText: '2,000' })];
  const first = evaluateDraft(rows, '', TODAY);
  const ev = evaluateDraft(rows, String(differenceEquity(first.assets, first.liabilities)), TODAY);
  const { accounts, ledger } = buildSetup(ev.lines, ev.equity, TODAY);
  const data: LoadedData = { accounts, ledger, budgets: new Map(), goals: new Map() };
  const saved: string[] = [];
  const vault = { putJson: async (k: string) => void saved.push(k) } as unknown as Vault;
  let n = 0;
  const prompts: string[] = [];
  const host: PromptHost = {
    prompt: async (input) => {
      prompts.push(input);
      return JSON.stringify(replies[Math.min(n++, replies.length - 1)]);
    },
  };
  function Harness() {
    // AppShell re-reads the mutable data after onChanged, so a state bump is enough to re-render.
    const [, bump] = useState(0);
    return <AppShell data={data} vault={vault} host={host} onChanged={() => bump((x) => x + 1)} />;
  }
  return { Harness, data, saved, prompts };
}

const expense = { intent: 'expense', amount: '800', date: 'yesterday', fromAccount: 'Cash', toAccount: 'Food' };
const budget = { intent: 'set-budget', amount: '8000', date: '', fromAccount: '', toAccount: 'Food' };
const goal = { intent: 'set-goal', amount: '3L', date: 'Dec 2037', fromAccount: 'Safety net', toAccount: 'Savings' };

const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main tabs' })).getByRole('button', { name });
const panel = (name: string) => screen.getByRole('region', { name });

async function say(chat: string, text: string) {
  const box = within(panel(chat)).getByLabelText('Message');
  fireEvent.change(box, { target: { value: text } });
  fireEvent.submit(box.closest('form')!);
}

describe('the six tabs', () => {
  it('shows all six tabs, the dashboard first, and the right list in each', () => {
    const { Harness } = world([expense]);
    render(<Harness />);
    for (const name of ['Dashboard', 'Assets', 'Liabilities', 'Goals', 'Budgets', 'Daily Updates']) {
      expect(tab(name)).toBeTruthy();
    }
    expect(screen.getByText('Net worth', { selector: 'p' })).toBeTruthy();
    // Inactive tabs are hidden, so open each one before looking inside it.
    fireEvent.click(tab('Assets'));
    expect(within(screen.getByRole('table', { name: 'Assets' })).getByText('Cash')).toBeTruthy();
    fireEvent.click(tab('Liabilities'));
    expect(within(screen.getByRole('table', { name: 'Liabilities' })).getByText('Loan - Tom')).toBeTruthy();
    fireEvent.click(tab('Goals'));
    expect(screen.getByText(/No goals yet/)).toBeTruthy();
    fireEvent.click(tab('Budgets'));
    expect(screen.getByText(/No budgets yet/)).toBeTruthy();
  });

  it('Daily Updates: chat, confirm, entry listed with an IST DD/MMM/YYYY date, then reverse it', async () => {
    const { Harness, data, saved } = world([expense]);
    render(<Harness />);
    fireEvent.click(tab('Daily Updates'));
    await say('Daily Updates chat', 'Paid Rs.800 for groceries yesterday');

    const confirm = await screen.findByRole('button', { name: 'Confirm' });
    expect(screen.getByText(/Please confirm/)).toBeTruthy();
    fireEvent.click(confirm);

    const list = await screen.findByRole('list', { name: 'Entries' });
    await waitFor(() => expect(within(list).getByText(/Paid ₹800 for Food from Cash/)).toBeTruthy());
    expect(saved.some((k) => k.startsWith('txn:'))).toBe(true);
    expect(data.ledger.entries.size).toBeGreaterThan(2);
    expect(within(list).getAllByText(/^\d{2}\/[A-Z][a-z]{2}\/\d{4}$/).length).toBeGreaterThan(0);
    expect(formatDate(TODAY)).toMatch(/^\d{2}\/[A-Z][a-z]{2}\/\d{4}$/);

    fireEvent.click(within(list).getAllByRole('button', { name: 'Reverse' })[0]);
    const reverseBtn = within(list).getByRole('button', { name: 'Reverse entry' }) as HTMLButtonElement;
    expect(reverseBtn.disabled).toBe(true); // a reason is required
    fireEvent.change(within(list).getByLabelText('Reason for reversal'), { target: { value: 'paid twice' } });
    fireEvent.click(reverseBtn);
    await waitFor(() => expect(within(list).getByText('(reversed)')).toBeTruthy());
    expect(within(list).getByText(/\[reversal\]/)).toBeTruthy();
  });

  it('Dashboard: two Sankeys, seven chart tabs, a date range, and live updates after an entry', async () => {
    const { Harness } = world([{ ...expense, date: '' }]);
    render(<Harness />);
    // Both Sankeys start empty, then fill in once an entry is confirmed.
    expect(screen.getByRole('img', { name: 'Actual Sankey: no activity in this period' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Planned Sankey: no activity in this period' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Date range' })).toBeTruthy();
    expect((screen.getByLabelText('From date') as HTMLInputElement).value).toMatch(/^01\/[A-Z][a-z]{2}\/\d{4}$/);

    fireEvent.click(tab('Daily Updates'));
    await say('Daily Updates chat', 'Paid Rs.800 for groceries today');
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await screen.findByRole('list', { name: 'Entries' });
    fireEvent.click(tab('Dashboard'));
    await waitFor(() => expect(screen.getByRole('img', { name: /^Actual Sankey, total ₹800$/ })).toBeTruthy());
    expect(screen.getAllByText(/Food ₹800/).length).toBeGreaterThan(0);

    const charts = within(screen.getByRole('navigation', { name: 'Charts' })).getAllByRole('button');
    expect(charts.map((b) => b.textContent)).toEqual([
      'Income vs Expense vs Budget', 'Savings, Investments and Goals', 'Net worth', 'Expense breakdown',
      'Budget utilisation', 'Goal progress', 'Liabilities summary',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Expense breakdown' }));
    expect(within(screen.getByRole('list', { name: 'Expense breakdown' })).getByText('Food')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Liabilities summary' }));
    expect(within(screen.getByRole('list', { name: 'Liabilities' })).getByText('Loan - Tom')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Net worth' }));
    expect(screen.getByRole('img', { name: 'Net worth at each month end' })).toBeTruthy();
  });

  it('Dashboard: a bad date range is explained and the last good range stays', () => {
    const { Harness } = world([expense]);
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '31/Feb/2026' } });
    expect(screen.getByText('Enter both dates as DD/MMM/YYYY (IST).')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '01/Jan/2030' } });
    expect(screen.getByText('The start date must not be after the end date.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Budgets: chat sets a budget and the list shows spending against it', async () => {
    const { Harness } = world([budget, expense]);
    render(<Harness />);
    fireEvent.click(tab('Budgets'));
    await say('Budgets chat', 'Set a monthly budget of 8000 for Food');
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Budgets' })).toBeTruthy());
    expect(within(screen.getByRole('list', { name: 'Budgets' })).getByText(/of ₹8,000/)).toBeTruthy();
  });

  it('Goals: chat sets a goal on the Savings account and the list shows progress', async () => {
    const { Harness } = world([goal]);
    render(<Harness />);
    fireEvent.click(tab('Goals'));
    await say('Goals chat', 'Save 3L for a safety net by Dec 2037');
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    const list = await screen.findByRole('list', { name: 'Goals' });
    expect(within(list).getByText(/₹0 of ₹3,00,000/)).toBeTruthy();
    expect(within(list).getByText(/31\/Dec\/2037/)).toBeTruthy();
    expect(within(list).getByText(/Saved in Savings/)).toBeTruthy();
  });

  it('a message that belongs to another tab offers a switch, and moving it opens a card there', async () => {
    const { Harness } = world([expense]);
    render(<Harness />);
    fireEvent.click(tab('Liabilities'));
    await say('Liabilities chat', 'Paid Rs.800 for groceries yesterday');
    const sw = await screen.findByRole('button', { name: 'Switch to Daily Updates' });
    fireEvent.click(sw);
    await waitFor(() => expect(within(panel('Daily Updates chat')).getByRole('button', { name: 'Confirm' })).toBeTruthy());
  });

  it('the Confirm Card blocks Confirm until the details are valid (no paise)', async () => {
    const { Harness } = world([{ ...expense, amount: '800.50' }]);
    render(<Harness />);
    fireEvent.click(tab('Daily Updates'));
    await say('Daily Updates chat', 'Paid 800 for groceries');
    const confirm = (await screen.findByRole('button', { name: 'Confirm' })) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false); // the app read 800 from the message, ignoring the model's text
    fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '800.50' } });
    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Whole rupees only/)).toBeTruthy();
  });
});
