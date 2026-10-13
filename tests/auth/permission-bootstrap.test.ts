import { describe, expect, it, vi } from "vitest";
import { installSystemPermissionDefaults, installStoreCatalogPermissionDefaults } from "@/lib/auth/permission-bootstrap";
import { ROLE_DEFAULT_PERMISSION_KEYS } from "@/lib/auth/permission-keys";
import type { Prisma } from "@/types/db";
describe("additive canonical permission bootstrap", () => {
  it("installs all canonical defaults without updating disabled grants or touching user overrides", async () => {
    const db = {
      permission: { upsert: vi.fn(({ where }: { where: { key: string } }) => Promise.resolve({ id: where.key })) },
      rolePermission: { upsert: vi.fn((command: { update: object; create: { enabled: boolean; role: string } }) => { void command; return Promise.resolve({}); }) },
    };
    const count = Object.values(ROLE_DEFAULT_PERMISSION_KEYS).flat().length;
    await installSystemPermissionDefaults(db as unknown as Prisma.TransactionClient);
    await installSystemPermissionDefaults(db as unknown as Prisma.TransactionClient);
    expect(db.rolePermission.upsert).toHaveBeenCalledTimes(count * 2);
    for (const [command] of db.rolePermission.upsert.mock.calls) expect(command).toMatchObject({ update: {}, create: { enabled: true } });
    const roles = db.rolePermission.upsert.mock.calls.map(([command]) => command.create.role);
    expect(roles).toContain("STORE");
    expect(Object.keys(db)).not.toContain("userPermission");
  });
});

describe("production catalog grant initialization", () => {
  it("creates missing STORE catalog defaults only and never overwrites disabled grants", async () => {
    const db = {
      permission: { upsert: vi.fn(({ where }: { where: { key: string } }) => Promise.resolve({ id: where.key })) },
      rolePermission: { upsert: vi.fn((_command: unknown) => Promise.resolve({})) },
    };
    const result = await installStoreCatalogPermissionDefaults(db as unknown as Prisma.TransactionClient);
    expect(result.permissionsUpserted).toBeGreaterThan(0);
    expect(result.permissionsUpserted).toBe(result.rolePermissionsUpserted);
    expect(db.permission.upsert).toHaveBeenCalledTimes(result.permissionsUpserted);
    expect(db.rolePermission.upsert).toHaveBeenCalledTimes(result.rolePermissionsUpserted);
    for (const [command] of db.permission.upsert.mock.calls)
      expect(command.where.key.startsWith("catalog.")).toBe(true);
    for (const [command] of db.rolePermission.upsert.mock.calls)
      expect(command).toMatchObject({ update: {}, create: { role: "STORE", enabled: true } });
  });
});
