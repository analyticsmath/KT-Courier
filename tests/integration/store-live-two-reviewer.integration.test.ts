import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { prepareStoreCheckoutCertification, approveStoreCheckoutCertification, StoreCertificationError } from "@/lib/admin/store-checkout-certification.service";
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
    await expect(approveStoreCheckoutCertification(store.id, ids.admins[0], pending.revision))
      .rejects.toMatchObject({ code: "INDEPENDENT_REVIEWER_REQUIRED" } satisfies Partial<StoreCertificationError>);
    const approved = await approveStoreCheckoutCertification(store.id, ids.admins[1], pending.revision);
    expect(approved.status).toBe("APPROVED");
    const active = await setStoreStatus(store.id, "ACTIVE");
    expect(active.status).toBe("ACTIVE");
    const certificate = await prisma.storeCheckoutCertification.findUniqueOrThrow({ where: { storeId: store.id } });
    expect(certificate.approvedByUserId).toBe(ids.admins[1]);
    await expect(approveStoreCheckoutCertification(store.id, ids.admins[1], pending.revision))
      .rejects.toMatchObject({ code: "STORE_PICKUP_CHANGED" });
  });
});
