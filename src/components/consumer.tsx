import type { ReactNode } from "react";
import type { PaymentsStatus } from "@/lib/payments";
import { readImports, readSource, type PackageFacts } from "@/lib/source";
import { CodeTabs, CopyCode } from "./copy-code";
import { Code, Panel, Pill, type PillTone } from "./ui";

/* ------------------------------------------------------------- Status cards */

function StatusCard({ label, value, detail, tone }: { label: string; value: ReactNode; detail: ReactNode; tone: PillTone }) {
  const dot = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", indigo: "bg-indigo-500", neutral: "bg-zinc-400" }[tone];
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        {label}
      </p>
      <p className="mt-2 break-words font-semibold">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

export function StatusCards({ facts, status }: { facts: PackageFacts; status: PaymentsStatus }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <StatusCard label="Package" tone="green" value={`${facts.name}@${facts.version}`} detail="✓ Installed" />
      <StatusCard
        label="Source"
        tone={facts.installedFromTarball && !facts.hasSourceFolder ? "green" : "amber"}
        value="External package artifact"
        detail={facts.installedFromTarball ? "✓ from .tgz, dist/ only" : "not a .tgz install"}
      />
      <StatusCard
        label="Stripe"
        tone={status.checkout ? "green" : "red"}
        value={status.checkout ? "Test mode" : "Not configured"}
        detail={status.checkout ? "✓ sk_test_ key accepted by the library" : "Set STRIPE_SECRET_KEY"}
      />
      <StatusCard
        label="Checkout"
        tone={status.checkout ? "green" : "red"}
        value={status.checkout ? "Ready" : "Unavailable"}
        detail="POST /api/checkout"
      />
      <StatusCard
        label="Webhook"
        tone={status.webhook ? "green" : "red"}
        value={status.webhook ? "Ready" : "Unavailable"}
        detail={status.webhook ? "POST /api/webhook" : "Set STRIPE_WEBHOOK_SECRET"}
      />
      <StatusCard label="Customization" tone="indigo" value="Enabled" detail="checkout, metadata, callbacks…" />
      <StatusCard label="Security" tone="indigo" value="Server controlled" detail="browser sends productId + quantity" />
    </div>
  );
}

/* --------------------------------------------------------- Boundary diagram */

function Box({ title, subtitle, items, tone }: { title: string; subtitle: string; items: string[]; tone: "app" | "lib" }) {
  return (
    <div
      className={`rounded-xl border-2 p-4 ${
        tone === "app"
          ? "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
          : "border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/50"
      }`}
    >
      <p className="font-mono text-sm font-semibold">{title}</p>
      <p className="text-xs text-zinc-500">{subtitle}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item}>
            <Pill tone={tone === "app" ? "neutral" : "indigo"}>{item}</Pill>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BoundaryDiagram({ facts }: { facts: PackageFacts }) {
  return (
    <Panel
      eyebrow="Architecture"
      title="External package boundary"
      description="This app never sees library source. It imports the published entry points and nothing else."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col items-stretch">
          <Box
            tone="app"
            title="stripe-library-test"
            subtitle="Next.js application (this project)"
            items={["UI", "API routes", "Business logic", "Callbacks", "Product catalog"]}
          />
          <div className="relative my-1 flex flex-col items-center py-2">
            <span className="w-full border-t-2 border-dashed border-rose-400" aria-hidden />
            <span className="-mt-3 rounded-full bg-rose-50 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-800">
              External package boundary
            </span>
            <span className="mt-1 font-mono text-xs text-zinc-500">
              import from &quot;@ledgerly/payments&quot; · &quot;@ledgerly/payments/web&quot;
            </span>
            <span className="text-lg text-zinc-400" aria-hidden>
              ↓
            </span>
          </div>
          <Box
            tone="lib"
            title={`${facts.name}@${facts.version}`}
            subtitle="node_modules (npm package artifact)"
            items={["Products", "Checkout", "Validation", "Security", "Webhooks", "Errors", "Observability"]}
          />
          <div className="flex flex-col items-center py-1 text-lg text-zinc-400" aria-hidden>
            ↓
          </div>
          <div className="rounded-xl border-2 border-violet-400 bg-violet-50 p-3 text-center font-semibold text-violet-800 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
            Stripe <span className="font-normal text-xs">(stripe@{facts.stripeVersion ?? "?"}, a dependency of the package)</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <h3 className="font-semibold">How the package got here</h3>
          <ol className="flex flex-col gap-2 font-mono text-xs">
            <li className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">demo-stripe → npm pack → ledgerly-payments-{facts.version}.tgz</li>
            <li className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">npm install → stripe-library-test/node_modules</li>
            <li className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">import → public API only</li>
          </ol>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-zinc-500">package.json</dt>
            <dd className="break-all font-mono">&quot;@ledgerly/payments&quot;: &quot;{facts.dependencySpec ?? "?"}&quot;</dd>
            <dt className="text-zinc-500">lockfile resolved</dt>
            <dd className="break-all font-mono">{facts.resolved ?? "—"}</dd>
            <dt className="text-zinc-500">integrity</dt>
            <dd className="break-all font-mono">{facts.integrity ? `${facts.integrity.slice(0, 30)}…` : "—"}</dd>
            <dt className="text-zinc-500">direct stripe dep</dt>
            <dd>{facts.stripeIsDirectDependency ? <Pill tone="red">yes</Pill> : <Pill tone="green">no, transitive only</Pill>}</dd>
            <dt className="text-zinc-500">library src/ shipped</dt>
            <dd>{facts.hasSourceFolder ? <Pill tone="amber">yes</Pill> : <Pill tone="green">no, compiled dist/ only</Pill>}</dd>
          </dl>
        </div>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------- Integration code */

export function IntegrationCode() {
  const items = [
    {
      title: "Install",
      label: "terminal",
      code: "npm install @ledgerly/payments\n\n# .env.local (server only, never NEXT_PUBLIC_)\nSTRIPE_SECRET_KEY=sk_test_...\nSTRIPE_WEBHOOK_SECRET=whsec_...\nAPP_URL=http://localhost:3000",
      note: "The only payment dependency. Stripe's SDK comes with the package; the app never installs or imports it.",
    },
    {
      title: "Products",
      label: "src/lib/catalog.ts",
      code: `${readImports("src/lib/catalog.ts")}\n\n${readSource("src/lib/catalog.ts", "products")}`,
      note: "Prices are integer cents. Product IDs become literal types, so a typo is a compile error.",
    },
    {
      title: "Client",
      label: "src/lib/payments.ts",
      code: `${readImports("src/lib/payments.ts")}\n\n${readSource("src/lib/payments.ts", "client")}`,
      note: "Every customization layer in one validated call. Secrets are read from the environment by the library.",
    },
    {
      title: "Checkout",
      label: "src/app/api/checkout/route.ts + src/lib/playground-server.ts",
      code: `${readSource("src/app/api/checkout/route.ts")}\n\n// src/lib/playground-server.ts\n${readSource("src/lib/playground-server.ts", "checkout-options")}`,
      note: "The library's ready-made handler. It accepts only { productId, quantity } and responds { id, url }.",
    },
    {
      title: "Webhook",
      label: "src/app/api/webhook/route.ts + src/lib/webhooks.ts",
      code: `${readSource("src/app/api/webhook/route.ts")}\n\n// src/lib/webhooks.ts\n${readSource("src/lib/webhooks.ts", "webhook")}`,
      note: "Signature verification, replay protection, deduplication and callbacks all run inside the package.",
    },
  ];
  return (
    <Panel
      eyebrow="Integration"
      title="How another application uses the package"
      description="Read from this project's source files at request time, so the code shown is the code running."
    >
      <CodeTabs items={items} />
    </Panel>
  );
}

/* ------------------------------------------------------------- Webhook demo */

const WEBHOOK_FLOW: [string, string, PillTone][] = [
  ["Stripe", "sends the signed event", "neutral"],
  ["checkout.session.completed", "event type", "amber"],
  ["Consumer webhook", "POST /api/webhook (this app)", "neutral"],
  ["@ledgerly/payments", "createWebhookHandler reads the raw body", "indigo"],
  ["Signature verification", "HMAC + replay window, before anything runs", "indigo"],
  ["Deduplication", "storage claims the event ID", "indigo"],
  ["Callback", "webhooks.on handler, then onPaymentSucceeded", "green"],
  ["Consumer application", "fulfil the order (idempotently)", "neutral"],
];

export function WebhookDemo({ ready }: { ready: boolean }) {
  return (
    <Panel
      eyebrow="Webhooks"
      title="Webhook event flow"
      description="The consumer supplies business logic. Everything security-related happens inside the package."
      actions={<Pill tone={ready ? "green" : "red"}>{ready ? "webhook ready" : "webhook unavailable"}</Pill>}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <ol className="flex flex-col">
          {WEBHOOK_FLOW.map(([title, detail, tone], index) => (
            <li key={title} className="flex flex-col items-center text-center">
              <div className="w-full rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <Pill tone={tone}>{title}</Pill>
                <p className="mt-1 text-[11px] text-zinc-500">{detail}</p>
              </div>
              {index < WEBHOOK_FLOW.length - 1 && (
                <span className="py-0.5 text-zinc-400" aria-hidden>
                  ↓
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="flex min-w-0 flex-col gap-4">
          <CopyCode label="src/lib/webhooks.ts" code={readSource("src/lib/webhooks.ts", "webhook")} />
          <CopyCode label="src/lib/observability.ts (callbacks excerpt)" code={readSource("src/lib/observability.ts", "callbacks")} />
          <div>
            <h3 className="mb-2 text-sm font-semibold">Local webhook testing</h3>
            <p className="mb-2 text-xs text-zinc-500">
              Run in a terminal (never from the browser). Put the printed <Code>whsec_…</Code> in{" "}
              <Code>STRIPE_WEBHOOK_SECRET</Code>.
            </p>
            <CopyCode
              label="terminal"
              code={
                "stripe listen --events checkout.session.completed --forward-to localhost:3000/api/webhook\n\n# Also exercise onPaymentAttemptFailed / onCheckoutExpired:\nstripe listen --forward-to localhost:3000/api/webhook \\\n  --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,payment_intent.payment_failed"
              }
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
