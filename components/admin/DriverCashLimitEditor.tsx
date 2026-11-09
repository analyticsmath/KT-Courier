"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function DriverCashLimitEditor({
  driverId, initialAmount, initialRevision,
}: { driverId: string; initialAmount: string; initialRevision: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(initialAmount);
  const [revision, setRevision] = useState(initialRevision);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/drivers/" + encodeURIComponent(driverId) + "/cash-limit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, expectedRevision: revision }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error ?? "The driver cash limit could not be saved.");
      setRevision(body.revision);
      setAmount(body.amount);
      setNotice("Cash assignment limit updated and audited. Existing custody remains outstanding until bank reconciliation.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update cash limit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <p className="text-sm leading-6 text-[var(--kt-text-soft)]">
        Set this driver’s maximum cash exposure (cash already held plus cash deliveries being offered).
        New cash assignments are blocked at the cap. Enter R0 to disable cash delivery assignment.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-48">
          <Label htmlFor={"driver-cash-cap-" + driverId}>Cash limit (ZAR)</Label>
          <Input id={"driver-cash-cap-" + driverId} type="number" min="0" max="1000000" step="0.01"
            required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy} loading={busy}>Save cash limit</Button>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--kt-red)]">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </form>
  );
}
