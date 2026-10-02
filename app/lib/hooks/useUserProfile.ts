"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  preferredName: string | null;
  avatarUrl: string | null;
  provider: string;
  // True when the account can sign in with an email and password.
  hasPassword: boolean;
  role: string | null;
  about: string | null;
  workingOn: string | null;
  primaryUse: string | null;
  createdAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email",
  google: "Google",
  github: "GitHub",
};

// An account has a password when email is one of its sign in methods. Someone
// who only ever signs in with Google or GitHub has none to change.
export function hasEmailLogin(appMetadata: { provider?: string; providers?: string[] } | undefined): boolean {
  const providers = appMetadata?.providers ?? (appMetadata?.provider ? [appMetadata.provider] : ["email"]);
  return providers.includes("email");
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export const ROLE_OPTIONS = [
  { id: "developer", label: "Developer" },
  { id: "designer", label: "Designer" },
  { id: "product", label: "Product manager" },
  { id: "other", label: "Something else" },
] as const;

export function roleLabel(role: string | null): string {
  return ROLE_OPTIONS.find((r) => r.id === role)?.label ?? "Not set";
}

// Single source of truth for the signed-in user's profile fields
// (avatar, display name, auth provider) so the sidebar, header, and
// settings page never fall out of sync with one another.
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setProfile({
      id: user.id,
      email: user.email ?? "",
      username: user.user_metadata?.preferred_name || user.email?.split("@")[0] || "User",
      preferredName: user.user_metadata?.preferred_name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
      provider: user.app_metadata?.provider ?? "email",
      hasPassword: hasEmailLogin(user.app_metadata),
      role: user.user_metadata?.role ?? null,
      about: user.user_metadata?.about ?? null,
      workingOn: user.user_metadata?.working_on ?? null,
      primaryUse: user.user_metadata?.primary_use ?? null,
      createdAt: user.created_at ?? null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  return { profile, loading, refresh };
}
