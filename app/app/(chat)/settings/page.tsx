"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile, providerLabel, roleLabel, ROLE_OPTIONS } from "@/lib/hooks/useUserProfile";
import { useUsageStats } from "@/lib/hooks/useUsageStats";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { TrendChart } from "@/components/settings/TrendChart";
import { Upload, Loader2, X, Pencil, Check, FileText, Paperclip, TrendingUp } from "lucide-react";
import type { ChatSession, SidebarPanel } from "@/lib/types/chat";

type SettingsTab = "profile" | "usage";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, refresh } = useUserProfile();
  const usage = useUsageStats();
  const { theme } = useTheme();

  const [tab, setTab] = useState<SettingsTab>("profile");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("history");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

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

  const handleRoleChange = async (role: string) => {
    setSavingRole(true);
    try {
      await supabase.auth.updateUser({ data: { role } });
      await refresh();
      setEditingRole(false);
    } catch {
      setError("Failed to update role");
    } finally {
      setSavingRole(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const buildSummary = (): string => {
    if (usage.totalPrompts === 0) {
      return "You have not generated any prompts yet. Start a conversation to see your usage here.";
    }
    const topModel = usage.modelBreakdown[0]?.model;
    const parts: string[] = [
      `You have generated ${usage.totalPrompts} structured prompt${usage.totalPrompts === 1 ? "" : "s"}`,
    ];
    if (usage.averageScore !== null) {
      parts.push(`averaging a completeness score of ${usage.averageScore} out of 100`);
    }
    if (topModel) {
      parts.push(`mostly targeting ${topModel}`);
    }
    let text = parts.join(", ") + ".";
    if (usage.reportsExported > 0 || usage.mediaAttached > 0) {
      const bits: string[] = [];
      if (usage.reportsExported > 0) bits.push(`exported ${usage.reportsExported} report${usage.reportsExported === 1 ? "" : "s"}`);
      if (usage.mediaAttached > 0) bits.push(`attached ${usage.mediaAttached} file${usage.mediaAttached === 1 ? "" : "s"} for context`);
      text += ` You have also ${bits.join(" and ")}.`;
    }
    return text;
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
          <ThemeToggle size={13} className="w-7 h-7" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6 gap-1 shrink-0">
          {([
            { id: "profile", label: "Profile" },
            { id: "usage", label: "Usage" },
          ] as { id: SettingsTab; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === id
                  ? "text-text-primary border-accent"
                  : "text-text-muted border-transparent hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {tab === "profile" && (
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

              {/* Appearance */}
              <div className="rounded-xl border border-border bg-surface p-6 mb-6">
                <h2 className="text-sm font-medium text-text-primary mb-4">Appearance</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-primary">Theme</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {theme === "dark" ? "Dark" : "Light"} is currently active. This applies everywhere and is remembered on this device.
                    </p>
                  </div>
                  <ThemeToggle />
                </div>
              </div>

              {/* Profile section: role */}
              <div className="rounded-xl border border-border bg-surface p-6 mb-6">
                <h2 className="text-sm font-medium text-text-primary mb-4">Profile</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-muted">Role</p>
                    {!editingRole && (
                      <p className="text-sm text-text-primary mt-0.5">{roleLabel(profile.role)}</p>
                    )}
                  </div>
                  {!editingRole && (
                    <button
                      onClick={() => setEditingRole(true)}
                      className="inline-flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 transition-colors"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  )}
                </div>
                {editingRole && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {ROLE_OPTIONS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleRoleChange(r.id)}
                        disabled={savingRole}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          profile.role === r.id
                            ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-border text-text-muted hover:border-border/60 hover:bg-raised"
                        }`}
                      >
                        {profile.role === r.id && <Check size={11} />}
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
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
                    <dd className="text-text-primary flex items-center gap-1.5">
                      <ProviderIcon provider={profile.provider} size={14} />
                      {providerLabel(profile.provider)}
                    </dd>
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
              </div>
            </div>
          )}

          {tab === "usage" && (
            <div className="max-w-3xl mx-auto">
              <h1 className="text-xl font-semibold text-text-primary mb-1">Usage</h1>
              <p className="text-sm text-text-muted mb-6">
                What Prompt AI has actually helped you do so far.
              </p>

              {usage.loading ? (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Loader2 size={14} className="animate-spin" />
                  Loading your usage...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="rounded-xl border border-accent/20 bg-accent/5 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp size={14} className="text-accent" />
                      <h2 className="text-sm font-medium text-text-primary">Your usage, in plain language</h2>
                    </div>
                    <p className="text-sm text-text-muted leading-relaxed">{buildSummary()}</p>
                  </div>

                  {/* Stat tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-[10px] text-text-faint uppercase tracking-wide mb-1">Prompts generated</p>
                      <p className="text-2xl font-semibold text-text-primary">{usage.totalPrompts}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-[10px] text-text-faint uppercase tracking-wide mb-1">Avg completeness</p>
                      <p className="text-2xl font-semibold text-text-primary">
                        {usage.averageScore !== null ? `${usage.averageScore}` : "-"}
                        <span className="text-xs text-text-faint">/100</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-[10px] text-text-faint uppercase tracking-wide mb-1 flex items-center gap-1">
                        <FileText size={9} /> Reports exported
                      </p>
                      <p className="text-2xl font-semibold text-text-primary">{usage.reportsExported}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-[10px] text-text-faint uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Paperclip size={9} /> Files attached
                      </p>
                      <p className="text-2xl font-semibold text-text-primary">{usage.mediaAttached}</p>
                    </div>
                  </div>

                  {/* Trends */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-xs font-medium text-text-primary mb-3">Prompts generated over time</p>
                      <TrendChart points={usage.promptsTrend} />
                    </div>
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-xs font-medium text-text-primary mb-3">Completeness score over time</p>
                      <TrendChart points={usage.scoreTrend} color="#22C55E" />
                    </div>
                  </div>

                  {/* Model breakdown */}
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-xs font-medium text-text-primary mb-3">Target models used</p>
                    {usage.modelBreakdown.length === 0 ? (
                      <p className="text-[10px] text-text-faint">No sessions yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {usage.modelBreakdown.map(({ model, count }) => {
                          const max = usage.modelBreakdown[0].count;
                          return (
                            <div key={model} className="flex items-center gap-3">
                              <span className="text-xs text-text-muted w-32 truncate">{model}</span>
                              <div className="flex-1 h-2 rounded-full bg-raised overflow-hidden">
                                <div
                                  className="h-full bg-accent-fill rounded-full"
                                  style={{ width: `${Math.max((count / max) * 100, 6)}%` }}
                                />
                              </div>
                              <span className="text-xs text-text-faint font-mono w-6 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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
