"use client";

import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useDashboard } from "@/lib/dashboard/DashboardContext";
import { ThemeToggle } from "@/components/ThemeToggle";

// Shared header chrome for every non-chat dashboard page (media, exports,
// saved prompts, favorites, history, settings). Each page supplies only
// its own title, the mobile menu button, theme toggle, and avatar are
// identical everywhere.
export function SimplePageHeader({ title }: { title: string }) {
  const router = useRouter();
  const { profile, setMobileSidebarOpen } = useDashboard();

  return (
    <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-surface shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden p-1 text-text-faint hover:text-text-primary transition-colors"
          aria-label="Open menu"
        >
          <Menu size={16} />
        </button>
        <span className="font-mono text-[11px] text-text-faint">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle size={13} className="w-7 h-7" />
        <button
          onClick={() => router.push("/settings")}
          className="w-7 h-7 rounded-full overflow-hidden border border-border hover:border-accent/40 transition-colors shrink-0"
          aria-label="Open settings"
        >
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-accent/15 flex items-center justify-center text-[10px] text-accent font-mono">
              {(profile?.username ?? "U")[0]?.toUpperCase()}
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
