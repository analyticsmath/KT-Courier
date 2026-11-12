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
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
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

  /** A Paystack redirect or webhook may be delayed. Poll only on explicit
   * customer action, from the same authenticated owner-scoped API. The browser
   * never decides success from the return URL or prepares another attempt.
   */
  async function refreshPaymentStatus() {
    if (!payment || checkingStatus || busy) return;
    setCheckingStatus(true);
    setError(null);
    setStatusNotice(null);
    try {
      const response = await fetch(`/api/payments/${encodeURIComponent(payment.publicReference)}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(safeCheckoutError(response.status, "Payment status could not be checked."));
      const latest = payload.payment as CustomerPaymentStatusDto | undefined;
      if (!latest || latest.publicReference !== payment.publicReference
        || latest.orderReference !== orderReference || latest.currency !== "ZAR") {
        throw new Error("The payment status response could not be verified for this delivery.");
      }
      setPayment(latest);
      setStatusNotice(latest.status === "SUCCEEDED"
        ? "Your payment was verified. You can view your delivery in your account."
        : latest.status === "PROCESSING" || latest.status === "PROVIDER_PENDING" || latest.status === "REQUIRES_ACTION"
          ? "Payment is still awaiting confirmed provider processing. No further charge was started."
          : latest.status === "CANCELLED"
            ? "This payment was cancelled. Review the delivery in your account."
            : "Your payment record has been refreshed. Continue only if checkout is available.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment status is temporarily unavailable.");
    } finally {
      setCheckingStatus(false);
    }
  }

  async function startCheckout() {
    if (busy || checkingStatus || !provider.active || terminal) return;
    setBusy(true);
    setError(null);
    setStatusNotice(null);
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
      if (!response.ok) throw new Error(safeCheckoutError(response.status, "Payment checkout is unavailable."));
      if (typeof payload.checkoutUrl !== "string" || !payload.checkoutUrl.trim()) {
        throw new Error("Payment checkout returned an invalid handoff.");
      }
      // Defense in depth: never follow a stored/replayed URL pointing at a
      // different host, an insecure protocol or a URL containing credentials.
      let checkoutUrl: URL;
      try {
        checkoutUrl = new URL(payload.checkoutUrl);
        if (checkoutUrl.protocol !== "https:"
          || !["checkout.paystack.com", "standard.paystack.co"].includes(checkoutUrl.hostname.toLowerCase())
          || checkoutUrl.username || checkoutUrl.password
          || (checkoutUrl.port && checkoutUrl.port !== "443")) {
          throw new Error("Checkout destination is not Paystack HTTPS.");
        }
      } catch {
        throw new Error("Payment checkout returned an invalid handoff URL.");
      }
      operations.current.clear("checkout");
      window.location.assign(checkoutUrl.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment checkout is unavailable.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {provider.environment === "sandbox" && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          Paystack Sandbox — no real money will be transferred
        </p>
      )}
      {provider.environment === "production" && !provider.active && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Payment checkout is unavailable until secure provider confirmation is enabled.
        </p>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-[var(--kt-red)]">{error}</p>}
      {statusNotice && <p role="status" className="rounded-xl bg-[var(--kt-surface-muted)] px-4 py-3 text-sm font-medium text-[var(--kt-brand-navy)]">{statusNotice}</p>}
      {payment?.status === "PROCESSING" && (
        <p role="status" className="rounded-xl border border-[var(--kt-border-strong)] bg-white px-4 py-3 text-sm">
          Your payment is being verified with Paystack. Do not submit another charge.
          Check the latest status below.
        </p>
      )}
      <button
        type="button"
        onClick={startCheckout}
        disabled={busy || checkingStatus || !provider.active || Boolean(terminal)}
        aria-busy={busy}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--kt-brand-blue)] px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Preparing payment…" : terminal ? `Payment ${getCustomerPaymentStatusPresentation(payment!.status).label.toLowerCase()}` : "Pay with Paystack"}
      </button>
      {payment && (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-[var(--kt-text-muted)]" role="status">
            Current payment state: {getCustomerPaymentStatusPresentation(payment.status).label}.
          </p>
          <button type="button" onClick={refreshPaymentStatus}
            disabled={checkingStatus || busy}
            aria-busy={checkingStatus}
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--kt-border-strong)] bg-white px-4 text-sm font-semibold text-[var(--kt-brand-navy)] disabled:opacity-50">
            {checkingStatus ? "Checking payment…" : "Check payment status"}
          </button>
        </div>
      )}
    </div>
  );
}
