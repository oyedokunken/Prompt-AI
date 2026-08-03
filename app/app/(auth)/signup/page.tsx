"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

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
    terms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms to continue" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;
type OAuthProvider = "google" | "github";

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

const GOOGLE_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const GITHUB_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [passwordValue, setPasswordValue] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(LAST_USED_KEY);
    if (stored) setLastUsed(stored);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const watchedPassword = watch("password", "");

  useEffect(() => {
    setPasswordValue(watchedPassword ?? "");
  }, [watchedPassword]);

  const strength = getStrength(passwordValue);
  const strengthConfig = STRENGTH_CONFIG[strength];

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 1400));
      localStorage.setItem(LAST_USED_KEY, "email");
      console.log("Signup:", data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      localStorage.setItem(LAST_USED_KEY, provider);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8 gap-4">
        <Link href="/" aria-label="Go to homepage">
          <Logo variant="color" size={36} />
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-text-primary">
            Create your account
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Free to start. No credit card required.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <OAuthButton
          icon={GOOGLE_ICON}
          label="Continue with Google"
          onClick={() => handleOAuth("google")}
          loading={oauthLoading === "google"}
          disabled={!!oauthLoading || isSubmitting}
          lastUsed={lastUsed === "google"}
        />
        <OAuthButton
          icon={GITHUB_ICON}
          label="Continue with GitHub"
          onClick={() => handleOAuth("github")}
          loading={oauthLoading === "github"}
          disabled={!!oauthLoading || isSubmitting}
          lastUsed={lastUsed === "github"}
        />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-faint font-mono">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-text-primary">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={cn(
              "w-full px-3.5 py-2.5 rounded-lg bg-surface border text-sm text-text-primary placeholder:text-text-faint font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors",
              errors.email ? "border-red-500/60" : "border-border focus:border-accent/40"
            )}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-400" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-text-primary">
            Password
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted transition-colors focus-visible:outline-accent rounded"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {passwordValue && (
            <div className="space-y-1.5">
              <div className="h-1 rounded-full bg-raised overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-300", strengthConfig.color)}
                  style={{ width: strengthConfig.width }}
                />
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

          {errors.password && (
            <p className="text-xs text-red-400" role="alert">
              {errors.password.message}
            </p>
          )}

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
          <label htmlFor="confirmPassword" className="text-sm font-medium text-text-primary">
            Confirm password
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted transition-colors focus-visible:outline-accent rounded"
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-red-400" role="alert">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 rounded border border-border bg-surface accent-accent focus-visible:outline-accent cursor-pointer shrink-0"
            {...register("terms")}
          />
          <span className="text-sm text-text-muted leading-relaxed">
            I agree to the{" "}
            <Link href="/terms" className="text-accent hover:text-accent/80 transition-colors focus-visible:outline-accent rounded">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-accent hover:text-accent/80 transition-colors focus-visible:outline-accent rounded">
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.terms && (
          <p className="text-xs text-red-400 -mt-2" role="alert">
            {errors.terms.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !!oauthLoading}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent mt-1",
            isSubmitting || !!oauthLoading
              ? "bg-accent/40 cursor-not-allowed"
              : "bg-accent hover:bg-accent/90"
          )}
          style={{ color: "#0A0A0B" }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-text-muted mt-6">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-accent hover:text-accent/80 transition-colors font-medium focus-visible:outline-accent rounded"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

interface OAuthButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  lastUsed: boolean;
}

function OAuthButton({ icon, label, onClick, loading, disabled, lastUsed }: OAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-accent",
        disabled
          ? "opacity-50 cursor-not-allowed border-border text-text-faint"
          : "border-border text-text-muted hover:text-text-primary hover:bg-raised hover:border-border/60"
      )}
    >
      {loading ? <Loader2 size={15} className="animate-spin text-text-faint" /> : icon}
      {label}
      {lastUsed && !loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono px-1.5 py-0.5 rounded border border-accent/30 text-accent bg-accent/5 leading-none">
          Last used
        </span>
      )}
    </button>
  );
}
