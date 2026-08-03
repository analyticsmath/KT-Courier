/** Formats a server-issued decimal without numeric coercion or client calculation. */
export function formatPromoterMoney(value: unknown, currency: string = "ZAR"): string {
  const decimal = typeof value === "string" ? value : value && typeof value === "object" && "toString" in value ? String(value) : "0";
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(decimal);
  if (!match) return `${currency} —`;
  const [, sign, integer, fraction = ""] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign ? "−" : ""}${currency} ${grouped}.${fraction.padEnd(2, "0")}`;
}

export function formatPromoterDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(date);
}

export function formatPromoterDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
