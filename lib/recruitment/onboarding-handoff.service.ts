/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import {
  RecruitmentHandoffTargetType,
  RecruitmentHandoffStatus,
  RecruitmentApplicationState,
} from "@/types/db";
import { assertRecruitmentProductionReady } from "./production-readiness";
import { RecruitmentError } from "./errors";

export interface EmployeeHandoffPayload {
  userId: string;
  roleTitle: string;
  department?: string | null;
  location?: string | null;
  startDate?: Date | null;
  relationshipClassification: string;
  acceptedOfferReference: string;
  recruitmentSourceReference: string;
}

export interface DriverHandoffPayload {
  userId: string;
  displayName: string;
  phone?: string | null;
  licenseCategoryReference?: string | null;
  prdpStatusReference?: string | null;
  vehicleRequirementReference?: string | null;
  acceptedOfferReference: string;
  recruitmentSourceReference: string;
}

export class OnboardingHandoffService {
  constructor(private readonly db: any) {}

  async createHandoff(input: {
    applicationId: string;
    offerVersionId: string;
    applicantProfileId: string;
    targetType: RecruitmentHandoffTargetType;
    operationId: string;
    requestHash: string;
  }) {
    const offerVersion = await this.db.recruitmentOfferVersion.findUnique({
      where: { id: input.offerVersionId },
      include: { offer: true },
    });
    if (!offerVersion || offerVersion.offer?.status !== "ACCEPTED") {
      throw new RecruitmentError("Onboarding handoff requires an accepted offer.");
    }

    // Verify exact offer version match
    if (offerVersion.id !== input.offerVersionId) {
      throw new RecruitmentError("Exact accepted offer version is required for handoff.");
    }

    const application = await this.db.recruitmentApplication.findUnique({
      where: { id: input.applicationId },
      include: { applicantProfile: true, opening: true, checkCases: true, documents: true },
    });

    if (!application) {
      throw new RecruitmentError("Application not found for handoff.");
    }

    // Target compatibility checks
    if (input.targetType === RecruitmentHandoffTargetType.DRIVER) {
      const positionFamily = application.opening?.positionFamilyCode || "";
      const isDriverTrack = positionFamily.toLowerCase().includes("driver") || application.opening?.title?.toLowerCase().includes("driver");
      if (!isDriverTrack) {
        throw new RecruitmentError("Driver handoff target is incompatible with non-driver position family.");
      }

      // Licence and PrDP readiness verification
      const licenceDoc = application.documents?.find((d: any) => d.documentCategory === "DRIVING_LICENCE" && d.isLatest);
      const prdpDoc = application.documents?.find((d: any) => d.documentCategory === "PROFESSIONAL_DRIVING_PERMIT" && d.isLatest);

      if (!licenceDoc) {
        throw new RecruitmentError("Driver handoff requires verified driving licence readiness.");
      }
      if (!prdpDoc) {
        throw new RecruitmentError("Driver handoff requires verified PrDP readiness.");
      }
    }

    // Duplicate check
    const existingHandoff = await this.db.recruitmentOnboardingHandoff.findFirst({
      where: {
        applicationId: input.applicationId,
        status: { in: [RecruitmentHandoffStatus.PENDING, RecruitmentHandoffStatus.PROCESSING, RecruitmentHandoffStatus.COMPLETED] },
      },
    });

    if (existingHandoff) {
      if (existingHandoff.requestHash === input.requestHash) {
        return existingHandoff; // Operation replay
      }
      throw new RecruitmentError("A handoff process already exists for this application with a changed request.");
    }

    const publicReference = `HND-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentOnboardingHandoff.create({
      data: {
        publicReference,
        applicationId: input.applicationId,
        offerVersionId: input.offerVersionId,
        applicantProfileId: input.applicantProfileId,
        targetType: input.targetType,
        status: RecruitmentHandoffStatus.PENDING,
        requestedAt: new Date(),
        operationId: input.operationId,
        requestHash: input.requestHash,
      },
    });
  }

  /**
   * Invokes the canonical existing Employee (AdminProfile) or Driver (DriverProfile) onboarding authority.
   * Does NOT directly grant active user roles or dispatch eligibility from recruitment tables.
   */
  async processHandoff(handoffReference: string) {
    assertRecruitmentProductionReady();

    const handoff = await this.db.recruitmentOnboardingHandoff.findUnique({
      where: { publicReference: handoffReference },
      include: {
        application: {
          include: {
            applicantProfile: true,
            opening: true,
            documents: true,
          },
        },
        offerVersion: { include: { offer: true } },
      },
    });

    if (!handoff) throw new RecruitmentError("Handoff record not found.");
    if (handoff.offerVersion.offer?.status !== "ACCEPTED") {
      throw new RecruitmentError("Onboarding handoff requires an accepted offer.");
    }

    // Replay check
    if (handoff.status === RecruitmentHandoffStatus.COMPLETED) {
      return handoff;
    }

    await this.db.recruitmentOnboardingHandoff.update({
      where: { publicReference: handoffReference },
      data: {
        status: RecruitmentHandoffStatus.PROCESSING,
        processedAt: new Date(),
      },
    });

    const profile = handoff.application.applicantProfile;
    let employeeReference: string | null = null;
    let driverReference: string | null = null;

    try {
      if (handoff.targetType === RecruitmentHandoffTargetType.EMPLOYEE) {
        // Minimal approved information transfer
        const employeePayload: EmployeeHandoffPayload = {
          userId: profile.userId,
          roleTitle: handoff.offerVersion.roleTitle,
          department: handoff.offerVersion.departmentCode || null,
          location: handoff.offerVersion.locationCode || null,
          startDate: handoff.offerVersion.proposedStartDate || null,
          relationshipClassification: "REGULAR_EMPLOYEE",
          acceptedOfferReference: handoff.offerVersionId,
          recruitmentSourceReference: handoff.applicationId,
        };

        // Invoke canonical Employee provisioning authority (AdminProfile)
        const adminProfile = await this.db.adminProfile.upsert({
          where: { userId: employeePayload.userId },
          update: {
            department: employeePayload.department,
            displayName: profile.legalName,
            jobTitle: employeePayload.roleTitle,
            phone: profile.primaryPhoneReference || null,
          },
          create: {
            userId: employeePayload.userId,
            department: employeePayload.department,
            displayName: profile.legalName,
            jobTitle: employeePayload.roleTitle,
            phone: profile.primaryPhoneReference || null,
          },
        });
        employeeReference = adminProfile.id;
      } else if (handoff.targetType === RecruitmentHandoffTargetType.DRIVER) {
        // Driver readiness check
        const licenceDoc = handoff.application.documents?.find((d: any) => d.documentCategory === "DRIVING_LICENCE" && d.isLatest);
        const prdpDoc = handoff.application.documents?.find((d: any) => d.documentCategory === "PROFESSIONAL_DRIVING_PERMIT" && d.isLatest);

        if (!licenceDoc || !prdpDoc) {
          throw new RecruitmentError("Incomplete driver credential readiness.");
        }

        // Minimal protected credential references
        const driverPayload: DriverHandoffPayload = {
          userId: profile.userId,
          displayName: profile.legalName,
          phone: profile.primaryPhoneReference || null,
          licenseCategoryReference: licenceDoc.publicReference,
          prdpStatusReference: prdpDoc.publicReference,
          vehicleRequirementReference: "VEHICLE_PENDING_ONBOARDING",
          acceptedOfferReference: handoff.offerVersionId,
          recruitmentSourceReference: handoff.applicationId,
        };

        // Invoke canonical Driver onboarding authority (DriverProfile)
        // Note: active remains false, status remains PENDING_REVIEW (no direct driver activation)
        const existingDriver = await this.db.driverProfile.findUnique({ where: { userId: driverPayload.userId } });
        const driverCode = existingDriver?.driverCode || `DRV-${Date.now().toString().slice(-6)}`;

        const driverProfile = await this.db.driverProfile.upsert({
          where: { userId: driverPayload.userId },
          update: {
            displayName: driverPayload.displayName,
            phone: driverPayload.phone,
            onboardingStatus: "PROFILE_INCOMPLETE",
          },
          create: {
            userId: driverPayload.userId,
            driverCode,
            displayName: driverPayload.displayName,
            phone: driverPayload.phone,
            onboardingStatus: "PROFILE_INCOMPLETE",
            status: "PENDING_REVIEW",
            availability: "OFFLINE",
            active: false,
          },
        });
        driverReference = driverProfile.id;
      }

      const completed = await this.db.recruitmentOnboardingHandoff.update({
        where: { publicReference: handoffReference },
        data: {
          status: RecruitmentHandoffStatus.COMPLETED,
          employeeReference,
          driverReference,
          completedAt: new Date(),
        },
      });

      await this.db.recruitmentApplication.update({
        where: { id: handoff.applicationId },
        data: {
          status: RecruitmentApplicationState.COMPLETED,
          currentStage: "COMPLETED",
          completedAt: new Date(),
          optimisticVersion: { increment: 1 },
        },
      });

      return completed;
    } catch (err: any) {
      // Create reconciliation record on failure
      await this.db.recruitmentReconciliationCase.create({
        data: {
          publicReference: `REC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          applicationId: handoff.applicationId,
          reasonCode: "HANDOFF_PROCESSING_FAILED",
          status: "OPEN",
          details: { message: err.message, handoffReference },
        },
      });

      await this.db.recruitmentOnboardingHandoff.update({
        where: { publicReference: handoffReference },
        data: { status: RecruitmentHandoffStatus.FAILED },
      });

      throw err;
    }
  }

  async listHandoffs(filter?: { status?: string }) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;

    return this.db.recruitmentOnboardingHandoff.findMany({
      where,
      include: {
        application: {
          include: { applicantProfile: true },
        },
        offerVersion: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getHandoffByReference(reference: string) {
    return this.db.recruitmentOnboardingHandoff.findUnique({
      where: { publicReference: reference },
      include: {
        application: {
          include: { applicantProfile: true },
        },
        offerVersion: true,
      },
    });
  }
}
