import { describe, expect, it, vi } from "vitest";
import { installSystemPermissionDefaults, installStoreCatalogPermissionDefaults, installSelfNotificationPermissionDefaults } from "@/lib/auth/permission-bootstrap";
import { ROLE_DEFAULT_PERMISSION_KEYS, SELF_NOTIFICATION_PERMISSION_KEYS } from "@/lib/auth/permission-keys";
import type { Prisma } from "@/types/db";
it("backfills only canonical own-inbox grants without overriding disabled grants or user denials", async () => {
  const db = {
    permission: { upsert: vi.fn(({ where }: { where: { key: string } }) => Promise.resolve({ id: where.key })) },
    rolePermission: { upsert: vi.fn(async () => ({})) },
  };
  const registry = db as unknown as Prisma.TransactionClient;
  await installSelfNotificationPermissionDefaults(registry);
  expect(db.permission.upsert).toHaveBeenCalledTimes(SELF_NOTIFICATION_PERMISSION_KEYS.length);
  for (const [command] of db.permission.upsert.mock.calls) {
    expect(SELF_NOTIFICATION_PERMISSION_KEYS).toContain(command.where.key);
    expect(command).toMatchObject({ update: {} });
  }
  const commands = db.rolePermission.upsert.mock.calls as unknown as Array<[{ update: object; create: { role: keyof typeof ROLE_DEFAULT_PERMISSION_KEYS; permissionId: string; enabled: boolean } }]>;
  expect(commands.some(([command]) => command.create.role === "CUSTOMER")).toBe(true);
  for (const [command] of commands) {
    expect(command.update).toEqual({});
    expect(command.create.enabled).toBe(true);
    expect(ROLE_DEFAULT_PERMISSION_KEYS[command.create.role]).toContain(command.create.permissionId);
  }
  expect(db).not.toHaveProperty("userPermission");
});
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
      rolePermission: { upsert: vi.fn((command: { update: object; create: { enabled: boolean; role: string } }) => { void command; return Promise.resolve({}); }) },
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
