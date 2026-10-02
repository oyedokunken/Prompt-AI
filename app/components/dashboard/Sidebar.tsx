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
  BookOpen, Star, Trash2, Pencil, Pin, PinOff, MoreHorizontal,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import type { ChatSession } from "@/lib/types/chat";
import { partitionPinned } from "@/lib/pins";

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
  pinnedIds?: string[];
  onTogglePin?: (id: string) => void;
  // Marks a chat as the open one when there is no chat route to read it from, as in the marketing preview.
  previewActiveId?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

// Briefly highlights a session's title in the sidebar the moment it turns
// from the "New Chat" placeholder into a real, AI-inferred title, so the
// title's appearance reads as a deliberate event rather than a silent
// re-render.
function AnimatedSessionTitle({ title, mobile = false }: { title: string; mobile?: boolean }) {
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
      className={`${mobile ? "text-base" : "text-[10px]"} truncate flex-1 transition-colors ${justTitled ? "text-accent" : ""}`}
    >
      {title}
    </motion.span>
  );
}

interface SessionActions {
  onToggleFavorite?: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onTogglePin?: (id: string) => void;
  onNavigate: () => void;
}

// A small menu of everything you can do to a chat. Touch screens have no hover,
// so on a phone this is how pin, favorite, rename and delete are reached.
function SessionMenu({
  session, pinned, actions, onRename, onClose,
}: {
  session: ChatSession;
  pinned: boolean;
  actions: SessionActions;
  onRename: () => void;
  onClose: () => void;
}) {
  const item = "w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-text-muted hover:text-text-primary hover:bg-raised transition-colors";
  const run = (fn: () => void) => () => { onClose(); fn(); };
  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} aria-hidden="true" />
      <div role="menu" className="absolute right-0 top-full mt-1 z-[70] w-52 rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
        {actions.onTogglePin && (
          <button role="menuitem" className={item} onClick={run(() => actions.onTogglePin?.(session.id))}>
            {pinned ? <PinOff size={16} /> : <Pin size={16} />} {pinned ? "Unpin chat" : "Pin chat"}
          </button>
        )}
        {actions.onToggleFavorite && (
          <button role="menuitem" className={item} onClick={run(() => actions.onToggleFavorite?.(session.id, !session.is_favorite))}>
            <Star size={16} fill={session.is_favorite ? "currentColor" : "none"} /> {session.is_favorite ? "Remove favorite" : "Add to favorites"}
          </button>
        )}
        {actions.onRename && (
          <button role="menuitem" className={item} onClick={run(onRename)}>
            <Pencil size={16} /> Rename
          </button>
        )}
        <button role="menuitem" className={`${item} hover:!text-red-400`} onClick={run(() => actions.onDelete(session.id))}>
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </>
  );
}

// A real top-level component, not a closure defined inside Sidebar's
// render, so React can track its identity and local edit state across
// re-renders instead of remounting it, and losing that state, every time
// something unrelated in the sidebar changes.
function SessionItem({
  session, isActive, pinned, mobile, actions,
}: {
  session: ChatSession;
  isActive: boolean;
  pinned: boolean;
  mobile: boolean;
  actions: SessionActions;
}) {
  const { onToggleFavorite, onDelete, onRename, onTogglePin, onNavigate } = actions;
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  const rowSize = mobile ? "gap-3 px-3 py-2.5 min-h-[44px]" : "gap-2 px-2 py-1.5";
  const iconSize = mobile ? 16 : 10;

  if (editing) {
    return (
      <div className={`flex items-center rounded-lg mb-0.5 bg-raised ${rowSize}`}>
        <MessageSquare size={iconSize} className="shrink-0 text-text-faint" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
            if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
          }}
          className={`flex-1 w-0 bg-transparent text-text-primary outline-none ${mobile ? "text-base" : "text-[10px]"}`}
        />
      </div>
    );
  }

  const Marker = pinned ? Pin : MessageSquare;

  return (
    <motion.div layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="relative">
      <Link
        href={`/dashboard/chats/${session.id}`}
        onClick={onNavigate}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`group flex items-center rounded-lg mb-0.5 transition-colors ${rowSize} ${
          isActive ? "bg-raised text-text-primary" : "text-text-faint hover:text-text-muted hover:bg-raised/50"
        } ${mobile ? "pr-12" : ""}`}
      >
        <Marker size={iconSize} className={`shrink-0 ${pinned ? "text-accent" : ""}`} fill={pinned ? "currentColor" : "none"} />
        <AnimatedSessionTitle title={session.title} mobile={mobile} />
        {!mobile && hovered && onTogglePin && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(session.id); }}
            className={`p-0.5 transition-colors ${pinned ? "text-accent" : "text-text-faint hover:text-accent"}`}
            aria-label={pinned ? "Unpin chat" : "Pin chat"}
          >
            {pinned ? <PinOff size={9} /> : <Pin size={9} />}
          </button>
        )}
        {!mobile && hovered && onRename && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(); }}
            className="p-0.5 text-text-faint hover:text-text-muted transition-colors"
            aria-label="Rename chat"
          >
            <Pencil size={9} />
          </button>
        )}
        {(mobile ? session.is_favorite : hovered || session.is_favorite) && onToggleFavorite && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(session.id, !session.is_favorite); }}
            className={`p-0.5 transition-colors ${session.is_favorite ? "text-accent" : "text-text-faint hover:text-accent"}`}
            aria-label={session.is_favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={mobile ? 14 : 9} fill={session.is_favorite ? "currentColor" : "none"} />
          </button>
        )}
        {!mobile && hovered && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(session.id); }}
            className="p-0.5 text-text-faint hover:text-red-400 transition-colors"
            aria-label="Delete chat"
          >
            <Trash2 size={9} />
          </button>
        )}
      </Link>
      {mobile && (
        <>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-text-faint hover:text-text-primary hover:bg-raised transition-colors"
            aria-label={`Actions for ${session.title}`}
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <SessionMenu
              session={session}
              pinned={pinned}
              actions={actions}
              onRename={startEditing}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </>
      )}
    </motion.div>
  );
}

function SessionGroup({
  label, items, activeSessionId, pinnedSet, mobile, actions, icon,
}: {
  label: string;
  items: ChatSession[];
  activeSessionId: string | undefined;
  pinnedSet: Set<string>;
  mobile: boolean;
  actions: SessionActions;
  icon?: React.ReactNode;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-2">
      <p className={`px-2 mb-1 font-mono uppercase tracking-widest text-text-faint flex items-center gap-1.5 ${mobile ? "text-[11px]" : "text-[9px]"}`}>
        {icon}{label}
      </p>
      {items.map((s) => (
        <SessionItem
          key={s.id}
          session={s}
          isActive={s.id === activeSessionId}
          pinned={pinnedSet.has(s.id)}
          mobile={mobile}
          actions={actions}
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

// The collapsed sidebar is a narrower version of the same sidebar, not a
// reduced one. Top to bottom: the logo mark on its own, the collapse and
// search controls as icons, then the chat list as compact tiles that keep
// working, with the library and account controls pinned beneath.
function CollapsedRail({
  sessions, pinnedIds, activeSessionId, onNewChat, onToggleCollapse, onSearch, pathname, onSettings, onSignOut, avatarUrl, username,
}: {
  sessions: ChatSession[];
  pinnedIds: string[];
  activeSessionId: string | undefined;
  onNewChat: () => void;
  onToggleCollapse: () => void;
  onSearch: () => void;
  pathname: string;
} & Pick<SidebarProps, "onSettings" | "onSignOut" | "avatarUrl" | "username">) {
  const pinnedPart = partitionPinned(sessions, pinnedIds);
  const iconButton = "w-8 h-8 rounded-md flex items-center justify-center text-text-faint hover:text-text-muted hover:bg-raised transition-colors";
  return (
    <aside className="w-14 shrink-0 border-r border-border bg-surface flex-col items-center hidden md:flex py-2.5">
      <Tooltip id="sidebar-tip" place="right" className="!text-[10px] !py-1 !px-2 !z-50" />

      <Link href="/dashboard" aria-label="Prompt AI home" className="mb-2">
        <Logo variant="color" size={26} iconOnly />
      </Link>

      <div className="flex flex-col items-center gap-0.5 pb-2 mb-2 border-b border-border w-full">
        <button
          data-tooltip-id="sidebar-tip"
          data-tooltip-content="Expand sidebar"
          onClick={onToggleCollapse}
          className={iconButton}
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen size={14} />
        </button>
        <button
          data-tooltip-id="sidebar-tip"
          data-tooltip-content="Search chats"
          onClick={onSearch}
          className={iconButton}
          aria-label="Search chats"
        >
          <Search size={14} />
        </button>
        <button
          data-tooltip-id="sidebar-tip"
          data-tooltip-content="New chat"
          onClick={onNewChat}
          className="w-8 h-8 rounded-md flex items-center justify-center bg-accent/10 border border-accent/20 text-accent hover:bg-accent/15 transition-colors mt-0.5"
          aria-label="New chat"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* The chat list, still here and still scrollable */}
      <nav className="flex-1 w-full overflow-y-auto scrollbar-hide flex flex-col items-center gap-1 pb-2" aria-label="Chats">
        {[...pinnedPart.pinned, ...pinnedPart.rest].map((s, index) => {
          const isPinned = pinnedPart.pinned.includes(s);
          const isActive = s.id === activeSessionId;
          const initial = s.title === "New Chat" ? null : s.title.trim()[0]?.toUpperCase();
          return (
            <div key={s.id} className="w-full flex flex-col items-center gap-1">
              {index === pinnedPart.pinned.length && pinnedPart.pinned.length > 0 && (
                <span className="w-5 border-t border-border my-0.5" aria-hidden="true" />
              )}
              <Link
                href={`/dashboard/chats/${s.id}`}
                data-tooltip-id="sidebar-tip"
                data-tooltip-content={isPinned ? `${s.title} (pinned)` : s.title}
                aria-label={isPinned ? `${s.title}, pinned` : s.title}
                aria-current={isActive ? "page" : undefined}
                className={`relative w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[11px] font-mono transition-colors border ${
                  isActive
                    ? "bg-accent/15 border-accent/40 text-accent"
                    : "bg-raised/60 border-transparent text-text-faint hover:text-text-primary hover:border-border"
                }`}
              >
                {initial ?? <MessageSquare size={12} />}
                {isPinned && <Pin size={8} fill="currentColor" className="absolute -top-0.5 -left-0.5 text-accent" />}
                {s.is_favorite && <Star size={7} fill="currentColor" className="absolute -top-0.5 -right-0.5 text-accent" />}
              </Link>
            </div>
          );
        })}
        {sessions.length === 0 && <span className="text-[9px] text-text-faint mt-2">None</span>}
      </nav>

      <div className="flex flex-col items-center gap-0.5 pt-2 mt-1 border-t border-border w-full">
        {[...NAV_ITEMS, ...LIBRARY_ITEMS].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            data-tooltip-id="sidebar-tip"
            data-tooltip-content={label}
            className={`${iconButton} ${pathname === href ? "!text-accent bg-accent/10" : ""}`}
            aria-label={label}
          >
            <Icon size={13} />
          </Link>
        ))}
        <button
          data-tooltip-id="sidebar-tip"
          data-tooltip-content="Settings"
          onClick={onSettings}
          className={iconButton}
          aria-label="Settings"
        >
          <Settings size={13} />
        </button>
        <button
          data-tooltip-id="sidebar-tip"
          data-tooltip-content="Sign out"
          onClick={onSignOut}
          className={`${iconButton} hover:!text-red-400`}
          aria-label="Sign out"
        >
          <LogOut size={13} />
        </button>
        <button
          onClick={onSettings}
          data-tooltip-id="sidebar-tip"
          data-tooltip-content={`Settings for @${username}`}
          aria-label="Open settings"
          className="mt-1"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[9px] text-accent font-mono border border-accent/20">
              {username[0]?.toUpperCase()}
            </div>
          )}
        </button>
      </div>
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
  pinnedIds = [],
  onTogglePin,
  previewActiveId,
  mobileOpen = false,
  onMobileClose = () => {},
}: SidebarProps) {
  const pathname = usePathname();
  const activeSessionId = previewActiveId ?? (pathname?.startsWith("/dashboard/chats/") ? pathname.split("/").pop() : undefined);

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const displayName = preferredName || username;

  // Closing the mobile drawer on these is harmless on desktop too -- it is
  // just a redundant state-to-false call when the drawer was never open.
  const handleNewChat = () => { onNewChat(); onMobileClose(); };

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );
  // Pinned chats are their own group above everything else. The rest keep the
  // time based grouping they always had.
  const { pinned, rest } = partitionPinned(filtered, pinnedIds);
  const pinnedSet = new Set(pinned.map((s) => s.id));
  const { today, yesterday, older } = groupSessions(rest);

  // The same sidebar is used on desktop and in the phone drawer. The drawer
  // gets larger text, icons and tap targets, since a finger needs far more room
  // than a pointer, and the desktop sizes stay compact.
  const renderBody = (mobile: boolean) => {
    const actions: SessionActions = {
      onToggleFavorite: onToggleSessionFavorite,
      onDelete: onDeleteSession,
      onRename: onRenameSession,
      onTogglePin,
      onNavigate: onMobileClose,
    };
    const groupProps = { activeSessionId, pinnedSet, mobile, actions };
    const navRow = mobile
      ? "flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors"
      : "flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors";
    const libRow = mobile
      ? "w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg transition-colors"
      : "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors";
    const footerButton = mobile
      ? "w-11 h-11 flex items-center justify-center rounded-lg text-text-faint hover:text-text-muted hover:bg-raised transition-colors"
      : "p-1 text-text-faint hover:text-text-muted transition-colors";

    return (
      <>
        {/* New chat */}
        <div className={mobile ? "px-3 pt-3" : "px-2 pt-2"}>
          <button
            onClick={handleNewChat}
            className={`w-full flex items-center justify-center gap-2 rounded-md bg-accent/10 border border-accent/20 font-medium text-accent hover:bg-accent/15 transition-colors ${
              mobile ? "px-3 py-3 min-h-[48px] text-base rounded-xl" : "px-2 py-1.5 text-[11px]"
            }`}
          >
            <Plus size={mobile ? 18 : 11} /> New chat
          </button>
        </div>

        {/* Nav: Media, Exports */}
        <div className={`flex flex-col gap-0.5 ${mobile ? "px-3 pt-3" : "px-2 pt-2"}`}>
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={`${navRow} ${
                pathname === href ? "text-accent bg-accent/10" : "text-text-muted hover:text-text-primary hover:bg-raised"
              } ${mobile ? "text-base" : ""}`}
            >
              <Icon size={mobile ? 18 : 12} />
              {label}
            </Link>
          ))}
        </div>

        <div className="border-t border-border mt-2" />

        {/* Chat list -- always visible, regardless of the active route */}
        <div className={`flex-1 overflow-y-auto scrollbar-hide py-2 ${mobile ? "px-3" : "px-2"}`}>
          {searchOpen && (
            <div className={`flex items-center gap-2 rounded-lg border border-border bg-raised mb-2 ${mobile ? "px-3 py-2.5" : "px-2 py-1.5"}`}>
              <Search size={mobile ? 16 : 9} className="text-text-faint shrink-0" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className={`text-text-primary bg-transparent outline-none placeholder:text-text-faint flex-1 w-0 ${mobile ? "text-base" : "text-[10px]"}`}
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <p className={`text-text-faint text-center mt-6 ${mobile ? "text-sm" : "text-[10px]"}`}>No chats yet</p>
          ) : (
            <>
              <SessionGroup label="Pinned" items={pinned} icon={<Pin size={mobile ? 12 : 9} className="text-accent" />} {...groupProps} />
              <SessionGroup label="Today" items={today} {...groupProps} />
              <SessionGroup label="Yesterday" items={yesterday} {...groupProps} />
              <SessionGroup label="Older" items={older} {...groupProps} />
            </>
          )}

          <div className="mt-3 pt-2 border-t border-border">
            <p className={`px-2 mb-1 font-mono uppercase tracking-widest text-text-faint ${mobile ? "text-[11px]" : "text-[9px]"}`}>
              Library
            </p>
            {LIBRARY_ITEMS.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className={`${libRow} ${
                  pathname === href ? "text-accent bg-accent/10" : "text-text-faint hover:text-text-muted hover:bg-raised/50"
                }`}
              >
                <Icon size={mobile ? 16 : 10} className="shrink-0" />
                <span className={mobile ? "text-base" : "text-[10px]"}>{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer: identity block */}
        <div className={`border-t border-border flex items-center justify-between ${mobile ? "px-3 py-3" : "px-2.5 py-2.5"}`}>
          <button
            onClick={onSettings}
            className={`flex items-center min-w-0 text-left rounded-md hover:bg-raised/50 transition-colors ${
              mobile ? "gap-3 py-1 pr-2 min-h-[44px]" : "gap-2 -ml-0.5 pl-0.5 py-0.5 pr-1"
            }`}
            aria-label="Open settings"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className={`rounded-full object-cover border border-border shrink-0 ${mobile ? "w-10 h-10" : "w-6 h-6"}`}
              />
            ) : (
              <div className={`rounded-full bg-accent/15 flex items-center justify-center text-accent font-mono shrink-0 border border-accent/20 ${mobile ? "w-10 h-10 text-sm" : "w-6 h-6 text-[9px]"}`}>
                {displayName[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-text-primary font-medium truncate leading-tight ${mobile ? "text-sm" : "text-[10px]"}`}>{displayName}</p>
              {roleDisplay && (
                <p className={`text-text-faint truncate leading-tight ${mobile ? "text-xs" : "text-[9px]"}`}>{roleDisplay}</p>
              )}
            </div>
          </button>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={onSettings} className={footerButton} aria-label="Settings">
              <Settings size={mobile ? 20 : 11} />
            </button>
            <button onClick={onSignOut} className={`${footerButton} hover:!text-red-400`} aria-label="Sign out">
              <LogOut size={mobile ? 20 : 11} />
            </button>
          </div>
        </div>
      </>
    );
  };

  const desktopSidebar = collapsed ? (
    <CollapsedRail
      sessions={sessions}
      pinnedIds={pinnedIds}
      activeSessionId={activeSessionId}
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
      {renderBody(false)}
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
            className="fixed top-0 left-0 bottom-0 z-50 w-[88vw] max-w-sm bg-surface border-r border-border flex flex-col md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Chat menu"
          >
            <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0">
              <Link href="/dashboard" onClick={onMobileClose} aria-label="Prompt AI home">
                <Logo variant="color" size={34} />
              </Link>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSearchOpen((v) => !v)}
                  className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors ${
                    searchOpen ? "text-accent bg-accent/10" : "text-text-faint hover:text-text-muted hover:bg-raised"
                  }`}
                  aria-label="Search chats"
                >
                  <Search size={20} />
                </button>
                <button
                  onClick={onMobileClose}
                  className="w-11 h-11 flex items-center justify-center rounded-lg text-text-faint hover:text-text-muted hover:bg-raised transition-colors"
                  aria-label="Close menu"
                >
                  <X size={22} />
                </button>
              </div>
            </div>
            {renderBody(true)}
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
