"use client";

import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const models = [
  {
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    notes:
      "Uses XML tag structure for roles and delimiters. Prompt AI applies <role>, <context>, and <output> wrappers to match Claude's preferred parsing format.",
    badge: "Recommended",
  },
  {
    name: "GPT-4o",
    provider: "OpenAI",
    notes:
      "Formats instructions as a system message with a structured user turn. Prompt AI separates role context into the system prompt and the task into the user message.",
    badge: null,
  },
  {
    name: "Gemini 1.5 Pro",
    provider: "Google",
    notes:
      "Performs well with extended context blocks. Prompt AI adjusts token budget assumptions and places constraints earlier in the instruction set for Gemini targets.",
    badge: null,
  },
  {
    name: "Mistral Large",
    provider: "Mistral AI",
    notes:
      "Uses ChatML-compatible formatting. Prompt AI applies instruction-tuned formatting conventions and avoids markdown-heavy structures that reduce Mistral performance.",
    badge: null,
  },
  {
    name: "Llama 3.1 70B",
    provider: "Meta",
    notes:
      "Applies prompt templates consistent with the llama.cpp and vLLM serving format. Prompt AI avoids token-heavy decorators that bloat context on local inference setups.",
    badge: null,
  },
  {
    name: "Qwen 2.5 Coder",
    provider: "Alibaba",
    notes:
      "Targets code-specific instruction tuning. Prompt AI emphasizes language, runtime, and output format constraints when building prompts for this model.",
    badge: null,
  },
];

export function Models() {
  return (
    <section id="models" className="py-24 px-4 border-t border-border-subtle">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
            Targeting
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight max-w-2xl">
            Built for the models you're actually using
          </h2>
          <p className="text-text-muted text-base mt-4 leading-relaxed max-w-2xl">
            Each model has formatting conventions, instruction preferences, and
            context window constraints. Prompt AI accounts for them
            automatically when you pick a target.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {models.map((model) => (
            <motion.div
              key={model.name}
              variants={item}
              className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-3 hover:bg-raised transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {model.name}
                  </h3>
                  <p className="text-xs text-text-faint font-mono mt-0.5">
                    {model.provider}
                  </p>
                </div>
                {model.badge && (
                  <span className="shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border border-accent/30 text-accent bg-accent/5">
                    {model.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {model.notes}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
