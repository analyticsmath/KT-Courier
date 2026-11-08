import { z } from "zod";
import seed from "./default-high-risk-areas.json";

const RiskAreaSchema = z.object({
  id: z.string().regex(/^(?:jhb|pta)-[a-z0-9-]{2,100}$/),
  municipality: z.enum(["JOHANNESBURG", "PRETORIA"]),
  name: z.string().trim().min(2).max(130),
  suburbs: z.array(z.string().trim().min(2).max(130)).min(1).max(12),
  cities: z.array(z.string().trim().min(2).max(130)).min(1).max(12),
  province: z.literal("Gauteng"),
  notes: z.string().trim().max(1000),
  active: z.boolean(),
}).strict();

export type HighRiskArea = z.infer<typeof RiskAreaSchema>;
export type MappedCashLocality = Readonly<{
  city?: string | null;
  suburb?: string | null;
  province?: string | null;
}>;

export function parseHighRiskAreas(raw: unknown): readonly HighRiskArea[] | null {
  const parsed = z.array(RiskAreaSchema).min(1).max(120).safeParse(raw);
  if (!parsed.success) return null;
  const ids = new Set<string>();
  for (const area of parsed.data) {
    if (ids.has(area.id)) return null;
    ids.add(area.id);
  }
  return Object.freeze(parsed.data.map(item => Object.freeze(item)));
}

/** Seeded from the client's list. These are textual area indicators, NOT
 * invented legal geofences; the admin can update each note and alias. */
export const INITIAL_HIGH_RISK_AREAS: readonly HighRiskArea[] = (() => {
  const parsed = parseHighRiskAreas(seed);
  if (!parsed) throw new Error("Invalid original high-risk area inventory.");
  return parsed;
})();

const normalize = (value: string | null | undefined) => (value ?? "")
  .normalize("NFKC").toLocaleLowerCase("en-ZA")
  .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

// A provider may only know the broad district and not which named extension.
// In that case exclude physical cash until collection/dropoff is verified.
const AMBIGUOUS_PARENT_DISTRICTS = new Set([
  "soshanguve", "mabopane", "rosslyn", "ga rankuwa",
  "mamelodi", "soweto",
]);

export type HighRiskAreaResult = Readonly<{
  matchedAreaIds: readonly string[];
  restrictCash: boolean;
  reviewRequired: boolean;
}>;

/** Exact named neighbourhood and matching city: never approximate a polygon
 * by substring, and never make all Gauteng high-risk.
 */
export function evaluateLocalityCashRisk(
  pickup: MappedCashLocality | null | undefined,
  dropoff: MappedCashLocality | null | undefined,
  areas: readonly HighRiskArea[],
): HighRiskAreaResult {
  const matched = new Set<string>();
  let reviewRequired = false;
  for (const point of [pickup, dropoff]) {
    if (!point || !point.city?.trim() || !point.suburb?.trim() || !point.province?.trim()) {
      reviewRequired = true;
      continue;
    }
    const province = normalize(point.province);
    // Cash locality rules are only asserted for active service provinces.
    if (province !== "gauteng") {
      reviewRequired = true;
      continue;
    }
    const city = normalize(point.city), suburb = normalize(point.suburb);
    const found = areas.filter(a => a.active
      && a.suburbs.some(value => normalize(value) === suburb)
      && a.cities.some(value => normalize(value) === city));
    for (const area of found) matched.add(area.id);
    if (!found.length && AMBIGUOUS_PARENT_DISTRICTS.has(suburb)) reviewRequired = true;
  }
  return Object.freeze({
    matchedAreaIds: Object.freeze([...matched].sort()),
    restrictCash: matched.size > 0 || reviewRequired,
    reviewRequired,
  });
}

export function hasHighRiskCashAreaSnapshot(evidence: unknown): boolean {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return false;
  const record = evidence as Record<string, unknown>;
  if ("highRiskAreaReviewRequired" in record && typeof record.highRiskAreaReviewRequired !== "boolean") return true;
  if (record.highRiskAreaReviewRequired === true) return true;
  if ("highRiskAreaIdsAtDecision" in record) {
    const ids = record.highRiskAreaIdsAtDecision;
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string" || !id.trim())) return true;
    return ids.length > 0;
  }
  return false;
}
