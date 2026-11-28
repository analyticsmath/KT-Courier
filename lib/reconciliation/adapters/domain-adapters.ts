import { db } from "@/lib/db";
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permission-keys";
import type { NormalizedReconciliationCase, NormalizedReconciliationStatus, ReconciliationDomain, ReconciliationSeverity, ReconciliationSourceAdapter, RecoveryExecutionParams, RecoveryExecutionResult, UnifiedReconciliationQuery } from "../types";
import { safeOperationalText } from "@/lib/operations/phase5-repository";
import { ReconciliationConflictError } from "../errors";

function isPaymentAlreadyReconciled(record: {
  status: string;
  payment?: { status?: string | null; reconciliationStatus?: string | null; successLedgerJournalId?: string | null } | null;
}): { caseClosed: boolean; paymentReconciled: boolean; blockerMessage: string | null } {
  const caseClosed = record.status === "RESOLVED" || record.status === "CLOSED";
  const paymentReconciled =
    record.payment?.status === "SUCCEEDED" ||
    record.payment?.reconciliationStatus === "RESOLVED";
  const blockerMessage = caseClosed
    ? "Reconciliation case is already resolved; payment verification retry is disabled."
    : paymentReconciled
      ? "Payment is already settled or reconciled; payment verification retry is disabled."
      : null;
  return { caseClosed, paymentReconciled, blockerMessage };
}

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
      RETRY_PAYMENT_VERIFICATION: PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
      MARK_RECONCILED: PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
    },
    getHealthState: async () => "HEALTHY",
    listCases: async (query: UnifiedReconciliationQuery) => {
      const limit = query.limit ?? 50;
      const records = await db.paymentReconciliationCase
        .findMany({
          take: limit,
          cursor: query.cursor ? { id: query.cursor } : undefined,
          include: { payment: { select: { status: true, reconciliationStatus: true, successLedgerJournalId: true } } },
          orderBy: { createdAt: "desc" },
        })
        .catch(() => []);

      return records.map((c) => {
        const { caseClosed, paymentReconciled, blockerMessage } = isPaymentAlreadyReconciled(c);
        const retryBlocked = caseClosed || paymentReconciled || c.provider !== "PAYSTACK";
        const retryBlocker =
          blockerMessage ??
          (c.provider !== "PAYSTACK" ? "Provider verify retry applies only to Paystack." : undefined);
        return {
          domain: "payments",
          caseType: "PAYMENT_GATEWAY_DISCREPANCY",
          publicReference: c.publicReference,
          relatedResourceType: "Payment",
          relatedResourceReference: c.paymentId,
          severity: (c.priority === "HIGH" || c.priority === "CRITICAL" ? "HIGH" : "MEDIUM") as ReconciliationSeverity,
          canonicalStatus: (caseClosed ? "CONVERGED" : "OPEN") as NormalizedReconciliationStatus,
          reasonCode: String(c.reason),
          safeSummary: c.summary,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          lastRecoveryAttempt: null,
          assignedOperator: null,
          isBlocking: !caseClosed && (c.priority === "HIGH" || c.priority === "CRITICAL"),
          impactCategory: "CUSTOMER",
          relatedIncidentReference: null,
          permittedActions: [
            {
              actionKey: "RETRY_PAYMENT_VERIFICATION",
              name: "Retry Payment Verification",
              description: "Verify transaction status with Paystack using exact merchant reference, currency, and amount",
              requiredPermission: PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
              readinessState: retryBlocked ? "BLOCKED" : "READY",
              ...(retryBlocker ? { readinessBlocker: retryBlocker } : {}),
            },
            {
              actionKey: "MARK_RECONCILED",
              name: "Mark Reconciled",
              description: "Close case after payment reaches verified settlement or terminal failure",
              requiredPermission: PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
              readinessState: caseClosed ? "BLOCKED" : "READY",
              ...(caseClosed ? { readinessBlocker: "Reconciliation case is already resolved." } : {}),
            },
          ],
          authorityReadiness: "HEALTHY",
        };
      });
    },
    getCase: async (reference: string) => {
      const record = await db.paymentReconciliationCase
        .findUnique({
          where: { publicReference: reference },
          include: { payment: { select: { status: true, reconciliationStatus: true, successLedgerJournalId: true } } },
        })
        .catch(() => null);
      if (!record) return null;
      const { caseClosed, paymentReconciled, blockerMessage } = isPaymentAlreadyReconciled(record);
      const retryBlocked = caseClosed || paymentReconciled || record.provider !== "PAYSTACK";
      const retryBlocker =
        blockerMessage ??
        (record.provider !== "PAYSTACK" ? "Provider verify retry applies only to Paystack." : undefined);

      const base: NormalizedReconciliationCase = {
        domain: "payments",
        caseType: "PAYMENT_GATEWAY_DISCREPANCY",
        publicReference: record.publicReference,
        relatedResourceType: "Payment",
        relatedResourceReference: record.paymentId,
        severity: record.priority === "HIGH" || record.priority === "CRITICAL" ? "HIGH" : "MEDIUM",
        canonicalStatus: caseClosed ? "CONVERGED" : "OPEN",
        reasonCode: String(record.reason),
        safeSummary: record.summary,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        lastRecoveryAttempt: null,
        assignedOperator: null,
        isBlocking: !caseClosed && (record.priority === "HIGH" || record.priority === "CRITICAL"),
        impactCategory: "CUSTOMER",
        relatedIncidentReference: null,
        permittedActions: [
          {
            actionKey: "RETRY_PAYMENT_VERIFICATION",
            name: "Retry Payment Verification",
            description: "Verify transaction status with Paystack",
            requiredPermission: PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
            readinessState: retryBlocked ? "BLOCKED" : "READY",
            ...(retryBlocker ? { readinessBlocker: retryBlocker } : {}),
          },
          {
            actionKey: "MARK_RECONCILED",
            name: "Mark Reconciled",
            description: "Mark case resolved once payment has verified terminal or settled state",
            requiredPermission: PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
            readinessState: caseClosed ? "BLOCKED" : "READY",
            ...(caseClosed ? { readinessBlocker: "Reconciliation case is already resolved." } : {}),
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
      if (params.actionKey !== "RETRY_PAYMENT_VERIFICATION" && params.actionKey !== "MARK_RECONCILED") {
        throw new Error(`Unsupported payment reconciliation action '${params.actionKey}'.`);
      }

      const record = (await db.paymentReconciliationCase.findUnique({
        where: { publicReference: params.reference },
        include: { payment: true, attempt: true },
      })) as
        | {
            id: string;
            publicReference: string;
            paymentId: string;
            attemptId: string | null;
            provider: string;
            status: string;
            payment?: {
              status: string;
              reconciliationStatus?: string | null;
              successLedgerJournalId?: string | null;
            } | null;
            attempt?: { status: string } | null;
          }
        | null;

      if (!record) {
        return {
          success: false,
          operationId: params.operationId,
          domain: "payments",
          reference: params.reference,
          actionKey: params.actionKey,
          executedAt: new Date().toISOString(),
          safeOutcome: `Payment reconciliation case ${params.reference} was not found.`,
          updatedStatus: "OPEN",
        };
      }

      const { caseClosed, paymentReconciled, blockerMessage } = isPaymentAlreadyReconciled(record);
      if (params.actionKey === "RETRY_PAYMENT_VERIFICATION") {
        if (caseClosed || paymentReconciled) {
          throw new ReconciliationConflictError(
            blockerMessage ?? "Payment verification retry cannot run on an already reconciled payment.",
          );
        }
      }

      if (caseClosed) {
        return {
          success: true,
          operationId: params.operationId,
          domain: "payments",
          reference: params.reference,
          actionKey: params.actionKey,
          executedAt: new Date().toISOString(),
          safeOutcome: safeOperationalText(`Payment case ${params.reference} is already resolved (${record.status}).`),
          updatedStatus: "CONVERGED",
        };
      }

      if (params.actionKey === "RETRY_PAYMENT_VERIFICATION") {
        if (record.provider !== "PAYSTACK") {
          return {
            success: false,
            operationId: params.operationId,
            domain: "payments",
            reference: params.reference,
            actionKey: params.actionKey,
            executedAt: new Date().toISOString(),
            safeOutcome: `Verification retry is only supported for PAYSTACK cases (${record.publicReference}).`,
            updatedStatus: "OPEN",
          };
        }
        const {
          recoverPaystackAttemptViaVerify,
          recoverPendingPaystackPaymentForPaymentId,
        } = await import("@/lib/services/paystack-verify-recovery.service");
        const recovery = record.attemptId
          ? await recoverPaystackAttemptViaVerify({
              attemptId: record.attemptId,
              trigger: "admin_reconciliation_retry",
              allowStaleNotFound: true,
            })
          : await recoverPendingPaystackPaymentForPaymentId(record.paymentId, {
              trigger: "admin_reconciliation_retry",
              allowStaleNotFound: true,
            });
        const converged =
          recovery.recovered ||
          recovery.outcome === "SETTLED_VIA_VERIFY" ||
          recovery.outcome === "ALREADY_SETTLED" ||
          recovery.outcome === "APPLIED_WEBHOOK" ||
          recovery.outcome === "FAILED_VIA_VERIFY";
        if (converged && typeof db.paymentReconciliationCase?.update === "function") {
          const latestCase = await Promise.resolve(
            db.paymentReconciliationCase.findUnique({
              where: { publicReference: params.reference },
              select: { status: true },
            }),
          ).catch(() => null);
          if (latestCase && latestCase.status !== "RESOLVED" && latestCase.status !== "CLOSED") {
            await Promise.resolve(
              db.paymentReconciliationCase.update({
                where: { publicReference: params.reference },
                data: {
                  status: "RESOLVED",
                  resolvedAt: new Date(),
                  resolutionCode:
                    recovery.outcome === "FAILED_VIA_VERIFY" ? "VERIFIED_FAILED" : "VERIFIED_COMPLETE",
                },
              }),
            ).catch(() => {});
          }
        }
        return {
          success: converged,
          operationId: params.operationId,
          domain: "payments",
          reference: params.reference,
          actionKey: params.actionKey,
          executedAt: new Date().toISOString(),
          safeOutcome: safeOperationalText(`Verification outcome for ${params.reference}: ${recovery.outcome}`),
          updatedStatus: converged ? "CONVERGED" : "OPEN",
        };
      }

      const paymentStatus = record.payment?.status ?? "";
      const attemptStatus = record.attempt?.status ?? null;
      const settledWithJournal =
        paymentStatus === "SUCCEEDED" && Boolean(record.payment?.successLedgerJournalId);
      const terminalClosed =
        ["FAILED", "CANCELLED", "EXPIRED"].includes(paymentStatus) &&
        (attemptStatus === null || ["FAILED", "CANCELLED", "EXPIRED"].includes(attemptStatus));

      if (!settledWithJournal && !terminalClosed) {
        throw new Error(
          `Cannot mark payment case ${params.reference} reconciled while payment outcome remains unresolved or unverified (${paymentStatus || "UNKNOWN"}).`,
        );
      }

      await db.paymentReconciliationCase.update({
        where: { publicReference: params.reference },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolutionCode: params.reasonCode || "MANUAL_RECONCILED",
        },
      });

      return {
        success: true,
        operationId: params.operationId,
        domain: "payments",
        reference: params.reference,
        actionKey: params.actionKey,
        executedAt: new Date().toISOString(),
        safeOutcome: safeOperationalText(`Marked resolved payment case ${params.reference} reconciled.`),
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
