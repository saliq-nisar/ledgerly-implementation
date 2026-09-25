"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ActivityEntry, ActivityKind } from "@/lib/playground";

export type TimelineKind = ActivityKind | "browser";

export interface TimelineEntry {
  key: string;
  at: string;
  kind: TimelineKind;
  name: string;
  summary: string;
  fields: ActivityEntry["fields"];
}

/* Browser-side events (labels and IDs only). Kept in sessionStorage so they
 * survive the round-trip to Stripe Checkout; the page works without it. */
const STORAGE_KEY = "ledgerly-playground-browser-events";
const EMPTY: TimelineEntry[] = [];
let cache: TimelineEntry[] | null = null;
const listeners = new Set<() => void>();

function readStored(): TimelineEntry[] {
  if (cache) return cache;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? (parsed as TimelineEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function writeStored(entries: TimelineEntry[]) {
  cache = entries.slice(-50);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {}
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const POLL_MS = 2500;

export function useTimeline() {
  const browserEvents = useSyncExternalStore(subscribe, readStored, () => EMPTY);
  const [serverEvents, setServerEvents] = useState<TimelineEntry[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const lastId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/activity?after=${lastId.current}`, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const { events } = (await response.json()) as { events: ActivityEntry[] };
        if (cancelled) return;
        setConnected(true);
        if (events.length === 0) return;
        lastId.current = events[events.length - 1].id;
        setServerEvents((current) =>
          [...current, ...events.map((event) => ({ ...event, key: `s${event.id}` }))].slice(-200),
        );
      } catch {
        if (!cancelled) setConnected(false);
      }
    }
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const addBrowserEvent = useCallback((name: string, summary: string, fields: TimelineEntry["fields"] = {}) => {
    const at = new Date().toISOString();
    writeStored([...readStored(), { key: `b${at}${Math.random()}`, at, kind: "browser", name, summary, fields }]);
  }, []);

  const clearBrowserEvents = useCallback(() => writeStored([]), []);

  const entries = useMemo(
    () => [...browserEvents, ...serverEvents].sort((a, b) => a.at.localeCompare(b.at)),
    [browserEvents, serverEvents],
  );

  return { entries, connected, addBrowserEvent, clearBrowserEvents };
}

export type Timeline = ReturnType<typeof useTimeline>;
