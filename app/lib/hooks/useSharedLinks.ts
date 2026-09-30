"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SharedLink, ExportFormat } from "@/lib/types/chat";

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useSharedLinks() {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shared_links")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[useSharedLinks] refresh failed:", error);
      setLoading(false);
      return;
    }
    setLinks((data as SharedLink[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createLink = useCallback(
    async (sessionId: string, targetType: "session" | "export", exportFormat?: ExportFormat): Promise<SharedLink | null> => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("shared_links")
        .insert({
          user_id: user.id,
          session_id: sessionId,
          target_type: targetType,
          export_format: exportFormat ?? null,
          token: randomToken(),
        })
        .select()
        .single();
      if (error) {
        console.error("[useSharedLinks] createLink failed:", error);
        return null;
      }
      const link = data as SharedLink;
      setLinks((prev) => [link, ...prev]);
      return link;
    },
    []
  );

  const revoke = useCallback(async (id: string) => {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, revoked: true } : l)));
    const supabase = createClient();
    const { error } = await supabase.from("shared_links").update({ revoked: true }).eq("id", id);
    if (error) {
      console.error("[useSharedLinks] revoke failed:", error);
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, revoked: false } : l)));
    }
  }, []);

  return { links, loading, refresh, createLink, revoke };
}
