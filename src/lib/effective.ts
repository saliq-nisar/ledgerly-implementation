/**
 * Display helpers for the playground. The library performs the real merge of
 * client → product → per-call options internally and exposes no API for the
 * resolved result, so this reproduces its documented rule (option by option;
 * customText and consentCollection merge key by key) for the preview only.
 */
import type { CheckoutOptions } from "@ledgerly/payments";

export type OptionKey = keyof CheckoutOptions;
export type Level = "global" | "product" | "request";

export interface OptionMeta {
  key: OptionKey;
  label: string;
  stripe: string;
  perCall: boolean;
  note?: string;
}

export const OPTION_META: readonly OptionMeta[] = [
  { key: "allowPromotionCodes", label: "Promotion codes", stripe: "allow_promotion_codes", perCall: true },
  {
    key: "collectBillingAddress",
    label: "Billing address",
    stripe: "billing_address_collection",
    perCall: true,
    note: "true = required, false = only when needed",
  },
  {
    key: "collectShippingAddress",
    label: "Shipping address",
    stripe: "shipping_address_collection",
    perCall: true,
  },
  { key: "collectPhoneNumber", label: "Phone number", stripe: "phone_number_collection", perCall: true },
  { key: "submitType", label: "Submit button", stripe: "submit_type", perCall: true },
  { key: "locale", label: "Locale", stripe: "locale", perCall: true },
  { key: "customerCreation", label: "Customer creation", stripe: "customer_creation", perCall: true },
  {
    key: "consentCollection",
    label: "Consent collection",
    stripe: "consent_collection",
    perCall: true,
    note: "Terms of service needs a ToS URL in the Dashboard; promotions only in some countries",
  },
  { key: "customText", label: "Custom text", stripe: "custom_text", perCall: true },
  { key: "customFields", label: "Custom fields", stripe: "custom_fields", perCall: true, note: "Up to 3" },
  { key: "expiresInMinutes", label: "Session expiry (min)", stripe: "expires_at", perCall: true, note: "30–1440" },
  {
    key: "automaticTax",
    label: "Automatic tax",
    stripe: "automatic_tax",
    perCall: false,
    note: "Needs Stripe Tax on the account",
  },
  { key: "createInvoice", label: "Invoice creation", stripe: "invoice_creation", perCall: false },
  { key: "mode", label: "Mode", stripe: "mode", perCall: false, note: '"payment" only today' },
];

const KEY_MERGED = new Set<OptionKey>(["customText", "consentCollection"]);

export interface ResolvedOption extends OptionMeta {
  values: Partial<Record<Level, unknown>>;
  effective: unknown;
  source: Level | "stripe default";
}

export function resolveOptions(
  global: CheckoutOptions,
  product: CheckoutOptions,
  request: CheckoutOptions,
): ResolvedOption[] {
  const levels: [Level, CheckoutOptions][] = [
    ["global", global],
    ["product", product],
    ["request", request],
  ];
  return OPTION_META.map((meta) => {
    const values: Partial<Record<Level, unknown>> = {};
    let effective: unknown = undefined;
    let source: ResolvedOption["source"] = "stripe default";
    for (const [level, options] of levels) {
      const value: unknown = options[meta.key];
      if (value === undefined) continue;
      values[level] = value;
      source = level;
      effective =
        KEY_MERGED.has(meta.key) && isRecord(effective) && isRecord(value)
          ? { ...effective, ...value }
          : value;
    }
    return { ...meta, values, effective, source };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Short one-line rendering of an option value. */
export function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === "string")
      ? `[${value.map((item) => `"${item}"`).join(", ")}]`
      : `${value.length} field${value.length === 1 ? "" : "s"}`;
  }
  if (isRecord(value)) {
    return `{ ${Object.entries(value)
      .map(([key, entry]) => `${key}: ${formatValue(entry)}`)
      .join(", ")} }`;
  }
  return String(value);
}

/** Pretty-prints a value as a TypeScript object literal for the code preview. */
export function toTs(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent + 1);
  const end = "  ".repeat(indent);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return `[${value.map((item) => toTs(item)).join(", ")}]`;
    }
    return `[\n${value.map((item) => `${pad}${toTs(item, indent + 1)},`).join("\n")}\n${end}]`;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
    if (entries.length === 0) return "{}";
    return `{\n${entries
      .map(([key, entry]) => `${pad}${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${toTs(entry, indent + 1)},`)
      .join("\n")}\n${end}}`;
  }
  return String(value);
}
