"use client";

import { Code2, Layers, Cpu, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Container } from "@/components/Container";

// CSS variable references so these icons stay legible against bg-raised
// in both themes instead of a fixed hex tuned only for the dark palette.
const ACCENT = "rgb(var(--color-accent))";
const SIGNAL = "rgb(var(--color-signal))";

const PERSONAS = [
  {
    Icon: Code2,
    title: "Developers",
    subtitle: "Solo and in teams",
    description:
      "Stop burning tokens on poorly structured prompts. Get precise, role-correct prompts for coding, architecture, debugging, code review, and documentation.",
    tags: ["Code generation", "Architecture", "Debugging", "Code review"],
    accent: ACCENT,
  },
  {
    Icon: Layers,
    title: "Product managers",
    subtitle: "Building AI features",
    description:
      "Turn feature descriptions and user stories into clean, structured prompts for spec writing, roadmap planning, user research summaries, and stakeholder communication.",
    tags: ["Spec writing", "User stories", "Roadmaps", "Research"],
    accent: SIGNAL,
  },
  {
    Icon: Cpu,
    title: "AI power users",
    subtitle: "Heavy model users",
    description:
      "You know the models well. Get the most out of the model without babysitting the prompt structure by hand.",
    tags: ["Prompt tuning", "Score tracking", "Library"],
    accent: ACCENT,
  },
  {
    Icon: Users,
    title: "Content teams",
    subtitle: "Writers and marketers",
    description:
      "Create consistent, reusable prompt templates for your brand voice, content workflows, and creative briefs. Share them across the team without losing quality.",
    tags: ["Brand voice", "Templates", "Workflows", "Consistency"],
    accent: SIGNAL,
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const CARD_HOVER = {
  y: -4,
  borderColor: "rgba(242,169,59,0.2)",
  transition: { duration: 0.2, ease: "easeOut" },
};

export function WhoItsFor() {
  return (
    <section id="who-its-for" className="py-16 lg:py-24 border-t border-border-subtle">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
            Who it is for
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight max-w-xl">
            Built for anyone who talks to AI models
          </h2>
          <p className="text-text-muted text-base mt-4 leading-relaxed max-w-2xl">
            The gap between intent and output matters whether you are writing
            code, building product, or publishing content. Prompt AI closes it
            for everyone.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {PERSONAS.map((p) => (
            <motion.div
              key={p.title}
              variants={item}
              whileHover={CARD_HOVER}
              className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-4 cursor-default"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-border bg-raised"
                >
                  <p.Icon size={18} style={{ color: p.accent }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary leading-none mb-1">
                    {p.title}
                  </h3>
                  <p className="text-xs text-text-faint">{p.subtitle}</p>
                </div>
              </div>

              <p className="text-sm text-text-muted leading-relaxed">
                {p.description}
              </p>

              <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-border-subtle">
                {p.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[10px] px-2 py-1 rounded-full border border-border bg-raised text-text-faint"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
