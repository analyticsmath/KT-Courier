"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
const key = "commercial_configuration.manage";
type Override = { permissionKey: string; effect: "ALLOW" | "DENY"; reason?: string | null };
export function CommercialReviewerAccessForm({ employees }: { employees: { id: string; label: string }[] }) {
  const [target, setTarget] = useState(employees[0]?.id ?? ""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  async function apply(grant: boolean, removeOverride = false) {
    setBusy(true); setMessage("");
    try {
      const url = `/api/admin/employees/${target}/permissions`; const response = await fetch(url, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Unable to read reviewer access.");
      const current = body.data ?? body; const overrides: Override[] = current.overrides.map((item: Override) => ({ permissionKey: item.permissionKey, effect: item.effect, reason: item.reason }));
      const receipt = `kt-temporary-commercial-review:${target}`;
      if (grant && localStorage.getItem(receipt) === null) localStorage.setItem(receipt, JSON.stringify(overrides.find(item => item.permissionKey === key) ?? null));
      const prior = localStorage.getItem(receipt); if (!grant && !removeOverride && prior === null) throw new Error("No temporary grant receipt exists in this browser. Review the original permissions before changing access.");
      if (removeOverride && !recoveryConfirmed) throw new Error("Confirm the reviewed permission baseline before removing an override.");
      const original = !removeOverride && prior ? JSON.parse(prior) as Override | null : null;
      if (original && (original.permissionKey !== key || !["ALLOW", "DENY"].includes(original.effect))) throw new Error("Invalid grant receipt. Review the original permission baseline.");
      const restored = [...overrides.filter(item => item.permissionKey !== key), ...(original ? [original] : [])];
      const result = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(grant ? { mode: "MERGE", overrides: [{ permissionKey: key, effect: "ALLOW", reason: "Operator-authorized temporary independent packaging review; restore original access after review." }] } : { mode: "REPLACE", overrides: restored }) });
      const saved = await result.json(); if (!result.ok) throw new Error(saved.error ?? "Access change was not confirmed.");
      if (!grant) localStorage.removeItem(receipt); setMessage(grant ? "Reviewer access granted. Restore original access immediately after the independent review." : "Original commercial reviewer access restored; other current overrides preserved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Access change was not confirmed."); } finally { setBusy(false); }
  }
  return <div className="space-y-3"><p>This grants commercial configuration management, including package approval and commercial settings. Restore the original access after review.</p><label htmlFor="commercial-reviewer">Reviewer account</label><select id="commercial-reviewer" className="w-full rounded border p-3" value={target} disabled={busy} onChange={event => { setTarget(event.target.value); setRecoveryConfirmed(false); setMessage(""); }}>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.label}</option>)}</select><div className="flex flex-wrap gap-3"><Button type="button" disabled={busy || !target} onClick={() => void apply(true)}>Grant reviewer access</Button><Button type="button" variant="secondary" disabled={busy || !target} onClick={() => void apply(false)}>Restore original reviewer access</Button></div><fieldset className="space-y-2"><legend>Recover without a browser receipt</legend><p>Use only after reviewing the original access. This removes the commercial management override and returns to role-based access; it cannot restore a previous explicit deny.</p><label className="flex gap-2"><input type="checkbox" checked={recoveryConfirmed} disabled={busy} onChange={event => setRecoveryConfirmed(event.target.checked)} />I verified that this account originally had no commercial management override.</label><Button type="button" variant="secondary" disabled={busy || !target || !recoveryConfirmed} onClick={() => void apply(false, true)}>Remove reviewed commercial override</Button></fieldset><p role="status" aria-live="polite">{message}</p></div>;
}
