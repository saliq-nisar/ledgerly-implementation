"use client";

import { useState } from "react";
import { Panel, Pill } from "./ui";

interface Case {
  id: string;
  title: string;
  body: Record<string, unknown> | string;
  expect: { status: number; code: string | null };
  note?: string;
}

const CASES: Case[] = [
  {
    id: "valid",
    title: "Valid browser request",
    body: { productId: "pro", quantity: 1 },
    expect: { status: 200, code: null },
    note: "Creates a real test Checkout Session (not opened).",
  },
  {
    id: "tamper",
    title: "Simulate tampering: amount + currency",
    body: { productId: "pro", quantity: 1, amount: 1, currency: "usd" },
    expect: { status: 400, code: "unexpected_field" },
  },
  { id: "product", title: "Invalid product", body: { productId: "enterprise", quantity: 1 }, expect: { status: 400, code: "invalid_product" } },
  { id: "zero", title: "Quantity 0", body: { productId: "pro", quantity: 0 }, expect: { status: 400, code: "invalid_quantity" } },
  { id: "negative", title: "Negative quantity", body: { productId: "pro", quantity: -1 }, expect: { status: 400, code: "invalid_quantity" } },
  { id: "decimal", title: "Decimal quantity", body: { productId: "pro", quantity: 1.5 }, expect: { status: 400, code: "invalid_quantity" } },
  { id: "excessive", title: "Excessive quantity", body: { productId: "pro", quantity: 11 }, expect: { status: 400, code: "invalid_quantity" } },
  { id: "unknown", title: "Unknown field", body: { productId: "pro", quantity: 1, discount: "100%" }, expect: { status: 400, code: "unexpected_field" } },
  { id: "currency", title: "Invalid currency", body: { productId: "pro", quantity: 1, currency: "xyz" }, expect: { status: 400, code: "unexpected_field" } },
  {
    id: "metadata",
    title: "Invalid metadata",
    body: { productId: "pro", quantity: 1, metadata: { card: "4242424242424242" } },
    expect: { status: 400, code: "unexpected_field" },
    note: "Browsers can't send metadata at all. Server-side metadata rules are shown in the Errors tab.",
  },
  {
    id: "redirect",
    title: "Invalid redirect",
    body: { productId: "pro", quantity: 1, redirect: { success: "https://evil.example/steal" } },
    expect: { status: 400, code: "unexpected_field" },
    note: "Browsers can't send redirects. The server-side invalid_redirect check is in the Errors tab.",
  },
  { id: "json", title: "Malformed JSON", body: '{"productId":', expect: { status: 400, code: "invalid_request" } },
];

interface Result {
  status: number;
  code: string | null;
  message: string;
}

function parseResult(status: number, body: unknown): Result {
  if (typeof body === "object" && body !== null) {
    if ("error" in body && typeof body.error === "object" && body.error !== null) {
      const error = body.error;
      return {
        status,
        code: "code" in error && typeof error.code === "string" ? error.code : null,
        message: "message" in error && typeof error.message === "string" ? error.message : "",
      };
    }
    if ("id" in body && typeof body.id === "string") {
      return { status, code: null, message: `Checkout Session ${body.id.slice(0, 16)}… created` };
    }
  }
  return { status, code: null, message: `HTTP ${status}` };
}

export function SecurityLab({ available }: { available: boolean }) {
  const [results, setResults] = useState<Record<string, Result | "running">>({});
  const [running, setRunning] = useState(false);

  async function run(test: Case) {
    setResults((current) => ({ ...current, [test.id]: "running" }));
    let result: Result;
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof test.body === "string" ? test.body : JSON.stringify(test.body),
      });
      result = parseResult(response.status, await response.json().catch(() => null));
    } catch {
      result = { status: 0, code: "network_error", message: "Network error" };
    }
    setResults((current) => ({ ...current, [test.id]: result }));
  }

  async function runAll() {
    setRunning(true);
    for (const test of CASES) await run(test);
    setRunning(false);
  }

  return (
    <Panel
      eyebrow="Security playground"
      title="Try to break the checkout endpoint"
      description="Each button sends a real request to POST /api/checkout. Validation is done by createCheckoutHandler inside the package; this app adds no checks of its own."
      actions={
        <button
          type="button"
          onClick={runAll}
          disabled={!available || running}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {running ? "Running…" : "Run all"}
        </button>
      }
    >
      {!available && (
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Live tests are unavailable because Stripe credentials are not configured: the library refuses to create a
          client without a secret key, so there is no endpoint to test against.
        </p>
      )}
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {CASES.map((test) => {
          const result = results[test.id];
          const done = result !== undefined && result !== "running";
          const pass = done && result.status === test.expect.status && result.code === test.expect.code;
          return (
            <li key={test.id} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium">{test.title}</p>
                <p className="break-all font-mono text-[11px] text-zinc-500">
                  {typeof test.body === "string" ? test.body : JSON.stringify(test.body)}
                </p>
                {test.note && <p className="text-[11px] text-zinc-500">{test.note}</p>}
              </div>
              <div className="min-w-0 text-xs">
                <p className="text-zinc-500">
                  expected {test.expect.status}
                  {test.expect.code && ` ${test.expect.code}`}
                </p>
                {result === "running" && <p>…</p>}
                {done && (
                  <p className="break-words">
                    <Pill tone={pass ? "green" : "red"}>{pass ? "✓" : "✕"} {result.status}</Pill>{" "}
                    <span className="font-mono">{result.code ?? ""}</span> {result.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => run(test)}
                disabled={!available || running || result === "running"}
                className="justify-self-start rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium transition hover:bg-zinc-100 disabled:opacity-50 md:justify-self-end dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Send
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
