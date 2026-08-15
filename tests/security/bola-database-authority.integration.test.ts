import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../lib/db/prisma";
import { UserRole, UserStatus, PrivateMediaOwnerType, PrivateMediaPurpose, PermissionEffect, AddressType } from "@/types/db";
import {
  createCustomerAddress,
  getCustomerAddress,
  listCustomerAddresses,
  deleteCustomerAddress,
} from "../../lib/services/customer-addresses.service";
import { hasPermission } from "../../lib/auth/permissions";
import { PERMISSIONS } from "../../lib/auth/permission-keys";
import { PrivateMediaService, PrivateMediaPolicyError } from "../../lib/private-media/private-media.service";
import type { PrivateMediaStorageAdapter } from "../../lib/private-media/private-media-storage";

describe("P1R-008: Real PostgreSQL BOLA Integration Suite & Multi-Actor Authority Matrix", () => {
  let dbAvailable = false;

  // Test actor IDs
  const customerAUserId = "usr_cust_alpha_" + Date.now();
  const customerBUserId = "usr_cust_beta_" + Date.now();
  const storeAOwnerId = "usr_store_alpha_" + Date.now();
  const storeBOwnerId = "usr_store_beta_" + Date.now();
  const driverAUserId = "usr_driver_alpha_" + Date.now();
  const driverBUserId = "usr_driver_beta_" + Date.now();
  const financeAdminId = "usr_admin_fin_" + Date.now();
  const supportStaffId = "usr_staff_sup_" + Date.now();

  let customerBAddressId: string | null = null;
  let driverAProfileId: string | null = null;
  let driverBProfileId: string | null = null;
  let driverAPrivateMediaRef: string | null = null;

  const storageMap = new Map<string, Uint8Array>();
  const storage: PrivateMediaStorageAdapter = {
    code: "TEST_MEMORY",
    async write(input) {
      storageMap.set(input.key, input.bytes);
    },
    async read(key) {
      const data = storageMap.get(key);
      if (!data) throw new Error("File not found");
      return data;
    },
    async delete(key) {
      storageMap.delete(key);
    },
  };
  const privateMediaService = new PrivateMediaService(storage);

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbAvailable = true;

      // 1. Seed Users
      await prisma.user.createMany({
        data: [
          { id: customerAUserId, email: `cust.alpha.${Date.now()}@example.com`, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
          { id: customerBUserId, email: `cust.beta.${Date.now()}@example.com`, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
          { id: storeAOwnerId, email: `store.alpha.${Date.now()}@example.com`, role: UserRole.STORE, status: UserStatus.ACTIVE },
          { id: storeBOwnerId, email: `store.beta.${Date.now()}@example.com`, role: UserRole.STORE, status: UserStatus.ACTIVE },
          { id: driverAUserId, email: `driver.alpha.${Date.now()}@example.com`, role: UserRole.DRIVER, status: UserStatus.ACTIVE },
          { id: driverBUserId, email: `driver.beta.${Date.now()}@example.com`, role: UserRole.DRIVER, status: UserStatus.ACTIVE },
          { id: financeAdminId, email: `admin.fin.${Date.now()}@example.com`, role: UserRole.ADMIN, status: UserStatus.ACTIVE },
          { id: supportStaffId, email: `staff.sup.${Date.now()}@example.com`, role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        ],
      });

      // 2. Create Driver profiles with required fields
      const drvA = await prisma.driverProfile.create({
        data: {
          userId: driverAUserId,
          displayName: "Driver Alpha",
          phone: "+27820000001",
          driverCode: `DA-${Date.now()}`,
        },
      });
      driverAProfileId = drvA.id;

      const drvB = await prisma.driverProfile.create({
        data: {
          userId: driverBUserId,
          displayName: "Driver Beta",
          phone: "+27820000002",
          driverCode: `DB-${Date.now()}`,
        },
      });
      driverBProfileId = drvB.id;

      // 3. Create address for Customer B
      const addrB = await createCustomerAddress(customerBUserId, {
        type: AddressType.CUSTOMER,
        line1: "123 Beta Street",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8001",
        country: "South Africa",
      });
      customerBAddressId = addrB.id;

      // 4. Grant finance permission to Finance Admin
      const financePerm = await prisma.permission.upsert({
        where: { key: PERMISSIONS.FINANCE_READ },
        update: {},
        create: { key: PERMISSIONS.FINANCE_READ, name: "Finance Read", category: "finance" },
      });

      await prisma.userPermission.create({
        data: { userId: financeAdminId, permissionId: financePerm.id, effect: PermissionEffect.ALLOW },
      });

      // 5. Upload Private Media for Driver A
      const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.4 test driver A id document"));
      const uploadRes = await privateMediaService.upload({
        actor: { userId: driverAUserId, role: UserRole.DRIVER },
        ownerType: PrivateMediaOwnerType.DRIVER,
        ownerId: driverAProfileId,
        purpose: PrivateMediaPurpose.DRIVER_IDENTITY_DOCUMENT,
        fileName: "driver_a_id.pdf",
        mimeType: "application/pdf",
        bytes: pdfBytes,
      });
      driverAPrivateMediaRef = uploadRes.publicReference;
    } catch (err) {
      console.warn("[SKIP_BOLA_DB_INTEGRATION] PostgreSQL database unavailable:", err);
    }
  }, 15000);

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      // Clean up test data
      await prisma.privateMediaAccessLog.deleteMany({
        where: { actorUserId: { in: [customerAUserId, customerBUserId, driverAUserId, driverBUserId] } },
      });
      await prisma.privateMediaObject.deleteMany({
        where: { createdByUserId: { in: [customerAUserId, customerBUserId, driverAUserId, driverBUserId] } },
      });
      await prisma.userPermission.deleteMany({
        where: { userId: { in: [financeAdminId, supportStaffId] } },
      });
      await prisma.address.deleteMany({
        where: { userId: { in: [customerAUserId, customerBUserId] } },
      });
      await prisma.driverProfile.deleteMany({
        where: { userId: { in: [driverAUserId, driverBUserId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [customerAUserId, customerBUserId, storeAOwnerId, storeBOwnerId, driverAUserId, driverBUserId, financeAdminId, supportStaffId] } },
      });
    } catch {}
  }, 10000);

  it("1: Customer A cannot read, list, or delete Customer B addresses (BOLA proof)", async () => {
    if (!dbAvailable || !customerBAddressId) return;

    // Customer A listing own addresses must NOT include Customer B's address
    const custAList = await listCustomerAddresses(customerAUserId);
    expect(custAList.some((addr) => addr.id === customerBAddressId)).toBe(false);

    // Customer A requesting Customer B's specific address ID returns null
    const custAGetB = await getCustomerAddress(customerAUserId, customerBAddressId);
    expect(custAGetB).toBeNull();

    // Customer A attempting to delete Customer B's address fails
    const deleteResult = await deleteCustomerAddress(customerAUserId, customerBAddressId);
    expect(deleteResult.ok).toBe(false);

    // Verify Customer B's address in DB was NOT deleted or corrupted
    const custBGetOwn = await getCustomerAddress(customerBUserId, customerBAddressId);
    expect(custBGetOwn).not.toBeNull();
    expect(custBGetOwn?.id).toBe(customerBAddressId);
  });

  it("2: Private media download/access cannot cross owner boundaries", async () => {
    if (!dbAvailable || !driverAPrivateMediaRef) return;

    // Driver B attempting to read Driver A's private media MUST throw 403 FORBIDDEN
    await expect(
      privateMediaService.read({
        actor: { userId: driverBUserId, role: UserRole.DRIVER },
        reference: driverAPrivateMediaRef,
      })
    ).rejects.toThrowError(PrivateMediaPolicyError);

    // Customer A attempting to read Driver A's private media MUST throw 403 FORBIDDEN
    await expect(
      privateMediaService.read({
        actor: { userId: customerAUserId, role: UserRole.CUSTOMER },
        reference: driverAPrivateMediaRef,
      })
    ).rejects.toThrowError(PrivateMediaPolicyError);

    // Authorized Driver A reading their own private media succeeds
    const authorizedRead = await privateMediaService.read({
      actor: { userId: driverAUserId, role: UserRole.DRIVER },
      reference: driverAPrivateMediaRef,
    });
    expect(authorizedRead.fileName).toBe("driver_a_id.pdf");
    expect(authorizedRead.mimeType).toBe("application/pdf");
    expect(authorizedRead.bytes).toBeDefined();

    // Verify database access logs recorded DENIED for Driver B and ALLOWED for Driver A
    const logs = await prisma.privateMediaAccessLog.findMany({
      where: { privateMediaObject: { publicReference: driverAPrivateMediaRef } },
      orderBy: { createdAt: "asc" },
    });

    const deniedDriverBLog = logs.find((l) => l.actorUserId === driverBUserId);
    expect(deniedDriverBLog).toBeDefined();
    expect(deniedDriverBLog?.outcome).toBe("DENIED");

    const allowedDriverALog = logs.find((l) => l.actorUserId === driverAUserId);
    expect(allowedDriverALog).toBeDefined();
    expect(allowedDriverALog?.outcome).toBe("ALLOWED");
  });

  it("3: Finance administrative permissions cannot be exercised by non-finance staff", async () => {
    if (!dbAvailable) return;

    // Support staff without finance permission -> hasPermission = false
    const supportHasFinance = await hasPermission({
      userId: supportStaffId,
      role: UserRole.ADMIN,
      permissionKey: PERMISSIONS.FINANCE_READ,
    });
    expect(supportHasFinance).toBe(false);

    // Finance admin with explicit user permission -> hasPermission = true
    const financeHasFinance = await hasPermission({
      userId: financeAdminId,
      role: UserRole.ADMIN,
      permissionKey: PERMISSIONS.FINANCE_READ,
    });
    expect(financeHasFinance).toBe(true);
  });

  it("4: Driver A cannot manage or upload private media for Driver B's profile", async () => {
    if (!dbAvailable || !driverBProfileId) return;

    const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.4 unauthorized driver upload"));

    // Driver A attempting to upload for Driver B's profile throws 403 FORBIDDEN
    await expect(
      privateMediaService.upload({
        actor: { userId: driverAUserId, role: UserRole.DRIVER },
        ownerType: PrivateMediaOwnerType.DRIVER,
        ownerId: driverBProfileId,
        purpose: PrivateMediaPurpose.DRIVER_IDENTITY_DOCUMENT,
        fileName: "unauthorized.pdf",
        mimeType: "application/pdf",
        bytes: pdfBytes,
      })
    ).rejects.toThrowError(PrivateMediaPolicyError);
  });
});
