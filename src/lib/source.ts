import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Read at request time; not part of the bundle or its file trace.
const root = /* turbopackIgnore: true */ process.cwd();

/**
 * Reads this project's own source so the UI shows the code that actually
 * runs. With a region name, returns the lines between `// #region name` and
 * `// #endregion name`.
 */
export function readSource(file: string, region?: string): string {
  let text: string;
  try {
    text = readFileSync(path.join(/* turbopackIgnore: true */ root, file), "utf8").replaceAll("\r\n", "\n");
  } catch {
    return `// ${file} is not available in this deployment.`;
  }
  if (!region) return text.trimEnd();

  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === `// #region ${region}`);
  const end = lines.findIndex((line, index) => index > start && line.trim() === `// #endregion ${region}`);
  if (start === -1 || end === -1) return `// Region "${region}" not found in ${file}.`;
  return lines.slice(start + 1, end).join("\n");
}

/** Import lines of a file, so snippets show where every name comes from. */
export function readImports(file: string): string {
  const imports: string[] = [];
  let inImport = false;
  for (const line of readSource(file).split("\n")) {
    if (line.startsWith("import ")) inImport = true;
    if (inImport) imports.push(line);
    if (inImport && line.trimEnd().endsWith(";")) inImport = false;
  }
  return imports.join("\n");
}

export interface PackageFacts {
  name: string;
  version: string;
  dependencySpec: string | null;
  resolved: string | null;
  integrity: string | null;
  installedFromTarball: boolean;
  stripeIsDirectDependency: boolean;
  stripeVersion: string | null;
  hasSourceFolder: boolean;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(path.join(/* turbopackIgnore: true */ root, file), "utf8"));
  } catch {
    return null;
  }
}

function field(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (typeof current !== "object" || current === null || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

const asString = (value: unknown) => (typeof value === "string" ? value : null);

/** Facts about how @ledgerly/payments is installed, read from package.json, the lockfile and node_modules. */
export function packageFacts(): PackageFacts {
  const app = readJson("package.json");
  const lock = readJson("package-lock.json");
  const installed = readJson("node_modules/@ledgerly/payments/package.json");
  const stripe = readJson("node_modules/stripe/package.json");
  const spec = asString(field(app, "dependencies", "@ledgerly/payments"));

  return {
    name: asString(field(installed, "name")) ?? "@ledgerly/payments",
    version: asString(field(installed, "version")) ?? "unknown",
    dependencySpec: spec,
    resolved: asString(field(lock, "packages", "node_modules/@ledgerly/payments", "resolved")),
    integrity: asString(field(lock, "packages", "node_modules/@ledgerly/payments", "integrity")),
    installedFromTarball: spec?.endsWith(".tgz") ?? false,
    stripeIsDirectDependency:
      field(app, "dependencies", "stripe") !== undefined || field(app, "devDependencies", "stripe") !== undefined,
    stripeVersion: asString(field(stripe, "version")),
    hasSourceFolder: existsSync(path.join(/* turbopackIgnore: true */ root, "node_modules/@ledgerly/payments/src")),
  };
}
