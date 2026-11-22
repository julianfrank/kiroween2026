import { useEffect, useMemo, useState } from 'react';
import { AiHost } from './ai/host';
import {
  createPlainSession,
  createReadiness,
  type LanguageModelLike,
  type ReadinessState,
} from './ai/readiness';
import { IndexedDbKV } from './store/kv';
import { loadAll, saveSetup, type LoadedData } from './store/repo';
import type { Vault } from './store/vault';
import { MainPlaceholder } from './ui/MainPlaceholder';
import { PasswordScreen } from './ui/PasswordScreen';
import { Readiness } from './ui/Readiness';
import { SetupScreen } from './ui/SetupScreen';

const lm: LanguageModelLike | undefined =
  'LanguageModel' in globalThis ? (LanguageModel as unknown as LanguageModelLike) : undefined;

export function App() {
  const [state, setState] = useState<ReadinessState>({ step: 'checking' });
  const [vault, setVault] = useState<Vault | null>(null);
  const [data, setData] = useState<LoadedData | null>(null);
  const kv = useMemo(() => new IndexedDbKV(), []);
  const host = useMemo(() => new AiHost(() => createPlainSession(lm!)), []);

  const readiness = useMemo(
    () => createReadiness(lm, setState, (session) => host.adopt(session)),
    [host],
  );

  useEffect(() => {
    void readiness.check();
    const destroy = () => host.destroy();
    window.addEventListener('pagehide', destroy);
    return () => window.removeEventListener('pagehide', destroy);
  }, [readiness, host]);

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
  return (
    <MainPlaceholder
      data={data}
      vault={vault}
      host={host}
      onChanged={() => setData((d) => (d ? { ...d } : d))}
    />
  );
}
