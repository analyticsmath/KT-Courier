import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { DriverEngagementSchema, DriverEngagementConflict, setDriverEngagement } from "@/lib/services/driver-engagement.service";

describe("audited driver freelance / salaried agreement authority", () => {
  const ids = { driver: "", user: "", admin: "" };
  afterAll(async () => {
    if (!ids.driver) return;
    await prisma.adminActivityLog.deleteMany({ where: { entityType: "Driver", entityId: ids.driver } });
    await prisma.driverProfile.delete({ where: { id: ids.driver } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.user, ids.admin] } } });
    await prisma.$disconnect();
  });
  it("records a referenced contract with South African effective date; never changes cash or earnings", async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1"
      || process.env.KT_NETWORK_DISABLED !== "true"
      || url.pathname !== "/kt_launch_test"
      || !["localhost", "127.0.0.1"].includes(url.hostname)) {
      throw Error("Driver engagement requires an isolated disposable PostgreSQL database.");
    }
    const suffix = randomUUID();
    const [user, admin] = await Promise.all([
      prisma.user.create({ data: { role: "DRIVER", status: "ACTIVE", email: "driver-agreement-" + suffix + "@example.test" } }),
      prisma.user.create({ data: { role: "SUPER_ADMIN", status: "ACTIVE", email: "admin-agreement-" + suffix + "@example.test" } }),
    ]);
    ids.user = user.id; ids.admin = admin.id;
    const driver = await prisma.driverProfile.create({ data: {
      userId: user.id, driverCode: "AGREE-" + suffix.replaceAll("-", "").slice(0, 12),
      status: "PENDING_REVIEW",
    } });
    ids.driver = driver.id;
    expect(DriverEngagementSchema.safeParse({
      engagementType: "SALARIED", contractReference: "verified-contract-2026",
      effectiveFrom: "2026-02-30", reason: "Agreement reviewed against approved signed evidence.",
      expectedRevision: 0,
    }).success).toBe(false);
    const before = await prisma.driverProfile.findUniqueOrThrow({ where: { id: driver.id } });
    expect(before.engagementType).toBeNull();
    const input = {
      engagementType: "FREELANCE" as const,
      contractReference: "approved-freelance-contract-001",
      effectiveFrom: "2026-11-08", expectedRevision: 0,
      reason: "Signed independent courier service agreement was reviewed by driver operations.",
    };
    const result = await setDriverEngagement(driver.id, admin.id, input);
    expect(result).toMatchObject({ type: "FREELANCE", reference: input.contractReference, revision: 1, remunerationPolicyActivated: false });
    expect((await prisma.driverProfile.findUniqueOrThrow({ where: { id: driver.id } })).engagementEffectiveFrom?.toISOString())
      .toBe("2026-11-07T22:00:00.000Z");
    await expect(setDriverEngagement(driver.id, admin.id, input)).rejects.toBeInstanceOf(DriverEngagementConflict);
    const replacement = await setDriverEngagement(driver.id, admin.id, {
      ...input, engagementType: "SALARIED", contractReference: "approved-salaried-contract-002",
      expectedRevision: 1,
      reason: "Revised salaried employment contract signed and verified by driver operations.",
    });
    expect(replacement).toMatchObject({ type: "SALARIED", revision: 2, remunerationPolicyActivated: false });
    expect(await prisma.adminActivityLog.count({ where: { entityType: "Driver", entityId: driver.id, action: "UPDATE" } })).toBe(2);
    expect(await prisma.driverEarning.count({ where: { driverId: driver.id } })).toBe(0);
    expect(await prisma.ledgerJournal.count({ where: { correlationId: driver.id } })).toBe(0);
  });
});
