"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Whether the visitor already has a signed in session, so public pages can
// send them back into the app instead of asking them to log in again. It is
// null until the browser has answered, which lets a page hold its call to
// action steady instead of flashing the wrong one.
export function useHasSession(): boolean | null {
  const [has, setHas] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setHas(!!data.session);
      })
      .catch(() => {
        if (active) setHas(false);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHas(!!session);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return has;
}
