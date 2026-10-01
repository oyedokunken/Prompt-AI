"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, HelpCircle } from "lucide-react";
import type { ClarifyQuestion } from "@/lib/types/chat";
import { cn } from "@/lib/utils";

interface ClarifyInterviewProps {
  intro: string;
  questions: ClarifyQuestion[];
  onComplete: (answerText: string) => void;
}

// A short, structured interview, one question at a time, instead of a
// wall of text answered in the regular composer. This is the moment a
// user can tell whether Prompt AI actually understood them, it gets its
// own distinct visual language rather than looking like a normal reply.
export function ClarifyInterview({ intro, questions, onComplete }: ClarifyInterviewProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [selected, setSelected] = useState<string[]>([]);
  const [textDraft, setTextDraft] = useState("");

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const hasOptions = !!question.options?.length;

  const toggleOption = (opt: string) => {
    if (question.multiple) {
      setSelected((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
    } else {
      setSelected([opt]);
    }
  };

  const currentAnswer = hasOptions ? selected.join(", ") : textDraft.trim();
  const canContinue = currentAnswer.length > 0;

  const goNext = () => {
    if (!canContinue) return;
    const nextAnswers = [...answers];
    nextAnswers[index] = currentAnswer;
    setAnswers(nextAnswers);

    if (isLast) {
      const summary = questions.map((q, i) => `${i + 1}. ${q.text}\nAnswer: ${nextAnswers[i]}`).join("\n\n");
      onComplete(summary);
      return;
    }

    setIndex((i) => i + 1);
    setSelected([]);
    setTextDraft("");
  };

  const goBack = () => {
    if (index === 0) return;
    const prevAnswer = answers[index - 1];
    setIndex((i) => i - 1);
    const prevQuestion = questions[index - 1];
    if (prevQuestion.options?.length) {
      setSelected(prevAnswer ? prevAnswer.split(", ") : []);
    } else {
      setTextDraft(prevAnswer ?? "");
    }
  };

  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-accent/30 bg-accent/10">
        <HelpCircle size={12} className="text-accent" />
      </div>

      <div className="max-w-[90%] sm:max-w-[80%] w-full rounded-xl border border-accent/20 bg-accent/5 overflow-hidden">
        <div className="px-4 pt-3 pb-2 border-b border-accent/10 flex items-center justify-between">
          <p className="text-[10px] font-mono uppercase tracking-widest text-accent">
            Question {index + 1} of {questions.length}
          </p>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === index ? "w-4 bg-accent" : i < index ? "w-1 bg-accent/50" : "w-1 bg-accent/20"
                )}
              />
            ))}
          </div>
        </div>

        <div className="px-4 py-4">
          {index === 0 && intro && (
            <p className="text-xs text-text-muted mb-3">{intro}</p>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
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
                  onKeyDown={(e) => { if (e.key === "Enter" && canContinue) goNext(); }}
                  placeholder="Type your answer"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent/40 transition-colors"
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={goBack}
              disabled={index === 0}
              className={cn(
                "inline-flex items-center gap-1 text-xs transition-colors",
                index === 0 ? "text-text-faint/40 cursor-not-allowed" : "text-text-faint hover:text-text-muted"
              )}
            >
              <ArrowLeft size={12} /> Back
            </button>
            <button
              onClick={goNext}
              disabled={!canContinue}
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
        </div>
      </div>
    </div>
  );
}
