/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import {
  RecruitmentEEDeclarationStatus,
  RecruitmentEEUseMode,
  RecruitmentEmployerDesignationStatus,
} from "@/types/db";
import { RecruitmentError } from "./errors";

export class EmploymentEquityService {
  constructor(private readonly db: any) {}

  async saveDeclaration(input: {
    applicantProfileId: string;
    applicationId?: string;
    genderCategory?: string;
    raceCategory?: string;
    disabilityStatus?: string;
    citizenshipCategory?: string;
  }) {
    const publicReference = `EED-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentEmploymentEquityDeclaration.create({
      data: {
        publicReference,
        applicantProfileId: input.applicantProfileId,
        applicationId: input.applicationId || null,
        declarationStatus: RecruitmentEEDeclarationStatus.DECLARED,
        gender: input.genderCategory || null,
        populationGroup: input.raceCategory || null,
        disabilityDeclaration: input.disabilityStatus === "DISABILITY_DECLARED",
        citizenshipCategory: input.citizenshipCategory || null,
        useMode: RecruitmentEEUseMode.REPORTING_ONLY,
      },
    });
  }

  async getRawDeclarationForReviewer(applicantProfileId: string, accessor: { role: string; permissions: string[] }) {
    const isCompliance = accessor.role === "COMPLIANCE_OFFICER" || accessor.permissions.includes("recruitment_view_ee_declarations");
    if (!isCompliance) {
      throw new RecruitmentError("Raw employment-equity declarations are restricted to compliance personnel.");
    }

    return this.db.recruitmentEmploymentEquityDeclaration.findUnique({
      where: { applicantProfileId },
    });
  }

  async evaluateSelectionSupport(applicantProfileId: string, _jobId: string) {
    void _jobId;
    const config = await this.getConfiguration();
    if (!config.selectionSupportEnabled) {
      throw new RecruitmentError("Lawful selection support is disabled without an approved effective policy.");
    }
    return { applicantProfileId, selectionSupportApproved: true };
  }

  async createDeclaration(input: {
    applicantProfileId: string;
    applicationId?: string;
    declarationStatus: RecruitmentEEDeclarationStatus;
    populationGroup?: string;
    gender?: string;
    disabilityDeclaration?: boolean;
    citizenshipCategory?: string;
  }) {
    const publicReference = `EED-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.db.recruitmentEmploymentEquityDeclaration.create({
      data: {
        publicReference,
        applicantProfileId: input.applicantProfileId,
        applicationId: input.applicationId || null,
        declarationStatus: input.declarationStatus,
        populationGroup: input.populationGroup || null,
        gender: input.gender || null,
        disabilityDeclaration: input.disabilityDeclaration ?? false,
        citizenshipCategory: input.citizenshipCategory || null,
        useMode: RecruitmentEEUseMode.REPORTING_ONLY,
      },
    });
  }

  async getConfiguration() {
    const config = await this.db.recruitmentEmploymentEquityConfiguration.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!config) {
      return {
        useMode: RecruitmentEEUseMode.REPORTING_ONLY,
        employerDesignation: RecruitmentEmployerDesignationStatus.UNKNOWN,
        employerDesignationStatus: RecruitmentEmployerDesignationStatus.UNKNOWN,
        reportingEnabled: true,
        selectionSupportEnabled: false,
      };
    }

    return config;
  }

  async updateConfiguration(reference: string, updates: { employerDesignationStatus?: RecruitmentEmployerDesignationStatus; reportingEnabled?: boolean }) {
    return this.db.recruitmentEmploymentEquityConfiguration.update({
      where: { publicReference: reference },
      data: updates,
    });
  }

  async getEquityReportProjection() {
    const declarations = await this.db.recruitmentEmploymentEquityDeclaration.findMany();
    const countByGroup: Record<string, number> = {};
    const countByGender: Record<string, number> = {};

    for (const d of declarations) {
      if (d.populationGroup) {
        countByGroup[d.populationGroup] = (countByGroup[d.populationGroup] || 0) + 1;
      }
      if (d.gender) {
        countByGender[d.gender] = (countByGender[d.gender] || 0) + 1;
      }
    }

    return {
      totalDeclarations: declarations.length,
      mode: RecruitmentEEUseMode.REPORTING_ONLY,
      countByGroup,
      countByGender,
    };
  }
}
