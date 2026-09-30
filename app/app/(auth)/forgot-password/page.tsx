"use client";

import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30;

const emailSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .transform((v) => v.trim().toLowerCase()),
});
type EmailFormData = z.infer<typeof emailSchema>;

const resetSchema = z
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
type ResetFormData = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const emailForm = useForm<EmailFormData>({ resolver: zodResolver(emailSchema), mode: "onBlur" });
  const resetForm = useForm<ResetFormData>({ resolver: zodResolver(resetSchema), mode: "onBlur" });

  useEffect(() => {
    if (step === "code") inputRefs.current[0]?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const focusAt = (index: number) => {
    inputRefs.current[Math.max(0, Math.min(CODE_LENGTH - 1, index))]?.focus();
  };

  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setServerError(null);
    if (cleaned && index < CODE_LENGTH - 1) focusAt(index + 1);
  };

  const handleDigitKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else {
        focusAt(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      focusAt(index - 1);
    } else if (e.key === "ArrowRight") {
      focusAt(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    focusAt(Math.min(pasted.length, CODE_LENGTH - 1));
  };

  const requestCode = async (data: EmailFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await fetch(`${API_URL}/auth/otp/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      // Always proceed to the code step -- the response never reveals
      // whether the account exists.
      setEmail(data.email);
      setCooldown(RESEND_COOLDOWN);
      setStep("code");
    } catch {
      setServerError("Unable to reach the server. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setCooldown(RESEND_COOLDOWN);
    setDigits(Array(CODE_LENGTH).fill(""));
    setServerError(null);
    setTimeout(() => focusAt(0), 50);
    try {
      await fetch(`${API_URL}/auth/otp/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Resend is best-effort -- the UI already reset the cooldown
    }
  };

  const submitReset = async (data: ResetFormData) => {
    const code = digits.join("");
    if (code.length < CODE_LENGTH) {
      setServerError("Enter the full 6-digit code.");
      return;
    }
    setIsSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch(`${API_URL}/auth/otp/verify-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code, newPassword: data.password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setServerError(json.message ?? "The code is incorrect or has expired.");
        return;
      }
      setStep("done");
    } catch {
      setServerError("Unable to reach the server. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFilled = digits.every((d) => d !== "");

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8 gap-4">
        <Link href="/" aria-label="Go to homepage">
          <Logo variant="color" size={36} />
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-text-primary">
            {step === "done" ? "Password updated" : "Reset your password"}
          </h1>
          {step === "email" && (
            <p className="text-sm text-text-muted mt-1">
              Enter your email and we will send you a code.
            </p>
          )}
        </div>
      </div>

      {step === "email" && (
        <form onSubmit={emailForm.handleSubmit(requestCode)} noValidate className="flex flex-col gap-4">
          {serverError && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2" role="alert">
              {serverError}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fp-email" className="text-sm font-medium text-text-primary">Email</label>
            <input
              id="fp-email"
              type="email"
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
              className={cn(
                "w-full px-3.5 py-2.5 rounded-lg bg-surface border text-sm text-text-primary placeholder:text-text-faint font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors",
                emailForm.formState.errors.email ? "border-red-500/60" : "border-border focus:border-accent/40"
              )}
              {...emailForm.register("email")}
            />
            {emailForm.formState.errors.email && (
              <p className="text-xs text-red-400" role="alert">{emailForm.formState.errors.email.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors text-accent-fill-foreground",
              isSubmitting ? "bg-accent-fill/40 cursor-not-allowed" : "bg-accent-fill hover:bg-accent-fill/90"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Sending code...
              </>
            ) : (
              "Send reset code"
            )}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={resetForm.handleSubmit(submitReset)} noValidate className="flex flex-col gap-5">
          <p className="text-sm text-text-muted text-center leading-relaxed">
            If an account exists for{" "}
            <span className="font-mono text-xs text-text-primary">{email}</span>, a code is on its
            way. Enter it below with your new password.
          </p>

          <div className="flex justify-center gap-2.5" role="group" aria-label="Verification code">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                aria-label={`Digit ${i + 1}`}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                onFocus={(e) => e.target.select()}
                className={cn(
                  "w-11 h-14 text-center text-xl font-semibold font-mono rounded-xl border bg-surface text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all",
                  digit ? "border-accent/50 bg-accent/5" : "border-border focus:border-accent/40"
                )}
              />
            ))}
          </div>

          {serverError && (
            <p className="text-center text-xs text-red-400" role="alert">{serverError}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fp-password" className="text-sm font-medium text-text-primary">New password</label>
            <div className="relative">
              <input
                id="fp-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min 10 characters"
                className={cn(
                  "w-full px-3.5 py-2.5 pr-10 rounded-lg bg-surface border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors",
                  resetForm.formState.errors.password ? "border-red-500/60" : "border-border focus:border-accent/40"
                )}
                {...resetForm.register("password")}
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
            {resetForm.formState.errors.password && (
              <p className="text-xs text-red-400" role="alert">{resetForm.formState.errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fp-confirm" className="text-sm font-medium text-text-primary">Confirm password</label>
            <div className="relative">
              <input
                id="fp-confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                className={cn(
                  "w-full px-3.5 py-2.5 pr-10 rounded-lg bg-surface border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors",
                  resetForm.formState.errors.confirmPassword ? "border-red-500/60" : "border-border focus:border-accent/40"
                )}
                {...resetForm.register("confirmPassword")}
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
            {resetForm.formState.errors.confirmPassword && (
              <p className="text-xs text-red-400" role="alert">{resetForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isFilled}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors text-accent-fill-foreground",
              isSubmitting || !isFilled ? "bg-accent-fill/40 cursor-not-allowed" : "bg-accent-fill hover:bg-accent-fill/90"
            )}
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

          <div className="flex items-center justify-center gap-2">
            <p className="text-sm text-text-muted">Didn&apos;t receive it?</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0}
              className={cn(
                "inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-accent rounded",
                cooldown > 0 ? "text-text-faint cursor-not-allowed" : "text-accent hover:text-accent/80"
              )}
            >
              <RefreshCw size={12} />
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div className="rounded-xl border border-border bg-surface p-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-accent" />
          </div>
          <p className="text-sm text-text-muted leading-relaxed">
            Your password has been updated. Log in with your new password.
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold hover:bg-accent-fill/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Go to login
          </button>
        </div>
      )}

      {step !== "done" && (
        <p className="text-center text-sm text-text-muted mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-text-faint hover:text-text-muted transition-colors focus-visible:outline-accent rounded"
          >
            <ArrowLeft size={13} />
            Back to log in
          </Link>
        </p>
      )}
    </div>
  );
}
