"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

type StageResult = {
  stage: string;
  passed: boolean;
  summary: string;
  durationMs: number;
};

type Certification = {
  status: string;
  revision: number;
  preparedAt: Date | string;
  approvedAt: Date | string | null;
  expiresAt: Date | string;
  preparedByUserId: string;
  approvedByUserId: string | null;
  routeEvidenceReference: string;
  routeEvidenceDigest: string | null;
  checkoutEvidenceReference: string;
  checkoutEvidenceDigest: string | null;
  evidenceType?: string | null;
  engineProofReference?: string | null;
  engineProofDigest?: string | null;
  engineProofSuiteSha?: string | null;
  policyFingerprint?: string | null;
  sourceCommerceReadinessRevision?: number | null;
  globalPolicyRevision?: number | null;
  proofOfferReference?: string | null;
  proofPriceVersionReference?: string | null;
  stageResults?: unknown;
} | null;

function normalizeStages(value: unknown): StageResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is StageResult =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as StageResult).stage === "string" &&
      typeof (item as StageResult).passed === "boolean" &&
      typeof (item as StageResult).summary === "string",
  );
}

export function StoreCheckoutCertificationPanel({
  storeId, initial, initialNeedsRenewal = false, currentAdminUserId,
}: { storeId: string; initial: Certification; initialNeedsRenewal?: boolean; currentAdminUserId?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialNeedsRenewal ? "RENEWAL_REQUIRED" : initial?.status ?? "NOT_SUBMITTED");
  const [revision, setRevision] = useState(initial?.revision ?? 0);
  const [evidenceType, setEvidenceType] = useState(initial?.evidenceType ?? null);
  const [engineProofRef, setEngineProofRef] = useState(initial?.engineProofReference ?? null);
  const [engineProofDigest, setEngineProofDigest] = useState(initial?.engineProofDigest ?? null);
  const [engineProofSuiteSha, setEngineProofSuiteSha] = useState(initial?.engineProofSuiteSha ?? null);
  const [proofOfferRef, setProofOfferRef] = useState(initial?.proofOfferReference ?? null);
  const [proofPriceRef, setProofPriceRef] = useState(initial?.proofPriceVersionReference ?? null);
  const [stages, setStages] = useState<StageResult[]>(normalizeStages(initial?.stageResults));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState({
    routeEvidenceReference: "",
    routeEvidenceDigest: "",
    checkoutEvidenceReference: "",
    checkoutEvidenceDigest: "",
    reviewNote: "",
  });
  const endpoint = "/api/admin/stores/" + encodeURIComponent(storeId) + "/checkout-certification";

  async function submit(action: "prepare" | "prepare_preflight" | "approve") {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: action === "approve" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "prepare"
            ? data
            : action === "prepare_preflight"
              ? { mode: "PREFLIGHT", ...(data.reviewNote.trim().length >= 24 ? { reviewNote: data.reviewNote.trim() } : {}) }
              : { expectedRevision: revision },
        ),
      });
      const payload = await response.json();
      if (!response.ok) throw Error(payload.error ?? "Certification cannot proceed.");
      // The server's status is authoritative. No client-side promotion to Live.
      setStatus(payload.status);
      setRevision(payload.revision);
      if (payload.engineProof) {
        setEvidenceType(payload.evidenceType ?? "REAL_STORE_CATALOG_CHECKOUT_CAPABILITY_PROOF");
        setEngineProofRef(payload.engineProof.engineProofReference ?? null);
        setEngineProofDigest(payload.engineProof.engineProofDigest ?? null);
        setEngineProofSuiteSha(payload.engineProof.suiteSha ?? null);
        setProofOfferRef(payload.proofOfferReference ?? payload.engineProof.proofOfferReference ?? null);
        setProofPriceRef(payload.proofPriceVersionReference ?? payload.engineProof.proofPriceVersionReference ?? null);
        setStages(normalizeStages(payload.engineProof.stageResults));
      } else if (action === "prepare") {
        setEvidenceType("CONFIGURATION_CAPABILITY_PREFLIGHT");
        setEngineProofRef(null);
        setEngineProofDigest(null);
        setEngineProofSuiteSha(null);
        setProofOfferRef(null);
        setProofPriceRef(null);
        setStages([]);
      }
      setNotice(action === "prepare"
        ? "Manual evidence recorded for reference only. Run the real-source checkout capability proof before requesting approval."
        : action === "prepare_preflight"
          ? "Capability proof recorded. A different authorized administrator must independently inspect and approve it."
          : "Independent certification approved. Store activation remains a separate authorized action.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update certification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6">
        Once the store is ready, run the real-source checkout capability proof below. It checks
        the store’s current configuration and eligible offer without retaining a test order.
        A different authorized administrator then reviews and approves the proof. This capability
        check is not a real payment or a completed delivery.
      </p>
      <p className="text-sm leading-6">
        The manual staging evidence fields are optional reference material and cannot by themselves
        be approved for a live storefront. Never use an unapproved real-money charge as test evidence.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div><dt>Certification status</dt><dd className="font-bold">{status.replaceAll("_", " ")}</dd></div>
        <div><dt>Revision</dt><dd>{revision}</dd></div>
        {evidenceType ? <div><dt>Trusted provenance</dt><dd className="font-semibold">{evidenceType.replaceAll("_", " ")}</dd></div> : null}
        {engineProofRef ? (
          <div>
            <dt>Engine proof receipt</dt>
            <dd className="break-all font-mono text-xs">{engineProofRef}</dd>
            {engineProofDigest ? <dd className="break-all text-xs">Digest: {engineProofDigest.slice(0, 24)}…</dd> : null}
            {engineProofSuiteSha ? <dd className="break-all text-xs">Suite SHA: {engineProofSuiteSha.slice(0, 16)}…</dd> : null}
            {proofOfferRef ? <dd className="break-all text-xs">Proof offer: {proofOfferRef}{proofPriceRef ? ` (${proofPriceRef})` : ""}</dd> : null}
          </div>
        ) : null}
        {initial?.routeEvidenceReference ? <div><dt>Route receipt</dt><dd className="break-all">{initial.routeEvidenceReference}</dd>
          <dd className="break-all text-xs">SHA-256: {initial.routeEvidenceDigest ?? "Legacy receipt without retained digest"}</dd></div> : null}
        {initial?.checkoutEvidenceReference ? <div><dt>Checkout receipt</dt><dd className="break-all">{initial.checkoutEvidenceReference}</dd>
          <dd className="break-all text-xs">SHA-256: {initial.checkoutEvidenceDigest ?? "Legacy receipt without retained digest"}</dd></div> : null}
        {initial?.expiresAt ? <div><dt>Valid until</dt><dd>{new Date(initial.expiresAt).toLocaleDateString("en-ZA")}</dd></div> : null}
      </dl>
      {stages.length > 0 ? (
        <div className="rounded-lg border border-slate-200 p-3 text-xs space-y-1.5" data-testid="engine-proof-stages">
          <p className="font-semibold text-sm">Disposable Checkout Engine Proof Stages</p>
          <ul className="space-y-1">
            {stages.map((stage) => (
              <li key={stage.stage} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className={stage.passed ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                    {stage.passed ? "PASS" : "FAIL"}
                  </span>{" "}
                  <span className="font-mono">{stage.stage}</span> — {stage.summary}
                </span>
                <span className="text-slate-500">{stage.durationMs}ms</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {status !== "APPROVED" ? (
        <form className="grid gap-4" onSubmit={e => { e.preventDefault(); void submit("prepare"); }}>
          <div>
            <Label htmlFor="cert-route-ref">Verified staging route reference</Label>
            <Input id="cert-route-ref" value={data.routeEvidenceReference} minLength={12} maxLength={160} required
              onChange={e => setData(previous => ({ ...previous, routeEvidenceReference: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="cert-route-digest">Route receipt SHA-256</Label>
            <Input id="cert-route-digest" value={data.routeEvidenceDigest} pattern="[a-f0-9]{64}" required maxLength={64}
              onChange={e => setData(previous => ({ ...previous, routeEvidenceDigest: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="cert-paid-ref">Verified staging paid checkout / order reference</Label>
            <Input id="cert-paid-ref" value={data.checkoutEvidenceReference} minLength={12} maxLength={160} required
              onChange={e => setData(previous => ({ ...previous, checkoutEvidenceReference: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="cert-paid-digest">Paid checkout receipt SHA-256</Label>
            <Input id="cert-paid-digest" value={data.checkoutEvidenceDigest} pattern="[a-f0-9]{64}" maxLength={64} required
              onChange={e => setData(previous => ({ ...previous, checkoutEvidenceDigest: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="cert-review-note">Staging route, payment, inventory and trading-hours review</Label>
            <textarea id="cert-review-note" value={data.reviewNote} minLength={24} maxLength={2000} required
              onChange={e => setData(previous => ({ ...previous, reviewNote: e.target.value }))}
              className="min-h-28 w-full rounded-xl border border-[var(--kt-border)] p-3 text-sm" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" disabled={busy} loading={busy} onClick={() => void submit("prepare_preflight")}>
              Run real-source checkout capability proof &amp; submit for review
            </Button>
            <Button type="submit" disabled={busy} loading={busy}>Submit manual route &amp; checkout certification for review</Button>
          </div>
        </form>
      ) : null}
      {status === "PENDING_REVIEW" && evidenceType !== "REAL_STORE_CATALOG_CHECKOUT_CAPABILITY_PROOF" ? (
        <p role="status" className="text-sm">This evidence cannot be approved for a live storefront. Run the real-source checkout capability proof and submit it for review.</p>
      ) : null}
      {status === "PENDING_REVIEW" && evidenceType === "REAL_STORE_CATALOG_CHECKOUT_CAPABILITY_PROOF" ? (
        <div className="space-y-2">
          {currentAdminUserId && initial?.preparedByUserId === currentAdminUserId ? (
            <p role="status" className="text-sm font-medium text-amber-800">
              You prepared this capability proof. Dual-control requires a different administrator (holding <code className="font-mono">stores.approve</code> and <code className="font-mono">orders.read</code>) to independently approve it.
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={busy || Boolean(currentAdminUserId && initial?.preparedByUserId === currentAdminUserId)}
            loading={busy}
            onClick={() => void submit("approve")}
          >
            Approve independently reviewed staging evidence
          </Button>
        </div>
      ) : null}
      {error && <p role="alert" className="text-sm font-semibold text-[var(--kt-red)]">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </div>
  );
}
