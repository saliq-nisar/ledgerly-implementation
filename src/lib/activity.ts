import "server-only";

import type { ActivityEntry, ActivityKind } from "@/lib/playground";

/**
 * In-memory feed of library callbacks, monitoring hooks and log lines for the
 * playground timeline. Single-process and lost on restart: demo only.
 * Stored on globalThis so every route in the dev server shares one feed.
 */
const MAX_ENTRIES = 200;

type Feed = { nextId: number; entries: ActivityEntry[] };
const store = globalThis as typeof globalThis & { __ledgerlyActivity?: Feed };
const feed: Feed = (store.__ledgerlyActivity ??= { nextId: 1, entries: [] });

export function recordActivity(
  kind: ActivityKind,
  name: string,
  summary: string,
  fields: ActivityEntry["fields"] = {},
): void {
  feed.entries.push({ id: feed.nextId++, at: new Date().toISOString(), kind, name, summary, fields });
  if (feed.entries.length > MAX_ENTRIES) feed.entries.splice(0, feed.entries.length - MAX_ENTRIES);
}

export function activitySince(afterId: number): ActivityEntry[] {
  return feed.entries.filter((entry) => entry.id > afterId);
}
