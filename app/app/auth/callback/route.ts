import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback handler.
 * Supabase redirects here after the user authenticates with Google or GitHub.
 * Exchanges the one-time code for a session and redirects to the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectUrl = new URL(next, origin);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Exchange failed or no code present -- send to login with an error param
  const errorUrl = new URL("/login", origin);
  errorUrl.searchParams.set("error", "oauth_callback_failed");
  return NextResponse.redirect(errorUrl);
}
