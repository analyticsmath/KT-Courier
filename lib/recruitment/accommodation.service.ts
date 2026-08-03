/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { RecruitmentAccommodationStatus } from "@/types/db";

export class AccommodationService {
  constructor(private readonly db: any) {}

  async submitAccommodationRequest(input: {
    applicationId: string;
    stage?: string;
    requestedDetail: string;
  }) {
    const publicReference = `ACC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentAccommodationRequest.create({
      data: {
        publicReference,
        applicationId: input.applicationId,
        stage: input.stage || "APPLICATION",
        requestedDetail: input.requestedDetail,
        status: RecruitmentAccommodationStatus.REQUESTED,
      },
    });
  }

  async updateAccommodationStatus(
    reference: string,
    updates: {
      status: RecruitmentAccommodationStatus;
      providedNotes?: string;
    }
  ) {
    return this.db.recruitmentAccommodationRequest.update({
      where: { publicReference: reference },
      data: updates,
    });
  }

  async getAccommodationRequestsForApplication(applicationId: string) {
    return this.db.recruitmentAccommodationRequest.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
    });
  }
}
