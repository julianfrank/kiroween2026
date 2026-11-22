import { useEffect, useId, type ReactNode } from 'react';
import './crypt.css';

// The entry screens (model loader, password, opening balances) share one look of their own, "the crypt":
// a moonlit graveyard at night with Kiro-style ghosts flying through fog. It is always dark and does not
// follow net worth; the main app keeps its own Light, Twilight and Dark themes.

export type GhostMood = 'happy' | 'shy' | 'worried' | 'cheer' | 'sleepy' | 'lantern';

/**
 * An original drawing of a friendly ghost in the spirit of Kiro's mascot: a white dome with a wavy hem and
 * two tall dark eyes. It is not the official Kiro logo; drop the official file in here if you have it.
 */
export function KiroGhost({ size = 64, mood = 'happy', className = '' }: { size?: number; mood?: GhostMood; className?: string }) {
  const shine = `ghost-shine-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className={`kiro-ghost mood-${mood} ${className}`}
      width={size}
      height={size * 1.1}
      viewBox="0 0 100 110"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={shine} cx="38%" cy="28%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#eef3ff" />
          <stop offset="100%" stopColor="#d4dcf2" />
        </radialGradient>
      </defs>
      <g className="ghost-body">
        <path
          className="ghost-shape"
          d="M50 6C25 6 10 25 10 50v44c4 7 12 7 16 0 4 7 12 7 16 0 4 7 12 7 16 0 4 7 12 7 16 0 4 7 12 7 16 0V50C90 25 75 6 50 6Z"
          fill={`url(#${shine})`}
        />
        {mood === 'cheer' ? (
          <g fill="none" stroke="#1c1630" strokeWidth="5" strokeLinecap="round">
            <path d="M31 47q7-9 14 0" />
            <path d="M55 47q7-9 14 0" />
          </g>
        ) : mood === 'sleepy' ? (
          <g fill="none" stroke="#1c1630" strokeWidth="4" strokeLinecap="round">
            <path d="M31 47q7 6 14 0" />
            <path d="M55 47q7 6 14 0" />
          </g>
        ) : (
          <g className="ghost-eyes" fill="#1c1630">
            <ellipse cx="38" cy="45" rx={mood === 'worried' ? 5 : 6.5} ry={mood === 'worried' ? 7 : 10} />
            <ellipse cx="62" cy="45" rx={mood === 'worried' ? 5 : 6.5} ry={mood === 'worried' ? 7 : 10} />
            <circle cx="40" cy="40" r="2" fill="#fff" />
            <circle cx="64" cy="40" r="2" fill="#fff" />
          </g>
        )}
        {mood === 'worried' && <path d="M42 66q8-6 16 0" fill="none" stroke="#1c1630" strokeWidth="3.5" strokeLinecap="round" />}
        {mood === 'cheer' && <path d="M40 60q10 12 20 0Z" fill="#1c1630" />}
        <ellipse cx="27" cy="58" rx="5" ry="3" fill="#ffb3c7" opacity="0.55" />
        <ellipse cx="73" cy="58" rx="5" ry="3" fill="#ffb3c7" opacity="0.55" />
        {mood === 'shy' && (
          <g className="ghost-hands" fill="#f4f7ff" stroke="#c9d2ea" strokeWidth="1.5">
            <ellipse cx="38" cy="46" rx="12" ry="9" />
            <ellipse cx="62" cy="46" rx="12" ry="9" />
          </g>
        )}
        {mood === 'lantern' && (
          <g className="ghost-lantern">
            <path d="M84 60q6 6 6 14" fill="none" stroke="#c9d2ea" strokeWidth="2" />
            <rect x="84" y="74" width="12" height="16" rx="3" fill="#2b2418" stroke="#ffb347" strokeWidth="1.5" />
            <circle className="lantern-flame" cx="90" cy="82" r="4" fill="#ffcf5a" />
          </g>
        )}
      </g>
    </svg>
  );
}

const FLYERS: Array<{ size: number; mood: GhostMood }> = [
  { size: 74, mood: 'happy' },
  { size: 46, mood: 'happy' },
  { size: 58, mood: 'cheer' },
  { size: 36, mood: 'sleepy' },
  { size: 52, mood: 'happy' },
];

/** The moonlit graveyard behind every entry screen. Decorative only. */
export function CryptScene() {
  return (
    <div className="crypt-scene" aria-hidden="true">
      <div className="crypt-moon">
        <span className="crater c1" />
        <span className="crater c2" />
        <span className="crater c3" />
      </div>
      <div className="crypt-stars">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className="star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 55}%`, animationDelay: `${(i % 7) * 0.6}s` }} />
        ))}
      </div>
      <div className="fog f1" />
      <div className="fog f2" />
      {FLYERS.map((f, i) => (
        <div key={i} className={`flyer fly-${i + 1}`}>
          <div className="flyer-bob">
            <KiroGhost size={f.size} mood={f.mood} />
          </div>
        </div>
      ))}
      <svg className="crypt-ground" viewBox="0 0 1200 160" preserveAspectRatio="xMidYMax slice">
        <path d="M0 120 Q150 90 300 112 T600 104 T900 116 T1200 100 V160 H0Z" fill="#05090a" />
        <g fill="#0b1513" stroke="#1d3a33" strokeWidth="2">
          <path d="M110 120v-48a22 22 0 0 1 44 0v48Z" />
          <path d="M330 116v-34a16 16 0 0 1 32 0v34Z" />`n          <path d="M640 110v-30a14 14 0 0 1 28 0v30Z" />
          <path d="M780 118v-56a26 26 0 0 1 52 0v56Z" />
          <path d="M1010 112v-36h14v-12h12v12h14v36Z" />
        </g>
        <g fill="#1d3a33">
          <rect x="125" y="82" width="14" height="3" />
          <rect x="130" y="77" width="4" height="13" />
          <rect x="799" y="76" width="14" height="3" />
          <rect x="804" y="71" width="4" height="13" />
        </g>
      </svg>
      <div className="crypt-pumpkin">
        <svg viewBox="0 0 60 50" width="72" height="60">
          <ellipse cx="20" cy="30" rx="14" ry="16" fill="#d9480f" />
          <ellipse cx="40" cy="30" rx="14" ry="16" fill="#e8590c" />
          <ellipse cx="30" cy="30" rx="10" ry="17" fill="#f76707" />
          <rect x="27" y="8" width="6" height="8" rx="2" fill="#2b8a3e" />
          <g className="pumpkin-glow" fill="#ffd43b">
            <path d="M18 26l5 5h-7z" />
            <path d="M42 26l-5 5h7z" />
            <path d="M18 37q12 9 24 0l-4 1-2 3-3-3-3 3-3-3-3 3-3-3z" />
          </g>
        </svg>
      </div>
      <div className="embers">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="ember" style={{ left: `${4 + ((i * 61) % 92)}%`, animationDelay: `${(i * 0.7) % 9}s`, animationDuration: `${7 + (i % 5)}s` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Wraps an entry screen: sets the crypt theme on the page and draws the scene behind the content.
 * The main app's AppShell sets its own theme when it mounts.
 */
export function EntryStage({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.theme = 'crypt';
  }, []);
  return (
    <div className="crypt">
      <CryptScene />
      <div className="crypt-content">{children}</div>
    </div>
  );
}
