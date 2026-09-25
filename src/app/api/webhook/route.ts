import { getPayments, paymentsUnavailable, type AppPayments } from "@/lib/payments";
import { createAppWebhookHandler } from "@/lib/webhooks";

const handlers = new WeakMap<AppPayments, (request: Request) => Promise<Response>>();

export async function POST(request: Request) {
  const payments = getPayments();
  if (!payments) return paymentsUnavailable();

  let handler = handlers.get(payments);
  if (!handler) {
    handler = createAppWebhookHandler(payments);
    handlers.set(payments, handler);
  }
  return handler(request);
}
