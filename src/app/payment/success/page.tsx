import Link from "next/link";
import { isPaymentError, type CheckoutSummary } from "@ledgerly/payments";
import { Card } from "@/components/card";
import { KeyValue, Pill, type PillTone } from "@/components/ui";
import { formatAmount } from "@/lib/format";
import { getPayments, type AppProductId } from "@/lib/payments";

const STATUS = {
  paid: { heading: "Payment Successful", tone: "green" },
  processing: { heading: "Payment Processing", tone: "amber" },
  unpaid: { heading: "Payment Not Completed", tone: "amber" },
  expired: { heading: "Checkout Expired", tone: "red" },
} as const satisfies Record<CheckoutSummary["status"], { heading: string; tone: PillTone }>;

async function loadSummary(sessionId: unknown): Promise<CheckoutSummary<AppProductId> | null> {
  const payments = getPayments();
  if (!payments || typeof sessionId !== "string") return null;
  try {
    return await payments.checkout.retrieve(sessionId);
  } catch (error) {
    if (isPaymentError(error)) return null;
    throw error;
  }
}

export default async function SuccessPage({ searchParams }: PageProps<"/payment/success">) {
  // Everything shown here is fetched from Stripe through the library.
  // Query parameters other than session_id are ignored.
  const summary = await loadSummary((await searchParams).session_id);

  return (
    <Card>
      {summary ? (
        <>
          <Pill tone={STATUS[summary.status].tone}>verified with Stripe</Pill>
          <h1 className="mt-3 text-2xl font-semibold">{STATUS[summary.status].heading}</h1>
          <p className="mt-1 text-3xl font-bold">{formatAmount(summary.amountTotal, summary.currency)}</p>
          <div className="mt-4">
            <KeyValue
              rows={[
                ["Product", summary.product?.name ?? "Unknown product"],
                ["Quantity", String(summary.quantity)],
                ["Amount", formatAmount(summary.amountTotal, summary.currency)],
                ["Currency", summary.currency.toUpperCase()],
                ["Payment status", summary.status],
                ["Session ID", <span key="s" className="break-all font-mono text-xs">{summary.id}</span>],
                ["Customer email", summary.customerEmail ?? "—"],
                ["Metadata", <span key="m" className="font-mono text-xs">{Object.entries(summary.metadata).map(([k, v]) => `${k}=${v}`).join(", ") || "—"}</span>],
              ]}
            />
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Fulfilment is driven by the verified checkout.session.completed webhook (onPaymentSucceeded), not by
            this page.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Payment status unavailable</h1>
          <p className="mt-4 text-sm text-zinc-500">This checkout session could not be verified.</p>
        </>
      )}
      <Link href="/" className="mt-8 inline-block text-sm font-medium text-indigo-600 hover:underline">
        Back to the playground
      </Link>
    </Card>
  );
}
