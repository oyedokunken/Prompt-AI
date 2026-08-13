import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback handler.
 * Supabase redirects here after the user authenticates with Google or GitHub.
 * Exchanges the one-time code for a session, sends welcome email, and redirects to the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user?.email) {
      // Send welcome email to OAuth users on first sign-in
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/send-welcome`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.user.email }),
        });
      } catch {
        // Welcome email failure is non-blocking
      }

      const redirectUrl = new URL(next, origin);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Exchange failed or no code present -- send to login with an error param
  const errorUrl = new URL("/login", origin);
  errorUrl.searchParams.set("error", "oauth_callback_failed");
  return NextResponse.redirect(errorUrl);
}
