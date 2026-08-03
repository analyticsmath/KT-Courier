import type { ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";

export type CommerceStatusPresentation = Readonly<{
  label: string;
  tone: ProtectedStatusTone;
}>;

const FALLBACK: CommerceStatusPresentation = {
  label: "Status unavailable",
  tone: "neutral",
};

const STATUS_PRESENTATIONS: Readonly<Record<string, CommerceStatusPresentation>> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  NOT_SUBMITTED: { label: "Not submitted", tone: "neutral" },
  SUBMITTED: { label: "Submitted", tone: "information" },
  OPEN: { label: "Open", tone: "warning" },
  UNDER_REVIEW: { label: "Under review", tone: "warning" },
  NEEDS_CHANGES: { label: "Changes requested", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  ACTIVE: { label: "Active", tone: "success" },
  READY: { label: "Ready", tone: "success" },
  RESOLVED: { label: "Resolved", tone: "success" },
  OBSERVED: { label: "Observed", tone: "information" },
  PENDING_UPLOAD: { label: "Awaiting upload", tone: "neutral" },
  UPLOADED: { label: "Uploaded", tone: "information" },
  VALIDATING: { label: "Validating", tone: "information" },
  QUARANTINED: { label: "Quarantined", tone: "warning" },
  REJECTED: { label: "Rejected", tone: "danger" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
  BLOCKED: { label: "Blocked", tone: "locked" },
  RETIRED: { label: "Retired", tone: "neutral" },
  PAUSED: { label: "Paused", tone: "warning" },
  OUT_OF_STOCK: { label: "Out of stock", tone: "warning" },
  CONFIRMED_DISTINCT: { label: "Confirmed distinct", tone: "success" },
  SOURCE_REJECTED: { label: "Source rejected", tone: "danger" },
  LINKED_TO_EXISTING: { label: "Linked to existing", tone: "success" },
  MERGE_REVIEW_REQUESTED: { label: "Merge review requested", tone: "information" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

/** Explicit source-state mapping. Unknown states stay neutral and are not inferred. */
export function presentCommerceStatus(status: string | null | undefined): CommerceStatusPresentation {
  return status ? STATUS_PRESENTATIONS[status] ?? FALLBACK : FALLBACK;
}

export const COMMERCE_STATUS_VALUES = Object.freeze(Object.keys(STATUS_PRESENTATIONS));
