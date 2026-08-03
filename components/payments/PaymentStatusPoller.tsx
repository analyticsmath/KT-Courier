"use client";

import { useEffect, useState } from "react";
import type { CustomerPaymentStatusDto } from "@/lib/dto/payment.dto";
import { getCustomerPaymentStatusPresentation } from "@/lib/payment-presentation/payment-status";

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"]);

export function PaymentStatusPoller({ initialPayment }: { initialPayment: CustomerPaymentStatusDto }) {
  const [payment, setPayment] = useState(initialPayment);

  useEffect(() => {
    if (TERMINAL.has(payment.status)) return;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      if (attempts > 24) return window.clearInterval(timer);
      try {
        const response = await fetch(`/api/payments/${encodeURIComponent(payment.publicReference)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const payload = await response.json() as { payment?: CustomerPaymentStatusDto };
        if (!payload.payment) return;
        setPayment(payload.payment);
        if (TERMINAL.has(payload.payment.status)) window.clearInterval(timer);
      } catch {
        // A later interval may recover; no provider or financial conclusion is inferred.
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [payment.publicReference, payment.status]);

  return <p role="status" aria-live="polite" className="text-sm text-[var(--kt-text-muted)]">Current payment state: <strong>{getCustomerPaymentStatusPresentation(payment.status).label}</strong></p>;
}
