"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

type Configuration = { enabled: boolean; defaultServiceKey: string; updatedAt: string | null };
export function MarketplaceCourierTariffManager({ initial, services, canManage }: { initial: Configuration; services: Array<{ key: string; name: string }>; canManage: boolean }) {
  const [configuration, setConfiguration] = useState(initial);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [serviceKey, setServiceKey] = useState(initial.defaultServiceKey);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    try {
      const response = await fetch("/api/admin/marketplace-courier-tariffs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, defaultServiceKey: serviceKey, expectedUpdatedAt: configuration.updatedAt, reason }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setConfiguration(result); setMessage("Marketplace delivery pricing model and audit history saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Pricing model could not be saved."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4"><p>Current model: {configuration.enabled ? "Existing courier tariffs" : "Separate approved marketplace matrix"}. Courier tariffs use the selected active service, verified route and approved measured package. Missing or combined-package measurements require review.</p>
    <p role="status" aria-live="polite">{message}</p>
    {canManage ? <form className="space-y-4" onSubmit={save}><div><Label htmlFor="marketplace-pricing-model">Marketplace delivery pricing model</Label><select id="marketplace-pricing-model" className="w-full border p-3" value={enabled ? "COURIER_TARIFFS" : "MATRIX"} onChange={event => setEnabled(event.target.value === "COURIER_TARIFFS")}><option value="MATRIX">Separate approved marketplace matrix</option><option value="COURIER_TARIFFS">Existing courier tariffs</option></select></div>
      <div><Label htmlFor="marketplace-default-courier">Default marketplace courier service</Label><select id="marketplace-default-courier" className="w-full border p-3" value={serviceKey} onChange={event => setServiceKey(event.target.value)} disabled={!enabled}><option value="">Choose an active service</option>{services.map(service => <option key={service.key} value={service.key}>{service.name}</option>)}</select></div>
      <div><Label htmlFor="marketplace-courier-reason">Pricing model audit reason</Label><Input id="marketplace-courier-reason" name="reason" required minLength={10} maxLength={500} /></div>
      <Button type="submit" disabled={busy || (enabled && !serviceKey)}>{busy ? "Saving pricing model…" : "Save marketplace pricing model"}</Button>
    </form> : null}
  </div>;
}
