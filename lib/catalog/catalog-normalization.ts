import { createHash, randomBytes } from "node:crypto";

const HTML_PATTERN = /<\/?[a-z][^>]*>/i;

export function normalizeCatalogText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function normalizeCatalogKey(value: string): string {
  return normalizeCatalogText(value).toLocaleLowerCase("en-ZA");
}

export function catalogSlug(value: string): string {
  return normalizeCatalogKey(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function assertPlainCatalogText(value: string, field: string): string {
  const normalized = normalizeCatalogText(value);
  if (HTML_PATTERN.test(normalized)) {
    throw new Error(`${field} must not contain HTML.`);
  }
  return normalized;
}

export function catalogPublicReference(prefix: string): string {
  return `${prefix}-${randomBytes(16).toString("hex").toUpperCase()}`;
}

export function catalogRequestHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

