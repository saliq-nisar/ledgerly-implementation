import "server-only";

import { createWebhookHandler } from "@ledgerly/payments/web";
import { recordActivity } from "@/lib/activity";
import type { AppPayments } from "@/lib/payments";

// #region webhook
// Verification, parsing, deduplication and callbacks all happen in the library.
// This adds one raw event handler, which runs before onPaymentSucceeded.
export function createAppWebhookHandler(payments: AppPayments) {
  payments.webhooks.on("checkout.session.completed", async (event) => {
    const session = event.data.object; // fully typed Stripe.Checkout.Session
    console.log(`Checkout completed: ${event.id} (session ${session.id}, ${session.payment_status})`);
    recordActivity("webhook", "webhooks.on", "checkout.session.completed handler ran", {
      eventId: event.id,
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
  });

  return createWebhookHandler(payments);
}
// #endregion webhook
