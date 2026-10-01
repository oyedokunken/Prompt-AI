"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Rich, specific stage messages rather than a single generic loading label.
// This is a client side rotating sequence, not real backend stage events,
// the current pipeline is a single request/response call to the model, not
// a streaming connection that could report genuine progress. The pacing
// below is tuned to a typical response time, not tied to real milestones.
const STAGES = [
  "Understanding your request",
  "Identifying the core task",
  "Adding relevant context",
  "Figuring out constraints and edge cases",
  "Structuring the role and task definition",
  "Selecting output format",
  "Scoring completeness",
  "Finalizing your prompt",
];

const STAGE_DURATION_MS = 1400;

export function GenerationStatus() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => Math.min(i + 1, STAGES.length - 1));
    }, STAGE_DURATION_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-signal/30 bg-signal/10">
        <span className="font-mono text-[10px] text-signal">P</span>
      </div>
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-tl-md bg-base border border-border max-w-[260px]">
        <div className="flex gap-1 shrink-0" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-signal animate-[blink_1.2s_step-end_infinite]"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="block text-xs text-text-muted leading-snug"
            >
              {STAGES[index]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
