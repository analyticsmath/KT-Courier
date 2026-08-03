import Link from "next/link";
import type {
  PaymentAttemptDto,
  PaymentHistoryDto,
  PaymentSummaryDto,
} from "@/lib/dto/payment.dto";
import type { PaymentProviderReadinessDto } from "@/lib/payments/providers/payment-provider-registry";
import { formatZarLedgerAmount } from "@/lib/ledger/format";

const cell = "px-4 py-3 text-left text-sm align-top";
const head = `${cell} text-xs font-black uppercase tracking-wide text-[var(--kt-text-muted)]`;
const statusLabel = (status: string) => status.replaceAll("_", " ");
const timeLabel = (value: string | null) => value ? new Date(value).toLocaleString("en-ZA") : "—";

export function PaymentsTable({ payments }: { payments: readonly PaymentSummaryDto[] }) {
  return <div className="overflow-x-auto rounded-xl border border-[var(--kt-soft-border)]">
    <table className="min-w-full divide-y divide-[var(--kt-soft-border)]" aria-label="Payments">
      <thead><tr><th className={head}>Payment reference</th><th className={head}>Order reference</th><th className={head}>Payer</th><th className={head}>Status</th><th className={head}>Provider</th><th className={head}>Amount</th><th className={head}>Created</th></tr></thead>
      <tbody className="divide-y divide-[var(--kt-soft-border)]">
        {payments.length === 0 ? <tr><td className={`${cell} text-center text-[var(--kt-text-muted)]`} colSpan={7}>No payments match these filters.</td></tr> : payments.map((payment) => <tr key={payment.id}>
          <td className={cell}><Link href={`/admin/payments/${payment.id}`} className="font-mono font-bold text-[var(--kt-signal-cobalt)]">{payment.publicReference}</Link></td>
          <td className={cell}>{payment.order.reference}</td>
          <td className={cell}>{payment.payer.label}</td>
          <td className={cell}>{statusLabel(payment.status)}</td>
          <td className={cell}>{payment.provider ?? "Not selected"}</td>
          <td className={`${cell} font-mono`}>{formatZarLedgerAmount(payment.amount)} {payment.currency}</td>
          <td className={cell}>{timeLabel(payment.createdAt)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

export function PaymentAttemptsTable({ attempts }: { attempts: readonly PaymentAttemptDto[] }) {
  return <div className="overflow-x-auto rounded-xl border border-[var(--kt-soft-border)]">
    <table className="min-w-full divide-y divide-[var(--kt-soft-border)]" aria-label="Payment attempts">
      <thead><tr><th className={head}>Attempt</th><th className={head}>Public reference</th><th className={head}>Status</th><th className={head}>Provider</th><th className={head}>Environment / action</th><th className={head}>Merchant reference</th><th className={head}>Provider reference</th><th className={head}>Failure category</th><th className={head}>Created</th></tr></thead>
      <tbody className="divide-y divide-[var(--kt-soft-border)]">
        {attempts.length === 0 ? <tr><td className={`${cell} text-center text-[var(--kt-text-muted)]`} colSpan={9}>No provider attempts have been created.</td></tr> : attempts.map((attempt) => <tr key={attempt.id}>
          <td className={cell}>{attempt.attemptNumber}</td><td className={`${cell} font-mono text-xs`}>{attempt.publicReference ?? "—"}</td><td className={cell}>{statusLabel(attempt.status)}</td><td className={cell}>{attempt.provider}</td>
          <td className={cell}>{attempt.providerEnvironment ? `${statusLabel(attempt.providerEnvironment)} / ${attempt.checkoutActionType ? statusLabel(attempt.checkoutActionType) : "Pending"}` : "—"}</td>
          <td className={`${cell} font-mono text-xs`}>{attempt.merchantReference}</td><td className={`${cell} font-mono text-xs`}>{attempt.providerReference ?? "—"}</td>
          <td className={cell}>{attempt.failureCategory ? statusLabel(attempt.failureCategory) : "—"}</td><td className={cell}>{timeLabel(attempt.createdAt)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

export function PaymentHistoryTable({ history }: { history: readonly PaymentHistoryDto[] }) {
  return <div className="overflow-x-auto rounded-xl border border-[var(--kt-soft-border)]">
    <table className="min-w-full divide-y divide-[var(--kt-soft-border)]" aria-label="Payment lifecycle history">
      <thead><tr><th className={head}>Time</th><th className={head}>From</th><th className={head}>To</th><th className={head}>Reason</th><th className={head}>Actor</th></tr></thead>
      <tbody className="divide-y divide-[var(--kt-soft-border)]">
        {history.length === 0 ? <tr><td className={`${cell} text-center text-[var(--kt-text-muted)]`} colSpan={5}>No payment lifecycle history is available.</td></tr> : history.map((entry) => <tr key={entry.id}>
          <td className={cell}>{timeLabel(entry.createdAt)}</td><td className={cell}>{entry.fromStatus ? statusLabel(entry.fromStatus) : "Initial"}</td><td className={cell}>{statusLabel(entry.toStatus)}</td><td className={cell}>{entry.reasonCode ? statusLabel(entry.reasonCode) : "—"}</td><td className={cell}>{entry.actorType}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

export function PaymentProvidersTable({ providers }: { providers: readonly PaymentProviderReadinessDto[] }) {
  return <div className="overflow-x-auto rounded-xl border border-[var(--kt-soft-border)]">
    <table className="min-w-full divide-y divide-[var(--kt-soft-border)]" aria-label="Payment providers">
      <thead><tr><th className={head}>Provider code</th><th className={head}>Readiness</th><th className={head}>Environment</th><th className={head}>Capabilities</th></tr></thead>
      <tbody className="divide-y divide-[var(--kt-soft-border)]">{providers.map((provider) => <tr key={provider.code}>
        <td className={`${cell} font-mono font-bold`}>{provider.code}</td>
        <td className={cell}>{provider.active ? "Active" : provider.configured ? "Configured, inactive" : "Known, not configured"}</td>
        <td className={cell}>{statusLabel(provider.environment)}</td>
        <td className={cell}><ul className="space-y-1">
          <li>Redirect checkout: {provider.capabilities.supportsRedirectCheckout ? "Supported" : "Not supported"}</li>
          <li>Form POST checkout: {provider.capabilities.supportsFormPostCheckout ? "Supported" : "Not supported"}</li>
          <li>Status lookup: {provider.capabilities.supportsStatusLookup ? "Supported" : "Not supported"}</li>
          <li>Idempotent session creation: {provider.capabilities.supportsIdempotentSessionCreation ? "Supported" : "Not supported"}</li>
          <li>Cancellation: {provider.capabilities.supportsCancellation ? "Supported" : "Not supported"}</li>
          <li>Authorization/capture: {provider.capabilities.supportsAuthorizationCapture ? "Supported" : "Not supported"}</li>
          <li>Authoritative webhook confirmation: {provider.capabilities.supportsAuthoritativeWebhookConfirmation ? "Supported" : "Not supported"}</li>
          {provider.blockReason && <li>Block reason: {statusLabel(provider.blockReason)}</li>}
        </ul></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
