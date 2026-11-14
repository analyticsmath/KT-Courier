import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { selectStorePickupCandidate, type StorePickupAddressCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";
import { describeStoreCollectionEvidence } from "@/lib/admin/store-pickup-readiness";
import {
  evaluateCheckoutCapabilityPreflight,
  type CheckoutCapabilityBlockerCode,
  type IndependentReviewerStatus,
} from "@/lib/admin/store-operational-preflight";
import { getStoreCommissionReadiness, type StoreCommissionReadiness } from "@/lib/admin/store-commission-readiness";
import { isActiveDeliveryServiceForPickup } from "@/lib/admin/store-service-matching";
import {
  isStoreOperationalPolicyEffective,
  isStoreSellerIdentityEffective,
} from "@/lib/storefront/store-publication-readiness";
import {
  resolveVerifiedStorePickupCoordinates,
  type StorePickupCoordinateResolver,
} from "@/lib/marketplace-checkout/verified-store-pickup-coordinates";
import { checkDeliveryZone } from "@/lib/maps/delivery-zone.service";
import { calculateRoute } from "@/lib/maps/routes.service";
import type { DeliveryZoneCheckResult, RouteCalculationResult } from "@/lib/maps/google-maps.types";
import { deliveryCatalog } from "@/lib/client-platform/delivery.service";
import { createProductionPaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { getStorePickupOperationalPreflight } from "./store-pickup-preflight.service";

export class StoreCertificationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly blockers: readonly string[] = [],
  ) {
    super(message);
    this.name = "StoreCertificationError";
  }
}

export type CheckoutCertificationEvidence = Readonly<{
  routeEvidenceReference: string;
  routeEvidenceDigest: string;
  checkoutEvidenceReference: string;
  checkoutEvidenceDigest: string;
  reviewNote: string;
}>;

export type StoreCertificationFacts = Readonly<{
  storeId: string;
  pickupAddressId: string;
  pickupFingerprint: string;
  coverageRegionId: string;
  serviceSignature: string;
}>;

export function pickupCertificationFingerprint(pickup: StorePickupAddressCandidate): string {
  if (!pickup.id || !pickup.storeId || pickup.type !== "PICKUP" ||
      pickup.latitude == null || pickup.longitude == null) {
    throw new StoreCertificationError("PICKUP_UNVERIFIED", "A mapped, saved pickup address is required.");
  }
  const normalize = (value: string | null | undefined) =>
    (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-ZA");
  const lat = Number(pickup.latitude);
  const lng = Number(pickup.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
      (lat === 0 && lng === 0)) {
    throw new StoreCertificationError("PICKUP_UNVERIFIED", "The saved map point is invalid.");
  }
  return createHash("sha256").update(JSON.stringify({
    storeId: pickup.storeId, addressId: pickup.id,
    street: normalize(pickup.line1), suburb: normalize(pickup.line2),
    city: normalize(pickup.city), province: normalize(pickup.province),
    postcode: normalize(pickup.postalCode), country: normalize(pickup.country),
    lat: lat.toFixed(7), lng: lng.toFixed(7), placeId: normalize(pickup.placeId),
  })).digest("hex");
}

async function lockedStorePickup(tx: Prisma.TransactionClient, storeId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`);
  const store = await tx.store.findUnique({
    where: { id: storeId },
    select: { status: true, defaultPickupAddress: true, savedAddresses: { where: { type: "PICKUP" } } },
  });
  if (!store) throw new StoreCertificationError("STORE_NOT_FOUND", "Store not found.");
  const pickup = selectStorePickupCandidate(storeId, store.defaultPickupAddress, store.savedAddresses);
  if (!pickup?.id) throw new StoreCertificationError("PICKUP_UNVERIFIED", "Save a mapped collection address first.");
  return { store, pickup, fingerprint: pickupCertificationFingerprint(pickup) };
}

export async function currentStoreCertificationFacts(storeId: string): Promise<StoreCertificationFacts> {
  const readiness = await getStorePickupOperationalPreflight(storeId);
  if (!readiness || readiness.blockers.length || !readiness.pickupRegionId ||
      !readiness.matchingServiceVersions.length) {
    throw new StoreCertificationError("STORE_SERVICE_NOT_READY",
      "Verify the store pickup point, covered region and active courier service before certification.");
  }
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { defaultPickupAddress: true, savedAddresses: { where: { type: "PICKUP" } } },
  });
  if (!store) throw new StoreCertificationError("STORE_NOT_FOUND", "Store not found.");
  const pickup = selectStorePickupCandidate(storeId, store.defaultPickupAddress, store.savedAddresses);
  if (!pickup?.id) throw new StoreCertificationError("PICKUP_UNVERIFIED", "Store pickup not found.");
  return {
    storeId, pickupAddressId: pickup.id, pickupFingerprint: pickupCertificationFingerprint(pickup),
    coverageRegionId: readiness.pickupRegionId,
    serviceSignature: createHash("sha256").update(JSON.stringify(readiness.matchingServiceVersions)).digest("hex"),
  };
}

export function certificationMatchesFacts(
  cert: Readonly<{ pickupAddressId: string; pickupFingerprint: string; coverageRegionId: string; serviceSignature: string }>,
  facts: StoreCertificationFacts,
): boolean {
  return cert.pickupAddressId === facts.pickupAddressId &&
    cert.pickupFingerprint === facts.pickupFingerprint &&
    cert.coverageRegionId === facts.coverageRegionId &&
    cert.serviceSignature === facts.serviceSignature;
}

function checkEvidence(e: CheckoutCertificationEvidence) {
  for (const value of [e.routeEvidenceReference, e.checkoutEvidenceReference]) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{11,159}$/.test(value)) {
      throw new StoreCertificationError("CERTIFICATION_REFERENCE_INVALID",
        "Record the authentic staging route and paid checkout receipt references.");
    }
  }
  for (const value of [e.routeEvidenceDigest, e.checkoutEvidenceDigest]) {
    if (!/^[a-f0-9]{64}$/.test(value)) {
      throw new StoreCertificationError("CERTIFICATION_DIGEST_INVALID",
        "Each receipt requires its SHA-256 evidence digest.");
    }
  }
  if (e.reviewNote.trim().length < 24 || e.reviewNote.length > 2000) {
    throw new StoreCertificationError("CERTIFICATION_NOTE_REQUIRED",
      "Document the route, test checkout, order and test environment.");
  }
}

/** Preparation records external staging evidence but does not prove payment or go Live. */
export async function prepareStoreCheckoutCertification(
  storeId: string, preparerId: string, evidence: CheckoutCertificationEvidence,
) {
  checkEvidence(evidence);
  const facts = await currentStoreCertificationFacts(storeId);
  return prisma.$transaction(async tx => {
    const { store, pickup, fingerprint } = await lockedStorePickup(tx, storeId);
    // Existing ACTIVE stores imported before certification was introduced need
    // the same recovery path as new applicants. They remain hidden until the
    // certificate is independently approved and publication is rebuilt.
    if ((store.status !== "PENDING" && store.status !== "ACTIVE") || pickup.id !== facts.pickupAddressId ||
        fingerprint !== facts.pickupFingerprint) {
      throw new StoreCertificationError("STORE_PICKUP_CHANGED", "Store or pickup changed; repeat staging checks.");
    }
    const prior = await tx.storeCheckoutCertification.findUnique({ where: { storeId } });
    // A current approved certificate must not be overwritten. Expired or
    // pre-digest legacy certificates require a fresh, independent two-person
    // review; otherwise an old approval would permanently block recovery.
    if (prior?.status === "APPROVED"
        && prior.expiresAt > new Date()
        && /^[a-f0-9]{64}$/.test(prior.routeEvidenceDigest ?? "")
        && /^[a-f0-9]{64}$/.test(prior.checkoutEvidenceDigest ?? "")) {
      throw new StoreCertificationError("CERTIFICATION_ALREADY_APPROVED", "A current approved certification must first be revoked.");
    }
    const expiresAt = new Date(Date.now() + 30 * 86400_000);
    const cert = await tx.storeCheckoutCertification.upsert({
      where: { storeId },
      create: {
        storeId, pickupAddressId: facts.pickupAddressId, pickupFingerprint: facts.pickupFingerprint,
        coverageRegionId: facts.coverageRegionId, serviceSignature: facts.serviceSignature,
        routeEvidenceReference: evidence.routeEvidenceReference,
        routeEvidenceDigest: evidence.routeEvidenceDigest,
        checkoutEvidenceReference: evidence.checkoutEvidenceReference,
        checkoutEvidenceDigest: evidence.checkoutEvidenceDigest,
        preparedByUserId: preparerId, status: "PENDING_REVIEW", expiresAt,
        reviewNote: evidence.reviewNote,
      },
      update: {
        pickupAddressId: facts.pickupAddressId, pickupFingerprint: facts.pickupFingerprint,
        coverageRegionId: facts.coverageRegionId, serviceSignature: facts.serviceSignature,
        routeEvidenceReference: evidence.routeEvidenceReference,
        routeEvidenceDigest: evidence.routeEvidenceDigest,
        checkoutEvidenceReference: evidence.checkoutEvidenceReference,
        checkoutEvidenceDigest: evidence.checkoutEvidenceDigest,
        preparedByUserId: preparerId, approvedByUserId: null, approvedAt: null,
        status: "PENDING_REVIEW", expiresAt, reviewNote: evidence.reviewNote,
        revision: { increment: 1 },
      },
    });
    await tx.adminActivityLog.create({ data: {
      actorUserId: preparerId, action: "UPDATE", entityType: "Store", entityId: storeId,
      message: "Store staging checkout evidence submitted for independent review",
      metadata: { certificateId: cert.id, pickupFingerprint: cert.pickupFingerprint,
        routeReference: evidence.routeEvidenceReference, routeDigest: evidence.routeEvidenceDigest,
        checkoutReference: evidence.checkoutEvidenceReference, checkoutDigest: evidence.checkoutEvidenceDigest },
    } });
    return { status: cert.status, revision: cert.revision, expiresAt: cert.expiresAt };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** A distinct admin must review receipt provenance before granting go-Live authority. */
export async function approveStoreCheckoutCertification(
  storeId: string, approvingAdminId: string, expectedRevision: number,
) {
  const facts = await currentStoreCertificationFacts(storeId);
  // Lazy import avoids the publication-readiness service's fingerprint import
  // forming an initialization cycle with this module.
  const { rebuildStorefrontStoreDocument } = await import("@/lib/services/storefront-store.service");
  return prisma.$transaction(async tx => {
    const { store, pickup, fingerprint } = await lockedStorePickup(tx, storeId);
    if ((store.status !== "PENDING" && store.status !== "ACTIVE") || pickup.id !== facts.pickupAddressId ||
        fingerprint !== facts.pickupFingerprint) {
      throw new StoreCertificationError("STORE_PICKUP_CHANGED", "The store or pickup changed during review.");
    }
    const cert = await tx.storeCheckoutCertification.findUnique({ where: { storeId } });
    if (!cert || cert.status !== "PENDING_REVIEW" || cert.revision !== expectedRevision) {
      throw new StoreCertificationError("CERTIFICATION_VERSION_CONFLICT", "Reload the current certification.");
    }
    if (cert.preparedByUserId === approvingAdminId) {
      throw new StoreCertificationError("INDEPENDENT_REVIEWER_REQUIRED",
        "The person submitting checkout evidence cannot approve it.");
    }
    if (cert.expiresAt <= new Date() ||
        !/^[a-f0-9]{64}$/.test(cert.routeEvidenceDigest ?? "") ||
        !/^[a-f0-9]{64}$/.test(cert.checkoutEvidenceDigest ?? "") ||
        !certificationMatchesFacts(cert, facts)) {
      throw new StoreCertificationError("CERTIFICATION_STALE", "Pickup, courier service or region changed.");
    }
    const updated = await tx.storeCheckoutCertification.update({
      where: { id: cert.id },
      data: { status: "APPROVED", approvedByUserId: approvingAdminId,
        approvedAt: new Date(), revision: { increment: 1 } },
    });
    // A legacy active store may already have an INELIGIBLE projection. Make
    // approval and its recalculated visibility atomic; pending stores remain
    // ineligible until a separate activation.
    await rebuildStorefrontStoreDocument(storeId, tx);
    await tx.adminActivityLog.create({ data: {
      actorUserId: approvingAdminId, action: "UPDATE", entityType: "Store", entityId: storeId,
      message: "Independent store staging route and paid-checkout evidence approved",
      metadata: { certificateId: cert.id, revision: updated.revision, preparerId: cert.preparedByUserId },
    } });
    return { status: updated.status, revision: updated.revision, expiresAt: updated.expiresAt };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Must be called after locking the Store row in the SAME activation transaction. */
export async function requireCurrentStoreCheckoutCertification(
  tx: Prisma.TransactionClient, storeId: string, facts: StoreCertificationFacts,
) {
  const { pickup, fingerprint } = await lockedStorePickup(tx, storeId);
  const cert = await tx.storeCheckoutCertification.findUnique({ where: { storeId } });
  if (!cert || cert.status !== "APPROVED" ||
      !cert.approvedAt || !cert.approvedByUserId ||
      cert.approvedByUserId === cert.preparedByUserId ||
      cert.expiresAt <= new Date() ||
      !/^[a-f0-9]{64}$/.test(cert.routeEvidenceDigest ?? "") ||
      !/^[a-f0-9]{64}$/.test(cert.checkoutEvidenceDigest ?? "") ||
      pickup.id !== facts.pickupAddressId ||
      fingerprint !== facts.pickupFingerprint || !certificationMatchesFacts(cert, facts)) {
    throw new StoreCertificationError("CHECKOUT_CERTIFICATION_REQUIRED",
      "Independent current staging route and paid-checkout certification is required before Live.");
  }
}

export type CheckoutCapabilityPreflightOptions = Readonly<{
  coordinateResolver?: StorePickupCoordinateResolver;
  zoneChecker?: (lat: number, lng: number) => Promise<DeliveryZoneCheckResult>;
  routeCalculator?: (
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
  ) => Promise<RouteCalculationResult>;
  serviceCatalogLoader?: () => Promise<
    ReadonlyArray<{
      readonly id: string;
      readonly version: number;
      readonly active: boolean;
      readonly provinces: readonly string[];
      readonly regionIds: readonly string[];
    }>
  >;
  commissionChecker?: (storeId: string, now: Date) => Promise<StoreCommissionReadiness>;
  paymentProviderReadiness?: ReadonlyArray<{
    code: string;
    configured: boolean;
    active: boolean;
    environment: string;
    errorCategory: string;
  }>;
  now?: Date;
}>;

export type CheckoutCapabilityPreflight = Readonly<{
  storeId: string;
  accountStatus: string;
  preflightReady: boolean;
  liveReady: boolean;
  capabilityBlockers: readonly CheckoutCapabilityBlockerCode[];
  blockers: readonly CheckoutCapabilityBlockerCode[];
  blockerMessages: Readonly<Record<string, string>>;
  independentReviewerStatus: IndependentReviewerStatus;
  pickupAddressId: string | null;
  pickupFingerprint: string | null;
  coverageRegionId: string | null;
  coverageRegionName: string | null;
  matchingServiceVersions: readonly string[];
  serviceSignature: string | null;
  routeFeasibility: Readonly<{
    verified: boolean;
    provider: string | null;
    distanceMeters: number | null;
    durationSeconds: number | null;
  }>;
  policySummary: Readonly<{
    sellerIdentityApproved: boolean;
    sellerIdentityReference: string | null;
    sellerIdentityVersion: string | null;
    operationalPolicyActive: boolean;
    operationalPolicyReference: string | null;
    commissionPlanReady: boolean;
    commissionPlanReference: string | null;
    parcelProfilesActive: boolean;
    paymentProviderReady: boolean;
    paymentProviderEnvironment: string | null;
  }>;
  generatedEvidence: CheckoutCertificationEvidence | null;
}>;

/**
 * Canonical non-mutating CheckoutCapabilityPreflight generated against current
 * configuration without initiating live charges, orders, or inventory mutations.
 */
export async function evaluateStoreCheckoutCapabilityPreflight(
  storeId: string,
  options?: CheckoutCapabilityPreflightOptions,
): Promise<CheckoutCapabilityPreflight | null> {
  const now = options?.now ?? new Date();
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      status: true,
      contactEmail: true,
      contactPhone: true,
      defaultPickupAddress: true,
      savedAddresses: { where: { type: "PICKUP" } },
      checkoutCertification: true,
    },
  });
  if (!store) return null;

  const pickup = selectStorePickupCandidate(
    store.id,
    store.defaultPickupAddress,
    store.savedAddresses,
  );
  const collectionEvidence = describeStoreCollectionEvidence(pickup);

  const streetValid =
    Boolean(pickup) &&
    !collectionEvidence.missing.some((item) =>
      [
        "Saved collection address missing",
        "Street address missing",
        "City missing",
        "Province missing",
        "Country not supported",
      ].includes(item),
    );
  const suburbValid =
    Boolean(pickup) && !collectionEvidence.missing.includes("Suburb / area missing");
  const postalCodeValid =
    Boolean(pickup) && !collectionEvidence.missing.includes("Postal code missing");
  const mapCoordinatesPresent =
    Boolean(pickup) && !collectionEvidence.missing.includes("Map coordinates missing");

  let pickupFingerprint: string | null = null;
  if (pickup && streetValid && suburbValid && postalCodeValid && mapCoordinatesPresent) {
    try {
      pickupFingerprint = pickupCertificationFingerprint(pickup);
    } catch {
      pickupFingerprint = null;
    }
  }

  let mapProofValid = false;
  let coverageActive = false;
  let coverageRegionId: string | null = null;
  let coverageRegionName: string | null = null;
  let matchingServiceVersions: string[] = [];
  let serviceSignature: string | null = null;
  let routeVerified = false;
  let routeProvider: string | null = null;
  let routeDistanceMeters: number | null = null;
  let routeDurationSeconds: number | null = null;

  if (pickup && streetValid && suburbValid && postalCodeValid && mapCoordinatesPresent) {
    try {
      const verifiedCoordinates = await resolveVerifiedStorePickupCoordinates(
        pickup,
        options?.coordinateResolver,
      );
      if (verifiedCoordinates) {
        mapProofValid = true;
        const zoneChecker = options?.zoneChecker ?? checkDeliveryZone;
        const decision = await zoneChecker(
          verifiedCoordinates.latitude,
          verifiedCoordinates.longitude,
        );
        if (decision?.matched && decision.regionId && decision.withinMaxDistance === true) {
          coverageActive = true;
          coverageRegionId = decision.regionId;
          coverageRegionName = decision.regionName ?? null;

          const serviceLoader = options?.serviceCatalogLoader ?? deliveryCatalog;
          const services = await serviceLoader();
          const matching = services.filter((service) =>
            isActiveDeliveryServiceForPickup(service, pickup.province, decision.regionId!),
          );
          matchingServiceVersions = matching
            .map((service) => `${service.id}:${service.version}`)
            .sort();
          if (matchingServiceVersions.length > 0) {
            serviceSignature = createHash("sha256")
              .update(JSON.stringify(matchingServiceVersions))
              .digest("hex");
          }

          const regionRow = prisma.deliveryRegion?.findUnique
            ? await prisma.deliveryRegion.findUnique({
                where: { id: decision.regionId },
                select: { centerLat: true, centerLng: true, maxDistanceKm: true },
              })
            : null;
          let repLat = verifiedCoordinates.latitude + 0.005;
          let repLng = verifiedCoordinates.longitude + 0.005;
          if (regionRow?.centerLat != null && regionRow?.centerLng != null) {
            const cLat = Number(regionRow.centerLat);
            const cLng = Number(regionRow.centerLng);
            if (
              Number.isFinite(cLat) &&
              Number.isFinite(cLng) &&
              (Math.abs(cLat - verifiedCoordinates.latitude) >= 0.0001 ||
                Math.abs(cLng - verifiedCoordinates.longitude) >= 0.0001)
            ) {
              repLat = cLat;
              repLng = cLng;
            }
          }

          const routeCalc = options?.routeCalculator ?? calculateRoute;
          const routeRes = await routeCalc(
            verifiedCoordinates.latitude,
            verifiedCoordinates.longitude,
            repLat,
            repLng,
          );
          const maxMeters =
            regionRow?.maxDistanceKm != null
              ? Number(regionRow.maxDistanceKm) * 1000
              : null;
          if (
            routeRes.ok &&
            routeRes.route.distanceMeters > 0 &&
            (maxMeters === null ||
              !Number.isFinite(maxMeters) ||
              routeRes.route.distanceMeters <= maxMeters)
          ) {
            routeVerified = true;
            routeProvider = routeRes.route.provider;
            routeDistanceMeters = routeRes.route.distanceMeters;
            routeDurationSeconds = routeRes.route.durationSeconds;
          }
        }
      }
    } catch {
      // Provider error fails closed without mutating state.
    }
  }

  const db = prisma as unknown as Partial<typeof prisma>;
  const [sellerIdentity, operationalPolicy, commissionReadiness, activeParcelProfiles] =
    await Promise.all([
      db.storeSellerLegalIdentity
        ? db.storeSellerLegalIdentity.findFirst({
            where: {
              storeId: store.id,
              status: "APPROVED",
              effectiveFrom: { lte: now },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
            },
            orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
            select: {
              publicReference: true,
              identityVersion: true,
              status: true,
              effectiveFrom: true,
              effectiveUntil: true,
            },
          })
        : Promise.resolve(null),
      db.storeOrderOperationalPolicy
        ? db.storeOrderOperationalPolicy.findFirst({
            where: {
              status: "ACTIVE",
              effectiveFrom: { lte: now },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
            },
            orderBy: [{ effectiveFrom: "desc" }, { versionNumber: "desc" }],
            select: {
              publicReference: true,
              status: true,
              effectiveFrom: true,
              effectiveUntil: true,
            },
          })
        : Promise.resolve(null),
      options?.commissionChecker
        ? options.commissionChecker(store.id, now)
        : db.commissionPlan
          ? getStoreCommissionReadiness(store.id, prisma, now)
          : Promise.resolve({
              ready: false,
              status: "MISSING" as const,
              planId: null,
              planReference: null,
            }),
      db.parcelProfileVersion
        ? db.parcelProfileVersion.count({
            where: {
              status: "ACTIVE",
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
            },
          })
        : Promise.resolve(1),
    ]);

  const sellerApproved = isStoreSellerIdentityEffective(sellerIdentity, now);
  const operationalPolicyActive = isStoreOperationalPolicyEffective(operationalPolicy, now);
  const parcelProfilesActive = activeParcelProfiles > 0;
  const serviceActive = matchingServiceVersions.length > 0 && parcelProfilesActive;
  const policyActive = operationalPolicyActive && commissionReadiness.ready;

  const providerList =
    options?.paymentProviderReadiness ??
    createProductionPaymentProviderRegistry().readiness();
  const paystackState = providerList.find((item) => item.code === "PAYSTACK") ?? null;
  const paymentProviderReady = Boolean(
    paystackState?.configured && paystackState.errorCategory === "NONE",
  );

  const cert = store.checkoutCertification;
  const currentFactsMatchCert = Boolean(
    cert &&
      pickup?.id &&
      pickupFingerprint &&
      coverageRegionId &&
      serviceSignature &&
      certificationMatchesFacts(cert, {
        storeId: store.id,
        pickupAddressId: pickup.id,
        pickupFingerprint,
        coverageRegionId,
        serviceSignature,
      }),
  );

  let independentReviewerStatus: IndependentReviewerStatus = "NOT_PREPARED";
  let certificationStale = false;
  if (cert) {
    if (cert.status === "REVOKED") {
      independentReviewerStatus = "REVOKED";
      certificationStale = true;
    } else if (cert.status === "PENDING_REVIEW") {
      if (cert.expiresAt <= now || !currentFactsMatchCert) {
        independentReviewerStatus = "STALE_OR_EXPIRED";
        certificationStale = true;
      } else {
        independentReviewerStatus = "PENDING_INDEPENDENT_REVIEW";
      }
    } else if (cert.status === "APPROVED") {
      if (!cert.approvedByUserId || cert.approvedByUserId === cert.preparedByUserId) {
        independentReviewerStatus = "SELF_APPROVAL_BLOCKED";
        certificationStale = true;
      } else if (
        !cert.approvedAt ||
        cert.expiresAt <= now ||
        !/^[a-f0-9]{64}$/.test(cert.routeEvidenceDigest ?? "") ||
        !/^[a-f0-9]{64}$/.test(cert.checkoutEvidenceDigest ?? "") ||
        !currentFactsMatchCert ||
        !sellerApproved ||
        !policyActive
      ) {
        independentReviewerStatus = "STALE_OR_EXPIRED";
        certificationStale = true;
      } else {
        independentReviewerStatus = "APPROVED_CURRENT";
      }
    }
  }

  const evaluation = evaluateCheckoutCapabilityPreflight({
    streetValid,
    suburbValid,
    postalCodeValid,
    mapProofValid,
    sellerApproved,
    coverageActive,
    routeVerified,
    serviceActive,
    policyActive,
    paymentProviderReady,
    certificationStale,
    independentReviewerStatus,
  });

  let generatedEvidence: CheckoutCertificationEvidence | null = null;
  if (
    evaluation.preflightReady &&
    pickup?.id &&
    pickupFingerprint &&
    coverageRegionId &&
    serviceSignature
  ) {
    const routeEvidenceDigest = createHash("sha256")
      .update(
        JSON.stringify({
          schema: "KT_STORE_ROUTE_PREFLIGHT_V1",
          storeId: store.id,
          pickupAddressId: pickup.id,
          pickupFingerprint,
          coverageRegionId,
          serviceSignature,
          routeProvider,
          routeDistanceMeters,
        }),
      )
      .digest("hex");
    const checkoutEvidenceDigest = createHash("sha256")
      .update(
        JSON.stringify({
          schema: "KT_STORE_CHECKOUT_CAPABILITY_PREFLIGHT_V1",
          storeId: store.id,
          pickupAddressId: pickup.id,
          pickupFingerprint,
          coverageRegionId,
          serviceSignature,
          sellerIdentityReference: sellerIdentity?.publicReference ?? null,
          sellerIdentityVersion: sellerIdentity?.identityVersion ?? null,
          operationalPolicyReference: operationalPolicy?.publicReference ?? null,
          commissionPlanReference: commissionReadiness.planReference,
          paymentProviderEnvironment: paystackState?.environment ?? null,
        }),
      )
      .digest("hex");
    const cleanStoreToken = store.id.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 24) || "store";
    generatedEvidence = Object.freeze({
      routeEvidenceReference: `preflight-route:${cleanStoreToken}:${routeEvidenceDigest.slice(0, 24)}`,
      routeEvidenceDigest,
      checkoutEvidenceReference: `preflight-checkout:${cleanStoreToken}:${checkoutEvidenceDigest.slice(0, 24)}`,
      checkoutEvidenceDigest,
      reviewNote: `Deterministic non-mutating CheckoutCapabilityPreflight verified for region ${coverageRegionName ?? coverageRegionId} and active services (${matchingServiceVersions.join(", ")}).`,
    });
  }

  return Object.freeze({
    storeId: store.id,
    accountStatus: store.status,
    preflightReady: evaluation.preflightReady,
    liveReady: evaluation.liveReady,
    capabilityBlockers: evaluation.capabilityBlockers,
    blockers: evaluation.blockers,
    blockerMessages: evaluation.blockerMessages,
    independentReviewerStatus: evaluation.independentReviewerStatus,
    pickupAddressId: pickup?.id ?? null,
    pickupFingerprint,
    coverageRegionId,
    coverageRegionName,
    matchingServiceVersions: Object.freeze(matchingServiceVersions),
    serviceSignature,
    routeFeasibility: Object.freeze({
      verified: routeVerified,
      provider: routeProvider,
      distanceMeters: routeDistanceMeters,
      durationSeconds: routeDurationSeconds,
    }),
    policySummary: Object.freeze({
      sellerIdentityApproved: sellerApproved,
      sellerIdentityReference: sellerIdentity?.publicReference ?? null,
      sellerIdentityVersion: sellerIdentity?.identityVersion ?? null,
      operationalPolicyActive,
      operationalPolicyReference: operationalPolicy?.publicReference ?? null,
      commissionPlanReady: commissionReadiness.ready,
      commissionPlanReference: commissionReadiness.planReference,
      parcelProfilesActive,
      paymentProviderReady,
      paymentProviderEnvironment: paystackState?.environment ?? null,
    }),
    generatedEvidence,
  });
}

/**
 * Prepares a store's checkout certification directly from the deterministic
 * non-mutating CheckoutCapabilityPreflight without requiring a live card charge
 * or persistent staging environment. Requires a distinct administrator to approve.
 */
export async function prepareStoreCheckoutCertificationFromPreflight(
  storeId: string,
  preparerId: string,
  reviewNote?: string,
  options?: CheckoutCapabilityPreflightOptions,
) {
  const preflight = await evaluateStoreCheckoutCapabilityPreflight(storeId, options);
  if (!preflight) {
    throw new StoreCertificationError("STORE_NOT_FOUND", "Store not found.");
  }
  if (!preflight.preflightReady || !preflight.generatedEvidence ||
      !preflight.pickupAddressId || !preflight.pickupFingerprint ||
      !preflight.coverageRegionId || !preflight.serviceSignature) {
    throw new StoreCertificationError(
      "PREFLIGHT_CAPABILITY_BLOCKED",
      `Store checkout capability preflight is blocked: ${preflight.capabilityBlockers.join(", ")}.`,
      preflight.capabilityBlockers,
    );
  }
  const effectiveNote =
    reviewNote && reviewNote.trim().length >= 24
      ? reviewNote.trim()
      : preflight.generatedEvidence.reviewNote;
  const evidence: CheckoutCertificationEvidence = {
    ...preflight.generatedEvidence,
    reviewNote: effectiveNote,
  };
  checkEvidence(evidence);
  const facts: StoreCertificationFacts = {
    storeId,
    pickupAddressId: preflight.pickupAddressId,
    pickupFingerprint: preflight.pickupFingerprint,
    coverageRegionId: preflight.coverageRegionId,
    serviceSignature: preflight.serviceSignature,
  };

  return prisma.$transaction(
    async (tx) => {
      const { store, pickup, fingerprint } = await lockedStorePickup(tx, storeId);
      if (
        (store.status !== "PENDING" && store.status !== "ACTIVE") ||
        pickup.id !== facts.pickupAddressId ||
        fingerprint !== facts.pickupFingerprint
      ) {
        throw new StoreCertificationError(
          "STORE_PICKUP_CHANGED",
          "Store or pickup changed; repeat preflight checks.",
        );
      }
      const prior = await tx.storeCheckoutCertification.findUnique({ where: { storeId } });
      if (
        prior?.status === "APPROVED" &&
        prior.expiresAt > new Date() &&
        /^[a-f0-9]{64}$/.test(prior.routeEvidenceDigest ?? "") &&
        /^[a-f0-9]{64}$/.test(prior.checkoutEvidenceDigest ?? "") &&
        certificationMatchesFacts(prior, facts)
      ) {
        throw new StoreCertificationError(
          "CERTIFICATION_ALREADY_APPROVED",
          "A current approved certification must first be revoked.",
        );
      }
      const expiresAt = new Date(Date.now() + 30 * 86400_000);
      const cert = await tx.storeCheckoutCertification.upsert({
        where: { storeId },
        create: {
          storeId,
          pickupAddressId: facts.pickupAddressId,
          pickupFingerprint: facts.pickupFingerprint,
          coverageRegionId: facts.coverageRegionId,
          serviceSignature: facts.serviceSignature,
          routeEvidenceReference: evidence.routeEvidenceReference,
          routeEvidenceDigest: evidence.routeEvidenceDigest,
          checkoutEvidenceReference: evidence.checkoutEvidenceReference,
          checkoutEvidenceDigest: evidence.checkoutEvidenceDigest,
          preparedByUserId: preparerId,
          status: "PENDING_REVIEW",
          expiresAt,
          reviewNote: evidence.reviewNote,
        },
        update: {
          pickupAddressId: facts.pickupAddressId,
          pickupFingerprint: facts.pickupFingerprint,
          coverageRegionId: facts.coverageRegionId,
          serviceSignature: facts.serviceSignature,
          routeEvidenceReference: evidence.routeEvidenceReference,
          routeEvidenceDigest: evidence.routeEvidenceDigest,
          checkoutEvidenceReference: evidence.checkoutEvidenceReference,
          checkoutEvidenceDigest: evidence.checkoutEvidenceDigest,
          preparedByUserId: preparerId,
          approvedByUserId: null,
          approvedAt: null,
          status: "PENDING_REVIEW",
          expiresAt,
          reviewNote: evidence.reviewNote,
          revision: { increment: 1 },
        },
      });
      await tx.adminActivityLog.create({
        data: {
          actorUserId: preparerId,
          action: "UPDATE",
          entityType: "Store",
          entityId: storeId,
          message: "Store deterministic checkout capability preflight submitted for independent review",
          metadata: {
            certificateId: cert.id,
            mode: "PREFLIGHT",
            pickupFingerprint: cert.pickupFingerprint,
            routeReference: evidence.routeEvidenceReference,
            routeDigest: evidence.routeEvidenceDigest,
            checkoutReference: evidence.checkoutEvidenceReference,
            checkoutDigest: evidence.checkoutEvidenceDigest,
          },
        },
      });
      return {
        status: cert.status,
        revision: cert.revision,
        expiresAt: cert.expiresAt,
        preflight,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Prospectively detects changed pickup, coverage region, active service, or
 * approved commercial policy and atomically revokes a stale certification
 * along with rebuilding storefront publication.
 */
export async function revalidateStoreCheckoutCertification(
  storeId: string,
  actorUserId?: string,
  options?: CheckoutCapabilityPreflightOptions,
): Promise<{
  valid: boolean;
  revoked: boolean;
  blockers: readonly CheckoutCapabilityBlockerCode[];
  independentReviewerStatus: IndependentReviewerStatus;
}> {
  const preflight = await evaluateStoreCheckoutCapabilityPreflight(storeId, options);
  if (!preflight) {
    throw new StoreCertificationError("STORE_NOT_FOUND", "Store not found.");
  }
  if (preflight.liveReady) {
    return {
      valid: true,
      revoked: false,
      blockers: preflight.blockers,
      independentReviewerStatus: preflight.independentReviewerStatus,
    };
  }
  const { rebuildStorefrontStoreDocument } = await import(
    "@/lib/services/storefront-store.service"
  );
  const revoked = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`);
      const updated = await tx.storeCheckoutCertification.updateMany({
        where: { storeId, status: "APPROVED" },
        data: { status: "REVOKED", revision: { increment: 1 } },
      });
      await rebuildStorefrontStoreDocument(storeId, tx);
      if (updated.count > 0 && actorUserId) {
        await tx.adminActivityLog.create({
          data: {
            actorUserId,
            action: "UPDATE",
            entityType: "Store",
            entityId: storeId,
            message: "Stale store checkout certification revoked after pickup, service, or policy change",
            metadata: { blockers: [...preflight.blockers] },
          },
        });
      }
      return updated.count > 0;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return {
    valid: false,
    revoked,
    blockers: preflight.blockers,
    independentReviewerStatus: revoked ? "REVOKED" : preflight.independentReviewerStatus,
  };
}
