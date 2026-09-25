import "server-only";

import {
  createMemoryEventStore,
  createPaymentClient,
  isPaymentError,
  type CheckoutOptions,
  type LogLevel,
  type ProductDefinition,
} from "@ledgerly/payments";
import libraryPackage from "@ledgerly/payments/package.json";
import { products } from "@/lib/catalog";
import { BUSINESS_SEATS_LEFT, callbacks, logger, monitoring } from "@/lib/observability";
import type { PlaygroundConfig } from "@/lib/playground";

export type { AppProductId, Catalog } from "@/lib/catalog";

const clientCheckout = {
  mode: "payment",
  allowPromotionCodes: false,
  collectBillingAddress: false,
  submitType: "pay",
  locale: "auto",
  automaticTax: false,
  customerCreation: "if_required",
  expiresInMinutes: 60,
} as const satisfies CheckoutOptions;
const quantity = { min: 1, max: 10 };
const metadataPolicy = {
  allowedKeys: ["orderId", "customerType", "source"],
  maxKeys: 10,
  maxValueLength: 64,
} as const;
const urls = { success: "/payment/success", cancel: "/payment/cancelled?product={PRODUCT_ID}" };
const allowedRedirectOrigins = ["http://127.0.0.1:3000"];
const publicMessages = {
  product_unavailable: "This plan has been retired and can no longer be purchased.",
  invalid_quantity: "Choose a quantity this plan allows.",
  provider_error: "Stripe rejected this checkout. Some options need account setup (see the timeline).",
};
const logLevel: LogLevel = "info";
const network = { maxRetries: 2, timeoutMs: 20_000 };
const webhookToleranceSeconds = 300;

type Env = Readonly<Record<string, string | undefined>>;

// #region client
// STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and APP_URL are read from the
// environment by the library. They are never written in application code.
export function createAppPayments(env: Env = process.env) {
  return createPaymentClient({
    environment: "test",
    env,
    products,
    urls,
    checkout: { ...clientCheckout, quantity },
    metadata: metadataPolicy,
    security: { allowedRedirectOrigins },
    storage: createMemoryEventStore(), // development only: lost on restart
    webhooks: { toleranceSeconds: webhookToleranceSeconds },
    network,
    logging: { logger, level: logLevel },
    errors: { publicMessages },
    callbacks,
    monitoring,
  });
}
// #endregion client

export type AppPayments = ReturnType<typeof createAppPayments>;
export type MetadataKey = (typeof metadataPolicy.allowedKeys)[number];

/* ---------------------------------------------------------------------------
 * Lazy creation. The library validates configuration when the client is
 * created and throws if STRIPE_SECRET_KEY is missing, so the app creates it on
 * first use and keeps working (docs, playground, diagrams) without credentials.
 * ------------------------------------------------------------------------- */

type ClientState = { payments: AppPayments; problem: null } | { payments: null; problem: string };
let state: ClientState | undefined;

function clientState(): ClientState {
  if (!state) {
    try {
      state = { payments: createAppPayments(), problem: null };
    } catch (error) {
      // PaymentConfigurationError messages name the setting, never its value.
      if (!isPaymentError(error)) throw error;
      state = { payments: null, problem: error.message };
    }
  }
  return state;
}

/** The configured client, or null when Stripe credentials are missing or invalid. */
export function getPayments(): AppPayments | null {
  return clientState().payments;
}

export interface PaymentsStatus {
  checkout: boolean;
  webhook: boolean;
  problem: string | null;
}

export function paymentsStatus(): PaymentsStatus {
  const { payments, problem } = clientState();
  return {
    checkout: payments !== null,
    // The library disables webhooks (and throws on use) without a signing secret.
    webhook: payments !== null && Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    problem,
  };
}

/** JSON error for API routes when no client could be created. */
export function paymentsUnavailable(): Response {
  return Response.json(
    {
      error: {
        code: "payments_unavailable",
        message: "Real Stripe operations are unavailable because Stripe credentials are not configured.",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

/** Non-secret view of the application's configuration, for the UI. Works without credentials. */
export function playgroundConfig(): PlaygroundConfig {
  return {
    version: libraryPackage.version,
    environment: "test",
    appUrl: getPayments()?.appUrl ?? process.env.APP_URL ?? null,
    clientCheckout,
    quantity,
    products: Object.entries(products).map(([id, entry]) => {
      const product: ProductDefinition = entry;
      return {
        id,
        name: product.name,
        description: product.description ?? null,
        price: product.price,
        currency: product.currency.toLowerCase(),
        minQuantity: product.minQuantity ?? quantity.min,
        maxQuantity: product.maxQuantity ?? quantity.max,
        active: product.active ?? true,
        images: product.images ?? [],
        taxBehavior: product.taxBehavior ?? null,
        taxCode: product.taxCode ?? null,
        stripePriceId: product.stripePriceId ?? null,
        metadata: product.metadata ?? {},
        checkout: product.checkout ?? {},
      };
    }),
    metadataPolicy,
    urls,
    allowedRedirectOrigins,
    publicMessages,
    logLevel,
    storage: "createMemoryEventStore()",
    webhookToleranceSeconds,
    network,
    businessSeatsLeft: BUSINESS_SEATS_LEFT,
  };
}
