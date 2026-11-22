import { extent, line, scaleLinear, scalePoint } from 'd3';
import { formatCompact, formatRupees } from '../money/money';
import type { TrendData } from './data';
import { C } from './palette';

const COLORS = [C.green, C.red, C.amber, C.purple, C.blue];
const W = 640;
const H = 280;
const M = { top: 12, right: 16, bottom: 28, left: 56 };

export function LineChart({ data, title }: { data: TrendData; title: string }) {
  const all = data.series.flatMap((s) => s.values);
  if (data.labels.length === 0 || all.every((v) => v === 0)) {
    return <p role="img" aria-label={`${title}: no data yet`} style={{ opacity: 0.7 }}>No data in this period yet.</p>;
  }
  const [lo = 0, hi = 0] = extent(all);
  const y = scaleLinear().domain([Math.min(0, lo), Math.max(0, hi)]).nice().range([H - M.bottom, M.top]);
  const x = scalePoint<string>().domain(data.labels).range([M.left, W - M.right]);
  const path = line<number>().x((_, i) => x(data.labels[i]) ?? 0).y((v) => y(v));
  const ticks = y.ticks(5);

  return (
    <div>
      <ul aria-label="Legend" style={{ listStyle: 'none', display: 'flex', gap: 16, flexWrap: 'wrap', padding: 0 }}>
        {data.series.map((s, i) => (
          <li key={s.name}>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: COLORS[i % COLORS.length], marginRight: 6 }} />
            {s.name}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} style={{ width: '100%', height: 'auto' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={t === 0 ? 0.5 : 0.12} />
            <text x={M.left - 6} y={y(t)} dy="0.35em" textAnchor="end" fontSize={10} fill="currentColor">
              {formatCompact(t)}
            </text>
          </g>
        ))}
        {data.labels.map((l, i) =>
          i % 2 === (data.labels.length - 1) % 2 ? (
            <text key={l} x={x(l)} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor">
              {l}
            </text>
          ) : null,
        )}
        {data.series.map((s, i) => (
          <g key={s.name} style={{ stroke: COLORS[i % COLORS.length], fill: COLORS[i % COLORS.length] }}>
            <path d={path(s.values) ?? ''} fill="none" strokeWidth={2} />
            {s.values.map((v, j) => (
              <circle key={j} cx={x(data.labels[j])} cy={y(v)} r={3}>
                <title>{`${s.name}, ${data.labels[j]}: ${formatRupees(v)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
