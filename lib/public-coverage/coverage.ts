import { listDeliveryRegions, type DeliveryRegionDto } from "@/lib/services/admin-regions.service";

export type PublicCoverageState = "ACTIVE_REGIONS" | "EMPTY_CONFIGURATION" | "SOURCE_UNAVAILABLE";

export type PublicCoverageSnapshot = {
  state: PublicCoverageState;
  regions: readonly DeliveryRegionDto[];
};

/** The public page is intentionally the only R7 presentation layer for active-region data. */
export async function getPublicCoverageSnapshot(): Promise<PublicCoverageSnapshot> {
  try {
    const regions = await listDeliveryRegions(true);
    return {
      state: regions.length ? "ACTIVE_REGIONS" : "EMPTY_CONFIGURATION",
      regions,
    };
  } catch {
    return { state: "SOURCE_UNAVAILABLE", regions: [] };
  }
}
