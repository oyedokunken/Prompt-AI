"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SavedPrompt, ChatMessage } from "@/lib/types/chat";

export function useSavedPrompts() {
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("saved_prompts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[useSavedPrompts] refresh failed:", error);
      setLoading(false);
      return;
    }
    setSavedPrompts((data as SavedPrompt[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (sessionId: string | null, message: ChatMessage): Promise<SavedPrompt | null> => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const title = message.content.split("\n")[0].replace(/^#+\s*/, "").slice(0, 80) || "Saved prompt";
      const { data, error } = await supabase
        .from("saved_prompts")
        .insert({
          user_id: user.id,
          session_id: sessionId,
          message_id: message.id.startsWith("temp-") ? null : message.id,
          title,
          content: message.content,
          score: message.metadata.score ?? null,
          assumptions: message.metadata.assumptions ?? [],
          structured: message.metadata.structured ?? {},
        })
        .select()
        .single();
      if (error) {
        console.error("[useSavedPrompts] save failed:", error);
        return null;
      }
      const saved = data as SavedPrompt;
      setSavedPrompts((prev) => [saved, ...prev]);
      return saved;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("saved_prompts").delete().eq("id", id);
    if (error) {
      console.error("[useSavedPrompts] remove failed:", error);
      return;
    }
    setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleFavorite = useCallback(async (id: string, next: boolean) => {
    setSavedPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, is_favorite: next } : p)));
    const supabase = createClient();
    const { error } = await supabase.from("saved_prompts").update({ is_favorite: next }).eq("id", id);
    if (error) {
      console.error("[useSavedPrompts] toggleFavorite failed:", error);
      setSavedPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, is_favorite: !next } : p)));
    }
  }, []);

  return { savedPrompts, loading, refresh, save, remove, toggleFavorite };
}
