"use client";

import { motion } from "framer-motion";
import { siClaude, siOpenai, siGooglegemini, siMeta, siX, type SimpleIcon } from "simple-icons";
import { Container } from "@/components/Container";
import { MODELS } from "@/lib/types/chat";

// Built from the same list the composer's model selector uses, so this section
// can only ever say what the product says. Only GPT-4o is available, the rest
// are on the list as coming soon.
const ICONS: Record<string, { icon: SimpleIcon; provider: string }> = {
  "gpt-4o": { icon: siOpenai, provider: "OpenAI" },
  "claude-3-5-sonnet": { icon: siClaude, provider: "Anthropic" },
  "gemini-1.5-pro": { icon: siGooglegemini, provider: "Google" },
  "grok-2": { icon: siX, provider: "xAI" },
  "llama-3.1-70b": { icon: siMeta, provider: "Meta" },
  "o1-mini": { icon: siOpenai, provider: "OpenAI" },
};

const NOTES: Record<string, string> = {
  "gpt-4o": "The model Prompt AI builds your prompts with today. Pick it in the composer before you send.",
  "claude-3-5-sonnet": "On the list of build targets. Prompts for Claude will use tagged sections it follows well.",
  "gemini-1.5-pro": "On the list of build targets, not available yet.",
  "grok-2": "On the list of build targets, not available yet.",
  "llama-3.1-70b": "On the list of build targets, not available yet.",
  "o1-mini": "On the list of build targets, not available yet.",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export function ModelMarquee() {
  return (
    <section id="models" className="py-16 lg:py-24 border-t border-border-subtle overflow-hidden">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">Models</p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight max-w-2xl">
            One model today, more on the way
          </h2>
          <p className="text-text-muted text-base mt-4 leading-relaxed max-w-2xl">
            Prompt AI builds with GPT-4o. The prompts it writes are plain text by default, so you can paste them into
            any chat tool you use. The other models below are on the target list in the app and are marked coming soon.
          </p>
        </motion.div>

        <motion.ul
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {MODELS.map((m) => {
            const meta = ICONS[m.id];
            return (
              <motion.li
                key={m.id}
                variants={item}
                className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {meta && (
                      <span className="w-10 h-10 rounded-lg border border-border bg-base flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor" className="text-text-primary" role="img" aria-label={`${meta.provider} logo`}>
                          <path d={meta.icon.path} />
                        </svg>
                      </span>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary leading-tight">{m.label}</h3>
                      <p className="text-xs text-text-faint font-mono mt-0.5">{meta?.provider}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border ${
                      m.available ? "border-accent/30 text-accent bg-accent/5" : "border-border text-text-faint"
                    }`}
                  >
                    {m.available ? "Live" : "Coming soon"}
                  </span>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">{NOTES[m.id]}</p>
              </motion.li>
            );
          })}
        </motion.ul>
      </Container>
    </section>
  );
}
