import { useEffect, useMemo, useState } from 'react';
import { AiHost } from './ai/host';
import {
  createPlainSession,
  createReadiness,
  type LanguageModelLike,
  type ReadinessState,
} from './ai/readiness';
import { IndexedDbKV } from './store/kv';
import { emptyTargets, loadAll, saveAll, saveSetup, type LoadedData } from './store/repo';
import { buildSample, type SampleKind } from './sample/sample';
import { createVault, nukeStore, type Vault } from './store/vault';
import { AppShell } from './ui/AppShell';
import { DataPanel } from './ui/DataPanel';
import { PasswordScreen } from './ui/PasswordScreen';
import { Readiness } from './ui/Readiness';
import { SetupScreen } from './ui/SetupScreen';
import { EntryStage } from './theme/Crypt';
import { todayIso } from './dates/dates';
import { appTitle, setAppTitle } from './ui/title';

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
    setData(null);
    setVault(null);
    setEpoch((e) => e + 1);
    void host.renew().catch(() => setState({ step: 'error', message: 'The AI could not restart.' }));
  };

  // Start New Database from the password screen: same as start over, then create the empty store.
  const onStartNew = async (password: string) => {
    host.destroy();
    await nukeStore(kv);
    const v = await createVault(kv, password);
    setData(null);
    setVault(v);
    setEpoch((e) => e + 1);
    void host.renew().catch(() => setState({ step: 'error', message: 'The AI could not restart.' }));
  };

  // Try a sample: like Start New Database, then fill the new store with a sample set of books.
  const onSample = async (password: string, kind: SampleKind) => {
    const sample = buildSample(kind, todayIso());
    host.destroy();
    await nukeStore(kv);
    const v = await createVault(kv, password);
    await saveAll(v, sample);
    setData(sample);
    setVault(v);
    setEpoch((e) => e + 1);
    void host.renew().catch(() => setState({ step: 'error', message: 'The AI could not restart.' }));
  };

  // The title turns friendly while net worth is above zero; before the books are open it stays scary.
  const inMainApp = state.step === 'ready' && vault !== null && data !== null && data.accounts.size > 0;
  const title = appTitle(inMainApp ? data!.ledger.netWorth(todayIso()) : null);
  useEffect(() => setAppTitle(title), [title]);

  if (state.step !== 'ready') {
    return (
      <EntryStage>
        <Readiness state={state} onStart={() => void readiness.start()} />
      </EntryStage>
    );
  }
  if (!vault) {
    return (
      <EntryStage>
        <PasswordScreen kv={kv} onUnlocked={setVault} onBeforeReplace={onBeforeReplace} onImported={onImported} onStartNew={onStartNew} onSample={onSample} />
      </EntryStage>
    );
  }
  if (!data) {
    return (
      <EntryStage>
        <main style={{ padding: 28, maxWidth: 420, margin: '0 auto' }}>Opening the crypt…</main>
      </EntryStage>
    );
  }

  if (data.accounts.size === 0) {
    return (
      <EntryStage>
      <SetupScreen
        onDone={async ({ accounts, ledger }) => {
          await saveSetup(vault, accounts, ledger.entries);
          setData({ accounts, ledger, ...emptyTargets() });
        }}
      />
      </EntryStage>
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
