/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma model types will be generated in Phase 26.5. */

export interface RecruitmentRepositoryContext {
  positionFamily: any;
  requisition: any;
  opening: any;
  openingVersion: any;
  applicantProfile: any;
  application: any;
  submittedAnswer: any;
  document: any;
  privacyNotice: any;
  consentRecord: any;
  eeDeclaration: any;
  eeConfig: any;
  reviewAssignment: any;
  decision: any;
  interviewPlan: any;
  interviewSlot: any;
  interview: any;
  scorecard: any;
  accommodation: any;
  checkPolicy: any;
  checkCase: any;
  offer: any;
  offerVersion: any;
  handoff: any;
  fraudCase: any;
  reconciliationCase: any;
  eventIntent: any;
}

export function createPrismaRecruitmentRepositories(db: any): RecruitmentRepositoryContext {
  return {
    positionFamily: db.recruitmentPositionFamily,
    requisition: db.recruitmentRequisition,
    opening: db.recruitmentOpening,
    openingVersion: db.recruitmentOpeningVersion,
    applicantProfile: db.recruitmentApplicantProfile,
    application: db.recruitmentApplication,
    submittedAnswer: db.recruitmentSubmittedAnswer,
    document: db.recruitmentApplicationDocument,
    privacyNotice: db.recruitmentPrivacyNoticeVersion,
    consentRecord: db.recruitmentConsentRecord,
    eeDeclaration: db.recruitmentEmploymentEquityDeclaration,
    eeConfig: db.recruitmentEmploymentEquityConfiguration,
    reviewAssignment: db.recruitmentReviewAssignment,
    decision: db.recruitmentDecision,
    interviewPlan: db.recruitmentInterviewPlan,
    interviewSlot: db.recruitmentInterviewSlot,
    interview: db.recruitmentInterview,
    scorecard: db.recruitmentScorecard,
    accommodation: db.recruitmentAccommodationRequest,
    checkPolicy: db.recruitmentBackgroundCheckPolicyVersion,
    checkCase: db.recruitmentCheckCase,
    offer: db.recruitmentOffer,
    offerVersion: db.recruitmentOfferVersion,
    handoff: db.recruitmentOnboardingHandoff,
    fraudCase: db.recruitmentFraudCase,
    reconciliationCase: db.recruitmentReconciliationCase,
    eventIntent: db.recruitmentEventIntent,
  };
}
