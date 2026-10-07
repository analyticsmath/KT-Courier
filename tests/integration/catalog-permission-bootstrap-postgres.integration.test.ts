import { beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { prisma } from "@/lib/db/prisma";
import { installSystemPermissionDefaults } from "@/lib/auth/permission-bootstrap";
import { PERMISSIONS, ROLE_DEFAULT_PERMISSION_KEYS } from "@/lib/auth/permission-keys";
import { storeCatalogPermission } from "@/lib/catalog/catalog-auth";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { inviteEmployee, acceptEmployeeInvitation, updateEmployee } from "@/lib/client-platform/employees.service";
import { createProductionCatalogMediaIntakeService } from "@/lib/services/catalog-media-intake.service";

async function source() {
  requireDisposableStoreSettlementDatabase();
  const tag = randomUUID();
  const owner = await prisma.user.create({ data: { email: `catalog-authority-${tag}@example.test`, role: "STORE", status: "ACTIVE" } });
  const store = await prisma.store.create({ data: { ownerUserId: owner.id, name: "Disposable permission store", slug: `catalog-authority-${tag}`, status: "ACTIVE" } });
  return { owner, store };
}
describe("canonical catalog bootstrap and authority on isolated PostgreSQL", { timeout: 30_000 }, () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());
  it("creates missing STORE defaults idempotently and preserves disabled grants and explicit DENY", async () => {
    await installSystemPermissionDefaults(prisma);
    const { owner } = await source();
    const permission = await prisma.permission.findUniqueOrThrow({ where: { key: PERMISSIONS.CATALOG_MANAGE } });
    const where = { role_permissionId: { role: "STORE" as const, permissionId: permission.id } };
    const prior = await prisma.rolePermission.findUniqueOrThrow({ where });
    try {
      await prisma.rolePermission.delete({ where });
      expect((await storeCatalogPermission(owner.id, PERMISSIONS.CATALOG_MANAGE)).allowed).toBe(false);
      await installSystemPermissionDefaults(prisma);
      expect((await storeCatalogPermission(owner.id, PERMISSIONS.CATALOG_MANAGE)).allowed).toBe(true);
      const defaults = await prisma.rolePermission.findMany({ where: { role: "STORE" }, include: { permission: true } });
      expect(defaults.filter(row => row.enabled).map(row => row.permission.key)).toEqual(expect.arrayContaining(ROLE_DEFAULT_PERMISSION_KEYS.STORE!));
      await prisma.userPermission.create({ data: { userId: owner.id, permissionId: permission.id, effect: "DENY", createdByUserId: owner.id } });
      expect((await storeCatalogPermission(owner.id, PERMISSIONS.CATALOG_MANAGE)).allowed).toBe(false);
      await prisma.rolePermission.update({ where, data: { enabled: false } });
      const count = await prisma.rolePermission.count();
      await installSystemPermissionDefaults(prisma);
      await installSystemPermissionDefaults(prisma);
      expect(await prisma.rolePermission.count()).toBe(count);
      expect(await prisma.rolePermission.findUniqueOrThrow({ where })).toMatchObject({ enabled: false });
      expect(await prisma.userPermission.findUniqueOrThrow({ where: { userId_permissionId: { userId: owner.id, permissionId: permission.id } } })).toMatchObject({ effect: "DENY" });
      await prisma.userPermission.deleteMany({ where: { userId: owner.id } });
      expect((await storeCatalogPermission(owner.id, PERMISSIONS.CATALOG_MANAGE)).allowed).toBe(false);
    } finally {
      await prisma.rolePermission.upsert({ where, update: { enabled: prior.enabled }, create: { role: "STORE", permissionId: permission.id, enabled: prior.enabled } });
    }
  });
  it("restricts products-only CUSTOMER employees and immediately revokes disabled/removed authority while preserving owner access", async () => {
    await installSystemPermissionDefaults(prisma);
    const { owner, store } = await source();
    const employee = await prisma.user.create({ data: { email: `catalog-worker-${randomUUID()}@example.test`, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() } });
    await expect(storeCatalogPermission(employee.id, PERMISSIONS.CATALOG_READ)).rejects.toMatchObject({ status: 403 });
    const invitation = await inviteEmployee(owner.id, { email: employee.email, roleLabel: "Products only", permissions: ["products"] });
    const token = new URL(invitation.invitationPath, "https://disposable.example.test").searchParams.get("token")!;
    await acceptEmployeeInvitation(employee.id, token);
    for (const key of [PERMISSIONS.CATALOG_READ, PERMISSIONS.CATALOG_MANAGE, PERMISSIONS.CATALOG_SUBMIT]) expect(await storeCatalogPermission(employee.id, key)).toMatchObject({ allowed: true, owner: false, store: { id: store.id } });
    for (const key of [PERMISSIONS.CATALOG_PRICING_MANAGE, PERMISSIONS.CATALOG_INVENTORY_MANAGE, PERMISSIONS.CATALOG_IMPORTS_MANAGE, PERMISSIONS.FINANCE_STORE_EARNINGS_READ]) expect((await storeCatalogPermission(employee.id, key)).allowed).toBe(false);
    const membership = await prisma.storeEmployeeMembership.findUniqueOrThrow({ where: { storeId_email: { storeId: store.id, email: employee.email } } });
    for (const status of ["DISABLED", "ACTIVE", "REMOVED"] as const) {
      await updateEmployee(owner.id, { id: membership.id, roleLabel: "Products only", permissions: ["products"], status });
      if (status === "ACTIVE") expect((await storeCatalogPermission(employee.id, PERMISSIONS.CATALOG_MANAGE)).allowed).toBe(true);
      else await expect(storeCatalogPermission(employee.id, PERMISSIONS.CATALOG_MANAGE)).rejects.toMatchObject({ status: 403 });
      expect((await storeCatalogPermission(owner.id, PERMISSIONS.CATALOG_MANAGE)).allowed).toBe(true);
    }
    expect(await prisma.user.findUniqueOrThrow({ where: { id: employee.id } })).toMatchObject({ role: "CUSTOMER" });
    await prisma.store.update({ where: { id: store.id }, data: { status: "SUSPENDED" } });
    expect((await storeCatalogPermission(owner.id, PERMISSIONS.CATALOG_MANAGE)).allowed).toBe(false);
  });
  it("conceals foreign-store media using the canonical asset reader", async () => {
    const { owner, store } = await source();
    const foreign = await source();
    const asset = await prisma.catalogMediaAsset.create({ data: { publicReference: catalogPublicReference("CMA"), ownerType: "STORE", ownerStoreId: store.id, purpose: "PRODUCT_IMAGE", storageProvider: "DISPOSABLE_FIXTURE", storageKey: `catalog-media/${createHash("sha256").update(randomUUID()).digest("hex")}`, declaredMimeType: "image/png", declaredByteSize: 100, status: "PENDING_UPLOAD", createdByUserId: owner.id, updatedByUserId: owner.id } });
    const media = createProductionCatalogMediaIntakeService();
    await expect(media.getStoreAsset(foreign.store.id, asset.publicReference)).rejects.toMatchObject({ status: 404 });
    const dto = await media.getStoreAsset(store.id, asset.publicReference);
    expect(dto).toMatchObject({ publicReference: asset.publicReference });
    for (const key of ["storageKey", "storageProvider", "checksum", "createdByUserId"]) expect(dto).not.toHaveProperty(key);
  });
});
