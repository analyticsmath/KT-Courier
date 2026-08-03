/* eslint-disable @typescript-eslint/no-explicit-any -- focused fake repositories exercise DB-free handoff boundaries. */
import { beforeEach, describe, expect, it } from "vitest";
import { OnboardingHandoffService } from "@/lib/recruitment/onboarding-handoff.service";
import { RecruitmentHandoffTargetType } from "@/types/db";
import { RecruitmentProductionLockError } from "@/lib/recruitment/production-readiness";

describe("Phase 26 Employee Provisioning and Driver Onboarding Authority", () => {
  let db: any;
  let service: OnboardingHandoffService;

  beforeEach(() => {
    db = {
      recruitmentOfferVersion: {
        findUnique: async ({ where }: any) => {
          if (where.id === "offer-ver-1") {
            return {
              id: "offer-ver-1",
              offerId: "off-1",
              roleTitle: "Senior Courier Operations Lead",
              departmentCode: "OPS",
              locationCode: "JHB-MAIN",
              proposedStartDate: new Date("2026-08-01"),
              offer: { status: "ACCEPTED" },
            };
          }
          return null;
        },
      },
      recruitmentApplication: {
        findUnique: async ({ where }: any) => {
          if (where.id === "app-driver-1" || where.id === "app-emp-1") {
            return {
              id: where.id,
              applicantProfileId: "prof-1",
              applicantProfile: {
                userId: "user-123",
                legalName: "John Doe",
                primaryPhoneReference: "+27821234567",
              },
              opening: {
                positionFamilyCode: where.id === "app-driver-1" ? "COURIER_DRIVER" : "GENERAL_OPERATIONS",
                title: where.id === "app-driver-1" ? "Courier Driver" : "Operations Officer",
              },
              documents: [
                { documentCategory: "DRIVING_LICENCE", publicReference: "DOC-LIC-1", isLatest: true },
                { documentCategory: "PROFESSIONAL_DRIVING_PERMIT", publicReference: "DOC-PRDP-1", isLatest: true },
              ],
            };
          }
          return null;
        },
        update: async ({ data }: any) => data,
      },
      recruitmentOnboardingHandoff: {
        findFirst: async () => null,
        findUnique: async ({ where }: any) => {
          if (where.publicReference === "HND-COMPLETED") {
            return {
              publicReference: "HND-COMPLETED",
              applicationId: "app-emp-1",
              offerVersionId: "offer-ver-1",
              applicantProfileId: "prof-1",
              targetType: RecruitmentHandoffTargetType.EMPLOYEE,
              status: "COMPLETED",
              offerVersion: { id: "offer-ver-1", roleTitle: "Lead", offer: { status: "ACCEPTED" } },
              application: { applicantProfile: { userId: "user-123", legalName: "John Doe" } },
            };
          }
          return null;
        },
        create: async ({ data }: any) => ({ id: "hnd-1", publicReference: "HND-100", ...data }),
        update: async ({ data }: any) => ({ id: "hnd-1", ...data }),
      },
      adminProfile: {
        upsert: async ({ create }: any) => ({ id: "adm-prof-1", ...create }),
      },
      driverProfile: {
        findUnique: async () => null,
        upsert: async ({ create }: any) => ({ id: "drv-prof-1", driverCode: "DRV-1001", ...create }),
      },
      recruitmentReconciliationCase: {
        create: async ({ data }: any) => ({ id: "rec-1", ...data }),
      },
    };
    service = new OnboardingHandoffService(db);
  });

  it("requires an exact accepted offer version to create handoff", async () => {
    db.recruitmentOfferVersion.findUnique = async () => ({
      id: "offer-ver-1",
      offer: { status: "DRAFT" },
    });

    await expect(
      service.createHandoff({
        applicationId: "app-emp-1",
        offerVersionId: "offer-ver-1",
        applicantProfileId: "prof-1",
        targetType: RecruitmentHandoffTargetType.EMPLOYEE,
        operationId: "OP-1",
        requestHash: "HASH-1",
      })
    ).rejects.toThrow("Onboarding handoff requires an accepted offer.");
  });

  it("rejects driver handoff for non-driver position family", async () => {
    await expect(
      service.createHandoff({
        applicationId: "app-emp-1",
        offerVersionId: "offer-ver-1",
        applicantProfileId: "prof-1",
        targetType: RecruitmentHandoffTargetType.DRIVER,
        operationId: "OP-2",
        requestHash: "HASH-2",
      })
    ).rejects.toThrow("Driver handoff target is incompatible with non-driver position family.");
  });

  it("prevents duplicate handoff creation and supports operation replay", async () => {
    db.recruitmentOnboardingHandoff.findFirst = async () => ({
      id: "hnd-existing",
      requestHash: "HASH-REPLAY",
      status: "PENDING",
    });

    const result = await service.createHandoff({
      applicationId: "app-driver-1",
      offerVersionId: "offer-ver-1",
      applicantProfileId: "prof-1",
      targetType: RecruitmentHandoffTargetType.DRIVER,
      operationId: "OP-3",
      requestHash: "HASH-REPLAY",
    });

    expect(result.id).toBe("hnd-existing");
  });

  it("enforces production readiness lock when processing Employee onboarding handoff", async () => {
    await expect(service.processHandoff("HND-COMPLETED")).rejects.toBeInstanceOf(RecruitmentProductionLockError);
  });

  it("enforces production readiness lock when processing Driver onboarding handoff", async () => {
    await expect(service.processHandoff("HND-DRV")).rejects.toBeInstanceOf(RecruitmentProductionLockError);
  });
});
