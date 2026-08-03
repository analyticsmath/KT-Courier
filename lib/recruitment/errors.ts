export class RecruitmentError extends Error {
  constructor(message: string, public readonly code: string = "RECRUITMENT_ERROR") {
    super(message);
    this.name = "RecruitmentError";
  }
}

export class RecruitmentIneligibilityError extends RecruitmentError {
  constructor(message: string) {
    super(message, "RECRUITMENT_INELIGIBILITY");
    this.name = "RecruitmentIneligibilityError";
  }
}

export class RecruitmentPermissionDeniedError extends RecruitmentError {
  constructor(message = "Access denied to recruitment resource.") {
    super(message, "RECRUITMENT_PERMISSION_DENIED");
    this.name = "RecruitmentPermissionDeniedError";
  }
}

export class RecruitmentReconciliationRequiredError extends RecruitmentError {
  constructor(message: string) {
    super(message, "RECRUITMENT_RECONCILIATION_REQUIRED");
    this.name = "RecruitmentReconciliationRequiredError";
  }
}

export class RecruitmentFraudBlockError extends RecruitmentError {
  constructor(message: string) {
    super(message, "RECRUITMENT_FRAUD_BLOCK");
    this.name = "RecruitmentFraudBlockError";
  }
}

export class RecruitmentHeadcountExceededError extends RecruitmentError {
  constructor(message = "Approved requisition headcount limit exceeded.") {
    super(message, "RECRUITMENT_HEADCOUNT_EXCEEDED");
    this.name = "RecruitmentHeadcountExceededError";
  }
}

export class RecruitmentCreditCheckNotAuthorizedError extends RecruitmentError {
  constructor(message = "EMPLOYMENT_CREDIT_CHECK_NOT_AUTHORIZED_FOR_POSITION") {
    super(message, "EMPLOYMENT_CREDIT_CHECK_NOT_AUTHORIZED_FOR_POSITION");
    this.name = "RecruitmentCreditCheckNotAuthorizedError";
  }
}
