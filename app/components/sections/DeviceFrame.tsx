"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/Container";

const HISTORY = [
  { label: "JWT refresh endpoint", active: false },
  { label: "Login form component", active: false },
  { label: "CI pipeline setup", active: false },
  { label: "Rate limiting middleware", active: true },
];

const USER_MSG = "add rate limiting to all authenticated routes";

const AI_LINES = [
  { color: "#F2A93B", text: "ROLE: Senior backend engineer" },
  { color: "#8B7CF6", text: "CONTEXT: Express 5, Redis, JWT auth middleware" },
  { color: "#8B7CF6", text: "TASK: Implement rate limiting that:" },
  { color: "#8B8B93", text: "  - Applies per-user limits (not per-IP)" },
  { color: "#8B8B93", text: "  - Uses Redis sliding window counter" },
  { color: "#8B8B93", text: "  - Returns 429 with Retry-After header" },
  { color: "#F2A93B", text: "CONSTRAINTS: No degradation under burst load" },
  { color: "#8B7CF6", text: "OUTPUT: Middleware + Redis schema + tests" },
];

export function DeviceFrame() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="workspace" className="py-16 lg:py-24 border-t border-border-subtle overflow-hidden">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
            The workspace
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight max-w-xl">
            Your prompts. Versioned, searchable, reusable.
          </h2>
          <p className="text-text-muted text-base mt-4 leading-relaxed max-w-xl">
            Prompt AI is not a one-shot tool. Every session is saved, versioned,
            and searchable. Fork a previous prompt, compare revisions, and build
            a personal library of prompts that actually work.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={!prefersReducedMotion ? "animate-float" : ""}
          style={{ transformOrigin: "center bottom" }}
        >
          <Laptop />
        </motion.div>
      </Container>
    </section>
  );
}

function Laptop() {
  // This is an illustration of a physical laptop showing a screenshot of
  // the product, not a themed UI surface. It stays dark regardless of the
  // site's own theme, the same way a device mockup would not change the
  // color of its plastic or metal chassis based on the page around it.
  return (
    <div className="dark mx-auto max-w-4xl">
      <div
        className="relative rounded-t-2xl border border-border bg-[#0D0D0F] shadow-2xl"
        style={{ paddingTop: "62%" }}
      >
        <div
          className="absolute inset-0 rounded-t-2xl overflow-hidden"
          style={{ padding: "2.5% 2.5% 0 2.5%" }}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2 top-[1.2%] w-[1.5%] h-[1.5%] rounded-full bg-border"
            aria-hidden="true"
          />
          <div className="absolute inset-0 m-[2.5%] mt-[3.5%] rounded-t-lg overflow-hidden bg-[#0A0A0B] border border-border/60">
            <AppMockup />
          </div>
        </div>
      </div>
      <div
        className="relative h-[2.8%] min-h-[12px] bg-[#141416] border-x border-border rounded-b-sm mx-[6%]"
        aria-hidden="true"
      />
      <div
        className="h-[1.2%] min-h-[6px] bg-[#1A1A1D] rounded-b-xl mx-[2%] border border-t-0 border-border"
        aria-hidden="true"
      />
    </div>
  );
}

function AppMockup() {
  return (
    <div className="flex h-full min-h-0">
      <div className="w-[200px] shrink-0 border-r border-border bg-[#0D0D0F] flex flex-col">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#F2A93B] opacity-80" />
            <span
              className="font-mono text-[9px] text-text-faint tracking-wide"
              style={{ fontFamily: "monospace" }}
            >
              PromptAI
            </span>
          </div>
        </div>
        <div className="px-2 py-2 flex-1 overflow-hidden">
          <p
            className="font-mono text-[8px] text-text-faint uppercase tracking-widest mb-1.5 px-1"
            style={{ fontFamily: "monospace" }}
          >
            Recent
          </p>
          {HISTORY.map((h) => (
            <div
              key={h.label}
              className={`px-2 py-1.5 rounded text-[9px] truncate mb-0.5 cursor-pointer ${
                h.active
                  ? "bg-[#1A1A1D] text-[#EDEDEF]"
                  : "text-[#5C5C63] hover:bg-[#141416]"
              }`}
              style={{ fontFamily: "monospace" }}
            >
              {h.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 px-3 h-8 border-b border-border bg-[#0D0D0F]">
          <div className="flex gap-1" aria-hidden="true">
            <span className="w-2 h-2 rounded-full bg-border" />
            <span className="w-2 h-2 rounded-full bg-border" />
            <span className="w-2 h-2 rounded-full bg-border" />
          </div>
          <span
            className="font-mono text-[8px] text-text-faint ml-1"
            style={{ fontFamily: "monospace" }}
          >
            rate limiting middleware
          </span>
        </div>

        <div className="flex-1 overflow-hidden p-3 space-y-2.5">
          <div className="flex gap-2">
            <div className="w-4 h-4 rounded-full bg-border flex items-center justify-center shrink-0 mt-0.5">
              <span
                className="text-[7px] text-text-muted"
                style={{ fontFamily: "monospace" }}
              >
                U
              </span>
            </div>
            <div className="bg-[#17171A] rounded-lg px-2 py-1.5 max-w-[60%]">
              <p
                className="text-[9px] text-text-muted leading-relaxed"
                style={{ fontFamily: "monospace" }}
              >
                {USER_MSG}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-[#8B7CF6]/30"
              style={{ background: "rgba(139,124,246,0.08)" }}
            >
              <span
                className="text-[7px] text-[#8B7CF6]"
                style={{ fontFamily: "monospace" }}
              >
                P
              </span>
            </div>
            <div className="bg-[#111113] border border-border rounded-lg px-2 py-1.5 flex-1 max-w-[75%]">
              {AI_LINES.map((line, i) => (
                <p
                  key={i}
                  className="text-[8px] leading-[1.6] whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ color: line.color, fontFamily: "monospace" }}
                >
                  {line.text}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center gap-2 rounded-md border border-border bg-[#111113] px-2 py-1.5">
            <span
              className="flex-1 text-[8px] text-text-faint"
              style={{ fontFamily: "monospace" }}
            >
              Describe what you need...
            </span>
            <div className="w-4 h-4 rounded bg-[#F2A93B] flex items-center justify-center shrink-0">
              <span className="text-[7px] font-bold text-[#0A0A0B]">→</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
