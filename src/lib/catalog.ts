import "server-only";

import { defineProducts, type ProductId } from "@ledgerly/payments";

const image = (text: string) => `https://placehold.co/600x600/png?text=${text}`;

/**
 * Optional: a one-time Price that already exists in your Stripe test account.
 * When set, the "team" product charges through it, and the library verifies
 * it matches price 1500 / usd exactly before the first checkout.
 */
const dashboardPriceId = process.env.DEMO_STRIPE_PRICE_ID || undefined;

// #region products
// The server-side catalog is the only source of prices and currencies.
export const products = defineProducts({
  starter: {
    name: "Starter",
    price: 999, // $9.99 in cents
    currency: "usd",
    description: "For side projects and prototypes.",
    images: [image("Starter")],
    maxQuantity: 5,
    metadata: { tier: "starter" },
  },
  pro: {
    name: "Pro",
    price: 1999, // $19.99
    currency: "usd",
    description: "For growing teams that need promotions and priority support.",
    images: [image("Pro")],
    taxBehavior: "exclusive",
    taxCode: "txcd_10103001",
    metadata: { tier: "pro" },
    checkout: {
      allowPromotionCodes: true,
      customText: { submit: "Pro includes priority support." },
    },
  },
  business: {
    name: "Business",
    price: 4999, // $49.99
    currency: "usd",
    description: "Invoiced purchases with a required billing address.",
    images: [image("Business")],
    maxQuantity: 10,
    metadata: { tier: "business" },
    checkout: {
      collectBillingAddress: true,
      customerCreation: "always",
      createInvoice: true,
      submitType: "book",
    },
  },
  team: {
    name: "Team (Dashboard Price)",
    price: 1500,
    currency: "usd",
    metadata: { tier: "team" },
    // With stripePriceId, images/description/tax live on the Stripe Price
    // and Product; the library rejects them here.
    ...(dashboardPriceId
      ? { stripePriceId: dashboardPriceId }
      : { description: "Inline price. Set DEMO_STRIPE_PRICE_ID to charge through a Dashboard Price." }),
  },
  legacy: {
    name: "Legacy",
    price: 499,
    currency: "usd",
    description: "Retired plan: listed, but active: false makes it unpurchasable.",
    active: false,
  },
});
// #endregion products

export type Catalog = typeof products;
export type AppProductId = ProductId<Catalog>;

export function isProductId(value: unknown): value is AppProductId {
  return typeof value === "string" && Object.hasOwn(products, value);
}
