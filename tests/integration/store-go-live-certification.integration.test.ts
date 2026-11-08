import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  pickupCertificationFingerprint, requireCurrentStoreCheckoutCertification,
  certificationMatchesFacts, type StoreCertificationFacts,
} from "@/lib/admin/store-checkout-certification.service";

const created: { storeId?: string; userId?: string } = {};

describe("independent store Live certificate at a locked current pickup", () => {
  afterAll(async () => {
    if (!created.storeId) return;
    await prisma.$transaction(async tx => {
      await tx.storeCheckoutCertification.deleteMany({ where: { storeId: created.storeId } });
      await tx.store.update({ where: { id: created.storeId }, data: { defaultPickupAddressId: null } });
      await tx.address.deleteMany({ where: { storeId: created.storeId } });
      await tx.store.delete({ where: { id: created.storeId } });
      if (created.userId) await tx.user.delete({ where: { id: created.userId } });
    });
    await prisma.$disconnect();
  });
  it("rejects missing, expired, same-approver and changed-address certificates; accepts only matching reviewed evidence", async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" ||
        process.env.KT_NETWORK_DISABLED !== "true" || url.pathname !== "/kt_launch_test" ||
        !["localhost", "127.0.0.1"].includes(url.hostname)) {
      throw Error("Exact disposable database required.");
    }
    const user = await prisma.user.create({ data: {
      email: "cert-" + randomUUID() + "@example.test", role: "STORE", status: "ACTIVE",
    } });
    created.userId = user.id;
    const store = await prisma.store.create({ data: {
      ownerUserId: user.id, slug: "p1cert-" + randomUUID(), name: "Disposable pending merchant",
      status: "PENDING",
    } });
    created.storeId = store.id;
    const pin = await prisma.address.create({ data: {
      storeId: store.id, isDefault: true, type: "PICKUP",
      line1: "15 E2E Main Road", line2: "Central", city: "Johannesburg",
      province: "Gauteng", postalCode: "2001", country: "South Africa",
      latitude: new Prisma.Decimal("-26.2041000"),
      longitude: new Prisma.Decimal("28.0473000"), placeId: "p1_cert_place",
    } });
    await prisma.store.update({ where: { id: store.id }, data: { defaultPickupAddressId: pin.id } });
    const facts: StoreCertificationFacts = {
      storeId: store.id, pickupAddressId: pin.id, pickupFingerprint: pickupCertificationFingerprint(pin),
      coverageRegionId: "region-reviewed", serviceSignature: "a".repeat(64),
    };
    await expect(prisma.$transaction(tx => requireCurrentStoreCheckoutCertification(tx, store.id, facts)))
      .rejects.toMatchObject({ code: "CHECKOUT_CERTIFICATION_REQUIRED" });
    const cert = await prisma.storeCheckoutCertification.create({ data: {
      storeId: store.id, pickupAddressId: facts.pickupAddressId, pickupFingerprint: facts.pickupFingerprint,
      coverageRegionId: facts.coverageRegionId, serviceSignature: facts.serviceSignature,
      routeEvidenceReference: "staging-route-accepted", checkoutEvidenceReference: "staging-paid-accepted",
      preparedByUserId: "admin-one", approvedByUserId: "admin-one",
      status: "APPROVED", approvedAt: new Date(), expiresAt: new Date(Date.now() + 86400_000),
    } });
    await expect(prisma.$transaction(tx => requireCurrentStoreCheckoutCertification(tx, store.id, facts)))
      .rejects.toMatchObject({ code: "CHECKOUT_CERTIFICATION_REQUIRED" });
    await prisma.storeCheckoutCertification.update({ where: { id: cert.id }, data: {
      approvedByUserId: "admin-two",
    } });
    expect(certificationMatchesFacts(cert, facts)).toBe(true);
    // Legacy records without persisted receipt digests cannot become Live.
    await expect(prisma.$transaction(tx => requireCurrentStoreCheckoutCertification(tx, store.id, facts)))
      .rejects.toMatchObject({ code: "CHECKOUT_CERTIFICATION_REQUIRED" });
    await prisma.storeCheckoutCertification.update({ where: { id: cert.id }, data: {
      routeEvidenceDigest: "a".repeat(64),
      checkoutEvidenceDigest: "b".repeat(64),
    } });
    await expect(prisma.$transaction(tx => requireCurrentStoreCheckoutCertification(tx, store.id, facts)))
      .resolves.toBeUndefined();
    await expect(prisma.$transaction(tx => requireCurrentStoreCheckoutCertification(tx, store.id, {
      ...facts, serviceSignature: "b".repeat(64),
    }))).rejects.toMatchObject({ code: "CHECKOUT_CERTIFICATION_REQUIRED" });
    await prisma.address.update({ where: { id: pin.id }, data: { line1: "16 Different Collection Road" } });
    await expect(prisma.$transaction(tx => requireCurrentStoreCheckoutCertification(tx, store.id, facts)))
      .rejects.toMatchObject({ code: "CHECKOUT_CERTIFICATION_REQUIRED" });
    await prisma.storeCheckoutCertification.update({ where: { id: cert.id }, data: {
      expiresAt: new Date(Date.now() - 1000),
    } });
    await expect(prisma.$transaction(tx => requireCurrentStoreCheckoutCertification(tx, store.id, facts)))
      .rejects.toMatchObject({ code: "CHECKOUT_CERTIFICATION_REQUIRED" });
  });
});
