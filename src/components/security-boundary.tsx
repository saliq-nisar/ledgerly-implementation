import { Code } from "./ui";

const BROWSER_CAN = [
  ["productId", "Validated against the server catalog"],
  ["quantity", "Whole number within the product's limits"],
] as const;

const BROWSER_CANNOT = [
  ["amount", "catalog price × validated quantity"],
  ["currency", "always the product's currency"],
  ["metadata policy", "allowedKeys, maxKeys, maxValueLength"],
  ["Stripe secret key", "stays in the server environment"],
  ["webhook secret", "stays in the server environment"],
  ["server callbacks", "beforeCheckout, onPaymentSucceeded, …"],
  ["trusted pricing", "stripePriceId must match the catalog exactly"],
  ["security configuration", "redirect origins, Origin check, body limits"],
] as const;

export function SecurityBoundary() {
  return (
    <section
      aria-labelledby="security-boundary"
      className="overflow-hidden rounded-2xl border-2 border-zinc-900 bg-white shadow-sm dark:border-zinc-100 dark:bg-zinc-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900 px-5 py-3 text-white dark:bg-zinc-100 dark:text-zinc-900">
        <h2 id="security-boundary" className="text-sm font-semibold uppercase tracking-wider">
          Security boundary
        </h2>
        <p className="text-xs opacity-80">The server and the library stay authoritative</p>
      </div>
      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="border-b border-zinc-200 p-5 md:border-b-0 md:border-r dark:border-zinc-800">
          <h3 className="text-base font-semibold text-emerald-700 dark:text-emerald-400">What the browser can control</h3>
          <ul className="mt-3 space-y-2">
            {BROWSER_CAN.map(([name, detail]) => (
              <li key={name} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
                  ✓
                </span>
                <span>
                  <span className="font-mono text-base font-semibold">{name}</span>
                  <span className="block text-xs text-zinc-500">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-zinc-500">
            Any other body field (<Code>amount</Code>, <Code>currency</Code>, <Code>metadata</Code>,{" "}
            <Code>customer</Code>, <Code>options</Code>, <Code>redirect</Code>…) returns 400{" "}
            <Code>unexpected_field</Code>. Playground selections travel as allowlisted keys, and the server&apos;s{" "}
            <Code>enrich</Code> maps them to server-defined values.
          </p>
        </div>
        <div className="p-5">
          <h3 className="text-base font-semibold text-red-700 dark:text-red-400">What the browser CANNOT control</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {BROWSER_CANNOT.map(([name, detail]) => (
              <li key={name} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white">
                  ✕
                </span>
                <span>
                  <span className="font-semibold">{name}</span>
                  <span className="block text-xs text-zinc-500">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
