import { PaymentErrorCodes } from "@ledgerly/payments";
import { BoundaryDiagram, IntegrationCode, StatusCards, WebhookDemo } from "@/components/consumer";
import { Playground } from "@/components/playground/playground";
import { SecurityBoundary } from "@/components/security-boundary";
import { SecurityLab } from "@/components/security-lab";
import { Pill } from "@/components/ui";
import { products } from "@/lib/catalog";
import { paymentsStatus, playgroundConfig } from "@/lib/payments";
import { packageFacts, readSource } from "@/lib/source";

function SectionHeading({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="mt-6 scroll-mt-6">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{children}</p>
    </div>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const facts = packageFacts();
  const status = paymentsStatus();
  const config = playgroundConfig();

  const requested = (await searchParams).product;
  const initialProductId =
    typeof requested === "string" && Object.hasOwn(products, requested) && requested !== "legacy" ? requested : "pro";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            External application · stripe-library-test
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="font-mono">@ledgerly/payments</span> External Consumer
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            This application consumes @ledgerly/payments@{facts.version} as an external package.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone="indigo">
            <span className="font-mono">
              {facts.name}@{facts.version}
            </span>
          </Pill>
          <Pill tone="amber">Environment: TEST</Pill>
        </div>
      </header>

      <StatusCards facts={facts} status={status} />

      {status.problem && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Stripe operations are unavailable.</strong> The package reported: {status.problem} Everything
          else on this page still works.
        </p>
      )}

      <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
        {[
          ["#architecture", "Architecture"],
          ["#integration", "Integration code"],
          ["#security", "Security"],
          ["#playground", "Customization playground"],
          ["#webhooks", "Webhooks"],
          ["#errors", "Errors"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {label}
          </a>
        ))}
      </nav>

      <div id="architecture" className="scroll-mt-6">
        <BoundaryDiagram facts={facts} />
      </div>
      <div id="integration" className="scroll-mt-6">
        <IntegrationCode />
      </div>

      <SectionHeading id="security" title="Security Boundary">
        The browser chooses a product and a quantity. The server and the package decide everything else.
      </SectionHeading>
      <SecurityBoundary />
      <SecurityLab available={status.checkout} />

      <SectionHeading id="playground" title="Customization playground">
        Every control maps to a real @ledgerly/payments option. The code preview updates as you change them.
      </SectionHeading>
      <Playground
        config={config}
        errorCodes={Object.values(PaymentErrorCodes)}
        initialProductId={initialProductId}
        available={status.checkout}
        serverCode={{
          callbacks: readSource("src/lib/observability.ts", "callbacks"),
          monitoring: readSource("src/lib/observability.ts", "monitoring"),
          logger: readSource("src/lib/observability.ts", "logger"),
          client: readSource("src/lib/payments.ts", "client"),
        }}
      />

      <div id="webhooks" className="scroll-mt-6">
        <WebhookDemo ready={status.webhook} />
      </div>
    </main>
  );
}
