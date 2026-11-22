import { useEffect, useMemo, useState } from 'react';
import { AiHost } from './ai/host';
import {
  createPlainSession,
  createReadiness,
  type LanguageModelLike,
  type ReadinessState,
} from './ai/readiness';
import { IndexedDbKV } from './store/kv';
import { emptyTargets, loadAll, saveSetup, type LoadedData } from './store/repo';
import { nukeStore, type Vault } from './store/vault';
import { AppShell } from './ui/AppShell';
import { DataPanel } from './ui/DataPanel';
import { PasswordScreen } from './ui/PasswordScreen';
import { Readiness } from './ui/Readiness';
import { SetupScreen } from './ui/SetupScreen';

const lm: LanguageModelLike | undefined =
  'LanguageModel' in globalThis ? (LanguageModel as unknown as LanguageModelLike) : undefined;

export function App() {
  const [state, setState] = useState<ReadinessState>({ step: 'checking' });
  const [vault, setVault] = useState<Vault | null>(null);
  const [data, setData] = useState<LoadedData | null>(null);
  /** Bumped on import so every chat panel is rebuilt with an empty transcript. */
  const [epoch, setEpoch] = useState(0);
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

  // Import: the old AI session is destroyed before the store is replaced (onBeforeReplace), chat
  // transcripts are dropped, and a brand-new session is started for the imported data.
  const onBeforeReplace = () => host.destroy();
  const onImported = (v: Vault, d: LoadedData) => {
    setData(d);
    setVault(v);
    setEpoch((e) => e + 1);
    void host.renew().catch(() => setState({ step: 'error', message: 'The AI could not restart after the import.' }));
  };

  // Start over: forget the AI's memory first, then delete the whole store, then begin again at the password.
  const onNuke = async () => {
    host.destroy();
    await nukeStore(kv);
    delete document.documentElement.dataset.theme;
    setData(null);
    setVault(null);
    setEpoch((e) => e + 1);
    void host.renew().catch(() => setState({ step: 'error', message: 'The AI could not restart.' }));
  };

  if (state.step !== 'ready') {
    return <Readiness state={state} onStart={() => void readiness.start()} />;
  }
  if (!vault) return <PasswordScreen kv={kv} onUnlocked={setVault} onBeforeReplace={onBeforeReplace} onImported={onImported} onNuke={onNuke} />;
  if (!data) return <main style={{ padding: 24 }}>Loading…</main>;

  if (data.accounts.size === 0) {
    return (
      <SetupScreen
        onDone={async ({ accounts, ledger }) => {
          await saveSetup(vault, accounts, ledger.entries);
          setData({ accounts, ledger, ...emptyTargets() });
        }}
      />
    );
  }
  return (
    <AppShell
      key={epoch}
      data={data}
      vault={vault}
      host={host}
      onChanged={() => setData((d) => (d ? { ...d } : d))}
      dataPanel={
        <DataPanel
          kv={kv}
          vault={vault}
          onBeforeReplace={onBeforeReplace}
          onImported={onImported}
          onPasswordChanged={setVault}
          host={host}
          onNuke={onNuke}
        />
      }
    />
  );
}
