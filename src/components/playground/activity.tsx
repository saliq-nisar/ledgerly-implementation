"use client";

import { useMemo, useState } from "react";
import type { PlaygroundConfig } from "@/lib/playground";
import type { Timeline, TimelineEntry, TimelineKind } from "./timeline";
import { Code, CodeBlock, Panel, Pill, Segmented, type PillTone } from "../ui";

const KIND_TONE: Record<TimelineKind, PillTone> = {
  browser: "neutral",
  callback: "green",
  monitoring: "indigo",
  log: "neutral",
  webhook: "amber",
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/* The payment flow, marked with what actually happened in the latest run. */
const FLOW: { label: string; detail: string; match: (entry: TimelineEntry) => boolean }[] = [
  { label: "Checkout requested", detail: "browser → POST /api/checkout", match: (e) => e.kind === "browser" && e.name === "Checkout requested" },
  { label: "beforeCheckout", detail: "callback, before Stripe", match: (e) => e.name === "beforeCheckout" },
  { label: "Checkout Session created", detail: "onCheckoutCreated", match: (e) => e.name === "onCheckoutCreated" },
  { label: "afterCheckout", detail: "callback, after Stripe", match: (e) => e.name === "afterCheckout" },
  { label: "Customer redirected to Stripe", detail: "browser", match: (e) => e.kind === "browser" && e.name === "Customer redirected to Stripe" },
  {
    label: "checkout.session.completed",
    detail: "signature verified · onWebhookReceived",
    match: (e) => e.name === "onWebhookReceived" && e.fields.eventType === "checkout.session.completed",
  },
  { label: "webhooks.on handler", detail: "raw event handler", match: (e) => e.name === "webhooks.on" },
  { label: "onPaymentSucceeded", detail: "callback with a PaymentOutcome", match: (e) => e.name === "onPaymentSucceeded" },
  {
    label: "Webhook processed",
    detail: "onWebhookProcessed",
    match: (e) => e.name === "onWebhookProcessed" && e.fields.eventType === "checkout.session.completed",
  },
];

const CALLBACKS = [
  ["beforeCheckout", "After validation and pricing, before Stripe", "No session. create() throws checkout_rejected"],
  ["afterCheckout", "After Stripe created the session", "Logged + onError; session still returned"],
  ["onPaymentSucceeded", "Verified checkout.session.completed (paid) or async_payment_succeeded", "Webhook 500, Stripe retries"],
  ["onPaymentFailed", "Verified checkout.session.async_payment_failed", "Webhook 500, Stripe retries"],
  ["onPaymentAttemptFailed", "Verified payment_intent.payment_failed", "Webhook 500, Stripe retries"],
  ["onCheckoutExpired", "Verified checkout.session.expired", "Webhook 500, Stripe retries"],
] as const;

const MONITORING = [
  ["onRequest", "Every operation finished (timing, outcome)"],
  ["onError", "Any operation failed (code, status, retryable)"],
  ["onCheckoutCreated", "A Checkout Session was created"],
  ["onWebhookReceived", "A webhook passed signature verification"],
  ["onWebhookProcessed", "A webhook finished: processed, ignored or duplicate"],
] as const;

const WEBHOOK_STEPS = [
  "Check the raw body and Stripe-Signature header",
  "Verify HMAC signature and replay window (toleranceSeconds)",
  "Parse the event",
  "Emit onWebhookReceived",
  "Check storage for duplicates (createMemoryEventStore)",
  "Run webhooks.on() handlers, then the matching callback",
  "Mark the event processed",
  "Emit onWebhookProcessed",
];

const LISTEN_COMMAND =
  "stripe listen --forward-to localhost:3000/api/webhook \\\n  --events checkout.session.completed,checkout.session.expired,\\\ncheckout.session.async_payment_succeeded,checkout.session.async_payment_failed,\\\npayment_intent.payment_failed";

const FILTERS = ["all", "browser", "callback", "monitoring", "webhook", "log"] as const;
type Filter = (typeof FILTERS)[number];

export function ActivityPanels({ config, timeline }: { config: PlaygroundConfig; timeline: Timeline }) {
  const { entries, connected } = timeline;
  const [filter, setFilter] = useState<Filter>("all");

  const run = useMemo(() => {
    const start = entries.findLastIndex((e) => e.kind === "browser" && e.name === "Checkout requested");
    return start === -1 ? [] : entries.slice(start);
  }, [entries]);

  const counts = useMemo(() => {
    const map = new Map<string, { count: number; last: string }>();
    for (const entry of entries) {
      if (entry.kind !== "callback" && entry.kind !== "monitoring") continue;
      const current = map.get(entry.name);
      map.set(entry.name, { count: (current?.count ?? 0) + 1, last: entry.at });
    }
    return map;
  }, [entries]);

  const visible = useMemo(
    () => entries.filter((entry) => filter === "all" || entry.kind === filter).slice(-80).reverse(),
    [entries, filter],
  );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Panel
          eyebrow="Payment flow"
          title="Latest run"
          description={run.length ? "Steps reached since your last checkout request." : "Create a test checkout to trace the flow."}
        >
          <ol className="relative flex flex-col gap-0">
            {FLOW.map((step, index) => {
              const hit = run.find(step.match);
              return (
                <li key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        hit ? "bg-emerald-500 text-white" : "border border-zinc-300 text-zinc-400 dark:border-zinc-700"
                      }`}
                    >
                      {hit ? "✓" : index + 1}
                    </span>
                    {index < FLOW.length - 1 && <span className="my-0.5 w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />}
                  </div>
                  <div className="pb-3">
                    <p className={`text-sm font-medium ${hit ? "" : "text-zinc-500"}`}>{step.label}</p>
                    <p className="text-[11px] text-zinc-500">
                      {step.detail}
                      {hit && ` · ${time(hit.at)}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel
          eyebrow="Observability"
          title="Developer event timeline"
          description={
            <>
              Real calls from the configured <Code>callbacks</Code>, <Code>monitoring</Code> hooks and redacted{" "}
              <Code>logging.logger</Code>, plus browser steps. IDs, amounts, codes and durations only.
            </>
          }
          actions={
            <Pill tone={connected === false ? "red" : connected ? "green" : "neutral"}>
              {connected === false ? "feed offline" : connected ? "live" : "connecting"}
            </Pill>
          }
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented label="Filter events" value={filter} options={FILTERS} onChange={setFilter} />
            <button
              type="button"
              onClick={timeline.clearBrowserEvents}
              className="text-xs text-zinc-500 underline-offset-2 hover:underline"
            >
              Clear browser events
            </button>
          </div>
          <ol className="max-h-[26rem] divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {visible.length === 0 && <li className="p-4 text-sm text-zinc-500">No events yet.</li>}
            {visible.map((entry) => (
              <li key={entry.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 px-3 py-2">
                <span className="font-mono text-[11px] text-zinc-500">{time(entry.at)}</span>
                <details className="min-w-0">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
                    <Pill tone={KIND_TONE[entry.kind]}>{entry.kind}</Pill>
                    <span className="font-mono text-xs">{entry.name}</span>
                    <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-400">{entry.summary}</span>
                  </summary>
                  {Object.keys(entry.fields).length > 0 && (
                    <pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 font-mono text-[11px] dark:bg-zinc-950">
                      {JSON.stringify(entry.fields, null, 2)}
                    </pre>
                  )}
                </details>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel
        eyebrow="Lifecycle events"
        title="Callbacks, monitoring hooks and webhooks"
        description="Callbacks are awaited and can change the flow. Monitoring hooks are fire-and-forget and can't break a payment."
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="overflow-x-auto">
            <h3 className="mb-2 text-sm font-semibold">
              callbacks <Pill tone="green">awaited</Pill>
            </h3>
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Callback</th>
                  <th className="py-1.5 pr-3 font-medium">Runs</th>
                  <th className="py-1.5 pr-3 font-medium">If it throws</th>
                  <th className="py-1.5 font-medium">Fired</th>
                </tr>
              </thead>
              <tbody>
                {CALLBACKS.map(([name, when, onThrow]) => (
                  <HookRow key={name} name={name} cells={[when, onThrow]} stats={counts.get(name)} />
                ))}
              </tbody>
            </table>
            <h3 className="mb-2 mt-5 text-sm font-semibold">
              monitoring <Pill tone="indigo">fire-and-forget</Pill>
            </h3>
            <table className="w-full min-w-[26rem] text-left text-xs">
              <tbody>
                {MONITORING.map(([name, when]) => (
                  <HookRow key={name} name={name} cells={[when]} stats={counts.get(name)} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <h3 className="text-sm font-semibold">
              webhooks.handle() <Pill tone="amber">POST /api/webhook</Pill>
            </h3>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-zinc-700 dark:text-zinc-300">
              {WEBHOOK_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="text-xs text-zinc-500">
              Replay window {config.webhookToleranceSeconds}s · storage {config.storage} · 200
              processed/ignored/duplicate · 400 bad signature · 500 handler failure (Stripe retries).
            </p>
            <CodeBlock label="Forward every event the callbacks use">{LISTEN_COMMAND}</CodeBlock>
          </div>
        </div>
      </Panel>
    </>
  );
}

function HookRow({
  name,
  cells,
  stats,
}: {
  name: string;
  cells: readonly string[];
  stats: { count: number; last: string } | undefined;
}) {
  return (
    <tr className="border-t border-zinc-100 align-top dark:border-zinc-800">
      <td className="py-1.5 pr-3 font-mono">{name}</td>
      {cells.map((cell) => (
        <td key={cell} className="py-1.5 pr-3 text-zinc-600 dark:text-zinc-400">
          {cell}
        </td>
      ))}
      <td className="whitespace-nowrap py-1.5">
        {stats ? <Pill tone="green">{`${stats.count}× · ${time(stats.last)}`}</Pill> : <span className="text-zinc-400">—</span>}
      </td>
    </tr>
  );
}
