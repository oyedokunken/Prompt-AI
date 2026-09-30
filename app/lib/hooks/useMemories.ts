"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserMemory, MemoryCandidate } from "@/lib/types/chat";

export function useMemories() {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_memories")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[useMemories] refresh failed:", error);
      setLoading(false);
      return;
    }
    setMemories((data as UserMemory[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (
      category: string,
      key: string,
      value: string,
      source: UserMemory["source"] = "manual",
      confidence = 1.0
    ): Promise<UserMemory | null> => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_memories")
        .insert({ user_id: user.id, category, key, value, source, confidence })
        .select()
        .single();
      if (error) {
        console.error("[useMemories] add failed:", error);
        return null;
      }
      const memory = data as UserMemory;
      setMemories((prev) => [memory, ...prev]);
      return memory;
    },
    []
  );

  const addCandidates = useCallback(
    async (candidates: MemoryCandidate[]) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const rows = candidates.map((c) => ({
        user_id: user.id,
        category: c.category,
        key: c.key,
        value: c.value,
        source: "conversation" as const,
        confidence: c.confidence ?? 0.8,
      }));
      const { data, error } = await supabase.from("user_memories").insert(rows).select();
      if (error) {
        console.error("[useMemories] addCandidates failed:", error);
        return;
      }
      setMemories((prev) => [...((data as UserMemory[]) ?? []), ...prev]);
    },
    []
  );

  const update = useCallback(async (id: string, key: string, value: string, category: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("user_memories")
      .update({ key, value, category, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[useMemories] update failed:", error);
      return;
    }
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, key, value, category } : m)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("user_memories").delete().eq("id", id);
    if (error) {
      console.error("[useMemories] remove failed:", error);
      return;
    }
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("user_memories").delete().eq("user_id", user.id);
    if (error) {
      console.error("[useMemories] clearAll failed:", error);
      return;
    }
    setMemories([]);
  }, []);

  return { memories, loading, refresh, add, addCandidates, update, remove, clearAll };
}
