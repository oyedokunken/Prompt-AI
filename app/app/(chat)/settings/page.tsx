"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Upload, Loader2, X } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError(null);

      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        setError("File size must be less than 2MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("File must be an image");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) {
        setError(updateError.message);
      }
    } catch {
      setError("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.auth.updateUser({
        data: { avatar_url: null },
      });

      setAvatarUrl(null);
    } catch {
      setError("Failed to remove avatar");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0B]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-[#0D0D0F] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-1 text-text-faint hover:text-text-muted transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="font-mono text-[11px] text-text-faint">Settings</span>
        </div>
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
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-accent font-mono text-2xl border border-border">
                    U
                  </div>
                )}
                {avatarUrl && (
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
                  Upload a profile picture. This will be visible in the chat sidebar.
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

          {/* Email section */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-sm font-medium text-text-primary mb-4">Email address</h2>
            <p className="text-sm text-text-muted">
              Email address is managed through your authentication provider.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
