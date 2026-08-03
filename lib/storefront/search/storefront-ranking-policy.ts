import { normalizeStorefrontQuery } from "@/lib/storefront/search/storefront-query-normalization";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";

export const STOREFRONT_RANKING_VERSION = "organic-v1";

export type RankedStorefrontDocument = { document: StorefrontDocument; score: number; matchKind: "EXACT" | "PREFIX" | "TOKEN" | "TYPO" | "BROWSE" };

function boundedSimilarity(left: string, right: string): number {
  const a = left.slice(0, 80); const b = right.slice(0, 80);
  if (a === b) return 1;
  if (!a || !b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const old = previous[column] ?? 0;
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + (a[row - 1] === b[column - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return 1 - (previous[b.length] ?? Math.max(a.length, b.length)) / Math.max(a.length, b.length);
}

export function rankStorefrontDocuments(documents: readonly StorefrontDocument[], query?: string): RankedStorefrontDocument[] {
  const normalized = query ? normalizeStorefrontQuery(query) : undefined;
  return documents.map((document) => {
    if (!normalized?.value) return { document, score: 0, matchKind: "BROWSE" as const };
    const title = document.normalizedTitle;
    const combined = `${title} ${document.brandName ?? ""} ${document.productTypeCode} ${document.categoryPath} ${document.storeSlug} ${document.searchText}`.toLocaleLowerCase("en-ZA");
    if (normalized.exactIdentifier) {
      const exact = [document.variantReference, document.offerReference, document.searchText].some((value) => value.toLocaleLowerCase("en-ZA").split(/\s+/).includes(normalized.value));
      return { document, score: exact ? 1_000 : -1_000, matchKind: "EXACT" as const };
    }
    let score = 0;
    let matchKind: RankedStorefrontDocument["matchKind"] = "TYPO";
    if (title === normalized.value) { score += 1_000; matchKind = "EXACT"; }
    else if (title.startsWith(normalized.value)) { score += 700; matchKind = "PREFIX"; }
    for (const token of normalized.tokens) {
      if (title.split(" ").includes(token)) { score += 180; matchKind = matchKind === "TYPO" ? "TOKEN" : matchKind; }
      else if (combined.includes(token)) { score += 70; matchKind = matchKind === "TYPO" ? "TOKEN" : matchKind; }
      else if (boundedSimilarity(token, title) >= 0.82) score += 25;
    }
    if (document.availability === "IN_STOCK") score += 20;
    if (document.availability === "LOW_STOCK") score += 10;
    // Published time is a bounded, secondary stability signal—not popularity.
    score += Math.max(0, Math.min(5, Math.floor(new Date(document.publishedAt).getTime() / 86_400_000) % 6));
    return { document, score, matchKind };
  }).filter((item) => item.score >= 0).sort((left, right) => right.score - left.score || left.document.publicReference.localeCompare(right.document.publicReference));
}

export function findStorefrontCorrection(query: string, documents: readonly StorefrontDocument[]): string | undefined {
  const normalized = normalizeStorefrontQuery(query);
  if (!normalized.value || normalized.exactIdentifier) return undefined;
  const candidate = documents
    .map((document) => ({ title: document.normalizedTitle, score: boundedSimilarity(normalized.value, document.normalizedTitle) }))
    .filter((item) => item.score >= 0.86 && item.title !== normalized.value)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))[0];
  return candidate?.title;
}

