"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MODELS } from "@/lib/types/chat";
import { LineChart, type ChartPoint } from "@/components/settings/LineChart";
import {
  METRICS, RANGES, buildSeries, describeSeries, formatValue, metricValue,
  type MetricId, type RangeId, type UsageMessage,
} from "@/lib/usageSeries";
import { cn } from "@/lib/utils";

const MAX_DAYS = 91;

interface UsageData {
  messages: UsageMessage[];
  models: { model: string; count: number }[];
  exports: number;
  files: number;
}

function useUsageData(): { data: UsageData | null; failed: boolean } {
  const [data, setData] = useState<UsageData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const since = new Date(Date.now() - MAX_DAYS * 86_400_000).toISOString();
      const [messagesRes, sessionsRes, exportsRes, mediaRes] = await Promise.all([
        supabase.from("messages").select("role, content, metadata, created_at").eq("role", "assistant").gte("created_at", since).order("created_at", { ascending: true }).limit(3000),
        supabase.from("chat_sessions").select("model"),
        supabase.from("export_history").select("id").then((r) => r, () => ({ data: null, error: null })),
        supabase.from("messages").select("metadata").eq("role", "user").not("metadata->attachments", "is", null).limit(2000),
      ]);
      if (cancelled) return;
      if (messagesRes.error) {
        console.error("[usage] load failed:", messagesRes.error);
        setFailed(true);
        return;
      }
      const counts = new Map<string, number>();
      for (const s of (sessionsRes.data ?? []) as { model: string }[]) counts.set(s.model, (counts.get(s.model) ?? 0) + 1);
      setData({
        messages: (messagesRes.data ?? []) as UsageMessage[],
        models: Array.from(counts.entries())
          .map(([id, count]) => ({ model: MODELS.find((m) => m.id === id)?.label ?? id, count }))
          .sort((a, b) => b.count - a.count),
        exports: exportsRes.data?.length ?? 0,
        files: ((mediaRes.data ?? []) as { metadata: { attachments?: unknown[] } }[]).reduce((n, m) => n + (m.metadata?.attachments?.length ?? 0), 0),
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, failed };
}

const COLORS: Record<MetricId, string> = {
  prompts: "rgb(var(--color-accent-fill))",
  tokens: "#8B7CF6",
  outputLength: "#0EA5E9",
  score: "#22C55E",
  questions: "#F59E0B",
  approval: "#14B8A6",
};

export function UsageTab() {
  const { data, failed } = useUsageData();
  const [range, setRange] = useState<RangeId>("7d");
  const [metric, setMetric] = useState<MetricId>("prompts");

  const rangeConfig = RANGES.find((r) => r.id === range)!;
  const series = useMemo(() => (data ? buildSeries(data.messages, range) : null), [data, range]);

  if (failed) return <p className="text-sm text-red-400">Could not load your usage. Try again in a moment.</p>;
  if (!data || !series) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 size={14} className="animate-spin" /> Loading your usage
      </div>
    );
  }

  const metricConfig = METRICS.find((m) => m.id === metric)!;
  const points: ChartPoint[] = series.buckets.map((b) => ({
    label: b.label,
    value: metricValue(b, metric),
    detail: metric === "tokens" && b.tokens ? `${b.promptTokens.toLocaleString()} in, ${b.completionTokens.toLocaleString()} out` : undefined,
  }));
  const untracked = series.assistantMessages - series.trackedMessages;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Usage</h1>
      <p className="text-sm text-text-muted mb-5">What Prompt AI has actually helped you do.</p>

      {/* Range filter */}
      <div role="tablist" aria-label="Time range" className="inline-flex rounded-lg border border-border bg-surface p-0.5 mb-4">
        {RANGES.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={range === r.id}
            onClick={() => setRange(r.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[13px] md:text-[11px] font-medium transition-colors",
              range === r.id ? "bg-accent-fill text-accent-fill-foreground" : "text-text-muted hover:text-text-primary"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <TrendingUp size={13} className="text-accent" />
          <h2 className="text-xs font-medium text-text-primary">In plain language</h2>
        </div>
        <p className="text-sm text-text-muted leading-relaxed">{describeSeries(series, rangeConfig.label)}</p>
      </div>

      {/* Metric tiles, each one selects what the graph shows */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
        {METRICS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMetric(m.id)}
            aria-pressed={metric === m.id}
            className={cn(
              "text-left rounded-xl border bg-surface p-3.5 transition-colors",
              metric === m.id ? "border-accent/50" : "border-border hover:border-border/70"
            )}
          >
            <p className="text-xs md:text-[10px] text-text-faint uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[m.id] }} />
              {m.label}
            </p>
            <p className="text-xl font-semibold text-text-primary">{formatValue(metricValue(series.totals, m.id), m.id)}</p>
          </button>
        ))}
      </div>

      {/* The graph */}
      <div className="rounded-xl border border-border bg-surface p-4 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-medium text-text-primary">{metricConfig.label} over the last {rangeConfig.label}</p>
          <p className="text-xs md:text-[10px] text-text-faint">{metricConfig.hint}</p>
        </div>
        <LineChart
          points={points}
          format={(v) => formatValue(v, metric)}
          color={COLORS[metric]}
          ariaLabel={`${metricConfig.label} over the last ${rangeConfig.label}. Move along the line to read exact values.`}
        />
        <p className="text-xs md:text-[10px] text-text-faint mt-2">
          Hover or use the arrow keys to read a point.{" "}
          {series.totals.tokenMessages > 0 && `Estimated model cost for this range: about $${series.totals.costUsd.toFixed(2)}.`}
        </p>
        {untracked > 0 && (
          <p className="text-xs md:text-[10px] text-text-faint mt-1">
            Token counts are only recorded on newer replies, so {untracked} earlier {untracked === 1 ? "reply is" : "replies are"} not included in the token totals.
          </p>
        )}
      </div>

      {/* Totals that are not time series */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="rounded-xl border border-border bg-surface p-3.5">
          <p className="text-xs md:text-[10px] text-text-faint uppercase tracking-wide mb-1">Reports exported</p>
          <p className="text-xl font-semibold text-text-primary">{data.exports}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3.5">
          <p className="text-xs md:text-[10px] text-text-faint uppercase tracking-wide mb-1">Files attached</p>
          <p className="text-xl font-semibold text-text-primary">{data.files}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-medium text-text-primary mb-3">Target models used</p>
        {data.models.length === 0 ? (
          <p className="text-xs md:text-[10px] text-text-faint">No chats yet.</p>
        ) : (
          <div className="space-y-2">
            {data.models.map(({ model, count }) => (
              <div key={model} className="flex items-center gap-3">
                <span className="text-xs text-text-muted w-32 truncate">{model}</span>
                <div className="flex-1 h-2 rounded-full bg-raised overflow-hidden">
                  <div className="h-full rounded-full bg-accent-fill" style={{ width: `${(count / data.models[0].count) * 100}%` }} />
                </div>
                <span className="text-xs text-text-faint font-mono w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
