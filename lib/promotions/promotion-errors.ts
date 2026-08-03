export class PromotionError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "PromotionError";
  }
}

export class PromotionCampaignLifecycleError extends PromotionError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "PromotionCampaignLifecycleError";
  }
}

export class PromotionCodeValidationError extends PromotionError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "PromotionCodeValidationError";
  }
}

export class PromotionBudgetError extends PromotionError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "PromotionBudgetError";
  }
}

export class PromotionReservationError extends PromotionError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "PromotionReservationError";
  }
}

export class PromotionRedemptionError extends PromotionError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "PromotionRedemptionError";
  }
}

export class PromotionEligibilityError extends PromotionError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "PromotionEligibilityError";
  }
}

export class PromotionStackingError extends PromotionError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "PromotionStackingError";
  }
}

export class PromotionAllocationError extends PromotionError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "PromotionAllocationError";
  }
}

export class PromotionFundingError extends PromotionError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "PromotionFundingError";
  }
}

export class PromotionReconciliationError extends PromotionError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "PromotionReconciliationError";
  }
}
