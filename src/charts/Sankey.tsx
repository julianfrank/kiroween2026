import { sankey, sankeyLeft, sankeyLinkHorizontal } from 'd3-sankey';
import { formatRupees } from '../money/money';
import type { NodeKind, SankeyData } from './data';

export const KIND_COLOR: Record<NodeKind, string> = {
  income: '#2e7d32',
  valuation: '#7b1fa2',
  borrowed: '#ef6c00',
  drawn: '#8d6e63',
  hub: '#546e7a',
  expense: '#c62828',
  saving: '#1565c0',
  repayment: '#ad1457',
  kept: '#00838f',
  budget: '#f9a825',
  goal: '#00897b',
  gap: '#d84315',
  unallocated: '#9e9e9e',
};

const W = 520;
const H = 340;
const PAD = { left: 8, right: 8, top: 8, bottom: 8 };

export function SankeyChart({ data, title }: { data: SankeyData; title: string }) {
  if (data.nodes.length === 0) {
    return (
      <div role="img" aria-label={`${title}: no activity in this period`} style={{ padding: 24, opacity: 0.7 }}>
        No activity in this period.
      </div>
    );
  }

  const graph = sankey<{ id: string; name: string; kind: NodeKind }, { source: string; target: string; value: number }>()
    .nodeId((n) => n.id)
    .nodeAlign(sankeyLeft)
    .nodeWidth(14)
    .nodePadding(12)
    .extent([
      [PAD.left, PAD.top],
      [W - PAD.right, H - PAD.bottom],
    ])({
    nodes: data.nodes.map((n) => ({ ...n })),
    links: data.links.map((l) => ({ ...l })),
  });
  const path = sankeyLinkHorizontal();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, total ${formatRupees(data.total)}`} style={{ width: '100%', height: 'auto' }}>
      <g fill="none">
        {graph.links.map((l, i) => {
          const s = l.source as unknown as { name: string; kind: NodeKind };
          const t = l.target as unknown as { name: string; kind: NodeKind };
          const color = KIND_COLOR[s.kind === 'hub' ? t.kind : s.kind];
          return (
            <path key={i} d={path(l) ?? ''} stroke={color} strokeOpacity={0.35} strokeWidth={Math.max(1, l.width ?? 1)}>
              <title>{`${s.name} → ${t.name}: ${formatRupees(l.value)}`}</title>
            </path>
          );
        })}
      </g>
      <g>
        {graph.nodes.map((n) => {
          const x0 = n.x0 ?? 0;
          const x1 = n.x1 ?? 0;
          const y0 = n.y0 ?? 0;
          const y1 = n.y1 ?? 0;
          const left = x0 < W / 2;
          return (
            <g key={n.id}>
              <rect x={x0} y={y0} width={x1 - x0} height={Math.max(1, y1 - y0)} fill={KIND_COLOR[n.kind]}>
                <title>{`${n.name}: ${formatRupees(n.value ?? 0)}`}</title>
              </rect>
              <text
                x={left ? x1 + 6 : x0 - 6}
                y={(y0 + y1) / 2}
                dy="0.35em"
                textAnchor={left ? 'start' : 'end'}
                fontSize={11}
                fill="currentColor"
              >
                {n.name} {formatRupees(n.value ?? 0)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
