import { useEffect, useState, type FormEvent } from 'react';
import { delayAfterFailures } from '../crypto/attempts';
import { WrongPasswordError, createVault, hasVault, unlockVault, type Vault } from '../store/vault';
import type { KV } from '../store/kv';

export function PasswordScreen({ kv, onUnlocked }: { kv: KV; onUnlocked: (v: Vault) => void }) {
  const [exists, setExists] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');

  useEffect(() => {
    void hasVault(kv).then(setExists);
  }, [kv]);

  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [waitUntil]);

  const waitSeconds = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || waitSeconds > 0 || exists === null) return;
    setMessage('');
    if (!exists && password !== confirm) return setMessage('The two passwords do not match.');
    if (!exists && password.length === 0) return setMessage('Choose a password.');
    setBusy(true);
    try {
      const vault = exists ? await unlockVault(kv, password) : await createVault(kv, password);
      setPassword('');
      setConfirm('');
      onUnlocked(vault);
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        const n = failures + 1;
        setFailures(n);
        setNow(Date.now());
        setWaitUntil(Date.now() + delayAfterFailures(n));
        setMessage('Wrong password.');
      } else {
        setMessage(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (exists === null) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</main>;

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 420, margin: '0 auto' }}>
      <h1>{exists ? 'Enter your password' : 'Choose a password'}</h1>
      <p>
        This password encrypts every value you store or export. It is not saved anywhere, so{' '}
        <b>a forgotten password cannot be recovered.</b>
      </p>
      <form onSubmit={submit}>
        <p>
          <input
            type="password"
            autoFocus
            autoComplete={exists ? 'current-password' : 'new-password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%' }}
          />
        </p>
        {!exists && (
          <p>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ width: '100%' }}
            />
          </p>
        )}
        <button type="submit" disabled={busy || waitSeconds > 0}>
          {busy
            ? 'Deriving key…'
            : waitSeconds > 0
              ? `Try again in ${waitSeconds}s`
              : exists
                ? 'Unlock'
                : 'Create'}
        </button>
      </form>
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
