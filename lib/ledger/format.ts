export function formatZarLedgerAmount(value: string): string {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value);
  if (!match) return `ZAR ${value}`;
  const [, sign, integer, fraction] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign ? "−" : ""}ZAR\u00A0${grouped},${fraction}`;
}

export function formatLedgerTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(value));
}

