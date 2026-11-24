"use client";

import { useEffect, useState } from "react";

type SandboxVerification = {
  reference: string;
  attemptReference: string;
  status: string;
  amount: string;
  currency: "ZAR";
  providerDomain: string | null;
  releaseSha: string;
  checkoutUrl: string | null;
  ledgerJournalId: string | null;
  providerReference: string | null;
  verifiedAt: string | null;
  failureCode: string | null;
  resultDigest: string | null;
};

type ApiResponse = { verification?: SandboxVerification; error?: string };

export function SandboxGatewayAcceptancePanel(props: { eligible: boolean; reason: string; releaseSha: string | null }) {
  const [verification, setVerification] = useState<SandboxVerification | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshStatus(reference: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/payment-providers/sandbox-acceptance?reference=${encodeURIComponent(reference)}&refresh=1`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.verification) throw new Error(data.error ?? "Could not inspect sandbox verification.");
      setVerification(data.verification);
      setMessage(
        data.verification.status === "SUCCEEDED"
          ? "Verified: Paystack test transaction settled into isolated sandbox ledger and bound to server release provenance."
          : "Pending confirmation. Re-check status after completing Paystack test checkout.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sandbox status lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get("reference");
    if (!reference || !/^pay_sbox_[a-f0-9]{24}$/.test(reference)) return;
    const controller = new AbortController();
    void fetch(
      `/api/admin/payment-providers/sandbox-acceptance?reference=${encodeURIComponent(reference)}&refresh=1`,
      { cache: "no-store", credentials: "same-origin", signal: controller.signal },
    )
      .then(async (response) => {
        const data = (await response.json()) as ApiResponse;
        if (!response.ok || !data.verification) throw new Error(data.error ?? "Could not inspect sandbox verification.");
        return data.verification;
      })
      .then((result) => {
        setVerification(result);
        setMessage(
          result.status === "SUCCEEDED"
            ? "Verified: Paystack test transaction settled into isolated sandbox ledger and bound to server release provenance."
            : "Pending confirmation. Re-check status after completing Paystack test checkout.",
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setMessage(error instanceof Error ? error.message : "Sandbox status lookup failed.");
        }
      });
    return () => controller.abort();
  }, []);

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/payment-providers/sandbox-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ operationId: crypto.randomUUID() }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.verification) throw new Error(data.error ?? "Unable to start sandbox verification.");
      setVerification(data.verification);
      if (data.verification.checkoutUrl) {
        const url = new URL(data.verification.checkoutUrl);
        if (url.protocol !== "https:" || !["checkout.paystack.com", "standard.paystack.co"].includes(url.hostname)) {
          throw new Error("Paystack checkout URL validation failed.");
        }
        window.location.assign(url.toString());
      } else {
        setMessage("An active sandbox verification exists for this release. Refresh status below.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start sandbox verification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Isolated Paystack sandbox verification</h2>
          <p className="mt-1 text-sm text-slate-600">
            Bound release SHA: <code className="font-mono">{props.releaseSha ?? "Unavailable"}</code> · Fixed test amount: <strong>R10.00 ZAR</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={!props.eligible || busy}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Processing..." : "Start isolated sandbox payment"}
        </button>
      </div>
      {!props.eligible && (
        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          Lane inactive: <code className="font-mono">{props.reason}</code>
        </p>
      )}
      {message && <p className="text-sm text-slate-800">{message}</p>}
      {verification && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono space-y-1">
          <div>Reference: {verification.reference}</div>
          <div>Status: {verification.status} ({verification.providerDomain ?? "pending"})</div>
          <div>Release SHA: {verification.releaseSha}</div>
          <div>Journal ID: {verification.ledgerJournalId ?? "pending"}</div>
          <div>Provenance Digest: {verification.resultDigest ?? "pending"}</div>
          {verification.status !== "SUCCEEDED" && verification.status !== "FAILED" && (
            <button
              type="button"
              onClick={() => void refreshStatus(verification.reference)}
              disabled={busy}
              className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1 font-sans text-xs font-semibold text-slate-900"
            >
              Verify with Paystack
            </button>
          )}
        </div>
      )}
    </section>
  );
}
