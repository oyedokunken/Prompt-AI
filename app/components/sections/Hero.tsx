"use client";

import Link from "next/link";
import { Github, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useHasSession } from "@/lib/hooks/useHasSession";
import { ProductWindow } from "@/components/marketing/ProductWindow";

export function Hero() {
  const hasSession = useHasSession();
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 overflow-hidden">
      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="hero-dot-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className="fill-border" fillOpacity="0.7" />
          </pattern>
          <radialGradient id="hero-dot-fade" cx="50%" cy="10%" r="70%" gradientUnits="userSpaceOnUse" gradientTransform="scale(1 1.4)">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="55%" stopColor="white" stopOpacity="0.4" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="hero-dot-mask">
            <rect width="100%" height="100%" fill="url(#hero-dot-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dot-grid)" mask="url(#hero-dot-mask)" />
      </svg>

      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(242,169,59,0.07) 0%, transparent 60%)" }} />

      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-10">

        {/* Headline */}
        <div className="flex flex-col items-center text-center gap-5 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <span className="font-mono text-xs uppercase tracking-widest text-text-faint px-3 py-1.5 border border-border rounded-full">
              Prompt engineering, automated
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-text-primary leading-tight"
          >
            Turn rough ideas into{" "}
            <span className="text-accent">production-ready prompts</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-base sm:text-lg text-text-muted leading-relaxed max-w-2xl"
          >
            Describe what you need in plain language. Prompt AI constructs a complete, structured prompt with role, context, constraints, and output format, optimized for the model you are targeting.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <Link href={hasSession ? "/dashboard" : "/signup"} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold hover:bg-accent-fill/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {hasSession ? "Dashboard" : "Start free"} <ArrowRight size={15} />
            </Link>
            <a href="https://github.com/oyedokunken/Prompt-AI" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-muted hover:text-text-primary hover:border-border/80 transition-colors focus-visible:outline-accent">
              <Github size={15} /> View on GitHub
            </a>
          </motion.div>
        </div>

        {/* The real workspace, built from the dashboard's own components */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="w-full"
        >
          <ProductWindow />
        </motion.div>
      </div>
    </section>
  );
}
