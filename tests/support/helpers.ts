import { createHmac, randomUUID } from "node:crypto";
import { PLAYGROUND_HEADER, DEFAULT_CHOICES, type PlaygroundChoices } from "@/lib/playground";

/**
 * Offline credentials: well-formed test-mode values that pass the package's
 * format checks. Validation happens before any Stripe call, so validation
 * tests never reach the network. They are not real keys.
 */
export const OFFLINE_ENV = {
  STRIPE_SECRET_KEY: `sk_test_${"OfflineKey0".repeat(3)}`,
  STRIPE_WEBHOOK_SECRET: `whsec_${"OfflineSecret0".repeat(3)}`,
  APP_URL: "http://localhost:3000",
} as const;

export const APP_ORIGIN = "http://localhost:3000";

export function checkoutRequest(
  body: unknown,
  { origin = APP_ORIGIN, choices }: { origin?: string; choices?: Partial<PlaygroundChoices> } = {},
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json", Origin: origin };
  if (choices) headers[PLAYGROUND_HEADER] = JSON.stringify({ ...DEFAULT_CHOICES, ...choices });
  return new Request(`${APP_ORIGIN}/api/checkout`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/**
 * Test fixture: signs a payload the way Stripe documents its webhook
 * signatures (HMAC-SHA256 over "timestamp.payload"), so the package's real
 * verifier can be exercised. The consumer app itself never verifies anything.
 */
export function stripeSignature(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

export function checkoutCompletedEvent({ eventId = `evt_test_${randomUUID().replaceAll("-", "")}` } = {}) {
  const sessionId = `cs_test_${randomUUID().replaceAll("-", "")}`;
  return JSON.stringify({
    id: eventId,
    object: "event",
    api_version: "2025-01-27.acacia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        status: "complete",
        payment_status: "paid",
        amount_total: 1999,
        amount_subtotal: 1999,
        currency: "usd",
        customer_email: null,
        customer_details: { email: "jenny.rosen@example.com" },
        client_reference_id: "playground_pro_order_test",
        payment_intent: `pi_test_${randomUUID().replaceAll("-", "").slice(0, 24)}`,
        metadata: { productId: "pro", quantity: "1", orderId: "order_test" },
        livemode: false,
        created: Math.floor(Date.now() / 1000),
      },
    },
  });
}

export function webhookRequest(payload: string, signature: string | null): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signature !== null) headers["Stripe-Signature"] = signature;
  return new Request(`${APP_ORIGIN}/api/webhook`, { method: "POST", headers, body: payload });
}

export async function errorCode(promise: Promise<unknown> | (() => unknown)): Promise<string | null> {
  try {
    await (typeof promise === "function" ? promise() : promise);
    return null;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "non-payment-error";
  }
}
