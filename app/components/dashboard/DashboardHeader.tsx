"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useDashboard } from "@/lib/dashboard/DashboardContext";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

interface DashboardHeaderProps {
  // The name of a section such as Media or Settings. Never a chat title, those
  // live only in the sidebar and the mobile drawer.
  label?: string;
  // Extra controls, placed before the theme switcher.
  actions?: React.ReactNode;
}

// The one header every dashboard screen uses. The logo is always here, in the
// empty new chat state and inside a conversation alike, next to the theme
// switcher, so the two can never appear without it.
export function DashboardHeader({ label, actions }: DashboardHeaderProps) {
  const router = useRouter();
  const { profile, setMobileSidebarOpen } = useDashboard();

  return (
    <header className="flex items-center justify-between gap-2 px-3 sm:px-4 h-14 md:h-10 border-b border-border bg-surface shrink-0">
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden w-11 h-11 -ml-1.5 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-raised transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <Link href="/dashboard" aria-label="Prompt AI home" className="shrink-0 rounded-md focus-visible:outline-accent">
          <Logo variant="color" size={24} className="md:hidden" />
          <Logo variant="color" size={18} className="hidden md:inline-flex" />
        </Link>
        {label && (
          <>
            <span className="text-border" aria-hidden="true">/</span>
            <span className="font-mono text-xs md:text-[11px] text-text-faint truncate">{label}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {actions}
        <ThemeToggle size={18} className="w-11 h-11 md:w-7 md:h-7 [&_svg]:md:w-[13px] [&_svg]:md:h-[13px]" />
        <button
          onClick={() => router.push("/settings")}
          className="w-10 h-10 md:w-7 md:h-7 rounded-full overflow-hidden border border-border hover:border-accent/40 transition-colors shrink-0"
          aria-label="Open settings"
        >
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-accent/15 flex items-center justify-center text-xs md:text-[10px] text-accent font-mono">
              {(profile?.username ?? "U")[0]?.toUpperCase()}
            </div>
          )}
        </button>
      </div>
    </header>
  );
}
