"use client";
import { useState } from "react";
import type { EarningClearancePolicy } from "@/lib/earnings/clearance-policy";

export function EarningClearancePolicyForm({ active, pending, canManage }: { active: EarningClearancePolicy | null; pending: EarningClearancePolicy | null; canManage: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(method: string, body: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/earning-clearance-policy", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Policy could not be saved.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Policy could not be saved."); }
    finally { setBusy(false); }
  }
  const field = "rounded border p-2 block w-full";
  return <div className="space-y-6">
    <p>{active ? `Active policy ${active.version}. Store hold: ${active.storeHoldHours} hours. Driver hold: ${active.driverHoldHours} hours. Effective: ${active.effectiveFrom}.` : "No approved clearance policy. Earnings remain held until an independently reviewed policy is configured."}</p>
    <p>Hold periods start at verified delivery completion. Existing clearance dates remain fixed. Refund, incident, funding and account checks still apply before release.</p>
    {pending ? <div className="space-y-3"><h2 className="text-lg font-semibold">Pending review: {pending.version}</h2><p>Store: {pending.storeHoldHours} hours. Driver: {pending.driverHoldHours} hours. Effective: {pending.effectiveFrom}.</p><p>{pending.reason}</p>{canManage ? <button disabled={busy} className={field} onClick={() => send("PUT", { version: pending.version, reviewed: true })}>Approve reviewed policy</button> : null}<p>A different administrator must approve this policy.</p></div> : canManage ? <form className="space-y-4 max-w-xl" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void send("POST", { version: data.get("version"), effectiveFrom: new Date(String(data.get("effectiveFrom"))).toISOString(), storeHoldHours: Number(data.get("storeHoldHours")), driverHoldHours: Number(data.get("driverHoldHours")), reason: data.get("reason") }); }}>
      <h2 className="text-lg font-semibold">Submit policy for independent review</h2>
      <label className="block">Unique version<input required name="version" maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9._:-]*" className={field} /></label>
      <label className="block">Effective from (your local time)<input required type="datetime-local" name="effectiveFrom" className={field} /></label>
      <label className="block">Store hold hours<input required type="number" min={0} max={8760} name="storeHoldHours" className={field} /></label>
      <label className="block">Driver hold hours<input required type="number" min={0} max={8760} name="driverHoldHours" className={field} /></label>
      <label className="block">Review reason<textarea required name="reason" minLength={10} maxLength={500} className={field} /></label>
      <button disabled={busy} className={field} type="submit">Submit for review</button>
    </form> : null}
    <p role="status">{message}</p>
  </div>;
}
