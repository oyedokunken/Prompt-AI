"use client";

import { useState } from "react";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import {
  Plus, Search, MessageSquare, Settings, LogOut,
  PanelLeftClose, PanelLeftOpen, Paperclip, Download, History,
  BookOpen, Star, Trash2, Image, FileText,
  Film, FileDown, FileJson, FileType,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import type { ChatSession, SidebarPanel, SavedPrompt } from "@/lib/types/chat";
import type { ExportRecord } from "@/lib/hooks/useExportHistory";

export interface SidebarAttachment {
  name: string;
  type: string;
  publicUrl: string;
}

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | undefined;
  panel: SidebarPanel;
  onPanelChange: (p: SidebarPanel) => void;
  onNewChat: () => void;
  onSelectSession: (s: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  username: string;
  avatarUrl: string | null;
  onSettings: () => void;
  onSignOut: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAttach?: (file: File) => void;
  attachments?: SidebarAttachment[];
  exportHistory?: ExportRecord[];
  preferredName?: string | null;
  roleDisplay?: string;
  onToggleSessionFavorite?: (id: string, next: boolean) => void;
  savedPrompts?: SavedPrompt[];
  onToggleSavedFavorite?: (id: string, next: boolean) => void;
  onDeleteSavedPrompt?: (id: string) => void;
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

const NAV_ITEMS: { id: SidebarPanel; icon: React.ElementType; label: string }[] = [
  { id: "media", icon: Paperclip, label: "Media" },
  { id: "exports", icon: Download, label: "Exports" },
];

const EXPORT_FORMAT_ICON: Record<string, React.ElementType> = {
  pdf: FileType,
  markdown: FileDown,
  txt: FileText,
  json: FileJson,
};

const EXPORT_FILTERS: { id: "all" | "pdf" | "markdown" | "txt"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pdf", label: "PDF" },
  { id: "markdown", label: "Markdown" },
  { id: "txt", label: "Text" },
];

// Collapsed rail -- icon-only, every control gets a hover tooltip so the
// sidebar stays fully usable without expanding it.
function CollapsedRail({
  onNewChat, onToggleCollapse, onSearch, panel, onPanelChange, onSettings, onSignOut, avatarUrl, username,
}: {
  onNewChat: () => void;
  onToggleCollapse: () => void;
  onSearch: () => void;
} & Pick<SidebarProps, "panel" | "onPanelChange" | "onSettings" | "onSignOut" | "avatarUrl" | "username">) {
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
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            data-tooltip-id="sidebar-tip"
            data-tooltip-content={label}
            onClick={() => onPanelChange(id)}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              panel === id ? "text-accent bg-accent/10" : "text-text-faint hover:text-text-muted hover:bg-raised"
            }`}
            aria-label={label}
          >
            <Icon size={13} />
          </button>
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
        data-tooltip-content={`@${username} — Settings`}
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

export function Sidebar({
  sessions,
  activeSessionId,
  panel,
  onPanelChange,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  username,
  avatarUrl,
  onSettings,
  onSignOut,
  collapsed,
  onToggleCollapse,
  onAttach,
  attachments = [],
  exportHistory = [],
  preferredName,
  roleDisplay,
  onToggleSessionFavorite,
  savedPrompts = [],
  onToggleSavedFavorite,
  onDeleteSavedPrompt,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [exportFilter, setExportFilter] = useState<"all" | "pdf" | "markdown" | "txt">("all");
  const displayName = preferredName || username;

  const handleSearchClick = () => {
    onPanelChange("history");
    setSearchOpen((v) => !v);
  };

  if (collapsed) {
    return (
      <CollapsedRail
        onNewChat={onNewChat}
        onToggleCollapse={onToggleCollapse}
        onSearch={() => { onToggleCollapse(); setSearchOpen(true); onPanelChange("history"); }}
        panel={panel}
        onPanelChange={onPanelChange}
        onSettings={onSettings}
        onSignOut={onSignOut}
        avatarUrl={avatarUrl}
        username={username}
      />
    );
  }

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );
  const { today, yesterday, older } = groupSessions(filtered);

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttach) onAttach(file);
    e.target.value = "";
  };

  const imagesFiles = attachments.filter((a) => a.type.startsWith("image/"));
  const videoFiles = attachments.filter((a) => a.type.startsWith("video/"));
  const pdfFiles = attachments.filter((a) => a.type === "application/pdf");

  const filteredExports = exportHistory.filter(
    (e) => exportFilter === "all" || e.format === exportFilter
  );

  const SessionItem = ({ s }: { s: ChatSession }) => (
    <div
      key={s.id}
      onMouseEnter={() => setHoveredId(s.id)}
      onMouseLeave={() => setHoveredId(null)}
      onClick={() => onSelectSession(s)}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 cursor-pointer transition-colors ${
        s.id === activeSessionId
          ? "bg-raised text-text-primary"
          : "text-text-faint hover:text-text-muted hover:bg-raised/50"
      }`}
    >
      <MessageSquare size={10} className="shrink-0" />
      <span className="text-[10px] truncate flex-1">{s.title}</span>
      {(hoveredId === s.id || s.is_favorite) && onToggleSessionFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSessionFavorite(s.id, !s.is_favorite); }}
          className={`p-0.5 transition-colors ${s.is_favorite ? "text-accent" : "text-text-faint hover:text-accent"}`}
          aria-label={s.is_favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={9} fill={s.is_favorite ? "currentColor" : "none"} />
        </button>
      )}
      {hoveredId === s.id && (
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
          className="p-0.5 text-text-faint hover:text-red-400 transition-colors"
          aria-label="Delete chat"
        >
          <Trash2 size={9} />
        </button>
      )}
    </div>
  );

  const SessionGroup = ({ label, items }: { label: string; items: ChatSession[] }) => {
    if (!items.length) return null;
    return (
      <div className="mb-2">
        <p className="px-2 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">
          {label}
        </p>
        {items.map((s) => <SessionItem key={s.id} s={s} />)}
      </div>
    );
  };

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface flex-col hidden md:flex">
      {/* Brand + collapse + search, one row */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <Logo variant="color" size={18} />
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleSearchClick}
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

      {/* New chat */}
      <div className="px-2 pt-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-accent/10 border border-accent/20 text-[11px] font-medium text-accent hover:bg-accent/15 transition-colors"
        >
          <Plus size={11} /> New chat
        </button>
      </div>

      {/* Nav: Media, Exports */}
      <div className="px-2 pt-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onPanelChange(panel === id ? "history" : id)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              panel === id ? "text-accent bg-accent/10" : "text-text-muted hover:text-text-primary hover:bg-raised"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="border-t border-border mt-2" />

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 py-2">

        {/* HISTORY / chat list panel (default) */}
        {panel === "history" && (
          <>
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
                <SessionGroup label="Today" items={today} />
                <SessionGroup label="Yesterday" items={yesterday} />
                <SessionGroup label="Older" items={older} />
              </>
            )}

            <div className="mt-3 pt-2 border-t border-border">
              <p className="px-2 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">
                Library
              </p>
              {[
                { icon: BookOpen, label: "Saved prompts", panel: "saved" as SidebarPanel },
                { icon: Star, label: "Favorites", panel: "favorites" as SidebarPanel },
                { icon: History, label: "All history", panel: "history" as SidebarPanel },
              ].map(({ icon: Icon, label, panel: target }) => (
                <button
                  key={label}
                  onClick={() => { onPanelChange(target); if (target === "history") setSearchOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-text-faint hover:text-text-muted hover:bg-raised/50 cursor-pointer transition-colors"
                >
                  <Icon size={10} className="shrink-0" />
                  <span className="text-[10px]">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* SAVED PROMPTS panel */}
        {panel === "saved" && (
          <div className="space-y-1">
            {savedPrompts.length === 0 ? (
              <p className="text-[10px] text-text-faint text-center mt-6">
                No saved prompts yet. Save one from any response in a chat.
              </p>
            ) : (
              savedPrompts.map((p) => (
                <div
                  key={p.id}
                  className="group flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-raised/50 transition-colors"
                >
                  <BookOpen size={10} className="shrink-0 mt-0.5 text-text-faint" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-text-primary truncate">{p.title}</p>
                    <p className="text-[9px] text-text-faint font-mono">
                      {new Date(p.created_at).toLocaleDateString()}
                      {p.score !== null ? ` · ${p.score}/100` : ""}
                    </p>
                  </div>
                  {onToggleSavedFavorite && (
                    <button
                      onClick={() => onToggleSavedFavorite(p.id, !p.is_favorite)}
                      className={`p-0.5 shrink-0 transition-colors ${p.is_favorite ? "text-accent" : "text-text-faint opacity-0 group-hover:opacity-100 hover:text-accent"}`}
                      aria-label={p.is_favorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star size={9} fill={p.is_favorite ? "currentColor" : "none"} />
                    </button>
                  )}
                  {onDeleteSavedPrompt && (
                    <button
                      onClick={() => onDeleteSavedPrompt(p.id)}
                      className="p-0.5 shrink-0 text-text-faint opacity-0 group-hover:opacity-100 hover:text-red-400 transition-colors"
                      aria-label="Delete saved prompt"
                    >
                      <Trash2 size={9} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* FAVORITES panel -- starred sessions and starred saved prompts together */}
        {panel === "favorites" && (
          <div className="space-y-3">
            {(() => {
              const favSessions = sessions.filter((s) => s.is_favorite);
              const favPrompts = savedPrompts.filter((p) => p.is_favorite);
              if (favSessions.length === 0 && favPrompts.length === 0) {
                return (
                  <p className="text-[10px] text-text-faint text-center mt-6">
                    Star a chat or a saved prompt to see it here.
                  </p>
                );
              }
              return (
                <>
                  {favSessions.length > 0 && (
                    <div>
                      <p className="px-2 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">Chats</p>
                      {favSessions.map((s) => <SessionItem key={s.id} s={s} />)}
                    </div>
                  )}
                  {favPrompts.length > 0 && (
                    <div>
                      <p className="px-2 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">Saved prompts</p>
                      {favPrompts.map((p) => (
                        <div
                          key={p.id}
                          className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-raised/50 transition-colors"
                        >
                          <BookOpen size={10} className="shrink-0 text-text-faint" />
                          <span className="text-[10px] text-text-primary truncate flex-1">{p.title}</span>
                          {onToggleSavedFavorite && (
                            <button
                              onClick={() => onToggleSavedFavorite(p.id, false)}
                              className="p-0.5 text-accent"
                              aria-label="Remove from favorites"
                            >
                              <Star size={9} fill="currentColor" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* MEDIA panel */}
        {panel === "media" && (
          <div className="space-y-3">
            <label className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border text-[10px] text-text-faint hover:border-accent/40 hover:text-accent transition-colors cursor-pointer">
              <Plus size={10} />
              Upload file
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*,.pdf"
                onChange={handleUploadChange}
              />
            </label>
            <p className="text-[9px] text-text-faint px-0.5 -mt-1.5">
              Attaches to your next message in this chat.
            </p>

            {[
              { label: "Images", icon: Image, files: imagesFiles },
              { label: "Videos", icon: Film, files: videoFiles },
              { label: "PDFs", icon: FileText, files: pdfFiles },
            ].map(({ label, icon: Icon, files }) => (
              <div key={label}>
                <p className="px-1 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint flex items-center gap-1.5">
                  <Icon size={9} /> {label}
                </p>
                {files.length === 0 ? (
                  <p className="text-[10px] text-text-faint px-1">No files yet</p>
                ) : (
                  <div className="space-y-1">
                    {files.map((f) => (
                      <a
                        key={f.publicUrl}
                        href={f.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-raised/50 transition-colors truncate"
                      >
                        <span className="text-[10px] truncate">{f.name}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* EXPORTS history panel -- a log of past exports, not an action */}
        {panel === "exports" && (
          <div className="space-y-2">
            <p className="text-[10px] text-text-faint px-0.5">
              Everything you have exported so far. Export a conversation from its chat header.
            </p>

            <div className="flex gap-1">
              {EXPORT_FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setExportFilter(id)}
                  className={`px-2 py-1 rounded-md text-[9px] font-mono uppercase tracking-wide transition-colors ${
                    exportFilter === id
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : "text-text-faint border border-transparent hover:text-text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredExports.length === 0 ? (
              <p className="text-[10px] text-text-faint text-center mt-6">No exports yet</p>
            ) : (
              <div className="space-y-1 mt-1">
                {filteredExports.map((record) => {
                  const Icon = EXPORT_FORMAT_ICON[record.format] ?? FileText;
                  return (
                    <div
                      key={record.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-raised/50 transition-colors"
                    >
                      <Icon size={11} className="text-accent shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-text-primary truncate">{record.session_title}</p>
                        <p className="text-[9px] text-text-faint font-mono">
                          {record.format} - {new Date(record.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - identity block */}
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
    </aside>
  );
}
