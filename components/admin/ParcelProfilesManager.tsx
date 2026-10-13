"use client";

import { useState } from "react";
import { INITIAL_CLIENT_PARCEL_DRAFTS } from "@/lib/commercial/initial-client-parcel-drafts";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export type ParcelProfileRow = {
  id: string;
  stableKey: string;
  versionNumber: number;
  displayName: string;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  maximumWeightKg: number | null;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export function ParcelProfilesManager({
  initial,
  canManage,
  nowIso,
}: {
  initial: ParcelProfileRow[];
  canManage: boolean;
  nowIso: string;
}) {
  const [rows, setRows] = useState(initial);
  const [selected, setSelected] = useState<ParcelProfileRow | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const missing = INITIAL_CLIENT_PARCEL_DRAFTS.filter(
    (draft) => !rows.some((row) => row.stableKey === draft.stableKey),
  );
  const now = Date.parse(nowIso);
  const notEffective = INITIAL_CLIENT_PARCEL_DRAFTS.filter(
    (draft) => !rows.some((row) =>
      row.stableKey === draft.stableKey && row.status === "ACTIVE" &&
      Date.parse(row.effectiveFrom) <= now &&
      (!row.effectiveTo || Date.parse(row.effectiveTo) > now),
    ),
  );

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const effectiveFrom = String(form.get("effectiveFrom") || "");
      const effectiveTo = String(form.get("effectiveTo") || "");
      if (!effectiveFrom) throw new Error("Choose when this version becomes effective.");
      const body = {
        stableKey: selected.stableKey,
        expectedVersion: Math.max(0, ...rows.filter((row) => row.stableKey === selected.stableKey).map((row) => row.versionNumber)),
        displayName: form.get("displayName"),
        ...Object.fromEntries(
          (["lengthCm", "widthCm", "heightCm", "maximumWeightKg"] as const).map((key) => [key, Number(form.get(key))]),
        ),
        status: form.get("status"),
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
        reason: form.get("reason"),
      };
      const response = await fetch("/api/admin/parcel-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Profile could not be saved.");
      const current = await fetch("/api/admin/parcel-profiles", { cache: "no-store" });
      if (!current.ok) throw new Error("Saved, but refresh failed. Reload before editing again.");
      setRows(await current.json());
      setSelected(null);
      setMessage(
        body.status === "ACTIVE"
          ? "The new active acceptance limits have been saved. Check that the public quote also has approved delivery coverage."
          : "Parcel profile draft saved. It will not appear in public quotes until activated.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function prepareNew(stableKey: string) {
    const example = INITIAL_CLIENT_PARCEL_DRAFTS.find((item) => item.stableKey === stableKey);
    if (!example) return;
    setSelected({
      id: `new:${stableKey}`,
      ...example,
      versionNumber: 0,
      status: "DRAFT",
      effectiveFrom: new Date().toISOString(),
      effectiveTo: null,
    });
    setMessage("");
  }

  return (
    <div className="space-y-5">
      <p>
        Client example dimensions are illustrative, not approved operating limits.
        Only an authorized administrator can activate versioned Small, Medium and
        Large parcel sizes for public quotes and bookings.
      </p>
      <p role="status" aria-live="polite">{message}</p>
      {notEffective.length > 0 && (
        <p role="status" className="rounded border p-4">
          Public parcel quotes are not yet available for: {notEffective.map((size) => size.displayName).join(", ")}.
          Review and activate an effective version of each size after confirming the operating limits.
          Active delivery regions and route verification are also required for successful quotations.
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded border p-4">
            <h2>{row.displayName} · {row.status} · version {row.versionNumber}</h2>
            <p>
              {row.lengthCm ?? "Pending"} × {row.widthCm ?? "Pending"} × {row.heightCm ?? "Pending"} cm
              · {row.maximumWeightKg ?? "Pending"} kg maximum
            </p>
            <p>
              Effective {new Date(row.effectiveFrom).toLocaleString()} to
              {" "}{row.effectiveTo ? new Date(row.effectiveTo).toLocaleString() : "open ended"}
            </p>
            {canManage && (
              <Button type="button" variant="secondary" onClick={() => { setSelected(row); setMessage(""); }}>
                Prepare new version
              </Button>
            )}
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <section className="space-y-3 rounded border p-4" aria-label="Missing parcel profiles">
          <h2 className="font-semibold">Parcel sizes not yet configured</h2>
          <p className="text-sm">
            These missing sizes will not appear on the public quotation page. Create a reviewed version for each
            before enabling parcel acceptance.
          </p>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {missing.map((draft) => (
                <Button key={draft.stableKey} type="button" variant="secondary" onClick={() => prepareNew(draft.stableKey)}>
                  Prepare {draft.displayName} profile
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm">Ask an administrator with commercial configuration permission to set up the missing sizes.</p>
          )}
        </section>
      )}
      {canManage && selected && (
        <form key={selected.id} onSubmit={save} className="space-y-4 rounded border p-4">
          <h2>New {selected.stableKey.toLowerCase()} profile version</h2>
          <p className="text-sm">
            Check the dimensions and maximum weight against operational capacity. Choose Draft unless
            the physical acceptance limits have been explicitly approved.
          </p>
          <Label htmlFor="parcel-name">Display name</Label>
          <Input id="parcel-name" name="displayName" required defaultValue={selected.displayName} />
          {([
            ["lengthCm", "Length (cm)"],
            ["widthCm", "Width (cm)"],
            ["heightCm", "Height (cm)"],
            ["maximumWeightKg", "Maximum weight (kg)"],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <Label htmlFor={`parcel-${key}`}>{label}</Label>
              <Input id={`parcel-${key}`} name={key} type="number" min="0.001" step="0.001" required defaultValue={selected[key] ?? ""} />
            </div>
          ))}
          <div>
            <Label htmlFor="parcel-status">Approval and effective status</Label>
            <select id="parcel-status" name="status" className="w-full border p-3" defaultValue="DRAFT">
              <option value="DRAFT">Draft for review</option>
              <option value="ACTIVE">Approve operating limits and activate for public quotes</option>
            </select>
          </div>
          <div>
            <Label htmlFor="parcel-from">Effective from</Label>
            <Input id="parcel-from" name="effectiveFrom" type="datetime-local" required />
          </div>
          <div>
            <Label htmlFor="parcel-to">Effective until (optional)</Label>
            <Input id="parcel-to" name="effectiveTo" type="datetime-local" />
          </div>
          <div>
            <Label htmlFor="parcel-reason">Audit reason</Label>
            <Input id="parcel-reason" name="reason" minLength={10} maxLength={500} required />
          </div>
          <Button type="submit" disabled={busy}>Save version</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button>
        </form>
      )}
    </div>
  );
}
