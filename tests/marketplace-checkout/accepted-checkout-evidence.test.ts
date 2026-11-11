/* eslint-disable @typescript-eslint/no-explicit-any -- in-memory checkout db fixture */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { assertAcceptedCheckoutEvidence } from "@/lib/marketplace-checkout/accepted-checkout-evidence";

vi.mock("@/lib/marketplace-checkout/cart.service", () => ({
  resolveMarketplaceCartLine: vi.fn(),
}));

vi.mock("@/lib/marketplace-checkout/legal-evidence", () => ({
  assertMarketplaceLegalEvidence: vi.fn(),
  resolveMarketplaceLegalEvidence: vi.fn().mockResolvedValue({
    termsVersion: "terms-v1",
    privacyVersion: "privacy-v1",
    refundPolicyReferences: ["refund-v1"],
  }),
}));

vi.mock("@/lib/marketplace-checkout/delivery-policy-configuration", () => ({
  listDeliveryMatrices: vi.fn().mockResolvedValue([
    {
      status: "ACTIVE",
      version: 1,
      approvedAt: new Date(),
      approvedByUserId: "admin-approver",
      createdByUserId: "admin-creator",
      effectiveFrom: new Date(Date.now() - 86_400_000),
      effectiveTo: null,
    },
  ]),
}));

vi.mock("@/lib/marketplace-checkout/payment-plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/marketplace-checkout/payment-plan")>();
  return {
    ...actual,
    resolveMarketplacePaymentPlan: vi.fn(),
  };
});

import { resolveMarketplaceCartLine } from "@/lib/marketplace-checkout/cart.service";
import { resolveMarketplacePaymentPlan } from "@/lib/marketplace-checkout/payment-plan";

describe("assertAcceptedCheckoutEvidence", () => {
  const mockResolveCartLine = vi.mocked(resolveMarketplaceCartLine);
  const mockResolvePaymentPlan = vi.mocked(resolveMarketplacePaymentPlan);

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveCartLine.mockResolvedValue({
      storeId: "store-1",
      unitPrice: "100.00",
      priceVersion: "price-v1",
      publicationVersion: "pub-v1",
      modifiers: [],
    } as any);
  });

  const baseLine = {
    id: "line-1",
    reviewVersion: 1,
    offerReference: "offer-1",
    variantReference: "variant-1",
    quantity: 1,
    priceVersion: "price-v1",
    publicationVersion: "pub-v1",
    baseUnitPrice: new Prisma.Decimal("100.00"),
    modifierUnitTotal: new Prisma.Decimal("0.00"),
    lineTotal: new Prisma.Decimal("100.00"),
    modifiers: [],
  };

  const baseQuote = {
    id: "quote-1",
    ownerId: "owner-1",
    storeId: "store-1",
    total: new Prisma.Decimal("50.00"),
    deliveryType: "STANDARD",
    destinationRegionId: "region-1",
    expiresAt: new Date(Date.now() + 60_000),
    ruleSnapshot: { policyAuthority: "marketplace_delivery_matrix", policyVersion: 1 },
  };

  it("passes for a valid one-store R50 welcome discount with DIGITAL_ONLY payment plan", async () => {
    const checkout = {
      id: "chk-1",
      reviewVersion: 1,
      acceptedFingerprint: "fingerprint-123",
      contactSnapshotId: "contact-1",
      addressSnapshotId: "address-1",
      customerUserId: "cust-1",
      merchandiseSubtotal: new Prisma.Decimal("100.00"),
      modifierSubtotal: new Prisma.Decimal("0.00"),
      deliveryFeeTotal: new Prisma.Decimal("50.00"),
      promotionDiscount: new Prisma.Decimal("50.00"),
      grandTotal: new Prisma.Decimal("100.00"),
      digitalRequired: new Prisma.Decimal("100.00"),
      cashRequired: new Prisma.Decimal("0.00"),
      acknowledgements: [
        {
          reviewVersion: 1,
          commercialFingerprint: "fingerprint-123",
          grandTotal: new Prisma.Decimal("100.00"),
          termsVersion: "terms-v1",
          privacyVersion: "privacy-v1",
          refundPolicyReferences: ["refund-v1"],
        },
      ],
      storeGroups: [
        {
          id: "grp-1",
          storeId: "store-1",
          store: { ownerUserId: "owner-1" },
          groupTotal: new Prisma.Decimal("150.00"),
          deliveryFee: new Prisma.Decimal("50.00"),
          deliveryQuoteReference: "quote-1",
          deliveryQuoteVersion: "v1",
          deliveryQuoteExpiresAt: new Date(Date.now() + 60_000),
          fulfilmentMode: "COURIER_DELIVERY",
          paymentPlan: {
            version: "marketplace-payment-v1",
            mode: "DIGITAL_ONLY",
            authoritativeTotal: "100.00",
            digitalRequired: "100.00",
            cashRequired: "0.00",
            policyId: null,
            policyVersion: null,
            policyEvidence: null,
          },
          lines: [baseLine],
        },
      ],
    };

    const mockDb: any = {
      marketplaceCheckout: { findUniqueOrThrow: vi.fn().mockResolvedValue(checkout) },
      marketplaceGuestContactVerification: { findFirst: vi.fn() },
      pricingQuote: { findUnique: vi.fn().mockResolvedValue(baseQuote) },
      marketplaceCheckoutOperation: { findFirst: vi.fn().mockResolvedValue(null) },
      store: { findUnique: vi.fn().mockResolvedValue({ id: "store-1", defaultPickupAddress: { city: "JHB", province: "GP" } }) },
      marketplaceCheckoutAddressSnapshot: { findUnique: vi.fn().mockResolvedValue({ city: "PTA", province: "GP" }) },
    };

    await expect(assertAcceptedCheckoutEvidence("chk-1", new Date(), mockDb)).resolves.toBeUndefined();
  });

  it("passes for a valid two-store fractional-cent allocation without cross-store leakage", async () => {
    const line2 = {
      ...baseLine,
      id: "line-2",
      offerReference: "offer-2",
      variantReference: "variant-2",
      baseUnitPrice: new Prisma.Decimal("50.00"),
      lineTotal: new Prisma.Decimal("50.00"),
    };
    const quote2 = {
      ...baseQuote,
      id: "quote-2",
      storeId: "store-2",
      ownerId: "owner-2",
      total: new Prisma.Decimal("20.00"),
    };

    const checkout = {
      id: "chk-2",
      reviewVersion: 1,
      acceptedFingerprint: "fingerprint-multi",
      contactSnapshotId: "contact-1",
      addressSnapshotId: "address-1",
      customerUserId: "cust-1",
      merchandiseSubtotal: new Prisma.Decimal("150.00"),
      modifierSubtotal: new Prisma.Decimal("0.00"),
      deliveryFeeTotal: new Prisma.Decimal("70.00"),
      promotionDiscount: new Prisma.Decimal("50.00"),
      grandTotal: new Prisma.Decimal("170.00"),
      digitalRequired: new Prisma.Decimal("170.00"),
      cashRequired: new Prisma.Decimal("0.00"),
      acknowledgements: [
        {
          reviewVersion: 1,
          commercialFingerprint: "fingerprint-multi",
          grandTotal: new Prisma.Decimal("170.00"),
          termsVersion: "terms-v1",
          privacyVersion: "privacy-v1",
          refundPolicyReferences: ["refund-v1"],
        },
      ],
      storeGroups: [
        {
          id: "grp-1",
          storeId: "store-1",
          store: { ownerUserId: "owner-1" },
          groupTotal: new Prisma.Decimal("150.00"), // 100 merchandise + 50 fee
          deliveryFee: new Prisma.Decimal("50.00"),
          deliveryQuoteReference: "quote-1",
          deliveryQuoteVersion: "v1",
          deliveryQuoteExpiresAt: new Date(Date.now() + 60_000),
          fulfilmentMode: "COURIER_DELIVERY",
          paymentPlan: {
            version: "marketplace-payment-v1",
            mode: "DIGITAL_ONLY",
            authoritativeTotal: "116.67", // discount 33.33
            digitalRequired: "116.67",
            cashRequired: "0.00",
            policyId: null,
            policyVersion: null,
            policyEvidence: null,
          },
          lines: [baseLine],
        },
        {
          id: "grp-2",
          storeId: "store-2",
          store: { ownerUserId: "owner-2" },
          groupTotal: new Prisma.Decimal("70.00"), // 50 merchandise + 20 fee
          deliveryFee: new Prisma.Decimal("20.00"),
          deliveryQuoteReference: "quote-2",
          deliveryQuoteVersion: "v1",
          deliveryQuoteExpiresAt: new Date(Date.now() + 60_000),
          fulfilmentMode: "COURIER_DELIVERY",
          paymentPlan: {
            version: "marketplace-payment-v1",
            mode: "DIGITAL_ONLY",
            authoritativeTotal: "53.33", // discount 16.67
            digitalRequired: "53.33",
            cashRequired: "0.00",
            policyId: null,
            policyVersion: null,
            policyEvidence: null,
          },
          lines: [line2],
        },
      ],
    };

    mockResolveCartLine.mockImplementation(async (arg: any) => {
      if (arg.offerReference === "offer-1") {
        return { storeId: "store-1", unitPrice: "100.00", priceVersion: "price-v1", publicationVersion: "pub-v1", modifiers: [] } as any;
      }
      return { storeId: "store-2", unitPrice: "50.00", priceVersion: "price-v1", publicationVersion: "pub-v1", modifiers: [] } as any;
    });

    const mockDb: any = {
      marketplaceCheckout: { findUniqueOrThrow: vi.fn().mockResolvedValue(checkout) },
      marketplaceGuestContactVerification: { findFirst: vi.fn() },
      pricingQuote: {
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          if (where.id === "quote-1") return baseQuote;
          if (where.id === "quote-2") return quote2;
          return null;
        }),
      },
      marketplaceCheckoutOperation: { findFirst: vi.fn().mockResolvedValue(null) },
      store: { findUnique: vi.fn().mockResolvedValue({ id: "store-1", defaultPickupAddress: { city: "JHB", province: "GP" } }) },
      marketplaceCheckoutAddressSnapshot: { findUnique: vi.fn().mockResolvedValue({ city: "PTA", province: "GP" }) },
    };

    await expect(assertAcceptedCheckoutEvidence("chk-2", new Date(), mockDb)).resolves.toBeUndefined();
  });

  it("passes for undiscounted order with COD deposit split when permitted by policy", async () => {
    const codPlan = {
      version: "marketplace-payment-v1" as const,
      mode: "DEPOSIT_PLUS_COD" as const,
      authoritativeTotal: "150.00",
      digitalRequired: "75.00",
      cashRequired: "75.00",
      policyId: "cod-policy-1",
      policyVersion: 1,
      policyEvidence: { sample: true },
    };

    const checkout = {
      id: "chk-cod",
      reviewVersion: 1,
      acceptedFingerprint: "fingerprint-cod",
      contactSnapshotId: "contact-1",
      addressSnapshotId: "address-1",
      customerUserId: "cust-1",
      merchandiseSubtotal: new Prisma.Decimal("100.00"),
      modifierSubtotal: new Prisma.Decimal("0.00"),
      deliveryFeeTotal: new Prisma.Decimal("50.00"),
      promotionDiscount: new Prisma.Decimal("0.00"),
      grandTotal: new Prisma.Decimal("150.00"),
      digitalRequired: new Prisma.Decimal("75.00"),
      cashRequired: new Prisma.Decimal("75.00"),
      acknowledgements: [
        {
          reviewVersion: 1,
          commercialFingerprint: "fingerprint-cod",
          grandTotal: new Prisma.Decimal("150.00"),
          termsVersion: "terms-v1",
          privacyVersion: "privacy-v1",
          refundPolicyReferences: ["refund-v1"],
        },
      ],
      storeGroups: [
        {
          id: "grp-1",
          storeId: "store-1",
          store: { ownerUserId: "owner-1" },
          groupTotal: new Prisma.Decimal("150.00"),
          deliveryFee: new Prisma.Decimal("50.00"),
          deliveryQuoteReference: "quote-1",
          deliveryQuoteVersion: "v1",
          deliveryQuoteExpiresAt: new Date(Date.now() + 60_000),
          fulfilmentMode: "COURIER_DELIVERY",
          paymentPlan: codPlan,
          lines: [baseLine],
        },
      ],
    };

    mockResolvePaymentPlan.mockResolvedValue(codPlan);

    const mockDb: any = {
      marketplaceCheckout: { findUniqueOrThrow: vi.fn().mockResolvedValue(checkout) },
      marketplaceGuestContactVerification: { findFirst: vi.fn() },
      pricingQuote: { findUnique: vi.fn().mockResolvedValue(baseQuote) },
      marketplaceCheckoutOperation: { findFirst: vi.fn().mockResolvedValue(null) },
      store: { findUnique: vi.fn().mockResolvedValue({ id: "store-1", defaultPickupAddress: { city: "JHB", province: "GP" } }) },
      marketplaceCheckoutAddressSnapshot: { findUnique: vi.fn().mockResolvedValue({ city: "PTA", province: "GP" }) },
    };

    await expect(assertAcceptedCheckoutEvidence("chk-cod", new Date(), mockDb)).resolves.toBeUndefined();
  });

  it("strictly rejects COD split if order has any promotional discount", async () => {
    const checkout = {
      id: "chk-cod-promo",
      reviewVersion: 1,
      acceptedFingerprint: "fingerprint-cod-promo",
      contactSnapshotId: "contact-1",
      addressSnapshotId: "address-1",
      customerUserId: "cust-1",
      merchandiseSubtotal: new Prisma.Decimal("100.00"),
      modifierSubtotal: new Prisma.Decimal("0.00"),
      deliveryFeeTotal: new Prisma.Decimal("50.00"),
      promotionDiscount: new Prisma.Decimal("20.00"),
      grandTotal: new Prisma.Decimal("130.00"),
      digitalRequired: new Prisma.Decimal("65.00"),
      cashRequired: new Prisma.Decimal("65.00"),
      acknowledgements: [
        {
          reviewVersion: 1,
          commercialFingerprint: "fingerprint-cod-promo",
          grandTotal: new Prisma.Decimal("130.00"),
          termsVersion: "terms-v1",
          privacyVersion: "privacy-v1",
          refundPolicyReferences: ["refund-v1"],
        },
      ],
      storeGroups: [
        {
          id: "grp-1",
          storeId: "store-1",
          store: { ownerUserId: "owner-1" },
          groupTotal: new Prisma.Decimal("150.00"),
          deliveryFee: new Prisma.Decimal("50.00"),
          deliveryQuoteReference: "quote-1",
          deliveryQuoteVersion: "v1",
          deliveryQuoteExpiresAt: new Date(Date.now() + 60_000),
          fulfilmentMode: "COURIER_DELIVERY",
          paymentPlan: {
            version: "marketplace-payment-v1",
            mode: "DEPOSIT_PLUS_COD",
            authoritativeTotal: "130.00",
            digitalRequired: "65.00",
            cashRequired: "65.00",
            policyId: "cod-policy-1",
            policyVersion: 1,
            policyEvidence: {},
          },
          lines: [baseLine],
        },
      ],
    };

    const mockDb: any = {
      marketplaceCheckout: { findUniqueOrThrow: vi.fn().mockResolvedValue(checkout) },
    };

    await expect(assertAcceptedCheckoutEvidence("chk-cod-promo", new Date(), mockDb)).rejects.toMatchObject({
      code: "CHECKOUT_REVIEW_REQUIRED",
    });
  });

  it("strictly rejects checkout when delivery quote has expired", async () => {
    const checkout = {
      id: "chk-expired-quote",
      reviewVersion: 1,
      acceptedFingerprint: "fingerprint-123",
      contactSnapshotId: "contact-1",
      addressSnapshotId: "address-1",
      customerUserId: "cust-1",
      merchandiseSubtotal: new Prisma.Decimal("100.00"),
      modifierSubtotal: new Prisma.Decimal("0.00"),
      deliveryFeeTotal: new Prisma.Decimal("50.00"),
      promotionDiscount: new Prisma.Decimal("0.00"),
      grandTotal: new Prisma.Decimal("150.00"),
      digitalRequired: new Prisma.Decimal("150.00"),
      cashRequired: new Prisma.Decimal("0.00"),
      acknowledgements: [
        {
          reviewVersion: 1,
          commercialFingerprint: "fingerprint-123",
          grandTotal: new Prisma.Decimal("150.00"),
          termsVersion: "terms-v1",
          privacyVersion: "privacy-v1",
          refundPolicyReferences: ["refund-v1"],
        },
      ],
      storeGroups: [
        {
          id: "grp-1",
          storeId: "store-1",
          store: { ownerUserId: "owner-1" },
          groupTotal: new Prisma.Decimal("150.00"),
          deliveryFee: new Prisma.Decimal("50.00"),
          deliveryQuoteReference: "quote-1",
          deliveryQuoteVersion: "v1",
          deliveryQuoteExpiresAt: new Date(Date.now() - 1000), // expired!
          fulfilmentMode: "COURIER_DELIVERY",
          paymentPlan: {
            version: "marketplace-payment-v1",
            mode: "DIGITAL_ONLY",
            authoritativeTotal: "150.00",
            digitalRequired: "150.00",
            cashRequired: "0.00",
            policyId: null,
            policyVersion: null,
            policyEvidence: null,
          },
          lines: [baseLine],
        },
      ],
    };

    const mockDb: any = {
      marketplaceCheckout: { findUniqueOrThrow: vi.fn().mockResolvedValue(checkout) },
      marketplaceGuestContactVerification: { findFirst: vi.fn() },
    };

    await expect(assertAcceptedCheckoutEvidence("chk-expired-quote", new Date(), mockDb)).rejects.toMatchObject({
      code: "CHECKOUT_REVIEW_REQUIRED",
    });
  });

  it("strictly rejects checkout when merchant quote owner does not match store owner", async () => {
    const quoteWithMismatchedOwner = {
      ...baseQuote,
      ownerId: "attacker-owner", // does not match store owner "owner-1"!
    };

    const checkout = {
      id: "chk-revoked-merchant",
      reviewVersion: 1,
      acceptedFingerprint: "fingerprint-123",
      contactSnapshotId: "contact-1",
      addressSnapshotId: "address-1",
      customerUserId: "cust-1",
      merchandiseSubtotal: new Prisma.Decimal("100.00"),
      modifierSubtotal: new Prisma.Decimal("0.00"),
      deliveryFeeTotal: new Prisma.Decimal("50.00"),
      promotionDiscount: new Prisma.Decimal("0.00"),
      grandTotal: new Prisma.Decimal("150.00"),
      digitalRequired: new Prisma.Decimal("150.00"),
      cashRequired: new Prisma.Decimal("0.00"),
      acknowledgements: [
        {
          reviewVersion: 1,
          commercialFingerprint: "fingerprint-123",
          grandTotal: new Prisma.Decimal("150.00"),
          termsVersion: "terms-v1",
          privacyVersion: "privacy-v1",
          refundPolicyReferences: ["refund-v1"],
        },
      ],
      storeGroups: [
        {
          id: "grp-1",
          storeId: "store-1",
          store: { ownerUserId: "owner-1" },
          groupTotal: new Prisma.Decimal("150.00"),
          deliveryFee: new Prisma.Decimal("50.00"),
          deliveryQuoteReference: "quote-1",
          deliveryQuoteVersion: "v1",
          deliveryQuoteExpiresAt: new Date(Date.now() + 60_000),
          fulfilmentMode: "COURIER_DELIVERY",
          paymentPlan: {
            version: "marketplace-payment-v1",
            mode: "DIGITAL_ONLY",
            authoritativeTotal: "150.00",
            digitalRequired: "150.00",
            cashRequired: "0.00",
            policyId: null,
            policyVersion: null,
            policyEvidence: null,
          },
          lines: [baseLine],
        },
      ],
    };

    const mockDb: any = {
      marketplaceCheckout: { findUniqueOrThrow: vi.fn().mockResolvedValue(checkout) },
      marketplaceGuestContactVerification: { findFirst: vi.fn() },
      pricingQuote: { findUnique: vi.fn().mockResolvedValue(quoteWithMismatchedOwner) },
      marketplaceCheckoutOperation: { findFirst: vi.fn().mockResolvedValue(null) },
      store: { findUnique: vi.fn().mockResolvedValue({ id: "store-1", defaultPickupAddress: { city: "JHB", province: "GP" } }) },
      marketplaceCheckoutAddressSnapshot: { findUnique: vi.fn().mockResolvedValue({ city: "PTA", province: "GP" }) },
    };

    await expect(assertAcceptedCheckoutEvidence("chk-revoked-merchant", new Date(), mockDb)).rejects.toMatchObject({
      code: "CHECKOUT_REVIEW_REQUIRED",
    });
  });

  it("strictly rejects checkout when group totals do not reconcile with grandTotal and discount", async () => {
    const checkout = {
      id: "chk-bad-reconciliation",
      reviewVersion: 1,
      acceptedFingerprint: "fingerprint-123",
      contactSnapshotId: "contact-1",
      addressSnapshotId: "address-1",
      customerUserId: "cust-1",
      merchandiseSubtotal: new Prisma.Decimal("100.00"),
      modifierSubtotal: new Prisma.Decimal("0.00"),
      deliveryFeeTotal: new Prisma.Decimal("50.00"),
      promotionDiscount: new Prisma.Decimal("50.00"),
      grandTotal: new Prisma.Decimal("100.00"),
      digitalRequired: new Prisma.Decimal("100.00"),
      cashRequired: new Prisma.Decimal("0.00"),
      acknowledgements: [
        {
          reviewVersion: 1,
          commercialFingerprint: "fingerprint-123",
          grandTotal: new Prisma.Decimal("100.00"),
          termsVersion: "terms-v1",
          privacyVersion: "privacy-v1",
          refundPolicyReferences: ["refund-v1"],
        },
      ],
      storeGroups: [
        {
          id: "grp-1",
          storeId: "store-1",
          store: { ownerUserId: "owner-1" },
          groupTotal: new Prisma.Decimal("150.00"),
          deliveryFee: new Prisma.Decimal("50.00"),
          deliveryQuoteReference: "quote-1",
          deliveryQuoteVersion: "v1",
          deliveryQuoteExpiresAt: new Date(Date.now() + 60_000),
          fulfilmentMode: "COURIER_DELIVERY",
          // Mismatched payment plan total: 80 instead of 100
          paymentPlan: {
            version: "marketplace-payment-v1",
            mode: "DIGITAL_ONLY",
            authoritativeTotal: "80.00",
            digitalRequired: "80.00",
            cashRequired: "0.00",
            policyId: null,
            policyVersion: null,
            policyEvidence: null,
          },
          lines: [baseLine],
        },
      ],
    };

    const mockDb: any = {
      marketplaceCheckout: { findUniqueOrThrow: vi.fn().mockResolvedValue(checkout) },
    };

    await expect(assertAcceptedCheckoutEvidence("chk-bad-reconciliation", new Date(), mockDb)).rejects.toMatchObject({
      code: "CHECKOUT_REVIEW_REQUIRED",
    });
  });
});
