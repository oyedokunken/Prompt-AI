"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Github, ArrowRight } from "lucide-react";
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
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="hero-dot-grid"
            x="0"
            y="0"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#232327" fillOpacity="0.45" />
          </pattern>
          <radialGradient
            id="hero-dot-fade"
            cx="50%"
            cy="10%"
            r="70%"
            gradientUnits="userSpaceOnUse"
            gradientTransform="scale(1 1.4)"
          >
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="55%" stopColor="white" stopOpacity="0.4" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="hero-dot-mask">
            <rect width="100%" height="100%" fill="url(#hero-dot-fade)" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#hero-dot-grid)"
          mask="url(#hero-dot-mask)"
        />
      </svg>

      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(242,169,59,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 md:px-10 lg:px-16 flex flex-col items-center gap-12">
        <div className="flex flex-col items-center text-center gap-6 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
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
            Describe what you need in plain language. Prompt AI constructs a
            complete, structured prompt with role, context, constraints, and
            output format, optimized for the model you're targeting.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center gap-3 mt-2"
          >
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-sm font-semibold hover:bg-accent/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{ color: "#0A0A0B" }}
            >
              Start free
              <ArrowRight size={15} />
            </Link>
            <a
              href="https://github.com/oyedokunken/prompt-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-muted hover:text-text-primary hover:border-border/80 transition-colors focus-visible:outline-accent"
            >
              <Github size={15} />
              View on GitHub
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="w-full max-w-5xl"
          aria-label="Live prompt transformation demo"
        >
          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-raised">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-base border border-border flex items-center justify-center font-mono text-xs text-accent font-semibold">
                  &gt;_
                </span>
                <span className="text-sm font-semibold text-text-primary">
                  Prompt AI
                </span>
              </div>
              <span className="font-mono text-xs text-text-faint">
                New session
              </span>
            </div>

            <div className="p-5 sm:p-6 min-h-[340px] flex flex-col gap-5">
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-[85%] sm:max-w-[70%]">
                  <div className="rounded-2xl rounded-br-md bg-raised border border-border px-4 py-3">
                    <p className="text-sm text-text-primary leading-relaxed">
                      {displayedInput}
                      {showCursor && (
                        <span
                          className="inline-block w-[2px] h-[1em] bg-accent ml-[1px] align-text-bottom animate-blink"
                          aria-hidden="true"
                        />
                      )}
                    </p>
                  </div>
                  <p className="text-[10px] text-text-faint text-right mt-1.5 font-mono">
                    You
                  </p>
                </div>
              </div>

              {/* AI response */}
              {visibleLines.length > 0 && (
                <div className="flex gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-signal/30"
                    style={{ background: "rgba(139, 124, 246, 0.1)" }}
                    aria-hidden="true"
                  >
                    <span className="font-mono text-xs text-signal">P</span>
                  </div>
                  <div className="max-w-[85%] sm:max-w-[80%] flex-1">
                    <div className="rounded-2xl rounded-tl-md bg-base border border-border overflow-hidden">
                      <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
                          Structured prompt
                        </span>
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
                            initial={
                              prefersReducedMotion ? false : { opacity: 0, y: 4 }
                            }
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
                    <p className="text-[10px] text-text-faint mt-1.5 font-mono">
                      Prompt AI
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Chat input bar */}
            <div className="px-5 pb-5">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-raised px-4 py-3">
                <span className="text-sm text-text-faint flex-1">
                  Describe what you need...
                </span>
                <span
                  className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <ArrowRight size={14} style={{ color: "#0A0A0B" }} />
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
