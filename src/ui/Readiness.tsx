import type { ReadinessState } from '../ai/readiness';

const STEPS = ['Checking', 'Downloading model', 'Initializing model', 'Testing model', 'Ready to Work'] as const;

function activeIndex(s: ReadinessState): number {
  switch (s.step) {
    case 'checking':
    case 'needs-download':
      return 0;
    case 'downloading':
      return 1;
    case 'initializing':
      return 2;
    case 'testing':
      return 3;
    case 'ready':
      return 4;
    default:
      return -1;
  }
}

export function Readiness({ state, onStart }: { state: ReadinessState; onStart: () => void }) {
  const active = activeIndex(state);
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <h1>Scary Money Manager</h1>
      <p>Getting the on-device AI ready. Nothing leaves your computer.</p>

      {state.step === 'unsupported' && <p role="alert">{state.reason}</p>}
      {state.step === 'error' && <p role="alert">Something went wrong: {state.message}</p>}

      {state.step !== 'unsupported' && (
        <ol style={{ listStyle: 'none', padding: 0 }}>
          {STEPS.map((label, i) => {
            const done = active > i;
            const current = active === i;
            const text =
              current && state.step === 'downloading' ? `${label} ${state.percent}%` : label;
            return (
              <li key={label} style={{ opacity: done || current ? 1 : 0.4, margin: '8px 0' }}>
                {done ? '✔' : current ? '➤' : '○'} {text}
              </li>
            );
          })}
        </ol>
      )}

      {state.step === 'downloading' && (
        <progress value={state.percent} max={100} style={{ width: '100%' }} />
      )}

      {state.step === 'needs-download' && (
        <p>
          The AI model has to be downloaded first (several GB, one time). Use an unmetered
          connection.
          <br />
          <button onClick={onStart}>Download and start</button>
        </p>
      )}

      {state.step === 'error' && <button onClick={onStart}>Try again</button>}
      {state.step === 'ready' && <p>Ready to Work.</p>}
    </main>
  );
}
