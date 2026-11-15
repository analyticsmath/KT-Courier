"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface CancelOrderButtonProps {
  orderId: string;
  redirectTo: string;
  business?: boolean;
  storeContextId?: string | null;
}

interface CancelResolutionState {
  publicReference?: string;
  status?: string;
}

export function CancelOrderButton({
  orderId,
  redirectTo,
  business = false,
  storeContextId = null,
}: CancelOrderButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingResolution, setPendingResolution] =
    useState<CancelResolutionState | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    setPendingResolution(null);

    try {
      const trimmedReason = reason.trim();
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(business ? { "X-KT-Workspace": "STORE" } : {}),
          ...(storeContextId ? { "X-KT-Store-Id": storeContextId } : {}),
        },
        body: JSON.stringify({
          ...(trimmedReason ? { reason: trimmedReason } : {}),
          ...(storeContextId ? { storeContextId } : {}),
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        code?: string;
        resolution?: CancelResolutionState;
      };

      if (res.status === 409 && data.code === "CANCELLATION_PENDING_PAYMENT_RESOLUTION") {
        setPendingResolution(data.resolution ?? { status: "PENDING_PAYMENT_RESOLUTION" });
        setError(
          data.error ??
            "Payment confirmation is currently in progress. Cancellation will settle automatically once the payment result completes.",
        );
        setConfirming(false);
        return;
      }

      if (!res.ok || data.error) {
        setError(
          data.error ??
            "Could not cancel this order. Please try again or contact support.",
        );
        setConfirming(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError(
        "An unexpected error occurred. Please contact KT Couriers for assistance.",
      );
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  const pendingBanner = pendingResolution ? (
    <div
      role="status"
      data-testid="cancellation-pending-payment-banner"
      className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p className="font-medium">Cancellation awaiting payment confirmation</p>
      <p className="mt-1">{error}</p>
      {pendingResolution.publicReference && (
        <p className="mt-1 text-xs font-mono">
          Resolution reference: {pendingResolution.publicReference}
        </p>
      )}
    </div>
  ) : null;

  if (confirming) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--kt-ink-navy)] font-medium">
          Are you sure you want to cancel this delivery request?
        </p>
        <div>
          <label
            htmlFor={`cancel-reason-${orderId}`}
            className="block text-xs text-slate-600 mb-1"
          >
            Reason (optional)
          </label>
          <input
            id={`cancel-reason-${orderId}`}
            type="text"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional cancellation reason"
            disabled={loading}
            className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        {pendingBanner}
        {!pendingResolution && error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={handleCancel}
            disabled={loading}
          >
            {loading ? "Cancelling…" : "Yes, cancel order"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
            disabled={loading}
          >
            No, keep it
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {pendingBanner}
      {!pendingResolution && error && (
        <p className="text-sm text-red-600 mb-2">{error}</p>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
      >
        Cancel this order
      </Button>
    </div>
  );
}
