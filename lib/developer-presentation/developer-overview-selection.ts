export type DeveloperOperationalState = Readonly<{
  kind: "restricted" | "blocked" | "review" | "credential" | "delivery" | "attention" | "healthy" | "empty" | "unavailable";
  title: string;
  description: string;
}>;

type OverviewCandidate = Readonly<{
  applicationStatuses: readonly string[];
  hasTermsAcceptance: boolean;
  credentialStatuses: readonly string[];
  deliveryStatuses: readonly string[];
  hasQuotaUsage: boolean;
}>;

/** Presentation precedence only. It never changes application or credential state. */
export function selectDeveloperOperationalState(candidate: OverviewCandidate): DeveloperOperationalState {
  if (!candidate.applicationStatuses.length) return { kind: "empty", title: "No developer applications", description: "Create an application when an owner-scoped server-to-server integration is needed." };
  if (candidate.applicationStatuses.some((status) => !["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "ACTIVE", "SUSPENDED", "REVOKED", "ARCHIVED", "REJECTED"].includes(status))) return { kind: "unavailable", title: "Application state unavailable", description: "An unrecognised application state is not presented as approved, active, or healthy." };
  if (candidate.applicationStatuses.some((status) => status === "SUSPENDED" || status === "REVOKED")) return { kind: "restricted", title: "Application access restricted", description: "A suspended or revoked application takes precedence over other portal activity." };
  if (candidate.applicationStatuses.some((status) => status === "REJECTED")) return { kind: "blocked", title: "Application not approved", description: "Review the application record and use only canonical workflow actions." };
  if (candidate.applicationStatuses.some((status) => status === "SUBMITTED" || status === "UNDER_REVIEW")) return { kind: "review", title: "Application review in progress", description: "Approval, scopes, and production access remain server-authoritative." };
  if (!candidate.hasTermsAcceptance) return { kind: "blocked", title: "Terms acceptance required", description: "Credential issuance remains blocked until the canonical terms workflow records acceptance." };
  if (candidate.applicationStatuses.some((status) => status === "APPROVED" || status === "ACTIVE") && !candidate.credentialStatuses.some((status) => status === "ACTIVE")) return { kind: "credential", title: "No active credential", description: "An approved application has no active credential record." };
  if (candidate.credentialStatuses.some((status) => status === "EXPIRING" || status === "COMPROMISED" || status === "EXPIRED")) return { kind: "credential", title: "Credential security action required", description: "Review the affected credential and use the canonical rotation or revocation action where available." };
  if (candidate.deliveryStatuses.some((status) => status === "FAILED_RETRYABLE" || status === "FAILED_PERMANENT" || status === "ENDPOINT_DISABLED")) return { kind: "delivery", title: "Webhook delivery needs attention", description: "One or more owner-scoped deliveries or endpoints require review." };
  if (candidate.hasQuotaUsage) return { kind: "attention", title: "Integration workspace active", description: "Review canonical quota usage alongside application and webhook records." };
  return { kind: "healthy", title: "Integration workspace ready", description: "No higher-priority owner-scoped issue is visible in the available portal projection." };
}
