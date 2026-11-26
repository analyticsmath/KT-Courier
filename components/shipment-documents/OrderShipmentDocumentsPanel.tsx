"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { downloadAuthorizedPdfBlob } from "@/lib/shipment-documents/client-download";
import type { OrderDocumentAvailabilitySummary } from "@/lib/shipment-documents/service";
import type { TrackingGrantMetadataDto } from "@/lib/tracking/recipient-access.server";

interface OrderShipmentDocumentsPanelProps {
  orderId: string;
  orderNumber: string;
  viewerRole: "CUSTOMER" | "STORE" | "ADMIN" | "DRIVER";
  explicitStoreId?: string | null;
  availability: OrderDocumentAvailabilitySummary;
  initialGrants?: TrackingGrantMetadataDto[];
}

export function OrderShipmentDocumentsPanel({
  orderId,
  orderNumber,
  viewerRole,
  explicitStoreId,
  availability,
  initialGrants = [],
}: OrderShipmentDocumentsPanelProps) {
  const router = useRouter();
  const [grants, setGrants] = useState<TrackingGrantMetadataDto[]>(initialGrants);
  const [freshShareUrl, setFreshShareUrl] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const storeQuery = explicitStoreId ? `?storeId=${encodeURIComponent(explicitStoreId)}` : "";
  const storeInlineQuery = explicitStoreId
    ? `?disposition=inline&storeId=${encodeURIComponent(explicitStoreId)}`
    : "?disposition=inline";

  const waybillDownloadHref = `/api/orders/${encodeURIComponent(orderId)}/documents/waybill${storeQuery}`;
  const waybillPrintHref = `/api/orders/${encodeURIComponent(orderId)}/documents/waybill${storeInlineQuery}`;
  const podDownloadHref = `/api/orders/${encodeURIComponent(orderId)}/documents/pod${storeQuery}`;
  const podPrintHref = `/api/orders/${encodeURIComponent(orderId)}/documents/pod${storeInlineQuery}`;

  async function recoverDocument(type: "waybill" | "pod", allowSupersede = false) {
    setBusyAction(`recover-${type}`);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/documents/${type}/recover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(allowSupersede ? { allowSupersede: true } : {}),
            ...(explicitStoreId ? { storeId: explicitStoreId } : {}),
          }),
        },
      );
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        code?: string;
        actionHref?: string;
        document?: { documentRef: string; revision: number };
      } | null;

      if (!res.ok) {
        setErrorMessage(body?.error ?? "Unable to issue the requested document.");
        return;
      }

      setStatusMessage(
        `${type === "waybill" ? "Waybill" : "Proof of Delivery"} ${body?.document?.documentRef ?? ""} (Rev ${body?.document?.revision ?? 1}) ready.`,
      );
      router.refresh();
    } catch {
      setErrorMessage("Network interruption while issuing document. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function downloadPdf(kind: "waybill" | "pod", href: string, fileName: string) {
    setBusyAction(`download-${kind}`);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const outcome = await downloadAuthorizedPdfBlob(href, fileName);
      if (!outcome.ok) {
        setErrorMessage(
          outcome.code === "COMPANY_PROFILE_REQUIRED" && viewerRole === "ADMIN"
            ? `${outcome.message} Activate an issuer snapshot at Company Profile first.`
            : outcome.message,
        );
        return;
      }
      setStatusMessage(
        `${kind === "waybill" ? "Waybill" : "Proof of Delivery"} PDF downloaded${outcome.documentRef ? ` (${outcome.documentRef})` : ""}.`,
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function createTrackingLink() {
    setBusyAction("create-grant");
    setErrorMessage(null);
    setStatusMessage(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/tracking-grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ttlDays: 14,
          ...(explicitStoreId ? { storeId: explicitStoreId } : {}),
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        grant?: TrackingGrantMetadataDto;
        shareUrl?: string;
        error?: string;
      } | null;
      if (!res.ok || !body?.grant || !body?.shareUrl) {
        setErrorMessage(body?.error ?? "Could not create a recipient tracking link.");
        return;
      }
      setGrants((prev) => [body.grant!, ...prev]);
      setFreshShareUrl(body.shareUrl);
      setStatusMessage("Status-only recipient tracking link created. Copy and share it securely now.");
    } catch {
      setErrorMessage("Failed to create tracking link. Please retry.");
    } finally {
      setBusyAction(null);
    }
  }

  async function revokeGrant(grantId: string) {
    setBusyAction(`revoke-${grantId}`);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/tracking-grants`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grantId,
          ...(explicitStoreId ? { storeId: explicitStoreId } : {}),
        }),
      });
      const body = (await res.json().catch(() => null)) as { revoked?: boolean; error?: string } | null;
      if (!res.ok) {
        setErrorMessage(body?.error ?? "Unable to revoke tracking link.");
        return;
      }
      if (body?.revoked) {
        setGrants((prev) =>
          prev.map((g) =>
            g.id === grantId
              ? { ...g, active: false, revokedAtIso: new Date().toISOString() }
              : g,
          ),
        );
        setFreshShareUrl(null);
        setStatusMessage("Recipient tracking link revoked.");
      }
    } catch {
      setErrorMessage("Network error revoking tracking link.");
    } finally {
      setBusyAction(null);
    }
  }

  async function copyShareUrl() {
    if (!freshShareUrl || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(freshShareUrl);
    setCopied(true);
  }

  return (
    <section
      aria-label={`Official shipment documents and sharing for ${orderNumber}`}
      className="space-y-4 rounded-xl border border-[var(--kt-border,#dbe2ea)] bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--kt-ink-navy,#0f172a)]">
            Official Documents &amp; Recipient Tracking
          </h3>
          <p className="mt-0.5 text-sm text-[var(--kt-text-muted,#475569)]">
            A4 PDF waybills, official proof of delivery certificates, and privacy-scoped status links for{" "}
            <span className="font-mono font-semibold">{orderNumber}</span>.
          </p>
        </div>
      </div>

      {!availability.hasActiveCompanyProfile && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950"
        >
          <p className="font-semibold">Company issuer profile is not active yet.</p>
          <p className="mt-0.5">
            Official shipment PDFs require an active registered issuer snapshot before first issuance.
          </p>
          {viewerRole === "ADMIN" && (
            <Link
              href="/admin/company-profile"
              className="mt-2 inline-flex min-h-9 items-center rounded-md bg-amber-900 px-3 text-xs font-semibold text-white"
            >
              Configure Company Profile
            </Link>
          )}
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMessage}
        </p>
      )}
      {statusMessage && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {statusMessage}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Waybill Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900">Official Waybill (PDF)</h4>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {availability.waybill.issued
                ? `Issued · Rev ${availability.waybill.revision ?? 1}`
                : availability.waybill.eligible
                  ? "Ready to issue"
                  : "Not yet issued"}
            </span>
          </div>
          {availability.waybill.documentRef && (
            <p className="text-xs font-mono text-slate-600">{availability.waybill.documentRef}</p>
          )}
          {availability.waybill.eligible ? (
            <div className="flex flex-wrap gap-2">
              {availability.hasActiveCompanyProfile || availability.waybill.issued ? (
                <>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void downloadPdf(
                        "waybill",
                        waybillDownloadHref,
                        `KT-Couriers-Waybill-${orderNumber}.pdf`,
                      )
                    }
                    className="inline-flex min-h-10 items-center rounded-lg bg-[var(--kt-brand-blue,#1d4ed8)] px-3.5 text-xs font-bold text-white hover:opacity-95 disabled:opacity-60"
                  >
                    {busyAction === "download-waybill" ? "Downloading…" : "Download Waybill PDF"}
                  </button>
                  <a
                    href={waybillPrintHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Print / View A4 Waybill
                  </a>
                </>
              ) : null}
              {(viewerRole === "ADMIN" || ((viewerRole === "CUSTOMER" || viewerRole === "STORE") && !availability.waybill.issued)) && (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() =>
                    void recoverDocument("waybill", viewerRole === "ADMIN" && availability.waybill.issued)
                  }
                  className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  {busyAction === "recover-waybill"
                    ? "Issuing…"
                    : availability.waybill.issued
                      ? "Re-issue snapshot"
                      : "Issue Waybill"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              {availability.waybill.reasonUnavailable ?? "Available once booking payment clears."}
            </p>
          )}
        </div>

        {/* POD Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900">Proof of Delivery (POD PDF)</h4>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {availability.pod.issued
                ? `Issued · Rev ${availability.pod.revision ?? 1}`
                : availability.pod.eligible
                  ? "Ready to issue"
                  : "Awaiting delivery"}
            </span>
          </div>
          {availability.pod.proofMethod && (
            <p className="text-xs text-slate-700">
              Method:{" "}
              <span className="font-semibold">
                {availability.pod.proofMethod === "OTP"
                  ? "Verified recipient 6-digit OTP"
                  : availability.pod.proofMethod === "ADMIN_MANUAL"
                    ? "Manual confirmation by KT Couriers"
                    : availability.pod.proofMethod.replaceAll("_", " ")}
              </span>
            </p>
          )}
          {availability.pod.documentRef && (
            <p className="text-xs font-mono text-slate-600">{availability.pod.documentRef}</p>
          )}
          {availability.pod.eligible ? (
            <div className="flex flex-wrap gap-2">
              {availability.hasActiveCompanyProfile || availability.pod.issued ? (
                <>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void downloadPdf(
                        "pod",
                        podDownloadHref,
                        `KT-Couriers-POD-${orderNumber}.pdf`,
                      )
                    }
                    className="inline-flex min-h-10 items-center rounded-lg bg-[var(--kt-ink-navy,#0f172a)] px-3.5 text-xs font-bold text-white hover:opacity-95 disabled:opacity-60"
                  >
                    {busyAction === "download-pod" ? "Downloading…" : "Download POD PDF"}
                  </button>
                  <a
                    href={podPrintHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Print / View A4 POD
                  </a>
                </>
              ) : null}
              {(viewerRole === "ADMIN" || ((viewerRole === "CUSTOMER" || viewerRole === "STORE") && !availability.pod.issued)) && (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() =>
                    void recoverDocument("pod", viewerRole === "ADMIN" && availability.pod.issued)
                  }
                  className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  {busyAction === "recover-pod"
                    ? "Issuing…"
                    : availability.pod.issued
                      ? "Re-issue POD snapshot"
                      : "Recover / Issue POD"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              {availability.pod.reasonUnavailable ??
                "Available strictly after verified recipient OTP or authorised administrative completion."}
            </p>
          )}
        </div>
      </div>

      {/* Recipient status-only share links — never exposed to driver role */}
      {viewerRole !== "DRIVER" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Recipient Tracking Share Link (Status Only)
              </h4>
              <p className="text-xs text-slate-600">
                Share a revocable 14-day link showing parcel status &amp; general areas only (no street addresses, live GPS, money, OTPs, or PDFs).
              </p>
            </div>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void createTrackingLink()}
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {busyAction === "create-grant" ? "Creating link…" : "Create tracking link"}
            </button>
          </div>

          {freshShareUrl && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-950">
                Copy this tracking link now — for security, the full token is shown only once:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="flex-1 break-all rounded bg-white px-2.5 py-1.5 text-xs text-slate-900 border border-blue-100">
                  {freshShareUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void copyShareUrl()}
                  className="inline-flex min-h-9 items-center rounded bg-blue-700 px-3 text-xs font-semibold text-white"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          )}

          {grants.length > 0 && (
            <ul className="divide-y divide-slate-100 text-xs">
              {grants.map((grant) => (
                <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <span className="font-mono font-semibold text-slate-800">{grant.grantRef}</span>{" "}
                    <span className="text-slate-600">
                      · {grant.active ? `Active · expires ${grant.expiresAtSast}` : "Revoked / expired"}
                    </span>
                  </div>
                  {grant.active && (
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => void revokeGrant(grant.id)}
                      className="rounded border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      {busyAction === `revoke-${grant.id}` ? "Revoking…" : "Revoke"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
