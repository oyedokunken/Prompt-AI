"use client";

import { useId, useState } from "react";

export interface ChartPoint {
  label: string;
  // Null means there is nothing to show for this point. It becomes a gap in
  // the line, not a zero.
  value: number | null;
  // An extra line in the tooltip, for example an input and output split.
  detail?: string;
}

interface LineChartProps {
  points: ChartPoint[];
  format: (value: number | null) => string;
  color?: string;
  ariaLabel: string;
}

const W = 640;
const H = 220;
const PAD = { left: 44, right: 14, top: 14, bottom: 26 };

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const step = n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 3 ? 3 : n <= 5 ? 5 : 10;
  return step * pow;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return `${Math.round(n * 10) / 10}`;
}

// A line graph with hoverable points. Moving the pointer along it, or using
// the arrow keys, snaps to the nearest point and shows its exact value.
export function LineChart({ points, format, color = "rgb(var(--color-accent-fill))", ariaLabel }: LineChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId();

  const n = points.length;
  const max = niceMax(Math.max(...points.map((p) => p.value ?? 0), 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => (n === 1 ? PAD.left + innerW / 2 : PAD.left + (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - v / max) * innerH;

  // Lines are drawn in runs, a gap in the data ends one run and starts the next.
  const runs: { i: number; v: number }[][] = [];
  let current: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push({ i, v: p.value });
    }
  });
  if (current.length) runs.push(current);

  const hasData = points.some((p) => p.value !== null);
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const index = n === 1 ? 0 : Math.round(((px - PAD.left) / innerW) * (n - 1));
    setActive(Math.min(Math.max(index, 0), n - 1));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setActive((a) => Math.min((a ?? -1) + 1, n - 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max((a ?? n) - 1, 0));
    else if (e.key === "Escape") setActive(null);
  };

  const activePoint = active !== null ? points[active] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none select-none outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded"
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const gy = PAD.top + (1 - f) * innerH;
          return (
            <g key={f}>
              <line x1={PAD.left} x2={W - PAD.right} y1={gy} y2={gy} stroke="currentColor" className="text-border" strokeWidth="1" />
              <text x={PAD.left - 6} y={gy + 3} textAnchor="end" className="fill-text-faint" fontSize="10" fontFamily="var(--font-geist-mono, monospace)">
                {compact(max * f)}
              </text>
            </g>
          );
        })}

        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-text-faint" fontSize="9" fontFamily="var(--font-geist-mono, monospace)">
              {p.label}
            </text>
          ) : null
        )}

        {runs.map((run, r) => (
          <g key={r}>
            {run.length > 1 && (
              <path
                d={`${run.map((pt, k) => `${k === 0 ? "M" : "L"}${x(pt.i)},${y(pt.v)}`).join(" ")} L${x(run[run.length - 1].i)},${PAD.top + innerH} L${x(run[0].i)},${PAD.top + innerH} Z`}
                fill={`url(#${gradientId})`}
              />
            )}
            <polyline points={run.map((pt) => `${x(pt.i)},${y(pt.v)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}

        {points.map((p, i) =>
          p.value !== null ? <circle key={i} cx={x(i)} cy={y(p.value)} r={active === i ? 5 : 2.5} fill={color} stroke="rgb(var(--color-surface, 17 17 19))" strokeWidth="1.5" /> : null
        )}

        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        )}

        {!hasData && (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-text-faint" fontSize="12">
            No data in this range yet
          </text>
        )}
      </svg>

      {activePoint && active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-md border border-border bg-raised shadow-lg text-[13px] md:text-[11px] leading-tight whitespace-nowrap"
          style={{
            left: `${(x(active) / W) * 100}%`,
            top: 0,
            transform: `translate(${active > n / 2 ? "-105%" : "5%"}, 0)`,
          }}
        >
          <p className="text-text-faint font-mono">{activePoint.label}</p>
          <p className="text-text-primary font-semibold">{format(activePoint.value)}</p>
          {activePoint.detail && <p className="text-text-muted">{activePoint.detail}</p>}
        </div>
      )}
    </div>
  );
}
