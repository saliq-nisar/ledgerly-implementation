import { createCheckoutHandler } from "@ledgerly/payments/web";
import { getPayments, paymentsUnavailable, type AppPayments } from "@/lib/payments";
import { checkoutHandlerOptions } from "@/lib/playground-server";

const handlers = new WeakMap<AppPayments, (request: Request) => Promise<Response>>();

// The browser body stays { productId, quantity }. Everything else is added
// server-side by enrich, from allowlisted playground choices.
export async function POST(request: Request) {
  const payments = getPayments();
  if (!payments) return paymentsUnavailable();

  let handler = handlers.get(payments);
  if (!handler) {
    handler = createCheckoutHandler(payments, checkoutHandlerOptions);
    handlers.set(payments, handler);
  }
  return handler(request);
}
