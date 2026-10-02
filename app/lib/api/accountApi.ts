import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// code is the server's error code, such as UNAUTHORIZED or WRONG_PASSWORD, so
// the screen can choose what to tell the user.
export class PasswordChangeError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new PasswordChangeError("Your session has expired.", "UNAUTHORIZED");

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  } catch {
    throw new PasswordChangeError("Could not reach the server. Check your connection and try again.", "NETWORK");
  }
  if (res.ok) return;

  let body: { error?: string; message?: string } = {};
  try {
    body = await res.json();
  } catch {
    // keep the defaults
  }
  if (res.status === 429) throw new PasswordChangeError("Too many attempts. Wait a few minutes and try again.", "RATE_LIMITED");
  throw new PasswordChangeError(body.message ?? "Could not change your password.", body.error ?? "UNKNOWN");
}
