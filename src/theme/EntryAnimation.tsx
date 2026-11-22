import { useEffect } from 'react';
import { formatRupees } from '../money/money';
import type { EntryEvent } from './events';

export const ENTRY_ANIMATION_MS = 2600;

const COINS = [0, 1, 2, 3, 4];

/** A short scene for each saved entry: coins travel between the two accounts, then it fades away. */
export function EntryAnimation({ event, onDone }: { event: EntryEvent; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, ENTRY_ANIMATION_MS);
    return () => clearTimeout(t);
  }, [event.id, onDone]);

  const label = `${event.caption}: ${formatRupees(event.amount)}, ${event.from} to ${event.to}`;
  return (
    <div className={`entry-anim v-${event.variant}`} role="status" aria-label={label}>
      <div className="entry-anim-caption">
        {event.caption} <b>{formatRupees(event.amount)}</b>
      </div>
      <div className="entry-anim-stage">
        <div className="entry-anim-box from">{event.from}</div>
        <div className="entry-anim-lane">
          {event.variant === 'rise' && <span className="arrow up">▲</span>}
          {event.variant === 'fall' && <span className="arrow down">▼</span>}
          {(event.variant === 'flow' || event.variant === 'rain' || event.variant === 'poof') &&
            COINS.map((i) => (
              <span key={i} className="coin" style={{ animationDelay: `${i * 0.22}s` }} aria-hidden="true">
                ₹
              </span>
            ))}
        </div>
        <div className="entry-anim-box to">{event.to}</div>
      </div>
    </div>
  );
}
