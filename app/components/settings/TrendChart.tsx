"use client";

import type { TrendPoint } from "@/lib/hooks/useUsageStats";

interface TrendChartProps {
  points: TrendPoint[];
  color?: string;
}

// Minimal bar trend, deliberately dependency free since the data is small
// and the point is legibility, not a full charting library.
export function TrendChart({ points, color = "rgb(var(--color-accent-fill))" }: TrendChartProps) {
  if (points.length === 0) {
    return <p className="text-[10px] text-text-faint">Not enough data yet.</p>;
  }

  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className="flex items-end gap-1.5 h-16">
      {points.map((p, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full flex items-end justify-center h-12">
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${Math.max((p.value / max) * 100, 4)}%`,
                backgroundColor: color,
                opacity: 0.85,
              }}
              title={`${p.label}: ${p.value}`}
            />
          </div>
          <span className="text-[8px] text-text-faint font-mono truncate w-full text-center">
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}
