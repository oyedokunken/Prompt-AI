// Pinned chats. Which chats are pinned is kept as a list of ids on the user's
// own auth profile, so it follows them across devices without a change to the
// chat table. Newest pin first.

import type { ChatSession } from "@/lib/types/chat";

export const PIN_KEY = "pinned_chats";
export const MAX_PINS = 50;

export function readPinned(metadata: unknown): string[] {
  const raw = (metadata as Record<string, unknown> | null | undefined)?.[PIN_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

export function togglePinned(pinned: string[], id: string): string[] {
  if (pinned.includes(id)) return pinned.filter((p) => p !== id);
  return [id, ...pinned].slice(0, MAX_PINS);
}

// Splits chats into the pinned ones, in pin order, and everyone else in their
// existing order. A pin whose chat no longer exists is simply ignored.
export function partitionPinned(sessions: ChatSession[], pinned: string[]): { pinned: ChatSession[]; rest: ChatSession[] } {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const pinnedSessions = pinned.map((id) => byId.get(id)).filter((s): s is ChatSession => !!s);
  const pinnedIds = new Set(pinnedSessions.map((s) => s.id));
  return { pinned: pinnedSessions, rest: sessions.filter((s) => !pinnedIds.has(s.id)) };
}
