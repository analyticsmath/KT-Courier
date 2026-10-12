"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { TrustedPackageVersion } from "@/lib/marketplace-checkout/parcel-classification";

type Version = TrustedPackageVersion & { updatedAt: string };
export function MarketplaceTrustedPackageManager({ initial, actorId, canManage }: { initial: Version[]; actorId: string; canManage: boolean }) {
  const [versions, setVersions] = useState(initial); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function request(method: string, body: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/marketplace-trusted-packages", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Packaging could not be saved.");
      const current = await fetch("/api/admin/marketplace-trusted-packages"); if (!current.ok) throw new Error("Saved. Reload the page to read current packaging.");
      setVersions(await current.json()); setMessage("Trusted package version and audit history saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Packaging could not be saved."); }
    finally { setBusy(false); }
  }
  function draft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const text = (key: string) => String(data.get(key) ?? "");
    try {
      const entry = { storeId: text("storeId"), offerReference: text("offerReference"), variantReference: text("variantReference"), publicationVersion: text("publicationVersion"), modifiers: JSON.parse(text("modifiers")), packingRule: "SINGLE_PREPACKAGED_UNIT", lengthCm: Number(text("lengthCm")), widthCm: Number(text("widthCm")), heightCm: Number(text("heightCm")), weightKg: Number(text("weightKg")), authorityReference: text("authorityReference") };
      const latest = [...versions].sort((a, b) => b.version - a.version)[0];
      const current = [...versions].filter(version => version.status !== "RETIRED").sort((a, b) => b.version - a.version)[0];
      const packages = (current?.packages ?? []).filter((prior) => !(prior.storeId === entry.storeId && prior.offerReference === entry.offerReference && prior.variantReference === entry.variantReference && prior.publicationVersion === entry.publicationVersion && JSON.stringify(prior.modifiers) === JSON.stringify(entry.modifiers)));
      void request("POST", { expectedVersion: latest?.version ?? 0, effectiveFrom: new Date(text("effectiveFrom")).toISOString(), effectiveTo: text("effectiveTo") ? new Date(text("effectiveTo")).toISOString() : null, packages: [...packages, entry], reason: text("reason") });
    } catch { setMessage("Enter valid effective dates and a JSON array of modifier selections."); }
  }
  return <div className="space-y-4"><p>Supply measured packaged dimensions and weight, with the source authority reference. Only a single complete packaged unit can be classified. Multiple units require an approved aggregate packing rule or an explicit all-size tariff.</p><p role="status" aria-live="polite">{message}</p>
    {canManage ? <form onSubmit={draft} className="grid gap-3 sm:grid-cols-2"><h3 className="sm:col-span-2">Create measured packaging draft</h3>
      {([['storeId', 'Packaging store ID'], ['offerReference', 'Packaging offer reference'], ['variantReference', 'Packaging variant reference'], ['publicationVersion', 'Packaging publication version'], ['authorityReference', 'Measurement authority reference'], ['reason', 'Packaging audit reason']] as const).map(([key, label]) => <div key={key}><Label htmlFor={`package-${key}`}>{label}</Label><Input id={`package-${key}`} name={key} required minLength={key === "reason" || key === "authorityReference" ? 10 : 1} /></div>)}
      {([['lengthCm', 'Packaged length (cm)'], ['widthCm', 'Packaged width (cm)'], ['heightCm', 'Packaged height (cm)'], ['weightKg', 'Packaged weight (kg)']] as const).map(([key, label]) => <div key={key}><Label htmlFor={`package-${key}`}>{label}</Label><Input id={`package-${key}`} name={key} type="number" min="0.0001" max={key === "weightKg" ? "10000" : "1000"} step="0.0001" required /></div>)}
      <div><Label htmlFor="package-modifiers">Exact modifier selections (JSON)</Label><Input id="package-modifiers" name="modifiers" defaultValue="[]" required /><p className="text-sm">Use an empty array for no modifiers, or optionReference and quantity for each selected option.</p></div>
      <div><Label htmlFor="package-from">Packaging effective from</Label><Input id="package-from" name="effectiveFrom" type="datetime-local" required /></div><div><Label htmlFor="package-to">Packaging effective until (optional)</Label><Input id="package-to" name="effectiveTo" type="datetime-local" /></div><div className="sm:col-span-2"><Button type="submit" disabled={busy}>Save packaging draft</Button></div>
    </form> : null}
    {versions.length ? versions.map((version) => <section className="space-y-3 rounded border p-4" key={version.version}><h3>Packaging version {version.version} · {version.status}</h3><p>{version.packages.length} measured packages · {version.effectiveFrom} to {version.effectiveTo ?? "open ended"}</p>
      {canManage && version.status !== "RETIRED" ? <form className="flex flex-wrap gap-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void request("PATCH", { version: version.version, expectedUpdatedAt: version.updatedAt, action: data.get("action"), reason: data.get("reason") }); }}><div><Label htmlFor={`package-review-${version.version}`}>Packaging review reason</Label><Input id={`package-review-${version.version}`} name="reason" minLength={10} maxLength={500} required /></div><select name="action" aria-label={`Packaging action for version ${version.version}`} className="border p-3">{version.status === "DRAFT" && version.createdByUserId !== actorId ? <option value="APPROVE">Approve independently</option> : null}{version.status === "APPROVED" ? <option value="ACTIVATE">Activate reviewed packaging</option> : null}<option value="RETIRE">Retire packaging version</option></select><Button type="submit" disabled={busy}>Apply packaging action</Button></form> : null}</section>) : <p>No trusted packaging exists. Size-specific tariffs remain unavailable.</p>}
  </div>;
}
