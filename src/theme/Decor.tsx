import type { NetWorthState } from './theme';

// Decorative only: every piece is aria-hidden and never takes pointer events.

export function Pumpkin({ size = 36 }: { size?: number }) {
  return (
    <svg className="bob" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="14" cy="23" rx="10" ry="12" fill="#f08c00" />
      <ellipse cx="26" cy="23" rx="10" ry="12" fill="#f59f00" />
      <ellipse cx="20" cy="23" rx="7" ry="12.5" fill="#fd7e14" />
      <rect x="18" y="5" width="4" height="7" rx="1.5" fill="#2b8a3e" />
      <path d="M13 21l3 3-3 0zM27 21l-3 3 3 0z" fill="#3b2300" />
      <path d="M13 29q7 5 14 0" stroke="#3b2300" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Ghost({ size = 40 }: { size?: number }) {
  return (
    <svg className="bob" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 36V18a12 12 0 0 1 24 0v18l-4-3-4 3-4-3-4 3-4-3z" fill="#f1ecff" />
      <circle cx="15" cy="18" r="2.4" fill="#2b2350" />
      <circle cx="25" cy="18" r="2.4" fill="#2b2350" />
      <ellipse cx="20" cy="25" rx="2.4" ry="3" fill="#2b2350" />
    </svg>
  );
}

export function Bat({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 40 24" aria-hidden="true">
      <path
        className="flap"
        d="M20 8c2-4 6-6 12-5-2 2-2 4-1 6 2-1 5-1 8 1-4 0-6 2-7 5-1-2-3-3-5-3-1 3-3 5-7 7-4-2-6-4-7-7-2 0-4 1-5 3-1-3-3-5-7-5 3-2 6-2 8-1 1-2 1-4-1-6 6-1 10 1 12 5z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Cobweb({ corner }: { corner: 'tl' | 'tr' }) {
  return (
    <svg className={`cobweb ${corner}`} width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1" fill="none" opacity="0.55">
        <path d="M0 0L120 0M0 0L110 40M0 0L85 85M0 0L40 110M0 0L0 120" />
        <path d="M30 0Q26 26 0 30M60 0Q50 50 0 60M90 0Q74 74 0 90" />
      </g>
    </svg>
  );
}

/** Background scenery that matches the mood of the current Net Worth State. */
export function Ambient({ state }: { state: NetWorthState }) {
  return (
    <div className="ambient" aria-hidden="true" data-state={state}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`firefly f${i}`} />
      ))}
      {state !== 'light' && (
        <>
          <span className="fly-bat b0"><Bat /></span>
          <span className="fly-bat b1"><Bat size={26} /></span>
        </>
      )}
      {state === 'dark' && (
        <>
          <span className="fly-bat b2"><Bat size={40} /></span>
          <Cobweb corner="tl" />
          <Cobweb corner="tr" />
        </>
      )}
    </div>
  );
}
