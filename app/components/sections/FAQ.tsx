"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/Container";

const FAQS = [
  {
    q: "How is this different from just prompting ChatGPT directly?",
    a: "When you prompt ChatGPT or Claude directly, the model fills the gap between what you wrote and what it needs with guesses. Prompt AI makes those guesses visible, corrects them, and structures the full prompt before it ever reaches the target model. You get better outputs because the model gets better inputs.",
  },
  {
    q: "Does it work with all AI models?",
    a: "Yes. Prompt AI generates structured prompts that work with any text-based AI model. We also have model-specific optimizations for Claude, GPT-4o, Gemini, Mistral, Llama, and others, tuning the format and instruction style to match each model's preferred parsing structure.",
  },
  {
    q: "Can I edit the generated prompt before using it?",
    a: "Always. Every generated prompt is fully editable in the interface before you copy it. You can also see exactly what Prompt AI inferred beyond your input and override any inference individually.",
  },
  {
    q: "What is the completeness score?",
    a: "Every generated prompt is scored from 0 to 100 across dimensions including role clarity, context depth, task specificity, constraint coverage, and output format completeness. The score tells you where the prompt is strong and exactly what to add to push it higher.",
  },
  {
    q: "Is my data private?",
    a: "Your prompts are not used to train any model and are never shared with third parties. Prompt history is stored under your account and is accessible only to you. See SECURITY.md for the full policy.",
  },
  {
    q: "Do I need an API key to get started?",
    a: "No. The free tier lets you run up to 20 prompt generations per day without providing any API key. Prompt AI handles the model access. If you want to connect your own API keys for specific models or for higher throughput, that option is available in the Pro plan.",
  },
  {
    q: "Can I share prompts with my team?",
    a: "Yes. The Team plan includes a shared team workspace and team prompt library. Members can view, fork, and build on each other's prompts without losing version history.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border-subtle last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-start justify-between gap-4 w-full py-5 text-left focus-visible:outline-accent rounded"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-text-primary leading-relaxed">
          {q}
        </span>
        <span className="shrink-0 w-5 h-5 rounded-full border border-border bg-raised flex items-center justify-center mt-0.5">
          {open ? (
            <Minus size={11} className="text-accent" />
          ) : (
            <Plus size={11} className="text-text-faint" />
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm text-text-muted leading-relaxed pr-8">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="py-16 lg:py-24 border-t border-border-subtle">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-1"
          >
            <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight mb-4">
              Common questions
            </h2>
            <p className="text-text-muted text-sm leading-relaxed">
              Anything not covered here? Open an issue on{" "}
              <a
                href="https://github.com/oyedokunken/Prompt-AI"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-primary underline underline-offset-2 hover:text-accent transition-colors"
              >
                GitHub
              </a>
              .
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2"
          >
            {FAQS.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
