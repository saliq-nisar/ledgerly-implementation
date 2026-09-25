import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activitySince } from "@/lib/activity";
import { createAppPayments } from "@/lib/payments";
import { createAppWebhookHandler } from "@/lib/webhooks";
import { checkoutCompletedEvent, errorCode, OFFLINE_ENV, stripeSignature, webhookRequest } from "./support/helpers";

const secret = OFFLINE_ENV.STRIPE_WEBHOOK_SECRET;

describe("webhook route", () => {
  beforeEach(() => {
    // No credentials: the route must answer, not crash.
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("exists as a POST handler and reports 503 without credentials", async () => {
    const route = await import("@/app/api/webhook/route");
    expect(typeof route.POST).toBe("function");
    const response = await route.POST(webhookRequest("{}", null));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "payments_unavailable" } });
  });

  it("checkout route also reports 503 without credentials", async () => {
    const route = await import("@/app/api/checkout/route");
    const response = await route.POST(new Request("http://localhost:3000/api/checkout", { method: "POST" }));
    expect(response.status).toBe(503);
  });
});

describe("webhook handling (createWebhookHandler inside the package)", () => {
  // A fresh client per test gives each test its own memory event store.
  let handler: (request: Request) => Promise<Response>;
  let payments: ReturnType<typeof createAppPayments>;
  beforeEach(() => {
    payments = createAppPayments(OFFLINE_ENV);
    handler = createAppWebhookHandler(payments);
  });

  it("processes a validly signed checkout.session.completed and runs the callbacks", async () => {
    const before = activitySince(0).at(-1)?.id ?? 0;
    const payload = checkoutCompletedEvent();
    const response = await handler(webhookRequest(payload, stripeSignature(payload, secret)));
    expect(response.status).toBe(200);

    const names = activitySince(before).map((entry) => entry.name);
    expect(names).toEqual(
      expect.arrayContaining(["onWebhookReceived", "webhooks.on", "onPaymentSucceeded", "onWebhookProcessed"]),
    );
    expect(names.indexOf("webhooks.on")).toBeLessThan(names.indexOf("onPaymentSucceeded"));
  });

  it("reports a redelivered event as a duplicate (memory storage)", async () => {
    const payload = checkoutCompletedEvent();
    const first = await payments.webhooks.handle(payload, stripeSignature(payload, secret));
    const second = await payments.webhooks.handle(payload, stripeSignature(payload, secret));
    expect(first.outcome).toBe("processed");
    expect(second.outcome).toBe("duplicate");

    const viaHttp = await handler(webhookRequest(payload, stripeSignature(payload, secret)));
    expect(viaHttp.status).toBe(200);
  });

  it("rejects a missing signature, a bad signature and a tampered body", async () => {
    const payload = checkoutCompletedEvent();
    expect((await handler(webhookRequest(payload, null))).status).toBe(400);
    expect((await handler(webhookRequest(payload, "t=1,v1=deadbeef"))).status).toBe(400);

    const signedForOther = stripeSignature(payload, `whsec_${"WrongSecret00".repeat(3)}`);
    expect(await errorCode(payments.webhooks.handle(payload, signedForOther))).toBe("webhook_signature_invalid");

    const tampered = payload.replace('"amount_total":1999', '"amount_total":1');
    expect(await errorCode(payments.webhooks.handle(tampered, stripeSignature(payload, secret)))).toBe(
      "webhook_signature_invalid",
    );
  });

  it("rejects signatures outside the replay window", async () => {
    const payload = checkoutCompletedEvent();
    const old = stripeSignature(payload, secret, Math.floor(Date.now() / 1000) - 3600);
    expect((await handler(webhookRequest(payload, old))).status).toBe(400);
  });
});
