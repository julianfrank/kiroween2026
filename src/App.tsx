import { useEffect, useMemo, useRef, useState } from 'react';
import { createReadiness, type LanguageModelLike, type ReadinessState, type SessionLike } from './ai/readiness';
import { IndexedDbKV } from './store/kv';
import type { Vault } from './store/vault';
import { PasswordScreen } from './ui/PasswordScreen';
import { Readiness } from './ui/Readiness';

export function App() {
  const [state, setState] = useState<ReadinessState>({ step: 'checking' });
  const [vault, setVault] = useState<Vault | null>(null);
  const sessionRef = useRef<SessionLike | null>(null);
  const kv = useMemo(() => new IndexedDbKV(), []);

  const readiness = useMemo(
    () =>
      createReadiness(
        'LanguageModel' in globalThis ? (LanguageModel as unknown as LanguageModelLike) : undefined,
        setState,
        (session) => {
          sessionRef.current = session;
        },
      ),
    [],
  );

  useEffect(() => {
    void readiness.check();
    const destroy = () => sessionRef.current?.destroy();
    window.addEventListener('pagehide', destroy);
    return () => window.removeEventListener('pagehide', destroy);
  }, [readiness]);

  if (state.step !== 'ready') {
    return <Readiness state={state} onStart={() => void readiness.start()} />;
  }
  if (!vault) return <PasswordScreen kv={kv} onUnlocked={setVault} />;

  // Task 6 adds Setup here, then the main app.
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>Unlocked</h1>
      <p>The store is open. Setup comes next.</p>
    </main>
  );
}
