"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
export function PromotionReviewForm({
  reference,
  revision,
}: {
  reference: string;
  revision: number;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const r = await fetch(
            `/api/admin/promotions/${encodeURIComponent(reference)}/review`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                expectedRevision: revision,
                decision: form.get("decision"),
                reason: form.get("reason"),
              }),
            },
          );
          const b = await r.json();
          if (!r.ok) throw Error(b.error ?? "Review failed.");
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Review failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Label htmlFor="promotion-review-decision">Decision</Label>
      <select
        id="promotion-review-decision"
        name="decision"
        className="w-full border p-3"
      >
        <option value="REQUEST_CHANGES">Request changes</option>
        <option value="APPROVE_RULES">Approve campaign rules</option>
      </select>
      <Label htmlFor="promotion-review-reason">Review reason</Label>
      <textarea
        id="promotion-review-reason"
        name="reason"
        minLength={10}
        maxLength={1000}
        required
        className="w-full border p-3"
        rows={3}
      />
      <p>
        Rules approval does not activate discounts, approve a funded budget or
        charge the business wallet.
      </p>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" loading={busy}>
        Record review
      </Button>
    </form>
  );
}
