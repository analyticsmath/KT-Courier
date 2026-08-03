import Link from "next/link";

const inputClass = "h-10 rounded-xl border border-[var(--kt-soft-border)] bg-white px-3 text-sm";

export function PaymentFilters({ values }: { values: Record<string, string | undefined> }) {
  return (
    <form method="get" action="/admin/payments" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Payment filters">
      <div className="space-y-1">
        <label htmlFor="payment-public-reference" className="text-xs font-bold text-[var(--kt-text-muted)]">Payment reference</label>
        <input id="payment-public-reference" name="publicReference" className={inputClass} defaultValue={values.publicReference} maxLength={160} />
      </div>
      <div className="space-y-1">
        <label htmlFor="payment-order-reference" className="text-xs font-bold text-[var(--kt-text-muted)]">Order reference</label>
        <input id="payment-order-reference" name="orderReference" className={inputClass} defaultValue={values.orderReference} maxLength={160} />
      </div>
      <div className="space-y-1">
        <label htmlFor="payment-payer" className="text-xs font-bold text-[var(--kt-text-muted)]">Payer</label>
        <input id="payment-payer" name="payer" className={inputClass} defaultValue={values.payer} maxLength={160} />
      </div>
      <div className="space-y-1">
        <label htmlFor="payment-status" className="text-xs font-bold text-[var(--kt-text-muted)]">Payment status</label>
        <select id="payment-status" name="status" className={inputClass} defaultValue={values.status ?? ""}>
          <option value="">All statuses</option>
          {['CREATED', 'PROVIDER_PENDING', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="payment-provider" className="text-xs font-bold text-[var(--kt-text-muted)]">Payment provider</label>
        <select id="payment-provider" name="provider" className={inputClass} defaultValue={values.provider ?? ""}>
          <option value="">All providers</option>
          <option value="PAYFAST">PAYFAST</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="payment-date-from" className="text-xs font-bold text-[var(--kt-text-muted)]">Created from</label>
        <input id="payment-date-from" name="from" type="datetime-local" className={inputClass} defaultValue={values.from} />
      </div>
      <div className="space-y-1">
        <label htmlFor="payment-date-to" className="text-xs font-bold text-[var(--kt-text-muted)]">Created to</label>
        <input id="payment-date-to" name="to" type="datetime-local" className={inputClass} defaultValue={values.to} />
      </div>
      <div className="space-y-1">
        <label htmlFor="payment-minimum-amount" className="text-xs font-bold text-[var(--kt-text-muted)]">Minimum amount</label>
        <input id="payment-minimum-amount" name="minimumAmount" inputMode="decimal" className={inputClass} defaultValue={values.minimumAmount} placeholder="0.01" />
      </div>
      <div className="space-y-1">
        <label htmlFor="payment-maximum-amount" className="text-xs font-bold text-[var(--kt-text-muted)]">Maximum amount</label>
        <input id="payment-maximum-amount" name="maximumAmount" inputMode="decimal" className={inputClass} defaultValue={values.maximumAmount} placeholder="1000.00" />
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" className="h-10 rounded-xl bg-[var(--kt-ink-navy)] px-4 text-sm font-bold text-white">Apply filters</button>
        <Link href="/admin/payments" className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-[var(--kt-signal-cobalt)]">Clear</Link>
      </div>
    </form>
  );
}
