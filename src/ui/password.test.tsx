// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportWithCurrentPassword } from '../export/format';
import { buildSetup, differenceEquity, evaluateDraft, type DraftRow } from '../setup/setup';
import { MemoryKV } from '../store/kv';
import { saveSetup } from '../store/repo';
import { createVault } from '../store/vault';
import { PasswordScreen } from './PasswordScreen';

afterEach(cleanup);
const TODAY = '2026-11-22';

async function store(password: string, name: string) {
  const rows: DraftRow[] = [{ id: 'r1', kind: 'asset', category: null, name, amountText: '1,00,000', asOfText: '01/Jan/2020' }];
  const first = evaluateDraft(rows, '', TODAY);
  const ev = evaluateDraft(rows, String(differenceEquity(first.assets, first.liabilities)), TODAY);
  const { accounts, ledger } = buildSetup(ev.lines, ev.equity, TODAY);
  const kv = new MemoryKV();
  const vault = await createVault(kv, password, 100_000);
  await saveSetup(vault, accounts, ledger.entries);
  return { kv, vault };
}

function screenFor(kv: MemoryKV) {
  const props = { onUnlocked: vi.fn(), onBeforeReplace: vi.fn(), onImported: vi.fn(), onStartNew: vi.fn(async () => {}) };
  render(<PasswordScreen kv={kv} {...props} />);
  return props;
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const btn = (name: string) => screen.queryByRole('button', { name });

describe('password screen', () => {
  it('shows the three choices only once the password is longer than six characters', async () => {
    const s = await store('secret-pw', 'Cash');
    screenFor(s.kv);
    await screen.findByText('A database is stored in this browser.');
    type('Password', 'sixsix');
    expect(screen.getByText('At least 7 characters.')).toBeTruthy();
    expect(btn('Unlock')).toBeNull();
    expect(btn('Upload new file')).toBeNull();
    expect(btn('Start New Database')).toBeNull();
    type('Password', 'seven77');
    expect(btn('Unlock')).toBeTruthy();
    expect(btn('Upload new file')).toBeTruthy();
    expect(btn('Start New Database')).toBeTruthy();
  });

  it('with no database there is nothing to unlock', async () => {
    screenFor(new MemoryKV());
    await screen.findByText('There is no database in this browser yet.');
    type('Password', 'long enough');
    expect(btn('Unlock')).toBeNull();
    expect(btn('Start New Database')).toBeTruthy();
  });

  it('Unlock opens the database, and a wrong password waits before the next try', async () => {
    const s = await store('secret-pw', 'Cash');
    const p = screenFor(s.kv);
    await screen.findByText('A database is stored in this browser.');
    type('Password', 'not-the-one');
    fireEvent.click(btn('Unlock')!);
    expect(await screen.findByText('Wrong password.')).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Try again in \d+s/ })).toBeTruthy();
    expect(p.onUnlocked).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 1100));
    type('Password', 'secret-pw');
    await waitFor(() => expect(btn('Unlock')).toBeTruthy());
    fireEvent.click(btn('Unlock')!);
    await waitFor(() => expect(p.onUnlocked).toHaveBeenCalledOnce());
  });

  it('Start New Database needs the password twice, warns about deleting, then hands over the password', async () => {
    const s = await store('secret-pw', 'Cash');
    const p = screenFor(s.kv);
    await screen.findByText('A database is stored in this browser.');
    type('Password', 'brand-new-pw');
    fireEvent.click(btn('Start New Database')!);
    expect(screen.getByText(/deletes/)).toBeTruthy();
    type('Repeat password', 'brand-new-px');
    fireEvent.click(btn('Delete and start new')!);
    expect(await screen.findByText('The two passwords do not match.')).toBeTruthy();
    expect(p.onStartNew).not.toHaveBeenCalled();
    type('Repeat password', 'brand-new-pw');
    fireEvent.click(btn('Delete and start new')!);
    await waitFor(() => expect(p.onStartNew).toHaveBeenCalledWith('brand-new-pw'));
  });

  it('Upload new file uses the same password, and replaces the database only when it opens the file', async () => {
    const a = await store('file-password', 'Chennai');
    const text = JSON.stringify(await exportWithCurrentPassword(a.kv, a.vault));
    const b = await store('secret-pw', 'Cash');
    const before = JSON.stringify([...b.kv.data]);
    const p = screenFor(b.kv);
    await screen.findByText('A database is stored in this browser.');
    type('Password', 'secret-pw');
    fireEvent.click(btn('Upload new file')!);
    fireEvent.change(screen.getByLabelText('File to import'), { target: { files: [new File([text], 'export.json')] } });
    expect(await screen.findByText(/replaces/)).toBeTruthy();
    fireEvent.click(btn('Replace with this file')!);
    expect(await screen.findByText('This password does not open the file. Nothing was changed.')).toBeTruthy();
    expect(JSON.stringify([...b.kv.data])).toBe(before);
    expect(p.onBeforeReplace).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 1100));
    type('Password', 'file-password');
    await waitFor(() => expect(btn('Replace with this file')).toBeTruthy());
    fireEvent.click(btn('Replace with this file')!);
    await waitFor(() => expect(p.onImported).toHaveBeenCalledOnce());
    expect(p.onBeforeReplace).toHaveBeenCalledOnce();
  });
});
