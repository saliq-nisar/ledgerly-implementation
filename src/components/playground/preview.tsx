"use client";

import { Fragment, useMemo, useState } from "react";
import { formatAmount } from "@/lib/format";
import { formatValue, toTs, type ResolvedOption } from "@/lib/effective";
import {
  buildRequestOptions,
  CUSTOMER_PRESETS,
  PLAYGROUND_HEADER,
  REDIRECT_PRESETS,
  stripUndefined,
  type PlaygroundChoices,
  type PlaygroundConfig,
  type ProductSnapshot,
} from "@/lib/playground";
import type { ApiError } from "./playground";
import type { Timeline } from "./timeline";
import { CodeBlock, Panel, Pill, Segmented, type PillTone } from "../ui";

/* ----------------------------------------------------------------- Hierarchy */

const LEVELS = [
  { title: "Global config", where: "createPaymentClient({ checkout })", who: "server" },
  { title: "Product config", where: "products.<id>.checkout", who: "server" },
  { title: "Checkout config", where: "checkout.create({ options })", who: "server (enrich)" },
  { title: "Checkout request", where: "{ productId, quantity }", who: "browser" },
  { title: "Stripe Checkout", where: "Checkout Session", who: "Stripe" },
] as const;

const SOURCE_TONE: Record<ResolvedOption["source"], PillTone> = {
  global: "neutral",
  product: "indigo",
  request: "green",
  "stripe default": "neutral",
};

export function HierarchyPanel({ resolved, product }: { resolved: ResolvedOption[]; product: ProductSnapshot }) {
  return (
    <Panel
      eyebrow="Customization hierarchy"
      title="Effective checkout configuration"
      description={
        <>
          Each level overrides the one before it, option by option. customText and consentCollection merge key by
          key. Policy options stop at the product level. This table is computed in the browser from the documented
          rule, for display. The library performs the real merge on the server.
        </>
      }
    >
      <ol className="mb-5 flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        {LEVELS.map((level, index) => (
          <Fragment key={level.title}>
            <li
              className={`flex-1 rounded-xl border p-3 text-center ${
                level.who === "browser"
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                  : level.who === "Stripe"
                    ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40"
                    : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide">{level.title}</p>
              <p className="mt-1 break-words font-mono text-[10px] text-zinc-500">{level.where}</p>
              <p className="mt-1 text-[10px] text-zinc-500">set by {level.who}</p>
            </li>
            {index < LEVELS.length - 1 && (
              <li aria-hidden className="text-center text-zinc-400 md:px-0.5">
                <span className="md:hidden">↓</span>
                <span className="hidden md:inline">→</span>
              </li>
            )}
          </Fragment>
        ))}
      </ol>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-3 font-medium">Option</th>
              <th className="py-2 pr-3 font-medium">Global</th>
              <th className="py-2 pr-3 font-medium">Product ({product.id})</th>
              <th className="py-2 pr-3 font-medium">Per call</th>
              <th className="py-2 pr-3 font-medium">Effective</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {resolved.map((row) => (
              <tr key={row.key} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                <td className="py-2 pr-3 font-sans">
                  {row.label}
                  {!row.perCall && <span title="Policy controlled"> 🔒</span>}
                </td>
                <Cell value={row.values.global} active={row.source === "global"} />
                <Cell value={row.values.product} active={row.source === "product"} />
                {row.perCall ? (
                  <Cell value={row.values.request} active={row.source === "request"} />
                ) : (
                  <td className="py-2 pr-3 font-sans text-amber-700 dark:text-amber-400">policy</td>
                )}
                <td className="py-2 pr-3">
                  <span className="mr-1">{formatValue(row.effective)}</span>
                  <Pill tone={SOURCE_TONE[row.source]}>{row.source}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Cell({ value, active }: { value: unknown; active: boolean }) {
  return (
    <td className={`max-w-[14rem] break-words py-2 pr-3 ${value === undefined ? "text-zinc-400" : active ? "font-semibold" : "text-zinc-400 line-through"}`}>
      {formatValue(value)}
    </td>
  );
}

/* -------------------------------------------------------------- Code preview */

const PREVIEW_TABS = ["Browser request", "Server call", "Client config"] as const;
type PreviewTab = (typeof PREVIEW_TABS)[number];

export function CodePreview({
  config,
  product,
  quantity,
  choices,
}: {
  config: PlaygroundConfig;
  product: ProductSnapshot;
  quantity: number;
  choices: PlaygroundChoices;
}) {
  const [tab, setTab] = useState<PreviewTab>("Server call");

  const code = useMemo(() => {
    if (tab === "Browser request") {
      return [
        "POST /api/checkout",
        "Content-Type: application/json",
        "Idempotency-Key: <new UUID per attempt>",
        `${PLAYGROUND_HEADER}: ${JSON.stringify(choices)}`,
        "",
        JSON.stringify({ productId: product.id, quantity }, null, 2),
        "",
        "// The body can only ever contain productId and quantity.",
        "// The header holds allowlisted choice keys, not values.",
      ].join("\n");
    }
    if (tab === "Server call") {
      const input = stripUndefined({
        productId: product.id,
        quantity,
        customer: CUSTOMER_PRESETS[choices.customer].customer,
        clientReferenceId: `playground_${product.id}_order_…`,
        metadata: stripUndefined({
          orderId: "order_…",
          customerType: choices.metadataCustomerType === "omit" ? undefined : choices.metadataCustomerType,
          source: choices.metadataSource === "include" ? "playground" : undefined,
        }),
        options: buildRequestOptions(choices),
        redirect: REDIRECT_PRESETS[choices.redirect].value,
      });
      return [
        "// What createCheckoutHandler + enrich pass to the library",
        "// (orderId and clientReferenceId are generated on the server)",
        `await payments.checkout.create(${toTs(input)});`,
      ].join("\n");
    }
    const productDefinition = stripUndefined({
      name: product.name,
      price: product.price,
      currency: product.currency,
      description: product.description ?? undefined,
      images: product.images.length ? product.images : undefined,
      active: product.active ? undefined : false,
      maxQuantity: product.maxQuantity === config.quantity.max ? undefined : product.maxQuantity,
      taxBehavior: product.taxBehavior ?? undefined,
      taxCode: product.taxCode ?? undefined,
      stripePriceId: product.stripePriceId ?? undefined,
      metadata: Object.keys(product.metadata).length ? product.metadata : undefined,
      checkout: Object.keys(product.checkout).length ? product.checkout : undefined,
    });
    const others = config.products.filter((item) => item.id !== product.id).map((item) => item.id);
    return [
      "// src/lib/payments.ts (server-only). Secrets come from env.",
      "const payments = createPaymentClient({",
      `  environment: ${JSON.stringify(config.environment)},`,
      "  products: {",
      `    ${product.id}: ${toTs(productDefinition, 2)},`,
      `    // ${others.join(", ")}`,
      "  },",
      `  urls: ${toTs(config.urls, 1)},`,
      `  checkout: ${toTs({ ...config.clientCheckout, quantity: config.quantity }, 1)},`,
      `  metadata: ${toTs(config.metadataPolicy, 1)},`,
      `  security: ${toTs({ allowedRedirectOrigins: config.allowedRedirectOrigins }, 1)},`,
      `  storage: ${config.storage},`,
      `  webhooks: ${toTs({ toleranceSeconds: config.webhookToleranceSeconds }, 1)},`,
      `  network: ${toTs(config.network, 1)},`,
      `  logging: { logger, level: ${JSON.stringify(config.logLevel)} },`,
      `  errors: ${toTs({ publicMessages: config.publicMessages }, 1)},`,
      "  callbacks: { beforeCheckout, afterCheckout, onPaymentSucceeded,",
      "               onPaymentFailed, onPaymentAttemptFailed, onCheckoutExpired },",
      "  monitoring: { onRequest, onError, onCheckoutCreated,",
      "                onWebhookReceived, onWebhookProcessed },",
      "});",
    ].join("\n");
  }, [tab, config, product, quantity, choices]);

  return (
    <Panel
      eyebrow="Live configuration preview"
      title="Equivalent TypeScript"
      description="Generated for reading only. Nothing here is executed; the real server code is explicit and type-checked."
    >
      <div className="mb-3">
        <Segmented label="Code preview" value={tab} options={PREVIEW_TABS} onChange={setTab} />
      </div>
      <CodeBlock label={tab === "Browser request" ? "HTTP" : "TypeScript"}>{code}</CodeBlock>
    </Panel>
  );
}

/* ----------------------------------------------------------- Checkout action */

function readCheckout(body: unknown): { id: string; url: string } | null {
  if (typeof body !== "object" || body === null || !("url" in body) || !("id" in body)) return null;
  const { id, url } = body;
  return typeof id === "string" && typeof url === "string" && url.startsWith("https://") ? { id, url } : null;
}

function readError(body: unknown, status: number): ApiError {
  const fallback: ApiError = { status, code: "unknown", message: `Checkout failed (HTTP ${status}).`, requestId: null };
  if (typeof body !== "object" || body === null || !("error" in body)) return fallback;
  const { error } = body;
  if (typeof error !== "object" || error === null) return fallback;
  return {
    status,
    code: "code" in error && typeof error.code === "string" ? error.code : fallback.code,
    message: "message" in error && typeof error.message === "string" ? error.message : fallback.message,
    requestId: "requestId" in error && typeof error.requestId === "string" ? error.requestId : null,
  };
}

export function CheckoutAction({
  product,
  quantity,
  choices,
  available,
  onBrowserEvent,
  onError,
}: {
  product: ProductSnapshot;
  quantity: number;
  choices: PlaygroundChoices;
  available: boolean;
  onBrowserEvent: Timeline["addBrowserEvent"];
  onError: (error: ApiError | null) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "redirecting">("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const busy = status !== "idle";

  async function createCheckout() {
    if (busy || !available) return;
    setStatus("loading");
    setError(null);
    onError(null);
    onBrowserEvent("Checkout requested", `${quantity} × ${product.id}`, { productId: product.id, quantity });

    let response: Response;
    try {
      response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          [PLAYGROUND_HEADER]: JSON.stringify(choices),
        },
        body: JSON.stringify({ productId: product.id, quantity }),
      });
    } catch {
      const networkError: ApiError = {
        status: 0,
        code: "network_error",
        message: "Network error. Check your connection and try again.",
        requestId: null,
      };
      setError(networkError);
      onError(networkError);
      onBrowserEvent("Checkout failed", "network error");
      setStatus("idle");
      return;
    }

    const body: unknown = await response.json().catch(() => null);
    const session = response.ok ? readCheckout(body) : null;
    if (!session) {
      const apiError = readError(body, response.status);
      setError(apiError);
      onError(apiError);
      onBrowserEvent("Checkout failed", `${apiError.code} (HTTP ${apiError.status})`, { code: apiError.code });
      setStatus("idle");
      return;
    }

    setStatus("redirecting");
    onBrowserEvent("Customer redirected to Stripe", "Leaving for Stripe-hosted Checkout", { sessionId: session.id });
    window.location.assign(session.url);
  }

  return (
    <section className="rounded-2xl border-2 border-indigo-500/60 bg-white p-5 shadow-lg shadow-indigo-500/10 sm:p-6 dark:bg-zinc-900">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
        Real Stripe test
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Environment: <span className="font-semibold text-amber-700 dark:text-amber-400">Test</span>
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">{product.name}</h2>
        <p className="text-2xl font-bold">{formatAmount(product.price * quantity, product.currency)}</p>
      </div>
      <p className="text-xs text-zinc-500">
        {quantity} × {formatAmount(product.price, product.currency)} · {product.currency.toUpperCase()} · display only;
        the library computes the charged total from the catalog.
      </p>
      <button
        type="button"
        onClick={createCheckout}
        disabled={busy || !available}
        aria-busy={busy}
        className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading"
          ? "Creating checkout…"
          : status === "redirecting"
            ? "Redirecting to Stripe…"
            : "Create Real Checkout"}
      </button>
      {!available && (
        <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Real Stripe test is unavailable because Stripe credentials are not configured.
        </p>
      )}
      <p className="mt-2 text-center text-[11px] text-zinc-500">
        Test card 4242 4242 4242 4242 · any future date · any CVC
      </p>
      {error && (
        <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40">
          <p className="font-medium text-red-700 dark:text-red-300">{error.message}</p>
          <p className="mt-1 font-mono text-[11px] text-red-600/80 dark:text-red-400/80">
            {error.code} · HTTP {error.status}
            {error.requestId && ` · ${error.requestId}`}
          </p>
        </div>
      )}
    </section>
  );
}
