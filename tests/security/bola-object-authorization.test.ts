import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserRole, PrivateMediaOwnerType, PermissionEffect } from "@/types/db";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { hasPermission } from "@/lib/auth/permissions";
import {
  listCustomerAddresses,
  getCustomerAddress,
  deleteCustomerAddress,
} from "@/lib/services/customer-addresses.service";
import { PrivateMediaService, PrivateMediaPolicyError } from "@/lib/private-media/private-media.service";
import type { PrivateMediaStorageAdapter } from "@/lib/private-media/private-media-storage";

const prismaMock = vi.hoisted(() => ({
  permission: {
    count: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  rolePermission: {
    findMany: vi.fn(),
  },
  userPermission: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  address: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  privateMediaObject: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  driverProfile: {
    findUnique: vi.fn(),
  },
  vehicle: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  store: {
    findUnique: vi.fn(),
  },
  claim: {
    findUnique: vi.fn(),
  },
  marketplaceStoreOrder: {
    findFirst: vi.fn(),
  },
  privateMediaAccessLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

describe("Workstream C / P1R-008: BOLA & Object-Level Authorization Adversarial Matrix", () => {
  let privateMediaService: PrivateMediaService;
  const mockStorage: PrivateMediaStorageAdapter = {
    code: "MOCK_STORAGE",
    write: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.permission.count.mockResolvedValue(1);
    prismaMock.rolePermission.findMany.mockResolvedValue([]);
    prismaMock.userPermission.findMany.mockResolvedValue([]);
    prismaMock.userPermission.findFirst.mockResolvedValue(null);

    privateMediaService = new PrivateMediaService(mockStorage);
  });

  describe("1. Customer vs Customer Object Boundaries (Customer Addresses)", () => {
    it("proves listCustomerAddresses strictly scopes queries by userId in where clause", async () => {
      const customerAId = "cust-user-a";
      prismaMock.address.findMany.mockResolvedValue([]);

      await listCustomerAddresses(customerAId);

      expect(prismaMock.address.findMany).toHaveBeenCalledWith({
        where: { userId: customerAId, storeId: null },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      });
    });

    it("proves Customer A querying Customer B address returns null due to userId scoping", async () => {
      const customerAId = "cust-user-a";
      const customerBAddressId = "addr-b-123";
      
      prismaMock.address.findFirst.mockResolvedValue(null);

      const result = await getCustomerAddress(customerAId, customerBAddressId);

      expect(result).toBeNull();
      expect(prismaMock.address.findFirst).toHaveBeenCalledWith({
        where: { id: customerBAddressId, userId: customerAId, storeId: null },
      });
    });

    it("proves Customer A deleting Customer B address returns ok=false without database mutation", async () => {
      const customerAId = "cust-user-a";
      const customerBAddressId = "addr-b-123";

      // findFirst returns null because customerA does not own customerB address
      prismaMock.address.findFirst.mockResolvedValue(null);

      const deleted = await deleteCustomerAddress(customerAId, customerBAddressId);

      expect(deleted.ok).toBe(false);
      expect(prismaMock.address.findFirst).toHaveBeenCalledWith({
        where: { id: customerBAddressId, userId: customerAId, storeId: null },
        select: expect.any(Object),
      });
      expect(prismaMock.address.delete).not.toHaveBeenCalled();
    });
  });

  describe("2. Private Media Object Authorization Boundaries", () => {
    it("proves non-existent private media throws 404 NOT_FOUND", async () => {
      prismaMock.privateMediaObject.findUnique.mockResolvedValue(null);

      await expect(
        privateMediaService.read({
          actor: { userId: "user-123", role: UserRole.CUSTOMER },
          reference: "PMO-nonexistent",
        })
      ).rejects.toThrowError(PrivateMediaPolicyError);
    });

    it("proves Driver B attempting to read Driver A private media throws 403 FORBIDDEN and logs DENIED", async () => {
      const driverAProfileId = "driver-prof-a";
      const driverBUserId = "user-driver-b";
      const mediaRef = "PMO-driver-a-id";

      prismaMock.privateMediaObject.findUnique.mockResolvedValue({
        id: "pmo-123",
        publicReference: mediaRef,
        ownerType: PrivateMediaOwnerType.DRIVER,
        ownerId: driverAProfileId,
        status: "READY",
        storageKey: "private-media/pmo-123",
        declaredMimeType: "application/pdf",
        detectedMimeType: "application/pdf",
        originalFileName: "driver_a.pdf",
      });

      prismaMock.driverProfile.findUnique.mockResolvedValue({ id: "driver-prof-b" });
      prismaMock.privateMediaAccessLog.create.mockResolvedValue({ id: "log-1" });

      await expect(
        privateMediaService.read({
          actor: { userId: driverBUserId, role: UserRole.DRIVER },
          reference: mediaRef,
        })
      ).rejects.toThrowError("You cannot access this private media.");

      expect(prismaMock.privateMediaAccessLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          privateMediaObjectId: "pmo-123",
          actorUserId: driverBUserId,
          action: "READ",
          outcome: "DENIED",
        }),
      });
    });

    it("proves Customer A attempting to read Driver A private media throws 403 FORBIDDEN", async () => {
      const driverAProfileId = "driver-prof-a";
      const customerAUserId = "user-customer-a";
      const mediaRef = "PMO-driver-a-id";

      prismaMock.privateMediaObject.findUnique.mockResolvedValue({
        id: "pmo-123",
        publicReference: mediaRef,
        ownerType: PrivateMediaOwnerType.DRIVER,
        ownerId: driverAProfileId,
        status: "READY",
        storageKey: "private-media/pmo-123",
        declaredMimeType: "application/pdf",
      });

      prismaMock.driverProfile.findUnique.mockResolvedValue(null);
      prismaMock.privateMediaAccessLog.create.mockResolvedValue({ id: "log-2" });

      await expect(
        privateMediaService.read({
          actor: { userId: customerAUserId, role: UserRole.CUSTOMER },
          reference: mediaRef,
        })
      ).rejects.toThrowError("You cannot access this private media.");
    });
  });

  describe("3. Administrative & Finance Privilege Boundaries", () => {
    it("proves regular Customer without finance permissions receives false from hasPermission", async () => {
      prismaMock.permission.findUnique.mockResolvedValue(null);

      const result = await hasPermission({
        userId: "cust-user-123",
        role: UserRole.CUSTOMER,
        permissionKey: PERMISSIONS.FINANCE_READ,
      });

      expect(result).toBe(false);
    });

    it("proves explicit DENY overrides role-based permissions", async () => {
      prismaMock.permission.findUnique.mockResolvedValue({
        id: "perm-orders",
        key: PERMISSIONS.ORDERS_READ,
        rolePermissions: [{ id: "rp-1", role: UserRole.ADMIN, enabled: true }],
        userPermissions: [{ id: "deny-1", effect: PermissionEffect.DENY }],
      });

      const result = await hasPermission({
        userId: "admin-user-123",
        role: UserRole.ADMIN,
        permissionKey: PERMISSIONS.ORDERS_READ,
      });

      expect(result).toBe(false);
    });

    it("proves Admin with explicit ALLOW permission evaluates to true", async () => {
      prismaMock.permission.findUnique.mockResolvedValue({
        id: "perm-fin",
        key: PERMISSIONS.FINANCE_READ,
        rolePermissions: [],
        userPermissions: [{ id: "allow-1", effect: PermissionEffect.ALLOW }],
      });

      const result = await hasPermission({
        userId: "finance-admin-123",
        role: UserRole.ADMIN,
        permissionKey: PERMISSIONS.FINANCE_READ,
      });

      expect(result).toBe(true);
    });
  });
});
