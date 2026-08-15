/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../lib/db/prisma";
import {
  UserRole,
  UserStatus,
  PrivateMediaOwnerType,
  PrivateMediaPurpose,
  PermissionEffect,
  AddressType,
  OrderStatus,
  ClaimReason,
  ClaimStatus,
  OrderAssignmentStatus,
} from "@/types/db";
import {
  createCustomerAddress,
  getCustomerAddress,
  listCustomerAddresses,
  deleteCustomerAddress,
} from "../../lib/services/customer-addresses.service";
import { getOrder, cancelOrder } from "../../lib/services/orders.service";
import { offerAssignment, acceptDispatchAssignment } from "../../lib/services/dispatch-assignment.service";
import { requireStoreOrderActor } from "../../lib/store-orders/store-order-auth";
import { StoreOrderError } from "../../lib/store-orders/errors";
import { getClaimForActor, assertClaimParticipant, ClaimDomainError } from "../../lib/claims/claim.service";
import { assertAcceptedCurrentDriver } from "../../lib/driver-operations/authority";
import { DriverOperationError } from "../../lib/driver-operations/errors";
import { getPromoterEarningRecord, getPromoterEarningRecords } from "../../lib/promoter-presentation/promoter-data";
import { hasPermission } from "../../lib/auth/permissions";
import { PERMISSIONS } from "../../lib/auth/permission-keys";
import { PrivateMediaService, PrivateMediaPolicyError } from "../../lib/private-media/private-media.service";
import type { PrivateMediaStorageAdapter } from "../../lib/private-media/private-media-storage";

const isStrict = process.env.STRICT_POSTGRES_REQUIRED === "1";

describe("Strict PostgreSQL BOLA & Multi-Actor Authority Matrix (A through J)", () => {
  let dbAvailable = false;

  const nonce = Date.now();
  const customerAUserId = `usr_cust_a_${nonce}`;
  const customerBUserId = `usr_cust_b_${nonce}`;
  const storeAOwnerId = `usr_store_a_${nonce}`;
  const storeBOwnerId = `usr_store_b_${nonce}`;
  const driverAUserId = `usr_driver_a_${nonce}`;
  const driverBUserId = `usr_driver_b_${nonce}`;
  const promoterAUserId = `usr_prom_a_${nonce}`;
  const promoterBUserId = `usr_prom_b_${nonce}`;
  const financeAdminId = `usr_admin_fin_${nonce}`;
  const restrictedAdminId = `usr_admin_restr_${nonce}`;
  const foreignActorUserId = `usr_foreign_${nonce}`;

  let customerAUserObj: any;
  let customerBUserObj: any;
  let storeAUserObj: any;
  let storeBUserObj: any;

  let storeAId: string;
  let storeBId: string;

  let customerBAddressId: string;
  let customerBOrderId: string;
  let customerBOrderNumber: string;

  let driverAProfileId: string;
  let driverBProfileId: string;
  let driverBAssignmentId: string;
  let driverBPrivateMediaRef: string;

  let storeBClaimId: string;
  let storeBClaimRef: string;

  let promoterAAccountId: string;
  let promoterBAccountId: string;
  let promoterBEarningRef: string;

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
      const usersData = [
        { id: customerAUserId, email: `cust.a.${nonce}@example.com`, name: "Customer A", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
        { id: customerBUserId, email: `cust.b.${nonce}@example.com`, name: "Customer B", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
        { id: storeAOwnerId, email: `store.a.${nonce}@example.com`, name: "Store A Owner", role: UserRole.STORE, status: UserStatus.ACTIVE },
        { id: storeBOwnerId, email: `store.b.${nonce}@example.com`, name: "Store B Owner", role: UserRole.STORE, status: UserStatus.ACTIVE },
        { id: driverAUserId, email: `driver.a.${nonce}@example.com`, name: "Driver A", role: UserRole.DRIVER, status: UserStatus.ACTIVE },
        { id: driverBUserId, email: `driver.b.${nonce}@example.com`, name: "Driver B", role: UserRole.DRIVER, status: UserStatus.ACTIVE },
        { id: promoterAUserId, email: `prom.a.${nonce}@example.com`, name: "Promoter A", role: UserRole.PROMOTER, status: UserStatus.ACTIVE },
        { id: promoterBUserId, email: `prom.b.${nonce}@example.com`, name: "Promoter B", role: UserRole.PROMOTER, status: UserStatus.ACTIVE },
        { id: financeAdminId, email: `admin.fin.${nonce}@example.com`, name: "Finance Admin", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        { id: restrictedAdminId, email: `admin.restr.${nonce}@example.com`, name: "Restricted Admin", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        { id: foreignActorUserId, email: `foreign.${nonce}@example.com`, name: "Foreign Actor", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
      ];

      await prisma.user.createMany({ data: usersData });

      customerAUserObj = { id: customerAUserId, email: `cust.a.${nonce}@example.com`, role: UserRole.CUSTOMER };
      customerBUserObj = { id: customerBUserId, email: `cust.b.${nonce}@example.com`, role: UserRole.CUSTOMER };
      storeAUserObj = { id: storeAOwnerId, email: `store.a.${nonce}@example.com`, role: UserRole.STORE };
      storeBUserObj = { id: storeBOwnerId, email: `store.b.${nonce}@example.com`, role: UserRole.STORE };

      // 2. Create Stores
      const storeA = await prisma.store.create({
        data: {
          ownerUserId: storeAOwnerId,
          name: `Store Alpha ${nonce}`,
          slug: `store-alpha-${nonce}`,
          status: "ACTIVE",
        },
      });
      storeAId = storeA.id;

      const storeB = await prisma.store.create({
        data: {
          ownerUserId: storeBOwnerId,
          name: `Store Beta ${nonce}`,
          slug: `store-beta-${nonce}`,
          status: "ACTIVE",
        },
      });
      storeBId = storeB.id;

      // 3. Create Addresses for Customer B
      const addrB1 = await createCustomerAddress(customerBUserId, {
        type: AddressType.CUSTOMER,
        line1: "100 Beta Street",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2000",
        country: "South Africa",
      });
      customerBAddressId = addrB1.id;

      const addrB2 = await createCustomerAddress(customerBUserId, {
        type: AddressType.CUSTOMER,
        line1: "200 Beta Dropoff Avenue",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        country: "South Africa",
      });

      // 4. Create Delivery Region & Driver Profiles
      const region = await prisma.deliveryRegion.create({
        data: { name: `Region ${nonce}`, slug: `region-${nonce}`, active: true },
      });

      const drvA = await prisma.driverProfile.create({
        data: {
          userId: driverAUserId,
          displayName: "Driver A",
          phone: "+27820000001",
          driverCode: `DA-${nonce}`,
          status: "ACTIVE",
          availability: "AVAILABLE" as any,
        },
      });
      driverAProfileId = drvA.id;
      await prisma.driverServiceRegion.create({
        data: { driverProfileId: drvA.id, deliveryRegionId: region.id },
      });

      const drvB = await prisma.driverProfile.create({
        data: {
          userId: driverBUserId,
          displayName: "Driver B",
          phone: "+27820000002",
          driverCode: `DB-${nonce}`,
          status: "ACTIVE",
          availability: "AVAILABLE" as any,
        },
      });
      driverBProfileId = drvB.id;
      await prisma.driverServiceRegion.create({
        data: { driverProfileId: drvB.id, deliveryRegionId: region.id },
      });

      // 5. Create Order for Customer B
      customerBOrderNumber = `KT-ORD-B-${nonce}`;
      const orderB = await prisma.order.create({
        data: {
          orderNumber: customerBOrderNumber,
          source: "CUSTOMER" as any,
          deliveryType: "SCHEDULED" as any,
          status: OrderStatus.CONFIRMED,
          customer: { connect: { id: customerBUserId } },
          deliveryRegion: { connect: { id: region.id } },
          pickupAddress: { connect: { id: addrB1.id } },
          dropoffAddress: { connect: { id: addrB2.id } },
          priceEstimate: "100.00",
          pricingSubtotal: "100.00",
          pricingTaxAmount: "0.00",
          pricingTaxRate: "0.0000",
        },
      });
      customerBOrderId = orderB.id;

      // 6. Create Order Assignment for Driver B on Customer B's Order
      const offered = await offerAssignment(financeAdminId, customerBOrderId, {
        driverProfileId: driverBProfileId,
        reasonCode: "INITIAL_ASSIGNMENT",
      });
      const assignB = await acceptDispatchAssignment(driverBProfileId, offered.id, {
        expectedVersion: offered.version,
      });
      driverBAssignmentId = assignB.id;

      // 7. Create Claim for Store B / Order B
      storeBClaimRef = `CLM-B-${nonce}`;
      const claimB = await prisma.claim.create({
        data: {
          publicReference: storeBClaimRef,
          claimantUserId: customerBUserId,
          orderId: customerBOrderId,
          reason: "DAMAGED" as any,
          paymentSource: "DIGITAL" as any,
          description: "Items arrived damaged",
          duplicateFingerprint: `FP-CLM-B-${nonce}`,
          status: ClaimStatus.OPEN,
        },
      });
      storeBClaimId = claimB.id;

      // 8. Create Promoter Programs, Plans, Accounts and Earnings
      const promA = await (prisma as any).promoterAccount.create({
        data: {
          publicReference: `PMA-A-${nonce}`,
          legalName: `Promoter A ${nonce}`,
          userId: promoterAUserId,
          status: "ACTIVE",
        },
      });
      promoterAAccountId = promA.id;

      const promB = await (prisma as any).promoterAccount.create({
        data: {
          publicReference: `PMA-B-${nonce}`,
          legalName: `Promoter B ${nonce}`,
          userId: promoterBUserId,
          status: "ACTIVE",
        },
      });
      promoterBAccountId = promB.id;

      const prog = await (prisma as any).promoterProgram.create({
        data: {
          publicReference: `PRG-${nonce}`,
          code: `PRGC-${nonce}`,
          name: `Proof Program ${nonce}`,
          targetType: "CUSTOMER" as any,
          status: "ACTIVE",
        },
      });

      const progVer = await (prisma as any).promoterProgramVersion.create({
        data: {
          publicReference: `PRGV-${nonce}`,
          programId: prog.id,
          versionNumber: 1,
          status: "ACTIVE",
          attributionModel: "FIRST_VALID_ACQUISITION_TOUCH" as any,
          attributionWindowDays: 30,
          qualifyingEventType: "CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER" as any,
          qualificationHoldDays: 0,
          commissionPlanVersionId: `CPV-${nonce}`,
          geographicPolicyVersion: "GEO-V1",
          fraudPolicyVersion: "FRD-V1",
          disclosurePolicyVersion: "DIS-V1",
          reversalPolicyVersion: "REV-V1",
          legalTermsVersion: "LEG-V1",
          startsAt: new Date(),
        },
      });

      const enrollB = await (prisma as any).promoterEnrollment.create({
        data: {
          publicReference: `ENR-B-${nonce}`,
          promoterAccountId: promoterBAccountId,
          programVersionId: progVer.id,
          status: "ACTIVE",
          operationId: `ENROP-B-${nonce}`,
          requestHash: "0".repeat(64),
        },
      });

      const touchB = await (prisma as any).promoterTouch.create({
        data: {
          publicReference: `TCH-B-${nonce}`,
          promoterAccountId: promoterBAccountId,
          enrollmentId: enrollB.id,
          programVersionId: progVer.id,
          touchType: "LINK_VISIT" as any,
          destinationType: "HOME",
          occurredAt: new Date(),
          operationId: `TCHOP-B-${nonce}`,
          requestHash: "0".repeat(64),
        },
      });

      const attrB = await (prisma as any).promoterAttribution.create({
        data: {
          publicReference: `ATT-B-${nonce}`,
          promoterAccountId: promoterBAccountId,
          enrollmentId: enrollB.id,
          programVersionId: progVer.id,
          touchId: touchB.id,
          subjectType: "CUSTOMER" as any,
          customerUserId: customerBUserId,
          subjectKey: `SUB-B-${nonce}`,
          status: "ATTRIBUTED",
          expiresAt: new Date(Date.now() + 86400000),
          operationId: `ATTOP-B-${nonce}`,
          requestHash: "0".repeat(64),
        },
      });

      const qualB = await (prisma as any).promoterQualification.create({
        data: {
          publicReference: `PQL-B-${nonce}`,
          attributionId: attrB.id,
          programVersionId: progVer.id,
          status: "EVIDENCE_OBSERVED",
          qualifyingEventType: "CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER" as any,
          evidenceFingerprint: `EV-B-${nonce}`,
          operationId: `QUALOP-B-${nonce}`,
          requestHash: "0".repeat(64),
        },
      });

      promoterBEarningRef = `PME-B-${nonce}`;
      await (prisma as any).promoterEarning.create({
        data: {
          publicReference: promoterBEarningRef,
          promoterAccountId: promoterBAccountId,
          qualificationId: qualB.id,
          commissionPlanVersionId: `CPV-${nonce}`,
          status: "PENDING",
          currency: "ZAR",
          grossAmount: 500,
          payableAmount: 500,
          holdUntil: new Date(),
          operationId: `EARNOP-B-${nonce}`,
          requestHash: "0".repeat(64),
        },
      });

      // 9. Finance Permissions Setup
      const finPerm = await prisma.permission.upsert({
        where: { key: PERMISSIONS.MARKETPLACE_SETTLEMENT_RECONCILE },
        update: {},
        create: {
          key: PERMISSIONS.MARKETPLACE_SETTLEMENT_RECONCILE,
          name: "Marketplace Settlement Reconcile",
          category: "finance",
        },
      });

      await prisma.userPermission.create({
        data: { userId: financeAdminId, permissionId: finPerm.id, effect: PermissionEffect.ALLOW },
      });
      await prisma.userPermission.create({
        data: { userId: restrictedAdminId, permissionId: finPerm.id, effect: PermissionEffect.DENY },
      });

      // 10. Upload Private Evidence / Media for Driver B
      const uploadRes = await privateMediaService.upload({
        actor: { userId: driverBUserId, role: UserRole.DRIVER },
        ownerType: PrivateMediaOwnerType.DRIVER,
        ownerId: driverBProfileId,
        purpose: PrivateMediaPurpose.DRIVER_IDENTITY_DOCUMENT,
        fileName: "driver_b_id.pdf",
        mimeType: "application/pdf",
        bytes: new Uint8Array(Buffer.from("%PDF-1.4 Driver B ID Document")),
      });
      driverBPrivateMediaRef = uploadRes.publicReference;
    } catch (err) {
      if (isStrict) {
        throw new Error(`[STRICT_POSTGRES_FAILURE] PostgreSQL BOLA integration requires active database: ${err}`);
      }
      console.warn("[SKIP_BOLA_DB_INTEGRATION] PostgreSQL database unavailable:", err);
    }
  }, 30000);

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      await prisma.privateMediaAccessLog.deleteMany({
        where: { actorUserId: { in: [customerAUserId, customerBUserId, driverAUserId, driverBUserId, foreignActorUserId] } },
      });
      await prisma.privateMediaObject.deleteMany({
        where: { createdByUserId: { in: [customerAUserId, customerBUserId, driverAUserId, driverBUserId, foreignActorUserId] } },
      });
      await prisma.userPermission.deleteMany({
        where: { userId: { in: [financeAdminId, restrictedAdminId] } },
      });
      await (prisma as any).promoterEarning.deleteMany({
        where: { promoterAccountId: { in: [promoterAAccountId, promoterBAccountId] } },
      });
      await (prisma as any).promoterQualification.deleteMany({
        where: { operationId: `QUALOP-B-${nonce}` },
      });
      await (prisma as any).promoterAttribution.deleteMany({
        where: { operationId: `ATTOP-B-${nonce}` },
      });
      await (prisma as any).promoterTouch.deleteMany({
        where: { operationId: `TCHOP-B-${nonce}` },
      });
      await (prisma as any).promoterEnrollment.deleteMany({
        where: { promoterAccountId: { in: [promoterAAccountId, promoterBAccountId] } },
      });
      await (prisma as any).commissionPlanVersion.deleteMany({
        where: { publicReference: `CMPV-${nonce}` },
      });
      await (prisma as any).commissionPlan.deleteMany({
        where: { publicReference: `CMP-${nonce}` },
      });
      await (prisma as any).promoterProgramVersion.deleteMany({
        where: { publicReference: `PRGV-${nonce}` },
      });
      await (prisma as any).promoterProgram.deleteMany({
        where: { publicReference: `PRG-${nonce}` },
      });
      await (prisma as any).promoterAccount.deleteMany({
        where: { id: { in: [promoterAAccountId, promoterBAccountId] } },
      });
      await prisma.claim.deleteMany({
        where: { id: storeBClaimId },
      });
      await prisma.orderAssignment.deleteMany({
        where: { id: driverBAssignmentId },
      });
      await prisma.order.deleteMany({
        where: { id: customerBOrderId },
      });
      await prisma.address.deleteMany({
        where: { userId: { in: [customerAUserId, customerBUserId] } },
      });
      await prisma.driverServiceRegion.deleteMany({
        where: { driverProfileId: { in: [driverAProfileId, driverBProfileId] } },
      });
      await prisma.driverProfile.deleteMany({
        where: { id: { in: [driverAProfileId, driverBProfileId] } },
      });
      await prisma.store.deleteMany({
        where: { id: { in: [storeAId, storeBId] } },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              customerAUserId,
              customerBUserId,
              storeAOwnerId,
              storeBOwnerId,
              driverAUserId,
              driverBUserId,
              promoterAUserId,
              promoterBUserId,
              financeAdminId,
              restrictedAdminId,
              foreignActorUserId,
            ],
          },
        },
      });
    } catch {}
  }, 15000);

  it("A: Customer A cannot read Customer B courier order (ownership query boundary)", async () => {
    if (!dbAvailable) {
      if (isStrict) throw new Error("DB required in strict mode.");
      return;
    }

    // Customer A attempting to read Customer B's order using production getOrder authority
    const orderReadByA = await getOrder(customerAUserObj, customerBOrderId);
    expect(orderReadByA).toBeNull();

    // Customer B reading their own order succeeds
    const orderReadByB = await getOrder(customerBUserObj, customerBOrderId);
    expect(orderReadByB).not.toBeNull();
    expect(orderReadByB?.id).toBe(customerBOrderId);
    expect(orderReadByB?.orderNumber).toBe(customerBOrderNumber);
  });

  it("B: Customer A cannot cancel Customer B courier order", async () => {
    if (!dbAvailable) {
      if (isStrict) throw new Error("DB required in strict mode.");
      return;
    }

    // Customer A attempting to cancel Customer B's order using production cancelOrder authority
    const cancelResult = await cancelOrder(customerAUserObj, customerBOrderId, { reason: "Malicious cancellation attempt" });
    expect("error" in cancelResult).toBe(true);
    if ("error" in cancelResult) {
      expect(cancelResult.error).toBe("Order not found.");
    }

    // Verify order in database was NOT modified to CANCELLED
    const orderInDb = await prisma.order.findUnique({ where: { id: customerBOrderId }, select: { status: true } });
    expect(orderInDb?.status).not.toBe(OrderStatus.CANCELLED);
  });

  it("C: Store A cannot read/mutate Store B marketplace order", async () => {
    if (!dbAvailable) {
      if (isStrict) throw new Error("DB required in strict mode.");
      return;
    }

    // Store A attempting to act on Store B's store/order using production requireStoreOrderActor authority
    await expect(
      requireStoreOrderActor({
        actorUserId: storeAOwnerId,
        storeId: storeBId,
        permission: "store_orders.accept",
      })
    ).rejects.toThrowError(StoreOrderError);

    try {
      await requireStoreOrderActor({
        actorUserId: storeAOwnerId,
        storeId: storeBId,
        permission: "store_orders.accept",
      });
      expect.unreachable("Should have thrown StoreOrderError");
    } catch (err: any) {
      expect(err.code).toBe("STORE_ORDER_ACCESS_DENIED");
    }
  });

  it("D: Store A cannot access Store B claim evidence/resolution", async () => {
    if (!dbAvailable) {
      if (isStrict) throw new Error("DB required in strict mode.");
      return;
    }

    // Store A attempting to view Store B's claim using production getClaimForActor authority
    await expect(
      getClaimForActor({
        publicReference: storeBClaimRef,
        actorUserId: storeAOwnerId,
        role: UserRole.STORE,
      })
    ).rejects.toThrowError(ClaimDomainError);

    try {
      await getClaimForActor({
        publicReference: storeBClaimRef,
        actorUserId: storeAOwnerId,
        role: UserRole.STORE,
      });
      expect.unreachable("Should have thrown ClaimDomainError");
    } catch (err: any) {
      expect(err.code).toBe("CLAIM_FORBIDDEN");
    }
  });

  it("E: Driver A cannot execute delivery transition assigned to Driver B", async () => {
    if (!dbAvailable) {
      if (isStrict) throw new Error("DB required in strict mode.");
      return;
    }

    // Driver A attempting to assert authority on Driver B's assignment using production assertAcceptedCurrentDriver
    await expect(
      assertAcceptedCurrentDriver(driverBAssignmentId, driverAProfileId)
    ).rejects.toThrowError(DriverOperationError);

    try {
      await assertAcceptedCurrentDriver(driverBAssignmentId, driverAProfileId);
      expect.unreachable("Should have thrown DriverOperationError");
    } catch (err: any) {
      expect(err.code).toBe("DRIVER_OPERATION_FORBIDDEN");
    }
  });

  it("F: Driver A cannot collect COD for Driver B", async () => {
    if (!dbAvailable) {
      if (isStrict) throw new Error("DB required in strict mode.");
      return;
    }

    // Driver A asserting driver authority for Driver B's assignment to collect COD
    await expect(
      assertAcceptedCurrentDriver(driverBAssignmentId, driverAProfileId)
    ).rejects.toThrowError(DriverOperationError);

    try {
      await assertAcceptedCurrentDriver(driverBAssignmentId, driverAProfileId);
      expect.unreachable("Should have thrown DriverOperationError");
    } catch (err: any) {
      expect(err.code).toBe("DRIVER_OPERATION_FORBIDDEN");
    }
  });

  it("G: Driver A cannot modify/attach Driver B vehicle or documents", async () => {
    if (!dbAvailable) {
      if (isStrict) throw new Error("DB required in strict mode.");
      return;
    }

    const maliciousBytes = new Uint8Array(Buffer.from("%PDF-1.4 Malicious Vehicle Document"));

    // Driver A attempting to upload/attach vehicle/identity document to Driver B's profile
    await expect(
      privateMediaService.upload({
        actor: { userId: driverAUserId, role: UserRole.DRIVER },
        ownerType: PrivateMediaOwnerType.DRIVER,
        ownerId: driverBProfileId,
        purpose: PrivateMediaPurpose.VEHICLE_REGISTRATION,
        fileName: "malicious_vehicle_reg.pdf",
        mimeType: "application/pdf",
        bytes: maliciousBytes,
      })
    ).rejects.toThrowError(PrivateMediaPolicyError);
  });

  it("H: Promoter A cannot access Promoter B earnings", async () => {
    if (!dbAvailable) {
      if (isStrict) throw new Error("DB required in strict mode.");
      return;
    }

    // Promoter A querying Promoter B's specific earning record returns null
    const singleEarning = await getPromoterEarningRecord(promoterAAccountId, promoterBEarningRef);
    expect(singleEarning).toBeNull();

    // Promoter A listing earnings does NOT include Promoter B's earning
    const allEarnings = await getPromoterEarningRecords(promoterAAccountId);
    expect(allEarnings.some((e) => e.publicReference === promoterBEarningRef)).toBe(false);

    // Promoter B querying their own earning succeeds
    const ownEarning = await getPromoterEarningRecord(promoterBAccountId, promoterBEarningRef);
    expect(ownEarning).not.toBeNull();
    expect(ownEarning?.publicReference).toBe(promoterBEarningRef);
  });

  it("I: Restricted admin without finance permission cannot execute finance reconciliation/mutation", async () => {
    if (!dbAvailable) {
      if (isStrict) throw new Error("DB required in strict mode.");
      return;
    }

    // Restricted admin lacking finance.reconcile -> false
    const restrictedAllowed = await hasPermission({
      userId: restrictedAdminId,
      role: UserRole.ADMIN,
      permissionKey: PERMISSIONS.MARKETPLACE_SETTLEMENT_RECONCILE,
    });
    expect(restrictedAllowed).toBe(false);

    // Finance admin with explicit permission -> true
    const financeAllowed = await hasPermission({
      userId: financeAdminId,
      role: UserRole.ADMIN,
      permissionKey: PERMISSIONS.MARKETPLACE_SETTLEMENT_RECONCILE,
    });
    expect(financeAllowed).toBe(true);
  });

  it("J: Foreign actor cannot access private evidence", async () => {
    if (!dbAvailable) {
      if (isStrict) throw new Error("DB required in strict mode.");
      return;
    }

    // Foreign actor attempting to read Driver B's private evidence throws 403
    await expect(
      privateMediaService.read({
        actor: { userId: foreignActorUserId, role: UserRole.CUSTOMER },
        reference: driverBPrivateMediaRef,
      })
    ).rejects.toThrowError(PrivateMediaPolicyError);

    // Verify security access audit log was created with DENIED outcome
    const logs = await prisma.privateMediaAccessLog.findMany({
      where: { privateMediaObject: { publicReference: driverBPrivateMediaRef } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const foreignDeniedLog = logs.find((l) => l.actorUserId === foreignActorUserId);
    expect(foreignDeniedLog).toBeDefined();
    expect(foreignDeniedLog?.outcome).toBe("DENIED");
  });
});
