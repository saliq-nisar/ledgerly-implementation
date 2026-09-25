"use client";

import { useState, useTransition } from "react";
import { runErrorSamples } from "@/app/actions";
import type { ErrorSample, PlaygroundConfig } from "@/lib/playground";
import type { ApiError } from "./playground";
import { Code, Panel, Pill } from "../ui";

export function ErrorsPanel({
  apiError,
  errorCodes,
  config,
}: {
  apiError: ApiError | null;
  errorCodes: readonly string[];
  config: PlaygroundConfig;
}) {
  const [samples, setSamples] = useState<ErrorSample[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setFailure(null);
    startTransition(async () => {
      try {
        const result = await runErrorSamples();
        if (result.ok) setSamples(result.samples);
        else setFailure(result.message);
      } catch {
        setFailure("Could not run the samples.");
      }
    });
  }

  return (
    <Panel
      id="errors"
      eyebrow="Error handling"
      title="Normalized library errors"
      description={
        <>
          Every failure is a typed <Code>PaymentError</Code>. <Code>payments.errors.describe(error)</Code> turns any
          thrown value into <Code>{"{ code, message, statusCode, retryable }"}</Code>, safe to return to a browser.
        </>
      }
      actions={
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Running…" : samples ? "Run again" : "Run library error samples"}
        </button>
      }
    >
      {apiError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
            Last /api/checkout error (from createCheckoutHandler)
          </p>
          <p className="mt-1 font-mono text-xs">
            {JSON.stringify({ error: { code: apiError.code, message: apiError.message, requestId: apiError.requestId } })}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">HTTP {apiError.status}</p>
        </div>
      )}

      {failure && <p className="mb-3 text-sm text-red-600">{failure}</p>}

      {samples ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Scenario</th>
                <th className="py-2 pr-3 font-medium">code</th>
                <th className="py-2 pr-3 font-medium">statusCode</th>
                <th className="py-2 pr-3 font-medium">retryable</th>
                <th className="py-2 font-medium">message (public)</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={sample.label} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                  <td className="py-2 pr-3">
                    <p className="font-medium">{sample.label}</p>
                    <p className="mt-0.5 break-all font-mono text-[10px] text-zinc-500">{sample.call}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{sample.errorClass ?? "not a PaymentError"}</p>
                  </td>
                  <td className="py-2 pr-3">
                    <Pill tone="red">{sample.info.code}</Pill>
                  </td>
                  <td className="py-2 pr-3 font-mono">{sample.info.statusCode}</td>
                  <td className="py-2 pr-3 font-mono">{String(sample.info.retryable)}</td>
                  <td className="py-2">{sample.info.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
          Runs real library calls on the server (tampered input, bad redirect, card number in metadata,
          beforeCheckout refusal…). Each is rejected before any Stripe request, then passed through{" "}
          <Code>payments.errors.describe()</Code>. They also appear in the timeline via <Code>onError</Code>.
        </p>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold">
            <Code>PaymentErrorCodes</Code> ({errorCodes.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {errorCodes.map((code) => (
              <span key={code} className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
                {code}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold">
            Custom copy: <Code>errors.publicMessages</Code> and handler <Code>messages</Code>
          </p>
          <ul className="space-y-1 text-xs">
            {Object.entries(config.publicMessages).map(([code, message]) => (
              <li key={code}>
                <Code>{code}</Code> → {message}
              </li>
            ))}
            <li>
              <Code>rate_limited</Code> → set per handler in <Code>api/checkout/route.ts</Code>
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-zinc-500">
            Stack traces, Stripe messages and secrets never leave the server. <Code>error.cause</Code> is a sanitized
            summary.
          </p>
        </div>
      </div>
    </Panel>
  );
}
