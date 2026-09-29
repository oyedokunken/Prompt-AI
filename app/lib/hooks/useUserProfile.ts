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
  createdAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email and password",
  google: "Google",
  github: "GitHub",
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
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
