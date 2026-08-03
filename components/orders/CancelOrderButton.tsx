"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface CancelOrderButtonProps {
  orderId: string;
  redirectTo: string;
}

export function CancelOrderButton({ orderId, redirectTo }: CancelOrderButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Could not cancel this order. Please try again or contact support.");
        setConfirming(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please contact KT Couriers for assistance.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--kt-ink-navy)] font-medium">
          Are you sure you want to cancel this delivery request?
        </p>
        {error && (
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
            onClick={() => { setConfirming(false); setError(null); }}
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
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
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
