"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Code2, Palette, Briefcase, Sparkles, Brain, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const ROLES = [
  { id: "developer", label: "Developer", icon: Code2 },
  { id: "designer", label: "Designer", icon: Palette },
  { id: "product", label: "Product manager", icon: Briefcase },
  { id: "other", label: "Something else", icon: Sparkles },
] as const;

const PRIMARY_USES = [
  "Software engineering",
  "Business",
  "Research",
  "Content",
  "Marketing",
  "Education",
  "Product development",
  "Multiple areas",
] as const;

type Step = "basics" | "context" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basics");

  // Step 1: required basics
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["id"] | null>(null);

  // Step 2: optional working context
  const [about, setAbout] = useState("");
  const [workingOn, setWorkingOn] = useState("");
  const [primaryUse, setPrimaryUse] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToContext = () => {
    if (!name.trim() || !role) return;
    setStep("context");
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
          about: about.trim() || null,
          working_on: workingOn.trim() || null,
          primary_use: primaryUse,
          notes: notes.trim() || null,
        },
      });

      if (updateError) {
        setError(updateError.message);
        setIsSubmitting(false);
        return;
      }

      // Seed initial long-term memory from whatever the user actually
      // shared -- best effort, a failure here must never block onboarding.
      if (user) {
        try {
          const rows: { user_id: string; category: string; key: string; value: string; source: string; confidence: number }[] = [];
          if (about.trim()) {
            rows.push({ user_id: user.id, category: "about", key: "What they do", value: about.trim(), source: "onboarding", confidence: 1 });
          }
          if (workingOn.trim()) {
            rows.push({ user_id: user.id, category: "projects", key: "Currently working on", value: workingOn.trim(), source: "onboarding", confidence: 1 });
          }
          if (primaryUse) {
            rows.push({ user_id: user.id, category: "about", key: "Primary use for Prompt AI", value: primaryUse, source: "onboarding", confidence: 1 });
          }
          if (notes.trim()) {
            rows.push({ user_id: user.id, category: "other", key: "Additional context", value: notes.trim(), source: "onboarding", confidence: 1 });
          }
          if (rows.length > 0) {
            await supabase.from("user_memories").insert(rows);
          }
        } catch (memErr) {
          console.error("[onboarding] memory seed failed (non-blocking):", memErr);
        }
      }

      setStep("done");
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

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8 gap-4">
        <Logo variant="color" size={36} />
        <div className="text-center">
          <h1 className="text-xl font-semibold text-text-primary">
            {step === "done" ? "You're all set" : "Welcome to Prompt AI"}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {step === "basics" && "A couple of quick things, then you're in."}
            {step === "context" && "Optional, but it helps Prompt AI understand you faster."}
            {step === "done" && "Here's what happens next."}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4" role="alert">
          {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        {step === "basics" && (
          <motion.div
            key="basics"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-5"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="preferred-name" className="text-sm font-medium text-text-primary">
                What should we call you?
              </label>
              <input
                id="preferred-name"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={40}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-accent/40 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">What best describes you?</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRole(id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-xs font-medium transition-colors",
                      role === id
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-border text-text-muted hover:border-border/60 hover:bg-raised"
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={goToContext}
              disabled={!name.trim() || !role}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors text-accent-fill-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent mt-1",
                !name.trim() || !role
                  ? "bg-accent-fill/40 cursor-not-allowed"
                  : "bg-accent-fill hover:bg-accent-fill/90"
              )}
            >
              Continue
            </button>
          </motion.div>
        )}

        {step === "context" && (
          <motion.div
            key="context"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="about" className="text-sm font-medium text-text-primary">
                What do you do? <span className="text-text-faint font-normal">(optional)</span>
              </label>
              <input
                id="about"
                type="text"
                autoFocus
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="e.g. Full-stack engineer building SaaS products"
                maxLength={120}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-accent/40 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="working-on" className="text-sm font-medium text-text-primary">
                What are you currently working on? <span className="text-text-faint font-normal">(optional)</span>
              </label>
              <input
                id="working-on"
                type="text"
                value={workingOn}
                onChange={(e) => setWorkingOn(e.target.value)}
                placeholder="e.g. A Next.js and PostgreSQL internal tool"
                maxLength={120}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-accent/40 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">
                What will you mainly use Prompt AI for? <span className="text-text-faint font-normal">(optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PRIMARY_USES.map((use) => (
                  <button
                    key={use}
                    type="button"
                    onClick={() => setPrimaryUse(primaryUse === use ? null : use)}
                    className={cn(
                      "px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-colors text-left",
                      primaryUse === use
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-border text-text-muted hover:border-border/60 hover:bg-raised"
                    )}
                  >
                    {use}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="notes" className="text-sm font-medium text-text-primary">
                Anything else Prompt AI should know? <span className="text-text-faint font-normal">(optional)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. I prefer concise, technical explanations"
                rows={2}
                maxLength={280}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-accent/40 transition-colors resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleFinish}
              disabled={isSubmitting}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors text-accent-fill-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent mt-1",
                isSubmitting ? "bg-accent-fill/40 cursor-not-allowed" : "bg-accent-fill hover:bg-accent-fill/90"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue to Prompt AI"
              )}
            </button>

            <button
              type="button"
              onClick={handleFinish}
              disabled={isSubmitting}
              className="text-xs text-text-faint hover:text-text-muted transition-colors text-center"
            >
              Skip for now
            </button>
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
