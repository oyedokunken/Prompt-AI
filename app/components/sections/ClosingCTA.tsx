"use client";

import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { motion } from "framer-motion";
import { Container } from "@/components/Container";
import { useHasSession } from "@/lib/hooks/useHasSession";

export function ClosingCTA() {
  const hasSession = useHasSession();
  return (
    <section className="py-16 lg:py-24 border-t border-border-subtle">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-4">
            Get started
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4 max-w-xl">
            <span className="text-text-primary">Stop rewriting prompts.</span>{" "}
            <span className="text-accent">Start writing better ones.</span>
          </h2>
          <p className="text-text-muted text-base leading-relaxed mb-10 max-w-md">
            Free to use. Open source. No API key required to get started. Sign
            up and run your first transformation in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href={hasSession ? "/dashboard" : "/signup"}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold hover:bg-accent-fill/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {hasSession ? "Open your dashboard" : "Create a free account"}
              <ArrowRight size={15} />
            </Link>
            <a
              href="https://github.com/oyedokunken/prompt-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border text-sm font-medium text-text-muted hover:text-text-primary hover:border-border/80 transition-colors focus-visible:outline-accent"
            >
              <Github size={15} />
              Star on GitHub
            </a>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
