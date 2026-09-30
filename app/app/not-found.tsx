import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { NotFoundScene } from "@/components/NotFoundScene";

export const metadata: Metadata = {
  title: "Signal lost",
};

// Deliberately at the app root, outside the (marketing) and (auth) route
// groups, so it renders on its own with no public header or footer.
export default async function NotFound() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <NotFoundScene isAuthenticated={!!user} />;
}
