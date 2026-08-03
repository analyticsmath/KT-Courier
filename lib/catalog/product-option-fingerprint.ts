import { createHash } from "node:crypto";
import { normalizeCatalogKey } from "@/lib/catalog/catalog-normalization";

export type VariantOptionSelection = { code: string; value: string };

export function canonicalOptionSelections(selections: VariantOptionSelection[]): VariantOptionSelection[] {
  const normalized = selections.map((selection) => ({
    code: normalizeCatalogKey(selection.code),
    value: normalizeCatalogKey(selection.value),
  }));
  const codes = new Set(normalized.map(({ code }) => code));
  if (codes.size !== normalized.length) throw new Error("Variant option codes must be unique.");
  return normalized.sort((left, right) => left.code.localeCompare(right.code));
}

export function productOptionFingerprint(selections: VariantOptionSelection[]): string {
  const canonical = canonicalOptionSelections(selections);
  const source = canonical.length === 0
    ? "default"
    : canonical.map(({ code, value }) => `${code}=${value}`).join("|");
  return createHash("sha256").update(source).digest("hex");
}

