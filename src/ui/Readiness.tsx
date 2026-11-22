import type { ReadinessState } from '../ai/readiness';
import { KiroGhost } from '../theme/Crypt';

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
  const trouble = state.step === 'unsupported' || state.step === 'error';
  return (
    <main style={{ padding: 28, maxWidth: 560, margin: '0 auto' }}>
      <div className="sentry">
        <KiroGhost size={64} mood={trouble ? 'worried' : state.step === 'ready' ? 'cheer' : 'lantern'} />
      </div>
      <h1>Waking the on-device AI</h1>
      <p>Getting the on-device AI ready. Nothing leaves your computer.</p>

      {state.step === 'unsupported' && <p role="alert">{state.reason}</p>}
      {state.step === 'error' && <p role="alert">Something went wrong: {state.message}</p>}

      {state.step !== 'unsupported' && (
        <ol className="ritual-steps">
          {STEPS.map((label, i) => {
            const done = active > i;
            const current = active === i;
            const text = current && state.step === 'downloading' ? `${label} ${state.percent}%` : label;
            return (
              <li key={label} className={done ? 'done' : current ? 'current' : ''} style={{ opacity: done || current ? 1 : 0.45 }}>
                <span className="ritual-mark" aria-hidden="true">{done ? '✓' : ''}</span>
                <span>
                  <span className="visually-hidden">{done ? 'Done: ' : current ? 'Now: ' : 'Next: '}</span>
                  {text}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {state.step === 'downloading' && (
        <div className="ectoplasm" role="progressbar" aria-label="Model download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percent}>
          <div className="ectoplasm-fill" style={{ width: `${state.percent}%` }} />
          {[12, 34, 56, 78].map((left, i) => (
            <span key={left} className="bubble" style={{ left: `${Math.min(left, Math.max(0, state.percent - 4))}%`, animationDelay: `${i * 0.4}s` }} />
          ))}
        </div>
      )}

      {state.step === 'needs-download' && (
        <p>
          The AI model has to be downloaded first (several GB, one time). Use an unmetered connection.
          <br />
          <button onClick={onStart} style={{ marginTop: 10 }}>Download and start</button>
        </p>
      )}

      {state.step === 'error' && <button onClick={onStart}>Try again</button>}
      {state.step === 'ready' && (
        <p className="ready-burst">
          <KiroGhost size={34} mood="cheer" /> Ready to Work.
        </p>
      )}
    </main>
  );
}
