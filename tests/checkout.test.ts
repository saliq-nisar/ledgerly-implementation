import { describe, expect, it } from "vitest";
import { isPaymentError, PaymentErrorCodes, PaymentValidationError } from "@ledgerly/payments";
import { createCheckoutHandler } from "@ledgerly/payments/web";
import { createAppPayments } from "@/lib/payments";
import { checkoutHandlerOptions, enrichCheckout } from "@/lib/playground-server";
import { PLAYGROUND_HEADER } from "@/lib/playground";
import { checkoutRequest, errorCode, OFFLINE_ENV } from "./support/helpers";

// The app's real configuration, with offline credentials. Every rejection
// below happens inside the package before any Stripe request.
const payments = createAppPayments(OFFLINE_ENV);
const handler = createCheckoutHandler(payments, checkoutHandlerOptions);

async function post(body: unknown, init?: Parameters<typeof checkoutRequest>[1]) {
  const response = await handler(checkoutRequest(body, init));
  const json: unknown = await response.json();
  const code =
    typeof json === "object" && json !== null && "error" in json && typeof json.error === "object" && json.error !== null && "code" in json.error
      ? json.error.code
      : null;
  return { status: response.status, code };
}

describe("products", () => {
  it("knows the catalog", () => {
    expect(payments.products.has("pro")).toBe(true);
    expect(payments.products.get("pro")).toMatchObject({ name: "Pro", price: 1999, currency: "usd" });
    expect(payments.products.list({ activeOnly: true }).map((p) => p.id)).not.toContain("legacy");
  });

  it("accepts a valid product and rejects an unknown or inactive one", async () => {
    expect(payments.checkout.parse({ productId: "pro", quantity: 1 })).toEqual({ productId: "pro", quantity: 1 });
    expect(await errorCode(() => payments.checkout.parse({ productId: "enterprise" }))).toBe("invalid_product");
    expect(await errorCode(() => payments.checkout.parse({ productId: "__proto__" }))).toBe("invalid_product");
    expect(await errorCode(() => payments.checkout.parse({ productId: "legacy" }))).toBe("product_unavailable");
  });
});

describe("checkout validation", () => {
  it("defaults quantity to 1", () => {
    expect(payments.checkout.parse({ productId: "starter" })).toEqual({ productId: "starter", quantity: 1 });
  });

  it.each([0, -1, 1.5, 11, Number.NaN, Number.POSITIVE_INFINITY, 1e308, "1", null])(
    "rejects quantity %s",
    async (quantity) => {
      expect(await errorCode(() => payments.checkout.parse({ productId: "pro", quantity }))).toBe("invalid_quantity");
    },
  );

  it("applies per-product quantity limits", async () => {
    expect(await errorCode(() => payments.checkout.parse({ productId: "starter", quantity: 6 }))).toBe("invalid_quantity");
  });

  it.each([
    ["amount", { amount: 1 }],
    ["price", { price: 1 }],
    ["currency", { currency: "inr" }],
    ["amount + currency", { amount: 1, currency: "usd" }],
    ["unknown field", { discount: "100%" }],
    ["metadata", { metadata: { orderId: "x" } }],
    ["redirect", { redirect: { success: "https://evil.example" } }],
  ])("rejects %s tampering in the body", async (_label, extra) => {
    expect(await errorCode(() => payments.checkout.parse({ productId: "pro", quantity: 1, ...extra }))).toBe(
      "unexpected_field",
    );
  });
});

describe("checkout HTTP handler (createCheckoutHandler)", () => {
  it.each([
    ["amount + currency tampering", { productId: "pro", quantity: 1, amount: 1, currency: "usd" }, 400, "unexpected_field"],
    ["invalid product", { productId: "enterprise", quantity: 1 }, 400, "invalid_product"],
    ["quantity 0", { productId: "pro", quantity: 0 }, 400, "invalid_quantity"],
    ["malformed JSON", '{"productId":', 400, "invalid_request"],
  ])("returns %s as %i %s", async (_label, body, status, code) => {
    expect(await post(body)).toEqual({ status, code });
  });

  it("rejects other origins and methods", async () => {
    expect(await post({ productId: "pro" }, { origin: "https://evil.example" })).toEqual({
      status: 403,
      code: "forbidden_origin",
    });
    const get = await handler(new Request("http://localhost:3000/api/checkout", { method: "GET" }));
    expect(get.status).toBe(405);
  });

  it("refuses more Business seats than beforeCheckout allows", async () => {
    expect(await post({ productId: "business", quantity: 4 })).toEqual({ status: 409, code: "checkout_rejected" });
  });

  it("rejects a playground header outside the allowlist", async () => {
    const request = checkoutRequest({ productId: "pro", quantity: 1 });
    request.headers.set(PLAYGROUND_HEADER, JSON.stringify({ redirect: "https://evil.example" }));
    const response = await handler(request);
    expect(response.status).toBe(400);
  });
});

describe("metadata policy", () => {
  it("builds allowed metadata server-side from allowlisted choices", () => {
    const enrichment = enrichCheckout(checkoutRequest({}, { choices: { metadataCustomerType: "business" } }), {
      productId: "pro",
      quantity: 1,
    });
    expect(Object.keys(enrichment.metadata ?? {}).sort()).toEqual(["customerType", "orderId", "source"]);
    expect(enrichment.metadata?.customerType).toBe("business");
  });

  it("rejects keys outside allowedKeys, sensitive values and oversize values", async () => {
    // A plain record reaches the runtime check; a literal { campaign } is a compile error.
    const disallowed: Record<string, string> = { campaign: "spring" };
    expect(await errorCode(payments.checkout.create({ productId: "starter", metadata: disallowed }))).toBe(
      "invalid_metadata",
    );
    expect(
      await errorCode(payments.checkout.create({ productId: "starter", metadata: { orderId: "4242 4242 4242 4242" } })),
    ).toBe("invalid_metadata");
    expect(
      await errorCode(payments.checkout.create({ productId: "starter", metadata: { source: "x".repeat(65) } })),
    ).toBe("invalid_metadata");
  });
});

describe("redirects", () => {
  it("maps redirect presets to server-defined same-origin or allow-listed URLs", () => {
    const enrich = (redirect: "default" | "playground" | "allowlisted") =>
      enrichCheckout(checkoutRequest({}, { choices: { redirect } }), { productId: "pro", quantity: 1 }).redirect;
    expect(enrich("default")).toBeUndefined();
    expect(enrich("playground")?.success).toBe("/payment/success?from=playground");
    expect(enrich("allowlisted")?.success).toBe("http://127.0.0.1:3000/payment/success");
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example",
    "javascript:alert(1)",
    "http://user:pass@localhost:3000/payment/success",
  ])("rejects unsafe redirect %s", async (success) => {
    expect(await errorCode(payments.checkout.create({ productId: "starter", redirect: { success } }))).toBe(
      "invalid_redirect",
    );
  });
});

describe("errors", () => {
  it("exposes stable error codes", () => {
    expect(Object.values(PaymentErrorCodes)).toEqual(
      expect.arrayContaining(["invalid_product", "invalid_quantity", "unexpected_field", "webhook_signature_invalid"]),
    );
  });

  it("describes library errors with code, message, status and retryability", () => {
    let caught: unknown;
    try {
      payments.checkout.parse({ productId: "legacy" });
    } catch (error) {
      caught = error;
    }
    expect(isPaymentError(caught)).toBe(true);
    expect(caught).toBeInstanceOf(PaymentValidationError);
    expect(payments.errors.describe(caught)).toEqual({
      code: "product_unavailable",
      message: "This plan has been retired and can no longer be purchased.", // app's publicMessages override
      statusCode: 400,
      retryable: false,
    });
  });

  it("never leaks details of unknown errors", () => {
    const described = payments.errors.describe(new Error(`boom ${OFFLINE_ENV.STRIPE_SECRET_KEY} password=hunter2`));
    expect(described.statusCode).toBe(500);
    expect(JSON.stringify(described)).not.toMatch(/sk_test_|hunter2|boom/);
  });
});
