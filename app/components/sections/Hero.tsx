"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Github, ArrowRight, Plus, Search, MessageSquare,
  BookOpen, Settings, Paperclip, ChevronDown, History,
  Zap, PanelLeftClose, Star,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const TRANSFORM_PAIRS = [
  {
    input: "make a login form",
    output: [
      { type: "role", content: `ROLE: Senior frontend engineer` },
      { type: "context", content: `CONTEXT: React 18, TypeScript, Tailwind CSS` },
      { type: "task", content: `TASK: Build a login form component with:` },
      { type: "detail", content: `  - Email input (validated, trimmed)` },
      { type: "detail", content: `  - Password input (min 8 chars, toggle)` },
      { type: "detail", content: `  - Submit with loading state` },
      { type: "constraint", content: `CONSTRAINTS: Accessible, keyboard-nav, WCAG 2.1 AA` },
      { type: "output", content: `OUTPUT: Full component + type definitions` },
    ],
  },
  {
    input: "write an api endpoint",
    output: [
      { type: "role", content: `ROLE: Backend engineer` },
      { type: "context", content: `CONTEXT: Node.js, Express, PostgreSQL` },
      { type: "task", content: `TASK: Create a REST endpoint that:` },
      { type: "detail", content: `  - Validates request body with zod` },
      { type: "detail", content: `  - Queries with parameterized SQL` },
      { type: "detail", content: `  - Returns structured JSON responses` },
      { type: "constraint", content: `CONSTRAINTS: Rate limited, auth-gated` },
      { type: "output", content: `OUTPUT: Route handler + error middleware` },
    ],
  },
  {
    input: "set up a ci pipeline",
    output: [
      { type: "role", content: `ROLE: DevOps engineer` },
      { type: "context", content: `CONTEXT: GitHub Actions, Node.js monorepo` },
      { type: "task", content: `TASK: Configure a CI workflow with:` },
      { type: "detail", content: `  - Lint, type-check, unit tests` },
      { type: "detail", content: `  - Parallel job execution` },
      { type: "detail", content: `  - Artifact caching by lockfile hash` },
      { type: "constraint", content: `CONSTRAINTS: Fail fast, cache dependencies` },
      { type: "output", content: `OUTPUT: .github/workflows/ci.yml` },
    ],
  },
];

const TOKEN_COLORS: Record<string, string> = {
  role: "#F2A93B",
  context: "#8B7CF6",
  task: "#EDEDEF",
  detail: "#8B8B93",
  constraint: "#F2A93B",
  output: "#8B7CF6",
};

const CHAT_HISTORY = [
  { label: "Rate limiting middleware", active: true },
  { label: "Login form component", active: false },
  { label: "CI pipeline setup", active: false },
  { label: "JWT refresh endpoint", active: false },
  { label: "Blog post generator", active: false },
];

type AnimationPhase =
  | "typing"
  | "typed-pause"
  | "revealing"
  | "revealed-pause"
  | "clearing";

export function Hero() {
  const prefersReducedMotion = useReducedMotion();
  const [pairIndex, setPairIndex] = useState(0);
  const [phase, setPhase] = useState<AnimationPhase>("typing");
  const [typedLength, setTypedLength] = useState(0);
  const [revealedLines, setRevealedLines] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pair = TRANSFORM_PAIRS[pairIndex];

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    if (prefersReducedMotion) return;

    clearTimer();

    if (phase === "typing") {
      if (typedLength < pair.input.length) {
        timerRef.current = setTimeout(() => {
          setTypedLength((n) => n + 1);
        }, 55 + Math.random() * 30);
      } else {
        timerRef.current = setTimeout(() => setPhase("typed-pause"), 700);
      }
    }

    if (phase === "typed-pause") {
      timerRef.current = setTimeout(() => setPhase("revealing"), 400);
    }

    if (phase === "revealing") {
      if (revealedLines < pair.output.length) {
        timerRef.current = setTimeout(() => {
          setRevealedLines((n) => n + 1);
        }, 120);
      } else {
        timerRef.current = setTimeout(() => setPhase("revealed-pause"), 400);
      }
    }

    if (phase === "revealed-pause") {
      timerRef.current = setTimeout(() => setPhase("clearing"), 3200);
    }

    if (phase === "clearing") {
      timerRef.current = setTimeout(() => {
        setTypedLength(0);
        setRevealedLines(0);
        setPairIndex((i) => (i + 1) % TRANSFORM_PAIRS.length);
        setPhase("typing");
      }, 300);
    }

    return clearTimer;
  }, [phase, typedLength, revealedLines, pair, prefersReducedMotion]);

  const displayedInput = prefersReducedMotion
    ? pair.input
    : pair.input.slice(0, typedLength);

  const showCursor =
    !prefersReducedMotion &&
    (phase === "typing" || phase === "typed-pause");

  const visibleLines = prefersReducedMotion
    ? pair.output
    : pair.output.slice(0, revealedLines);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 overflow-hidden">
      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="hero-dot-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className="fill-border" fillOpacity="0.7" />
          </pattern>
          <radialGradient id="hero-dot-fade" cx="50%" cy="10%" r="70%" gradientUnits="userSpaceOnUse" gradientTransform="scale(1 1.4)">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="55%" stopColor="white" stopOpacity="0.4" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="hero-dot-mask">
            <rect width="100%" height="100%" fill="url(#hero-dot-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dot-grid)" mask="url(#hero-dot-mask)" />
      </svg>

      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(242,169,59,0.07) 0%, transparent 60%)" }} />

      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-10">

        {/* Headline */}
        <div className="flex flex-col items-center text-center gap-5 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <span className="font-mono text-xs uppercase tracking-widest text-text-faint px-3 py-1.5 border border-border rounded-full">
              Prompt engineering, automated
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-text-primary leading-tight"
          >
            Turn rough ideas into{" "}
            <span className="text-accent">production-ready prompts</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-base sm:text-lg text-text-muted leading-relaxed max-w-2xl"
          >
            Describe what you need in plain language. Prompt AI constructs a complete, structured prompt with role, context, constraints, and output format, optimized for the model you are targeting.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold hover:bg-accent-fill/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Start free <ArrowRight size={15} />
            </Link>
            <a href="https://github.com/oyedokunken/Prompt-AI" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-muted hover:text-text-primary hover:border-border/80 transition-colors focus-visible:outline-accent">
              <Github size={15} /> View on GitHub
            </a>
          </motion.div>
        </div>

        {/* Full chat app mockup */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="w-full"
          aria-label="Prompt AI chat interface"
        >
          {/* This mockup always renders in dark, like a fixed product screenshot,
              regardless of the site's own light or dark theme. The "dark"
              class rescopes every token below to the dark palette. */}
          <div className="dark rounded-xl border border-border bg-surface text-text-primary shadow-2xl overflow-hidden" style={{ height: "520px" }}>

            {/* Window chrome */}
            <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-[#0D0D0F] shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" aria-hidden="true" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" aria-hidden="true" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" aria-hidden="true" />
                </div>
              </div>
              <span className="font-mono text-[11px] text-text-faint">Rate limiting middleware</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-raised cursor-default">
                <span className="w-1.5 h-1.5 rounded-full bg-signal" aria-hidden="true" />
                <span className="font-mono text-[10px] text-text-muted">Claude 3.5 Sonnet</span>
                <ChevronDown size={10} className="text-text-faint" />
              </div>
            </div>

            {/* Body */}
            <div className="flex" style={{ height: "calc(100% - 40px)" }}>

              {/* Sidebar */}
              <div className="w-52 shrink-0 border-r border-border bg-[#0D0D0F] flex-col hidden md:flex">

                {/* Logo */}
                <div className="px-3 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-accent-fill flex items-center justify-center shrink-0">
                      <Zap size={12} className="text-accent-fill-foreground" />
                    </div>
                    <span className="text-[13px] font-semibold text-text-primary">Prompt AI</span>
                  </div>
                </div>

                {/* New Chat */}
                <div className="px-2.5 pt-2.5 pb-1.5">
                  <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-[11px] font-medium text-accent hover:bg-accent/15 transition-colors cursor-default">
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
                    <div key={h.label} className={`flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg mb-0.5 cursor-default ${h.active ? "bg-raised text-text-primary" : "text-text-faint"}`}>
                      <MessageSquare size={10} className="shrink-0" />
                      <span className="text-[10px] truncate">{h.label}</span>
                    </div>
                  ))}

                  <div className="mt-3">
                    <p className="px-1.5 mb-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">Library</p>
                    <div className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-text-faint cursor-default">
                      <BookOpen size={10} className="shrink-0" />
                      <span className="text-[10px]">Saved prompts</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-text-faint cursor-default">
                      <Star size={10} className="shrink-0" />
                      <span className="text-[10px]">Favorites</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-text-faint cursor-default">
                      <History size={10} className="shrink-0" />
                      <span className="text-[10px]">All history</span>
                    </div>
                  </div>
                </div>

                {/* Bottom */}
                <div className="px-2.5 py-2.5 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="https://i.pravatar.cc/32?img=12" alt="" className="w-5 h-5 rounded-full" aria-hidden="true" />
                    <span className="text-[10px] text-text-muted truncate max-w-[80px]">@oyedokunken</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-0.5 text-text-faint hover:text-text-muted transition-colors cursor-default">
                      <PanelLeftClose size={11} />
                    </button>
                    <button className="p-0.5 text-text-faint hover:text-text-muted transition-colors cursor-default">
                      <Settings size={11} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Main chat area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Messages area */}
                <div className="flex-1 overflow-hidden p-4 sm:p-5 flex flex-col gap-4 justify-end">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] sm:max-w-[65%]">
                      <div className="rounded-2xl rounded-br-md bg-raised border border-border px-4 py-2.5">
                        <p className="text-sm text-text-primary leading-relaxed">
                          {displayedInput}
                          {showCursor && (
                            <span className="inline-block w-[2px] h-[1em] bg-accent ml-[1px] align-text-bottom animate-blink" aria-hidden="true" />
                          )}
                        </p>
                      </div>
                      <p className="text-[10px] text-text-faint text-right mt-1 font-mono">You</p>
                    </div>
                  </div>

                  {/* AI response */}
                  {visibleLines.length > 0 && (
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-signal/30" style={{ background: "rgba(139,124,246,0.1)" }} aria-hidden="true">
                        <span className="font-mono text-[10px] text-signal">P</span>
                      </div>
                      <div className="max-w-[85%] sm:max-w-[75%] flex-1 min-w-0">
                        <div className="rounded-2xl rounded-tl-md bg-base border border-border overflow-hidden">
                          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-text-faint">Structured prompt</span>
                            {visibleLines.length === pair.output.length && (
                              <motion.span
                                initial={prefersReducedMotion ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-signal/30 text-signal bg-signal/5"
                              >
                                94/100
                              </motion.span>
                            )}
                          </div>
                          <div className="px-4 py-3 space-y-0.5">
                            {visibleLines.map((line, i) => (
                              <motion.div
                                key={`${pairIndex}-${i}`}
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25 }}
                                className="font-mono text-xs leading-5 whitespace-pre"
                                style={{ color: TOKEN_COLORS[line.type] ?? "#EDEDEF" }}
                              >
                                {line.content}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-text-faint mt-1 font-mono">Prompt AI</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input bar */}
                <div className="px-4 sm:px-5 pb-4">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-raised px-3 py-2.5">
                    <button className="p-1 text-text-faint hover:text-text-muted transition-colors cursor-default" aria-label="Attach file">
                      <Paperclip size={14} />
                    </button>
                    <span className="text-sm text-text-faint flex-1 select-none">Describe what you need...</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-text-faint hidden sm:block">↵</span>
                      <span className="w-7 h-7 rounded-lg bg-accent-fill text-accent-fill-foreground flex items-center justify-center shrink-0 cursor-default" aria-hidden="true">
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
