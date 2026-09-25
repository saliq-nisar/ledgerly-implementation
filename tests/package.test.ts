import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as payments from "@ledgerly/payments";
import * as web from "@ledgerly/payments/web";
import installedPackage from "@ledgerly/payments/package.json";

const app = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("package import", () => {
  it("imports the main entry point with its public API", () => {
    for (const name of [
      "createPaymentClient",
      "defineProducts",
      "createMemoryEventStore",
      "rejectCheckout",
      "isPaymentError",
    ] as const) {
      expect(typeof payments[name]).toBe("function");
    }
    expect(payments.PaymentErrorCodes.INVALID_PRODUCT).toBe("invalid_product");
    expect(new payments.PaymentValidationError({ code: "invalid_product", message: "x" })).toBeInstanceOf(
      payments.PaymentError,
    );
  });

  it("imports the /web adapter", () => {
    expect(typeof web.createCheckoutHandler).toBe("function");
    expect(typeof web.createWebhookHandler).toBe("function");
  });

  it("is version 0.2.0, installed from the packed .tgz artifact", () => {
    expect(installedPackage.version).toBe("0.2.0");
    expect(app.dependencies["@ledgerly/payments"]).toMatch(/ledgerly-payments-0\.2\.0\.tgz$/);
  });

  it("ships compiled output only, not library source", () => {
    expect(existsSync("node_modules/@ledgerly/payments/dist/index.js")).toBe(true);
    expect(existsSync("node_modules/@ledgerly/payments/src")).toBe(false);
  });

  it("gets Stripe only transitively", () => {
    expect(app.dependencies.stripe).toBeUndefined();
    expect(app.devDependencies.stripe).toBeUndefined();
    expect(installedPackage.dependencies.stripe).toBeDefined();
  });
});

describe("package boundary", () => {
  const files = ["src", "tests"].flatMap((dir) =>
    (readdirSync(dir, { recursive: true, encoding: "utf8" }) as string[])
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .map((file) => `${dir}/${file.replaceAll("\\", "/")}`),
  );

  it("never imports the Stripe SDK directly", () => {
    const offenders = files.filter((file) => /from\s+["']stripe["']|require\(["']stripe["']\)/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("never reaches into the library's source repository", () => {
    const offenders = files.filter((file) =>
      /from\s+["'][^"']*(demo-stripe|packages\/payments|@ledgerly\/payments\/(dist|src))/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the library out of client components (type-only imports are erased)", () => {
    const clientFiles = files.filter((file) => readFileSync(file, "utf8").startsWith('"use client"'));
    expect(clientFiles.length).toBeGreaterThan(0);
    const offenders = clientFiles.filter((file) =>
      /^import\s+(?!type\b)[^;]*from\s+["']@ledgerly\/payments/m.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
