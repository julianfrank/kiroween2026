import { useState, type FormEvent } from 'react';
import { formatDate } from '../dates/dates';
import { downloadText, type SaveFile } from '../export/download';
import {
  exportFileName,
  exportWithCurrentPassword,
  exportWithNewPassword,
  importExportFile,
  parseEnvelope,
  type ExportEnvelope,
} from '../export/format';
import { TEMPLATE_FILE_NAME, buildTemplate } from '../export/template';
import { ImportError } from '../export/validate';
import { passwordProblem } from '../crypto/password';
import type { PromptHost } from '../chat/proposal';
import { GoldenCheck } from './GoldenCheck';
import type { KV } from '../store/kv';
import type { LoadedData } from '../store/repo';
import { WrongPasswordError, changePassword, type Vault } from '../store/vault';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Pick a file, check it, and replace everything in the browser with it. Used here and on the password screen. */
export function ImportForm({
  kv,
  replacing,
  onBeforeReplace,
  onImported,
}: {
  kv: KV;
  /** True when the browser already holds data that the import will replace. */
  replacing: boolean;
  onBeforeReplace: () => void;
  onImported: (vault: Vault, data: LoadedData) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [info, setInfo] = useState<ExportEnvelope | null>(null);
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function pick(file: File | undefined) {
    setMessage('');
    setInfo(null);
    setText(null);
    if (!file) return;
    try {
      const t = await file.text();
      setInfo(parseEnvelope(t));
      setText(t);
    } catch (e) {
      setMessage(`This file cannot be imported: ${errText(e)}`);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { vault, data } = await importExportFile(kv, text, password, onBeforeReplace);
      setPassword('');
      onImported(vault, data);
    } catch (err) {
      if (err instanceof WrongPasswordError) setMessage('Wrong password for this file. Nothing was changed.');
      else if (err instanceof ImportError) setMessage(`This file cannot be imported. Nothing was changed. ${err.message}`);
      else setMessage(`Import failed: ${errText(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const count = info ? Object.keys(info.items).length - 1 : 0;
  return (
    <form onSubmit={submit} aria-label="Import">
      <p>
        <input type="file" accept=".json,application/json" aria-label="File to import" onChange={(e) => void pick(e.target.files?.[0])} />
      </p>
      {info && (
        <p>
          File exported {formatDate(info.exportedAt.slice(0, 10))} with {count} items.
        </p>
      )}
      {info && replacing && (
        <p role="note" style={{ color: 'var(--warn)' }}>
          Importing <b>replaces everything</b> stored in this browser: accounts, entries, budgets and goals. The file's
          password becomes your password, and the AI's memory is cleared. Export first if you want to keep what is here.
          <br />
          <label>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> I understand, replace my data
          </label>
        </p>
      )}
      {info && (
        <p>
          <input
            type="password"
            aria-label="Password of the file"
            placeholder="Password of the file"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />{' '}
          <button type="submit" disabled={busy || password === '' || (replacing && !agreed)}>
            {busy ? 'Checking the file…' : 'Import'}
          </button>
        </p>
      )}
      {message && <p role="alert">{message}</p>}
    </form>
  );
}

export const NUKE_WORD = 'DELETE';

/** Wipe everything in this browser: entries, accounts, budgets, goals and the password. */
export function NukeForm({ onNuke }: { onNuke: () => Promise<void> }) {
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <div>
      <p style={{ color: 'var(--bad)' }}>
        This permanently deletes every account, entry, budget and goal stored in this browser, and the password. The app
        then starts fresh: you choose a new password and do Setup again. It cannot be undone, so export first if you
        might want the data back.
      </p>
      <input
        aria-label={`Type ${NUKE_WORD} to confirm`}
        placeholder={`Type ${NUKE_WORD} to confirm`}
        value={word}
        onChange={(e) => setWord(e.target.value)}
      />{' '}
      <button
        disabled={word !== NUKE_WORD || busy}
        onClick={async () => {
          setBusy(true);
          setMessage('');
          try {
            await onNuke();
          } catch (e) {
            setMessage(`Could not delete the data: ${errText(e)}`);
            setBusy(false);
          }
        }}
      >
        {busy ? 'Deleting…' : 'Delete everything and start fresh'}
      </button>
      {message && <p role="alert">{message}</p>}
    </div>
  );
}

export function DataPanel({  kv,
  vault,
  onBeforeReplace,
  onImported,
  onPasswordChanged,
  save = downloadText,
  host,
  onNuke,
}: {
  kv: KV;
  vault: Vault;
  onBeforeReplace: () => void;
  onImported: (vault: Vault, data: LoadedData) => void;
  onPasswordChanged: (vault: Vault) => void;
  save?: SaveFile;
  /** When given, the panel offers the golden-sentence AI check. */
  host?: PromptHost;
  /** When given, the panel offers to delete everything and start fresh. */
  onNuke?: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'current' | 'new'>('current');
  const [filePw, setFilePw] = useState('');
  const [filePw2, setFilePw2] = useState('');
  const [exportMsg, setExportMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  async function doExport() {
    setExportMsg('');
    if (mode === 'new' && filePw !== filePw2) return setExportMsg('The two file passwords do not match.');
    if (mode === 'new' && passwordProblem(filePw)) return setExportMsg(`File password: ${passwordProblem(filePw)}`);
    setBusy(true);
    try {
      const env = mode === 'current' ? await exportWithCurrentPassword(kv, vault) : await exportWithNewPassword(vault, filePw);
      save(exportFileName(), JSON.stringify(env, null, 2));
      setFilePw('');
      setFilePw2('');
      setExportMsg(
        `Exported ${Object.keys(env.items).length - 1} items${mode === 'new' ? ' with the new file password' : ' with your current password'}. Every value in the file is encrypted.`,
      );
    } catch (e) {
      setExportMsg(`Export failed: ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doChange(e: FormEvent) {
    e.preventDefault();
    setPwMsg('');
    if (next !== next2) return setPwMsg('The two new passwords do not match.');
    if (passwordProblem(next)) return setPwMsg(`New password: ${passwordProblem(next)}`);
    setBusy(true);
    try {
      const v = await changePassword(kv, current, next);
      setCurrent('');
      setNext('');
      setNext2('');
      setPwMsg('Password changed. Every value was encrypted again with the new password.');
      onPasswordChanged(v);
    } catch (err) {
      setPwMsg(err instanceof WrongPasswordError ? 'Your current password is wrong. Nothing was changed.' : `Could not change the password: ${errText(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Data and password" className="card" style={{ margin: '12px 0' }}>
      <h2>Export</h2>
      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend>Encrypt the file with</legend>
        <label>
          <input type="radio" name="export-mode" checked={mode === 'current'} onChange={() => setMode('current')} /> my current password
        </label>{' '}
        <label>
          <input type="radio" name="export-mode" checked={mode === 'new'} onChange={() => setMode('new')} /> a different password
        </label>
      </fieldset>
      {mode === 'new' && (
        <p>
          <input type="password" aria-label="File password" placeholder="File password" value={filePw} onChange={(e) => setFilePw(e.target.value)} />{' '}
          <input type="password" aria-label="Repeat file password" placeholder="Repeat file password" value={filePw2} onChange={(e) => setFilePw2(e.target.value)} />
          <br />
          <small>Only the file uses this password. This browser keeps your current one.</small>
        </p>
      )}
      <p>
        <button onClick={() => void doExport()} disabled={busy}>Export file</button>{' '}
        <button onClick={() => save(TEMPLATE_FILE_NAME, JSON.stringify(buildTemplate(), null, 2))}>Download the export template</button>
      </p>
      {exportMsg && <p role="status">{exportMsg}</p>}

      <h2>Import</h2>
      <ImportForm kv={kv} replacing onBeforeReplace={onBeforeReplace} onImported={onImported} />

      <h2>Change password</h2>
      <form onSubmit={doChange} aria-label="Change password">
        <input type="password" aria-label="Current password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />{' '}
        <input type="password" aria-label="New password" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} />{' '}
        <input type="password" aria-label="Repeat new password" placeholder="Repeat new password" value={next2} onChange={(e) => setNext2(e.target.value)} />{' '}
        <button type="submit" disabled={busy}>{busy ? 'Working…' : 'Change password'}</button>
        <div><small>A forgotten password cannot be recovered.</small></div>
      </form>
      {pwMsg && <p role="status">{pwMsg}</p>}

      {host && (
        <>
          <h2>Check the AI</h2>
          <GoldenCheck host={host} />
        </>
      )}

      {onNuke && (
        <>
          <h2>Start over</h2>
          <NukeForm onNuke={onNuke} />
        </>
      )}
    </section>
  );
}
