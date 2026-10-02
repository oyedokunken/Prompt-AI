"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, CircleCheck, TriangleAlert } from "lucide-react";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas/password";
import { changePassword, PasswordChangeError } from "@/lib/api/accountApi";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/utils";

type Outcome =
  | { kind: "success" }
  | { kind: "error"; title: string; message: string }
  | { kind: "expired" };

const inputClass =
  "w-full rounded-lg border bg-raised px-3 py-3 md:py-2.5 pr-11 text-[16px] md:text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors";

interface FieldProps {
  id: string;
  label: string;
  autoComplete: string;
  error?: string;
  show: boolean;
  onToggle: () => void;
  registration: UseFormRegisterReturn;
  hint?: string;
}

function PasswordField({ id, label, autoComplete, error, show, onToggle, registration, hint }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-primary mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(inputClass, error ? "border-red-400/60 focus:border-red-400" : "border-border focus:border-accent/50")}
          {...registration}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-md text-text-faint hover:text-text-muted transition-colors"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm md:text-xs text-red-400 mt-1.5">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm md:text-xs text-text-faint mt-1.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// Changing a password, for accounts that have one. Every rule lives in the Zod
// schema and is checked by react-hook-form on blur and on submit, nothing is
// left to the browser's own validation, and the form is marked noValidate so
// its bubbles never appear. Results are shown in a modal.
export function AccountsTab() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [show, setShow] = useState({ current: false, next: false, confirm: false });

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onBlur",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ChangePasswordInput) => {
    // The server checks the session again, but find out here first so an
    // expired one is caught before the user's passwords are sent anywhere.
    const { data, error } = await createClient().auth.getUser();
    if (error || !data.user) {
      setOutcome({ kind: "expired" });
      return;
    }

    try {
      await changePassword(values.currentPassword, values.newPassword);
      reset();
      setShow({ current: false, next: false, confirm: false });
      setOutcome({ kind: "success" });
    } catch (err) {
      if (err instanceof PasswordChangeError && err.code === "UNAUTHORIZED") {
        setOutcome({ kind: "expired" });
        return;
      }
      if (err instanceof PasswordChangeError && err.code === "WRONG_PASSWORD") {
        setOutcome({ kind: "error", title: "Current password is not correct", message: "The current password you entered does not match this account. Check it and try again." });
        return;
      }
      setOutcome({
        kind: "error",
        title: "Password not changed",
        message: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    }
  };

  const closeOutcome = () => {
    const wasError = outcome?.kind === "error";
    setOutcome(null);
    if (wasError) setFocus("currentPassword");
  };

  const signInAgain = async () => {
    await createClient().auth.signOut();
    router.push("/login?next=/settings");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-text-primary mb-6">Accounts</h1>

      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-medium text-text-primary mb-1">Change password</h2>
        <p className="text-sm md:text-xs text-text-muted mb-5">
          Confirm your current password, then choose a new one.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <PasswordField
            id="current-password"
            label="Current password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            show={show.current}
            onToggle={() => setShow((s) => ({ ...s, current: !s.current }))}
            registration={register("currentPassword")}
          />
          <PasswordField
            id="new-password"
            label="New password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            show={show.next}
            onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
            registration={register("newPassword")}
            hint="At least 10 characters, with an uppercase letter, a lowercase letter, a number and a symbol."
          />
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            show={show.confirm}
            onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
            registration={register("confirmPassword")}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 md:py-2.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold hover:bg-accent-fill/90 transition-colors disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {isSubmitting ? "Changing password" : "Change password"}
          </button>
        </form>
      </div>

      <Modal
        open={outcome?.kind === "success"}
        onClose={closeOutcome}
        title="Password changed"
        footer={
          <button
            onClick={closeOutcome}
            className="px-4 py-2.5 md:py-1.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm md:text-xs font-semibold hover:bg-accent-fill/90 transition-colors"
          >
            Done
          </button>
        }
      >
        <div className="flex items-start gap-3">
          <CircleCheck size={22} className="text-green-400 shrink-0 mt-0.5" />
          <p className="text-sm text-text-muted leading-relaxed">
            Your password has been updated. Use the new one the next time you sign in.
          </p>
        </div>
      </Modal>

      <Modal
        open={outcome?.kind === "error"}
        onClose={closeOutcome}
        title={outcome?.kind === "error" ? outcome.title : ""}
        footer={
          <button
            onClick={closeOutcome}
            className="px-4 py-2.5 md:py-1.5 rounded-lg border border-border text-sm md:text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
          >
            Close
          </button>
        }
      >
        <div className="flex items-start gap-3">
          <TriangleAlert size={22} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-text-muted leading-relaxed">{outcome?.kind === "error" ? outcome.message : ""}</p>
        </div>
      </Modal>

      <Modal
        open={outcome?.kind === "expired"}
        onClose={() => setOutcome(null)}
        title="Your session has expired"
        footer={
          <button
            onClick={signInAgain}
            className="px-4 py-2.5 md:py-1.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm md:text-xs font-semibold hover:bg-accent-fill/90 transition-colors"
          >
            Sign in again
          </button>
        }
      >
        <div className="flex items-start gap-3">
          <TriangleAlert size={22} className="text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-text-muted leading-relaxed">
            For your security, your password was not changed. Sign in again, then come back to this page.
          </p>
        </div>
      </Modal>
    </div>
  );
}
