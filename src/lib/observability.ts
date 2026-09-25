import "server-only";

import {
  rejectCheckout,
  type LogFields,
  type PaymentCallbacks,
  type PaymentHooks,
  type PaymentLogger,
} from "@ledgerly/payments";
import { recordActivity } from "@/lib/activity";
import type { AppProductId } from "@/lib/catalog";

/** Business seats left today; enforced by the beforeCheckout callback. */
export const BUSINESS_SEATS_LEFT = 3;

// #region callbacks
// Application callbacks: awaited by the library and able to change the flow.
export const callbacks: PaymentCallbacks<AppProductId> = {
  beforeCheckout({ product, quantity, amountTotal, currency, requestId }) {
    recordActivity("callback", "beforeCheckout", `Validated ${quantity} × ${product.name}`, {
      requestId,
      productId: product.id,
      quantity,
      amountTotal,
      currency,
    });
    if (product.id === "business" && quantity > BUSINESS_SEATS_LEFT) {
      throw rejectCheckout(`Only ${BUSINESS_SEATS_LEFT} Business seats are left today.`, { statusCode: 409 });
    }
  },
  afterCheckout({ session, product, requestId }) {
    recordActivity("callback", "afterCheckout", `Session created for ${product.name}`, {
      requestId,
      sessionId: session.id,
    });
  },
  onPaymentSucceeded(payment, { requestId }) {
    // Fulfil the order here. Must be idempotent: Stripe can deliver an event more than once.
    console.log(`onPaymentSucceeded: ${payment.eventId} (session ${payment.checkoutSessionId})`);
    recordActivity("callback", "onPaymentSucceeded", `Paid: ${payment.product?.name ?? "unknown product"}`, {
      requestId,
      eventId: payment.eventId,
      sessionId: payment.checkoutSessionId,
      amountTotal: payment.amountTotal,
      currency: payment.currency,
      quantity: payment.quantity,
    });
  },
  onPaymentFailed(payment, { requestId }) {
    recordActivity("callback", "onPaymentFailed", "Delayed payment method failed", {
      requestId,
      eventId: payment.eventId,
      sessionId: payment.checkoutSessionId,
    });
  },
  onPaymentAttemptFailed(attempt, { requestId }) {
    recordActivity("callback", "onPaymentAttemptFailed", "A payment attempt was declined", {
      requestId,
      eventId: attempt.eventId,
      declineCode: attempt.declineCode,
      errorCode: attempt.errorCode,
    });
  },
  onCheckoutExpired(session, { requestId }) {
    recordActivity("callback", "onCheckoutExpired", "Session expired unpaid", {
      requestId,
      eventId: session.eventId,
      sessionId: session.checkoutSessionId,
    });
  },
};
// #endregion callbacks

// #region monitoring
// Monitoring hooks: fire-and-forget, safe fields only, can't break a payment.
export const monitoring: PaymentHooks = {
  onRequest(info) {
    recordActivity("monitoring", "onRequest", `${info.operation} → ${info.outcome}`, {
      requestId: info.requestId,
      operation: info.operation,
      durationMs: info.durationMs,
      errorCode: info.errorCode ?? null,
    });
  },
  onError(error, info) {
    recordActivity("monitoring", "onError", `${info.operation} failed: ${error.code}`, {
      requestId: info.requestId,
      code: error.code,
      statusCode: error.statusCode,
      retryable: error.retryable,
      // Name of the rejected Stripe parameter (never its value), if any.
      param: error.cause?.param ?? null,
      stripeRequestId: error.stripeRequestId ?? null,
    });
  },
  onCheckoutCreated(info) {
    recordActivity("monitoring", "onCheckoutCreated", "Checkout Session created", {
      requestId: info.requestId,
      sessionId: info.sessionId,
      productId: info.productId,
      quantity: info.quantity,
      amountTotal: info.amountTotal,
      currency: info.currency,
    });
  },
  onWebhookReceived(info) {
    recordActivity("monitoring", "onWebhookReceived", `Verified ${info.eventType}`, {
      requestId: info.requestId,
      eventId: info.eventId,
      eventType: info.eventType,
    });
  },
  onWebhookProcessed(info) {
    recordActivity("monitoring", "onWebhookProcessed", `${info.eventType} → ${info.outcome}`, {
      requestId: info.requestId,
      eventId: info.eventId,
      eventType: info.eventType,
      outcome: info.outcome,
      durationMs: info.durationMs,
    });
  },
};
// #endregion monitoring

// #region logger
// Any logger works. The library redacts every field before calling it.
const LOGGED_FIELDS = ["operation", "outcome", "errorCode", "eventType", "durationMs", "requestId"];

function forward(level: "debug" | "info" | "warn" | "error", message: string, fields: LogFields) {
  console[level](JSON.stringify({ level, message, ...fields }));
  const safe = Object.fromEntries(
    LOGGED_FIELDS.flatMap((key) => (fields[key] === undefined ? [] : [[key, fields[key]]])),
  );
  recordActivity("log", `logger.${level}`, message, safe);
}

export const logger: PaymentLogger = {
  debug: (message, fields) => forward("debug", message, fields),
  info: (message, fields) => forward("info", message, fields),
  warn: (message, fields) => forward("warn", message, fields),
  error: (message, fields) => forward("error", message, fields),
};
// #endregion logger
