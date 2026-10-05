"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile, providerLabel, roleLabel, ROLE_OPTIONS } from "@/lib/hooks/useUserProfile";
import { SimplePageHeader } from "@/components/dashboard/SimplePageHeader";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { UsageTab } from "@/components/settings/UsageTab";
import { MemoryTab } from "@/components/settings/MemoryTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { AccountsTab } from "@/components/settings/AccountsTab";
import { Upload, Loader2, X, Pencil, Check } from "lucide-react";

type SettingsTab = "profile" | "memory" | "usage" | "integrations" | "accounts";

export default function SettingsPage() {
  const supabase = createClient();
  const { profile, refresh } = useUserProfile();
  const { theme } = useTheme();

  const [tab, setTab] = useState<SettingsTab>("profile");

  // Lets other screens link straight to a tab, such as the memory toast.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "memory" || requested === "usage" || requested === "profile" || requested === "integrations" || requested === "accounts") setTab(requested);
  }, []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState(false);
  const [customRole, setCustomRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);

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
    const value = role.trim().slice(0, 80);
    if (!value) return;
    setSavingRole(true);
    try {
      // updateUser reports failure in its result rather than throwing.
      const { error: updateError } = await supabase.auth.updateUser({ data: { role: value } });
      if (updateError) throw updateError;
      await refresh();
      setEditingRole(false);
      setCustomRole("");
      setError(null);
    } catch {
      setError("Could not update your role. Try again.");
    } finally {
      setSavingRole(false);
    }
  };

  if (!profile) {
    return <div className="h-screen bg-base" />;
  }

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <SimplePageHeader title="Settings" />

      {/* Tabs */}
      <div className="flex border-b border-border px-3 sm:px-6 gap-1 shrink-0 overflow-x-auto scrollbar-hide">
        {([
          { id: "profile", label: "Profile" },
          { id: "memory", label: "Memory" },
          { id: "usage", label: "Usage" },
          { id: "integrations", label: "Integrations" },
          // Last, and only for accounts that sign in with a password.
          ...(profile.hasPassword ? [{ id: "accounts", label: "Accounts" }] : []),
        ] as { id: SettingsTab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-3 md:py-2.5 min-h-[44px] md:min-h-0 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
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
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-raised border border-border flex items-center justify-center text-text-faint hover:text-red-400 hover:border-red-400/40 transition-colors before:absolute before:-inset-3 before:content-['']"
                      aria-label="Remove profile picture"
                      title="Remove picture"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>

                <div className="flex-1">
                  {profile.avatarUrl ? (
                    // A picture is set, so the only control is the remove X on the
                    // picture itself. The upload button is not shown at the same time.
                    <p className="text-sm text-text-muted">
                      This picture is visible across the app. Use the X on it to remove it, then you can upload a different one.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-text-muted mb-3">
                        Upload a profile picture. This will be visible across the app.
                      </p>

                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-[13px] md:text-[13px] font-medium text-accent hover:bg-accent/15 transition-colors cursor-pointer">
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

                        <span className="text-xs md:text-xs text-text-faint">Max 2MB</span>
                      </div>
                    </>
                  )}

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
                <ThemeToggle className="w-11 h-11 md:w-8 md:h-8" />
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
                    className="inline-flex items-center gap-1.5 text-sm md:text-[13px] text-accent hover:text-accent/80 transition-colors px-3 py-3 -mx-3 -my-3 md:px-3 md:py-2 md:-mx-3 md:-my-2"
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
                  <form
                    className="col-span-2 flex gap-2 mt-1"
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleRoleChange(customRole);
                    }}
                  >
                    <input
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      maxLength={80}
                      placeholder="Or write your own, for example Staff engineer"
                      aria-label="Write your own role"
                      className="flex-1 min-w-0 rounded-lg border border-border bg-raised px-3 py-2.5 text-[16px] md:text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent/50"
                    />
                    <button
                      type="submit"
                      disabled={savingRole || !customRole.trim()}
                      className="px-4 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold disabled:opacity-50"
                    >
                      Save
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => { setEditingRole(false); setCustomRole(""); }}
                    className="col-span-2 text-sm md:text-xs text-text-muted hover:text-text-primary py-2"
                  >
                    Cancel
                  </button>
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

        {tab === "memory" && <MemoryTab />}

        {tab === "usage" && <UsageTab />}

        {tab === "integrations" && <IntegrationsTab />}

        {tab === "accounts" && profile.hasPassword && <AccountsTab />}
      </div>
    </div>
  );
}
