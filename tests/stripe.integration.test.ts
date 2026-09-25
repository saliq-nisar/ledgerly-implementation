import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { describe, expect, it } from "vitest";
import { createCheckoutHandler } from "@ledgerly/payments/web";
import { createAppPayments } from "@/lib/payments";
import { checkoutHandlerOptions } from "@/lib/playground-server";
import { checkoutRequest } from "./support/helpers";

// Real Stripe test mode, using the app's own .env.local (Next skips that file
// when NODE_ENV=test). Skipped without a test key. Creates unpaid sessions only.
if (existsSync(".env.local")) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(".env.local", "utf8")))) {
    if (value !== undefined) process.env[key] ??= value;
  }
}
const configured = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false;

describe.skipIf(!configured)("real Stripe test mode", () => {
  const payments = configured ? createAppPayments() : null;

  async function checkout(body: unknown, choices?: Parameters<typeof checkoutRequest>[1]) {
    if (!payments) throw new Error("not configured");
    const response = await createCheckoutHandler(payments, checkoutHandlerOptions)(checkoutRequest(body, choices));
    return { status: response.status, body: (await response.json()) as { id?: string; url?: string } };
  }

  it("creates a valid checkout priced from the server catalog", async () => {
    const { status, body } = await checkout(
      { productId: "pro", quantity: 2 },
      { choices: { customer: "jenny", metadataCustomerType: "business", locale: "fr" } },
    );
    expect(status).toBe(200);
    expect(body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const summary = await payments!.checkout.retrieve(body.id!);
    expect(summary).toMatchObject({ status: "unpaid", quantity: 2, amountTotal: 3998, currency: "usd" });
    expect(summary.product?.id).toBe("pro");
    expect(summary.customerEmail).toBe("jenny.rosen@example.com");
    expect(summary.metadata).toMatchObject({ customerType: "business", source: "playground", tier: "pro" });
    expect(summary.metadata.orderId).toMatch(/^order_/);
  });

  it("accepts allow-listed and per-call same-origin redirects", async () => {
    expect((await checkout({ productId: "starter" }, { choices: { redirect: "allowlisted" } })).status).toBe(200);
    expect((await checkout({ productId: "starter" }, { choices: { redirect: "playground" } })).status).toBe(200);
  });

  it("still rejects tampering before calling Stripe", async () => {
    const { status, body } = await checkout({ productId: "pro", quantity: 1, amount: 1, currency: "usd" });
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: { code: "unexpected_field" } });
  });
});
