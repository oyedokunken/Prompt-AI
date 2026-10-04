"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/Logo";

interface GenerationStatusProps {
  // The latest stage message reported by the server. Each one describes
  // work that has genuinely just started, nothing here is a timed rotation.
  message: string | null;
}

export function GenerationStatus({ message }: GenerationStatusProps) {
  const text = message ?? "Sending your message";

  return (
    <div className="flex gap-3">
      <Logo variant="color" size={26} iconOnly className="shrink-0 mt-0.5 self-start" />
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-tl-md bg-base border border-border max-w-[320px]">
        <div className="flex gap-1 shrink-0" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-signal animate-[blink_1.2s_step-end_infinite]"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        <div className="relative flex-1 min-w-0" role="status" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.span
              key={text}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="block text-xs text-text-muted leading-snug"
            >
              {text}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
