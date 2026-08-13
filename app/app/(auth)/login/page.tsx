"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

type OAuthProvider = "google" | "github";

const LAST_USED_KEY = "prompt_ai_last_used_auth";

const GOOGLE_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const GITHUB_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LAST_USED_KEY);
    if (stored) setLastUsed(stored);

    if (searchParams.get("error") === "oauth_callback_failed") {
      setServerError("OAuth sign-in failed. Please try again.");
    }
  }, [searchParams]);

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "EMAIL_NOT_VERIFIED") {
          router.push(`/verify?email=${encodeURIComponent(data.email)}`);
          return;
        }
        setServerError(json.message ?? "Login failed. Check your credentials.");
        return;
      }
      localStorage.setItem(LAST_USED_KEY, "email");
      if (typeof json.accessToken === "string") {
        localStorage.setItem("access_token", json.accessToken);
        localStorage.setItem("refresh_token", json.refreshToken);
      }
      const next = searchParams.get("next") ?? "/dashboard";
      router.push(next);
    } catch {
      setServerError("Unable to reach the server. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    setServerError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) {
        setServerError(error.message);
        setOauthLoading(null);
        return;
      }
      localStorage.setItem(LAST_USED_KEY, provider);
      // Page will redirect to provider -- no need to clear oauthLoading
    } catch {
      setServerError("OAuth sign-in could not be initiated.");
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
            Log in to Prompt AI
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Welcome back. Pick up where you left off.
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

      {serverError && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4" role="alert">
          {serverError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium text-text-primary"
          >
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
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-text-primary"
            >
              Password
            </label>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              className={cn(
                "w-full px-3.5 py-2.5 pr-10 rounded-lg bg-surface border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors",
                errors.password
                  ? "border-red-500/60"
                  : "border-border focus:border-accent/40"
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
          {errors.password && (
            <p className="text-xs text-red-400" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-text-faint hover:text-text-muted transition-colors focus-visible:outline-accent rounded"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !!oauthLoading}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            isSubmitting || !!oauthLoading
              ? "bg-accent/40 cursor-not-allowed"
              : "bg-accent hover:bg-accent/90"
          )}
          style={{ color: "#0A0A0B" }}
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

        {lastUsed === "email" && (
          <p className="text-center text-xs text-text-faint">
            Last used: email and password
          </p>
        )}
      </form>

      <p className="text-center text-sm text-text-muted mt-6">
        New here?{" "}
        <Link
          href="/signup"
          className="text-accent hover:text-accent/80 transition-colors font-medium focus-visible:outline-accent rounded"
        >
          Create an account
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

function OAuthButton({
  icon,
  label,
  onClick,
  loading,
  disabled,
  lastUsed,
}: OAuthButtonProps) {
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
      {loading ? (
        <Loader2 size={15} className="animate-spin text-text-faint" />
      ) : (
        icon
      )}
      {label}
      {lastUsed && !loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono px-1.5 py-0.5 rounded border border-accent/30 text-accent bg-accent/5 leading-none">
          Last used
        </span>
      )}
    </button>
  );
}
