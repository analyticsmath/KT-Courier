"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Policy = {
  publicReference: string;
  name: string;
  versionNumber: number;
  status: string;
  acceptanceWindowSeconds: number;
  customerDecisionWindowSeconds: number;
  maximumPrepMinutes: number;
  maximumPrepExtensionMinutes: number;
  maximumIssueCount: number;
  maximumSubstitutionProposalsPerLine: number;
  substitutionMode: string;
  handoffVerificationMode: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  approvedByUserId: string | null;
};

const fields = [
  { key: "acceptanceWindowSeconds", label: "Vendor acceptance window (seconds)", value: 900, max: 86400 },
  { key: "customerDecisionWindowSeconds", label: "Customer substitution decision window (seconds)", value: 1800, max: 172800 },
  { key: "maximumPrepMinutes", label: "Maximum preparation time (minutes)", value: 180, max: 1440 },
  { key: "maximumPrepExtensionMinutes", label: "Maximum preparation extension (minutes)", value: 60, max: 720 },
  { key: "maximumIssueCount", label: "Maximum issues per store order", value: 3, max: 100 },
  { key: "maximumSubstitutionProposalsPerLine", label: "Maximum substitutions per line", value: 2, max: 5 },
] as const;

export function StoreOrderPolicyManager({ initialPolicies }: { initialPolicies: Policy[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function action(payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/store-order-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(typeof body.error === "string" ? body.error : "Policy operation was refused.");
      setNotice(`Policy ${payload.action} completed. Check the current policy state below.`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update store-order policy.");
    } finally { setBusy(false); }
  }

  function save(form: HTMLFormElement) {
    const data = new FormData(form);
    const date = String(data.get("effectiveFrom") || "");
    const effectiveFrom = new Date(date);
    if (!date || !Number.isFinite(effectiveFrom.getTime())) {
      setError("Choose a valid effective date and time.");
      return;
    }
    void action({
      action: "create",
      name: String(data.get("name")),
      versionNumber: Number(data.get("versionNumber")),
      ...Object.fromEntries(fields.map(field => [field.key, Number(data.get(field.key))])),
      substitutionMode: String(data.get("substitutionMode")),
      effectiveFrom: effectiveFrom.toISOString(),
      effectiveUntil: null,
    });
  }
  return <div className="space-y-8">
    <p className="text-sm text-[var(--kt-text-muted)]">
      The suggested windows below are editable operating proposals, not client-approved timing commitments.
      Submit, review and activate an appropriate version before marketplace order processing.
      Refund and customer substitution decisions remain controlled by their underlying financial policies.
    </p>
    <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); save(event.currentTarget); }}>
      <div className="space-y-1">
        <label htmlFor="store-policy-name" className="block text-sm font-semibold">Policy name</label>
        <input id="store-policy-name" name="name" required minLength={3} maxLength={120} defaultValue="KT Couriers initial store fulfilment" className="w-full rounded-lg border px-3 py-2 text-[var(--kt-text)]" />
      </div>
      <div className="space-y-1">
        <label htmlFor="store-policy-version" className="block text-sm font-semibold">Version</label>
        <input id="store-policy-version" name="versionNumber" type="number" min={1} max={10000} step={1} defaultValue={1} required className="w-full rounded-lg border px-3 py-2 text-[var(--kt-text)]" />
      </div>
      {fields.map(field => <div key={field.key} className="space-y-1">
        <label htmlFor={field.key} className="block text-sm font-semibold">{field.label}</label>
        <input id={field.key} name={field.key} type="number" min={1} max={field.max} step={1} defaultValue={field.value} required className="w-full rounded-lg border px-3 py-2 text-[var(--kt-text)]" />
      </div>)}
      <div className="space-y-1">
        <label htmlFor="store-policy-substitutions" className="block text-sm font-semibold">Substitution handling</label>
        <select id="store-policy-substitutions" name="substitutionMode" defaultValue="CUSTOMER_APPROVAL_REQUIRED" className="w-full rounded-lg border px-3 py-2 text-[var(--kt-text)]">
          <option value="CUSTOMER_APPROVAL_REQUIRED">Require customer approval</option>
          <option value="REFUND_ONLY">Refund affected items instead</option>
          <option value="PREAPPROVED_CHOICES_ONLY">Use only customer preapproved substitutions</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="store-policy-effective" className="block text-sm font-semibold">Effective from (local time)</label>
        <input id="store-policy-effective" name="effectiveFrom" type="datetime-local" required className="w-full rounded-lg border px-3 py-2 text-[var(--kt-text)]" />
      </div>
      <div className="sm:col-span-2">
        <button disabled={busy} type="submit" className="rounded-lg bg-[var(--kt-text)] px-5 py-3 font-semibold text-white disabled:opacity-60">Create versioned draft</button>
      </div>
    </form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <section className="space-y-3" aria-label="Existing store-order policies">
      <h3 className="font-semibold">Policy versions</h3>
      {!initialPolicies.length && <p className="text-sm text-[var(--kt-text-muted)]">No operational policies are configured. Create a draft above before starting live vendor fulfillment.</p>}
      {initialPolicies.map(policy => <article key={policy.publicReference} className="space-y-3 border-b py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><strong>{policy.name}</strong><p className="text-xs text-[var(--kt-text-muted)]">Version {policy.versionNumber} · {policy.publicReference}</p></div>
          <span className="text-sm font-semibold">{policy.status.replaceAll("_", " ")}</span>
        </div>
        <p className="text-sm">Vendor response: {policy.acceptanceWindowSeconds}s · Customer response: {policy.customerDecisionWindowSeconds}s · Preparation: {policy.maximumPrepMinutes}min · Substitutions: {policy.substitutionMode.replaceAll("_"," ").toLowerCase()}</p>
        <p className="text-xs text-[var(--kt-text-muted)]">Effective {new Date(policy.effectiveFrom).toLocaleString("en-ZA")}. Handoff uses {policy.handoffVerificationMode.replaceAll("_"," ").toLowerCase()}.</p>
        <div className="flex flex-wrap gap-2">
          {policy.status === "DRAFT" && <button type="button" disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => void action({ action:"submit", reference:policy.publicReference })}>Submit for review</button>}
          {policy.status === "UNDER_REVIEW" && <button type="button" disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => void action({ action:"approve", reference:policy.publicReference })}>Approve reviewed policy</button>}
          {policy.status === "APPROVED" && <button type="button" disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => void action({ action:"activate", reference:policy.publicReference })}>Activate approved policy</button>}
        </div>
      </article>)}
    </section>
  </div>;
}
