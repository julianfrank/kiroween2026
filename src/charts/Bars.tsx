import { formatRupees } from '../money/money';

export interface BarItem {
  label: string;
  value: number;
  /** The value that fills the whole bar. Defaults to the largest value. */
  of?: number;
  color?: string;
  note?: string;
}

/** Horizontal bars as plain HTML so they stay readable and accessible. */
export function Bars({ items, title }: { items: BarItem[]; title: string }) {
  if (items.length === 0) return <p style={{ opacity: 0.7 }}>Nothing to show yet.</p>;
  const max = Math.max(...items.map((i) => i.of ?? i.value), 1);
  return (
    <ul aria-label={title} style={{ listStyle: 'none', padding: 0 }}>
      {items.map((i) => {
        const full = i.of ?? max;
        const pct = Math.max(0, Math.min(100, (i.value / full) * 100));
        return (
          <li key={i.label} style={{ margin: '8px 0' }}>
            <div>
              <b>{i.label}</b> {formatRupees(i.value)}
              {i.note && <span style={{ opacity: 0.8 }}> {i.note}</span>}
            </div>
            <div style={{ background: 'rgba(128,128,128,0.2)', height: 12, borderRadius: 6, maxWidth: 420 }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: i.color ?? '#1565c0' }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
