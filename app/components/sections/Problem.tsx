"use client";

import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { Container } from "@/components/Container";

const MISSING_CONTEXT = [
  "Audience",
  "Tone",
  "Length",
  "Structure",
  "Platform",
  "Constraints",
  "Output format",
  "Examples",
];

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const chipVariant = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
};

export function Problem() {
  return (
    <section id="problem" className="py-16 lg:py-24 border-t border-border-subtle">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 max-w-2xl mx-auto"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
            The problem
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight mb-4">
            You know what you want.{" "}
            <span className="text-accent">Describing it is the hard part.</span>
          </h2>
          <p className="text-text-muted text-base leading-relaxed">
            Most developers know exactly what they need. But the gap between
            what you type and what a model can act on is made of dozens of
            unstated assumptions. Every model fills that gap with guesses, and
            those guesses are usually wrong.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-xl border border-border bg-surface p-6 flex flex-col"
          >
            <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-5">
              What you type
            </p>
            <div className="flex-1 flex items-center justify-center">
              <div className="max-w-xs w-full">
                <div className="rounded-2xl rounded-br-md bg-raised border border-border px-4 py-3 ml-auto">
                  <p className="text-sm text-text-primary leading-relaxed">
                    write me a blog post
                  </p>
                </div>
                <p className="text-xs text-text-faint text-right mt-2 font-mono">
                  6 words. Zero context.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-xl border border-border bg-surface p-6 flex flex-col"
          >
            <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-5">
              What the model has to guess
            </p>
            <motion.div
              variants={listVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="flex-1 flex flex-wrap content-center gap-2"
            >
              {MISSING_CONTEXT.map((item) => (
                <motion.span
                  key={item}
                  variants={chipVariant}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-raised text-sm text-text-muted"
                >
                  <HelpCircle size={13} className="text-accent" />
                  {item}
                </motion.span>
              ))}
            </motion.div>
            <p className="text-xs text-text-faint mt-5 font-mono">
              8 unstated assumptions. 8 chances to get it wrong.
            </p>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center text-base text-text-muted mt-10 max-w-xl mx-auto leading-relaxed"
        >
          Prompt AI closes that gap before the prompt ever reaches the target
          model. It asks the right questions, fills in the missing context, and
          shows you exactly what was inferred versus what you actually said.
        </motion.p>
      </Container>
    </section>
  );
}
