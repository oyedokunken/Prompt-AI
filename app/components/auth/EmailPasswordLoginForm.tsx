"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

const LAST_USED_KEY = "prompt_ai_last_used_auth";

interface EmailPasswordLoginFormProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function EmailPasswordLoginForm({ expanded, onExpandedChange }: EmailPasswordLoginFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) {
        setServerError(
          error.message.toLowerCase().includes("invalid")
            ? "Email or password is incorrect."
            : error.message
        );
        return;
      }
      localStorage.setItem(LAST_USED_KEY, "email");
      router.push("/dashboard");
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
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pt-1">
              {serverError && (
                <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2" role="alert">
                  {serverError}
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-email" className="text-sm font-medium text-text-primary">Email</label>
                <input
                  id="login-email"
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
                {errors.email && <p className="text-xs text-red-400" role="alert">{errors.email.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-sm font-medium text-text-primary">Password</label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-text-faint hover:text-text-muted transition-colors focus-visible:outline-accent rounded"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Your password"
                    className={cn(
                      "w-full px-3.5 py-2.5 pr-10 rounded-lg bg-surface border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors",
                      errors.password ? "border-red-500/60" : "border-border focus:border-accent/40"
                    )}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400" role="alert">{errors.password.message}</p>}
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
                    Logging in...
                  </>
                ) : (
                  "Log in"
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
