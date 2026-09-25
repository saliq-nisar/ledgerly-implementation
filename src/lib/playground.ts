/**
 * Playground choices shared by the browser UI and the server.
 *
 * The browser never sends checkout options, customer data, metadata or
 * redirect URLs. It sends only *choice keys* from the allowlists below (in the
 * `X-Playground-Choices` header). The server validates them strictly
 * (see playground-server.ts) and maps each key to a server-defined value in
 * `enrich`, and the library then validates the result again.
 *
 * Only `import type` from the library is used here, so nothing from
 * @ledgerly/payments reaches the client bundle.
 */
import type {
  CheckoutCustomField,
  CheckoutCustomText,
  CheckoutCustomer,
  CheckoutLocale,
  CheckoutOptions,
  CheckoutRequestOptions,
  CheckoutSubmitType,
  PublicErrorInfo,
  RedirectPaths,
  ShippingCountry,
  TaxBehavior,
} from "@ledgerly/payments";

export const PLAYGROUND_HEADER = "X-Playground-Choices";

export const INHERIT = "inherit";
export type Inherit = typeof INHERIT;
export type Toggle = Inherit | "on" | "off";

export const TOGGLES = [INHERIT, "on", "off"] as const satisfies readonly Toggle[];
export const LOCALES = [INHERIT, "auto", "en", "fr", "de", "es", "ja"] as const satisfies readonly (
  | Inherit
  | CheckoutLocale
)[];
export const SUBMIT_TYPES = [INHERIT, "pay", "book", "donate", "auto"] as const satisfies readonly (
  | Inherit
  | CheckoutSubmitType
)[];
export const CUSTOMER_CREATION = [INHERIT, "always", "if_required"] as const;
export const EXPIRY_MINUTES = [INHERIT, "30", "60", "1440"] as const;

export const SHIPPING_PRESETS = {
  north_america: { label: "US + Canada", countries: ["US", "CA"] },
  europe: { label: "Europe (FR, DE, GB, ES)", countries: ["FR", "DE", "GB", "ES"] },
} as const satisfies Record<string, { label: string; countries: readonly ShippingCountry[] }>;
export const SHIPPING = [INHERIT, "off", "north_america", "europe"] as const;

export const CUSTOM_TEXT_PRESETS = {
  reassurance: {
    label: "Reassurance copy",
    value: {
      submit: "Test mode: no real card is charged.",
      afterSubmit: "Thanks! Your receipt will arrive by email.",
    },
  },
} as const satisfies Record<string, { label: string; value: CheckoutCustomText }>;
export const CUSTOM_TEXT = [INHERIT, "reassurance"] as const;

export const CUSTOM_FIELD_PRESETS = {
  company: {
    label: "Company name (text)",
    value: [{ key: "company", label: "Company name", type: "text", optional: true }],
  },
  referral: {
    label: "Referral source (dropdown)",
    value: [
      {
        key: "referral",
        label: "How did you hear about us?",
        type: "dropdown",
        optional: true,
        options: [
          { label: "Search", value: "search" },
          { label: "A friend", value: "friend" },
          { label: "Conference", value: "conference" },
        ],
      },
    ],
  },
} as const satisfies Record<string, { label: string; value: readonly CheckoutCustomField[] }>;
export const CUSTOM_FIELDS = [INHERIT, "company", "referral"] as const;

/** Test identities. In production `enrich` derives the customer from the signed-in user. */
export const CUSTOMER_PRESETS = {
  guest: { label: "Guest (no customer data)", customer: undefined },
  jenny: { label: "Jenny Rosen", customer: { email: "jenny.rosen@example.com" } },
  sam: { label: "Sam Lee", customer: { email: "sam.lee@example.com" } },
} as const satisfies Record<string, { label: string; customer: CheckoutCustomer | undefined }>;
export const CUSTOMERS = ["guest", "jenny", "sam"] as const;

export const CUSTOMER_TYPES = ["individual", "business"] as const;

export const REDIRECT_PRESETS = {
  default: { label: "Client-wide URLs (urls)", description: "No per-call override.", value: undefined },
  playground: {
    label: "Per-call same-origin paths",
    description: "Relative paths on APP_URL, with extra query parameters.",
    value: {
      success: "/payment/success?from=playground",
      cancel: "/payment/cancelled?from=playground&product={PRODUCT_ID}",
    },
  },
  allowlisted: {
    label: "Allow-listed second origin",
    description: "Absolute URLs on an origin listed in security.allowedRedirectOrigins.",
    value: {
      success: "http://127.0.0.1:3000/payment/success",
      cancel: "http://127.0.0.1:3000/payment/cancelled?product={PRODUCT_ID}",
    },
  },
} as const satisfies Record<string, { label: string; description: string; value: RedirectPaths | undefined }>;
export const REDIRECTS = ["default", "playground", "allowlisted"] as const;

type OneOf<T extends readonly string[]> = T[number];

export interface PlaygroundChoices {
  allowPromotionCodes: Toggle;
  collectBillingAddress: Toggle;
  collectPhoneNumber: Toggle;
  shipping: OneOf<typeof SHIPPING>;
  submitType: OneOf<typeof SUBMIT_TYPES>;
  locale: OneOf<typeof LOCALES>;
  customerCreation: OneOf<typeof CUSTOMER_CREATION>;
  termsOfService: Toggle;
  promotionsConsent: Toggle;
  customText: OneOf<typeof CUSTOM_TEXT>;
  customFields: OneOf<typeof CUSTOM_FIELDS>;
  expiresInMinutes: OneOf<typeof EXPIRY_MINUTES>;
  customer: OneOf<typeof CUSTOMERS>;
  metadataCustomerType: OneOf<typeof CUSTOMER_TYPES> | "omit";
  metadataSource: "include" | "omit";
  redirect: OneOf<typeof REDIRECTS>;
}

/** Allowed values per choice. The server rejects anything else. */
export const CHOICE_VALUES: { readonly [K in keyof PlaygroundChoices]: readonly PlaygroundChoices[K][] } = {
  allowPromotionCodes: TOGGLES,
  collectBillingAddress: TOGGLES,
  collectPhoneNumber: TOGGLES,
  shipping: SHIPPING,
  submitType: SUBMIT_TYPES,
  locale: LOCALES,
  customerCreation: CUSTOMER_CREATION,
  termsOfService: TOGGLES,
  promotionsConsent: TOGGLES,
  customText: CUSTOM_TEXT,
  customFields: CUSTOM_FIELDS,
  expiresInMinutes: EXPIRY_MINUTES,
  customer: CUSTOMERS,
  metadataCustomerType: [...CUSTOMER_TYPES, "omit"],
  metadataSource: ["include", "omit"],
  redirect: REDIRECTS,
};

export const DEFAULT_CHOICES: PlaygroundChoices = {
  allowPromotionCodes: INHERIT,
  collectBillingAddress: INHERIT,
  collectPhoneNumber: INHERIT,
  shipping: INHERIT,
  submitType: INHERIT,
  locale: INHERIT,
  customerCreation: INHERIT,
  termsOfService: INHERIT,
  promotionsConsent: INHERIT,
  customText: INHERIT,
  customFields: INHERIT,
  expiresInMinutes: INHERIT,
  customer: "guest",
  metadataCustomerType: "individual",
  metadataSource: "include",
  redirect: "default",
};

function toggle(value: Toggle): boolean | undefined {
  return value === INHERIT ? undefined : value === "on";
}

/**
 * Maps validated choices to per-call library options. Used by the server in
 * `enrich` and by the UI for the preview, so both always agree.
 */
export function buildRequestOptions(choices: PlaygroundChoices): CheckoutRequestOptions {
  const consent = {
    termsOfService: toggle(choices.termsOfService),
    promotions: toggle(choices.promotionsConsent),
  };
  const options: {
    -readonly [K in keyof CheckoutRequestOptions]: CheckoutRequestOptions[K];
  } = {
    allowPromotionCodes: toggle(choices.allowPromotionCodes),
    collectBillingAddress: toggle(choices.collectBillingAddress),
    collectPhoneNumber: toggle(choices.collectPhoneNumber),
    collectShippingAddress:
      choices.shipping === INHERIT
        ? undefined
        : choices.shipping === "off"
          ? false
          : { allowedCountries: SHIPPING_PRESETS[choices.shipping].countries },
    submitType: choices.submitType === INHERIT ? undefined : choices.submitType,
    locale: choices.locale === INHERIT ? undefined : choices.locale,
    customerCreation: choices.customerCreation === INHERIT ? undefined : choices.customerCreation,
    consentCollection:
      consent.termsOfService === undefined && consent.promotions === undefined
        ? undefined
        : stripUndefined(consent),
    customText:
      choices.customText === INHERIT ? undefined : CUSTOM_TEXT_PRESETS[choices.customText].value,
    customFields:
      choices.customFields === INHERIT ? undefined : CUSTOM_FIELD_PRESETS[choices.customFields].value,
    expiresInMinutes:
      choices.expiresInMinutes === INHERIT ? undefined : Number(choices.expiresInMinutes),
  };
  return stripUndefined(options);
}

export function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

/* ---------- Data the server hands to the UI (all non-secret) ---------- */

export interface ProductSnapshot {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  minQuantity: number;
  maxQuantity: number;
  active: boolean;
  images: readonly string[];
  taxBehavior: TaxBehavior | null;
  taxCode: string | null;
  stripePriceId: string | null;
  metadata: Readonly<Record<string, string>>;
  checkout: CheckoutOptions;
}

export interface PlaygroundConfig {
  version: string;
  environment: string;
  appUrl: string | null;
  clientCheckout: CheckoutOptions;
  quantity: { min: number; max: number };
  products: ProductSnapshot[];
  metadataPolicy: { allowedKeys: readonly string[]; maxKeys: number; maxValueLength: number };
  urls: Required<RedirectPaths>;
  allowedRedirectOrigins: readonly string[];
  publicMessages: Readonly<Record<string, string>>;
  logLevel: string;
  storage: string;
  webhookToleranceSeconds: number;
  network: { maxRetries: number; timeoutMs: number };
  businessSeatsLeft: number;
}

/* ---------- Activity feed (safe fields only) ---------- */

export type ActivityKind = "callback" | "monitoring" | "log" | "webhook";

export interface ActivityEntry {
  id: number;
  at: string;
  kind: ActivityKind;
  name: string;
  summary: string;
  fields: Readonly<Record<string, string | number | boolean | null>>;
}

/* ---------- Error samples ---------- */

export interface ErrorSample {
  label: string;
  call: string;
  errorClass: string | null;
  info: PublicErrorInfo;
}
