import { normalizeGtin, normalizeMpn } from "@/lib/catalog/product-identifiers";
import { normalizeCatalogKey, stableJson } from "@/lib/catalog/catalog-normalization";

export type DuplicateProductEvidence = {
  productId: string;
  title: string;
  productTypeCode: string;
  brandId?: string | null;
  mpns?: string[];
  gtins?: string[];
  variantFingerprints?: string[];
  attributes?: Record<string, unknown>;
};

export type DuplicateSignal = {
  candidateProductId: string;
  reason: "EXACT_GTIN" | "BRAND_MPN" | "NORMALIZED_TITLE" | "ATTRIBUTE_FINGERPRINT" | "VARIANT_DIMENSIONS";
  confidenceBand: "EXACT" | "HIGH" | "MEDIUM" | "LOW";
};

function intersects(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

export function detectDuplicateSignals(source: DuplicateProductEvidence, candidates: DuplicateProductEvidence[]): DuplicateSignal[] {
  const results: DuplicateSignal[] = [];
  for (const candidate of candidates) {
    if (candidate.productId === source.productId) continue;
    const sourceGtins = (source.gtins ?? []).map(normalizeGtin);
    const candidateGtins = (candidate.gtins ?? []).map(normalizeGtin);
    if (intersects(sourceGtins, candidateGtins)) {
      results.push({ candidateProductId: candidate.productId, reason: "EXACT_GTIN", confidenceBand: "EXACT" });
      continue;
    }
    const sourceMpns = (source.mpns ?? []).map(normalizeMpn);
    const candidateMpns = (candidate.mpns ?? []).map(normalizeMpn);
    if (source.brandId && source.brandId === candidate.brandId && intersects(sourceMpns, candidateMpns)) {
      results.push({ candidateProductId: candidate.productId, reason: "BRAND_MPN", confidenceBand: "HIGH" });
      continue;
    }
    if (source.productTypeCode === candidate.productTypeCode && normalizeCatalogKey(source.title) === normalizeCatalogKey(candidate.title)) {
      results.push({ candidateProductId: candidate.productId, reason: "NORMALIZED_TITLE", confidenceBand: "MEDIUM" });
      continue;
    }
    if (intersects(source.variantFingerprints ?? [], candidate.variantFingerprints ?? [])) {
      results.push({ candidateProductId: candidate.productId, reason: "VARIANT_DIMENSIONS", confidenceBand: "MEDIUM" });
      continue;
    }
    if (source.attributes && candidate.attributes && stableJson(source.attributes) === stableJson(candidate.attributes)) {
      results.push({ candidateProductId: candidate.productId, reason: "ATTRIBUTE_FINGERPRINT", confidenceBand: "LOW" });
    }
  }
  return results;
}

