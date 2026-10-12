"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { PROVINCES } from "@/lib/client-platform/contracts";
import type { DeliveryPolicyVersion } from "@/lib/marketplace-checkout/delivery-policy";
type Version = DeliveryPolicyVersion & { updatedAt: string };
export function MarketplaceDeliveryPolicyManager({ initial, actorId, canManage }: { initial: Version[]; actorId: string; canManage: boolean }) {
  const [versions, setVersions] = useState(initial);
  const [ruleCount, setRuleCount] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function request(method: string, body: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/marketplace-delivery-policy", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      const current = await fetch("/api/admin/marketplace-delivery-policy"); if (!current.ok) throw new Error("Saved. Reload to read the current version.");
      setVersions(await current.json()); setMessage("Policy version and audit history saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Policy could not be saved."); }
    finally { setBusy(false); }
  }
  function draft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const rules = Array.from({ length: ruleCount }, (_, index) => {
      const read = (key: string) => String(form.get(`${index}-${key}`) ?? "");
      return { key: read("key"), sizeClass: read("sizeClass"), minDistanceKm: Number(read("minDistanceKm")), maxDistanceKm: Number(read("maxDistanceKm")), province: read("province") || null, regionId: read("regionId") || null, storeId: read("storeId") || null, fee: read("fee"), highRiskSurcharge: read("highRiskSurcharge"), minimumFee: read("minimumFee"), maximumFee: read("maximumFee") || null };
    });
    void request("POST", { expectedVersion: Math.max(0, ...versions.map((v) => v.version)), effectiveFrom: new Date(String(form.get("effectiveFrom"))).toISOString(), effectiveTo: form.get("effectiveTo") ? new Date(String(form.get("effectiveTo"))).toISOString() : null, reason: form.get("reason"), rules });
  }
  return <div className="space-y-6"><p>Enter supplied commercial values. A different administrator must approve a draft before activation. Distance bands include the start and exclude the end.</p><p role="status" aria-live="polite">{message}</p>
    {canManage ? <form onSubmit={draft} className="space-y-4"><h2>Create a draft matrix</h2>{Array.from({ length: ruleCount }, (_, index) => <fieldset key={index} className="grid gap-3 rounded border p-4 sm:grid-cols-2"><legend>Tariff row {index + 1}</legend><div><Label htmlFor={`${index}-key`}>Rule key</Label><Input id={`${index}-key`} name={`${index}-key`} pattern="[A-Z0-9_-]{2,60}" required /></div><div><Label htmlFor={`${index}-sizeClass`}>Parcel class</Label><select id={`${index}-sizeClass`} name={`${index}-sizeClass`} className="w-full border p-3"><option value="SMALL">Small</option><option value="MEDIUM">Medium</option><option value="LARGE">Large</option><option value="ANY">Explicitly all parcel sizes</option></select></div>{([['minDistanceKm', 'Distance band start (km)'], ['maxDistanceKm', 'Distance band end (km)'], ['fee', 'Delivery fee (ZAR, two decimals)'], ['highRiskSurcharge', 'High-risk surcharge (ZAR, two decimals)'], ['minimumFee', 'Minimum fee (ZAR, two decimals)'], ['maximumFee', 'Maximum fee (optional)']] as const).map(([key, label]) => <div key={key}><Label htmlFor={`${index}-${key}`}>{label}</Label><Input id={`${index}-${key}`} name={`${index}-${key}`} type={key.includes("Distance") ? "number" : "text"} min="0" step="0.001" required={key !== "maximumFee"} /></div>)}<div><Label htmlFor={`${index}-province`}>Province scope</Label><select id={`${index}-province`} name={`${index}-province`} className="w-full border p-3"><option value="">Use explicit region scope</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></div>{([['regionId', 'Region ID (optional when province supplied)'], ['storeId', 'Authorized store override ID (optional)']] as const).map(([key, label]) => <div key={key}><Label htmlFor={`${index}-${key}`}>{label}</Label><Input id={`${index}-${key}`} name={`${index}-${key}`} /></div>)}</fieldset>)}
      <Button type="button" variant="secondary" disabled={busy || ruleCount >= 500} onClick={() => setRuleCount((n) => n + 1)}>Add tariff row</Button><div><Label htmlFor="matrix-from">Effective from</Label><Input id="matrix-from" name="effectiveFrom" type="datetime-local" required /></div><div><Label htmlFor="matrix-to">Effective until (optional)</Label><Input id="matrix-to" name="effectiveTo" type="datetime-local" /></div><div><Label htmlFor="matrix-reason">Audit reason and authority</Label><Input id="matrix-reason" name="reason" minLength={10} maxLength={500} required /></div><Button type="submit" disabled={busy}>Save draft version</Button></form> : null}
    <h2>Version and approval history</h2>{versions.length ? versions.map((version) => <section key={version.version} className="space-y-3 rounded border p-4"><h3>Version {version.version} · {version.status}</h3><p>Effective {version.effectiveFrom} to {version.effectiveTo ?? "open ended"}</p><ul>{version.rules.map((rule) => <li key={rule.key}>{rule.key}: {rule.sizeClass}, {rule.minDistanceKm}–{rule.maxDistanceKm} km, {rule.province ?? rule.regionId}, R{rule.fee}, high-risk +R{rule.highRiskSurcharge}{rule.storeId ? " · store override" : ""}</li>)}</ul>{canManage && version.status !== "RETIRED" ? <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void request("PATCH", { version: version.version, expectedUpdatedAt: version.updatedAt, action: data.get("action"), reason: data.get("reason") }); }} className="flex flex-wrap items-end gap-3"><div><Label htmlFor={`review-${version.version}`}>Review / activation reason</Label><Input id={`review-${version.version}`} name="reason" minLength={10} maxLength={500} required /></div><select name="action" aria-label={`Action for version ${version.version}`} className="border p-3">{version.status === "DRAFT" && version.createdByUserId !== actorId ? <option value="APPROVE">Approve independently</option> : null}{version.status === "APPROVED" ? <option value="ACTIVATE">Activate approved version</option> : null}<option value="RETIRE">Retire version</option></select><Button type="submit" disabled={busy}>Apply action</Button></form> : null}</section>) : <p>No policy exists. Checkout fails closed until an applicable matrix is approved.</p>}
  </div>;
}
