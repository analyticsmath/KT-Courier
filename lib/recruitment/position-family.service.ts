/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { RecruitmentTrack, RecruitmentPositionFamilyStatus } from "@/types/db";
import { RecruitmentError } from "./errors";

export class PositionFamilyService {
  constructor(private readonly db: any) {}

  async createPositionFamily(input: {
    code: string;
    title: string;
    recruitmentTrack: RecruitmentTrack;
    departmentCode?: string;
  }) {
    const publicReference = `PF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return this.db.recruitmentPositionFamily.create({
      data: {
        publicReference,
        code: input.code,
        title: input.title,
        recruitmentTrack: input.recruitmentTrack,
        departmentCode: input.departmentCode || null,
        status: RecruitmentPositionFamilyStatus.DRAFT,
      },
    });
  }

  async transitionStatus(codeOrRef: string, newStatus: RecruitmentPositionFamilyStatus) {
    const family = (await this.db.recruitmentPositionFamily.findUnique({
      where: { code: codeOrRef },
    })) || (await this.db.recruitmentPositionFamily.findUnique({
      where: { publicReference: codeOrRef },
    }));

    if (!family) throw new RecruitmentError("Position family not found.");

    if (family.status === "RETIRED" && newStatus === "ACTIVE") {
      throw new RecruitmentError("Unsupported reverse transition from RETIRED to ACTIVE.");
    }

    return this.db.recruitmentPositionFamily.update({
      where: { id: family.id || family.code },
      data: { status: newStatus },
    });
  }

  async updatePositionFamily(
    reference: string,
    updates: {
      title?: string;
      departmentCode?: string;
      status?: RecruitmentPositionFamilyStatus;
    }
  ) {
    return this.db.recruitmentPositionFamily.update({
      where: { publicReference: reference },
      data: updates,
    });
  }

  async getPositionFamily(reference: string) {
    return this.db.recruitmentPositionFamily.findUnique({
      where: { publicReference: reference },
    });
  }

  async listPositionFamilies(filter?: { track?: RecruitmentTrack; status?: RecruitmentPositionFamilyStatus }) {
    const where: any = {};
    if (filter?.track) where.recruitmentTrack = filter.track;
    if (filter?.status) where.status = filter.status;
    return this.db.recruitmentPositionFamily.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }
}
