import type { ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";

export type PromoterLifecyclePresentation = {
  label: string;
  description: string;
  tone: ProtectedStatusTone;
  actionLabel?: string;
  actionHref?: string;
  restricted?: boolean;
};

const lifecycle: Readonly<Record<string, PromoterLifecyclePresentation>> = {
  APPLIED: { label: "Application received", description: "Your programme application has been recorded. Its review outcome will appear here when available.", tone: "information", actionLabel: "Review profile", actionHref: "/promoter/profile" },
  UNDER_REVIEW: { label: "Application under review", description: "Your programme application is being reviewed. No review or activation time is promised.", tone: "warning" },
  CHANGES_REQUIRED: { label: "Changes required", description: "Review the available profile and compliance information, then use the existing support route if you need help with the current requirement.", tone: "warning", actionLabel: "Review profile", actionHref: "/promoter/profile" },
  APPROVED: { label: "Approved — activation pending", description: "Approval does not mean the programme account is active. The current readiness requirements remain authoritative.", tone: "information", actionLabel: "Review compliance", actionHref: "/promoter/compliance" },
  ACTIVE: { label: "Programme account active", description: "Your account can use only the referral tools and records currently made available by the canonical authorities.", tone: "success" },
  SUSPENDED: { label: "Programme account restricted", description: "Some promoter actions are unavailable while this account is restricted. Historical access remains subject to the existing authorities.", tone: "danger", actionLabel: "Get support", actionHref: "/promoter/support", restricted: true },
  TERMINATED: { label: "Programme account closed", description: "This promoter account is no longer active. Contact support for the available next step.", tone: "danger", actionLabel: "Get support", actionHref: "/promoter/support", restricted: true },
  REJECTED: { label: "Application not approved", description: "This promoter application is not active. Contact support if an existing support pathway applies.", tone: "danger", actionLabel: "Get support", actionHref: "/promoter/support", restricted: true },
};

export function getPromoterLifecyclePresentation(status: string | null | undefined): PromoterLifecyclePresentation {
  return status ? lifecycle[status] ?? { label: "Programme status unavailable", description: "The current programme state could not be displayed safely.", tone: "neutral", actionLabel: "Get support", actionHref: "/promoter/support", restricted: true } : { label: "Programme account unavailable", description: "A promoter account projection is not available for this session.", tone: "neutral", actionLabel: "Get support", actionHref: "/promoter/support", restricted: true };
}

export type PromoterQualificationPresentation = {
  label: string;
  description: string;
  tone: ProtectedStatusTone;
  isHeld: boolean;
  isTerminal: boolean;
};

const qualification: Readonly<Record<string, PromoterQualificationPresentation>> = {
  PENDING: { label: "Pending qualification", description: "The attributed record is awaiting its canonical qualification outcome.", tone: "warning", isHeld: false, isTerminal: false },
  EVIDENCE_OBSERVED: { label: "Qualification evidence observed", description: "A qualifying event has been observed and remains subject to the canonical process.", tone: "information", isHeld: false, isTerminal: false },
  QUALIFIED_HELD: { label: "Qualified — earning held", description: "The qualification is recorded, but any related earning remains held.", tone: "warning", isHeld: true, isTerminal: false },
  RELEASABLE: { label: "Eligible for release review", description: "This record is eligible for the canonical release process; this is not a payment confirmation.", tone: "information", isHeld: true, isTerminal: false },
  RELEASED: { label: "Released", description: "The related earning has been released by the canonical process. Released does not by itself mean paid out.", tone: "success", isHeld: false, isTerminal: false },
  INVALIDATED: { label: "Qualification not available", description: "This qualification is no longer available in the current promoter projection.", tone: "neutral", isHeld: false, isTerminal: true },
  REVERSED: { label: "Qualification reversed", description: "The qualification was reversed. No internal review evidence is displayed here.", tone: "danger", isHeld: false, isTerminal: true },
  RECONCILIATION_REQUIRED: { label: "Qualification requires review", description: "This record needs canonical reconciliation before it can be treated as complete.", tone: "warning", isHeld: true, isTerminal: false },
};

export function getPromoterQualificationPresentation(status: string | null | undefined): PromoterQualificationPresentation {
  return status ? qualification[status] ?? { label: "Qualification status unavailable", description: "The current qualification state could not be displayed safely.", tone: "neutral", isHeld: false, isTerminal: false } : { label: "No qualification record", description: "A qualification record is not currently available for this referral.", tone: "neutral", isHeld: false, isTerminal: false };
}

type RecordPresentation = { label: string; description: string; tone: ProtectedStatusTone };

const earning: Readonly<Record<string, RecordPresentation>> = {
  PENDING: { label: "Pending", description: "This earning has not reached a held or available state." , tone: "warning" },
  ACCRUED_HELD: { label: "Accrued — held", description: "This amount is held and is not available to withdraw.", tone: "warning" },
  PAYABLE: { label: "Available", description: "The canonical earning projection marks this amount as payable.", tone: "success" },
  PARTIALLY_WITHDRAWN: { label: "Partially withdrawn", description: "Part of this earning has been included in a withdrawal process.", tone: "information" },
  WITHDRAWN: { label: "Withdrawn", description: "This earning has been included in the canonical withdrawal flow.", tone: "information" },
  REVERSED: { label: "Reversed", description: "This earning was reversed. Internal reasons are not shown.", tone: "danger" },
  PARTIALLY_REVERSED: { label: "Partially reversed", description: "Part of this earning was reversed. Internal reasons are not shown.", tone: "danger" },
  RECONCILIATION_REQUIRED: { label: "Requires reconciliation", description: "This earning cannot be treated as complete until canonical reconciliation finishes.", tone: "warning" },
};

export function getPromoterEarningPresentation(status: string | null | undefined): RecordPresentation {
  return status ? earning[status] ?? { label: "Earning status unavailable", description: "The current earning state could not be displayed safely.", tone: "neutral" } : { label: "Earning status unavailable", description: "The current earning state could not be displayed safely.", tone: "neutral" };
}

const referral: Readonly<Record<string, RecordPresentation>> = {
  ATTRIBUTED: { label: "Attributed", description: "An owned referral attribution has been recorded.", tone: "information" },
  PENDING_QUALIFICATION: { label: "Pending qualification", description: "This attributed record is awaiting a qualification outcome.", tone: "warning" },
  QUALIFIED: { label: "Qualified", description: "A qualification record is available for this attribution.", tone: "success" },
  EXPIRED: { label: "Expired", description: "This attribution is no longer active.", tone: "neutral" },
  INVALIDATED: { label: "Invalidated", description: "This attribution is no longer available in the current projection.", tone: "neutral" },
  RECONCILIATION_REQUIRED: { label: "Requires reconciliation", description: "This attribution needs canonical reconciliation before it can be treated as complete.", tone: "warning" },
};

export function getPromoterReferralPresentation(status: string | null | undefined): RecordPresentation {
  return status ? referral[status] ?? { label: "Referral status unavailable", description: "The current referral state could not be displayed safely.", tone: "neutral" } : { label: "Referral status unavailable", description: "The current referral state could not be displayed safely.", tone: "neutral" };
}

const withdrawal: Readonly<Record<string, RecordPresentation>> = {
  REQUESTED: { label: "Requested", description: "The withdrawal request was received by the canonical process.", tone: "information" },
  UNDER_REVIEW: { label: "Under review", description: "The request is in its existing review process.", tone: "warning" },
  APPROVED: { label: "Approved", description: "The request is approved; this does not confirm a payout.", tone: "information" },
  PROCESSING: { label: "Processing", description: "The canonical payout process is underway.", tone: "information" },
  PAID: { label: "Paid", description: "The canonical withdrawal record reports a completed payout.", tone: "success" },
  REJECTED: { label: "Not approved", description: "The request was not approved. Internal review details are not displayed.", tone: "danger" },
  CANCELLED: { label: "Cancelled", description: "The withdrawal request was cancelled.", tone: "neutral" },
  RECONCILIATION_REQUIRED: { label: "Requires reconciliation", description: "This request needs canonical reconciliation before it can be treated as complete.", tone: "warning" },
};

export function getPromoterWithdrawalPresentation(status: string | null | undefined): RecordPresentation {
  return status ? withdrawal[status] ?? { label: "Withdrawal status unavailable", description: "The current withdrawal state could not be displayed safely.", tone: "neutral" } : { label: "Withdrawal status unavailable", description: "The current withdrawal state could not be displayed safely.", tone: "neutral" };
}
