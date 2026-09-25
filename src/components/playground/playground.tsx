"use client";

import { useCallback, useMemo, useState } from "react";
import { buildRequestOptions, DEFAULT_CHOICES, type PlaygroundChoices, type PlaygroundConfig } from "@/lib/playground";
import { resolveOptions } from "@/lib/effective";
import { ActivityPanels } from "./activity";
import { ErrorsPanel } from "./errors";
import {
  CheckoutOptionsPanel,
  CustomerPanel,
  MetadataPanel,
  ProductsPanel,
  RedirectsPanel,
} from "./panels";
import { CheckoutAction, CodePreview, HierarchyPanel } from "./preview";
import { ServerControlledPanel, type ServerCode } from "./server-controlled";
import { useTimeline } from "./timeline";

const TABS = [
  "Products",
  "Checkout options",
  "Customer",
  "Metadata",
  "Redirects",
  "Callbacks",
  "Errors",
  "Logging",
  "Monitoring",
] as const;
type Tab = (typeof TABS)[number];

export interface ApiError {
  status: number;
  code: string;
  message: string;
  requestId: string | null;
}

export function Playground({
  config,
  errorCodes,
  initialProductId,
  available,
  serverCode,
}: {
  config: PlaygroundConfig;
  errorCodes: readonly string[];
  initialProductId: string;
  available: boolean;
  serverCode: ServerCode;
}) {
  const [tab, setTab] = useState<Tab>("Products");
  const [productId, setProductId] = useState(initialProductId);
  const [quantity, setQuantity] = useState(1);
  const [choices, setChoices] = useState<PlaygroundChoices>(DEFAULT_CHOICES);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const timeline = useTimeline();

  const product = config.products.find((item) => item.id === productId) ?? config.products[0];
  const requestOptions = useMemo(() => buildRequestOptions(choices), [choices]);
  const resolved = useMemo(
    () => resolveOptions(config.clientCheckout, product.checkout, requestOptions),
    [config.clientCheckout, product.checkout, requestOptions],
  );

  const selectProduct = useCallback(
    (id: string) => {
      setProductId(id);
      const next = config.products.find((item) => item.id === id);
      if (next) setQuantity((current) => Math.min(Math.max(current, next.minQuantity), next.maxQuantity));
    },
    [config.products],
  );

  const update = useCallback(
    <K extends keyof PlaygroundChoices>(key: K, value: PlaygroundChoices[K]) =>
      setChoices((current) => ({ ...current, [key]: value })),
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <nav
              aria-label="Configuration sections"
              className="flex gap-1 overflow-x-auto border-b border-zinc-200 p-2 dark:border-zinc-800"
            >
              {TABS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTab(name)}
                  aria-current={tab === name ? "page" : undefined}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    tab === name
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {name}
                </button>
              ))}
            </nav>
            <div className="p-5 sm:p-6">
              {tab === "Products" && (
                <ProductsPanel
                  config={config}
                  product={product}
                  quantity={quantity}
                  onSelect={selectProduct}
                  onQuantity={setQuantity}
                />
              )}
              {tab === "Checkout options" && (
                <CheckoutOptionsPanel choices={choices} update={update} resolved={resolved} />
              )}
              {tab === "Customer" && <CustomerPanel choices={choices} update={update} />}
              {tab === "Metadata" && (
                <MetadataPanel config={config} product={product} quantity={quantity} choices={choices} update={update} />
              )}
              {tab === "Redirects" && (
                <RedirectsPanel config={config} product={product} choices={choices} update={update} />
              )}
              {(tab === "Callbacks" || tab === "Errors" || tab === "Logging" || tab === "Monitoring") && (
                <ServerControlledPanel section={tab} config={config} code={serverCode} timeline={timeline} />
              )}
            </div>
          </div>
          <HierarchyPanel resolved={resolved} product={product} />
        </div>

        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <CheckoutAction
            product={product}
            quantity={quantity}
            choices={choices}
            available={available}
            onBrowserEvent={timeline.addBrowserEvent}
            onError={setApiError}
          />
          <CodePreview config={config} product={product} quantity={quantity} choices={choices} />
        </aside>
      </div>

      <ActivityPanels config={config} timeline={timeline} />
      <ErrorsPanel apiError={apiError} errorCodes={errorCodes} config={config} />
    </div>
  );
}
