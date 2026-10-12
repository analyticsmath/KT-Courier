"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export type ParcelProfileRow = { id: string; stableKey: string; versionNumber: number; displayName: string; lengthCm: number | null; widthCm: number | null; heightCm: number | null; maximumWeightKg: number | null; status: string; effectiveFrom: string; effectiveTo: string | null };
export function ParcelProfilesManager({ initial, canManage }: { initial: ParcelProfileRow[]; canManage: boolean }) {
  const [rows, setRows] = useState(initial);
  const [selected, setSelected] = useState<ParcelProfileRow | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/parcel-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stableKey: selected.stableKey, expectedVersion: Math.max(0, ...rows.filter((r) => r.stableKey === selected.stableKey).map((r) => r.versionNumber)), displayName: form.get("displayName"), ...Object.fromEntries(["lengthCm", "widthCm", "heightCm", "maximumWeightKg"].map((key) => [key, Number(form.get(key))])), status: form.get("status"), effectiveFrom: new Date(String(form.get("effectiveFrom"))).toISOString(), effectiveTo: form.get("effectiveTo") ? new Date(String(form.get("effectiveTo"))).toISOString() : null, reason: form.get("reason") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      const current = await fetch("/api/admin/parcel-profiles"); if (!current.ok) throw new Error("Saved, but refresh failed. Reload before editing again.");
      setRows(await current.json()); setSelected(null); setMessage("New parcel profile version saved with audit evidence.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Profile could not be saved."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5"><p>Client examples remain drafts until an authorized operator approves acceptance limits. Version history is retained.</p><p role="status" aria-live="polite">{message}</p>
    <ul className="space-y-3">{rows.map((row) => <li key={row.id} className="rounded border p-4"><h2>{row.displayName} · {row.status} · version {row.versionNumber}</h2><p>{row.lengthCm ?? "Pending"} × {row.widthCm ?? "Pending"} × {row.heightCm ?? "Pending"} cm · {row.maximumWeightKg ?? "Pending"} kg maximum</p><p>Effective {new Date(row.effectiveFrom).toLocaleString()} to {row.effectiveTo ? new Date(row.effectiveTo).toLocaleString() : "open ended"}</p>{canManage ? <Button type="button" variant="secondary" onClick={() => { setSelected(row); setMessage(""); }}>Prepare new version</Button> : null}</li>)}</ul>
    {canManage && selected ? <form key={selected.id} onSubmit={save} className="space-y-4 rounded border p-4"><h2>New {selected.stableKey.toLowerCase()} profile version</h2><Label htmlFor="parcel-name">Display name</Label><Input id="parcel-name" name="displayName" required defaultValue={selected.displayName} />
      {([['lengthCm', 'Length (cm)'], ['widthCm', 'Width (cm)'], ['heightCm', 'Height (cm)'], ['maximumWeightKg', 'Maximum weight (kg)']] as const).map(([key, label]) => <div key={key}><Label htmlFor={`parcel-${key}`}>{label}</Label><Input id={`parcel-${key}`} name={key} type="number" min="0.001" step="0.001" required defaultValue={selected[key] ?? ""} /></div>)}
      <div><Label htmlFor="parcel-status">Approval and effective status</Label><select id="parcel-status" name="status" className="w-full border p-3"><option value="DRAFT">Draft for review</option><option value="ACTIVE">Approve operational limits and activate</option></select></div>
      <div><Label htmlFor="parcel-from">Effective from</Label><Input id="parcel-from" name="effectiveFrom" type="datetime-local" required /></div><div><Label htmlFor="parcel-to">Effective until (optional)</Label><Input id="parcel-to" name="effectiveTo" type="datetime-local" /></div>
      <div><Label htmlFor="parcel-reason">Audit reason</Label><Input id="parcel-reason" name="reason" minLength={10} maxLength={500} required /></div><Button type="submit" disabled={busy}>Save version</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button>
    </form> : null}</div>;
}
