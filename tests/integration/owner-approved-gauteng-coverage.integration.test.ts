import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { activateOwnerApprovedGautengCoverage } from "@/lib/commercial/owner-approved-gauteng-coverage";

const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || url.pathname !== "/kt_launch_test" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Disposable closure database required.");
describe("owner-approved Gauteng coverage on isolated PostgreSQL", () => {
  it("retains legacy radius defaults and creates one audited province-wide region", async () => {
    const actor = await prisma.user.create({ data: { email: `province-coverage-${crypto.randomUUID()}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
    const legacy = await prisma.deliveryRegion.create({ data: { name: "Isolated legacy zone", slug: `isolated-radius-${crypto.randomUUID()}`, province: "Gauteng", active: false } });
    expect(legacy.coverageMode).toBe("RADIUS");
    const activation = await activateOwnerApprovedGautengCoverage(actor.id);
    expect(activation.activated).toBe(true);
    expect(await prisma.deliveryRegion.findUniqueOrThrow({ where: { id: activation.regionId } })).toMatchObject({ coverageMode: "PROVINCE", province: "Gauteng", active: true, pricingEnabled: true, centerLat: null, centerLng: null, coverageRadiusKm: null, maxDistanceKm: null });
    expect(await activateOwnerApprovedGautengCoverage(actor.id)).toEqual({ ...activation, activated: false });
    expect(await prisma.adminActivityLog.count({ where: { actorUserId: actor.id, entityId: activation.regionId, action: "CREATE" } })).toBe(1);
    expect(await prisma.deliveryRegion.findUniqueOrThrow({ where: { id: legacy.id } })).toEqual(legacy);
  });
});
