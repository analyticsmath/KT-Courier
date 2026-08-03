"use client";

import { useRef, useState } from "react";
import type { CustomerPaymentStatusDto } from "@/lib/dto/payment.dto";
import { createPaymentOperationIdStore } from "@/lib/payments/client-operation";
import { getCustomerPaymentStatusPresentation } from "@/lib/payment-presentation/payment-status";

type ProviderState = Readonly<{
  active: boolean;
  environment: string;
  blockReason: string | null;
}>;

export function PaymentCheckoutClient({
  orderId,
  orderReference,
  initialPayment,
  provider,
}: {
  orderId: string;
  orderReference: string;
  initialPayment: CustomerPaymentStatusDto | null;
  provider: ProviderState;
}) {
  const operations = useRef(createPaymentOperationIdStore());
  const [payment, setPayment] = useState(initialPayment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terminal = payment && ["SUCCEEDED", "PROCESSING", "CANCELLED"].includes(payment.status);

  async function readJson(response: Response): Promise<Record<string, unknown>> {
    return await response.json() as Record<string, unknown>;
  }

  function safeCheckoutError(status: number, fallback: string) {
    if (status === 409 || status === 412) return "The payment record changed before checkout could continue. Refresh and review its canonical status.";
    if (status === 429) return "Payment checkout is temporarily rate limited. Wait before trying again.";
    if (status >= 500) return "Payment checkout is temporarily unavailable. Try again later.";
    return fallback;
  }

  async function startCheckout() {
    if (busy || !provider.active || terminal) return;
    setBusy(true);
    setError(null);
    try {
      let current = payment;
      if (!current) {
        const operationId = operations.current.get("prepare", `${orderId}:${orderReference}`);
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationId }),
        });
        const payload = await readJson(response);
        if (!response.ok) throw new Error(safeCheckoutError(response.status, "Payment could not be prepared."));
        const prepared = payload.payment as CustomerPaymentStatusDto;
        current = prepared;
        setPayment(prepared);
        operations.current.clear("prepare");
      }
      const operationId = operations.current.get("checkout", current.publicReference);
      const response = await fetch(`/api/payments/${encodeURIComponent(current.publicReference)}/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(safeCheckoutError(response.status, "Payfast checkout is unavailable."));
      if (typeof payload.checkoutUrl !== "string" || !payload.checkoutUrl.startsWith("/payments/payfast/checkout/")) {
        throw new Error("Payfast checkout returned an invalid handoff.");
      }
      operations.current.clear("checkout");
      window.location.assign(payload.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payfast checkout is unavailable.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {provider.environment === "sandbox" && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          Payfast Sandbox — no real money will be transferred
        </p>
      )}
      {provider.environment === "production" && !provider.active && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Payfast production checkout is unavailable until secure provider confirmation is enabled.
        </p>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-[var(--kt-red)]">{error}</p>}
      <button
        type="button"
        onClick={startCheckout}
        disabled={busy || !provider.active || Boolean(terminal)}
        aria-busy={busy}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--kt-brand-blue)] px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Preparing Payfast…" : terminal ? "Payment unavailable" : "Pay with Payfast"}
      </button>
      {payment ? <p className="text-sm text-[var(--kt-text-muted)]" role="status">Current payment state: {getCustomerPaymentStatusPresentation(payment.status).label}.</p> : null}
    </div>
  );
}
