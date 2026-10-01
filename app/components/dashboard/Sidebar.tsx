"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, MessageSquare, Settings, LogOut, X,
  PanelLeftClose, PanelLeftOpen, Paperclip, Download, History,
  BookOpen, Star, Trash2, Pencil,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import type { ChatSession } from "@/lib/types/chat";

interface SidebarProps {
  sessions: ChatSession[];
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  username: string;
  avatarUrl: string | null;
  onSettings: () => void;
  onSignOut: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  preferredName?: string | null;
  roleDisplay?: string;
  onToggleSessionFavorite?: (id: string, next: boolean) => void;
  onRenameSession?: (id: string, title: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

// Briefly highlights a session's title in the sidebar the moment it turns
// from the "New Chat" placeholder into a real, AI-inferred title, so the
// title's appearance reads as a deliberate event rather than a silent
// re-render.
function AnimatedSessionTitle({ title }: { title: string }) {
  const prevTitle = useRef(title);
  const [justTitled, setJustTitled] = useState(false);

  useEffect(() => {
    if (prevTitle.current === "New Chat" && title !== "New Chat") {
      setJustTitled(true);
      const t = setTimeout(() => setJustTitled(false), 1400);
      prevTitle.current = title;
      return () => clearTimeout(t);
    }
    prevTitle.current = title;
  }, [title]);

  return (
    <motion.span
      animate={justTitled ? { opacity: [0, 1], x: [-6, 0] } : undefined}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`text-[10px] truncate flex-1 transition-colors ${justTitled ? "text-accent" : ""}`}
    >
      {title}
    </motion.span>
  );
}

// A real top-level component, not a closure defined inside Sidebar's
// render, so React can track its identity and local edit state across
// re-renders instead of remounting it, and losing that state, every time
// something unrelated in the sidebar changes.
function SessionItem({
  session, isActive, onToggleFavorite, onDelete, onRename, onNavigate,
}: {
  session: ChatSession;
  isActive: boolean;
  onToggleFavorite?: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onNavigate: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(session.title);
    setEditing(true);
  };

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== session.title && onRename) {
      onRename(session.id, trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 bg-raised">
        <MessageSquare size={10} className="shrink-0 text-text-faint" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
            if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
          }}
          className="flex-1 w-0 bg-transparent text-[10px] text-text-primary outline-none"
        />
      </div>
    );
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Link
        href={`/dashboard/chats/${session.id}`}
        onClick={onNavigate}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 transition-colors ${
          isActive ? "bg-raised text-text-primary" : "text-text-faint hover:text-text-muted hover:bg-raised/50"
        }`}
      >
        <MessageSquare size={10} className="shrink-0" />
        <AnimatedSessionTitle title={session.title} />
        {hovered && onRename && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(); }}
            className="p-0.5 text-text-faint hover:text-text-muted transition-colors"
            aria-label="Rename chat"
          >
            <Pencil size={9} />
          </button>
        )}
        {(hovered || session.is_favorite) && onToggleFavorite && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(session.id, !session.is_favorite); }}
            className={`p-0.5 transition-colors ${session.is_favorite ? "text-accent" : "text-text-faint hover:text-accent"}`}
            aria-label={session.is_favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={9} fill={session.is_favorite ? "currentColor" : "none"} />
          </button>
        )}
        {hovered && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(session.id); }}
            className="p-0.5 text-text-faint hover:text-red-400 transition-colors"
            aria-label="Delete chat"
          >
            <Trash2 size={9} />
          </button>
        )}
      </Link>
    </motion.div>
  );
}

function SessionGroup({
  label, items, activeSessionId, onToggleFavorite, onDelete, onRename, onNavigate,
}: {
  label: string;
  items: ChatSession[];
  activeSessionId: string | undefined;
  onToggleFavorite?: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onNavigate: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-2">
      <p className="px-2 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">
        {label}
      </p>
      {items.map((s) => (
        <SessionItem
          key={s.id}
          session={s}
          isActive={s.id === activeSessionId}
          onToggleFavorite={onToggleFavorite}
          onDelete={onDelete}
          onRename={onRename}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function groupSessions(sessions: ChatSession[]) {
  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const older: ChatSession[] = [];
  const now = Date.now();
  for (const s of sessions) {
    const diff = now - new Date(s.updated_at).getTime();
    const days = diff / 86_400_000;
    if (days < 1) today.push(s);
    else if (days < 2) yesterday.push(s);
    else older.push(s);
  }
  return { today, yesterday, older };
}

const NAV_ITEMS = [
  { href: "/dashboard/media", icon: Paperclip, label: "Media" },
  { href: "/dashboard/exports", icon: Download, label: "Exports" },
];

const LIBRARY_ITEMS = [
  { href: "/dashboard/saved-prompts", icon: BookOpen, label: "Saved prompts" },
  { href: "/dashboard/favorites", icon: Star, label: "Favorites" },
  { href: "/dashboard/history", icon: History, label: "All history" },
];

// Collapsed rail -- icon-only, every control gets a hover tooltip so the
// sidebar stays fully usable without expanding it.
function CollapsedRail({
  onNewChat, onToggleCollapse, onSearch, pathname, onSettings, onSignOut, avatarUrl, username,
}: {
  onNewChat: () => void;
  onToggleCollapse: () => void;
  onSearch: () => void;
  pathname: string;
} & Pick<SidebarProps, "onSettings" | "onSignOut" | "avatarUrl" | "username">) {
  return (
    <aside className="w-12 shrink-0 border-r border-border bg-surface flex-col items-center hidden md:flex py-2.5">
      <Tooltip id="sidebar-tip" place="right" className="!text-[10px] !py-1 !px-2 !z-50" />

      <div className="flex items-center gap-1 mb-3">
        <button
          data-tooltip-id="sidebar-tip"
          data-tooltip-content="Expand sidebar"
          onClick={onToggleCollapse}
          className="w-7 h-7 rounded-md flex items-center justify-center text-text-faint hover:text-text-muted hover:bg-raised transition-colors"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen size={13} />
        </button>
      </div>

      <button
        data-tooltip-id="sidebar-tip"
        data-tooltip-content="Search chats"
        onClick={onSearch}
        className="w-7 h-7 rounded-md flex items-center justify-center text-text-faint hover:text-text-muted hover:bg-raised transition-colors mb-3"
        aria-label="Search chats"
      >
        <Search size={13} />
      </button>

      <button
        data-tooltip-id="sidebar-tip"
        data-tooltip-content="New chat"
        onClick={onNewChat}
        className="w-7 h-7 rounded-md flex items-center justify-center bg-accent/10 border border-accent/20 text-accent hover:bg-accent/15 transition-colors mb-3"
        aria-label="New chat"
      >
        <Plus size={13} />
      </button>

      <div className="flex flex-col gap-1 mb-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            data-tooltip-id="sidebar-tip"
            data-tooltip-content={label}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              pathname === href ? "text-accent bg-accent/10" : "text-text-faint hover:text-text-muted hover:bg-raised"
            }`}
            aria-label={label}
          >
            <Icon size={13} />
          </Link>
        ))}
      </div>

      <button
        data-tooltip-id="sidebar-tip"
        data-tooltip-content="Settings"
        onClick={onSettings}
        className="w-7 h-7 rounded-md flex items-center justify-center text-text-faint hover:text-text-muted hover:bg-raised transition-colors mb-1"
        aria-label="Settings"
      >
        <Settings size={13} />
      </button>
      <button
        data-tooltip-id="sidebar-tip"
        data-tooltip-content="Sign out"
        onClick={onSignOut}
        className="w-7 h-7 rounded-md flex items-center justify-center text-text-faint hover:text-red-400 hover:bg-raised transition-colors mb-3"
        aria-label="Sign out"
      >
        <LogOut size={13} />
      </button>

      <button
        onClick={onSettings}
        data-tooltip-id="sidebar-tip"
        data-tooltip-content={`Settings for @${username}`}
        aria-label="Open settings"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-border" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[9px] text-accent font-mono border border-accent/20">
            {username[0]?.toUpperCase()}
          </div>
        )}
      </button>
    </aside>
  );
}

// Pure navigation chrome, persistent across every authenticated route. It
// never swaps its own content based on where the user is, the only thing
// that changes here is which nav item is highlighted as active, driven by
// the current pathname, never by local component state.
export function Sidebar({
  sessions,
  onNewChat,
  onDeleteSession,
  username,
  avatarUrl,
  onSettings,
  onSignOut,
  collapsed,
  onToggleCollapse,
  preferredName,
  roleDisplay,
  onToggleSessionFavorite,
  onRenameSession,
  mobileOpen = false,
  onMobileClose = () => {},
}: SidebarProps) {
  const pathname = usePathname();
  const activeSessionId = pathname?.startsWith("/dashboard/chats/") ? pathname.split("/").pop() : undefined;

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const displayName = preferredName || username;

  // Closing the mobile drawer on these is harmless on desktop too -- it is
  // just a redundant state-to-false call when the drawer was never open.
  const handleNewChat = () => { onNewChat(); onMobileClose(); };

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );
  const { today, yesterday, older } = groupSessions(filtered);


  const sidebarBody = (
    <>
      {/* New chat */}
      <div className="px-2 pt-2">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-accent/10 border border-accent/20 text-[11px] font-medium text-accent hover:bg-accent/15 transition-colors"
        >
          <Plus size={11} /> New chat
        </button>
      </div>

      {/* Nav: Media, Exports */}
      <div className="px-2 pt-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            onClick={onMobileClose}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              pathname === href ? "text-accent bg-accent/10" : "text-text-muted hover:text-text-primary hover:bg-raised"
            }`}
          >
            <Icon size={12} />
            {label}
          </Link>
        ))}
      </div>

      <div className="border-t border-border mt-2" />

      {/* Chat list -- always visible, regardless of the active route */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 py-2">
        {searchOpen && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-raised mb-2">
            <Search size={9} className="text-text-faint shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="text-[10px] text-text-primary bg-transparent outline-none placeholder:text-text-faint flex-1 w-0"
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-[10px] text-text-faint text-center mt-6">No chats yet</p>
        ) : (
          <>
            <SessionGroup
              label="Today" items={today} activeSessionId={activeSessionId}
              onToggleFavorite={onToggleSessionFavorite} onDelete={onDeleteSession}
              onRename={onRenameSession} onNavigate={onMobileClose}
            />
            <SessionGroup
              label="Yesterday" items={yesterday} activeSessionId={activeSessionId}
              onToggleFavorite={onToggleSessionFavorite} onDelete={onDeleteSession}
              onRename={onRenameSession} onNavigate={onMobileClose}
            />
            <SessionGroup
              label="Older" items={older} activeSessionId={activeSessionId}
              onToggleFavorite={onToggleSessionFavorite} onDelete={onDeleteSession}
              onRename={onRenameSession} onNavigate={onMobileClose}
            />
          </>
        )}

        <div className="mt-3 pt-2 border-t border-border">
          <p className="px-2 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">
            Library
          </p>
          {LIBRARY_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                pathname === href ? "text-accent bg-accent/10" : "text-text-faint hover:text-text-muted hover:bg-raised/50"
              }`}
            >
              <Icon size={10} className="shrink-0" />
              <span className="text-[10px]">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer: identity block */}
      <div className="px-2.5 py-2.5 border-t border-border flex items-center justify-between">
        <button
          onClick={onSettings}
          className="flex items-center gap-2 min-w-0 text-left rounded-md -ml-0.5 pl-0.5 hover:bg-raised/50 transition-colors py-0.5 pr-1"
          aria-label="Open settings"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[9px] text-accent font-mono shrink-0 border border-accent/20">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] text-text-primary font-medium truncate leading-tight">{displayName}</p>
            {roleDisplay && (
              <p className="text-[9px] text-text-faint truncate leading-tight">{roleDisplay}</p>
            )}
          </div>
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onSettings}
            className="p-1 text-text-faint hover:text-text-muted transition-colors"
            aria-label="Settings"
          >
            <Settings size={11} />
          </button>
          <button
            onClick={onSignOut}
            className="p-1 text-text-faint hover:text-red-400 transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={11} />
          </button>
        </div>
      </div>
    </>
  );

  const desktopSidebar = collapsed ? (
    <CollapsedRail
      onNewChat={onNewChat}
      onToggleCollapse={onToggleCollapse}
      onSearch={() => { onToggleCollapse(); setSearchOpen(true); }}
      pathname={pathname ?? ""}
      onSettings={onSettings}
      onSignOut={onSignOut}
      avatarUrl={avatarUrl}
      username={username}
    />
  ) : (
    <aside className="w-56 shrink-0 border-r border-border bg-surface flex-col hidden md:flex">
      {/* Brand + collapse + search, one row */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <Logo variant="color" size={18} />
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className={`p-1.5 rounded-md transition-colors ${
              searchOpen ? "text-accent bg-accent/10" : "text-text-faint hover:text-text-muted hover:bg-raised"
            }`}
            aria-label="Search chats"
          >
            <Search size={13} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md text-text-faint hover:text-text-muted hover:bg-raised transition-colors"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={13} />
          </button>
        </div>
      </div>
      {sidebarBody}
    </aside>
  );

  const mobileDrawer = (
    <AnimatePresence>
      {mobileOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-surface border-r border-border flex flex-col md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Chat menu"
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <Logo variant="color" size={18} />
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setSearchOpen((v) => !v)}
                  className={`p-1.5 rounded-md transition-colors ${
                    searchOpen ? "text-accent bg-accent/10" : "text-text-faint hover:text-text-muted hover:bg-raised"
                  }`}
                  aria-label="Search chats"
                >
                  <Search size={13} />
                </button>
                <button
                  onClick={onMobileClose}
                  className="p-1.5 rounded-md text-text-faint hover:text-text-muted hover:bg-raised transition-colors"
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {sidebarBody}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {desktopSidebar}
      {mobileDrawer}
    </>
  );
}
