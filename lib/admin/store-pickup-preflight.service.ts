import { prisma } from "@/lib/db/prisma";
import { selectStorePickupAddress } from "@/lib/marketplace-checkout/store-pickup-selection";
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
  const pickup = selectStorePickupAddress(store.id, store.defaultPickupAddress, store.savedAddresses);
  const evidence = describeStoreCollectionEvidence(pickup);
  const postalCodeValid = !evidence.missing.includes("Postal code missing");
  const mapCoordinatesValid = !evidence.missing.includes("Map coordinates missing");
  let area: "NOT_CHECKED" | "COVERED" | "UNVERIFIED" = "NOT_CHECKED";
  let pickupRegionName: string | null = null;
  let matchingServiceCount = 0;

  if (pickup && postalCodeValid && mapCoordinatesValid) {
    try {
      const verifiedCoordinates = await resolveVerifiedStorePickupCoordinates(pickup);
      const decision = verifiedCoordinates
        ? await checkDeliveryZone(verifiedCoordinates.latitude, verifiedCoordinates.longitude)
        : null;
      if (decision?.matched && decision.regionId && decision.withinMaxDistance === true) {
        area = "COVERED";
        pickupRegionName = decision.regionName;
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
      pickupConfigured: evidence.checkoutPickupConfigured,
      postalCodeValid,
      mapCoordinatesValid,
      area,
      matchingServiceCount,
    }),
    pickupRegionName,
    matchingServiceCount,
  };
}
