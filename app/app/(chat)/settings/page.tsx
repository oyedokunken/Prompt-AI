"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile, providerLabel } from "@/lib/hooks/useUserProfile";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Upload, Loader2, X } from "lucide-react";
import type { ChatSession, SidebarPanel } from "@/lib/types/chat";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, refresh } = useUserProfile();

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("history");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });
    setSessions((data as ChatSession[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    if (!profile) return;
    loadSessions();
  }, [profile, loadSessions]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError(null);

      const file = e.target.files?.[0];
      if (!file || !profile) return;

      if (file.size > 2 * 1024 * 1024) {
        setError("File size must be less than 2MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("File must be an image");
        return;
      }

      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatar")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("avatar")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await refresh();
    } catch {
      setError("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await supabase.auth.updateUser({ data: { avatar_url: null } });
      await refresh();
    } catch {
      setError("Failed to remove avatar");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!profile) {
    return <div className="h-screen bg-base" />;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-base">
      <Sidebar
        sessions={sessions}
        activeSessionId={undefined}
        panel={sidebarPanel}
        onPanelChange={setSidebarPanel}
        onNewChat={() => router.push("/dashboard")}
        onSelectSession={() => router.push("/dashboard")}
        onDeleteSession={async (id) => {
          await supabase.from("chat_sessions").delete().eq("id", id);
          setSessions((prev) => prev.filter((s) => s.id !== id));
        }}
        onExport={() => {}}
        onCopyMarkdown={() => {}}
        username={profile.username}
        avatarUrl={profile.avatarUrl}
        onSettings={() => {}}
        onSignOut={() => setShowLogoutConfirm(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-surface shrink-0">
          <span className="font-mono text-[11px] text-text-faint">Settings</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-semibold text-text-primary mb-6">Account Settings</h1>

            {/* Avatar section */}
            <div className="rounded-xl border border-border bg-surface p-6 mb-6">
              <h2 className="text-sm font-medium text-text-primary mb-4">Profile picture</h2>

              <div className="flex items-start gap-6">
                <div className="relative">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-accent font-mono text-2xl border border-border">
                      {profile.username[0]?.toUpperCase()}
                    </div>
                  )}
                  {profile.avatarUrl && (
                    <button
                      onClick={handleRemoveAvatar}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-raised border border-border flex items-center justify-center text-text-faint hover:text-text-muted transition-colors"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-sm text-text-muted mb-3">
                    Upload a profile picture. This will be visible across the app.
                  </p>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-[11px] font-medium text-accent hover:bg-accent/15 transition-colors cursor-pointer">
                      {uploading ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={12} />
                          Upload image
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>

                    <span className="text-[10px] text-text-faint">Max 2MB</span>
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 mt-2">{error}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Account section */}
            <div className="rounded-xl border border-border bg-surface p-6">
              <h2 className="text-sm font-medium text-text-primary mb-4">Account</h2>
              <dl className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-text-muted">Email</dt>
                  <dd className="text-text-primary font-mono text-xs">{profile.email}</dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-text-muted">Signed in with</dt>
                  <dd className="text-text-primary">{providerLabel(profile.provider)}</dd>
                </div>
                {profile.createdAt && (
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-text-muted">Member since</dt>
                    <dd className="text-text-primary">
                      {new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="text-xs text-text-faint mt-4">
                Email address is managed through your authentication provider.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showLogoutConfirm}
        title="Sign out"
        description="You will need to log in again to access your chats."
        confirmLabel="Sign out"
        danger
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
