import { prisma } from "@/lib/db/prisma";
import { selectStorePickupCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";
import { describeStoreCollectionEvidence } from "@/lib/admin/store-pickup-readiness";
import { evaluateStorePickupPreflight } from "@/lib/admin/store-operational-preflight";
import { checkDeliveryZone } from "@/lib/maps/delivery-zone.service";
import { deliveryCatalog } from "@/lib/client-platform/delivery.service";
import { resolveVerifiedStorePickupCoordinates } from "@/lib/marketplace-checkout/verified-store-pickup-coordinates";

/**
 * This read-only operation does not modify store status, persist geocoding
 * results, create a quote, approve a seller, or make a customer payment.
 */
export async function getStorePickupOperationalPreflight(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      status: true,
      contactEmail: true,
      contactPhone: true,
      defaultPickupAddress: true,
      savedAddresses: { where: { type: "PICKUP" } },
    },
  });
  if (!store) return null;
  const pickup = selectStorePickupCandidate(store.id, store.defaultPickupAddress, store.savedAddresses);
  const evidence = describeStoreCollectionEvidence(pickup);
  const suburbValid = !evidence.missing.includes("Suburb / area missing");
  const postalCodeValid = !evidence.missing.includes("Postal code missing");
  const mapCoordinatesValid = !evidence.missing.includes("Map coordinates missing");
  let area: "NOT_CHECKED" | "COVERED" | "UNVERIFIED" = "NOT_CHECKED";
  let pickupRegionName: string | null = null;
  let pickupRegionId: string | null = null;
  let matchingServiceCount = 0;

  if (pickup && evidence.checkoutPickupConfigured) {
    try {
      const verifiedCoordinates = await resolveVerifiedStorePickupCoordinates(pickup);
      const decision = verifiedCoordinates
        ? await checkDeliveryZone(verifiedCoordinates.latitude, verifiedCoordinates.longitude)
        : null;
      if (decision?.matched && decision.regionId && decision.withinMaxDistance === true) {
        area = "COVERED";
        pickupRegionName = decision.regionName;
        pickupRegionId = decision.regionId;
        const services = await deliveryCatalog();
        matchingServiceCount = services.filter(
          service => service.active
            && service.provinces.some(province => province === pickup.province)
            && (!service.regionIds.length || service.regionIds.includes(decision.regionId!)),
        ).length;
      } else {
        area = "UNVERIFIED";
      }
    } catch {
      // Configuration/provider outage is not proof of coverage.
      area = "UNVERIFIED";
      pickupRegionName = null;
      matchingServiceCount = 0;
    }
  }

  return {
    storeId,
    accountStatus: store.status,
    ...evaluateStorePickupPreflight({
      status: store.status,
      hasContact: Boolean(store.contactEmail?.trim() || store.contactPhone?.trim()),
      pickupConfigured: Boolean(pickup) && !evidence.missing.some(item => ["Street address missing", "City missing", "Province missing", "Country not supported"].includes(item)),
      suburbValid,
      postalCodeValid,
      mapCoordinatesValid,
      area,
      matchingServiceCount,
    }),
    pickupRegionName,
    pickupRegionId,
    matchingServiceCount,
  };
}
