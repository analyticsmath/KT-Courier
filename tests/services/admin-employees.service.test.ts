import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));
const hashPasswordMock = vi.hoisted(() => vi.fn());
const getEffectivePermissionKeysForUserMock = vi.hoisted(() => vi.fn());
const adminUpdateUserMock = vi.hoisted(() => vi.fn());
const recordAdminActivityMock = vi.hoisted(() => vi.fn());
const recordSecurityEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: hashPasswordMock }));
vi.mock("@/lib/auth/permissions", () => ({
  getEffectivePermissionKeysForUser: getEffectivePermissionKeysForUserMock,
}));
vi.mock("@/lib/services/admin-users.service", () => ({
  adminUpdateUser: adminUpdateUserMock,
}));
vi.mock("@/lib/services/admin-activity.service", () => ({
  recordAdminActivity: recordAdminActivityMock,
}));
vi.mock("@/lib/services/security-events.service", () => ({
  SECURITY_EVENT_TYPES: {
    EMPLOYEE_CREATED: "EMPLOYEE_CREATED",
    EMPLOYEE_UPDATED: "EMPLOYEE_UPDATED",
    SELF_PERMISSION_CHANGE_BLOCKED: "SELF_PERMISSION_CHANGE_BLOCKED",
    SUPER_ADMIN_PROTECTION_TRIGGERED: "SUPER_ADMIN_PROTECTION_TRIGGERED",
  },
  recordSecurityEvent: recordSecurityEventMock,
}));

import {
  createAdminEmployee,
  EmployeeServiceError,
  listAdminEmployees,
  updateAdminEmployee,
} from "@/lib/services/admin-employees.service";
import { UserRole, UserStatus } from "@/types/db";

function adminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "admin-1",
    email: "admin@example.test",
    passwordHash: "secret-hash",
    name: "Admin",
    phone: "123",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    lastLoginAt: null,
    adminProfile: {
      id: "profile-1",
      displayName: "Admin Display",
      jobTitle: "Ops",
      department: "Operations",
      phone: "123",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    ...overrides,
  };
}

describe("admin employee service", () => {
  beforeEach(() => {
    prismaMock.user.findMany.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.$transaction.mockReset();
    hashPasswordMock.mockReset();
    getEffectivePermissionKeysForUserMock.mockReset();
    adminUpdateUserMock.mockReset();
    recordAdminActivityMock.mockReset();
    recordSecurityEventMock.mockReset();

    hashPasswordMock.mockResolvedValue("hashed-password");
    getEffectivePermissionKeysForUserMock.mockResolvedValue(["employees.read"]);
  });

  it("lists employees without password hashes", async () => {
    prismaMock.user.findMany.mockResolvedValue([adminUser()]);

    const employees = await listAdminEmployees();

    expect(employees).toHaveLength(1);
    expect(employees[0]).not.toHaveProperty("passwordHash");
    expect(employees[0]).toMatchObject({
      id: "admin-1",
      effectivePermissionCount: 1,
    });
  });

  it("creates ADMIN employees, never SUPER_ADMIN employees", async () => {
    const createdUser = adminUser({
      id: "new-admin",
      email: "new-admin@example.test",
    });
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue(createdUser),
      },
    };
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const employee = await createAdminEmployee({
      input: {
        email: " New-Admin@Example.Test ",
        password: "ChangeMe123!",
        name: "New Admin",
      },
      actor: { id: "super-admin", role: UserRole.SUPER_ADMIN },
    });

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new-admin@example.test",
          passwordHash: "hashed-password",
          role: UserRole.ADMIN,
        }),
      })
    );
    expect(employee?.role).toBe(UserRole.ADMIN);
  });

  it("rejects duplicate employee email addresses as conflicts", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing-user" });

    await expect(
      createAdminEmployee({
        input: {
          email: "admin@example.test",
          password: "ChangeMe123!",
        },
        actor: { id: "super-admin", role: UserRole.SUPER_ADMIN },
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    } satisfies Partial<EmployeeServiceError>);
  });

  it("blocks normal ADMIN users from modifying SUPER_ADMIN accounts", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      adminUser({ id: "super-admin", role: UserRole.SUPER_ADMIN })
    );

    await expect(
      updateAdminEmployee({
        id: "super-admin",
        input: { name: "Changed" },
        actor: { id: "admin-1", role: UserRole.ADMIN },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(recordSecurityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SUPER_ADMIN_PROTECTION_TRIGGERED",
      })
    );
  });

  it("blocks self-lockout through employee status updates", async () => {
    prismaMock.user.findUnique.mockResolvedValue(adminUser({ id: "admin-1" }));

    await expect(
      updateAdminEmployee({
        id: "admin-1",
        input: { status: UserStatus.DISABLED },
        actor: { id: "admin-1", role: UserRole.ADMIN },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(recordSecurityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SELF_PERMISSION_CHANGE_BLOCKED",
      })
    );
  });

  it("updates only safe employee fields directly", async () => {
    const target = adminUser({ id: "admin-2" });
    const updated = adminUser({
      id: "admin-2",
      name: "Updated",
      phone: "555",
    });
    const tx = {
      user: {
        update: vi.fn().mockResolvedValue(updated),
      },
      adminProfile: {
        upsert: vi.fn().mockResolvedValue(updated.adminProfile),
      },
    };
    prismaMock.user.findUnique
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(updated);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    await updateAdminEmployee({
      id: "admin-2",
      input: {
        name: " Updated ",
        phone: " 555 ",
        displayName: " Updated Display ",
        jobTitle: " Lead ",
        department: " Ops ",
      },
      actor: { id: "super-admin", role: UserRole.SUPER_ADMIN },
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "admin-2" },
      data: {
        name: "Updated",
        phone: "555",
      },
    });
    expect(tx.user.update.mock.calls[0][0].data).not.toHaveProperty("role");
    expect(tx.user.update.mock.calls[0][0].data).not.toHaveProperty("status");
    expect(tx.user.update.mock.calls[0][0].data).not.toHaveProperty("passwordHash");
    expect(adminUpdateUserMock).not.toHaveBeenCalled();
  });
});
