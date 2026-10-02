"use client";

import {
  Brain,
  LayoutTemplate,
  BarChart2,
  GitCompare,
  Cpu,
  History,
  FileText,
  Paperclip,
} from "lucide-react";
import { motion } from "framer-motion";
import { ReadinessBadge, ScoreBadge } from "@/components/dashboard/MessageBubble";
import { Container } from "@/components/Container";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const CARD_HOVER = {
  y: -3,
  borderColor: "rgba(242,169,59,0.25)",
  transition: { duration: 0.2, ease: "easeOut" },
};

const features = [
  {
    icon: Brain,
    title: "Intent understanding",
    description:
      "Parses vague, conversational input and infers the underlying task, scope, and relevant constraints without requiring structured commands or special syntax.",
    accent: "accent",
  },
  {
    icon: LayoutTemplate,
    title: "Structured prompt construction",
    description:
      "Applies proven prompt patterns, role framing, context blocks, constraints, and output format instructions, assembled specifically for your request.",
    accent: "accent",
  },
  {
    icon: GitCompare,
    title: "Visible diff",
    description:
      "See exactly what Prompt AI inferred beyond what you typed. Every addition is visible and editable before the prompt is finalized.",
    accent: "accent",
  },
  {
    icon: Cpu,
    title: "Formatted for where it is going",
    description:
      "Prompts come out as clean plain text by default so they paste anywhere, with tagged sections when the destination is Claude and markdown when you name a place that renders it. GPT-4o is the model Prompt AI builds with today, and more targets are planned.",
    accent: "accent",
  },
  {
    icon: History,
    title: "Prompt history",
    description:
      "Every prompt is saved and versioned. Fork from a previous version, compare revisions, and build a library of prompts specific to your workflows.",
    accent: "accent",
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="py-16 lg:py-24">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
            What it does
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight max-w-xl">
            From vague to verified, in one step
          </h2>
          <p className="text-text-muted text-base mt-4 leading-relaxed max-w-2xl">
            Prompt AI fills the gap between what you can describe and what a
            model actually needs. Every transformation is auditable, editable,
            and formatted for where you are going to use it.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.slice(0, 2).map((feat) => (
            <motion.div
              key={feat.title}
              variants={item}
              whileHover={CARD_HOVER}
              className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-4 cursor-default"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-raised border border-border">
                <feat.icon size={18} className="text-accent" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  {feat.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {feat.description}
                </p>
              </div>
            </motion.div>
          ))}

          <motion.div
            variants={item}
            whileHover={CARD_HOVER}
            className="sm:col-span-2 lg:col-span-1 rounded-xl border border-border bg-surface p-6 flex flex-col gap-4 cursor-default"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-raised border border-border">
              <BarChart2 size={18} className="text-signal" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-2">
                Completeness score
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Every generated prompt gets a rough completeness estimate and a
                readiness flag, so you can tell a prompt that is ready to use
                from one that still needs more context.
              </p>
            </div>
            <div className="mt-auto pt-4 border-t border-border-subtle flex flex-wrap items-center gap-2">
              <ReadinessBadge status="ready" />
              <ScoreBadge score={78} />
              <ReadinessBadge status="needs_context" />
            </div>
          </motion.div>

          {features.slice(2).map((feat) => (
            <motion.div
              key={feat.title}
              variants={item}
              whileHover={CARD_HOVER}
              className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-4 cursor-default"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-raised border border-border">
                <feat.icon size={18} className="text-accent" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  {feat.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {feat.description}
                </p>
              </div>
            </motion.div>
          ))}

          <motion.div
            variants={item}
            whileHover={CARD_HOVER}
            className="sm:col-span-2 rounded-xl border border-border bg-surface p-6 flex flex-col gap-4 cursor-default"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-raised border border-border">
              <FileText size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-2">
                Report export
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Generate a shareable report of any prompt session as PDF,
                Markdown, or plain text, including the completeness score
                breakdown and the visible diff, for documentation or handoff.
              </p>
            </div>
          </motion.div>

          <motion.div
            variants={item}
            whileHover={CARD_HOVER}
            className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-4 cursor-default"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-raised border border-border">
              <Paperclip size={18} className="text-signal" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-2">
                Media attachments
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Attach files, screenshots, or reference documents to a
                conversation so Prompt AI can use them as additional context
                when constructing a prompt.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
