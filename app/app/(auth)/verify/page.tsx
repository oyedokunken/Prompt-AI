"use client";

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const focusAt = (index: number) => {
    inputRefs.current[Math.max(0, Math.min(CODE_LENGTH - 1, index))]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setError(null);
    if (cleaned && index < CODE_LENGTH - 1) {
      focusAt(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
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
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    focusAt(Math.min(pasted.length, CODE_LENGTH - 1));
  };

  const handleSubmit = async () => {
    const code = digits.join("");
    if (code.length < CODE_LENGTH) {
      setError("Enter the full 6-digit code.");
      return;
    }
    if (!email) {
      setError("Email address is missing. Return to login and try again.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "The code is incorrect or has expired.");
        setDigits(Array(CODE_LENGTH).fill(""));
        setTimeout(() => focusAt(0), 50);
        return;
      }

      // Redeem the bridge token for a real Supabase session -- this is what
      // the dashboard, chat, and storage actually check.
      const supabase = createClient();
      const { error: bridgeError } = await supabase.auth.verifyOtp({
        email: json.email,
        token_hash: json.tokenHash,
        type: "magiclink",
      });
      if (bridgeError) {
        setError("Could not complete sign in. Try again.");
        return;
      }

      setVerified(true);
    } catch {
      setError("Unable to reach the server. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setCooldown(RESEND_COOLDOWN);
    setDigits(Array(CODE_LENGTH).fill(""));
    setError(null);
    setTimeout(() => focusAt(0), 50);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/otp/request`, {
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

  if (verified) {
    return (
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-4">
          <Link href="/" aria-label="Go to homepage">
            <Logo variant="color" size={36} />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary mb-1">
              Verified
            </h1>
            <p className="text-sm text-text-muted leading-relaxed">
              Your email has been confirmed. You can now use Prompt AI.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold hover:bg-accent-fill/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Go to dashboard
          </button>
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
          <h1 className="text-xl font-semibold text-text-primary">
            Check your email
          </h1>
          <p className="text-sm text-text-muted mt-1 leading-relaxed">
            We sent a 6-digit code to{" "}
            {email ? (
              <span className="font-mono text-xs text-text-primary">{email}</span>
            ) : (
              "your email address"
            )}
            . Enter it below to verify your account.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* OTP digit inputs */}
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
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              onFocus={(e) => e.target.select()}
              className={cn(
                "w-11 h-14 text-center text-xl font-semibold font-mono rounded-xl border bg-surface text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all",
                digit
                  ? "border-accent/50 bg-accent/5"
                  : "border-border focus:border-accent/40",
                error ? "border-red-500/60" : ""
              )}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-xs text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !isFilled}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors text-accent-fill-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            isSubmitting || !isFilled
              ? "bg-accent-fill/40 cursor-not-allowed"
              : "bg-accent-fill hover:bg-accent-fill/90"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Verifying...
            </>
          ) : (
            "Continue"
          )}
        </button>

        {/* Resend */}
        <div className="flex items-center justify-center gap-2">
          <p className="text-sm text-text-muted">Didn&apos;t receive it?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-accent rounded",
              cooldown > 0
                ? "text-text-faint cursor-not-allowed"
                : "text-accent hover:text-accent/80"
            )}
          >
            <RefreshCw size={12} className={cooldown > 0 ? "" : ""} />
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </div>

      <p className="text-center text-sm text-text-muted mt-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-text-faint hover:text-text-muted transition-colors focus-visible:outline-accent rounded"
        >
          <ArrowLeft size={13} />
          Back to log in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
