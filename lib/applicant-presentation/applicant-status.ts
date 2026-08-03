import type { ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";

export type ApplicantStatus = { label: string; explanation: string; actionRequired: boolean; terminal: boolean; tone: ProtectedStatusTone; dateAllowed: boolean };

const statuses: Record<string, ApplicantStatus> = {
  DRAFT: { label: "Application in progress", explanation: "Your application has not been submitted.", actionRequired: true, terminal: false, tone: "information", dateAllowed: false },
  SUBMITTED: { label: "Application received", explanation: "Your application has been received.", actionRequired: false, terminal: false, tone: "information", dateAllowed: true },
  COMPLETENESS_REVIEW: { label: "Application being reviewed", explanation: "Your application is being reviewed.", actionRequired: false, terminal: false, tone: "information", dateAllowed: true },
  ELIGIBILITY_REVIEW: { label: "Application being reviewed", explanation: "Your application is being reviewed.", actionRequired: false, terminal: false, tone: "information", dateAllowed: true },
  HUMAN_REVIEW: { label: "Application being reviewed", explanation: "Your application is being reviewed.", actionRequired: false, terminal: false, tone: "information", dateAllowed: true },
  INTERVIEW: { label: "Interview stage", explanation: "Interview information is available here when it is scheduled.", actionRequired: false, terminal: false, tone: "information", dateAllowed: true },
  CONDITIONAL_CHECKS: { label: "Additional checks", explanation: "Any candidate-facing check update is shown here when available.", actionRequired: false, terminal: false, tone: "warning", dateAllowed: true },
  OFFER_APPROVAL: { label: "Application being reviewed", explanation: "Your application is being reviewed.", actionRequired: false, terminal: false, tone: "information", dateAllowed: true },
  OFFERED: { label: "Offer available", explanation: "An offer is available to review.", actionRequired: true, terminal: false, tone: "success", dateAllowed: true },
  OFFER_ACCEPTED: { label: "Offer accepted", explanation: "Your acceptance has been recorded.", actionRequired: false, terminal: false, tone: "success", dateAllowed: true },
  ONBOARDING_HANDOFF: { label: "Next steps in progress", explanation: "The next step is being handled through the relevant process.", actionRequired: false, terminal: false, tone: "information", dateAllowed: true },
  COMPLETED: { label: "Application complete", explanation: "This application is complete.", actionRequired: false, terminal: true, tone: "success", dateAllowed: true },
  WITHDRAWN: { label: "Application withdrawn", explanation: "You withdrew this application.", actionRequired: false, terminal: true, tone: "neutral", dateAllowed: true },
  REJECTED: { label: "Application closed", explanation: "This application is no longer progressing.", actionRequired: false, terminal: true, tone: "neutral", dateAllowed: true },
  OFFER_DECLINED: { label: "Offer declined", explanation: "The offer was declined.", actionRequired: false, terminal: true, tone: "neutral", dateAllowed: true },
  OFFER_EXPIRED: { label: "Offer expired", explanation: "This offer is no longer available.", actionRequired: false, terminal: true, tone: "neutral", dateAllowed: true },
  OPENING_CANCELLED: { label: "Opening closed", explanation: "This opening is no longer available.", actionRequired: false, terminal: true, tone: "neutral", dateAllowed: true },
};

export function getApplicantStatus(status?: string | null): ApplicantStatus {
  return status && statuses[status] ? statuses[status] : { label: "Status update unavailable", explanation: "A current application update is not available.", actionRequired: false, terminal: false, tone: "neutral", dateAllowed: false };
}
