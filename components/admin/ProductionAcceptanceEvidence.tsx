"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AcceptanceRecord } from "@/lib/production-readiness/evidence";
const keys = ["vendor_onboarding_acceptance", "driver_onboarding_acceptance", "driver_gps_acceptance", "pod_otp_acceptance", "live_paid_order_acceptance", "settlement_acceptance", "refund_acceptance", "payout_acceptance", "current_ci_certification", "production_deployment_sha_parity"];
export function ProductionAcceptanceEvidence({ records, canManage }: { records: AcceptanceRecord[]; canManage: boolean }) {
  const router = useRouter(); const [key, setKey] = useState(keys[0]); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(form: HTMLFormElement, review?: AcceptanceRecord, action?: "APPROVE" | "REVOKE") {
    const f = new FormData(form); setBusy(true); setMessage("");
    const field = (name: string) => String(f.get(name) ?? "");
    const kind = key === "current_ci_certification" ? "CI" : key === "production_deployment_sha_parity" ? "PARITY" : "LIVE";
    try {
      const evidence = review ? null : { kind, key, releaseSha: field("releaseSha"), observedAt: new Date(field("observedAt")).toISOString(), expiresAt: new Date(field("expiresAt")).toISOString(), evidenceReference: field("evidenceReference"), reason: field("reason"), ...(kind === "CI" ? { runUrl: field("runUrl"), conclusion: "SUCCESS", skippedCriticalTests: 0, testsPassed: Number(field("testsPassed")) } : kind === "PARITY" ? { ...Object.fromEntries(["vercelSha", "webSha", "operationsSha", "vercelDeploymentId", "webDeploymentId", "operationsDeploymentId", "protectedDataAuditReference"].map((name) => [name, field(name)])), protectedDataUnchanged: true } : { genuineOperatorAcceptance: true, financialAuthorizationReference: field("financialAuthorizationReference") || null }) };
      const body = review ? { key: review.evidence.key, expectedVersion: review.version, action, reason: field("reason") } : { evidence, expectedVersion: records.find((r) => r.evidence.key === key)?.version ?? 0 };
      const r = await fetch("/api/admin/production-readiness", { method: review ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Evidence could not be saved."); setMessage(review ? "Evidence review recorded." : "Draft saved. Independent review is required."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Evidence could not be saved."); } finally { setBusy(false); }
  }
  const input = (name: string, label: string, type = "text", required = true) => <label className="grid gap-2" key={name}>{label}<input className="min-h-12 rounded border p-2" name={name} type={type} required={required} /></label>;
  return <section className="mt-8 space-y-4"><h2 className="text-xl font-semibold">Acceptance evidence</h2><p>Use non-secret audit references. Record completed operator checks and provider evidence; fixtures cannot certify live acceptance.</p>
    {canManage && <form onSubmit={(e) => { e.preventDefault(); void submit(e.currentTarget); }} className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2">Capability<select value={key} onChange={(e) => setKey(e.target.value)} className="min-h-12 border p-2">{keys.map((k) => <option key={k} value={k}>{k.replaceAll("_", " ")}</option>)}</select></label>
      {input("releaseSha", "Release commit SHA")}{input("observedAt", "Observed at", "datetime-local")}{input("expiresAt", "Review expires at", "datetime-local")}{input("evidenceReference", "Evidence artifact reference")}
      {key === "current_ci_certification" ? <>{input("runUrl", "Successful certification run URL", "url")}{input("testsPassed", "Passed tests (zero critical skips)", "number")}</> : key === "production_deployment_sha_parity" ? <>{["vercelSha", "webSha", "operationsSha", "vercelDeploymentId", "webDeploymentId", "operationsDeploymentId", "protectedDataAuditReference"].map((n) => input(n, n.replace(/([A-Z])/g, " $1")))}<p>Confirm healthy deployments at matching SHAs and unchanged protected rows before recording parity.</p></> : input("financialAuthorizationReference", "Separate financial authorization reference (required for money acceptance)", "text", false)}
      {input("reason", "Evidence summary and reason")}<label className="flex gap-3"><input required type="checkbox" />I verified the referenced evidence and completed the genuine acceptance check.</label><button disabled={busy} className="min-h-12 rounded border px-4">Save evidence draft</button>
    </form>}
    {records.map((record) => <article key={record.evidence.key} className="rounded border p-4"><h3>{record.evidence.key.replaceAll("_", " ")}</h3><p>{record.status} · version {record.version} · release {record.evidence.releaseSha}</p><p>Reference: {record.evidence.evidenceReference}</p>{canManage && <form onSubmit={(e) => { e.preventDefault(); const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "REVOKE" ? "REVOKE" : "APPROVE"; void submit(e.currentTarget, record, action); }} className="mt-3 grid gap-3">{input("reason", "Review or revocation reason")}{record.status === "DRAFT" && <button value="APPROVE" disabled={busy} className="min-h-12 border">Independently approve evidence</button>}<button value="REVOKE" disabled={busy} className="min-h-12 border">Revoke evidence</button></form>}</article>)}
    {message && <p role="status">{message}</p>}
  </section>;
}
