"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

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
} | null;

export function StoreCheckoutCertificationPanel({
  storeId, initial, initialNeedsRenewal = false,
}: { storeId: string; initial: Certification; initialNeedsRenewal?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialNeedsRenewal ? "RENEWAL_REQUIRED" : initial?.status ?? "NOT_SUBMITTED");
  const [revision, setRevision] = useState(initial?.revision ?? 0);
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

  async function submit(action: "prepare" | "approve") {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: action === "prepare" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "prepare" ? data : { expectedRevision: revision }),
      });
      const payload = await response.json();
      if (!response.ok) throw Error(payload.error ?? "Certification cannot proceed.");
      // The server's status is authoritative. No client-side promotion to Live.
      setStatus(payload.status);
      setRevision(payload.revision);
      setNotice(action === "prepare"
        ? "Evidence recorded. A different authorized administrator must independently inspect and approve it."
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
        This approval must reference actual isolated-staging route evidence and a completed,
        verified payment/order receipt for this store. Document the destination and courier service.
        Never use an unapproved real-money charge to create test evidence.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div><dt>Certification status</dt><dd className="font-bold">{status.replaceAll("_", " ")}</dd></div>
        <div><dt>Revision</dt><dd>{revision}</dd></div>
        {initial?.routeEvidenceReference ? <div><dt>Route receipt</dt><dd className="break-all">{initial.routeEvidenceReference}</dd>
          <dd className="break-all text-xs">SHA-256: {initial.routeEvidenceDigest ?? "Legacy receipt without retained digest"}</dd></div> : null}
        {initial?.checkoutEvidenceReference ? <div><dt>Checkout receipt</dt><dd className="break-all">{initial.checkoutEvidenceReference}</dd>
          <dd className="break-all text-xs">SHA-256: {initial.checkoutEvidenceDigest ?? "Legacy receipt without retained digest"}</dd></div> : null}
        {initial?.expiresAt ? <div><dt>Valid until</dt><dd>{new Date(initial.expiresAt).toLocaleDateString("en-ZA")}</dd></div> : null}
      </dl>
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
          <Button type="submit" disabled={busy} loading={busy}>Submit staging certification for independent review</Button>
        </form>
      ) : null}
      {status === "PENDING_REVIEW" ? (
        <Button type="button" variant="secondary" disabled={busy} loading={busy} onClick={() => void submit("approve")}>
          Approve independently reviewed staging evidence
        </Button>
      ) : null}
      {error && <p role="alert" className="text-sm font-semibold text-[var(--kt-red)]">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </div>
  );
}
