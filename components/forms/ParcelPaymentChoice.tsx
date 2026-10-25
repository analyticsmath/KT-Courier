"use client";

import { useId } from "react";

export type ParcelCodAvailability = {
  eligible: boolean;
  amountDueAtDelivery: string;
  reasonCode?: string;
  message?: string;
};
export type ParcelPaymentMethod = "DIGITAL_ONLY" | "FULL_COD";

/** Explicitly show all payment choices; never confuse an ineligible COD policy with a missing feature. */
export function ParcelPaymentChoice({ total, value, onChange, cod, loading = false, error }: {
  total: string;
  value: ParcelPaymentMethod;
  onChange: (method: ParcelPaymentMethod) => void;
  cod?: ParcelCodAvailability | null;
  loading?: boolean;
  error?: string;
}) {
  const legendId = useId();
  const eligible = cod?.eligible === true && !loading && !error;
  const methods = [
    {
      id: "DIGITAL_ONLY" as const,
      label: "Online payment",
      summary: "Pay securely when you book",
      amount: `R ${total}`,
      badge: "Pay now",
      disabled: false,
    },
    {
      id: "FULL_COD" as const,
      label: "Cash on delivery",
      summary: "Pay the assigned driver when your parcel arrives",
      amount: `R ${cod?.amountDueAtDelivery ?? total}`,
      badge: eligible ? "R0 upfront" : "Not available yet",
      disabled: !eligible,
    },
  ];

  return (
    <fieldset className="sm:col-span-2" aria-labelledby={legendId}>
      <legend id={legendId} className="mb-3 text-base font-semibold text-[var(--kt-brand-navy)]">How would you like to pay?</legend>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {methods.map((method) => {
          const selected = value === method.id && !method.disabled;
          return (
            <label
              key={method.id}
              className={`relative flex min-h-44 flex-col justify-between gap-4 rounded-xl border p-5 transition-colors duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--kt-brand-blue)] ${
                method.disabled
                  ? "cursor-not-allowed border-[var(--kt-border-strong)] bg-white/55 text-[var(--kt-text-muted)]"
                  : selected
                    ? "cursor-pointer border-[var(--kt-brand-blue)] bg-white shadow-[0_0_0_1px_var(--kt-brand-blue)]"
                    : "cursor-pointer border-[var(--kt-border-strong)] bg-white hover:border-[var(--kt-brand-blue)]"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="paymentMethod"
                value={method.id}
                checked={selected}
                disabled={method.disabled}
                onChange={() => onChange(method.id)}
              />
              <span className="flex items-start justify-between gap-3">
                <span className="flex items-start gap-3">
                  <span aria-hidden="true" className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[var(--kt-brand-blue)] text-white" : method.disabled ? "bg-[var(--kt-surface-muted)] text-[var(--kt-public-text-muted-on-surface)]" : "bg-[var(--kt-surface-muted)] text-[var(--kt-brand-navy)]"}`}>
                    {method.id === "FULL_COD" ? <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/></svg> : <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h3"/></svg>}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-base font-semibold ${method.disabled ? "text-[var(--kt-public-text-muted-on-surface)]" : "text-[var(--kt-brand-navy)]"}`}>{method.label}</span>
                    <span className="mt-1 block text-sm leading-5 text-[var(--kt-text-soft)]">{method.summary}</span>
                  </span>
                </span>
                <span aria-hidden="true" className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-[var(--kt-brand-blue)]" : "border-[var(--kt-border-strong)]"}`}>
                  {selected && <span className="h-2 w-2 rounded-full bg-[var(--kt-brand-blue)]" />}
                </span>
              </span>
              <span className="flex flex-wrap items-end justify-between gap-2">
                <span className={`text-xl font-semibold tracking-tight ${method.disabled ? "text-[var(--kt-public-text-muted-on-surface)]" : "text-[var(--kt-brand-navy)]"}`}>{method.amount}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${eligible && method.id === "FULL_COD" ? "bg-[#E8F4ED] text-[#21643F]" : "bg-[var(--kt-surface-muted)] text-[var(--kt-text-soft)]"}`}>{method.badge}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--kt-text-soft)]" role="status" aria-live="polite">
        {loading ? "Checking cash availability for this address and service…"
          : error ? `We couldn't check cash availability. ${error} You can still pay online.`
          : eligible && value === "FULL_COD" ? `Nothing is charged online. Pay R ${cod!.amountDueAtDelivery} in cash to your assigned driver at delivery. Your driver will record collection before completing the handover.`
          : eligible ? "Both payment methods are available for this booking. Select cash to pay at delivery."
          : cod?.message ?? "Cash on delivery is not available for this booking right now. Online payment remains available."}
      </p>
    </fieldset>
  );
}
