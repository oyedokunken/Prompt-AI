"use client";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

// Header for every non-chat dashboard page (media, exports, saved prompts,
// favorites, history, settings). Each page supplies only its section name.
export function SimplePageHeader({ title }: { title: string }) {
  return <DashboardHeader label={title} />;
}
