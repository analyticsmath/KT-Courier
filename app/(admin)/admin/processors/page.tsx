import { ProcessorOperationsManager } from "@/components/admin/ProcessorOperationsManager";
import { OperationalPanel, ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getProcessorInventory } from "@/lib/processors/processor-service";
import { getPaymentObservabilitySnapshot } from "@/lib/services/payment-observability.service";

export const dynamic = "force-dynamic";

export default async function ProcessorsPage() {
  await requireAdminPagePermission(PERMISSIONS.PROCESSORS_READ);
  const [inventory, paymentMetrics] = await Promise.all([
    getProcessorInventory().catch(() => []),
    getPaymentObservabilitySnapshot().catch(() => null),
  ]);

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Operations"
        title="Processor operations"
        description="Review processor health, lease ownership and run history. Configure controlled dry-runs and authorized executions."
      />

      {paymentMetrics ? (
        <OperationalPanel
          title="Payment, webhook & 24h expiry backlog"
          description="Live source-backed counters for Paystack webhooks, unresolved attempts, open reconciliation cases, and overdue unpaid bookings."
        >
          <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
            <div><dt className="text-xs text-[var(--kt-text-muted)]">Pending webhooks</dt><dd className="text-lg font-bold">{paymentMetrics.pendingPaystackWebhooks}</dd></div>
            <div><dt className="text-xs text-[var(--kt-text-muted)]">Failed webhooks</dt><dd className="text-lg font-bold">{paymentMetrics.failedPaystackWebhooks}</dd></div>
            <div><dt className="text-xs text-[var(--kt-text-muted)]">Oldest webhook age</dt><dd className="text-lg font-bold">{paymentMetrics.oldestPendingWebhookAgeSeconds === null ? "—" : `${paymentMetrics.oldestPendingWebhookAgeSeconds}s`}</dd></div>
            <div><dt className="text-xs text-[var(--kt-text-muted)]">Unresolved attempts</dt><dd className="text-lg font-bold">{paymentMetrics.unresolvedPaystackAttempts}</dd></div>
            <div><dt className="text-xs text-[var(--kt-text-muted)]">Open recon cases</dt><dd className="text-lg font-bold">{paymentMetrics.openPaymentReconciliationCases}</dd></div>
            <div><dt className="text-xs text-[var(--kt-text-muted)]">Overdue unpaid / open</dt><dd className="text-lg font-bold">{paymentMetrics.pendingParcelOrdersOverdue} / {paymentMetrics.pendingParcelOrdersWithinWindow}</dd></div>
          </dl>
        </OperationalPanel>
      ) : null}

      <ProcessorOperationsManager processors={inventory} />
    </ProtectedPageFrame>
  );
}
