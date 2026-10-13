import { prisma } from "@/lib/db/prisma";

export const OWNER_GAUTENG_COVERAGE_APPROVAL = "OWNER_APPROVED_2026_10_14_ENTIRE_GAUTENG";
export const GAUTENG_PROVINCE_REGION_SLUG = "gauteng-province-wide";

/** One audited activation of the owner's explicit province-wide coverage choice. */
export async function activateOwnerApprovedGautengCoverage(actorUserId: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('owner-approved-gauteng-coverage'))`;
    const prior = await tx.deliveryRegion.findUnique({ where: { slug: GAUTENG_PROVINCE_REGION_SLUG } });
    if (prior) {
      if (prior.coverageMode !== "PROVINCE" || prior.province !== "Gauteng" || !prior.active || !prior.pricingEnabled || prior.maxDistanceKm !== null) {
        throw new Error("Existing Gauteng province coverage differs from the owner-approved scope; no automatic overwrite.");
      }
      return { regionId: prior.id, activated: false };
    }
    const region = await tx.deliveryRegion.create({ data: {
      name: "Gauteng province-wide", slug: GAUTENG_PROVINCE_REGION_SLUG,
      description: "Delivery coverage throughout Gauteng, including Johannesburg, Pretoria and surrounding areas. Route availability and service turnaround are confirmed when booking.",
      province: "Gauteng", coverageMode: "PROVINCE", active: true, pricingEnabled: true,
      centerLat: null, centerLng: null, coverageRadiusKm: null, maxDistanceKm: null,
      baseFee: null, highRiskSurcharge: null,
      notes: "Owner selected Entire Gauteng province on 14 October 2026 (owner local date). No city radius or additional delivery fee is implied.",
      displayOrder: 0,
    } });
    await tx.adminActivityLog.create({ data: {
      actorUserId, action: "CREATE", entityType: "DeliveryRegion", entityId: region.id,
      message: "Owner-approved activation of coverage throughout the entire Gauteng province.",
      metadata: { approvalReference: OWNER_GAUTENG_COVERAGE_APPROVAL, authorizedMaintenance: true, coverageMode: "PROVINCE", province: "Gauteng", boundaryAuthority: "server-geocoder-country-and-province", inventedRadius: false, tariffChanges: false },
    } });
    return { regionId: region.id, activated: true };
  });
}
