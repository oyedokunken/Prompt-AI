"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2, Code2, Palette, Briefcase, Sparkles, Brain, CheckCircle2, ArrowLeft, Check,
  FlaskConical, PenLine, Megaphone, GraduationCap, Layers, Shapes,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const ROLES = [
  { id: "developer", label: "Developer", blurb: "You write and ship code", icon: Code2 },
  { id: "designer", label: "Designer", blurb: "You design products and experiences", icon: Palette },
  { id: "product", label: "Product manager", blurb: "You define what gets built", icon: Briefcase },
  { id: "other", label: "Something else", blurb: "None of these quite fit", icon: Sparkles },
] as const;

const PRIMARY_USES = [
  { id: "Software engineering", icon: Code2 },
  { id: "Business", icon: Briefcase },
  { id: "Research", icon: FlaskConical },
  { id: "Content", icon: PenLine },
  { id: "Marketing", icon: Megaphone },
  { id: "Education", icon: GraduationCap },
  { id: "Product development", icon: Layers },
  { id: "Multiple areas", icon: Shapes },
] as const;

const STEPS = ["name", "role", "about", "workingOn", "primaryUse", "notes"] as const;
type Step = (typeof STEPS)[number] | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const step: Step = done ? "done" : STEPS[stepIndex];

  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["id"] | null>(null);
  const [about, setAbout] = useState("");
  const [workingOn, setWorkingOn] = useState("");
  const [primaryUse, setPrimaryUse] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const canAdvance =
    step === "name" ? !!name.trim() :
    step === "role" ? !!role :
    step === "about" ? !!about.trim() :
    step === "workingOn" ? !!workingOn.trim() :
    step === "primaryUse" ? !!primaryUse :
    true;

  const goNext = () => {
    if (!canAdvance) return;
    setError(null);
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      handleFinish();
    }
  };

  const goBack = () => {
    setError(null);
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  // Selecting a single-choice card advances immediately, a beat after the
  // selection is visible, rather than waiting for a separate click.
  const selectAndAdvance = (apply: () => void) => {
    apply();
    setTimeout(() => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)), 320);
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user }, error: updateError } = await supabase.auth.updateUser({
        data: {
          preferred_name: name.trim(),
          role,
          onboarded: true,
          about: about.trim(),
          working_on: workingOn.trim(),
          primary_use: primaryUse,
          notes: notes.trim() || null,
        },
      });

      if (updateError) {
        setError(updateError.message);
        setIsSubmitting(false);
        return;
      }

      // Seed initial long-term memory from what the user just told us --
      // this is the whole point of asking, so the AI already knows who it
      // is talking to from the very first chat. Best effort: a failure
      // here must never block onboarding from completing.
      if (user) {
        try {
          const rows: { user_id: string; category: string; key: string; value: string; source: string; confidence: number }[] = [
            { user_id: user.id, category: "about", key: "What they do", value: about.trim(), source: "onboarding", confidence: 1 },
            { user_id: user.id, category: "projects", key: "Currently working on", value: workingOn.trim(), source: "onboarding", confidence: 1 },
          ];
          if (primaryUse) {
            rows.push({ user_id: user.id, category: "about", key: "Primary use for Prompt AI", value: primaryUse, source: "onboarding", confidence: 1 });
          }
          if (notes.trim()) {
            rows.push({ user_id: user.id, category: "other", key: "Additional context", value: notes.trim(), source: "onboarding", confidence: 1 });
          }
          await supabase.from("user_memories").insert(rows);
        } catch (memErr) {
          console.error("[onboarding] memory seed failed (non-blocking):", memErr);
        }
      }

      setDone(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnter = () => {
    router.push("/dashboard");
    router.refresh();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canAdvance && !isSubmitting) {
      e.preventDefault();
      goNext();
    }
  };

  const STEP_COPY: Record<(typeof STEPS)[number], { title: string; subtitle: string }> = {
    name: { title: "Welcome to Prompt AI", subtitle: "First, what should we call you?" },
    role: { title: "What best describes you?", subtitle: "This shapes the tone Prompt AI defaults to." },
    about: { title: "What do you do?", subtitle: "One line is plenty." },
    workingOn: { title: "What are you working on right now?", subtitle: "This helps Prompt AI give you sharper defaults." },
    primaryUse: { title: "What will you mainly use Prompt AI for?", subtitle: "Pick the closest fit." },
    notes: { title: "Anything else Prompt AI should know?", subtitle: "Optional, you can always add more later." },
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-6 gap-4">
        <Logo variant="color" size={36} />
        {step !== "done" && (
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === stepIndex ? "w-5 bg-accent" : i < stepIndex ? "w-1.5 bg-accent/50" : "w-1.5 bg-border"
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="text-center mb-7">
        {step !== "done" ? (
          <>
            <h1 className="text-xl font-semibold text-text-primary">{STEP_COPY[step].title}</h1>
            <p className="text-sm text-text-muted mt-1">{STEP_COPY[step].subtitle}</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-text-primary">You're all set</h1>
            <p className="text-sm text-text-muted mt-1">Here's what happens next.</p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4" role="alert">
          {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        {step === "name" && (
          <motion.div key="name" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="flex flex-col gap-4">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your name"
              maxLength={40}
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-base text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-accent/40 transition-colors text-center"
            />
            <StepButton onClick={goNext} disabled={!canAdvance} label="Continue" />
          </motion.div>
        )}

        {step === "role" && (
          <motion.div key="role" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2.5">
              {ROLES.map(({ id, label, blurb, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectAndAdvance(() => setRole(id))}
                  className={cn(
                    "relative flex flex-col items-start gap-2 px-4 py-4 rounded-xl border text-left transition-all",
                    role === id
                      ? "border-accent bg-accent/10 ring-2 ring-accent/30"
                      : "border-border hover:border-border/60 hover:bg-raised"
                  )}
                >
                  {role === id && (
                    <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                      <Check size={10} className="text-accent-fill-foreground" />
                    </span>
                  )}
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", role === id ? "bg-accent/20 text-accent" : "bg-raised text-text-muted")}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-primary">{label}</p>
                    <p className="text-[10px] text-text-faint mt-0.5 leading-snug">{blurb}</p>
                  </div>
                </button>
              ))}
            </div>
            <BackRow onBack={goBack} />
          </motion.div>
        )}

        {step === "about" && (
          <motion.div key="about" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="flex flex-col gap-4">
            <input
              ref={inputRef}
              type="text"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Full-stack engineer building SaaS products"
              maxLength={120}
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-accent/40 transition-colors"
            />
            <StepButton onClick={goNext} disabled={!canAdvance} label="Continue" />
            <BackRow onBack={goBack} />
          </motion.div>
        )}

        {step === "workingOn" && (
          <motion.div key="workingOn" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="flex flex-col gap-4">
            <input
              ref={inputRef}
              type="text"
              value={workingOn}
              onChange={(e) => setWorkingOn(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. A Next.js and PostgreSQL internal tool"
              maxLength={120}
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-accent/40 transition-colors"
            />
            <StepButton onClick={goNext} disabled={!canAdvance} label="Continue" />
            <BackRow onBack={goBack} />
          </motion.div>
        )}

        {step === "primaryUse" && (
          <motion.div key="primaryUse" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              {PRIMARY_USES.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectAndAdvance(() => setPrimaryUse(id))}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-3 rounded-xl border text-left transition-all",
                    primaryUse === id
                      ? "border-accent bg-accent/10 ring-2 ring-accent/30"
                      : "border-border hover:border-border/60 hover:bg-raised"
                  )}
                >
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", primaryUse === id ? "bg-accent/20 text-accent" : "bg-raised text-text-muted")}>
                    <Icon size={14} />
                  </div>
                  <p className="text-[11px] font-medium text-text-primary leading-snug">{id}</p>
                </button>
              ))}
            </div>
            <BackRow onBack={goBack} />
          </motion.div>
        )}

        {step === "notes" && (
          <motion.div key="notes" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="flex flex-col gap-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. I prefer concise, technical explanations"
              rows={3}
              maxLength={280}
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-accent/40 transition-colors resize-none"
            />
            <button
              type="button"
              onClick={handleFinish}
              disabled={isSubmitting}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors text-accent-fill-foreground",
                isSubmitting ? "bg-accent-fill/40 cursor-not-allowed" : "bg-accent-fill hover:bg-accent-fill/90"
              )}
            >
              {isSubmitting ? (<><Loader2 size={14} className="animate-spin" /> Saving...</>) : "Finish"}
            </button>
            <div className="flex items-center justify-between">
              <button type="button" onClick={goBack} className="inline-flex items-center gap-1 text-xs text-text-faint hover:text-text-muted transition-colors">
                <ArrowLeft size={12} /> Back
              </button>
              <button type="button" onClick={handleFinish} disabled={isSubmitting} className="text-xs text-text-faint hover:text-text-muted transition-colors">
                Skip
              </button>
            </div>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-border bg-surface p-6 flex flex-col items-center text-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Brain size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-sm text-text-primary font-medium mb-1.5 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={14} className="text-green-400" />
                Prompt AI now understands your working context
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                You can view, edit, or remove anything it remembers anytime from Settings, Memory.
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnter}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold hover:bg-accent-fill/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Go to dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors text-accent-fill-foreground",
        disabled ? "bg-accent-fill/40 cursor-not-allowed" : "bg-accent-fill hover:bg-accent-fill/90"
      )}
    >
      {label}
    </button>
  );
}

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-text-faint hover:text-text-muted transition-colors self-start">
      <ArrowLeft size={12} /> Back
    </button>
  );
}
