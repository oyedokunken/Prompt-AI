"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ChevronDown, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .transform((v) => v.trim().toLowerCase()),
});

type FormData = z.infer<typeof schema>;

const LAST_USED_KEY = "prompt_ai_last_used_auth";

interface EmailMagicLinkFormProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

// Returning-user login by email. Unlike signup, this never asks for a typed
// code -- one click on the emailed link signs the person in, so email login
// only ever costs the same one-time check that OAuth already needs.
export function EmailMagicLinkForm({ expanded, onExpandedChange }: EmailMagicLinkFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("signups not allowed") || error.message.toLowerCase().includes("not found")) {
          setServerError("No account found for that email. Create one instead.");
        } else {
          setServerError(error.message);
        }
        return;
      }
      localStorage.setItem(LAST_USED_KEY, "email");
      setSent(data.email);
    } catch {
      setServerError("Unable to reach the server. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-lg border border-accent/20 bg-accent/5 p-4 flex flex-col items-center text-center gap-2">
        <MailCheck size={18} className="text-accent" />
        <p className="text-sm text-text-primary font-medium">Check your email</p>
        <p className="text-xs text-text-muted">
          We sent a sign in link to <span className="font-mono text-text-primary">{sent}</span>. Open it on this device to continue.
        </p>
      </div>
    );
  }

  return (
    <div>
      {!expanded && (
        <button
          type="button"
          onClick={() => onExpandedChange(true)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-text-faint hover:text-text-muted transition-colors py-1"
        >
          Continue with email instead
          <ChevronDown size={12} />
        </button>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 pt-1">
              {serverError && (
                <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2" role="alert">
                  {serverError}{" "}
                  {serverError.includes("Create one") && (
                    <Link href="/signup" className="underline">Sign up</Link>
                  )}
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <input
                  id="email"
                  type="email"
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={cn(
                    "w-full px-3.5 py-2.5 rounded-lg bg-surface border text-sm text-text-primary placeholder:text-text-faint font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors",
                    errors.email ? "border-red-500/60" : "border-border focus:border-accent/40"
                  )}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-400" role="alert">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                  isSubmitting ? "bg-accent/40 cursor-not-allowed" : "bg-accent hover:bg-accent/90"
                )}
                style={{ color: "#0A0A0B" }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Sending link...
                  </>
                ) : (
                  "Send me a login link"
                )}
              </button>

              <button
                type="button"
                onClick={() => onExpandedChange(false)}
                className="text-[11px] text-text-faint hover:text-text-muted transition-colors text-center"
              >
                Use Google or GitHub instead
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
