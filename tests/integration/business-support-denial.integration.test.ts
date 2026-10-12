import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { grantBusinessSupportAccess, readBusinessSupportDashboard } from "@/lib/client-platform/support-access.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import type { AuthenticatedUser } from "@/types/domain";

describe("business support explicit denial on disposable PostgreSQL", () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());
  it("logs the actor/store, rejects foreign grants and revokes an issued support read after DENY", async () => {
    const tag = randomUUID();
    const actor = await prisma.user.create({ data: { email: `support-${tag}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
    const other = await prisma.user.create({ data: { email: `support-other-${tag}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
    const owner = await prisma.user.create({ data: { email: `support-owner-${tag}@example.test`, role: "STORE", status: "ACTIVE" } });
    const store = await prisma.store.create({ data: { ownerUserId: owner.id, name: "Disposable support store", slug: `support-${tag}`, status: "ACTIVE" } });
    const user = actor as AuthenticatedUser;
    const grant = await grantBusinessSupportAccess(user, { storeId: store.id, reason: "Disposable support authority regression" });
    expect(await prisma.adminActivityLog.count({ where: { actorUserId: actor.id, entityType: "BusinessSupportAccess", entityId: grant.id } })).toBe(1);
    await expect(readBusinessSupportDashboard(other as AuthenticatedUser, store.id, grant.id)).rejects.toMatchObject({ code: "SUPPORT_ACCESS_EXPIRED" });
    const permission = await prisma.permission.upsert({ where: { key: "stores.read" }, update: {}, create: { key: "stores.read", name: "Read stores", category: "stores", description: "Disposable support permission", isSystem: true } });
    await prisma.userPermission.create({ data: { userId: actor.id, permissionId: permission.id, effect: "DENY", createdByUserId: other.id } });
    await expect(grantBusinessSupportAccess(user, { storeId: store.id, reason: "Disposable denied support request" })).rejects.toMatchObject({ code: "SUPPORT_ACCESS_FORBIDDEN" });
    await expect(readBusinessSupportDashboard(user, store.id, grant.id)).rejects.toMatchObject({ code: "SUPPORT_ACCESS_FORBIDDEN" });
    expect(await prisma.businessSupportAccess.count({ where: { actorUserId: actor.id } })).toBe(1);
    expect(await prisma.adminActivityLog.count({ where: { actorUserId: actor.id, entityType: "BusinessSupportAccess" } })).toBe(1);
  }, 30000);
});
