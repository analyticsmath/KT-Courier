export type LegacyStoreSource = Readonly<{
  id: number;
  name: string;
  status: number;
  active: number;
  moduleId: number;
}>;

export type LegacyItemSource = Readonly<{
  id: number;
  storeId: number;
  moduleId: number;
  status: number;
  isApproved: number;
  categoryPath?: readonly string[];
}>;

export type LegacyMediaEvidence = Readonly<{
  exists: boolean;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  decodable: boolean;
}>;

export type LegacyItemDisposition =
  | "PUBLISH"
  | "PRESERVE_PENDING"
  | "REJECT_ORPHAN";

const TEST_STORE_PATTERN = /(^|\b)(test|demo|sample|do not use)(\b|$)/i;

export function normalizeLegacyEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized && normalized.includes("@") ? normalized : null;
}

export function normalizeLegacyPhone(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const compact = raw.replace(/[\s().-]+/g, "");
  if (/^\+27\d{9}$/.test(compact)) return compact;
  if (/^0\d{9}$/.test(compact)) return `+27${compact.slice(1)}`;
  return raw;
}

export function isLegacyStorePublicationCandidate(store: LegacyStoreSource): boolean {
  return (
    store.status === 1 &&
    store.active === 1 &&
    store.name.trim().length > 1 &&
    !TEST_STORE_PATTERN.test(store.name)
  );
}

export function isLegacyMediaUsable(evidence: LegacyMediaEvidence | null | undefined): boolean {
  return Boolean(
    evidence &&
      evidence.exists &&
      evidence.decodable &&
      Number.isSafeInteger(evidence.byteSize) &&
      evidence.byteSize > 0,
  );
}

/**
 * Source media below the current catalogue dimension floor can be losslessly
 * classified as recoverable: the migration media normalizer may upscale while
 * preserving the original composition. Missing/zero-byte media is not
 * recoverable and blocks automatic publication.
 */
export function legacyItemDisposition(input: {
  item: LegacyItemSource;
  store: LegacyStoreSource | null;
  primaryMedia: LegacyMediaEvidence | null;
}): LegacyItemDisposition {
  if (!input.store) return "REJECT_ORPHAN";
  if (
    !isLegacyStorePublicationCandidate(input.store) ||
    input.item.status !== 1 ||
    input.item.isApproved !== 1
  ) {
    return "PRESERVE_PENDING";
  }
  return isLegacyMediaUsable(input.primaryMedia)
    ? "PUBLISH"
    : "PRESERVE_PENDING";
}

export { legacyProductTypeCode } from "./catalog-taxonomy.mjs";

function refPart(value: string | number): string {
  return String(value).trim().replace(/[^A-Za-z0-9_-]/g, "-").toUpperCase();
}

export const legacyReferences = Object.freeze({
  run: (fingerprint: string) => `LMR-6AM-${fingerprint.slice(0, 20).toUpperCase()}`,
  store: (sourceId: number) => `LEG6-STORE-${refPart(sourceId)}`,
  category: (sourceId: number) => `LEG6-CAT-${refPart(sourceId)}`,
  brand: (sourceId: number) => `LEG6-BRAND-${refPart(sourceId)}`,
  product: (sourceId: number) => `LEG6-PROD-${refPart(sourceId)}`,
  variant: (sourceId: number, variantIndex: number) =>
    `LEG6-VAR-${refPart(sourceId)}-${variantIndex + 1}`,
  offer: (sourceId: number, variantIndex: number) =>
    `LEG6-OFFER-${refPart(sourceId)}-${variantIndex + 1}`,
  price: (sourceId: number, variantIndex: number) =>
    `LEG6-PRICE-${refPart(sourceId)}-${variantIndex + 1}`,
  inventory: (sourceId: number, variantIndex: number) =>
    `LEG6-INV-${refPart(sourceId)}-${variantIndex + 1}`,
  media: (kind: string, sourceId: number, ordinal = 0) =>
    `LEG6-MEDIA-${refPart(kind)}-${refPart(sourceId)}-${ordinal + 1}`,
});

export function legacySlug(name: string, sourceId: number): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return `${base || "legacy"}-${sourceId}`;
}

export type LegacyVariantInput = Readonly<{
  title: string;
  price: number;
  stock: number | null;
  optionFingerprint: string;
  optionLabel: string | null;
}>;

export function parseLegacyVariants(input: {
  baseTitle: string;
  basePrice: number;
  baseStock: number | null;
  variations: unknown;
}): LegacyVariantInput[] {
  const source = Array.isArray(input.variations) ? input.variations : [];
  if (source.length === 0) {
    return [
      Object.freeze({
        title: input.baseTitle,
        price: input.basePrice,
        stock: input.baseStock,
        optionFingerprint: "default",
        optionLabel: null,
      }),
    ];
  }

  const variants: LegacyVariantInput[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const row = source[index];
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const label = String(record.type ?? record.name ?? `Option ${index + 1}`).trim();
    const numericPrice = Number(record.price);
    const numericStock = Number(record.stock);
    variants.push(
      Object.freeze({
        title: label ? `${input.baseTitle} — ${label}` : input.baseTitle,
        price: Number.isFinite(numericPrice) && numericPrice >= 0 ? numericPrice : input.basePrice,
        stock: Number.isFinite(numericStock) && numericStock >= 0 ? Math.trunc(numericStock) : input.baseStock,
        optionFingerprint: `legacy-option-${index + 1}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        optionLabel: label || null,
      }),
    );
  }

  return variants.length > 0
    ? variants
    : [
        Object.freeze({
          title: input.baseTitle,
          price: input.basePrice,
          stock: input.baseStock,
          optionFingerprint: "default",
          optionLabel: null,
        }),
      ];
}
