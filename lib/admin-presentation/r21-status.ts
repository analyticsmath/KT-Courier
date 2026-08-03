import type { ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";

export type R21StatusPresentation = {
  label: string;
  tone: ProtectedStatusTone;
};

const NORMALISE = (value: string) => value.trim().toUpperCase().replaceAll(/[\s-]+/g, "_");

const STATUS: Record<string, R21StatusPresentation> = {
  ACTIVE: { label: "Active", tone: "success" },
  APPROVED: { label: "Approved", tone: "success" },
  SUCCEEDED: { label: "Succeeded", tone: "success" },
  COMPLETED: { label: "Completed", tone: "success" },
  RESOLVED: { label: "Resolved", tone: "success" },
  RELEASED: { label: "Released", tone: "success" },
  PAID: { label: "Paid", tone: "success" },
  PENDING: { label: "Pending", tone: "warning" },
  PROCESSING: { label: "Processing", tone: "warning" },
  REVIEW: { label: "In review", tone: "warning" },
  OPEN: { label: "Open", tone: "warning" },
  MONITORING: { label: "Monitoring", tone: "warning" },
  HELD: { label: "Held", tone: "warning" },
  RECONCILIATION_REQUIRED: { label: "Reconciliation required", tone: "warning" },
  REQUIRES_ACTION: { label: "Action required", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
  REVERSED: { label: "Reversed", tone: "danger" },
  BLOCKED: { label: "Blocked", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  CLOSED: { label: "Closed", tone: "neutral" },
  DRAFT: { label: "Draft", tone: "neutral" },
  RETIRED: { label: "Retired", tone: "neutral" },
  UNKNOWN: { label: "Unknown — verification required", tone: "neutral" },
  LOCKED: { label: "Production locked", tone: "locked" },
  UNAVAILABLE: { label: "Unavailable", tone: "neutral" },
};

/**
 * R21 status projection never infers a success state from text fragments.
 * A newly introduced canonical value renders as neutral until it is mapped.
 */
export function presentR21Status(value: string | null | undefined): R21StatusPresentation {
  if (!value) return { label: "State unavailable", tone: "neutral" };
  return STATUS[NORMALISE(value)] ?? { label: value.replaceAll("_", " "), tone: "neutral" };
}
