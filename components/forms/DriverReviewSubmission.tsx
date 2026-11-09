"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";

export function DriverReviewSubmission({ opportunities }: {
  opportunities: Array<{ orderId: string; orderNumber: string; driverName: string }>,
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState(opportunities[0]?.orderId ?? "");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!opportunities.length) return <p className="text-sm">No completed deliveries are awaiting a driver review.</p>;
  return <form className="space-y-4" onSubmit={async e => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/account/driver-reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, rating, body }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "Review could not be saved.");
      setBody(""); setMessage("Your review of the completing courier has been saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save review.");
    } finally { setBusy(false); }
  }}>
    <div>
      <Label htmlFor="driver-review-order">Completed delivery</Label>
      <select id="driver-review-order" required value={orderId}
        className="mt-1 w-full rounded-xl border border-[var(--kt-border)] bg-white px-3 py-3"
        onChange={e => setOrderId(e.target.value)}>
        {opportunities.map(order => <option key={order.orderId} value={order.orderId}>
          {order.orderNumber} — {order.driverName}
        </option>)}
      </select>
    </div>
    <div>
      <Label htmlFor="driver-review-stars">Driver service rating</Label>
      <select id="driver-review-stars" value={rating}
        className="mt-1 w-full rounded-xl border border-[var(--kt-border)] bg-white px-3 py-3"
        onChange={e => setRating(Number(e.target.value))}>
        {[5,4,3,2,1].map(stars => <option key={stars} value={stars}>{stars} of 5 stars</option>)}
      </select>
    </div>
    <div>
      <Label htmlFor="driver-review-body">Describe the driver&apos;s service</Label>
      <textarea id="driver-review-body" required minLength={3} maxLength={2000}
        value={body} onChange={e => setBody(e.target.value)}
        className="mt-1 min-h-28 w-full rounded-xl border border-[var(--kt-border)] bg-white p-3 text-sm" />
    </div>
    <Button type="submit" disabled={busy} loading={busy}>Submit driver review</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-sm text-[var(--kt-red)]">{error}</p>}
  </form>;
}
