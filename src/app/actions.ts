"use server";

import { isPaymentError } from "@ledgerly/payments";
import { getPayments, type AppPayments } from "@/lib/payments";
import type { ErrorSample } from "@/lib/playground";

type Sample = { label: string; call: string; run: (payments: AppPayments) => unknown };

/**
 * Real library calls that are rejected by validation before any Stripe
 * request (or, for beforeCheckout, by the app's callback). Each error is
 * normalised with payments.errors.describe().
 */
const SAMPLES: Sample[] = [
  {
    label: "Price tampering in a request body",
    call: `payments.checkout.parse({ productId: "pro", quantity: 1, amount: 1 })`,
    run: (payments) => payments.checkout.parse({ productId: "pro", quantity: 1, amount: 1 }),
  },
  {
    label: "Unknown product",
    call: `payments.checkout.parse({ productId: "enterprise" })`,
    run: (payments) => payments.checkout.parse({ productId: "enterprise" }),
  },
  {
    label: "Inactive product (custom publicMessage)",
    call: `payments.checkout.parse({ productId: "legacy" })`,
    run: (payments) => payments.checkout.parse({ productId: "legacy" }),
  },
  {
    label: "Quantity above the product limit (custom publicMessage)",
    call: `payments.checkout.parse({ productId: "starter", quantity: 6 })`,
    run: (payments) => payments.checkout.parse({ productId: "starter", quantity: 6 }),
  },
  {
    label: "Session lifetime out of range",
    call: `payments.checkout.create({ productId: "starter", options: { expiresInMinutes: 5 } })`,
    run: (payments) => payments.checkout.create({ productId: "starter", options: { expiresInMinutes: 5 } }),
  },
  {
    label: "Redirect to an origin that isn't allow-listed",
    call: `payments.checkout.create({ productId: "starter", redirect: { success: "https://evil.example/steal" } })`,
    run: (payments) =>
      payments.checkout.create({ productId: "starter", redirect: { success: "https://evil.example/steal" } }),
  },
  {
    label: "Card number in metadata",
    call: `payments.checkout.create({ productId: "starter", metadata: { orderId: "4242 4242 4242 4242" } })`,
    run: (payments) => payments.checkout.create({ productId: "starter", metadata: { orderId: "4242 4242 4242 4242" } }),
  },
  {
    label: "Metadata value over maxValueLength (64)",
    call: `payments.checkout.create({ productId: "starter", metadata: { source: "x".repeat(65) } })`,
    run: (payments) => payments.checkout.create({ productId: "starter", metadata: { source: "x".repeat(65) } }),
  },
  {
    label: "Metadata key not in allowedKeys",
    call: `payments.checkout.create({ productId: "starter", metadata: { campaign: "spring" } })`,
    // Typed as a plain record to reach the runtime check; a literal is a compile error.
    run: (payments) => {
      const metadata: Record<string, string> = { campaign: "spring" };
      return payments.checkout.create({ productId: "starter", metadata });
    },
  },
  {
    label: "Both customer email and id",
    call: `payments.checkout.create({ productId: "starter", customer: { email: "a@example.com", id: "cus_123" } })`,
    run: (payments) =>
      payments.checkout.create({ productId: "starter", customer: { email: "a@example.com", id: "cus_123" } }),
  },
  {
    label: "Refused by beforeCheckout (rejectCheckout)",
    call: `payments.checkout.create({ productId: "business", quantity: 5 })`,
    run: (payments) => payments.checkout.create({ productId: "business", quantity: 5 }),
  },
  {
    label: "Malformed session ID",
    call: `payments.checkout.retrieve("not-a-session")`,
    run: (payments) => payments.checkout.retrieve("not-a-session"),
  },
  {
    label: "A non-library error that contains a secret",
    call: `payments.errors.describe(new Error("db password=hunter2 exploded"))`,
    run: () => {
      throw new Error("db password=hunter2 exploded");
    },
  },
];

export type ErrorSamplesResult =
  | { ok: true; samples: ErrorSample[] }
  | { ok: false; message: string };

export async function runErrorSamples(): Promise<ErrorSamplesResult> {
  const payments = getPayments();
  if (!payments) {
    return { ok: false, message: "Unavailable: the library can't create a client without Stripe credentials." };
  }

  const samples: ErrorSample[] = [];
  for (const sample of SAMPLES) {
    let error: unknown = undefined;
    try {
      await sample.run(payments);
    } catch (caught) {
      error = caught;
    }
    if (error === undefined) {
      throw new Error(`Sample "${sample.label}" unexpectedly succeeded.`);
    }
    samples.push({
      label: sample.label,
      call: sample.call,
      errorClass: isPaymentError(error) ? error.name : null,
      info: payments.errors.describe(error),
    });
  }
  return { ok: true, samples };
}
