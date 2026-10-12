import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createDriverProfile } from "@/lib/services/admin-drivers.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

describe("driver registration identity on disposable PostgreSQL", () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());

  it("creates a new profile when legacy numeric codes contain gaps", async () => {
    const tag = randomUUID();
    const admin = await prisma.user.create({ data: { email: `admin-${tag}@example.test`, role: "ADMIN", status: "ACTIVE" } });
    const legacy = await prisma.user.create({ data: { email: `legacy-${tag}@example.test`, role: "DRIVER", status: "ACTIVE" } });
    const count = await prisma.driverProfile.count();
    const existing = await prisma.driverProfile.create({ data: { userId: legacy.id, driverCode: `DRV-${1000 + count + 2}`, status: "PENDING_REVIEW" } });
    const user = await prisma.user.create({ data: { email: `new-${tag}@example.test`, role: "DRIVER", status: "ACTIVE" } });
    const created = await createDriverProfile(admin.id, { userId: user.id, licenseExpiryDate: undefined });
    expect(created.driverCode).not.toBe(existing.driverCode);
    expect(created.status).toBe("PENDING_REVIEW");
    expect(await prisma.driverProfile.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.driverProfile.findUniqueOrThrow({ where: { id: existing.id } })).toEqual(existing);
  });

  it("creates concurrent profiles with distinct identities and retains approval requirements", async () => {
    const tag = randomUUID();
    const admin = await prisma.user.create({ data: { email: `concurrent-admin-${tag}@example.test`, role: "ADMIN", status: "ACTIVE" } });
    const users = await Promise.all(Array.from({ length: 4 }, (_, index) => prisma.user.create({ data: { email: `concurrent-driver-${index}-${tag}@example.test`, role: "DRIVER", status: "ACTIVE" } })));
    const profiles = await Promise.all(users.map(user => createDriverProfile(admin.id, { userId: user.id, licenseExpiryDate: undefined })));
    expect(new Set(profiles.map(profile => profile.driverCode)).size).toBe(4);
    expect(profiles.every(profile => profile.status === "PENDING_REVIEW" && profile.availability === "OFFLINE")).toBe(true);
  });
});
