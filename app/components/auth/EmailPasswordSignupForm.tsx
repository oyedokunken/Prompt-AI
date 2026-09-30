"use client";

import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ChevronDown, Check, ArrowLeft, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DisposableEmailModal } from "@/components/DisposableEmailModal";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30;

const schema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email address")
      .transform((v) => v.trim().toLowerCase()),
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

const LAST_USED_KEY = "prompt_ai_last_used_auth";

function getStrength(password: string): "empty" | "weak" | "fair" | "strong" {
  if (!password) return "empty";
  let score = 0;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return "weak";
  if (score <= 3) return "fair";
  return "strong";
}

const STRENGTH_CONFIG = {
  empty: { label: "", color: "bg-border", width: "0%" },
  weak: { label: "Weak", color: "bg-red-500", width: "33%" },
  fair: { label: "Fair", color: "bg-yellow-500", width: "66%" },
  strong: { label: "Strong", color: "bg-green-500", width: "100%" },
};

// Signup is a two-step wizard kept inside one component rather than a
// separate /verify route, so the plaintext password only ever lives in
// this component's memory between the two steps. It never touches
// localStorage, sessionStorage, or a URL, and it is only sent once, to the
// verify-signup call that hands it straight to Supabase's admin API.
export function EmailPasswordSignupForm() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState<"details" | "code">("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showDisposableModal, setShowDisposableModal] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const watchedPassword = watch("password", "");
  const strength = getStrength(watchedPassword ?? passwordValue);
  const strengthConfig = STRENGTH_CONFIG[strength];

  useEffect(() => {
    if (step === "code") inputRefs.current[0]?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onSubmitDetails = async (data: FormData) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch(`${API_URL}/auth/otp/request-signup`, {
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
      setEmail(data.email);
      setPassword(data.password);
      setCooldown(RESEND_COOLDOWN);
      setStep("code");
    } catch {
      setServerError("Unable to reach the server. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const focusAt = (index: number) => {
    inputRefs.current[Math.max(0, Math.min(CODE_LENGTH - 1, index))]?.focus();
  };

  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setCodeError(null);
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

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length < CODE_LENGTH) {
      setCodeError("Enter the full 6-digit code.");
      return;
    }
    setIsSubmitting(true);
    setCodeError(null);
    try {
      const res = await fetch(`${API_URL}/auth/otp/verify-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCodeError(json.message ?? "The code is incorrect or has expired.");
        setDigits(Array(CODE_LENGTH).fill(""));
        setTimeout(() => focusAt(0), 50);
        return;
      }

      // The account now exists in Supabase with the real password. Sign in
      // directly rather than a second round trip through the API.
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setCodeError("Account created, but sign in failed. Try logging in.");
        return;
      }

      localStorage.setItem(LAST_USED_KEY, "email");
      router.push("/dashboard");
    } catch {
      setCodeError("Unable to reach the server. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setCooldown(RESEND_COOLDOWN);
    setDigits(Array(CODE_LENGTH).fill(""));
    setCodeError(null);
    setTimeout(() => focusAt(0), 50);
    try {
      const res = await fetch(`${API_URL}/auth/otp/request-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        const json = await res.json();
        setCooldown(json.retryAfterSeconds ?? RESEND_COOLDOWN);
      }
    } catch {
      // Resend is best-effort -- the UI already reset the cooldown
    }
  };

  const isFilled = digits.every((d) => d !== "");

  if (step === "code") {
    return (
      <div className="flex flex-col gap-5 pt-1">
        <div className="text-center">
          <p className="text-sm text-text-primary font-medium">Check your email</p>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            We sent a 6-digit code to{" "}
            <span className="font-mono text-text-primary">{email}</span>.
          </p>
        </div>

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
                digit ? "border-accent/50 bg-accent/5" : "border-border focus:border-accent/40",
                codeError ? "border-red-500/60" : ""
              )}
            />
          ))}
        </div>

        {codeError && (
          <p className="text-center text-xs text-red-400" role="alert">{codeError}</p>
        )}

        <button
          type="button"
          onClick={handleVerify}
          disabled={isSubmitting || !isFilled}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors text-accent-fill-foreground",
            isSubmitting || !isFilled ? "bg-accent-fill/40 cursor-not-allowed" : "bg-accent-fill hover:bg-accent-fill/90"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Verifying...
            </>
          ) : (
            "Create account"
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

        <button
          type="button"
          onClick={() => setStep("details")}
          className="inline-flex items-center justify-center gap-1.5 text-sm text-text-faint hover:text-text-muted transition-colors focus-visible:outline-accent rounded"
        >
          <ArrowLeft size={13} />
          Back
        </button>
      </div>
    );
  }

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
            <form onSubmit={handleSubmit(onSubmitDetails)} noValidate className="flex flex-col gap-4 pt-1">
              {serverError && (
                <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2" role="alert">
                  {serverError}
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-email" className="text-sm font-medium text-text-primary">Email</label>
                <input
                  id="signup-email"
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
                <label htmlFor="signup-password" className="text-sm font-medium text-text-primary">Password</label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Min 10 characters"
                    className={cn(
                      "w-full px-3.5 py-2.5 pr-10 rounded-lg bg-surface border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors",
                      errors.password ? "border-red-500/60" : "border-border focus:border-accent/40"
                    )}
                    {...register("password", { onChange: (e) => setPasswordValue(e.target.value) })}
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

                {passwordValue && (
                  <div className="space-y-1.5">
                    <div className="h-1 rounded-full bg-raised overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-300", strengthConfig.color)} style={{ width: strengthConfig.width }} />
                    </div>
                    {strengthConfig.label && (
                      <p className={cn("text-xs font-mono", {
                        "text-red-400": strength === "weak",
                        "text-yellow-400": strength === "fair",
                        "text-green-400": strength === "strong",
                      })}>
                        {strengthConfig.label}
                      </p>
                    )}
                  </div>
                )}

                {errors.password && <p className="text-xs text-red-400" role="alert">{errors.password.message}</p>}

                {!errors.password && passwordValue && (
                  <ul className="space-y-0.5 mt-0.5">
                    {[
                      { rule: /[A-Z]/, label: "One uppercase letter" },
                      { rule: /[a-z]/, label: "One lowercase letter" },
                      { rule: /[0-9]/, label: "One number" },
                      { rule: /[^A-Za-z0-9]/, label: "One symbol" },
                      { rule: /.{10,}/, label: "At least 10 characters" },
                    ].map(({ rule, label }) => {
                      const passes = rule.test(passwordValue);
                      return (
                        <li key={label} className={cn("flex items-center gap-1.5 text-xs", passes ? "text-green-400" : "text-text-faint")}>
                          <Check size={10} className={passes ? "opacity-100" : "opacity-0"} aria-hidden="true" />
                          {label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-confirm" className="text-sm font-medium text-text-primary">Confirm password</label>
                <div className="relative">
                  <input
                    id="signup-confirm"
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
                {errors.confirmPassword && <p className="text-xs text-red-400" role="alert">{errors.confirmPassword.message}</p>}
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
                  "Create account"
                )}
              </button>

              <p className="text-[11px] text-text-faint text-center">
                By continuing you agree to the{" "}
                <Link href="/terms" className="underline hover:text-text-muted">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" className="underline hover:text-text-muted">Privacy Policy</Link>.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <DisposableEmailModal open={showDisposableModal} onClose={() => setShowDisposableModal(false)} />
    </div>
  );
}
