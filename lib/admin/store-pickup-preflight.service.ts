import { prisma } from "@/lib/db/prisma";
import { selectStorePickupCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";
import { describeStoreCollectionEvidence } from "@/lib/admin/store-pickup-readiness";
import { evaluateStorePickupPreflight } from "@/lib/admin/store-operational-preflight";
import { checkDeliveryZone } from "@/lib/maps/delivery-zone.service";
import type { DeliveryZoneCheckResult } from "@/lib/maps/google-maps.types";
import { deliveryCatalog } from "@/lib/client-platform/delivery.service";
import {
  resolveVerifiedStorePickupCoordinates,
  type StorePickupCoordinateResolver,
} from "@/lib/marketplace-checkout/verified-store-pickup-coordinates";
import { isActiveDeliveryServiceForPickup } from "./store-service-matching";

export type StorePickupPreflightOptions = Readonly<{
  coordinateResolver?: StorePickupCoordinateResolver;
  zoneChecker?: (lat: number, lng: number) => Promise<DeliveryZoneCheckResult>;
  serviceCatalogLoader?: () => Promise<
    ReadonlyArray<{
      id: string;
      version: number;
      active: boolean;
      provinces: readonly string[];
      regionIds: readonly string[];
    }>
  >;
}>;

/**
 * This read-only operation does not modify store status, persist geocoding
 * results, create a quote, approve a seller, or make a customer payment.
 */
export async function getStorePickupOperationalPreflight(
  storeId: string,
  options?: StorePickupPreflightOptions,
) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      status: true,
      contactEmail: true,
      contactPhone: true,
      operatingHours: true,
      defaultPickupAddress: true,
      savedAddresses: { where: { type: "PICKUP" } },
      checkoutCertification: {
        select: {
          status: true,
          expiresAt: true,
          approvedAt: true,
          approvedByUserId: true,
          preparedByUserId: true,
          pickupAddressId: true,
          coverageRegionId: true,
          serviceSignature: true,
          routeEvidenceDigest: true,
          checkoutEvidenceDigest: true,
          engineProofDigest: true,
        },
      },
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
  let matchingServiceVersions: string[] = [];

  if (pickup && evidence.checkoutPickupConfigured) {
    try {
      const verifiedCoordinates = await resolveVerifiedStorePickupCoordinates(
        pickup,
        options?.coordinateResolver,
      );
      const checkZone = options?.zoneChecker ?? checkDeliveryZone;
      const decision = verifiedCoordinates
        ? await checkZone(verifiedCoordinates.latitude, verifiedCoordinates.longitude)
        : null;
      if (decision?.matched && decision.regionId && decision.withinMaxDistance === true) {
        area = "COVERED";
        pickupRegionName = decision.regionName;
        pickupRegionId = decision.regionId ?? null;
        const loadServices = options?.serviceCatalogLoader ?? deliveryCatalog;
        const services = await loadServices();
        const matching = services.filter(
          service => isActiveDeliveryServiceForPickup(service, pickup.province, decision.regionId!),
        );
        matchingServiceCount = matching.length;
        matchingServiceVersions = matching.map(service => service.id + ":" + service.version).sort();
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

  const now = new Date();
  const cert = store.checkoutCertification;
  const certApproved = Boolean(
    cert &&
      cert.status === "APPROVED" &&
      cert.approvedAt &&
      cert.approvedByUserId &&
      cert.approvedByUserId !== cert.preparedByUserId &&
      cert.expiresAt > now &&
      (!pickup?.id || cert.pickupAddressId === pickup.id) &&
      (!pickupRegionId || cert.coverageRegionId === pickupRegionId) &&
      /^[a-f0-9]{64}$/.test(cert.routeEvidenceDigest ?? "") &&
      /^[a-f0-9]{64}$/.test(cert.checkoutEvidenceDigest ?? ""),
  );
  const routeVerifiedFromCert = Boolean(
    area === "COVERED" &&
      matchingServiceCount > 0 &&
      cert &&
      certApproved &&
      /^[a-f0-9]{64}$/.test(cert.routeEvidenceDigest ?? ""),
  );

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
      operatingHours: store.operatingHours,
      routeVerified: routeVerifiedFromCert,
      checkoutCertified: certApproved,
      independentHoursReviewRecorded: certApproved,
    }),
    pickupRegionName,
    pickupRegionId,
    matchingServiceCount,
    matchingServiceVersions,
  };
}
