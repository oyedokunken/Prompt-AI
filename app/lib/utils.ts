import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// "Today at 11:43am" for messages sent today, a full date otherwise. Takes
// `now` as a parameter rather than reading Date.now() internally so a
// caller can re-run it on an interval and actually cross the midnight
// boundary during a long-lived session, instead of freezing at render time.
export function formatMessageTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(" ", "")
    .toLowerCase();

  if (isToday) return `Today at ${time}`;

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
