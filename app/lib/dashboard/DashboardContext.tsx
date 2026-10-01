"use client";

import { createContext, useCallback, useContext, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile, type UserProfile } from "@/lib/hooks/useUserProfile";
import { useSavedPrompts } from "@/lib/hooks/useSavedPrompts";
import { useSharedLinks } from "@/lib/hooks/useSharedLinks";
import { useExportHistory, type ExportRecord } from "@/lib/hooks/useExportHistory";
import { useMemories } from "@/lib/hooks/useMemories";
import type { ChatSession, SavedPrompt, SharedLink, MemoryCandidate, ExportFormat, UserMemory } from "@/lib/types/chat";
import type { UploadedAttachment } from "@/lib/attachments";

type PendingDelete =
  | { type: "session"; id: string; label: string }
  | { type: "saved-prompt"; id: string; label: string }
  | null;

interface PendingFirstMessage {
  sessionId: string;
  content: string;
  attachments: UploadedAttachment[];
}

interface DashboardContextValue {
  // Profile
  profile: UserProfile | null;

  // Sessions (the sidebar's chat list, shared and kept in sync by every page)
  sessions: ChatSession[];
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  loadSessions: () => Promise<void>;
  createSession: (modelId: string) => Promise<ChatSession | null>;
  requestDeleteSession: (id: string) => void;
  toggleSessionFavorite: (id: string, next: boolean) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;

  // Saved prompts
  savedPrompts: SavedPrompt[];
  savePrompt: ReturnType<typeof useSavedPrompts>["save"];
  requestDeleteSavedPrompt: (id: string) => void;
  toggleSavedFavorite: (id: string, next: boolean) => Promise<void>;

  // Shared links
  sharedLinks: SharedLink[];
  createShareLink: ReturnType<typeof useSharedLinks>["createLink"];
  revokeShareLink: (id: string) => Promise<void>;

  // Export history
  exportHistory: ExportRecord[];
  refreshExportHistory: () => void;

  // Memory
  memories: UserMemory[];
  saveMemoryCandidates: (candidates: MemoryCandidate[]) => Promise<void>;

  // Handoff from the welcome page to the newly created chat route
  pendingFirstMessage: PendingFirstMessage | null;
  setPendingFirstMessage: (v: PendingFirstMessage | null) => void;

  // Chrome state shared across every page's own header
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  showLogoutConfirm: boolean;
  setShowLogoutConfirm: (v: boolean) => void;
  handleSignOut: () => Promise<void>;

  // Generalized delete confirmation, triggerable from the sidebar or any page
  pendingDelete: PendingDelete;
  cancelPendingDelete: () => void;
  confirmPendingDelete: () => Promise<void>;

  error: string | null;
  setError: (v: string | null) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const { profile } = useUserProfile();
  const { savedPrompts, save: savePrompt, remove: removeSavedPrompt, toggleFavorite: toggleSavedFavorite } = useSavedPrompts();
  const { links: sharedLinks, createLink: createShareLink, revoke: revokeShareLink } = useSharedLinks();
  const { records: exportHistory, refresh: refreshExportHistory } = useExportHistory();
  const { memories, addCandidates: saveMemoryCandidates } = useMemories();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<PendingFirstMessage | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const loadSessions = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });
    if (loadError) {
      console.error("[dashboard] loadSessions failed:", loadError);
      setError(`Could not load your chats: ${loadError.message}`);
      return;
    }
    setSessions((data as ChatSession[]) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Creates a session row and returns it, or null with setError already
  // called. Callers must check for null, a silent failure here is what
  // makes "nothing happens when I chat" look like the product is broken
  // instead of one failed insert.
  const createSession = useCallback(async (modelId: string): Promise<ChatSession | null> => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("[dashboard] createSession: no authenticated user", userError);
      setError("Your session has expired. Refresh the page and log in again.");
      return null;
    }
    const { data, error: insertError } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: "New Chat", model: modelId })
      .select()
      .single();
    if (insertError || !data) {
      console.error("[dashboard] createSession failed:", insertError);
      setError(`Could not start a new chat: ${insertError?.message ?? "unknown error"}`);
      return null;
    }
    const session = data as ChatSession;
    setSessions((prev) => [session, ...prev]);
    return session;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestDeleteSession = useCallback((id: string) => {
    const target = sessions.find((s) => s.id === id);
    setPendingDelete({ type: "session", id, label: target?.title ?? "this chat" });
  }, [sessions]);

  const requestDeleteSavedPrompt = useCallback((id: string) => {
    const target = savedPrompts.find((p) => p.id === id);
    setPendingDelete({ type: "saved-prompt", id, label: target?.title ?? "this saved prompt" });
  }, [savedPrompts]);

  const toggleSessionFavorite = useCallback(async (id: string, next: boolean) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, is_favorite: next } : s)));
    const { error: toggleError } = await supabase.from("chat_sessions").update({ is_favorite: next }).eq("id", id);
    if (toggleError) {
      console.error("[dashboard] toggleSessionFavorite failed:", toggleError);
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, is_favorite: !next } : s)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A title the user set themselves, marked custom so the auto-title logic
  // in /api/chat never overwrites it on a later turn.
  const renameSession = useCallback(async (id: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title, title_is_custom: true } : s)));
    const { error: renameError } = await supabase
      .from("chat_sessions")
      .update({ title, title_is_custom: true })
      .eq("id", id);
    if (renameError) {
      console.error("[dashboard] renameSession failed:", renameError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelPendingDelete = useCallback(() => setPendingDelete(null), []);

  const confirmPendingDelete = useCallback(async () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === "session") {
      const { error: deleteError } = await supabase.from("chat_sessions").delete().eq("id", pendingDelete.id);
      if (deleteError) {
        console.error("[dashboard] delete session failed:", deleteError);
        setError(`Could not delete that chat: ${deleteError.message}`);
      } else {
        setSessions((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      }
    } else {
      await removeSavedPrompt(pendingDelete.id);
    }
    setPendingDelete(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDelete, removeSavedPrompt]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: DashboardContextValue = {
    profile,
    sessions,
    setSessions,
    loadSessions,
    createSession,
    requestDeleteSession,
    toggleSessionFavorite,
    renameSession,
    savedPrompts,
    savePrompt,
    requestDeleteSavedPrompt,
    toggleSavedFavorite,
    sharedLinks,
    createShareLink,
    revokeShareLink,
    exportHistory,
    refreshExportHistory,
    memories,
    saveMemoryCandidates,
    pendingFirstMessage,
    setPendingFirstMessage,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    commandPaletteOpen,
    setCommandPaletteOpen,
    showLogoutConfirm,
    setShowLogoutConfirm,
    handleSignOut,
    pendingDelete,
    cancelPendingDelete,
    confirmPendingDelete,
    error,
    setError,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
