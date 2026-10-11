import { createHash } from "node:crypto";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
/** JSON field ordering is transport syntax, not a changed customer decision. */
export function storeOrderRequestHash(action: string, body: Record<string, unknown>) {
  return createHash("sha256").update(`${action}:${JSON.stringify(canonical(body))}`).digest("hex");
}
