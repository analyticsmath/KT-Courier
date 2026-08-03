/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { prisma } from "@/lib/db/prisma";
import { createPrismaRecruitmentRepositories } from "./repositories";
import { assertRecruitmentProductionReady, RECRUITMENT_PRODUCTION_BLOCK_REASON } from "./production-readiness";
import { RecruitmentSecureDocumentAdapter } from "./secure-document.adapter";
import { ApplicantProfileService } from "./applicant-profile.service";
import { ApplicationService } from "./application.service";
import { BackgroundCheckService } from "./background-check.service";
import { EmploymentEquityService } from "./employment-equity.service";
import { EvaluationService } from "./evaluation.service";
import { RecruitmentFraudService } from "./fraud.service";
import { InterviewService } from "./interview.service";
import { OnboardingHandoffService } from "./onboarding-handoff.service";
import { OfferService } from "./offer.service";
import { OpeningService } from "./opening.service";
import { PositionFamilyService } from "./position-family.service";
import { PrivacyRetentionService } from "./privacy-retention.service";
import { RecruitmentReconciliationService } from "./reconciliation.service";
import { RequisitionService } from "./requisition.service";
import { ReviewAssignmentService } from "./review-assignment.service";
import { ScreeningService } from "./screening.service";

class PrismaRecruitmentOutbox {
  constructor(private readonly db: any) {}
  async append(input: { eventType: string; aggregateReference: string; operationId: string; safePayload?: object }) {
    return this.db.recruitmentEventIntent.create({ data: input });
  }
}

export function resolveRecruitmentProductionComposition() {
  const database: any = prisma;

  // 1. Concrete recruitment Prisma repositories
  const repositories = createPrismaRecruitmentRepositories(database);

  // 2. Canonical User/applicant identity authority
  const identity = Object.freeze({
    findUser: (id: string) => database.user.findUnique({ where: { id }, select: { id: true, email: true, role: true } }),
  });

  // 3. Concrete secure-document authority
  const secureDocumentAdapter = new RecruitmentSecureDocumentAdapter(database);

  // 4. Concrete Employee provisioning authority adapter
  const employeeProvisioningAuthority = Object.freeze({
    findAdminProfile: (userId: string) => database.adminProfile.findUnique({ where: { userId } }),
    upsertAdminProfile: (data: any) => database.adminProfile.upsert(data),
  });

  // 5. Concrete Driver onboarding authority adapter
  const driverOnboardingAuthority = Object.freeze({
    findDriverProfile: (userId: string) => database.driverProfile.findUnique({ where: { userId } }),
    upsertDriverProfile: (data: any) => database.driverProfile.upsert(data),
  });

  // 6–11. Domain services instantiated with concrete Prisma & authorities
  const services = Object.freeze({
    positionFamilies: new PositionFamilyService(database),
    requisitions: new RequisitionService(database),
    openings: new OpeningService(database),
    applicantProfiles: new ApplicantProfileService(database),
    applications: new ApplicationService(database),
    screening: new ScreeningService(database),
    reviewAssignments: new ReviewAssignmentService(database),
    evaluations: new EvaluationService(database),
    interviews: new InterviewService(database),
    checks: new BackgroundCheckService(database),
    offers: new OfferService(database),
    handoffs: new OnboardingHandoffService(database),
    privacyRetention: new PrivacyRetentionService(database),
    employmentEquity: new EmploymentEquityService(database),
    fraud: new RecruitmentFraudService(database),
    reconciliation: new RecruitmentReconciliationService(database),
    secureDocuments: secureDocumentAdapter,
  });

  // 12. Durable event outbox
  const outbox = new PrismaRecruitmentOutbox(database);

  const composition = Object.freeze({
    database,
    repositories,
    identity,
    secureDocumentAdapter,
    employeeProvisioningAuthority,
    driverOnboardingAuthority,
    services,
    outbox,
  });

  // 13. Production readiness assertion
  try {
    assertRecruitmentProductionReady();
    return Object.freeze({ status: "READY" as const, ...composition });
  } catch {
    return Object.freeze({ status: "LOCKED" as const, code: RECRUITMENT_PRODUCTION_BLOCK_REASON, ...composition });
  }
}
