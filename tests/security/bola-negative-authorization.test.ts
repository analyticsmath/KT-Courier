/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UserRole, OrderAssignmentStatus, OrderStatus, DriverStatus } from '@/types/db';
import { hashOtp } from '@/lib/auth/otp';
import { hashToken } from '@/lib/auth/tokens';
import {
  updateStoreCatalogOffer,
  transitionStoreCatalogOffer,
} from '@/lib/services/store-offer.service';
import { createStoreOfferPriceVersion } from '@/lib/services/store-price.service';
import { postCatalogInventoryMovement } from '@/lib/services/catalog-inventory.service';
import {
  beginStoreOrderReview,
  acceptMarketplaceStoreOrder,
} from '@/lib/store-orders/store-order.service';
import { StoreOrderError } from '@/lib/store-orders/errors';
import { CatalogOwnershipError } from '@/lib/catalog/errors';
import { assertAcceptedCurrentDriver } from '@/lib/driver-operations/authority';
import { DriverOperationError } from '@/lib/driver-operations/errors';
import { verifyDeliveryOtpInTx } from '@/lib/services/delivery-otp.service';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  store: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  storeCatalogOffer: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  catalogInventoryItem: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  catalogInventoryLevel: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  catalogInventoryMovement: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  inventoryLocation: {
    findFirst: vi.fn(),
  },
  permission: {
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  rolePermission: {
    findMany: vi.fn(),
  },
  userPermission: {
    findFirst: vi.fn(),
  },
  marketplaceStoreOrder: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  marketplaceStoreOrderOperation: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  marketplaceStoreOrderHistory: {
    create: vi.fn(),
  },
  marketplaceStoreOrderEventIntent: {
    create: vi.fn(),
  },
  orderAssignment: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  deliveryOtp: {
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  proofOfDelivery: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  catalogEvidenceLedger: {
    create: vi.fn(),
  },
  $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prismaMock) : Promise.all(cb))),
  $queryRaw: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

describe('Workstream H / Amendment 13: BOLA / BOPLA / BFLA Negative Authorization Matrix', () => {
  const storeAId = 'store_alpha_111';
  const storeBId = 'store_beta_222';
  const storeAOwnerId = 'user_store_a';

  const storeBOfferRef = 'CO_store_b_offer_999';
  const storeBInventoryRef = 'CII_store_b_inv_888';
  const storeBOrderRef = 'mso_beta_order_777';

  const driverAUserId = 'usr_driver_a';
  const driverBUserId = 'usr_driver_b';
  const driverAProfileId = 'driver_prof_a';
  const driverBProfileId = 'driver_prof_b';
  const assignmentBId = 'asgn_driver_b_555';
  const orderBId = 'ord_customer_b_444';

  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation((cb) =>
      typeof cb === 'function' ? cb(prismaMock) : Promise.all(cb)
    );
  });

  describe('1. Multi-Tenant Store Catalog & Offer Isolation (Predicate Enforcement)', () => {
    it('proves updateStoreCatalogOffer carries storeId into findFirst where clause and rejects cross-tenant edits', async () => {
      // Store A tries to update Store B offer
      // Database query findFirst with where: { publicReference, storeId: storeAId } returns null
      prismaMock.storeCatalogOffer.findFirst.mockResolvedValue(null);
      // Secondary check reveals it exists under Store B
      prismaMock.storeCatalogOffer.findUnique.mockResolvedValue({ id: 'off-b', storeId: storeBId });

      await expect(
        updateStoreCatalogOffer(storeAId, storeBOfferRef, storeAOwnerId, {
          version: 1,
          operationId: 'op_update_catalog_cross_tenant_1',
          merchantTitle: 'Hacked Title',
        })
      ).rejects.toThrowError(CatalogOwnershipError);

      // Verify the query predicate carried storeId directly in the database lookup
      expect(prismaMock.storeCatalogOffer.findFirst).toHaveBeenCalledWith({
        where: { publicReference: storeBOfferRef, storeId: storeAId },
      });
      // Verify no mutation occurred
      expect(prismaMock.storeCatalogOffer.updateMany).not.toHaveBeenCalled();
    });

    it('proves transitionStoreCatalogOffer carries storeId in where predicate and rejects cross-tenant transition', async () => {
      prismaMock.storeCatalogOffer.findFirst.mockResolvedValue(null);
      prismaMock.storeCatalogOffer.findUnique.mockResolvedValue({ id: 'off-b', storeId: storeBId });

      await expect(
        transitionStoreCatalogOffer(storeAId, storeBOfferRef, storeAOwnerId, 'SUBMITTED', {
          version: 1,
          operationId: 'op_transition_cross_tenant_2',
        })
      ).rejects.toThrowError(CatalogOwnershipError);

      expect(prismaMock.storeCatalogOffer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publicReference: storeBOfferRef, storeId: storeAId },
        })
      );
    });

    it('proves createStoreOfferPriceVersion scopes offer to storeId and rejects cross-tenant pricing', async () => {
      prismaMock.storeCatalogOffer.findFirst.mockResolvedValue(null);
      prismaMock.storeCatalogOffer.findUnique.mockResolvedValue({ id: 'off-b', storeId: storeBId });

      await expect(
        createStoreOfferPriceVersion(storeAId, storeAOwnerId, {
          offerPublicReference: storeBOfferRef,
          amount: '199.99',
          currency: 'ZAR',
          priceIncludesTax: true,
          effectiveFrom: new Date().toISOString(),
          offerVersion: 1,
          operationId: 'op_price_cross_tenant_3',
        })
      ).rejects.toThrowError(CatalogOwnershipError);

      expect(prismaMock.storeCatalogOffer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publicReference: storeBOfferRef, storeId: storeAId },
        })
      );
    });

    it('proves postCatalogInventoryMovement scopes inventoryItem to offer.storeId and rejects cross-tenant movements', async () => {
      prismaMock.catalogInventoryItem.findFirst.mockResolvedValue(null);
      prismaMock.catalogInventoryItem.findUnique.mockResolvedValue({
        id: 'inv-b',
        publicReference: storeBInventoryRef,
        offer: { storeId: storeBId },
      });

      await expect(
        postCatalogInventoryMovement(storeAId, storeAOwnerId, storeBInventoryRef, {
          type: 'STOCK_RECEIPT',
          quantityDelta: 50,
          locationPublicReference: 'LOC-1',
          operationId: 'op_inv_cross_tenant_4',
          reasonCode: 'RESTOCK',
          version: 1,
        })
      ).rejects.toThrowError(CatalogOwnershipError);

      expect(prismaMock.catalogInventoryItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publicReference: storeBInventoryRef, offer: { storeId: storeAId } },
        })
      );
    });
  });

  describe('2. Multi-Tenant Store Order Isolation (Predicate & Ownership Enforcement)', () => {
    it('proves Store A cannot review Store B marketplace order (database predicate throws ACCESS_DENIED)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: storeAOwnerId,
        role: UserRole.STORE,
        status: 'ACTIVE',
      });
      prismaMock.store.findFirst.mockResolvedValue({
        id: storeAId,
        ownerUserId: storeAOwnerId,
        status: 'ACTIVE',
      });
      prismaMock.permission.count.mockResolvedValue(0);

      // Database findFirst with where: { publicReference: storeBOrderRef, storeId: storeAId } returns null
      prismaMock.marketplaceStoreOrder.findFirst.mockResolvedValue(null);
      // Secondary check confirms order exists under Store B
      prismaMock.marketplaceStoreOrder.findUnique.mockResolvedValue({
        id: 'order-beta',
        publicReference: storeBOrderRef,
        storeId: storeBId,
      });

      await expect(
        beginStoreOrderReview({
          storeOrderReference: storeBOrderRef,
          actorUserId: storeAOwnerId,
          operationId: 'op_review_cross_tenant_5',
          requestHash: 'a'.repeat(64),
          testApproval: { approved: true },
        })
      ).rejects.toThrowError(StoreOrderError);

      // Verify the query predicate strictly carried storeId directly in the where condition
      expect(prismaMock.marketplaceStoreOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publicReference: storeBOrderRef, storeId: storeAId },
        })
      );
    });

    it('proves Store A cannot accept Store B marketplace order', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: storeAOwnerId,
        role: UserRole.STORE,
        status: 'ACTIVE',
      });
      prismaMock.store.findFirst.mockResolvedValue({
        id: storeAId,
        ownerUserId: storeAOwnerId,
        status: 'ACTIVE',
      });
      prismaMock.permission.count.mockResolvedValue(0);

      prismaMock.marketplaceStoreOrder.findFirst.mockResolvedValue(null);
      prismaMock.marketplaceStoreOrder.findUnique.mockResolvedValue({
        id: 'order-beta',
        publicReference: storeBOrderRef,
        storeId: storeBId,
      });

      await expect(
        acceptMarketplaceStoreOrder({
          storeOrderReference: storeBOrderRef,
          actorUserId: storeAOwnerId,
          preparationMinutes: 30,
          pickupInstructions: 'Front counter collection',
          operationId: 'op_accept_cross_tenant_6',
          requestHash: 'b'.repeat(64),
          testApproval: { approved: true },
        })
      ).rejects.toThrowError(StoreOrderError);
    });
  });

  describe('3. Driver Active Assignment Ownership Boundaries', () => {
    it('proves assertAcceptedCurrentDriver rejects Driver A on Driver B assignment (where driverProfileId mismatch)', async () => {
      // Driver A attempts to operate on Assignment B
      // Database query findFirst with where: { id: assignmentBId, driverProfileId: driverAProfileId } returns null
      prismaMock.orderAssignment.findFirst.mockResolvedValue(null);

      await expect(
        assertAcceptedCurrentDriver(assignmentBId, driverAProfileId)
      ).rejects.toThrowError(DriverOperationError);

      expect(prismaMock.orderAssignment.findFirst).toHaveBeenCalledWith({
        where: { id: assignmentBId, driverProfileId: driverAProfileId },
        select: expect.any(Object),
      });
    });

    it('proves assertAcceptedCurrentDriver rejects if driver is not the currentDriverProfileId on the order', async () => {
      prismaMock.orderAssignment.findFirst.mockResolvedValue({
        id: assignmentBId,
        version: 1,
        status: OrderAssignmentStatus.ACCEPTED,
        driverProfileId: driverAProfileId,
        order: {
          id: orderBId,
          status: OrderStatus.IN_TRANSIT,
          currentDriverProfileId: driverBProfileId, // Order belongs to Driver B!
        },
        driverProfile: {
          userId: driverAUserId,
          status: DriverStatus.ACTIVE,
          user: { status: 'ACTIVE', role: UserRole.DRIVER },
        },
      });

      await expect(
        assertAcceptedCurrentDriver(assignmentBId, driverAProfileId)
      ).rejects.toThrowError('Only the current accepted driver can operate this order.');
    });

    it('proves assertAcceptedCurrentDriver rejects terminal orders even for the assigned driver', async () => {
      prismaMock.orderAssignment.findFirst.mockResolvedValue({
        id: assignmentBId,
        version: 1,
        status: OrderAssignmentStatus.ACCEPTED,
        driverProfileId: driverBProfileId,
        order: {
          id: orderBId,
          status: OrderStatus.DELIVERED, // Terminal status!
          currentDriverProfileId: driverBProfileId,
        },
        driverProfile: {
          userId: driverBUserId,
          status: DriverStatus.ACTIVE,
          user: { status: 'ACTIVE', role: UserRole.DRIVER },
        },
      });

      await expect(
        assertAcceptedCurrentDriver(assignmentBId, driverBProfileId)
      ).rejects.toThrowError('Terminal orders cannot be operated.');
    });
  });

  describe('4. Delivery OTP Security Invariants (SHA-256 Hash, Replay Resistance, Bounds)', () => {
    it('proves hashOtp strictly matches SHA-256 standard and never produces plaintext', () => {
      const code = '482910';
      const hash = hashOtp(code);
      const expectedSha256 = hashToken(code);

      expect(hash).toBe(expectedSha256);
      expect(hash).toHaveLength(64);
      expect(hash).not.toContain(code);
    });

    it('proves verifyDeliveryOtpInTx rejects incorrect OTP and increments attempt count', async () => {
      const realCode = '123456';
      const wrongCode = '999999';
      const realHash = hashOtp(realCode);

      const fakeOtpRecord = {
        id: 'otp-1',
        orderId: orderBId,
        codeHash: realHash,
        attempts: 1,
        maxAttempts: 5,
        lockedAt: null,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes future
      };

      const txMock = {
        deliveryOtp: {
          findFirst: vi.fn().mockResolvedValue(fakeOtpRecord),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ attempts: 2, maxAttempts: 5 }),
        },
      };

      const result = await verifyDeliveryOtpInTx(txMock as any, orderBId, wrongCode);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Incorrect code.');
      // Verify attempt counter was incremented in the database
      expect(txMock.deliveryOtp.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'otp-1' }),
          data: { attempts: { increment: 1 } },
        })
      );
    });

    it('proves verifyDeliveryOtpInTx locks OTP permanently when maxAttempts is reached', async () => {
      const realCode = '123456';
      const wrongCode = '000000';
      const realHash = hashOtp(realCode);

      const fakeOtpRecord = {
        id: 'otp-lock-target',
        orderId: orderBId,
        codeHash: realHash,
        attempts: 4,
        maxAttempts: 5,
        lockedAt: null,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      const txMock = {
        deliveryOtp: {
          findFirst: vi.fn().mockResolvedValue(fakeOtpRecord),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ attempts: 5, maxAttempts: 5 }),
        },
      };

      const result = await verifyDeliveryOtpInTx(txMock as any, orderBId, wrongCode);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Too many incorrect attempts. Please request a new delivery OTP.');
      // Verify lockedAt was stamped in the database
      expect(txMock.deliveryOtp.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'otp-lock-target', lockedAt: null }),
          data: expect.objectContaining({ lockedAt: expect.any(Date) }),
        })
      );
    });

    it('proves verifyDeliveryOtpInTx rejects expired OTP without verifying code or incrementing attempts', async () => {
      const pastDate = new Date(Date.now() - 5000); // 5 seconds ago
      const expiredRecord = {
        id: 'otp-expired',
        orderId: orderBId,
        codeHash: hashOtp('123456'),
        attempts: 0,
        maxAttempts: 5,
        lockedAt: null,
        consumedAt: null,
        expiresAt: pastDate,
      };

      const txMock = {
        deliveryOtp: {
          findFirst: vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(expiredRecord),
        },
      };

      const result = await verifyDeliveryOtpInTx(txMock as any, orderBId, '123456');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Delivery OTP has expired. Please request a new code.');
    });

    it('proves verifyDeliveryOtpInTx consumes OTP atomically upon correct code', async () => {
      const validCode = '654321';
      const validHash = hashOtp(validCode);

      const fakeOtpRecord = {
        id: 'otp-valid',
        orderId: orderBId,
        codeHash: validHash,
        attempts: 0,
        maxAttempts: 5,
        lockedAt: null,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      const txMock = {
        deliveryOtp: {
          findFirst: vi.fn().mockResolvedValue(fakeOtpRecord),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const result = await verifyDeliveryOtpInTx(txMock as any, orderBId, validCode);

      expect(result.ok).toBe(true);
      expect(result.otpId).toBe('otp-valid');
      expect(txMock.deliveryOtp.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'otp-valid', consumedAt: null }),
          data: expect.objectContaining({
            consumedAt: expect.any(Date),
            verifiedAt: expect.any(Date),
          }),
        })
      );
    });
  });
});
