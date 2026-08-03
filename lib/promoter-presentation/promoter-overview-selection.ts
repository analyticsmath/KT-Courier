export type PromoterOperationalState =
  | "ACCOUNT_RESTRICTED"
  | "APPLICATION_CHANGES_REQUIRED"
  | "APPLICATION_UNDER_REVIEW"
  | "APPROVED_NOT_ACTIVE"
  | "COMPLIANCE_ACTION_REQUIRED"
  | "ACTIVE_WITH_PENDING_QUALIFICATION"
  | "ACTIVE_NO_RECENT_ACTIVITY"
  | "SOURCE_UNAVAILABLE";

export function selectPromoterOperationalState(input: {
  accountStatus?: string | null;
  identityStatus?: string | null;
  taxProfileStatus?: string | null;
  payoutReadinessStatus?: string | null;
  agreementStatus?: string | null;
  pendingQualificationCount?: number | null;
  hasRecentReferralActivity?: boolean | null;
}): PromoterOperationalState {
  const status = input.accountStatus;
  if (!status || !["APPLIED", "UNDER_REVIEW", "CHANGES_REQUIRED", "APPROVED", "ACTIVE", "SUSPENDED", "TERMINATED", "REJECTED"].includes(status)) return "SOURCE_UNAVAILABLE";
  if (["SUSPENDED", "TERMINATED", "REJECTED"].includes(status)) return "ACCOUNT_RESTRICTED";
  if (status === "CHANGES_REQUIRED") return "APPLICATION_CHANGES_REQUIRED";
  if (status === "APPLIED" || status === "UNDER_REVIEW") return "APPLICATION_UNDER_REVIEW";
  if (status === "APPROVED") return "APPROVED_NOT_ACTIVE";
  if (status !== "ACTIVE") return "SOURCE_UNAVAILABLE";
  if (input.identityStatus !== "VERIFIED" || input.taxProfileStatus !== "READY" || input.payoutReadinessStatus !== "READY" || input.agreementStatus !== "ACCEPTED") return "COMPLIANCE_ACTION_REQUIRED";
  if ((input.pendingQualificationCount ?? 0) > 0) return "ACTIVE_WITH_PENDING_QUALIFICATION";
  if (!input.hasRecentReferralActivity) return "ACTIVE_NO_RECENT_ACTIVITY";
  return "ACTIVE_NO_RECENT_ACTIVITY";
}
