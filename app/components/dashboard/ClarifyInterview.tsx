"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, HelpCircle } from "lucide-react";
import type { ClarifyQuestion } from "@/lib/types/chat";
import { cn } from "@/lib/utils";

interface ClarifyInterviewProps {
  intro?: string;
  question: ClarifyQuestion;
  // 1 based position of this question, and how many are planned in total.
  position: number;
  total: number;
  onAnswer: (answer: string) => void;
}

// One question at a time. The server sends exactly one, and the next only
// after this one is answered, so this card never has a "next" to move to.
// A single select question advances the moment an option is picked. Only
// multi select and free text answers need an explicit confirm.
// It gets its own visual language so a user can tell when Prompt AI is
// asking rather than answering.
export function ClarifyInterview({ intro, question, position, total, onAnswer }: ClarifyInterviewProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [textDraft, setTextDraft] = useState("");
  // Set once an answer is sent, so a double click cannot send it twice.
  const [sent, setSent] = useState(false);

  const hasOptions = !!question.options?.length;
  const currentAnswer = hasOptions ? selected.join(", ") : textDraft.trim();
  const canContinue = currentAnswer.length > 0;
  const isLast = position >= total;
  const autoAdvances = hasOptions && !question.multiple;

  const submit = (answer: string = currentAnswer) => {
    if (sent || !answer) return;
    setSent(true);
    onAnswer(answer);
  };

  const toggleOption = (opt: string) => {
    if (sent) return;
    if (question.multiple) {
      setSelected((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
    } else {
      setSelected([opt]);
      submit(opt);
    }
  };

  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-accent/30 bg-accent/10">
        <HelpCircle size={12} className="text-accent" />
      </div>

      <div className="max-w-[90%] sm:max-w-[80%] w-full rounded-xl border border-accent/20 bg-accent/5 overflow-hidden">
        <div className="px-4 pt-3 pb-2 border-b border-accent/10 flex items-center justify-between">
          <p className="text-xs md:text-xs font-mono uppercase tracking-widest text-accent">
            Question {position} of {total}
          </p>
          <div className="flex gap-1">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i + 1 === position ? "w-4 bg-accent" : i + 1 < position ? "w-1 bg-accent/50" : "w-1 bg-accent/20"
                )}
              />
            ))}
          </div>
        </div>

        <div className="px-4 py-4">
          {position === 1 && intro && <p className="text-xs text-text-muted mb-3">{intro}</p>}

          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <p className="text-sm font-medium text-text-primary mb-3">{question.text}</p>

            {hasOptions ? (
              <div className="flex flex-wrap gap-2">
                {question.options!.map((opt) => {
                  const isSelected = selected.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleOption(opt)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                        isSelected
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-border text-text-muted hover:border-accent/30 hover:text-text-primary"
                      )}
                    >
                      {isSelected && <Check size={11} />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                autoFocus
                type="text"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="Type your answer"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent/40 transition-colors"
              />
            )}
          </motion.div>

          {!autoAdvances && (
          <div className="flex items-center justify-end mt-4">
            <button
              onClick={() => submit()}
              disabled={!canContinue || sent}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                canContinue
                  ? "bg-accent-fill text-accent-fill-foreground hover:bg-accent-fill/90"
                  : "bg-accent-fill/30 text-accent-fill-foreground cursor-not-allowed"
              )}
            >
              {isLast ? "Finish" : "Next"} <ArrowRight size={12} />
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
