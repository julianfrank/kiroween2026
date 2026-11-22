import { useEffect, useState, type FormEvent } from 'react';
import { delayAfterFailures } from '../crypto/attempts';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '../crypto/password';
import { formatDate } from '../dates/dates';
import { importExportFile, parseEnvelope, type ExportEnvelope } from '../export/format';
import { ImportError } from '../export/validate';
import type { KV } from '../store/kv';
import type { LoadedData } from '../store/repo';
import { WrongPasswordError, hasVault, unlockVault, type Vault } from '../store/vault';
import { KiroGhost } from '../theme/Crypt';

type Panel = 'none' | 'upload' | 'new';

/**
 * One password field for every way in. Once the password is long enough the user can:
 * - Unlock the database in this browser (when there is one),
 * - Upload a new file (an export encrypted with this password), which replaces what is here,
 * - Start a new database with this password, which deletes what is here.
 */
export function PasswordScreen({
  kv,
  onUnlocked,
  onBeforeReplace,
  onImported,
  onStartNew,
}: {
  kv: KV;
  onUnlocked: (v: Vault) => void;
  onBeforeReplace: () => void;
  onImported: (v: Vault, d: LoadedData) => void;
  /** Deletes any existing database, then creates an empty one with this password. */
  onStartNew: (password: string) => Promise<void>;
}) {
  const [exists, setExists] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [panel, setPanel] = useState<Panel>('none');
  const [file, setFile] = useState<{ text: string; info: ExportEnvelope } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  /** The ghost covers its eyes while the password is typed, and shakes its head at a wrong one. */
  const [peeking, setPeeking] = useState(false);
  const [shakes, setShakes] = useState(0);

  useEffect(() => {
    void hasVault(kv).then(setExists);
  }, [kv]);

  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [waitUntil]);

  const waitSeconds = Math.max(0, Math.ceil((waitUntil - now) / 1000));
  const tooShort = passwordProblem(password);
  const blocked = busy || waitSeconds > 0;

  function wrong(text: string) {
    setShakes((s) => s + 1);
    const n = failures + 1;
    setFailures(n);
    setNow(Date.now());
    setWaitUntil(Date.now() + delayAfterFailures(n));
    setMessage(text);
  }

  async function run(action: () => Promise<void>, wrongText = 'Wrong password.') {
    if (blocked || tooShort) return;
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (err) {
      if (err instanceof WrongPasswordError) wrong(wrongText);
      else if (err instanceof ImportError) setMessage(`This file cannot be used. Nothing was changed. ${err.message}`);
      else setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const unlock = () =>
    run(async () => {
      const v = await unlockVault(kv, password);
      onUnlocked(v);
    });

  const upload = () =>
    run(async () => {
      if (!file) return;
      const { vault, data } = await importExportFile(kv, file.text, password, onBeforeReplace);
      onImported(vault, data);
    }, 'This password does not open the file. Nothing was changed.');

  const startNew = () =>
    run(async () => {
      if (repeat !== password) throw new Error('The two passwords do not match.');
      await onStartNew(password);
    });

  async function pick(f: File | undefined) {
    setMessage('');
    setFile(null);
    if (!f) return;
    try {
      const text = await f.text();
      setFile({ text, info: parseEnvelope(text) });
    } catch (e) {
      setMessage(`This file cannot be used: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (exists) void unlock();
  }

  if (exists === null) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ padding: 28, maxWidth: 480, margin: '0 auto' }}>
      <div key={shakes} className={`sentry${shakes ? ' react-shake' : ''}`}>
        <KiroGhost size={64} mood={shakes && message ? 'worried' : peeking && password ? 'shy' : 'happy'} />
      </div>
      <h1>Enter your password</h1>
      <p>
        This password encrypts every value you store or export. It is not saved anywhere, so{' '}
        <b>a forgotten password cannot be recovered.</b>
      </p>
      <p>{exists ? 'A database is stored in this browser.' : 'There is no database in this browser yet.'}</p>
      <form onSubmit={submit}>
        <input
          type="password"
          autoFocus
          aria-label="Password"
          autoComplete={exists ? 'current-password' : 'new-password'}
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setMessage('');
          }}
          onFocus={() => setPeeking(true)}
          onBlur={() => setPeeking(false)}
          style={{ width: '100%' }}
        />
        <div style={{ opacity: 0.75, fontSize: 13, margin: '4px 0 12px' }}>
          {tooShort ? `At least ${MIN_PASSWORD_LENGTH} characters.` : 'Choose what to do with this password.'}
        </div>

        {!tooShort && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {exists && (
              <button type="submit" disabled={blocked}>
                {busy ? 'Deriving key…' : waitSeconds > 0 ? `Try again in ${waitSeconds}s` : 'Unlock'}
              </button>
            )}
            <button type="button" aria-pressed={panel === 'upload'} onClick={() => { setPanel(panel === 'upload' ? 'none' : 'upload'); setMessage(''); }}>
              Upload new file
            </button>
            <button type="button" aria-pressed={panel === 'new'} onClick={() => { setPanel(panel === 'new' ? 'none' : 'new'); setMessage(''); }}>
              Start New Database
            </button>
          </div>
        )}
      </form>

      {!tooShort && panel === 'upload' && (
        <section aria-label="Upload new file" className="card" style={{ marginTop: 12 }}>
          <p>Choose an export file that was encrypted with this password.</p>
          <input type="file" accept=".json,application/json" aria-label="File to import" onChange={(e) => void pick(e.target.files?.[0])} />
          {file && (
            <>
              <p>
                File exported {formatDate(file.info.exportedAt.slice(0, 10))} with {Object.keys(file.info.items).length - 1} items.
              </p>
              {exists && (
                <p role="note" style={{ color: 'var(--warn)' }}>
                  This <b>replaces</b> the database in this browser with the file. Export it first if you want to keep it.
                </p>
              )}
              <button disabled={blocked} onClick={() => void upload()}>
                {busy ? 'Checking the file…' : waitSeconds > 0 ? `Try again in ${waitSeconds}s` : exists ? 'Replace with this file' : 'Open this file'}
              </button>
            </>
          )}
        </section>
      )}

      {!tooShort && panel === 'new' && (
        <section aria-label="Start New Database" className="card" style={{ marginTop: 12 }}>
          {exists && (
            <p role="note" style={{ color: 'var(--bad)' }}>
              This <b>deletes</b> the database in this browser: every account, entry, budget and goal. It cannot be undone.
            </p>
          )}
          <p>Type the password again so a typo cannot lock you out.</p>
          <input
            type="password"
            aria-label="Repeat password"
            placeholder="Repeat password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />{' '}
          <button disabled={blocked || repeat === ''} onClick={() => void startNew()}>
            {busy ? 'Creating…' : exists ? 'Delete and start new' : 'Create new database'}
          </button>
        </section>
      )}

      {message && <p role="alert">{message}</p>}
    </main>
  );
}
