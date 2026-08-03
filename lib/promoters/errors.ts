export type PromoterErrorCode =
  | "PROMOTER_PRODUCTION_LOCKED"
  | "PROMOTER_INVALID_COMMAND"
  | "PROMOTER_FORBIDDEN"
  | "PROMOTER_NOT_ELIGIBLE"
  | "PROMOTER_AGREEMENT_REQUIRED"
  | "PROMOTER_ATTRIBUTION_CONFLICT"
  | "PROMOTER_TOKEN_INVALID"
  | "PROMOTER_TOKEN_EXPIRED"
  | "BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE";

export class PromoterError extends Error {
  constructor(readonly code: PromoterErrorCode, message: string) {
    super(message);
    this.name = "PromoterError";
  }
}
