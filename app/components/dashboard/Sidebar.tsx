"use client";

import { useState } from "react";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import {
  Plus, Search, MessageSquare, Settings, LogOut,
  PanelLeftClose, PanelLeftOpen, Paperclip, Download, History,
  BookOpen, Star, Clock, Trash2, Image, FileText,
  Film, Copy, Check,
} from "lucide-react";
import type { ChatSession, ExportFormat, SidebarPanel } from "@/lib/types/chat";

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
  onExport: (format: ExportFormat) => void;
  onCopyMarkdown: () => void;
  username: string;
  avatarUrl: string | null;
  onSettings: () => void;
  onSignOut: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAttach?: (file: File) => void;
  attachments?: SidebarAttachment[];
  activePath?: "history" | "settings";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

const PANEL_TABS: { id: SidebarPanel; icon: React.ElementType; label: string }[] = [
  { id: "history", icon: MessageSquare, label: "Chats" },
  { id: "media", icon: Paperclip, label: "Media" },
  { id: "export", icon: Download, label: "Export" },
];

// Collapsed rail -- icon-only, every control gets a hover tooltip so the
// sidebar stays fully usable without expanding it.
function CollapsedRail({
  onNewChat, onToggleCollapse, panel, onPanelChange, onSettings, onSignOut, avatarUrl, username,
}: Pick<SidebarProps, "onNewChat" | "onToggleCollapse" | "panel" | "onPanelChange" | "onSettings" | "onSignOut" | "avatarUrl" | "username">) {
  return (
    <aside className="w-12 shrink-0 border-r border-border bg-surface flex-col items-center hidden md:flex py-2.5">
      <Tooltip id="sidebar-tip" place="right" className="!text-[10px] !py-1 !px-2 !z-50" />

      <button
        data-tooltip-id="sidebar-tip"
        data-tooltip-content="Expand sidebar"
        onClick={onToggleCollapse}
        className="w-7 h-7 rounded-md flex items-center justify-center text-text-faint hover:text-text-muted hover:bg-raised transition-colors mb-3"
        aria-label="Expand sidebar"
      >
        <PanelLeftOpen size={13} />
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
        {PANEL_TABS.map(({ id, icon: Icon, label }) => (
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

      <div data-tooltip-id="sidebar-tip" data-tooltip-content={`@${username}`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-border" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[9px] text-accent font-mono border border-accent/20">
            {username[0]?.toUpperCase()}
          </div>
        )}
      </div>
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
  onExport,
  onCopyMarkdown,
  username,
  avatarUrl,
  onSettings,
  onSignOut,
  collapsed,
  onToggleCollapse,
  onAttach,
  attachments = [],
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (collapsed) {
    return (
      <CollapsedRail
        onNewChat={onNewChat}
        onToggleCollapse={onToggleCollapse}
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

  const handleCopy = () => {
    onCopyMarkdown();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttach) onAttach(file);
    e.target.value = "";
  };

  const imagesFiles = attachments.filter((a) => a.type.startsWith("image/"));
  const videoFiles = attachments.filter((a) => a.type.startsWith("video/"));
  const pdfFiles = attachments.filter((a) => a.type === "application/pdf");

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
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-base border border-border flex items-center justify-center shrink-0">
            <span className="font-mono text-[9px] text-accent font-bold">P</span>
          </div>
          <span className="text-[12px] font-semibold text-text-primary">Prompt AI</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewChat}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/10 border border-accent/20 text-[10px] font-medium text-accent hover:bg-accent/15 transition-colors"
            aria-label="New chat"
          >
            <Plus size={10} /> New
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 text-text-faint hover:text-text-muted transition-colors"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={12} />
          </button>
        </div>
      </div>

      {/* Panel tabs */}
      <div className="flex border-b border-border">
        {PANEL_TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onPanelChange(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-mono uppercase tracking-wider transition-colors ${
              panel === id
                ? "text-accent border-b border-accent"
                : "text-text-faint hover:text-text-muted"
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 py-2">

        {/* HISTORY panel */}
        {panel === "history" && (
          <>
            {/* Search */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-raised mb-2">
              <Search size={9} className="text-text-faint shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className="text-[10px] text-text-primary bg-transparent outline-none placeholder:text-text-faint flex-1 w-0"
              />
            </div>

            {/* Session groups */}
            {filtered.length === 0 ? (
              <p className="text-[10px] text-text-faint text-center mt-6">No chats yet</p>
            ) : (
              <>
                <SessionGroup label="Today" items={today} />
                <SessionGroup label="Yesterday" items={yesterday} />
                <SessionGroup label="Older" items={older} />
              </>
            )}

            {/* Library */}
            <div className="mt-3 pt-2 border-t border-border">
              <p className="px-2 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">
                Library
              </p>
              {[
                { icon: BookOpen, label: "Saved prompts" },
                { icon: Star, label: "Favorites" },
                { icon: History, label: "All history" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-text-faint hover:text-text-muted cursor-pointer transition-colors"
                >
                  <Icon size={10} className="shrink-0" />
                  <span className="text-[10px]">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* MEDIA panel */}
        {panel === "media" && (
          <div className="space-y-3">
            {/* Upload button */}
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

            {/* Bucket groups */}
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

        {/* EXPORT panel */}
        {panel === "export" && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-text-faint mb-3">
              Export the active conversation.
            </p>
            {[
              {
                label: copied ? "Copied!" : "Copy as Markdown",
                icon: copied ? Check : Copy,
                action: handleCopy,
                desc: "Copy to clipboard",
              },
              {
                label: "Download .pdf",
                icon: Download,
                action: () => onExport("pdf"),
                desc: "Formatted PDF report",
              },
              {
                label: "Download .md",
                icon: Download,
                action: () => onExport("markdown"),
                desc: "Markdown file",
              },
              {
                label: "Download .txt",
                icon: Download,
                action: () => onExport("txt"),
                desc: "Plain text",
              },
              {
                label: "Download .json",
                icon: Download,
                action: () => onExport("json"),
                desc: "Raw JSON",
              },
            ].map(({ label, icon: Icon, action, desc }) => (
              <button
                key={label}
                onClick={action}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border hover:border-accent/30 hover:bg-raised/50 transition-colors text-left"
              >
                <Icon size={11} className="text-accent shrink-0" />
                <div>
                  <p className="text-[10px] font-medium text-text-primary">{label}</p>
                  <p className="text-[9px] text-text-faint">{desc}</p>
                </div>
              </button>
            ))}

            {/* Last updated */}
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[9px] text-text-faint flex items-center gap-1">
                <Clock size={9} />
                Exports include all messages in the active chat.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer – user */}
      <div className="px-2.5 py-2.5 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-5 h-5 rounded-full object-cover border border-border shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center text-[9px] text-accent font-mono shrink-0 border border-accent/20">
              {username[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-[10px] text-text-muted truncate">@{username}</span>
        </div>
        <div className="flex items-center gap-0.5">
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
