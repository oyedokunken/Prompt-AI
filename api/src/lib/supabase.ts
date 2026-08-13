import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";

/**
 * Supabase admin client.
 * Uses the service role key -- never expose this to the browser.
 * Used server-side only for admin operations like creating confirmed users.
 */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
