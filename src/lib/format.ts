/** Display-only formatter for minor-unit amounts. Never used to compute charges. */
export function formatAmount(minorUnits: number, currency: string): string {
  const format = new Intl.NumberFormat("en-US", { style: "currency", currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(minorUnits / 10 ** digits);
}
