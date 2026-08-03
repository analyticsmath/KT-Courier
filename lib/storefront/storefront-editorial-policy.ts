import { normalizeStorefrontQuery } from "@/lib/storefront/search/storefront-query-normalization";
import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";

export const STOREFRONT_COLLECTION_TARGET_TYPES = ["CATEGORY", "PRODUCT", "VARIANT", "STORE"] as const;
export type StorefrontCollectionTargetType = (typeof STOREFRONT_COLLECTION_TARGET_TYPES)[number];
export const STOREFRONT_EDITORIAL_STATUSES = ["DRAFT", "UNDER_REVIEW", "APPROVED", "ACTIVE", "RETIRED", "REJECTED"] as const;
export type StorefrontEditorialStatus = (typeof STOREFRONT_EDITORIAL_STATUSES)[number];

const transitions: Readonly<Record<StorefrontEditorialStatus, readonly StorefrontEditorialStatus[]>> = Object.freeze({
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ACTIVE"],
  ACTIVE: ["RETIRED"],
  RETIRED: [],
  REJECTED: [],
});

export class StorefrontEditorialPolicyError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "StorefrontEditorialPolicyError"; }
}

export function assertStorefrontEditorialTransition(from: StorefrontEditorialStatus, to: StorefrontEditorialStatus): void {
  if (!transitions[from].includes(to)) throw new StorefrontEditorialPolicyError("INVALID_LIFECYCLE_TRANSITION", "This editorial record cannot make that lifecycle transition.");
  if (to === "ACTIVE") assertStorefrontPublicExposureAllowed();
}

export function collectionIsEffective(value: { status: StorefrontEditorialStatus; effectiveFrom?: Date | null; effectiveUntil?: Date | null }, now = new Date()): boolean {
  return value.status === "ACTIVE" && (!value.effectiveFrom || value.effectiveFrom <= now) && (!value.effectiveUntil || value.effectiveUntil > now);
}

export type StorefrontSynonymDirection = "EQUIVALENT" | "ONE_WAY";
export type StorefrontSynonymTerm = Readonly<{ input: string; outputs: readonly string[]; direction: StorefrontSynonymDirection }>;

function cleanTerm(value: string): string {
  const normalized = normalizeStorefrontQuery(value).value;
  if (normalized.length < 2 || normalized.length > 120) throw new StorefrontEditorialPolicyError("INVALID_SYNONYM_TERM", "Synonym terms must be between 2 and 120 normalized characters.");
  return normalized;
}

/** Normalises static data only; it deliberately rejects regex, SQL, and executable rules. */
export function normaliseStorefrontSynonymTerms(input: readonly { input: string; outputs: readonly string[]; direction: StorefrontSynonymDirection }[]): StorefrontSynonymTerm[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 48) throw new StorefrontEditorialPolicyError("INVALID_SYNONYM_SET", "A synonym set must contain between 1 and 48 deterministic rules.");
  const seen = new Set<string>();
  return input.map((rule) => {
    if (!rule || (rule.direction !== "EQUIVALENT" && rule.direction !== "ONE_WAY") || !Array.isArray(rule.outputs) || rule.outputs.length < 1 || rule.outputs.length > 12) throw new StorefrontEditorialPolicyError("INVALID_SYNONYM_RULE", "Synonym rules must have a supported direction and bounded outputs.");
    const source = cleanTerm(rule.input);
    const outputs = [...new Set((rule.outputs as any[]).map((o: any) => cleanTerm(String(o))))].filter((value) => value !== source).sort((a: any, b: any) => String(a).localeCompare(String(b), "en-ZA"));
    if (!outputs.length) throw new StorefrontEditorialPolicyError("INVALID_SYNONYM_RULE", "A synonym rule must point to a distinct normalized term.");
    const key = `${rule.direction}:${source}`;
    if (seen.has(key)) throw new StorefrontEditorialPolicyError("DUPLICATE_SYNONYM_RULE", "A synonym source may occur once per direction.");
    seen.add(key);
    return Object.freeze({ input: source, outputs: Object.freeze(outputs), direction: rule.direction });
  }).sort((left, right) => `${left.direction}:${left.input}`.localeCompare(`${right.direction}:${right.input}`, "en-ZA"));
}

export function expandStorefrontSynonyms(query: string, terms: readonly StorefrontSynonymTerm[]): string[] {
  const normalized = normalizeStorefrontQuery(query).value;
  if (!normalized || /\b\d{8,}\b/.test(normalized)) return [normalized];
  const values = new Set<string>([normalized]);
  for (const rule of terms) {
    if (rule.input === normalized) rule.outputs.forEach((output) => values.add(output));
    if (rule.direction === "EQUIVALENT" && rule.outputs.includes(normalized)) values.add(rule.input);
  }
  return [...values].sort((left, right) => left.localeCompare(right, "en-ZA")).slice(0, 13);
}

export function publicStoreScheduleStatus(): "HOURS_UNAVAILABLE" { return "HOURS_UNAVAILABLE"; }
