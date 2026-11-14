import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  prepareStoreCheckoutCertification,
  prepareStoreCheckoutCertificationFromPreflight,
  approveStoreCheckoutCertification,
  evaluateStoreCheckoutCapabilityPreflight,
  revalidateStoreCheckoutCertification,
  StoreCertificationError,
} from "@/lib/admin/store-checkout-certification.service";
import { setStoreStatus } from "@/lib/services/admin-stores.service";

vi.mock("@/lib/admin/store-pickup-preflight.service", () => ({
  getStorePickupOperationalPreflight: vi.fn(async () => ({
    blockers: [], pickupRegionId: "isolated-covered-jhb", pickupRegionName: "Johannesburg",
    matchingServiceVersions: ["service-1:1"], matchingServiceCount: 1,
  })),
}));

const ids: { store?: string; owner?: string; admins: string[] } = { admins: [] };
describe("locked two-person store certification and activation (isolated PostgreSQL)", () => {
  afterAll(async () => {
    if (!ids.store) return;
    await prisma.$transaction(async tx => {
      await tx.storefrontStoreDocument.deleteMany({ where: { storeId: ids.store } });
      await tx.adminActivityLog.deleteMany({ where: { entityType: "Store", entityId: ids.store } });
      await tx.storeCheckoutCertification.deleteMany({ where: { storeId: ids.store } });
      await tx.store.update({ where: { id: ids.store }, data: { defaultPickupAddressId: null } });
      await tx.address.deleteMany({ where: { storeId: ids.store } });
      await tx.store.delete({ where: { id: ids.store } });
      await tx.user.deleteMany({ where: { id: { in: [ids.owner!, ...ids.admins] } } });
    });
    await prisma.$disconnect();
  });

  it("blocks Live without evidence, blocks self-approval and activates only with independent current approval", async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" ||
        process.env.KT_NETWORK_DISABLED !== "true" || url.pathname !== "/kt_launch_test" ||
        !["localhost", "127.0.0.1"].includes(url.hostname)) throw Error("Disposable database required.");
    const label = randomUUID();
    const owner = await prisma.user.create({ data: { email: "cert-owner-" + label + "@example.test", role: "STORE", status: "ACTIVE" } });
    ids.owner = owner.id;
    for (const i of [1, 2]) {
      const admin = await prisma.user.create({ data: { email: "cert-admin-" + i + "-" + label + "@example.test", role: "SUPER_ADMIN", status: "ACTIVE" } });
      ids.admins.push(admin.id);
    }
    const store = await prisma.store.create({ data: {
      name: "Disposable certified merchant", slug: "cert-" + label, ownerUserId: owner.id, status: "PENDING",
      contactEmail: owner.email,
    } });
    ids.store = store.id;
    const pickup = await prisma.address.create({ data: {
      storeId: store.id, type: "PICKUP", isDefault: true, line1: "15 E2E Main Street",
      line2: "Central", city: "Johannesburg", province: "Gauteng", postalCode: "2001",
      country: "South Africa", latitude: "-26.2041000", longitude: "28.0473000",
    } });
    await prisma.store.update({ where: { id: store.id }, data: { defaultPickupAddressId: pickup.id } });
    await expect(setStoreStatus(store.id, "ACTIVE")).rejects.toMatchObject({ code: "CHECKOUT_CERTIFICATION_REQUIRED" });
    expect((await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("PENDING");
    const proof = {
      routeEvidenceReference: "isolated-route-cert-" + label,
      routeEvidenceDigest: "a".repeat(64),
      checkoutEvidenceReference: "isolated-checkout-cert-" + label,
      checkoutEvidenceDigest: "b".repeat(64),
      reviewNote: "Test route Johannesburg, collection and simulated Paystack receipt checked independently",
    };
    const pending = await prepareStoreCheckoutCertification(store.id, ids.admins[0], proof);
    expect(pending.status).toBe("PENDING_REVIEW");
    expect(await prisma.storeCheckoutCertification.findUniqueOrThrow({ where: { storeId: store.id } }))
      .toMatchObject({ routeEvidenceDigest: proof.routeEvidenceDigest, checkoutEvidenceDigest: proof.checkoutEvidenceDigest });
    await expect(approveStoreCheckoutCertification(store.id, ids.admins[0], pending.revision))
      .rejects.toMatchObject({ code: "INDEPENDENT_REVIEWER_REQUIRED" } satisfies Partial<StoreCertificationError>);
    const approved = await approveStoreCheckoutCertification(store.id, ids.admins[1], pending.revision);
    expect(approved.status).toBe("APPROVED");
    const active = await setStoreStatus(store.id, "ACTIVE");
    expect(active.status).toBe("ACTIVE");
    const certificate = await prisma.storeCheckoutCertification.findUniqueOrThrow({ where: { storeId: store.id } });
    expect(certificate.approvedByUserId).toBe(ids.admins[1]);
    await expect(approveStoreCheckoutCertification(store.id, ids.admins[1], pending.revision))
      .rejects.toMatchObject({ code: "CERTIFICATION_VERSION_CONFLICT" });
    // The re-certification UX must recover from expired or pre-migration
    // approved evidence, but never silently keep the old Live authority.
    await prisma.storeCheckoutCertification.update({ where: { storeId: store.id }, data: {
      status: "APPROVED", routeEvidenceDigest: null, checkoutEvidenceDigest: null,
    } });
    const renewed = await prepareStoreCheckoutCertification(store.id, ids.admins[0], proof);
    expect(renewed.status).toBe("PENDING_REVIEW");
    expect((await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("ACTIVE");
    await expect(approveStoreCheckoutCertification(store.id, ids.admins[0], renewed.revision))
      .rejects.toMatchObject({ code: "INDEPENDENT_REVIEWER_REQUIRED" });
    await approveStoreCheckoutCertification(store.id, ids.admins[1], renewed.revision);
    expect((await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("ACTIVE");
  });

  it("evaluates non-mutating CheckoutCapabilityPreflight, prepares deterministic certification without live charges, enforces distinct approval, and invalidates stale certification on pickup/policy change", async () => {
    const label = randomUUID();
    const owner = await prisma.user.create({
      data: { email: `preflight-owner-${label}@example.test`, role: "STORE", status: "ACTIVE" },
    });
    const admin1 = await prisma.user.create({
      data: { email: `preflight-admin1-${label}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" },
    });
    const admin2 = await prisma.user.create({
      data: { email: `preflight-admin2-${label}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" },
    });
    ids.admins.push(admin1.id, admin2.id);

    const store = await prisma.store.create({
      data: {
        name: "Preflight Merchant",
        slug: `preflight-${label}`,
        ownerUserId: owner.id,
        status: "PENDING",
        contactEmail: owner.email,
      },
    });

    try {
      const preflightOpts = {
        coordinateResolver: async () => ({ latitude: -26.2041, longitude: 28.0473 }),
        zoneChecker: async () => ({
          matched: true,
          regionId: "isolated-covered-jhb",
          regionName: "Johannesburg",
          withinMaxDistance: true,
          warningMessage: null,
          calculationType: "geometric_haversine" as const,
        }),
        routeCalculator: async () => ({
          ok: true as const,
          route: {
            distanceMeters: 4200,
            durationSeconds: 780,
            routeSummary: "4.2 km · ~13 min",
            provider: "e2e_deterministic" as const,
          },
        }),
        serviceCatalogLoader: async () => [
          {
            id: "service-1",
            key: "STANDARD",
            name: "Standard",
            description: "1-2 business days",
            active: true,
            version: 1,
            provinces: ["Gauteng"],
            regionIds: ["isolated-covered-jhb"],
            baseFee: 129,
            perKmRate: 0,
            minFee: 129,
            maxFee: 249,
            estimatedDaysMin: 1,
            estimatedDaysMax: 2,
          },
        ],
        commissionChecker: async () => ({
          ready: true,
          status: "READY" as const,
          planId: "plan-1",
          planReference: "CPL-PREFLIGHT-1",
        }),
        paymentProviderReadiness: [
          {
            code: "PAYSTACK",
            configured: true,
            active: true,
            environment: "sandbox",
            errorCategory: "NONE",
          },
        ],
      };

      // PAR-37: Incomplete store missing pickup and seller identity reports exact blocker codes
      const incomplete = await evaluateStoreCheckoutCapabilityPreflight(store.id, preflightOpts);
      expect(incomplete?.preflightReady).toBe(false);
      expect(incomplete?.capabilityBlockers).toEqual(
        expect.arrayContaining([
          "MISSING_STREET",
          "MISSING_SUBURB",
          "MISSING_POSTCODE",
          "MISSING_MAP_PROOF",
          "UNAPPROVED_SELLER",
        ]),
      );
      await expect(
        prepareStoreCheckoutCertificationFromPreflight(
          store.id,
          admin1.id,
          undefined,
          preflightOpts,
        ),
      ).rejects.toMatchObject({ code: "PREFLIGHT_CAPABILITY_BLOCKED" });

      // Add complete pickup, approved seller identity, and active operational policy
      const pickup = await prisma.address.create({
        data: {
          storeId: store.id,
          type: "PICKUP",
          isDefault: true,
          line1: "22 Preflight Road",
          line2: "Sandton",
          city: "Johannesburg",
          province: "Gauteng",
          postalCode: "2196",
          country: "South Africa",
          latitude: "-26.2041000",
          longitude: "28.0473000",
          placeId: "place_preflight_1",
        },
      });
      await prisma.store.update({
        where: { id: store.id },
        data: { defaultPickupAddressId: pickup.id },
      });
      await prisma.storeSellerLegalIdentity.create({
        data: {
          storeId: store.id,
          publicReference: `SID-PRE-${label}`,
          identityVersion: "PAMMY_BAKES_V1",
          legalName: "Pammy Sole Trader",
          tradingName: "Pammy Bakes",
          vatRegistrationStatus: "NOT_REGISTERED",
          invoiceClassification: "RECEIPT",
          status: "APPROVED",
          effectiveFrom: new Date(Date.now() - 60_000),
          effectiveUntil: null,
        },
      });
      const existingPolicy = await prisma.storeOrderOperationalPolicy.findFirst({
        where: {
          status: "ACTIVE",
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
        },
      });
      if (!existingPolicy) {
        await prisma.storeOrderOperationalPolicy.create({
          data: {
            publicReference: `SOP-PRE-${label}`,
            name: `preflight-policy-${label}`,
            versionNumber: 1,
            status: "ACTIVE",
            acceptanceWindowSeconds: 900,
            customerDecisionWindowSeconds: 900,
            maximumPrepMinutes: 60,
            maximumPrepExtensionMinutes: 30,
            maximumIssueCount: 3,
            maximumSubstitutionProposalsPerLine: 2,
            effectiveFrom: new Date(Date.now() - 60_000),
            effectiveUntil: null,
            approvedByUserId: admin1.id,
            activatedAt: new Date(),
          },
        });
      }
      const activeParcelCount = await prisma.parcelProfileVersion.count({
        where: {
          status: "ACTIVE",
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
      });
      if (activeParcelCount === 0) {
        await prisma.parcelProfileVersion.create({
          data: {
            stableKey: "SMALL",
            displayName: "Small Parcel",
            versionNumber: 1,
            status: "ACTIVE",
            lengthCm: 30,
            widthCm: 20,
            heightCm: 10,
            maximumWeightKg: 5,
            effectiveFrom: new Date(Date.now() - 60_000),
            effectiveTo: null,
            createdByUserId: admin1.id,
          },
        });
      }

      // PAR-38: Store with complete pickup, seller approval, route, service, and policy prepares preflight and gets distinct approval
      const readyPreflight = await evaluateStoreCheckoutCapabilityPreflight(
        store.id,
        preflightOpts,
      );
      expect(readyPreflight?.preflightReady).toBe(true);
      expect(readyPreflight?.capabilityBlockers).toEqual([]);
      expect(readyPreflight?.generatedEvidence?.routeEvidenceReference).toMatch(
        /^preflight-route:/,
      );
      expect(readyPreflight?.generatedEvidence?.checkoutEvidenceReference).toMatch(
        /^preflight-checkout:/,
      );

      const prepared = await prepareStoreCheckoutCertificationFromPreflight(
        store.id,
        admin1.id,
        undefined,
        preflightOpts,
      );
      expect(prepared.status).toBe("PENDING_REVIEW");

      // Self-approval blocked
      await expect(
        approveStoreCheckoutCertification(store.id, admin1.id, prepared.revision),
      ).rejects.toMatchObject({ code: "INDEPENDENT_REVIEWER_REQUIRED" });

      // Distinct reviewer approves
      const approved = await approveStoreCheckoutCertification(
        store.id,
        admin2.id,
        prepared.revision,
      );
      expect(approved.status).toBe("APPROVED");

      // PAR-39: Changing pickup or policy after certification marks CERTIFICATION_STALE and revokes certification on revalidation
      await prisma.address.update({
        where: { id: pickup.id },
        data: { line1: "99 Changed Collection Street" },
      });
      const staleCheck = await evaluateStoreCheckoutCapabilityPreflight(store.id, preflightOpts);
      expect(staleCheck?.blockers).toContain("CERTIFICATION_STALE");
      expect(staleCheck?.independentReviewerStatus).toBe("STALE_OR_EXPIRED");

      const revalidated = await revalidateStoreCheckoutCertification(
        store.id,
        admin2.id,
        preflightOpts,
      );
      expect(revalidated.valid).toBe(false);
      expect(revalidated.revoked).toBe(true);
      expect(revalidated.independentReviewerStatus).toBe("REVOKED");
    } finally {
      await prisma.$transaction(async (tx) => {
        await tx.storefrontStoreDocument.deleteMany({ where: { storeId: store.id } });
        await tx.adminActivityLog.deleteMany({ where: { entityType: "Store", entityId: store.id } });
        await tx.storeCheckoutCertification.deleteMany({ where: { storeId: store.id } });
        await tx.storeSellerLegalIdentity.deleteMany({ where: { storeId: store.id } });
        await tx.store.update({ where: { id: store.id }, data: { defaultPickupAddressId: null } });
        await tx.address.deleteMany({ where: { storeId: store.id } });
        await tx.store.delete({ where: { id: store.id } });
        await tx.user.delete({ where: { id: owner.id } });
      });
    }
  });
});
