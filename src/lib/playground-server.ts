import "server-only";

import { randomUUID } from "node:crypto";
import { rejectCheckout, type CheckoutRequest } from "@ledgerly/payments";
import type { CheckoutEnrichment, CheckoutHandlerOptions, RateLimitResult } from "@ledgerly/payments/web";
import type { AppProductId, Catalog, MetadataKey } from "@/lib/payments";
import {
  CHOICE_VALUES,
  CUSTOMER_PRESETS,
  DEFAULT_CHOICES,
  PLAYGROUND_HEADER,
  REDIRECT_PRESETS,
  buildRequestOptions,
  stripUndefined,
  type PlaygroundChoices,
} from "@/lib/playground";

const MAX_HEADER_LENGTH = 1024;

function isChoiceKey(key: string): key is keyof PlaygroundChoices {
  return Object.hasOwn(CHOICE_VALUES, key);
}

/**
 * Strictly validates the playground header: a JSON object whose keys and
 * values all come from the allowlists. A partial object is rejected, so
 * nothing is defaulted from partially-trusted input. Without the header
 * (a plain { productId, quantity } request) the defaults apply.
 */
export function parsePlaygroundChoices(raw: string | null): PlaygroundChoices {
  const invalid = () => rejectCheckout("Invalid playground selection.", { statusCode: 400 });
  if (raw === null) return DEFAULT_CHOICES;
  if (raw.length > MAX_HEADER_LENGTH) throw invalid();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw invalid();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw invalid();

  const entries = Object.entries(parsed);
  if (entries.length !== Object.keys(CHOICE_VALUES).length) throw invalid();

  const choices: Partial<Record<keyof PlaygroundChoices, string>> = {};
  for (const [key, value] of entries) {
    if (!isChoiceKey(key) || typeof value !== "string") throw invalid();
    const allowed: readonly string[] = CHOICE_VALUES[key];
    if (!allowed.includes(value)) throw invalid();
    choices[key] = value;
  }
  // Every key is present and every value is from its allowlist.
  return choices as PlaygroundChoices;
}

/**
 * `enrich` for createCheckoutHandler. Everything returned here is either a
 * server constant selected by an allowlisted key, or generated on the server.
 * Nothing is copied from the request. The library validates it all again.
 */
export function enrichCheckout(
  request: Request,
  { productId }: CheckoutRequest<AppProductId>,
): CheckoutEnrichment<Catalog, MetadataKey> {
  const choices = parsePlaygroundChoices(request.headers.get(PLAYGROUND_HEADER));
  const orderId = `order_${randomUUID().slice(0, 8)}`;

  return stripUndefined({
    options: buildRequestOptions(choices),
    customer: CUSTOMER_PRESETS[choices.customer].customer,
    clientReferenceId: `playground_${productId}_${orderId}`,
    metadata: stripUndefined({
      orderId,
      customerType: choices.metadataCustomerType === "omit" ? undefined : choices.metadataCustomerType,
      source: choices.metadataSource === "include" ? "playground" : undefined,
    }),
    redirect: REDIRECT_PRESETS[choices.redirect].value,
  });
}

/* Demo rate limiter: in-memory, single process. Use your platform's in production. */
const WINDOW_MS = 60_000;
const LIMIT = 30;
const store = globalThis as typeof globalThis & { __ledgerlyRate?: Map<string, number[]> };
const hits = (store.__ledgerlyRate ??= new Map<string, number[]>());

export function demoRateLimit(request: Request): RateLimitResult {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= LIMIT) {
    return { allowed: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { allowed: true };
}

// #region checkout-options
export const checkoutHandlerOptions: CheckoutHandlerOptions<Catalog, MetadataKey> = {
  enrich: enrichCheckout, // server-derived customer, metadata, options, redirect
  rateLimit: demoRateLimit, // bring your own limiter in production
  messages: { rate_limited: "Too many checkout attempts. Try again in a minute." },
};
// #endregion checkout-options
