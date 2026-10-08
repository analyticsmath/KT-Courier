"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createDriverOperationIdStore } from "@/lib/driver-operations/client-operation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function MarketplacePickupForm({ reference, packageCount, completed }: { reference: string; packageCount: number; completed: boolean }) {
  const router = useRouter();
  const operations = useRef(createDriverOperationIdStore());
  const busy = useRef(false);
  const [saving, setSaving] = useState(false), [done, setDone] = useState(completed), [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current || done) return;
    const form = new FormData(event.currentTarget);
    const body = { pickupCode: String(form.get("pickupCode")), packageCount: Number(form.get("packageCount")) };
    busy.current = true; setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/driver/store-order-handoffs/${encodeURIComponent(reference)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, operationId: operations.current.get("marketplace-pickup", body) }) });
      if (!response.ok) { setMessage("Pickup was not confirmed. Check the store code, package count and current assignment before retrying."); return; }
      const result = (await response.json()).result;
      if (result.handoffStatus !== "VERIFIED" || result.courierOrderStatus !== "PICKED_UP") throw new Error("Pickup result is unavailable.");
      operations.current.clear("marketplace-pickup"); setDone(true); setMessage("Store handoff verified. Pickup custody is recorded."); router.refresh();
    } catch { setMessage("The result could not be confirmed. Retry with the same details to recover the recorded operation."); }
    finally { busy.current = false; setSaving(false); }
  }
  return <section className="space-y-4" aria-labelledby="marketplace-pickup-heading">
    <h2 id="marketplace-pickup-heading">Store pickup verification</h2>
    <p>Collect the code from authorized store staff after checking the packages together.</p>
    {!done ? <form onSubmit={submit} className="max-w-lg space-y-4">
      <div><Label htmlFor="store-pickup-code">Store pickup code</Label><Input id="store-pickup-code" name="pickupCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={saving} aria-describedby="pickup-feedback" /></div>
      <div><Label htmlFor="store-package-count">Collected package count</Label><Input id="store-package-count" name="packageCount" type="number" inputMode="numeric" min={1} max={packageCount} defaultValue={packageCount} required disabled={saving} /></div>
      <label className="flex items-center gap-3"><input type="checkbox" required disabled={saving} /> I checked and collected these packages from the store.</label>
      <Button type="submit" loading={saving} disabled={saving}>Verify store pickup</Button>
    </form> : <p>Pickup custody has been recorded.</p>}
    <p id="pickup-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}
