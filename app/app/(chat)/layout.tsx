"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardProvider, useDashboard } from "@/lib/dashboard/DashboardContext";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { ConfirmModal } from "@/components/ConfirmModal";
import { roleLabel } from "@/lib/hooks/useUserProfile";

// Persistent authenticated shell: the sidebar is mounted here, once, and
// never unmounts or swaps its own content as the user moves between
// routes beneath it. Every dashboard-area route (the chat welcome view,
// an individual chat, media, exports, saved prompts, favorites, history,
// and settings) renders inside this same layout.
function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const {
    profile,
    sessions,
    requestDeleteSession,
    toggleSessionFavorite,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    showLogoutConfirm,
    setShowLogoutConfirm,
    handleSignOut,
    pendingDelete,
    cancelPendingDelete,
    confirmPendingDelete,
  } = useDashboard();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setCommandPaletteOpen]);

  const DELETE_COPY: Record<"session" | "saved-prompt", { title: string; verb: string }> = {
    session: { title: "Delete chat", verb: "delete this chat" },
    "saved-prompt": { title: "Delete saved prompt", verb: "delete this saved prompt" },
  };

  return (
    <div className="h-screen flex overflow-hidden bg-base">
      <Sidebar
        sessions={sessions}
        onNewChat={() => router.push("/dashboard")}
        onDeleteSession={requestDeleteSession}
        username={profile?.username ?? "User"}
        avatarUrl={profile?.avatarUrl ?? null}
        onSettings={() => router.push("/settings")}
        onSignOut={() => setShowLogoutConfirm(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        preferredName={profile?.preferredName}
        roleDisplay={roleLabel(profile?.role ?? null)}
        onToggleSessionFavorite={toggleSessionFavorite}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">{children}</div>

      <ConfirmModal
        open={showLogoutConfirm}
        title="Sign out"
        description="You will need to log in again to access your chats."
        confirmLabel="Sign out"
        danger
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete ? DELETE_COPY[pendingDelete.type].title : ""}
        description={pendingDelete ? `Are you sure you want to ${DELETE_COPY[pendingDelete.type].verb}, "${pendingDelete.label}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        danger
        onConfirm={confirmPendingDelete}
        onCancel={cancelPendingDelete}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        sessions={sessions}
        onSelectSession={(s) => router.push(`/dashboard/chats/${s.id}`)}
        onNewChat={() => router.push("/dashboard")}
        onSettings={() => router.push("/settings")}
        onSignOut={() => setShowLogoutConfirm(true)}
        onOpenSaved={() => router.push("/dashboard/saved-prompts")}
        onOpenFavorites={() => router.push("/dashboard/favorites")}
      />
    </div>
  );
}

export default function ChatAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  );
}
