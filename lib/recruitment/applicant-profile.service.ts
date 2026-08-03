/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import {
  RecruitmentWorkAuthorizationStatus,
  RecruitmentAgeEligibilityStatus,
  RecruitmentProfileStatus,
} from "@/types/db";
import { RecruitmentIneligibilityError } from "./errors";

export class ApplicantProfileService {
  constructor(private readonly db: any) {}

  async createOrGetApplicantProfile(input: {
    userId: string;
    legalName: string;
    preferredName?: string;
    primaryEmailReference: string;
    primaryPhoneReference?: string;
    city?: string;
    province?: string;
    workAuthorizationStatus: RecruitmentWorkAuthorizationStatus;
    isAdult: boolean;
  }) {
    const existing = await this.db.recruitmentApplicantProfile.findUnique({
      where: { userId: input.userId },
    });

    if (existing) return existing;

    if (!input.isAdult) {
      throw new RecruitmentIneligibilityError(
        "UNDER_18_APPLICATION_NOT_SUPPORTED: KT Couriers recruitment is strictly available for adult applicants."
      );
    }

    const publicReference = `APF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentApplicantProfile.create({
      data: {
        publicReference,
        userId: input.userId,
        legalName: input.legalName,
        preferredName: input.preferredName || null,
        primaryEmailReference: input.primaryEmailReference,
        primaryPhoneReference: input.primaryPhoneReference || null,
        city: input.city || null,
        province: input.province || null,
        workAuthorizationStatus: input.workAuthorizationStatus,
        ageEligibilityStatus: RecruitmentAgeEligibilityStatus.VERIFIED_ADULT,
        profileStatus: RecruitmentProfileStatus.ACTIVE,
      },
    });
  }

  async getProfileByUserId(userId: string) {
    return this.db.recruitmentApplicantProfile.findUnique({
      where: { userId },
      include: {
        applications: true,
      },
    });
  }

  async updateProfile(
    userId: string,
    updates: {
      preferredName?: string;
      primaryPhoneReference?: string;
      city?: string;
      province?: string;
      workAuthorizationStatus?: RecruitmentWorkAuthorizationStatus;
    }
  ) {
    return this.db.recruitmentApplicantProfile.update({
      where: { userId },
      data: updates,
    });
  }
}
