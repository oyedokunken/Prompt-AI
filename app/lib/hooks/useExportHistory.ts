"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ExportFormat } from "@/lib/types/chat";

export interface ExportRecord {
  id: string;
  session_id: string | null;
  session_title: string;
  format: ExportFormat;
  created_at: string;
}

export function useExportHistory() {
  const [records, setRecords] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("export_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRecords((data as ExportRecord[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, refresh };
}
