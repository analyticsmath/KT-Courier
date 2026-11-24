"use client";

import { useState, type FormEvent } from "react";

export interface RetentionPolicyItem {
  id: string;
  publicReference: string;
  dataClass: string;
  version: number;
  action: string;
  retentionDays: number | null;
  effectiveAt: string | null;
  status: string;
  legalReviewStatus: string;
  legalReviewReference: string | null;
  legalReviewReason: string | null;
  legalReviewedByUserId: string | null;
  legalReviewedAt: string | null;
  createdByUserId: string | null;
  activatedByUserId: string | null;
  createdAt: string;
}

type Props = Readonly<{ initialPolicies: RetentionPolicyItem[]; canManage: boolean; canReview: boolean; actorUserId: string; evaluatedAt: string; initialLoadFailed: boolean }>;
type Decision = "APPROVE" | "REJECT";

const inputClass = "w-full rounded-lg border border-[--kt-border] bg-[--kt-surface] px-3 py-2 text-sm text-[--kt-text]";
const supportedOptions = [
  { dataClass: "PRIVATE_MEDIA", action: "DELETE", label: "Private media — delete" },
  { dataClass: "ACCOUNT_PROFILE", action: "ANONYMIZE", label: "Account profile — anonymize" },
] as const;

export function RetentionPoliciesManager({ initialPolicies, canManage, canReview, actorUserId, evaluatedAt: initialEvaluationTime, initialLoadFailed }: Props) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [evaluatedAt, setEvaluatedAt] = useState(initialEvaluationTime);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const [dataClass, setDataClass] = useState<(typeof supportedOptions)[number]["dataClass"]>("PRIVATE_MEDIA");
  const [retentionDays, setRetentionDays] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>("APPROVE");
  const [reviewReason, setReviewReason] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = supportedOptions.find((option) => option.dataClass === dataClass)!;

  async function refresh() {
    try {
      const response = await fetch("/api/admin/retention-policies", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !Array.isArray(json.data)) throw new Error(json.error ?? "Could not refresh retention policies.");
      setPolicies(json.data);
      setEvaluatedAt(new Date().toISOString());
      setLoadFailed(false);
    } catch (reason) {
      setLoadFailed(true);
      throw reason;
    }
  }

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/admin/retention-policies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataClass, action: selected.action, retentionDays: Number(retentionDays), ...(effectiveAt ? { effectiveAt: new Date(effectiveAt).toISOString() } : {}) }),
      });
      const json = await response.json();
      if (!response.ok || json.error) throw new Error(json.error ?? "Could not create the retention-policy draft.");
      setNotice("Draft recorded. An authorized independent reviewer must cite the approved policy source before it can be activated.");
      setEffectiveAt("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the retention-policy draft.");
    } finally { setBusy(false); }
  }

  async function reviewPolicy(reference: string) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/retention-policies/${encodeURIComponent(reference)}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reviewReason, ...(sourceReference.trim() ? { sourceReference: sourceReference.trim() } : {}), attested }),
      });
      const json = await response.json();
      if (!response.ok || json.error) throw new Error(json.error ?? "Could not record the independent review.");
      setReviewTarget(null); setReviewReason(""); setSourceReference(""); setAttested(false);
      setNotice(`Independent review recorded: ${decision}.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not record the independent review.");
    } finally { setBusy(false); }
  }

  async function activatePolicy(reference: string) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/retention-policies/${encodeURIComponent(reference)}/activate`, { method: "POST" });
      const json = await response.json();
      if (!response.ok || json.error) throw new Error(json.error ?? "Could not activate the retention policy.");
      setNotice("The reviewed policy was activated or scheduled.");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not activate the retention policy.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[--kt-border] bg-[--kt-surface] p-5">
        <h2 className="text-base font-semibold text-[--kt-text]">Controlled policy versions</h2>
        <p className="mt-2 text-sm text-[--kt-text-muted]">
          This screen only configures the two policy actions with implemented executors. No retention period is pre-approved. A separate reviewer must cite the governing source and attest before an operator can activate a version.
        </p>
      </section>

      {canManage && <form onSubmit={createDraft} className="grid gap-4 rounded-xl border border-[--kt-border] bg-[--kt-surface] p-5 md:grid-cols-4">
        <label className="space-y-1 text-sm text-[--kt-text-muted]">
          <span>Policy action</span>
          <select className={inputClass} value={dataClass} onChange={(event) => setDataClass(event.target.value as typeof dataClass)}>
            {supportedOptions.map((option) => <option key={option.dataClass} value={option.dataClass}>{option.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm text-[--kt-text-muted]">
          <span>Retention period (days)</span>
          <input className={inputClass} type="number" min={0} max={36500} step={1} value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} required />
        </label>
        <label className="space-y-1 text-sm text-[--kt-text-muted]">
          <span>Future effective date (optional)</span>
          <input className={inputClass} type="datetime-local" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} />
        </label>
        <div className="flex items-end">
          <button className="w-full rounded-lg bg-[--kt-brand-navy] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
            {busy ? "Saving…" : "Create draft"}
          </button>
        </div>
      </form>}

      {(error || loadFailed) && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error ?? "Retention-policy records could not be loaded. Refresh to retry; the empty state is not verified."}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

      <div className="flex justify-end">
        <button type="button" onClick={() => { setBusy(true); refresh().catch(() => setError("Could not refresh retention policies.")).finally(() => setBusy(false)); }} className="rounded-lg border border-[--kt-border] px-3 py-2 text-sm text-[--kt-text] disabled:opacity-60" disabled={busy}>Refresh</button>
      </div>

      <div className="space-y-4">
        {loadFailed ? null : policies.length === 0 ? <p className="rounded-xl border border-[--kt-border] bg-[--kt-surface] p-6 text-center text-sm text-[--kt-text-muted]">No versioned retention policies have been recorded.</p> : policies.map((policy) => {
          const scheduled = policy.status === "ACTIVE" && policy.effectiveAt && Date.parse(policy.effectiveAt) > Date.parse(evaluatedAt);
          const canActivate = canManage && policy.status === "DRAFT" && policy.legalReviewStatus === "APPROVED" && !!policy.createdByUserId && !!policy.legalReviewedByUserId && policy.legalReviewedByUserId !== policy.createdByUserId && policy.legalReviewedByUserId !== actorUserId && !!policy.legalReviewReference && !!policy.legalReviewReason && !!policy.legalReviewedAt;
          const canStartReview = canReview && policy.status === "DRAFT" && policy.legalReviewStatus === "LEGAL_REVIEW_REQUIRED" && !!policy.createdByUserId && policy.createdByUserId !== actorUserId;
          return <article key={policy.id} className="space-y-4 rounded-xl border border-[--kt-border] bg-[--kt-surface] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-[--kt-text]">{policy.dataClass.replaceAll("_", " ")} · v{policy.version}</h3>
                <p className="mt-1 text-xs text-[--kt-text-muted]">{policy.publicReference} · {policy.action.replaceAll("_", " ")} after {policy.retentionDays ?? "—"} days</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-[--kt-surface-muted] px-3 py-1 text-[--kt-text]">{scheduled ? "SCHEDULED" : policy.status}</span>
                <span className="rounded-full bg-[--kt-surface-muted] px-3 py-1 text-[--kt-text]">Review: {policy.legalReviewStatus.replaceAll("_", " ")}</span>
              </div>
            </div>
            <dl className="grid gap-3 text-xs text-[--kt-text-muted] sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="font-semibold">Effective</dt><dd>{policy.effectiveAt ? formatDate(policy.effectiveAt) : "When activated"}</dd></div>
              <div><dt className="font-semibold">Created</dt><dd>{formatDate(policy.createdAt)}</dd></div>
              <div><dt className="font-semibold">Legal source</dt><dd>{policy.legalReviewReference ?? "Not reviewed"}</dd></div>
              <div><dt className="font-semibold">Independent reviewer</dt><dd>{policy.legalReviewedByUserId ?? "Not reviewed"}</dd></div>
            </dl>
            {policy.legalReviewReason && <p className="rounded-lg bg-[--kt-surface-muted] p-3 text-sm text-[--kt-text-muted]">Review note: {policy.legalReviewReason}</p>}

            {canStartReview && <div className="border-t border-[--kt-border] pt-4">
              {reviewTarget !== policy.publicReference ? <button type="button" className="rounded-lg border border-[--kt-border] px-3 py-2 text-sm text-[--kt-text]" onClick={() => setReviewTarget(policy.publicReference)}>Record independent review</button> : <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm text-[--kt-text-muted]"><span>Decision</span><select className={inputClass} value={decision} onChange={(event) => setDecision(event.target.value as Decision)}><option value="APPROVE">Approve against source</option><option value="REJECT">Reject this version</option></select></label>
                  <label className="space-y-1 text-sm text-[--kt-text-muted]"><span>Approved legal or owner source reference {decision === "APPROVE" ? "(required)" : "(optional)"}</span><input className={inputClass} value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} maxLength={160} placeholder="Document or decision reference" required={decision === "APPROVE"} /></label>
                </div>
                <label className="space-y-1 text-sm text-[--kt-text-muted]"><span>Review reason</span><textarea className={inputClass} value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} minLength={20} maxLength={512} rows={3} required placeholder="Explain the independent decision without including personal data." /></label>
                <label className="flex items-start gap-2 text-sm text-[--kt-text-muted]"><input className="mt-1" type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} /><span>I am authorized to review this policy, have checked this exact version against the referenced source, and am not its creator.</span></label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => reviewPolicy(policy.publicReference)} disabled={busy || !attested || reviewReason.trim().length < 20 || (decision === "APPROVE" && !sourceReference.trim())} className="rounded-lg bg-[--kt-brand-navy] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Recording…" : `Record ${decision.toLowerCase()}`}</button>
                  <button type="button" onClick={() => setReviewTarget(null)} disabled={busy} className="rounded-lg border border-[--kt-border] px-4 py-2 text-sm text-[--kt-text]">Cancel</button>
                </div>
              </div>}
            </div>}

            {canActivate && <div className="border-t border-[--kt-border] pt-4">
              <p className="mb-3 text-sm text-[--kt-text-muted]">Activation changes which version the retention worker may apply. Future dates remain scheduled. If a reviewed date passes before activation, create a new version instead of altering its review evidence.</p>
              <button type="button" onClick={() => activatePolicy(policy.publicReference)} disabled={busy} className="rounded-lg bg-[--kt-brand-navy] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Applying…" : "Activate or schedule reviewed version"}</button>
            </div>}
          </article>;
        })}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Invalid date" : date.toLocaleString();
}
