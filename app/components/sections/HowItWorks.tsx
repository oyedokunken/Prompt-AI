"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/Container";

const STEPS = [
  {
    number: "01",
    title: "Type what you need",
    description:
      "Write it like you'd say it to a colleague. No special syntax, no templates, no required fields. Just describe the task in plain language.",
    example: '"write an error handling middleware"',
    tag: "Natural language input",
  },
  {
    number: "02",
    title: "AI structures it",
    description:
      "Prompt AI infers your stack, role, constraints, and expected output format. Every assumption is shown explicitly. Nothing is hidden or silently applied.",
    example: "ROLE → CONTEXT → TASK → CONSTRAINTS → OUTPUT",
    tag: "Visible inference",
  },
  {
    number: "03",
    title: "Copy and use",
    description:
      "Copy the structured prompt and paste it into the chat tool you use. It is plain text, so it works anywhere, and you do not have to rewrite it by hand.",
    example: "Plain text that pastes into any chat tool",
    tag: "Model-ready output",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 lg:py-24 border-t border-border-subtle">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 max-w-2xl mx-auto"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight mb-4">
            Three steps from vague to{" "}
            <span className="text-accent">model-ready</span>
          </h2>
          <p className="text-text-muted text-base leading-relaxed">
            Prompt AI sits between your intent and the target model. It does the
            prompt engineering work you'd otherwise do manually, or skip
            entirely.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-0 relative"
        >
          {STEPS.map((step, i) => (
            <motion.div key={step.number} variants={item} className="relative flex flex-col">
              {/* Connector line between steps on desktop */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:flex absolute top-[2.75rem] left-[calc(50%+3rem)] right-[-50%] items-center z-10 pointer-events-none">
                  <div className="flex-1 h-px bg-border" />
                  <ArrowRight size={12} className="text-text-faint shrink-0 -ml-1" />
                </div>
              )}

              <div className="rounded-xl border border-border bg-surface p-6 mx-0 lg:mx-2 flex flex-col gap-4 h-full">
                {/* Step number */}
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-raised border border-border flex items-center justify-center font-mono text-sm font-semibold text-accent shrink-0">
                    {step.number}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-faint px-2 py-1 rounded-full border border-border bg-raised">
                    {step.tag}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-text-primary mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Example */}
                <div className="mt-auto pt-4 border-t border-border-subtle">
                  <p className="font-mono text-xs text-text-faint leading-relaxed">
                    {step.example}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
