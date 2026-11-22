import { useEffect, useRef, useState } from 'react';
import { todayIso } from '../dates/dates';
import type { LoadedData } from '../store/repo';
import { KiroGhost } from './Crypt';
import { holdMs, pickQuip, situation } from './quips';

export const CHAR_MS = 45;
export const ERASE_MS = 900;

type Phase = 'writing' | 'shown' | 'erasing';

function Quill() {
  return (
    <svg className="quill" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M21 3C13 4 7 9 4 18l2 1c1-3 3-6 5-8-1 3-2 5-2 8h1c4-4 9-10 11-16Z" fill="#f4f7ff" stroke="#c9d2ea" strokeWidth="1" />
      <path d="M4 18l-1 3" stroke="#2b2350" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A handwritten line about the user's real situation, written out letter by letter by a ghost with a quill.
 * When it is finished it stays for 120 to 240 seconds (at random), then fades and a new line is written.
 * A change of Net Worth State (crossing into Light, Twilight or Dark) rewrites it at once, so it is never wrong.
 */
export function GhostNote({ data, rng = Math.random }: { data: LoadedData; rng?: () => number }) {
  const s = situation(data, todayIso());
  const latest = useRef(s);
  latest.current = s;

  const [text, setText] = useState(() => pickQuip(s, rng));
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<Phase>('writing');
  const chars = Array.from(text);

  // Write one letter at a time.
  useEffect(() => {
    if (phase !== 'writing') return;
    if (shown >= chars.length) {
      setPhase('shown');
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), CHAR_MS);
    return () => clearTimeout(t);
  }, [phase, shown, chars.length]);

  // Rest for 120-240 s once fully written, then fade the ink away.
  useEffect(() => {
    if (phase !== 'shown') return;
    const t = setTimeout(() => setPhase('erasing'), holdMs(rng));
    return () => clearTimeout(t);
  }, [phase, rng]);

  // After the fade, the ghost writes a fresh line from the current situation.
  useEffect(() => {
    if (phase !== 'erasing') return;
    const t = setTimeout(() => {
      setText((prev) => pickQuip(latest.current, rng, prev));
      setShown(0);
      setPhase('writing');
    }, ERASE_MS);
    return () => clearTimeout(t);
  }, [phase, rng]);

  // Crossing into another Net Worth State rewrites the note straight away.
  const lastState = useRef(s.state);
  useEffect(() => {
    if (lastState.current === s.state) return;
    lastState.current = s.state;
    setText((prev) => pickQuip(latest.current, rng, prev));
    setShown(0);
    setPhase('writing');
  }, [s.state, rng]);

  const done = phase !== 'writing';
  return (
    <p className={`ghost-note phase-${phase}`} data-state={s.state}>
      <span className="visually-hidden" aria-live="polite">
        {done ? text : ''}
      </span>
      <span className="ghost-note-ink" aria-hidden="true">
        {chars.slice(0, shown).map((ch, i) => (
          <span key={i} className={i === shown - 1 && !done ? 'ink fresh' : 'ink'}>
            {ch}
          </span>
        ))}
        <span className={`ghost-scribe${done ? ' resting' : ''}`}>
          <KiroGhost size={24} mood={done ? 'cheer' : 'happy'} />
          <Quill />
        </span>
      </span>
    </p>
  );
}
