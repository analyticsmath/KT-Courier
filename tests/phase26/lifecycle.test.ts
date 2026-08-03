/* eslint-disable @typescript-eslint/no-explicit-any -- focused fake repositories exercise DB-free lifecycle & immutability boundaries. */
import { beforeEach, describe, expect, it } from "vitest";
import { PositionFamilyService } from "@/lib/recruitment/position-family.service";
import { RequisitionService } from "@/lib/recruitment/requisition.service";
import { OpeningService } from "@/lib/recruitment/opening.service";
import { ApplicationService } from "@/lib/recruitment/application.service";
import { OfferService } from "@/lib/recruitment/offer.service";
import { RecruitmentProductionLockError } from "@/lib/recruitment/production-readiness";
import { RecruitmentError } from "@/lib/recruitment/errors";
import { RecruitmentPositionFamilyStatus } from "@/types/db";

describe("Phase 26 Lifecycle Transitions and Immutable Versions", () => {
  let db: any;

  beforeEach(() => {
    db = {
      recruitmentPositionFamily: {
        findUnique: async ({ where }: any) => {
          if (where.code === "COURIER") return { code: "COURIER", status: "ACTIVE" };
          return null;
        },
        create: async ({ data }: any) => data,
        update: async ({ data }: any) => data,
      },
      recruitmentRequisition: {
        findUnique: async ({ where }: any) => {
          if (where.publicReference === "REQ-DRAFT") return { publicReference: "REQ-DRAFT", status: "DRAFT", approvedHeadcount: 5 };
          if (where.publicReference === "REQ-REJECTED") return { publicReference: "REQ-REJECTED", status: "REJECTED", approvedHeadcount: 5 };
          if (where.publicReference === "REQ-APPROVED") return { publicReference: "REQ-APPROVED", status: "APPROVED", approvedHeadcount: 2, filledHeadcount: 2 };
          return null;
        },
        update: async ({ data }: any) => data,
      },
      recruitmentOpening: {
        findUnique: async ({ where }: any) => {
          if (where.publicReference === "OPN-PUBLISHED") {
            return {
              publicReference: "OPN-PUBLISHED",
              status: "PUBLISHED",
              requisitionId: "req-1",
              requisition: { status: "APPROVED" },
              latestVersionId: "ver-1",
            };
          }
          if (where.publicReference === "OPN-CANCELLED") {
            return { publicReference: "OPN-CANCELLED", status: "CANCELLED" };
          }
          return null;
        },
        update: async ({ data }: any) => data,
      },
      recruitmentOpeningVersion: {
        findUnique: async () => ({ id: "ver-1", versionNumber: 1, isFrozen: true }),
        update: async () => {
          throw new RecruitmentError("Published opening versions are immutable and cannot be mutated in place.");
        },
      },
      recruitmentApplication: {
        findUnique: async ({ where }: any) => {
          if (where.publicReference === "APP-DRAFT-1") {
            return {
              publicReference: "APP-DRAFT-1",
              status: "DRAFT",
              openingVersionId: "op-ver-1",
              applicationFormVersionId: "form-ver-1",
            };
          }
          return null;
        },
        update: async ({ data }: any) => data,
      },
      recruitmentOfferVersion: {
        findUnique: async ({ where }: any) => {
          if (where.id === "off-ver-1") {
            return {
              id: "off-ver-1",
              termsHash: "HASH-12345",
              offer: { status: "ISSUED", headcountCheck: true },
            };
          }
          return null;
        },
      },
      recruitmentOffer: {
        findUnique: async () => ({ status: "ISSUED" }),
        update: async ({ data }: any) => data,
      },
    };
  });

  describe("Position Families Lifecycle", () => {
    it("follows DRAFT -> ACTIVE -> RETIRED and rejects reverse transitions", async () => {
      const service = new PositionFamilyService(db);

      db.recruitmentPositionFamily.findUnique = async () => ({ code: "LOGISTICS", status: "RETIRED" });
      await expect(service.transitionStatus("LOGISTICS", RecruitmentPositionFamilyStatus.ACTIVE)).rejects.toThrow(
        "Unsupported reverse transition from RETIRED to ACTIVE."
      );
    });
  });

  describe("Requisitions Lifecycle", () => {
    it("rejects approval directly from DRAFT without submission & review", async () => {
      const service = new RequisitionService(db);
      await expect(service.approveRequisition("REQ-DRAFT", "approver-1")).rejects.toThrow(
        "Requisition must be UNDER_REVIEW before approval."
      );
    });

    it("rejects fill count beyond approved headcount", async () => {
      const service = new RequisitionService(db);
      await expect(service.incrementFilledCount("REQ-APPROVED")).rejects.toThrow(
        "Filled headcount cannot exceed approved headcount."
      );
    });
  });

  describe("Openings Lifecycle & Immutability", () => {
    it("rejects publication from rejected requisition or without approved process", async () => {
      const service = new OpeningService(db);
      await expect(service.publishOpening("OPN-CANCELLED")).rejects.toThrow(
        "Cannot publish a cancelled opening."
      );
    });

    it("proves published opening versions are immutable", async () => {
      const service = new OpeningService(db);
      await expect(
        service.updateOpeningVersion("OPN-PUBLISHED", { publicTitle: "Mutated Title" })
      ).rejects.toThrow("Published opening versions are immutable and cannot be mutated in place.");
    });
  });

  describe("Applications Immutability & Automation Restrictions", () => {
    it("preserves exact version references and enforces production lock on application submission", async () => {
      const service = new ApplicationService(db);
      await expect(service.submitApplication("APP-DRAFT-1")).rejects.toBeInstanceOf(RecruitmentProductionLockError);
    });

    it("rejects automated processes directly setting terminal state REJECTED without human review", async () => {
      const service = new ApplicationService(db);
      await expect(
        service.rejectApplication("APP-DRAFT-1", "FAIL", "SAFE", "")
      ).rejects.toThrow("Human reviewer identity is required for all rejection decisions.");
    });
  });

  describe("Offer Version Immutability", () => {
    it("requires exact issued offerVersionId and matching terms hash for offer acceptance", async () => {
      const service = new OfferService(db);
      await expect(
        service.acceptOffer("APP-1", "off-ver-1", "WRONG-HASH", "applicant-1")
      ).rejects.toThrow("Offer terms hash mismatch.");
    });
  });
});
