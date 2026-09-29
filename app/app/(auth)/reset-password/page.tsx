"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/[A-Z]/, "Password needs at least one uppercase letter")
      .regex(/[a-z]/, "Password needs at least one lowercase letter")
      .regex(/[0-9]/, "Password needs at least one number")
      .regex(/[^A-Za-z0-9]/, "Password needs at least one symbol"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user);
    });
  }, []);

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
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) {
        setServerError(error.message || "Could not update your password.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      setServerError("Unable to reach the server. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-surface p-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary mb-1">Password updated</h1>
            <p className="text-sm text-text-muted leading-relaxed">
              Taking you to your dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hasSession === false) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-surface p-6 flex flex-col items-center text-center gap-4">
          <div>
            <h1 className="text-lg font-semibold text-text-primary mb-1">Link expired</h1>
            <p className="text-sm text-text-muted leading-relaxed">
              This reset link is no longer valid. Request a new one to continue.
            </p>
          </div>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-accent text-sm font-semibold hover:bg-accent/90 transition-colors"
            style={{ color: "#0A0A0B" }}
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8 gap-4">
        <Link href="/" aria-label="Go to homepage">
          <Logo variant="color" size={36} />
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-text-primary">Set a new password</h1>
          <p className="text-sm text-text-muted mt-1">Choose a strong password for your account.</p>
        </div>
      </div>

      {serverError && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4" role="alert">
          {serverError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-text-primary">
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Min 10 characters"
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
          {errors.password && (
            <p className="text-xs text-red-400" role="alert">{errors.password.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-text-primary">
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className={cn(
                "w-full px-3.5 py-2.5 pr-10 rounded-lg bg-surface border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors",
                errors.confirmPassword ? "border-red-500/60" : "border-border focus:border-accent/40"
              )}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted transition-colors"
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-red-400" role="alert">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || hasSession === null}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors",
            isSubmitting || hasSession === null
              ? "bg-accent/40 cursor-not-allowed"
              : "bg-accent hover:bg-accent/90"
          )}
          style={{ color: "#0A0A0B" }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Updating...
            </>
          ) : (
            "Update password"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-text-muted mt-6">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-text-faint hover:text-text-muted transition-colors">
          <ArrowLeft size={13} />
          Back to log in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
