"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const onSubmit = async (data: FormData) => {
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      // Always show the success state regardless of whether the address exists,
      // to prevent email enumeration.
    } catch {
      // Best-effort -- show success anyway to prevent enumeration
    }
    setSubmittedEmail(data.email);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-4">
          <Link href="/" aria-label="Go to homepage">
            <Logo variant="color" size={36} />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
            <MailCheck size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary mb-1">
              Check your inbox
            </h1>
            <p className="text-sm text-text-muted leading-relaxed">
              We sent a password reset link to{" "}
              <span className="text-text-primary font-mono text-xs">
                {submittedEmail}
              </span>
              . The link expires in 15 minutes.
            </p>
          </div>
          <p className="text-xs text-text-faint leading-relaxed">
            Didn&apos;t receive it? Check your spam folder, or{" "}
            <button
              onClick={() => setSubmitted(false)}
              className="text-accent hover:text-accent/80 transition-colors underline underline-offset-2 focus-visible:outline-accent rounded"
            >
              try a different address
            </button>
            .
          </p>
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

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8 gap-4">
        <Link href="/" aria-label="Go to homepage">
          <Logo variant="color" size={36} />
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-text-primary">
            Reset your password
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-text-primary">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            className={cn(
              "w-full px-3.5 py-2.5 rounded-lg bg-surface border text-sm text-text-primary placeholder:text-text-faint font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors",
              errors.email
                ? "border-red-500/60"
                : "border-border focus:border-accent/40"
            )}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-400" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            isSubmitting
              ? "bg-accent/40 cursor-not-allowed"
              : "bg-accent hover:bg-accent/90"
          )}
          style={{ color: "#0A0A0B" }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Sending...
            </>
          ) : (
            "Send reset link"
          )}
        </button>
      </form>

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
