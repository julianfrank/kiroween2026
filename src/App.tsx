import { useEffect, useMemo, useRef, useState } from 'react';
import { createReadiness, type LanguageModelLike, type ReadinessState, type SessionLike } from './ai/readiness';
import { IndexedDbKV } from './store/kv';
import { loadAll, saveSetup, type LoadedData } from './store/repo';
import type { Vault } from './store/vault';
import { MainPlaceholder } from './ui/MainPlaceholder';
import { PasswordScreen } from './ui/PasswordScreen';
import { Readiness } from './ui/Readiness';
import { SetupScreen } from './ui/SetupScreen';

export function App() {
  const [state, setState] = useState<ReadinessState>({ step: 'checking' });
  const [vault, setVault] = useState<Vault | null>(null);
  const [data, setData] = useState<LoadedData | null>(null);
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

  useEffect(() => {
    if (vault) void loadAll(vault).then(setData);
  }, [vault]);

  if (state.step !== 'ready') {
    return <Readiness state={state} onStart={() => void readiness.start()} />;
  }
  if (!vault) return <PasswordScreen kv={kv} onUnlocked={setVault} />;
  if (!data) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</main>;

  if (data.accounts.size === 0) {
    return (
      <SetupScreen
        onDone={async ({ accounts, ledger }) => {
          await saveSetup(vault, accounts, ledger.entries);
          setData({ accounts, ledger });
        }}
      />
    );
  }
  return <MainPlaceholder data={data} />;
}
