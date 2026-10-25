"use client";
import { utcDateInputToIso } from "@/lib/utils/utc-date-input";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { TrustedPackageVersion } from "@/lib/marketplace-checkout/parcel-classification";

import type { PackagingDeclaration } from "@/lib/services/catalog-packaging.service";
import { MeasuredConsignmentDraft } from "./MeasuredConsignmentDraft";

type Version = TrustedPackageVersion & { updatedAt: string };
export function MarketplaceTrustedPackageManager({ initial, actorId, canManage }: { initial: Version[]; actorId: string; canManage: boolean }) {
  const [declarations, setDeclarations] = useState<PackagingDeclaration[]>([]);
  const [declarationCursor, setDeclarationCursor] = useState<string | null>(null);
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
  async function loadDeclarations(cursor?: string) {
    setBusy(true);
    try {
      const url = cursor ? `/api/admin/catalog-packaging-declarations?cursor=${encodeURIComponent(cursor)}` : "/api/admin/catalog-packaging-declarations";
      const response = await fetch(url);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load vendor packages.");
      const received = body.declarations as PackagingDeclaration[];
      setDeclarations(current => cursor
        ? [...current.filter(item => !received.some(next => next.offerReference === item.offerReference)), ...received]
        : received);
      setDeclarationCursor(body.nextCursor ?? null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load vendor packages."); }
    finally { setBusy(false); }
  }
  async function prepareDeclaration(declaration: PackagingDeclaration) {
    setBusy(true); try {
      const response = await fetch("/api/admin/catalog-packaging-declarations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerReference: declaration.offerReference, revision: declaration.revision, expectedVersion: Math.max(0, ...versions.map(version => version.version)), reason: "Prepare vendor measured package for independent operational approval." }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not prepare review.");
      const current = await fetch("/api/admin/marketplace-trusted-packages"); if (!current.ok) throw new Error("Draft saved. Reload to continue its review."); setVersions(await current.json()); setMessage("Packaging draft prepared. A different authorized administrator must review and approve it before activation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not prepare review."); } finally { setBusy(false); }
  }
  function draft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const text = (key: string) => String(data.get(key) ?? "");
    try {
      const entry = { storeId: text("storeId"), offerReference: text("offerReference"), variantReference: text("variantReference"), publicationVersion: text("publicationVersion"), modifiers: JSON.parse(text("modifiers")), packingRule: "SINGLE_PREPACKAGED_UNIT", lengthCm: Number(text("lengthCm")), widthCm: Number(text("widthCm")), heightCm: Number(text("heightCm")), weightKg: Number(text("weightKg")), authorityReference: text("authorityReference") };
      const latest = [...versions].sort((a, b) => b.version - a.version)[0];
      const current = [...versions].filter(version => version.status !== "RETIRED").sort((a, b) => b.version - a.version)[0];
      const packages = (current?.packages ?? []).filter((prior) => !(prior.storeId === entry.storeId && prior.offerReference === entry.offerReference && prior.variantReference === entry.variantReference && prior.publicationVersion === entry.publicationVersion && JSON.stringify(prior.modifiers) === JSON.stringify(entry.modifiers)));
      void request("POST", { expectedVersion: latest?.version ?? 0, effectiveFrom: utcDateInputToIso(text("effectiveFrom")), effectiveTo: text("effectiveTo") ? utcDateInputToIso(text("effectiveTo")) : null, packages: [...packages, entry], bundles: current?.bundles ?? [], reason: text("reason") });
    } catch { setMessage("Enter valid effective dates and a JSON array of modifier selections."); }
  }
  function saveBundle(bundle: NonNullable<TrustedPackageVersion["bundles"]>[number], schedule: {effectiveFrom: string; effectiveTo: string | null; reason: string}) {
    const latest = [...versions].sort((a,b) => b.version - a.version)[0];
    const current = versions.filter(v => v.status !== "RETIRED").sort((a,b)=>b.version-a.version)[0];
    const fingerprint = (lines: typeof bundle.lines) => JSON.stringify(lines.map(line => ({
      offerReference:line.offerReference, variantReference:line.variantReference,
      publicationVersion:line.publicationVersion, quantity:line.quantity,
      modifiers:[...line.modifiers].sort((a,b)=>a.optionReference.localeCompare(b.optionReference)),
    })).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
    const bundles = (current?.bundles ?? []).filter(prior => prior.storeId !== bundle.storeId || fingerprint(prior.lines) !== fingerprint(bundle.lines));
    void request("POST", { expectedVersion:latest?.version ?? 0, ...schedule, packages:current?.packages ?? [], bundles:[...bundles,bundle] });
  }
  return <div className="space-y-4"><p>Supply measured packaged dimensions and weight, with the source authority reference. Single units and measured multi-item sealed consignments require independent approval. Unmeasured aggregates are refused unless a separate all-size tariff is explicitly approved.</p><p role="status" aria-live="polite">{message}</p>
    <section className="space-y-3"><h3>Vendor package submissions</h3><Button type="button" disabled={busy} onClick={() => loadDeclarations()}>Load vendor package submissions</Button>{declarations.map(declaration => <article key={declaration.offerReference} className="rounded border p-3 space-y-2"><p className="break-all">Offer: {declaration.offerReference}</p><p>{declaration.lengthCm} × {declaration.widthCm} × {declaration.heightCm} cm · {declaration.weightKg} kg</p><p>{declaration.description}</p><p>Submitted {declaration.submittedAt}</p>{canManage ? <Button type="button" disabled={busy} onClick={() => prepareDeclaration(declaration)}>Prepare packaging review</Button> : null}</article>)}{declarationCursor ? <Button type="button" disabled={busy} onClick={() => loadDeclarations(declarationCursor)}>Load more vendor submissions</Button> : null}</section>
    {canManage ? <form onSubmit={draft} className="grid gap-3 sm:grid-cols-2"><h3 className="sm:col-span-2">Create measured packaging draft</h3>
      {([['storeId', 'Packaging store ID'], ['offerReference', 'Packaging offer reference'], ['variantReference', 'Packaging variant reference'], ['publicationVersion', 'Packaging publication version'], ['authorityReference', 'Measurement authority reference'], ['reason', 'Packaging audit reason']] as const).map(([key, label]) => <div key={key}><Label htmlFor={`package-${key}`}>{label}</Label><Input id={`package-${key}`} name={key} required minLength={key === "reason" || key === "authorityReference" ? 10 : 1} /></div>)}
      {([['lengthCm', 'Packaged length (cm)'], ['widthCm', 'Packaged width (cm)'], ['heightCm', 'Packaged height (cm)'], ['weightKg', 'Packaged weight (kg)']] as const).map(([key, label]) => <div key={key}><Label htmlFor={`package-${key}`}>{label}</Label><Input id={`package-${key}`} name={key} type="number" min="0.0001" max={key === "weightKg" ? "10000" : "1000"} step="0.0001" required /></div>)}
      <div><Label htmlFor="package-modifiers">Exact modifier selections (JSON)</Label><Input id="package-modifiers" name="modifiers" defaultValue="[]" required /><p className="text-sm">Use an empty array for no modifiers, or optionReference and quantity for each selected option.</p></div>
      <div><Label htmlFor="package-from">Packaging effective from (UTC)</Label><Input id="package-from" name="effectiveFrom" type="datetime-local" required /></div><div><Label htmlFor="package-to">Packaging effective until (UTC, optional)</Label><Input id="package-to" name="effectiveTo" type="datetime-local" /></div><div className="sm:col-span-2"><Button type="submit" disabled={busy}>Save packaging draft</Button></div>
    </form> : null}
    {canManage ? <MeasuredConsignmentDraft disabled={busy} onSave={saveBundle} /> : null}
    {versions.length ? versions.map((version) => <section className="space-y-3 rounded border p-4" key={version.version}><h3>Packaging version {version.version} · {version.status}</h3><p>{version.packages.length} single packages · {(version.bundles ?? []).length} reviewed consignments · {version.effectiveFrom} to {version.effectiveTo ?? "open ended"}</p>
      <ul className="space-y-2 text-sm">{version.packages.map(entry => <li key={`${entry.storeId}:${entry.offerReference}:${entry.variantReference}:${JSON.stringify(entry.modifiers)}`} className="break-words"><p>{entry.offerReference} · {entry.variantReference} · offer revision {entry.publicationVersion}</p><p>{entry.lengthCm} × {entry.widthCm} × {entry.heightCm} cm · {entry.weightKg} kg</p><p>Evidence: {entry.authorityReference}</p></li>)}</ul>
      {(version.bundles ?? []).map((bundle, index) => <article className="space-y-1 rounded-lg border p-3 text-sm" key={`${bundle.storeId}:${index}`}><h4 className="font-medium">Sealed consignment · store {bundle.storeId}</h4><p>{bundle.lines.length} offer lines · {bundle.lengthCm} × {bundle.widthCm} × {bundle.heightCm} cm · {bundle.weightKg} kg</p><p>Evidence: {bundle.authorityReference}</p><ul>{bundle.lines.map((line, i) => <li className="break-words" key={`${line.offerReference}:${i}`}>{line.quantity} × {line.offerReference} · {line.variantReference} · revision {line.publicationVersion}</li>)}</ul></article>)}
      {canManage && version.status !== "RETIRED" ? <form className="flex flex-wrap gap-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void request("PATCH", { version: version.version, expectedUpdatedAt: version.updatedAt, action: data.get("action"), reason: data.get("reason") }); }}><div><Label htmlFor={`package-review-${version.version}`}>Packaging review reason</Label><Input id={`package-review-${version.version}`} name="reason" minLength={10} maxLength={500} required /></div><select name="action" aria-label={`Packaging action for version ${version.version}`} className="border p-3">{version.status === "DRAFT" && version.createdByUserId !== actorId ? <option value="APPROVE">Approve independently</option> : null}{version.status === "APPROVED" ? <option value="ACTIVATE">Activate reviewed packaging</option> : null}<option value="RETIRE">Retire packaging version</option></select><Button type="submit" disabled={busy}>Apply packaging action</Button></form> : null}</section>) : <p>No trusted packaging exists. Size-specific tariffs remain unavailable.</p>}
  </div>;
}
