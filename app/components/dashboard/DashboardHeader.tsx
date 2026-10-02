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

interface DashboardHeaderViewProps extends DashboardHeaderProps {
  avatarUrl?: string | null;
  username?: string;
  onOpenMenu?: () => void;
  onOpenSettings?: () => void;
}

// The header as drawn. It holds no state of its own, so the marketing page can
// show the very same header the product has.
export function DashboardHeaderView({
  label, actions, avatarUrl, username = "User", onOpenMenu, onOpenSettings,
}: DashboardHeaderViewProps) {
  return (
    <header className="flex items-center justify-between gap-2 px-3 sm:px-4 h-14 md:h-12 border-b border-border bg-surface shrink-0">
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        <button
          onClick={onOpenMenu}
          className="md:hidden w-11 h-11 -ml-1.5 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-raised transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <Link href="/dashboard" aria-label="Prompt AI home" className="shrink-0 rounded-md min-h-[44px] md:min-h-[36px] flex items-center focus-visible:outline-accent">
          <Logo variant="color" size={30} className="md:hidden" />
          <Logo variant="color" size={26} className="hidden md:inline-flex" />
        </Link>
        {label && (
          <>
            <span className="text-border" aria-hidden="true">/</span>
            <span className="font-mono text-xs md:text-[13px] text-text-faint truncate">{label}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {actions}
        <ThemeToggle size={18} className="w-11 h-11 md:w-9 md:h-9 [&_svg]:md:w-[16px] [&_svg]:md:h-[16px]" />
        <button
          onClick={onOpenSettings}
          className="w-10 h-10 md:w-9 md:h-9 rounded-full overflow-hidden border border-border hover:border-accent/40 transition-colors shrink-0"
          aria-label="Open settings"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-accent/15 flex items-center justify-center text-xs md:text-xs text-accent font-mono">
              {username[0]?.toUpperCase()}
            </div>
          )}
        </button>
      </div>
    </header>
  );
}

// The one header every dashboard screen uses. The logo is always here, in the
// empty new chat state and inside a conversation alike, next to the theme
// switcher, so the two can never appear without it.
export function DashboardHeader({ label, actions }: DashboardHeaderProps) {
  const router = useRouter();
  const { profile, setMobileSidebarOpen } = useDashboard();
  return (
    <DashboardHeaderView
      label={label}
      actions={actions}
      avatarUrl={profile?.avatarUrl ?? null}
      username={profile?.username ?? "User"}
      onOpenMenu={() => setMobileSidebarOpen(true)}
      onOpenSettings={() => router.push("/settings")}
    />
  );
}
