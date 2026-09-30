"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MODELS } from "@/lib/types/chat";

export interface TrendPoint {
  label: string;
  value: number;
}

export interface UsageStats {
  totalPrompts: number;
  promptsTrend: TrendPoint[];
  averageScore: number | null;
  scoreTrend: TrendPoint[];
  modelBreakdown: { model: string; count: number }[];
  reportsExported: number;
  mediaAttached: number;
  loading: boolean;
}

function bucketByWeek(dates: Date[]): TrendPoint[] {
  const buckets = new Map<string, number>();
  for (const d of dates) {
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([key, value]) => ({
      label: new Date(key).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value,
    }));
}

function averageByWeek(entries: { date: Date; score: number }[]): TrendPoint[] {
  const buckets = new Map<string, number[]>();
  for (const { date, score } of entries) {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    const arr = buckets.get(key) ?? [];
    arr.push(score);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([key, scores]) => ({
      label: new Date(key).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    }));
}

// Aggregates real usage from the user's own sessions, messages, and export
// history so the settings Usage tab reflects what the account has actually
// done, not a placeholder.
export function useUsageStats(): UsageStats {
  const [stats, setStats] = useState<UsageStats>({
    totalPrompts: 0,
    promptsTrend: [],
    averageScore: null,
    scoreTrend: [],
    modelBreakdown: [],
    reportsExported: 0,
    mediaAttached: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const supabase = createClient();

      const [sessionsRes, messagesRes, exportsRes] = await Promise.all([
        supabase.from("chat_sessions").select("model"),
        supabase.from("messages").select("role, metadata, created_at"),
        supabase.from("export_history").select("id").then(
          (r) => r,
          () => ({ data: null, error: null })
        ),
      ]);

      if (cancelled) return;

      const messages = (messagesRes.data ?? []) as { role: string; metadata: Record<string, unknown>; created_at: string }[];
      const assistantMessages = messages.filter((m) => m.role === "assistant");
      const scored = assistantMessages
        .map((m) => ({ date: new Date(m.created_at), score: m.metadata?.score as number | undefined }))
        .filter((m): m is { date: Date; score: number } => typeof m.score === "number");

      const averageScore = scored.length
        ? Math.round(scored.reduce((s, v) => s + v.score, 0) / scored.length)
        : null;

      const sessions = (sessionsRes.data ?? []) as { model: string }[];
      const modelCounts = new Map<string, number>();
      for (const s of sessions) {
        modelCounts.set(s.model, (modelCounts.get(s.model) ?? 0) + 1);
      }
      const modelBreakdown = Array.from(modelCounts.entries())
        .map(([id, count]) => ({
          model: MODELS.find((m) => m.id === id)?.label ?? id,
          count,
        }))
        .sort((a, b) => b.count - a.count);

      const mediaAttached = messages.reduce(
        (total, m) => total + ((m.metadata?.attachments as unknown[] | undefined)?.length ?? 0),
        0
      );

      setStats({
        totalPrompts: assistantMessages.length,
        promptsTrend: bucketByWeek(assistantMessages.map((m) => new Date(m.created_at))),
        averageScore,
        scoreTrend: averageByWeek(scored),
        modelBreakdown,
        reportsExported: exportsRes.data?.length ?? 0,
        mediaAttached,
        loading: false,
      });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}
