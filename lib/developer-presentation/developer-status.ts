import type { ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";

export type DeveloperPresentationStatus = Readonly<{
  label: string;
  tone: ProtectedStatusTone;
  description: string;
}>;

const applicationStatuses: Readonly<Record<string, DeveloperPresentationStatus>> = {
  DRAFT: { label: "Draft", tone: "neutral", description: "This application has not been submitted for review." },
  SUBMITTED: { label: "Submitted", tone: "information", description: "The application has been submitted and is awaiting review." },
  UNDER_REVIEW: { label: "Under review", tone: "information", description: "The canonical review workflow is in progress." },
  APPROVED: { label: "Approved", tone: "success", description: "The application has an approval record; operational activation remains authoritative." },
  ACTIVE: { label: "Active", tone: "success", description: "The application is active for its approved environment and scopes." },
  SUSPENDED: { label: "Suspended", tone: "danger", description: "This application is suspended. Credential and webhook changes remain subject to the canonical service." },
  REVOKED: { label: "Revoked", tone: "danger", description: "This application has been revoked and cannot be treated as operational." },
  ARCHIVED: { label: "Archived", tone: "neutral", description: "This application is archived." },
  REJECTED: { label: "Not approved", tone: "warning", description: "The review workflow did not approve this application." },
};

const credentialStatuses: Readonly<Record<string, DeveloperPresentationStatus>> = {
  ACTIVE: { label: "Active", tone: "success", description: "This credential is active according to the canonical credential service." },
  EXPIRING: { label: "Expiring", tone: "warning", description: "This credential needs an owner security review." },
  EXPIRED: { label: "Expired", tone: "danger", description: "This credential is expired." },
  REVOKED: { label: "Revoked", tone: "neutral", description: "This credential is revoked and remains visible only as safe history." },
  COMPROMISED: { label: "Compromised", tone: "danger", description: "This credential is marked compromised and must not be used." },
};

const webhookStatuses: Readonly<Record<string, DeveloperPresentationStatus>> = {
  DRAFT: { label: "Draft", tone: "neutral", description: "Endpoint configuration is saved but is not verified." },
  VERIFYING: { label: "Verifying", tone: "information", description: "Endpoint verification is pending canonical confirmation." },
  VERIFICATION_FAILED: { label: "Verification failed", tone: "danger", description: "The endpoint is not verified. Review the canonical endpoint configuration." },
  ACTIVE: { label: "Active", tone: "success", description: "The endpoint is verified and active." },
  PAUSED: { label: "Paused", tone: "warning", description: "The endpoint is paused." },
  DISABLED: { label: "Disabled", tone: "danger", description: "The endpoint was disabled by the canonical service." },
  REVOKED: { label: "Revoked", tone: "neutral", description: "The endpoint is revoked." },
};

const deliveryStatuses: Readonly<Record<string, DeveloperPresentationStatus>> = {
  PENDING: { label: "Pending", tone: "information", description: "The delivery is pending canonical processing." },
  CLAIMED: { label: "Claimed", tone: "information", description: "The delivery is being processed by the canonical worker." },
  SENDING: { label: "Sending", tone: "information", description: "The delivery is being sent." },
  SUCCEEDED: { label: "Delivered", tone: "success", description: "A canonical delivery attempt succeeded." },
  FAILED_RETRYABLE: { label: "Retryable failure", tone: "warning", description: "The delivery has a canonical retryable failure." },
  FAILED_PERMANENT: { label: "Permanent failure", tone: "danger", description: "The delivery has a canonical non-retryable failure." },
  ENDPOINT_DISABLED: { label: "Endpoint disabled", tone: "danger", description: "The endpoint is disabled by the canonical service." },
  EXPIRED: { label: "Expired", tone: "neutral", description: "The delivery expired." },
  CANCELLED: { label: "Cancelled", tone: "neutral", description: "The delivery was cancelled." },
};

const fallback = (label: string): DeveloperPresentationStatus => ({
  label: "Status unavailable",
  tone: "neutral",
  description: `The source returned an unrecognised ${label} state. It is not treated as approved, active, or healthy.`,
});

export const getDeveloperApplicationStatus = (status: string): DeveloperPresentationStatus => applicationStatuses[status] ?? fallback("application");
export const getDeveloperCredentialStatus = (status: string): DeveloperPresentationStatus => credentialStatuses[status] ?? fallback("credential");
export const getDeveloperWebhookStatus = (status: string): DeveloperPresentationStatus => webhookStatuses[status] ?? fallback("webhook");
export const getDeveloperDeliveryStatus = (status: string): DeveloperPresentationStatus => deliveryStatuses[status] ?? fallback("delivery");

export function getDeveloperEnvironmentStatus(environment: string, productionLocked: boolean): DeveloperPresentationStatus {
  if (environment === "TEST") return { label: "Test environment", tone: "information", description: "This application is isolated to the test environment." };
  if (environment === "LIVE" && productionLocked) return { label: "Live environment locked", tone: "locked", description: "Live access remains locked by the canonical production-readiness authority." };
  if (environment === "LIVE") return { label: "Live environment", tone: "success", description: "Live environment access is represented by the canonical application authority." };
  return fallback("environment");
}
