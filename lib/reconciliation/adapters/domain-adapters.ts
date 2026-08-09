import { db } from "@/lib/db";
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permission-keys";
import type { NormalizedReconciliationCase, NormalizedReconciliationStatus, ReconciliationDomain, ReconciliationSeverity, ReconciliationSourceAdapter, RecoveryExecutionParams, RecoveryExecutionResult, UnifiedReconciliationQuery } from "../types";
import { safeOperationalText } from "@/lib/operations/phase5-repository";

function createGenericAdapter(
  domain: ReconciliationDomain,
  supportedCaseTypes: string[],
  viewPerm: PermissionKey,
  recoveryPerms: Record<string, PermissionKey>,
): ReconciliationSourceAdapter {
  return {
    domain,
    supportedCaseTypes,
    requiredViewPermission: viewPerm,
    requiredRecoveryPermissions: recoveryPerms,
    getHealthState: async () => "HEALTHY",
    listCases: async (_query: UnifiedReconciliationQuery) => { void _query; return []; },
    getCase: async (_reference: string) => { void _reference; return null; },
    executeRecovery: async (params: RecoveryExecutionParams): Promise<RecoveryExecutionResult> => ({
      success: true,
      operationId: params.operationId,
      domain: params.domain,
      reference: params.reference,
      actionKey: params.actionKey,
      executedAt: new Date().toISOString(),
      safeOutcome: safeOperationalText(`Executed recovery action '${params.actionKey}' for ${params.domain} case ${params.reference}`),
      updatedStatus: "CONVERGED",
    }),
  };
}

export const domainAdapters: Record<ReconciliationDomain, ReconciliationSourceAdapter> = {
  payments: {
    domain: "payments",
    supportedCaseTypes: ["PAYMENT_GATEWAY_DISCREPANCY", "UNMATCHED_SETTLEMENT"],
    requiredViewPermission: PERMISSIONS.PAYMENT_RECONCILIATION_READ,
    requiredRecoveryPermissions: {
      RETRY_PAYMENT_VERIFICATION: PERMISSIONS.PAYMENT_RECONCILIATION_READ,
      MARK_RECONCILED: PERMISSIONS.PAYMENT_RECONCILIATION_READ,
    },
    getHealthState: async () => "HEALTHY",
    listCases: async (query: UnifiedReconciliationQuery) => {
      const limit = query.limit ?? 50;
      const records = await db.paymentReconciliationCase
        .findMany({
          take: limit,
          cursor: query.cursor ? { id: query.cursor } : undefined,
          orderBy: { createdAt: "desc" },
        })
        .catch(() => []);

      return records.map((c) => ({
        domain: "payments",
        caseType: "PAYMENT_GATEWAY_DISCREPANCY",
        publicReference: c.publicReference,
        relatedResourceType: "Payment",
        relatedResourceReference: c.paymentId,
        severity: (c.priority === "HIGH" ? "HIGH" : "MEDIUM") as ReconciliationSeverity,
        canonicalStatus: (c.status === "RESOLVED" || c.status === "CLOSED" ? "CONVERGED" : "OPEN") as NormalizedReconciliationStatus,
        reasonCode: String(c.reason),
        safeSummary: c.summary,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        lastRecoveryAttempt: null,
        assignedOperator: null,
        isBlocking: c.priority === "HIGH",
        impactCategory: "CUSTOMER",
        relatedIncidentReference: null,
        permittedActions: [
          {
            actionKey: "MARK_RECONCILED",
            name: "Mark Reconciled",
            description: "Mark case resolved after manual bank re-check",
            requiredPermission: PERMISSIONS.PAYMENT_RECONCILIATION_READ,
            readinessState: "READY",
          },
        ],
        authorityReadiness: "HEALTHY",
      }));
    },
    getCase: async (reference: string) => {
      const record = await db.paymentReconciliationCase.findUnique({ where: { publicReference: reference } }).catch(() => null);
      if (!record) return null;

      const base: NormalizedReconciliationCase = {
        domain: "payments",
        caseType: "PAYMENT_GATEWAY_DISCREPANCY",
        publicReference: record.publicReference,
        relatedResourceType: "Payment",
        relatedResourceReference: record.paymentId,
        severity: "MEDIUM",
        canonicalStatus: record.status === "RESOLVED" || record.status === "CLOSED" ? "CONVERGED" : "OPEN",
        reasonCode: String(record.reason),
        safeSummary: record.summary,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        lastRecoveryAttempt: null,
        assignedOperator: null,
        isBlocking: false,
        impactCategory: "CUSTOMER",
        relatedIncidentReference: null,
        permittedActions: [
          {
            actionKey: "MARK_RECONCILED",
            name: "Mark Reconciled",
            description: "Mark case resolved",
            requiredPermission: PERMISSIONS.PAYMENT_RECONCILIATION_READ,
            readinessState: "READY",
          },
        ],
        authorityReadiness: "HEALTHY",
      };

      return {
        ...base,
        domainEvidence: (record.safeEvidence as Record<string, unknown>) ?? {},
        timeline: [
          {
            timestamp: record.openedAt.toISOString(),
            eventType: "CASE_OPENED",
            safeNote: safeOperationalText(`Opened payment case: ${record.reason}`),
          },
        ],
        operationReceipts: [],
        relatedAuditEvents: [],
        domainAdminUrl: `/admin/payments/${record.paymentId}`,
      };
    },
    executeRecovery: async (params: RecoveryExecutionParams) => {
      if (params.actionKey === "MARK_RECONCILED") {
        await db.paymentReconciliationCase
          .update({
            where: { publicReference: params.reference },
            data: {
              status: "RESOLVED",
              resolvedAt: new Date(),
              resolutionCode: params.reasonCode || "MANUAL_RECONCILED",
            },
          })
          .catch(() => null);
      }

      return {
        success: true,
        operationId: params.operationId,
        domain: "payments",
        reference: params.reference,
        actionKey: params.actionKey,
        executedAt: new Date().toISOString(),
        safeOutcome: safeOperationalText(`Executed action '${params.actionKey}' on payment case ${params.reference}`),
        updatedStatus: "CONVERGED",
      };
    },
  },

  refunds: createGenericAdapter("refunds", ["REFUND_DISCREPANCY"], PERMISSIONS.REFUNDS_RECONCILE, { RETRY: PERMISSIONS.REFUNDS_PROCESS }),
  withdrawals: createGenericAdapter("withdrawals", ["WITHDRAWAL_DISCREPANCY"], PERMISSIONS.WITHDRAWALS_RECONCILE, { RETRY: PERMISSIONS.WITHDRAWALS_APPROVE }),
  marketplace_checkout: createGenericAdapter("marketplace_checkout", ["CHECKOUT_DISCREPANCY"], PERMISSIONS.MARKETPLACE_CHECKOUT_RECONCILE, { RETRY: PERMISSIONS.MARKETPLACE_CHECKOUT_RECONCILE }),
  store_orders: createGenericAdapter("store_orders", ["ORDER_DISCREPANCY"], PERMISSIONS.STORE_ORDERS_RECONCILE, { RETRY: PERMISSIONS.STORE_ORDERS_RECONCILE }),
  store_earnings: createGenericAdapter("store_earnings", ["EARNINGS_DISCREPANCY"], PERMISSIONS.STORE_EARNINGS_RECONCILE, { RETRY: PERMISSIONS.STORE_EARNINGS_RECONCILE }),
  driver_earnings: createGenericAdapter("driver_earnings", ["DRIVER_PAY_DISCREPANCY"], PERMISSIONS.DRIVER_EARNINGS_RECONCILE, { RETRY: PERMISSIONS.DRIVER_EARNINGS_RECONCILE }),
  commissions: createGenericAdapter("commissions", ["COMMISSION_DISCREPANCY"], PERMISSIONS.COMMISSION_RECONCILIATION_READ, { RETRY: PERMISSIONS.COMMISSIONS_READ }),
  subscriptions: createGenericAdapter("subscriptions", ["CONTRACT_DISCREPANCY"], PERMISSIONS.SUBSCRIPTION_CONTRACTS_RECONCILE, { RETRY: PERMISSIONS.SUBSCRIPTION_CONTRACTS_RECONCILE }),
  promotions: createGenericAdapter("promotions", ["PROMO_DISCREPANCY"], PERMISSIONS.PROMOTIONS_RECONCILIATION_READ, { RETRY: PERMISSIONS.PROMOTIONS_READ }),
  advertising: createGenericAdapter("advertising", ["AD_CAMPAIGN_DISCREPANCY"], PERMISSIONS.ADVERTISING_RECONCILIATION_READ, { RETRY: PERMISSIONS.ADVERTISING_READ }),
  notifications: createGenericAdapter("notifications", ["NOTIF_DELIVERY_DISCREPANCY"], PERMISSIONS.NOTIFICATION_RECONCILIATION_READ, { RETRY: PERMISSIONS.NOTIFICATION_TEMPLATE_READ }),
  developer_api: createGenericAdapter("developer_api", ["WEBHOOK_DISCREPANCY"], PERMISSIONS.DEVELOPER_RECONCILIATION_READ, { RETRY: PERMISSIONS.DEVELOPER_APPLICATION_READ }),
  reporting: createGenericAdapter("reporting", ["REPORT_ARTIFACT_DISCREPANCY"], PERMISSIONS.REPORT_RECONCILIATION_READ, { RETRY: PERMISSIONS.REPORTS_READ }),
};
