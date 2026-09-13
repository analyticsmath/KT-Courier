import { describe, expect, it, vi } from "vitest";
import {
  projectPublicCheckout,
  updateMarketplaceCheckoutContact,
  updateMarketplaceCheckoutAddress,
} from "@/lib/marketplace-checkout/checkout.service";
import { acknowledgeMarketplaceCheckoutReviewPersisted } from "@/lib/marketplace-checkout/checkout-review-persistence.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

vi.mock("@/lib/marketplace-checkout/composition-root", () => ({
  resolveMarketplaceCheckoutProductionComposition: vi.fn(),
  assertMarketplaceCheckoutProductionReady: vi.fn(),
  isLocalCheckoutValidationAllowed: vi.fn().mockReturnValue(true),
}));

describe("Phase 1 Acceptance: Checkout Flow & Concurrency Corrections", () => {
  const customerOwner = { type: "CUSTOMER" as const, userId: "user-123" };

  describe("projectPublicCheckout", () => {
    it("returns null when passed null or undefined", () => {
      expect(projectPublicCheckout(null)).toBeNull();
      expect(projectPublicCheckout(undefined)).toBeNull();
    });

    it("projects both reference and publicReference with string-formatted totals and hydrated store groups", () => {
      const canonicalCheckout = {
        id: "chk-001",
        publicReference: "checkout_ref_999",
        status: "READY_FOR_REVIEW",
        currency: "ZAR",
        version: 3,
        merchandiseSubtotal: 250.0,
        modifierSubtotal: 30.0,
        deliveryFeeTotal: 45.0,
        grandTotal: 325.0,
        changes: [{ type: "DELIVERY_FEE_CHANGED", lineReference: "line-1", acknowledgedAt: new Date() }],
        storeGroups: [
          {
            id: "group-1",
            storeId: "store-abc",
            status: "READY",
            fulfilmentMode: "COURIER_DELIVERY",
            deliveryFee: 45.0,
            deliveryQuoteReference: "quote-xyz",
            deliveryQuoteExpiresAt: new Date("2026-09-30T12:00:00Z"),
            lines: [
              {
                productReference: "prod-1",
                variantReference: "var-1",
                offerReference: "off-1",
                quantity: 2,
                baseUnitPrice: 125.0,
                modifierUnitTotal: 15.0,
                lineTotal: 280.0,
                modifiers: [{ id: "opt-1", name: "Extra Cheese" }],
              },
            ],
          },
        ],
      };

      const projection = projectPublicCheckout(canonicalCheckout);

      expect(projection).not.toBeNull();
      expect(projection?.reference).toBe("checkout_ref_999");
      expect(projection?.publicReference).toBe("checkout_ref_999");
      expect(projection?.currency).toBe("ZAR");
      expect(projection?.version).toBe(3);
      expect(projection?.totals).toEqual({
        merchandiseSubtotal: "250",
        modifierSubtotal: "30",
        deliveryFeeTotal: "45",
        grandTotal: "325",
      });
      expect(projection?.storeGroups).toHaveLength(1);
      expect(projection?.storeGroups[0].storeReference).toBe("store-abc");
      expect(projection?.storeGroups[0].deliveryFee).toBe("45");
      expect(projection?.storeGroups[0].quoteReference).toBe("quote-xyz");
      expect(projection?.storeGroups[0].lines[0]).toMatchObject({
        productReference: "prod-1",
        variantReference: "var-1",
        offerReference: "off-1",
        quantity: 2,
        baseUnitPrice: "125",
        modifierUnitTotal: "15",
        lineTotal: "280",
        modifiers: [{ id: "opt-1", name: "Extra Cheese" }],
      });
    });
  });

  describe("updateMarketplaceCheckoutContact & Address snapshots", () => {
    it("saves contact snapshot, increments checkout version, and returns canonical checkout projection", async () => {
      const mockCheckout = {
        id: "chk-001",
        publicReference: "chk_pub_123",
        version: 1,
        status: "CREATED",
        customerUserId: "user-123",
        merchandiseSubtotal: "100.00",
        modifierSubtotal: "0.00",
        deliveryFeeTotal: "0.00",
        grandTotal: "100.00",
        storeGroups: [],
        changes: [],
      };

      const mockDb = {
        marketplaceCheckout: {
          findFirst: vi.fn().mockResolvedValue(mockCheckout),
          update: vi.fn().mockResolvedValue({
            ...mockCheckout,
            version: 2,
            status: "VALIDATING",
            contactSnapshotId: "contact-snap-1",
          }),
        },
        marketplaceCheckoutContactSnapshot: {
          create: vi.fn().mockResolvedValue({ id: "contact-snap-1" }),
        },
      };

      const result = await updateMarketplaceCheckoutContact(
        {
          reference: "chk_pub_123",
          owner: customerOwner,
          operation: { operationId: "op-contact-1", requestHash: "hash-1", expectedVersion: 1 },
          contact: { recipientName: "Jane Doe", email: "jane@example.com", phone: "+27821234567" },
        },
        mockDb as never,
      );

      expect(result.publicReference).toBe("chk_pub_123");
      expect(result.reference).toBe("chk_pub_123");
      expect(result.version).toBe(2);
      expect(result.status).toBe("VALIDATING");
      expect(result.checkout).not.toBeNull();
      expect(result.checkout.reference).toBe("chk_pub_123");
      expect(mockDb.marketplaceCheckoutContactSnapshot.create).toHaveBeenCalledWith({
        data: { recipientName: "Jane Doe", email: "jane@example.com", phone: "+27821234567" },
      });
    });

    it("rejects contact mutation when expectedVersion does not match current version", async () => {
      const mockCheckout = {
        id: "chk-001",
        publicReference: "chk_pub_123",
        version: 2,
        status: "CREATED",
      };

      const mockDb = {
        marketplaceCheckout: {
          findFirst: vi.fn().mockResolvedValue(mockCheckout),
        },
      };

      await expect(
        updateMarketplaceCheckoutContact(
          {
            reference: "chk_pub_123",
            owner: customerOwner,
            operation: { operationId: "op-contact-1", requestHash: "hash-1", expectedVersion: 1 }, // Stale version
            contact: { recipientName: "Jane Doe", email: "jane@example.com", phone: "+27821234567" },
          },
          mockDb as never,
        ),
      ).rejects.toThrow(MarketplaceCheckoutError);
    });

    it("rejects address mutation when checkout is in PAYMENT_PENDING state", async () => {
      const mockCheckout = {
        id: "chk-001",
        publicReference: "chk_pub_123",
        version: 2,
        status: "PAYMENT_PENDING",
      };

      const mockDb = {
        marketplaceCheckout: {
          findFirst: vi.fn().mockResolvedValue(mockCheckout),
        },
        marketplaceCheckoutAddressSnapshot: {
          create: vi.fn(),
        },
      };

      await expect(
        updateMarketplaceCheckoutAddress(
          {
            reference: "chk_pub_123",
            owner: customerOwner,
            operation: { operationId: "op-addr-1", requestHash: "hash-1", expectedVersion: 2 },
            address: { recipientName: "Jane Doe", line1: "123 Main Rd", city: "Cape Town", province: "Western Cape" },
          },
          mockDb as never,
        ),
      ).rejects.toThrow(/immutable at this stage/i);
    });
  });

  describe("Acknowledge to Reservation Optimistic Concurrency Propagation", () => {
    it("returns checkoutVersion N+1 on review acknowledgement", async () => {
      const initialVersion = 4;
      const checkoutState = {
        id: "chk-review-1",
        publicReference: "chk_pub_rev",
        status: "READY_FOR_REVIEW",
        version: initialVersion,
        reviewVersion: 2,
        grandTotal: "150.00",
        commercialFingerprint: "fingerprint-valid",
        changes: [],
        settlementEvidenceVersions: ["v1"],
      };

      const repository = {
        transaction: async (fn: () => Promise<unknown>) => fn(),
        lockCheckout: vi.fn().mockResolvedValue(checkoutState),
        findOperation: vi.fn().mockResolvedValue(null),
        createAcknowledgement: vi.fn().mockResolvedValue({ id: "ack-1" }),
      };

      const ackResult = await acknowledgeMarketplaceCheckoutReviewPersisted(repository as never, {
        reference: "chk_pub_rev",
        owner: customerOwner,
        operationId: "ack-op-001",
        requestHash: "req-hash-ack",
        expectedVersion: initialVersion,
        reviewVersion: 2,
        commercialFingerprint: "fingerprint-valid",
        acknowledgedTotalReference: "150.00",
        termsVersion: "terms-v1",
        privacyVersion: "privacy-v1",
        refundPolicyReferences: ["refund-v1"],
      });

      expect(ackResult.acknowledged).toBe(true);
      expect(ackResult.reviewVersion).toBe(2);
      expect(ackResult.checkoutVersion).toBe(initialVersion + 1); // Version incremented to N+1
    });
  });
});
