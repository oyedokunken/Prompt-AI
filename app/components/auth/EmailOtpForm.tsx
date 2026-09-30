"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ChevronDown } from "lucide-react";
import { DisposableEmailModal } from "@/components/DisposableEmailModal";
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

export function EmailOtpForm({ ctaLabel }: { ctaLabel: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showDisposableModal, setShowDisposableModal] = useState(false);

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "DISPOSABLE_EMAIL") {
          setShowDisposableModal(true);
          return;
        }
        setServerError(json.message ?? "Could not send a code. Try again.");
        return;
      }
      localStorage.setItem(LAST_USED_KEY, "email");
      router.push(`/verify?email=${encodeURIComponent(data.email)}`);
    } catch {
      setServerError("Unable to reach the server. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
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
                  {serverError}
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
                  isSubmitting
                    ? "bg-accent-fill/40 cursor-not-allowed text-accent-fill-foreground"
                    : "bg-accent-fill hover:bg-accent-fill/90 text-accent-fill-foreground"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Sending code...
                  </>
                ) : (
                  ctaLabel
                )}
              </button>

              <p className="text-[11px] text-text-faint text-center">
                We will email you a 6 digit code, no password needed.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <DisposableEmailModal open={showDisposableModal} onClose={() => setShowDisposableModal(false)} />
    </div>
  );
}
