"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Container } from "@/components/Container";

const USER_MESSAGE = "write a jwt refresh token endpoint";

const OUTPUT_LINES = [
  { color: "#F2A93B", text: "ROLE: Senior backend engineer" },
  { color: "#8B7CF6", text: "CONTEXT: Node.js 20, Express 5, PostgreSQL 16" },
  { color: "#8B7CF6", text: "TASK: Build a POST /api/auth/refresh endpoint:" },
  { color: "#8B8B93", text: "  - Read refresh token from httpOnly cookie" },
  { color: "#8B8B93", text: "  - Validate against stored hash in the DB" },
  { color: "#8B8B93", text: "  - Rotate token, issue new access token" },
  { color: "#F2A93B", text: "CONSTRAINTS: Rate limited, parameterized SQL" },
  { color: "#8B7CF6", text: "OUTPUT: Route handler + middleware + JSDoc" },
];

const PROMPT_OUTPUT = OUTPUT_LINES.map((l) => l.text).join("\n");

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-text-faint hover:text-text-primary transition-colors focus-visible:outline-accent rounded"
      aria-label="Copy prompt to clipboard"
    >
      {copied ? (
        <>
          <Check size={12} className="text-accent" />
          <span className="text-accent">Copied</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          Copy
        </>
      )}
    </button>
  );
}

export function ChatPreview() {
  return (
    <section id="chat-preview" className="py-16 lg:py-24 border-t border-border-subtle">
      <Container>
        <motion.div
          variants={gridVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          {/* Centered heading */}
          <motion.div
            variants={cardVariant}
            className="text-center mb-10 max-w-2xl mx-auto"
          >
            <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
              In practice
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight mb-4">
              What you type. What you get.
            </h2>
            <p className="text-text-muted text-base leading-relaxed">
              You write a sentence. Prompt AI returns a complete prompt with
              every field filled: role, context, task breakdown, constraints,
              and output format, ready to paste into any model.
            </p>
          </motion.div>

          {/* Equal-height panels */}
          <motion.div
            variants={cardVariant}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch"
          >
            {/* Left: Chat exchange */}
            <div className="rounded-xl border border-border bg-surface flex flex-col">
              <div className="flex items-center justify-between px-4 h-11 border-b border-border bg-raised shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-base border border-border flex items-center justify-center font-mono text-[10px] text-accent font-semibold">
                    &gt;_
                  </span>
                  <span className="text-xs font-semibold text-text-primary">
                    Prompt AI
                  </span>
                </div>
                <CopyButton code={PROMPT_OUTPUT} />
              </div>

              <div className="flex-1 p-5 flex flex-col gap-4">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="max-w-[85%]">
                    <div className="rounded-2xl rounded-br-md bg-raised border border-border px-4 py-2.5">
                      <p className="text-sm text-text-primary leading-relaxed">
                        {USER_MESSAGE}
                      </p>
                    </div>
                    <p className="text-[10px] text-text-faint text-right mt-1.5 font-mono">
                      You
                    </p>
                  </div>
                </div>

                {/* AI response */}
                <div className="flex gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-signal/30"
                    style={{ background: "rgba(139, 124, 246, 0.1)" }}
                    aria-hidden="true"
                  >
                    <span className="font-mono text-[10px] text-signal">P</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="rounded-2xl rounded-tl-md bg-base border border-border overflow-hidden">
                      <div className="px-4 py-2 border-b border-border-subtle">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
                          Structured prompt
                        </span>
                      </div>
                      <div className="px-4 py-3 space-y-0.5 overflow-x-auto scrollbar-hide">
                        {OUTPUT_LINES.map((line, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -4 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: i * 0.06 }}
                            className="font-mono text-xs leading-[1.7] whitespace-pre"
                            style={{ color: line.color }}
                          >
                            {line.text}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-text-faint mt-1.5 font-mono">
                      Prompt AI
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Inferred details + completeness */}
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-border bg-surface p-5 flex-1">
                <p className="text-xs text-text-faint font-mono uppercase tracking-widest mb-3">
                  What Prompt AI inferred
                </p>
                <div className="space-y-3">
                  {[
                    {
                      label: "Stack context",
                      value: "Node.js 20, Express 5, PostgreSQL",
                    },
                    {
                      label: "Auth pattern",
                      value: "httpOnly cookie with token rotation",
                    },
                    {
                      label: "Error contract",
                      value: "401 + structured error code",
                    },
                    {
                      label: "Output format",
                      value: "Route handler + middleware + JSDoc",
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-start justify-between gap-4 py-2 border-b border-border-subtle last:border-0"
                    >
                      <span className="text-xs text-text-faint font-mono shrink-0">
                        {row.label}
                      </span>
                      <span className="text-xs text-text-muted text-right leading-relaxed">
                        {row.value}
                      </span>
                      <span className="shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border border-signal/30 text-signal bg-signal/5">
                        inferred
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5">
                <p className="text-xs text-text-faint font-mono uppercase tracking-widest mb-3">
                  Completeness
                </p>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-3xl font-semibold text-text-primary">
                    94
                  </span>
                  <span className="text-sm text-text-faint mb-1">/100</span>
                </div>
                <div className="h-1.5 rounded-full bg-raised overflow-hidden mb-2">
                  <motion.div
                    className="h-full rounded-full bg-signal"
                    initial={{ width: 0 }}
                    whileInView={{ width: "94%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
                <p className="text-xs text-text-faint">
                  Add specific DB schema details to reach 100.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
