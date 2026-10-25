/** Fail predictably when no catalog item or offer is selectable; never invoke JSON.parse on missing UI state. */
export class CommerceSelectionError extends Error {
  constructor(message = "Choose a valid catalog entry before saving.") {
    super(message);
    this.name = "CommerceSelectionError";
  }
}
export function parseCommerceSelection<T extends Record<string, unknown>>(raw: unknown, keys: readonly string[]): T {
  if (typeof raw !== "string" || !raw.trim()) throw new CommerceSelectionError();
  let item: unknown;
  try { item = JSON.parse(raw); } catch { throw new CommerceSelectionError(); }
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new CommerceSelectionError();
  const values = item as Record<string, unknown>;
  if (keys.some(k => !(k in values) || (k.endsWith("Version") ? typeof values[k] !== "number" : typeof values[k] !== "string") || !String(values[k]).trim())) throw new CommerceSelectionError();
  return values as T;
}
