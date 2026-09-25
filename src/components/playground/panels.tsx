"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { formatAmount } from "@/lib/format";
import { formatValue, type OptionKey, type ResolvedOption } from "@/lib/effective";
import {
  CUSTOM_FIELD_PRESETS,
  CUSTOM_FIELDS,
  CUSTOM_TEXT,
  CUSTOM_TEXT_PRESETS,
  CUSTOMER_CREATION,
  CUSTOMER_PRESETS,
  CUSTOMER_TYPES,
  CUSTOMERS,
  EXPIRY_MINUTES,
  INHERIT,
  LOCALES,
  REDIRECT_PRESETS,
  REDIRECTS,
  SHIPPING,
  SHIPPING_PRESETS,
  SUBMIT_TYPES,
  TOGGLES,
  type PlaygroundChoices,
  type PlaygroundConfig,
  type ProductSnapshot,
} from "@/lib/playground";
import { Code, KeyValue, Pill, Segmented } from "../ui";

type Update = <K extends keyof PlaygroundChoices>(key: K, value: PlaygroundChoices[K]) => void;

function SubHeading({ children, tone }: { children: ReactNode; tone?: "configurable" | "policy" }) {
  return (
    <div className="mb-3 mt-6 flex items-center gap-2 first:mt-0">
      <h3 className="text-sm font-semibold">{children}</h3>
      {tone === "configurable" && <Pill tone="green">CONFIGURABLE</Pill>}
      {tone === "policy" && <Pill tone="amber">🔒 POLICY CONTROLLED</Pill>}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ Products */

export function ProductsPanel({
  config,
  product,
  quantity,
  onSelect,
  onQuantity,
}: {
  config: PlaygroundConfig;
  product: ProductSnapshot;
  quantity: number;
  onSelect: (id: string) => void;
  onQuantity: (quantity: number) => void;
}) {
  const checkoutEntries = Object.entries(product.checkout);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {config.products.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-pressed={item.id === product.id}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
              item.id === product.id
                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/30 dark:bg-indigo-950/40"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
            } ${item.active ? "" : "opacity-70"}`}
          >
            <span className="text-sm font-semibold">{item.name}</span>
            <span className="text-lg font-bold">{formatAmount(item.price, item.currency)}</span>
            <span className="flex flex-wrap gap-1">
              {!item.active && <Pill tone="red">inactive</Pill>}
              {item.stripePriceId && <Pill tone="indigo">stripePriceId</Pill>}
              {Object.keys(item.checkout).length > 0 && <Pill tone="green">checkout</Pill>}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt={`${product.name} product image`}
              width={144}
              height={144}
              className="aspect-square w-full rounded-xl border border-zinc-200 object-cover dark:border-zinc-800"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-500 dark:border-zinc-700">
              no images
            </div>
          )}
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Quantity ({product.minQuantity}–{product.maxQuantity})
            <input
              type="number"
              min={product.minQuantity}
              max={product.maxQuantity}
              step={1}
              value={quantity}
              onChange={(event) => {
                const next = Math.trunc(Number(event.target.value));
                if (Number.isFinite(next)) {
                  onQuantity(Math.min(Math.max(next, product.minQuantity), product.maxQuantity));
                }
              }}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
            />
          </label>
        </div>

        <div className="min-w-0">
          <KeyValue
            rows={[
              ["Product ID", <Code key="id">{product.id}</Code>],
              ["Name", product.name],
              ["Price", `${product.price} (minor units) = ${formatAmount(product.price, product.currency)}`],
              ["Currency", product.currency.toUpperCase()],
              ["Active", product.active ? <Pill tone="green" key="a">true</Pill> : <Pill tone="red" key="a">false</Pill>],
              ["Quantity limits", `${product.minQuantity}–${product.maxQuantity}`],
              ["Tax behavior", product.taxBehavior ?? "—"],
              ["Tax code", product.taxCode ? <Code key="t">{product.taxCode}</Code> : "—"],
              ["stripePriceId", product.stripePriceId ? <Code key="p">{product.stripePriceId}</Code> : "— (inline price_data)"],
              ["Images", product.images.length ? `${product.images.length} https URL` : "—"],
              [
                "Metadata",
                Object.keys(product.metadata).length ? (
                  <span key="m" className="font-mono text-xs">{formatValue(product.metadata)}</span>
                ) : (
                  "—"
                ),
              ],
              [
                "Checkout options",
                checkoutEntries.length ? (
                  <span key="c" className="flex flex-col items-end gap-0.5 font-mono text-xs">
                    {checkoutEntries.map(([key, value]) => (
                      <span key={key}>
                        {key}: {formatValue(value)}
                      </span>
                    ))}
                  </span>
                ) : (
                  "— (inherits global)"
                ),
              ],
            ]}
          />
          {product.description && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{product.description}</p>
          )}
        </div>
      </div>

      <Note>
        This catalog lives in <Code>src/lib/payments.ts</Code> on the server. The browser only picks a{" "}
        <Code>productId</Code> and <Code>quantity</Code>. The library charges{" "}
        <strong>catalog price × validated quantity</strong> in the catalog currency.
        {product.id === "business" && ` beforeCheckout refuses more than ${config.businessSeatsLeft} Business seats.`}
        {!product.active && " This product is inactive, so checkout returns product_unavailable."}
        {product.stripePriceId &&
          " This product charges through an existing Stripe Price. Before its first checkout the library checks that the Price is active, one-time and exactly equal to the catalog price and currency."}
      </Note>
    </div>
  );
}

/* ---------------------------------------------------------- Checkout options */

const toggleLabel = (value: string) => (value === INHERIT ? "inherit" : value);

function OptionRow({
  row,
  children,
}: {
  row: ResolvedOption | undefined;
  children: ReactNode;
}) {
  if (!row) return null;
  const inheritedFrom = row.values.product !== undefined ? "product" : row.values.global !== undefined ? "global" : null;
  const inherited = inheritedFrom ? row.values[inheritedFrom] : undefined;
  return (
    <div className="grid gap-2 border-b border-zinc-100 py-3 last:border-0 sm:grid-cols-[12rem_minmax(0,1fr)] dark:border-zinc-800">
      <div>
        <p className="text-sm font-medium">{row.label}</p>
        <p className="font-mono text-[11px] text-zinc-500">
          {row.key} → {row.stripe}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">{children}</div>
        <p className="text-[11px] text-zinc-500">
          {inheritedFrom ? (
            <>
              inherit = <span className="font-mono">{formatValue(inherited)}</span> from {inheritedFrom}
            </>
          ) : (
            "inherit = Stripe default"
          )}
          {row.note && ` · ${row.note}`}
        </p>
      </div>
    </div>
  );
}

export function CheckoutOptionsPanel({
  choices,
  update,
  resolved,
}: {
  choices: PlaygroundChoices;
  update: Update;
  resolved: ResolvedOption[];
}) {
  const row = (key: OptionKey) => resolved.find((item) => item.key === key);
  const policy = resolved.filter((item) => !item.perCall);
  return (
    <div>
      <SubHeading tone="configurable">Per-call options</SubHeading>
      <p className="mb-2 text-xs text-zinc-500">
        Sent as <Code>options</Code> to <Code>payments.checkout.create</Code> by the server&apos;s{" "}
        <Code>enrich</Code>. <em>inherit</em> leaves the option unset so the product or global value applies.
      </p>

      <OptionRow row={row("allowPromotionCodes")}>
        <Segmented label="Promotion codes" value={choices.allowPromotionCodes} options={TOGGLES} format={toggleLabel}
          onChange={(value) => update("allowPromotionCodes", value)} />
      </OptionRow>
      <OptionRow row={row("collectBillingAddress")}>
        <Segmented label="Billing address" value={choices.collectBillingAddress} options={TOGGLES} format={toggleLabel}
          onChange={(value) => update("collectBillingAddress", value)} />
      </OptionRow>
      <OptionRow row={row("collectShippingAddress")}>
        <Segmented label="Shipping address" value={choices.shipping} options={SHIPPING}
          format={(value) => (value === INHERIT || value === "off" ? value : SHIPPING_PRESETS[value].label)}
          onChange={(value) => update("shipping", value)} />
      </OptionRow>
      <OptionRow row={row("collectPhoneNumber")}>
        <Segmented label="Phone number" value={choices.collectPhoneNumber} options={TOGGLES} format={toggleLabel}
          onChange={(value) => update("collectPhoneNumber", value)} />
      </OptionRow>
      <OptionRow row={row("submitType")}>
        <Segmented label="Submit type" value={choices.submitType} options={SUBMIT_TYPES}
          onChange={(value) => update("submitType", value)} />
      </OptionRow>
      <OptionRow row={row("locale")}>
        <Segmented label="Locale" value={choices.locale} options={LOCALES}
          onChange={(value) => update("locale", value)} />
      </OptionRow>
      <OptionRow row={row("customerCreation")}>
        <Segmented label="Customer creation" value={choices.customerCreation} options={CUSTOMER_CREATION}
          onChange={(value) => update("customerCreation", value)} />
      </OptionRow>
      <OptionRow row={row("consentCollection")}>
        <span className="flex items-center gap-2 text-xs">
          Terms
          <Segmented label="Terms of service consent" value={choices.termsOfService} options={TOGGLES} format={toggleLabel}
            onChange={(value) => update("termsOfService", value)} />
        </span>
        <span className="flex items-center gap-2 text-xs">
          Promotions
          <Segmented label="Promotions consent" value={choices.promotionsConsent} options={TOGGLES} format={toggleLabel}
            onChange={(value) => update("promotionsConsent", value)} />
        </span>
      </OptionRow>
      <OptionRow row={row("customText")}>
        <Segmented label="Custom text" value={choices.customText} options={CUSTOM_TEXT}
          format={(value) => (value === INHERIT ? value : CUSTOM_TEXT_PRESETS[value].label)}
          onChange={(value) => update("customText", value)} />
      </OptionRow>
      <OptionRow row={row("customFields")}>
        <Segmented label="Custom fields" value={choices.customFields} options={CUSTOM_FIELDS}
          format={(value) => (value === INHERIT ? value : CUSTOM_FIELD_PRESETS[value].label)}
          onChange={(value) => update("customFields", value)} />
      </OptionRow>
      <OptionRow row={row("expiresInMinutes")}>
        <Segmented label="Session expiry" value={choices.expiresInMinutes} options={EXPIRY_MINUTES}
          format={(value) => (value === INHERIT ? value : `${value} min`)}
          onChange={(value) => update("expiresInMinutes", value)} />
      </OptionRow>

      <SubHeading tone="policy">Business policy</SubHeading>
      <p className="mb-2 text-xs text-zinc-500">
        Controlled by server/library configuration. <Code>CheckoutRequestOptions</Code> omits these fields,
        so a per-call value is a TypeScript error and is rejected at runtime.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-2 pr-3 font-medium">Option</th>
              <th className="py-2 pr-3 font-medium">Global</th>
              <th className="py-2 pr-3 font-medium">Product</th>
              <th className="py-2 pr-3 font-medium">Per call</th>
            </tr>
          </thead>
          <tbody>
            {policy.map((item) => (
              <tr key={item.key} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-2 pr-3">
                  {item.label}
                  <span className="block font-mono text-[11px] text-zinc-500">{item.key}</span>
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{formatValue(item.values.global)}</td>
                <td className="py-2 pr-3 font-mono text-xs">{formatValue(item.values.product)}</td>
                <td className="py-2 pr-3">
                  <Pill tone="amber">🔒 not allowed</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Customer */

export function CustomerPanel({ choices, update }: { choices: PlaygroundChoices; update: Update }) {
  const selected = CUSTOMER_PRESETS[choices.customer];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="indigo">Server-side checkout configuration</Pill>
        <span className="text-xs text-zinc-500">
          Passed as <Code>customer</Code> by <Code>enrich</Code>, never read from the request body.
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {CUSTOMERS.map((key) => {
          const preset = CUSTOMER_PRESETS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => update("customer", key)}
              aria-pressed={choices.customer === key}
              className={`rounded-xl border p-3 text-left text-sm transition ${
                choices.customer === key
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/30 dark:bg-indigo-950/40"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"
              }`}
            >
              <span className="block font-medium">{preset.label}</span>
              <span className="block truncate font-mono text-xs text-zinc-500">
                {preset.customer ? preset.customer.email : "no customer object"}
              </span>
            </button>
          );
        })}
      </div>
      <KeyValue
        rows={[
          ["customer", <span key="c" className="font-mono text-xs">{formatValue(selected.customer)}</span>],
          ["clientReferenceId", <span key="r" className="font-mono text-xs">generated on the server per attempt</span>],
          ["customerCreation", <span key="cc" className="font-mono text-xs">{choices.customerCreation} (Checkout options tab)</span>],
        ]}
      />
      <Note>
        These are fixed test identities. The browser picks one by key; the email itself is a server constant.
        In a real app, <Code>enrich</Code> reads the signed-in user instead. The library accepts either{" "}
        <Code>{"{ email }"}</Code> (pre-fills and locks the email field) or <Code>{"{ id: \"cus_…\" }"}</Code>,
        never both. <Code>customerEmail</Code> remains as an alias.
      </Note>
    </div>
  );
}

/* ------------------------------------------------------------------ Metadata */

export function MetadataPanel({
  config,
  product,
  quantity,
  choices,
  update,
}: {
  config: PlaygroundConfig;
  product: ProductSnapshot;
  quantity: number;
  choices: PlaygroundChoices;
  update: Update;
}) {
  const [candidate, setCandidate] = useState("");
  const { allowedKeys, maxKeys, maxValueLength } = config.metadataPolicy;
  const trimmed = candidate.trim();
  const check =
    trimmed === ""
      ? null
      : trimmed === "productId" || trimmed === "quantity"
        ? { ok: false, text: `"${trimmed}" is reserved by the library and can't be overridden.` }
        : allowedKeys.includes(trimmed)
          ? { ok: true, text: `"${trimmed}" is in allowedKeys and is already offered below.` }
          : {
              ok: false,
              text: `"${trimmed}" is not in allowedKeys: a TypeScript error in checkout.create, and invalid_metadata at runtime.`,
            };

  const perCall: [string, string, ReactNode][] = [
    ["orderId", "order_… (generated on the server)", <Pill key="o" tone="neutral">always</Pill>],
    [
      "customerType",
      choices.metadataCustomerType === "omit" ? "—" : choices.metadataCustomerType,
      <Segmented key="t" label="customerType" value={choices.metadataCustomerType}
        options={[...CUSTOMER_TYPES, "omit"] as const} onChange={(value) => update("metadataCustomerType", value)} />,
    ],
    [
      "source",
      choices.metadataSource === "include" ? "playground" : "—",
      <Segmented key="s" label="source" value={choices.metadataSource} options={["include", "omit"] as const}
        onChange={(value) => update("metadataSource", value)} />,
    ],
  ];

  const session: Record<string, string> = { ...product.metadata, orderId: "order_…" };
  if (choices.metadataCustomerType !== "omit") session.customerType = choices.metadataCustomerType;
  if (choices.metadataSource === "include") session.source = "playground";
  session.productId = product.id;
  session.quantity = String(quantity);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Allowed keys" value={allowedKeys.join(", ")} />
        <Stat label="Max keys" value={String(maxKeys)} />
        <Stat label="Max value length" value={String(maxValueLength)} />
      </div>

      <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {perCall.map(([key, value, control]) => (
          <div key={key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span className="font-mono text-sm">{key}</span>
            <span className="text-xs text-zinc-500">{value}</span>
            {control}
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400" htmlFor="metadata-key">
          Try adding a key
        </label>
        <input
          id="metadata-key"
          value={candidate}
          onChange={(event) => setCandidate(event.target.value)}
          placeholder="e.g. campaign"
          maxLength={40}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 font-mono text-sm dark:border-zinc-700"
        />
        {check && (
          <p className={`mt-1 text-xs ${check.ok ? "text-emerald-600" : "text-red-600 dark:text-red-400"}`}>
            {check.ok ? "✓" : "✕"} {check.text}
          </p>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Session metadata: product metadata → per-call metadata → reserved keys
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(session).map(([key, value]) => (
            <Pill key={key} tone={key === "productId" || key === "quantity" ? "amber" : key in product.metadata ? "indigo" : "green"}>
              <span className="font-mono">
                {key}: {value}
              </span>
            </Pill>
          ))}
        </div>
      </div>

      <Note>
        Metadata values are server-side: the browser only chooses between fixed values. The library rejects
        sensitive-looking keys (<Code>card</Code>, <Code>password</Code>, <Code>token</Code>…), card- or
        key-like values, control characters and oversized values. See the Errors panel for live rejections.
      </Note>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 break-words font-mono text-sm font-medium">{value}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- Redirects */

function absolute(path: string, appUrl: string | null): string {
  try {
    return new URL(path, appUrl ?? undefined).toString().replaceAll("%7B", "{").replaceAll("%7D", "}");
  } catch {
    return path;
  }
}

function withSessionId(url: string): string {
  if (url.includes("{CHECKOUT_SESSION_ID}")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
}

export function RedirectsPanel({
  config,
  product,
  choices,
  update,
}: {
  config: PlaygroundConfig;
  product: ProductSnapshot;
  choices: PlaygroundChoices;
  update: Update;
}) {
  const override = REDIRECT_PRESETS[choices.redirect].value;
  const success = override?.success ?? config.urls.success;
  const cancel = override?.cancel ?? config.urls.cancel;

  return (
    <div className="flex flex-col gap-4">
      <KeyValue
        rows={[
          ["APP_URL (appUrl)", <Code key="a">{config.appUrl ?? "not set"}</Code>],
          ["Global success (urls.success)", <Code key="s">{config.urls.success}</Code>],
          ["Global cancel (urls.cancel)", <Code key="c">{config.urls.cancel}</Code>],
          [
            "security.allowedRedirectOrigins",
            <span key="o" className="font-mono text-xs">{formatValue(config.allowedRedirectOrigins)}</span>,
          ],
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {REDIRECTS.map((key) => {
          const preset = REDIRECT_PRESETS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => update("redirect", key)}
              aria-pressed={choices.redirect === key}
              className={`rounded-xl border p-3 text-left text-sm transition ${
                choices.redirect === key
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/30 dark:bg-indigo-950/40"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"
              }`}
            >
              <span className="block font-medium">{preset.label}</span>
              <span className="block text-xs text-zinc-500">{preset.description}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">
        <p className="mb-1 font-medium">What Stripe receives</p>
        <p className="break-all font-mono">
          <span className="text-emerald-600">success_url</span> {withSessionId(absolute(success, config.appUrl))}
        </p>
        <p className="break-all font-mono">
          <span className="text-amber-600">cancel_url</span>{" "}
          {absolute(cancel, config.appUrl).replace("{PRODUCT_ID}", encodeURIComponent(product.id))}
        </p>
      </div>

      <Note>
        <Code>urls.success</Code> has no <Code>{"{CHECKOUT_SESSION_ID}"}</Code>, so the library appends{" "}
        <Code>session_id=&#123;CHECKOUT_SESSION_ID&#125;</Code> for the success page. Per-call{" "}
        <Code>redirect</Code> targets follow the same origin rules: same-origin paths, <Code>appUrl</Code>, or an
        allow-listed origin. <Code>{"//evil.com"}</Code>, <Code>{"/\\evil.com"}</Code>, <Code>javascript:</Code>,{" "}
        <Code>data:</Code> and credentials in URLs are always rejected (see the <Code>invalid_redirect</Code>{" "}
        sample in Errors).
      </Note>
    </div>
  );
}
