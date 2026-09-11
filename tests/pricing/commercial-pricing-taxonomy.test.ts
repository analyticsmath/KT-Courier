/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_SERVICE_TAXONOMY,
  assertCommercialPricingRuleApproved,
  assertCommercialServiceAvailable,
  validateCommercialPricingRuleIntegrity,
} from "@/lib/pricing/commercial-pricing-taxonomy";
import { PricingError } from "@/lib/pricing/errors";
import { Prisma } from "@prisma/client";

describe("Phase 1: Commercial Pricing Taxonomy & Fail-Closed Validation", () => {
  describe("Taxonomy Definitions", () => {
    it("defines the 5 authoritative commercial service tiers", () => {
      const tiers = Object.keys(COMMERCIAL_SERVICE_TAXONOMY);
      expect(tiers).toEqual(
        expect.arrayContaining([
          "STANDARD_COURIER",
          "EXPRESS_SAME_DAY",
          "SCHEDULED_DELIVERY",
          "HEAVY_PARCEL",
          "DOCUMENTS_ONLY",
        ]),
      );
    });

    it("locks HEAVY_PARCEL under PENDING_REVIEW pending commercial sign-off", () => {
      expect(COMMERCIAL_SERVICE_TAXONOMY.HEAVY_PARCEL.defaultReviewStatus).toBe("PENDING_REVIEW");
    });
  });

  describe("assertCommercialServiceAvailable", () => {
    it("returns descriptor for approved commercial service tiers", () => {
      const standard = assertCommercialServiceAvailable("STANDARD_COURIER");
      expect(standard.tier).toBe("STANDARD_COURIER");
      expect(standard.defaultReviewStatus).toBe("APPROVED");
      expect(standard.code).toBe("SVC-STD-01");
    });

    it("fails closed with SERVICE_TIER_LOCKED for unapproved tier (HEAVY_PARCEL)", () => {
      expect(() => assertCommercialServiceAvailable("HEAVY_PARCEL")).toThrowError(
        PricingError,
      );
      expect(() => assertCommercialServiceAvailable("HEAVY_PARCEL")).toThrowError(
        /is pending approval \(PENDING_REVIEW\)/,
      );
    });

    it("fails closed with UNKNOWN_SERVICE_TIER for invalid service tier", () => {
      expect(() => assertCommercialServiceAvailable("HYPER_SPEED_ROCKET" as any)).toThrowError(
        PricingError,
      );
      expect(() => assertCommercialServiceAvailable("HYPER_SPEED_ROCKET" as any)).toThrowError(
        /is not recognized by platform taxonomy/,
      );
    });
  });

  describe("assertCommercialPricingRuleApproved", () => {
    const validRule: any = {
      id: "rule_001",
      active: true,
      currency: "ZAR",
      archivedAt: null,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      effectiveTo: new Date("2027-01-01T00:00:00Z"),
    };

    const now = new Date("2026-06-01T00:00:00Z");

    it("approves valid active ZAR rule within effective dates", () => {
      expect(() => assertCommercialPricingRuleApproved(validRule, now)).not.toThrow();
    });

    it("fails closed on inactive rule", () => {
      expect(() =>
        assertCommercialPricingRuleApproved({ ...validRule, active: false }, now),
      ).toThrowError(/is inactive and cannot be used for rating/);
    });

    it("fails closed on archived rule", () => {
      expect(() =>
        assertCommercialPricingRuleApproved(
          { ...validRule, archivedAt: new Date("2026-05-01T00:00:00Z") },
          now,
        ),
      ).toThrowError(/has been archived/);
    });

    it("fails closed on non-ZAR currency", () => {
      expect(() =>
        assertCommercialPricingRuleApproved({ ...validRule, currency: "USD" }, now),
      ).toThrowError(/Only ZAR is supported/);
    });

    it("fails closed if rule is not yet effective", () => {
      const futureNow = new Date("2025-12-01T00:00:00Z");
      expect(() =>
        assertCommercialPricingRuleApproved(validRule, futureNow),
      ).toThrowError(/is not effective until/);
    });

    it("fails closed if rule has expired", () => {
      const expiredNow = new Date("2027-02-01T00:00:00Z");
      expect(() =>
        assertCommercialPricingRuleApproved(validRule, expiredNow),
      ).toThrowError(/expired at/);
    });
  });

  describe("validateCommercialPricingRuleIntegrity", () => {
    it("passes for sound mathematical configuration", () => {
      expect(() =>
        validateCommercialPricingRuleIntegrity({
          basePrice: new Prisma.Decimal("50.00"),
          perKmRate: new Prisma.Decimal("5.50"),
          perKgRate: new Prisma.Decimal("2.00"),
          minimumCharge: new Prisma.Decimal("75.00"),
          minimumWeightKg: new Prisma.Decimal("1.00"),
          maximumWeightKg: new Prisma.Decimal("30.00"),
          minDistanceKm: new Prisma.Decimal("0.00"),
          maxDistanceKm: new Prisma.Decimal("250.00"),
        }),
      ).not.toThrow();
    });

    it("rejects negative base price", () => {
      expect(() =>
        validateCommercialPricingRuleIntegrity({
          basePrice: -10,
        }),
      ).toThrowError("Base price must be a non-negative number.");
    });

    it("rejects negative per-km rate", () => {
      expect(() =>
        validateCommercialPricingRuleIntegrity({
          basePrice: 50,
          perKmRate: -2.5,
        }),
      ).toThrowError("Per-km rate must be a non-negative number.");
    });

    it("rejects inverted weight boundaries (min > max)", () => {
      expect(() =>
        validateCommercialPricingRuleIntegrity({
          basePrice: 50,
          minimumWeightKg: 50,
          maximumWeightKg: 10,
        }),
      ).toThrowError("Minimum weight cannot exceed maximum weight.");
    });

    it("rejects inverted distance boundaries (min > max)", () => {
      expect(() =>
        validateCommercialPricingRuleIntegrity({
          basePrice: 50,
          minDistanceKm: 100,
          maxDistanceKm: 20,
        }),
      ).toThrowError("Minimum distance cannot exceed maximum distance.");
    });
  });
});
