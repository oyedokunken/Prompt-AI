"use client";

import { useState, useEffect } from "react";
import {
  Github, ArrowRight, Plus, Search, MessageSquare,
  BookOpen, Settings, Paperclip, ChevronDown, History,
  Zap, PanelLeftClose, Star, LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const CHAT_HISTORY = [
  { label: "Rate limiting middleware", active: true },
  { label: "Login form component", active: false },
  { label: "CI pipeline setup", active: false },
  { label: "JWT refresh endpoint", active: false },
  { label: "Blog post generator", active: false },
];

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; content: string }>>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("User");

  useEffect(() => {
    const loadUserData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setAvatarUrl(user.user_metadata.avatar_url || null);
        setUsername(user.email?.split("@")[0] || "User");
      }
    };
    loadUserData();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: inputValue }]);
    setInputValue("");
  };

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0B]">
      {/* Window chrome */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-[#0D0D0F] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" aria-hidden="true" />
          </div>
        </div>
        <span className="font-mono text-[11px] text-text-faint">Prompt AI</span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-raised cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-signal" aria-hidden="true" />
          <span className="font-mono text-[10px] text-text-muted">Claude 3.5 Sonnet</span>
          <ChevronDown size={10} className="text-text-faint" />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-52 shrink-0 border-r border-border bg-[#0D0D0F] flex-col hidden md:flex">

            {/* Logo */}
            <div className="px-3 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
                  <Zap size={12} style={{ color: "#0A0A0B" }} />
                </div>
                <span className="text-[13px] font-semibold text-text-primary">Prompt AI</span>
              </div>
            </div>

            {/* New Chat */}
            <div className="px-2.5 pt-2.5 pb-1.5">
              <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-[11px] font-medium text-accent hover:bg-accent/15 transition-colors">
                <Plus size={12} /> New Chat
              </button>
            </div>

            {/* Search */}
            <div className="px-2.5 pb-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-raised">
                <Search size={10} className="text-text-faint shrink-0" />
                <span className="text-[10px] text-text-faint">Search chats...</span>
              </div>
            </div>

            {/* History */}
            <div className="flex-1 overflow-hidden px-2 py-1">
              <p className="px-1.5 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">Recent</p>
              {CHAT_HISTORY.map((h) => (
                <div key={h.label} className={`flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg mb-0.5 cursor-pointer ${h.active ? "bg-raised text-text-primary" : "text-text-faint hover:text-text-muted"}`}>
                  <MessageSquare size={10} className="shrink-0" />
                  <span className="text-[10px] truncate">{h.label}</span>
                </div>
              ))}

              <div className="mt-3">
                <p className="px-1.5 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">Library</p>
                <div className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-text-faint hover:text-text-muted cursor-pointer">
                  <BookOpen size={10} className="shrink-0" />
                  <span className="text-[10px]">Saved prompts</span>
                </div>
                <div className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-text-faint hover:text-text-muted cursor-pointer">
                  <Star size={10} className="shrink-0" />
                  <span className="text-[10px]">Favorites</span>
                </div>
                <div className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-text-faint hover:text-text-muted cursor-pointer">
                  <History size={10} className="shrink-0" />
                  <span className="text-[10px]">All history</span>
                </div>
              </div>
            </div>

            {/* Bottom */}
            <div className="px-2.5 py-2.5 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-5 h-5 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] text-accent font-mono">
                    {username[0].toUpperCase()}
                  </div>
                )}
                <span className="text-[10px] text-text-muted truncate max-w-[80px]">@{username}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-0.5 text-text-faint hover:text-text-muted transition-colors"
                >
                  <PanelLeftClose size={11} />
                </button>
                <button
                  onClick={() => router.push("/settings")}
                  className="p-0.5 text-text-faint hover:text-text-muted transition-colors"
                  title="Settings"
                >
                  <Settings size={11} />
                </button>
                <button
                  onClick={handleSignOut}
                  className="p-0.5 text-text-faint hover:text-text-muted transition-colors"
                  title="Sign out"
                >
                  <LogOut size={11} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages area */}
          <div className="flex-1 overflow-hidden p-4 sm:p-5 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-text-muted text-sm mb-2">Start a new conversation</p>
                  <p className="text-text-faint text-xs">Describe what you need in plain language</p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex gap-3"}>
                  {msg.role === "ai" && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-signal/30" style={{ background: "rgba(139,124,246,0.1)" }}>
                      <span className="font-mono text-[10px] text-signal">P</span>
                    </div>
                  )}
                  <div className="max-w-[85%] sm:max-w-[65%]">
                    <div className={`rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "rounded-br-md bg-raised border border-border"
                        : "rounded-tl-md bg-base border border-border"
                    }`}>
                      <p className="text-sm text-text-primary leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                    <p className="text-[10px] text-text-faint mt-1 font-mono">{msg.role === "user" ? "You" : "Prompt AI"}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input bar */}
          <div className="px-4 sm:px-5 pb-4">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-raised px-3 py-2.5">
              <button className="p-1 text-text-faint hover:text-text-muted transition-colors" aria-label="Attach file">
                <Paperclip size={14} />
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Describe what you need..."
                className="text-sm text-text-primary flex-1 bg-transparent outline-none placeholder:text-text-faint"
              />
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-text-faint hidden sm:block">↵</span>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send"
                >
                  <ArrowRight size={13} style={{ color: "#0A0A0B" }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
