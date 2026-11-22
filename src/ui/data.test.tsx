// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportWithCurrentPassword, parseEnvelope } from '../export/format';
import { TEMPLATE_FILE_NAME } from '../export/template';
import { buildSetup, differenceEquity, evaluateDraft, type DraftRow } from '../setup/setup';
import { MemoryKV } from '../store/kv';
import { saveSetup } from '../store/repo';
import { createVault, unlockVault } from '../store/vault';
import { DataPanel } from './DataPanel';

afterEach(cleanup);

const TODAY = '2026-11-22';
const IT = 100_000;

function row(over: Partial<DraftRow>): DraftRow {
  return { id: Math.random().toString(36).slice(2), kind: 'asset', category: null, name: '', amountText: '', asOfText: '01/Jan/2020', ...over };
}

async function store(password: string, name: string) {
  const rows = [row({ name, amountText: '1,00,000' })];
  const first = evaluateDraft(rows, '', TODAY);
  const ev = evaluateDraft(rows, String(differenceEquity(first.assets, first.liabilities)), TODAY);
  const { accounts, ledger } = buildSetup(ev.lines, ev.equity, TODAY);
  const kv = new MemoryKV();
  const vault = await createVault(kv, password, IT);
  await saveSetup(vault, accounts, ledger.entries);
  return { kv, vault };
}

function panel(s: Awaited<ReturnType<typeof store>>) {
  const save = vi.fn();
  const onBeforeReplace = vi.fn();
  const onImported = vi.fn();
  const onPasswordChanged = vi.fn();
  render(<DataPanel kv={s.kv} vault={s.vault} save={save} onBeforeReplace={onBeforeReplace} onImported={onImported} onPasswordChanged={onPasswordChanged} />);
  return { save, onBeforeReplace, onImported, onPasswordChanged };
}

describe('Data and password panel', () => {
  it('downloads the export template and an encrypted export file', async () => {
    const s = await store('pw', 'Cash');
    const { save } = panel(s);
    fireEvent.click(screen.getByRole('button', { name: 'Download the export template' }));
    expect(save.mock.calls[0][0]).toBe(TEMPLATE_FILE_NAME);
    expect(JSON.parse(save.mock.calls[0][1]).title).toContain('Export JSON Template');

    fireEvent.click(screen.getByRole('button', { name: 'Export file' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    const [name, body] = save.mock.calls[1];
    expect(name).toMatch(/^scary-money-manager-\d{4}-\d{2}-\d{2}\.json$/);
    expect(() => parseEnvelope(body)).not.toThrow();
    expect(body).not.toContain('Cash');
    expect(screen.getByText(/Every value in the file is encrypted/)).toBeTruthy();
  });

  it('a different file password must be typed twice', async () => {
    const s = await store('pw', 'Cash');
    const { save } = panel(s);
    fireEvent.click(screen.getByLabelText('a different password'));
    fireEvent.change(screen.getByLabelText('File password'), { target: { value: 'one' } });
    fireEvent.change(screen.getByLabelText('Repeat file password'), { target: { value: 'two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export file' }));
    expect(await screen.findByText('The two file passwords do not match.')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it('import asks for agreement before replacing, and a wrong password changes nothing', async () => {
    const a = await store('file-pw', 'Chennai');
    const fileText = JSON.stringify(await exportWithCurrentPassword(a.kv, a.vault));
    const b = await store('pw', 'Cash');
    const before = JSON.stringify([...b.kv.data]);
    const { onBeforeReplace, onImported } = panel(b);

    fireEvent.change(screen.getByLabelText('Export file'), { target: { files: [new File([fileText], 'export.json', { type: 'application/json' })] } });
    expect(await screen.findByText(/replaces everything/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Password of the file'), { target: { value: 'wrong' } });
    const importBtn = screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement;
    expect(importBtn.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/I understand/));
    expect(importBtn.disabled).toBe(false);

    fireEvent.click(importBtn);
    expect(await screen.findByText('Wrong password for this file. Nothing was changed.')).toBeTruthy();
    expect(JSON.stringify([...b.kv.data])).toBe(before);
    expect(onBeforeReplace).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Password of the file'), { target: { value: 'file-pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
    expect(onBeforeReplace).toHaveBeenCalledOnce();
    const [, data] = onImported.mock.calls[0];
    expect([...data.accounts.values()].some((x: { name: string }) => x.name === 'Chennai')).toBe(true);
    await expect(unlockVault(b.kv, 'file-pw')).resolves.toBeTruthy();
  });

  it('a file that is not an export is explained', async () => {
    const s = await store('pw', 'Cash');
    panel(s);
    fireEvent.change(screen.getByLabelText('Export file'), { target: { files: [new File(['{"hello":1}'], 'x.json')] } });
    expect((await screen.findByRole('alert')).textContent).toContain('cannot be imported');
  });

  it('changing the password checks the current one first', async () => {
    const s = await store('pw', 'Cash');
    const { onPasswordChanged } = panel(s);
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'nope' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'next' } });
    fireEvent.change(screen.getByLabelText('Repeat new password'), { target: { value: 'next' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Your current password is wrong. Nothing was changed.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(onPasswordChanged).toHaveBeenCalledOnce(), { timeout: 5000 });
    await expect(unlockVault(s.kv, 'next')).resolves.toBeTruthy();
  });
});
