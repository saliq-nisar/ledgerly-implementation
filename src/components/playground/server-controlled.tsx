"use client";

import { useMemo } from "react";
import type { PlaygroundConfig } from "@/lib/playground";
import { CopyCode } from "../copy-code";
import { Code, Pill } from "../ui";
import type { Timeline } from "./timeline";

export interface ServerCode {
  callbacks: string;
  monitoring: string;
  logger: string;
  client: string;
}

type Section = "Callbacks" | "Errors" | "Logging" | "Monitoring";

const CALLBACK_NAMES = [
  "beforeCheckout",
  "afterCheckout",
  "onPaymentSucceeded",
  "onPaymentFailed",
  "onPaymentAttemptFailed",
  "onCheckoutExpired",
];
const MONITORING_NAMES = ["onRequest", "onError", "onCheckoutCreated", "onWebhookReceived", "onWebhookProcessed"];

/**
 * Callbacks, error copy, logging and monitoring are functions and policy on
 * the server. The browser can't (and mustn't) change them, so these tabs show
 * the real configuration and what it has done so far.
 */
export function ServerControlledPanel({
  section,
  config,
  code,
  timeline,
}: {
  section: Section;
  config: PlaygroundConfig;
  code: ServerCode;
  timeline: Timeline;
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of timeline.entries) map.set(entry.name, (map.get(entry.name) ?? 0) + 1);
    return map;
  }, [timeline.entries]);

  const logCount = timeline.entries.filter((entry) => entry.kind === "log").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="amber">🔒 SERVER-CONTROLLED</Pill>
        <span className="text-xs text-zinc-500">
          Set once in <Code>createPaymentClient</Code>. Not configurable per checkout call, and never from the browser.
        </span>
      </div>

      {section === "Callbacks" && (
        <>
          <Fired names={CALLBACK_NAMES} counts={counts} />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Awaited by the library. <Code>beforeCheckout</Code> can refuse a purchase with{" "}
            <Code>rejectCheckout()</Code> (here: more than {config.businessSeatsLeft} Business seats). Payment
            callbacks run only after webhook signature verification.
          </p>
          <CopyCode label="src/lib/observability.ts · callbacks" code={code.callbacks} />
        </>
      )}

      {section === "Monitoring" && (
        <>
          <Fired names={MONITORING_NAMES} counts={counts} />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Fire-and-forget hooks for Sentry, Datadog, OpenTelemetry… They receive IDs, amounts, codes and durations
            only, and a failing hook can&apos;t affect a payment. Their output feeds the timeline below.
          </p>
          <CopyCode label="src/lib/observability.ts · monitoring" code={code.monitoring} />
        </>
      )}

      {section === "Logging" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="logging.level" value={config.logLevel} />
            <Stat label="logger" value="custom (console + timeline)" />
            <Stat label="log lines so far" value={String(logCount)} />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            The library redacts every field before the logger sees it: names like <Code>secret</Code>,{" "}
            <Code>token</Code>, <Code>card</Code>, <Code>signature</Code> become <Code>[REDACTED]</Code>, and
            key-, secret- or card-like values are masked. Filter the timeline by <Code>log</Code> to see them.
          </p>
          <CopyCode label="src/lib/observability.ts · logger" code={code.logger} />
        </>
      )}

      {section === "Errors" && (
        <>
          <ul className="space-y-1 text-sm">
            {Object.entries(config.publicMessages).map(([errorCode, message]) => (
              <li key={errorCode}>
                <Code>errors.publicMessages.{errorCode}</Code> → {message}
              </li>
            ))}
            <li>
              <Code>createCheckoutHandler(…, {"{ messages: { rate_limited } }"})</Code> → per-handler copy
            </li>
          </ul>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Every failure is a <Code>PaymentError</Code> with a stable code. <Code>payments.errors.describe()</Code>{" "}
            makes any thrown value safe to return. Run the live samples in the{" "}
            <a href="#errors" className="font-medium text-indigo-600 hover:underline">
              Errors panel
            </a>
            .
          </p>
          <CopyCode label="src/lib/payments.ts · client" code={code.client} />
        </>
      )}
    </div>
  );
}

function Fired({ names, counts }: { names: string[]; counts: Map<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.map((name) => {
        const count = counts.get(name) ?? 0;
        return (
          <Pill key={name} tone={count > 0 ? "green" : "neutral"}>
            <span className="font-mono">{name}</span> {count > 0 ? `${count}×` : "not yet"}
          </Pill>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="font-mono text-[11px] text-zinc-500">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
