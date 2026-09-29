"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Code2, Palette, Briefcase, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const ROLES = [
  { id: "developer", label: "Developer", icon: Code2 },
  { id: "designer", label: "Designer", icon: Palette },
  { id: "product", label: "Product manager", icon: Briefcase },
  { id: "other", label: "Something else", icon: Sparkles },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["id"] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !role) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        data: { preferred_name: name.trim(), role, onboarded: true },
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8 gap-4">
        <Logo variant="color" size={36} />
        <div className="text-center">
          <h1 className="text-xl font-semibold text-text-primary">Welcome to Prompt AI</h1>
          <p className="text-sm text-text-muted mt-1">A couple of quick things, then you&apos;re in.</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="preferred-name" className="text-sm font-medium text-text-primary">
            What should we call you?
          </label>
          <input
            id="preferred-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={40}
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-accent/40 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">What best describes you?</label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setRole(id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-xs font-medium transition-colors",
                  role === id
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border text-text-muted hover:border-border/60 hover:bg-raised"
                )}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !name.trim() || !role}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent mt-1",
            isSubmitting || !name.trim() || !role
              ? "bg-accent/40 cursor-not-allowed"
              : "bg-accent hover:bg-accent/90"
          )}
          style={{ color: "#0A0A0B" }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving...
            </>
          ) : (
            "Continue to Prompt AI"
          )}
        </button>
      </div>
    </div>
  );
}
