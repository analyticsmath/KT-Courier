import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { selectStorePickupCandidate, type StorePickupAddressCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";
import { getStorePickupOperationalPreflight } from "./store-pickup-preflight.service";

export class StoreCertificationError extends Error {
  constructor(readonly code: string, message: string) {
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
