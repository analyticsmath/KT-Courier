import type { PermissionKey } from "@/lib/auth/permission-keys";

export type ReconciliationDomain =
  | "payments"
  | "marketplace_checkout"
  | "store_orders"
  | "refunds"
  | "withdrawals"
  | "store_earnings"
  | "driver_earnings"
  | "commissions"
  | "subscriptions"
  | "promotions"
  | "advertising"
  | "notifications"
  | "developer_api"
  | "reporting";

export type ReconciliationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type NormalizedReconciliationStatus = "OPEN" | "IN_PROGRESS" | "CONVERGED" | "RESOLVED" | "FAILED";

export interface PermittedRecoveryAction {
  actionKey: string;
  name: string;
  description: string;
  requiredPermission: PermissionKey;
  readinessState: "READY" | "BLOCKED";
  readinessBlocker?: string;
}

export interface NormalizedReconciliationCase {
  domain: ReconciliationDomain;
  caseType: string;
  publicReference: string;
  relatedResourceType: string;
  relatedResourceReference: string;
  severity: ReconciliationSeverity;
  canonicalStatus: NormalizedReconciliationStatus;
  reasonCode: string;
  safeSummary: string;
  createdAt: string;
  updatedAt: string;
  lastRecoveryAttempt: string | null;
  assignedOperator: string | null;
  isBlocking: boolean;
  impactCategory: "CUSTOMER" | "STORE" | "DRIVER" | "PROMOTER" | "SYSTEM" | "DEVELOPER";
  relatedIncidentReference: string | null;
  permittedActions: PermittedRecoveryAction[];
  authorityReadiness: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
}

export interface NormalizedCaseDetail extends NormalizedReconciliationCase {
  domainEvidence: Record<string, unknown>;
  timeline: Array<{ timestamp: string; eventType: string; safeNote: string; actorId?: string }>;
  operationReceipts: Array<{ operationId: string; timestamp: string; status: string; safeSummary: string }>;
  relatedAuditEvents: Array<{ timestamp: string; eventType: string; safeEvidence?: Record<string, unknown> }>;
  domainAdminUrl: string;
}

export interface UnifiedReconciliationQuery {
  domain?: ReconciliationDomain;
  severity?: ReconciliationSeverity;
  status?: NormalizedReconciliationStatus;
  reasonCode?: string;
  isBlocking?: boolean;
  searchReference?: string;
  cursor?: string;
  limit?: number;
}

export interface RecoveryExecutionParams {
  domain: ReconciliationDomain;
  reference: string;
  actionKey: string;
  actorUserId: string;
  operationId: string;
  reasonCode: string;
  note?: string;
}

export interface RecoveryExecutionResult {
  success: boolean;
  operationId: string;
  domain: ReconciliationDomain;
  reference: string;
  actionKey: string;
  executedAt: string;
  safeOutcome: string;
  updatedStatus: NormalizedReconciliationStatus;
}

export interface ReconciliationSourceAdapter {
  readonly domain: ReconciliationDomain;
  readonly supportedCaseTypes: readonly string[];
  readonly requiredViewPermission: PermissionKey;
  readonly requiredRecoveryPermissions: Record<string, PermissionKey>;
  getHealthState(): Promise<"HEALTHY" | "DEGRADED" | "UNAVAILABLE">;
  listCases(query: UnifiedReconciliationQuery): Promise<NormalizedReconciliationCase[]>;
  getCase(reference: string): Promise<NormalizedCaseDetail | null>;
  executeRecovery(params: RecoveryExecutionParams): Promise<RecoveryExecutionResult>;
}
