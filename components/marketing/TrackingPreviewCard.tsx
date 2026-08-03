import { OrderStatusBadge } from "@/components/ui/Badge";

export function TrackingPreviewCard() {
  return (
    <div className="bg-[var(--kt-surface)] border border-[var(--kt-border)] rounded-2xl shadow-lg p-6 max-w-sm mx-auto lg:mx-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wider">Order</p>
          <p className="font-bold text-[var(--kt-text)] text-lg">KT-1024</p>
        </div>
        <OrderStatusBadge status="IN_PROGRESS" />
      </div>

      {/* Addresses */}
      <div className="space-y-3 mb-5">
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--kt-brand-blue)] flex-shrink-0" />
            <span className="w-px flex-1 bg-[var(--kt-border)]" style={{ minHeight: 20 }} />
          </div>
          <div>
            <p className="text-xs text-[var(--kt-text-muted)] font-medium">Pickup</p>
            <p className="text-sm font-semibold text-[var(--kt-text)]">Green Grocer Store</p>
            <p className="text-xs text-[var(--kt-text-muted)]">Saved local pickup address</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--kt-green)] flex-shrink-0" />
          </div>
          <div>
            <p className="text-xs text-[var(--kt-text-muted)] font-medium">Dropoff</p>
            <p className="text-sm font-semibold text-[var(--kt-text)]">Sarah Johnson</p>
            <p className="text-xs text-[var(--kt-text-muted)]">Customer delivery address</p>
          </div>
        </div>
      </div>

      {/* Status note */}
      <div className="bg-[var(--kt-amber-soft)] rounded-xl px-3 py-2.5 mb-5 flex items-center gap-2">
        <svg className="w-4 h-4 text-[var(--kt-copper-flame)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-semibold text-[var(--kt-copper-flame)]">Pickup window requested</span>
      </div>

      {/* Timeline */}
      <div>
        <p className="text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wider mb-3">Progress</p>
        <ol className="space-y-2.5" aria-label="Delivery status timeline">
          {[
            { label: "Order confirmed", done: true },
            { label: "Pickup scheduled", done: true },
            { label: "Picked up", done: true },
            { label: "In transit", done: false, current: true },
            { label: "Delivered", done: false },
          ].map((step) => (
            <li key={step.label} className="flex items-center gap-2.5">
              <span
                className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${
                  step.done
                    ? "bg-[var(--kt-brand-blue)]"
                    : step.current
                    ? "border-2 border-[var(--kt-amber)] bg-[var(--kt-amber-soft)]"
                    : "border-2 border-[var(--kt-border)] bg-white"
                }`}
                aria-hidden="true"
              >
                {step.done && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
              <span
                className={`text-xs font-medium ${
                  step.done || step.current
                    ? "text-[var(--kt-text)]"
                    : "text-[var(--kt-text-muted)]"
                }`}
              >
                {step.label}
              </span>
              {step.current && (
                <span className="ml-auto text-xs text-[var(--kt-copper-flame)] font-semibold">Now</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
