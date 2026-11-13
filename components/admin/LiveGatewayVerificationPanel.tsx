"use client";
import { useEffect, useState } from "react";

type Verification = {
  reference: string;
  status: string;
  amount: "1.00";
  currency: "ZAR";
  checkoutUrl: string | null;
  verifiedAt: string | null;
  failureCode: string | null;
};
type ApiResponse = { verification?: Verification; error?: string };

export function LiveGatewayVerificationPanel(props: { eligible: boolean; reason: string }) {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function check(reference: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        "/api/admin/payment-providers/live-verification?reference=" + encodeURIComponent(reference) + "&refresh=1",
        { cache: "no-store", credentials: "same-origin" },
      );
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.verification) throw new Error(data.error ?? "Could not verify payment.");
      setVerification(data.verification);
      setMessage(data.verification.status === "SUCCEEDED"
        ? "Success: Paystack confirms this exact R1.00 live transaction."
        : "No verified payment success yet. Do not attempt another charge while the outcome is uncertain.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment verification is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get("reference");
    if (!reference || !/^ktverify-[a-f0-9]{32}$/.test(reference)) return;
    const controller = new AbortController();
    // The callback is a network response, not a synchronous effect-state write.
    void fetch(
      "/api/admin/payment-providers/live-verification?reference=" + encodeURIComponent(reference) + "&refresh=1",
      { cache: "no-store", credentials: "same-origin", signal: controller.signal },
    ).then(async response => {
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.verification) throw new Error(data.error ?? "Could not verify payment.");
      return data.verification;
    }).then(result => {
      setVerification(result);
      setMessage(result.status === "SUCCEEDED"
        ? "Success: Paystack confirms this exact R1.00 live transaction."
        : "No verified payment success yet. Do not attempt another charge while the outcome is uncertain.");
    }).catch(error => {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Payment verification is unavailable.");
    });
    return () => controller.abort();
  }, []);

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/payment-providers/live-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ operationId: crypto.randomUUID() }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.verification) throw new Error(data.error ?? "Could not start live verification.");
      setVerification(data.verification);
      if (data.verification.checkoutUrl) {
        const url = new URL(data.verification.checkoutUrl);
        if (url.protocol !== "https:" || !["checkout.paystack.com", "standard.paystack.co"].includes(url.hostname)) {
          throw new Error("Paystack checkout URL validation failed.");
        }
        window.location.assign(url.toString());
      } else {
        setMessage("Verification is already in progress. Check its status before attempting another payment.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start live verification.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = !!verification && !["SUCCEEDED", "FAILED"].includes(verification.status);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Live gateway verification</h2>
          <p className="mt-1 text-sm text-slate-600">Fixed amount: <strong>R1.00 ZAR</strong>. No automatic repeat charges.</p>
        </div>
        <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (props.eligible ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900")}>
          {props.eligible ? "Live gateway configured" : "Live gateway unavailable"}
        </span>
      </div>
      {!props.eligible && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
        This configuration does not permit a real R1.00 verification charge. Reason: {props.reason}.
        No provider credentials or public-payment settings were changed.
      </p>}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !props.eligible || !!verification}
          onClick={() => void start()}
          className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Checking…" : "Start one R1.00 real payment"}
        </button>
        {verification && <button type="button" disabled={busy}
          onClick={() => void check(verification.reference)}
          className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
          Check with Paystack
        </button>}
        {verification?.checkoutUrl && waiting && <a href={verification.checkoutUrl}
          rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-4">
          Return to the existing Paystack checkout
        </a>}
      </div>
      {verification && <dl className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Reference</dt><dd className="break-all font-mono">{verification.reference}</dd></div>
        <div><dt className="text-slate-500">Amount</dt><dd className="font-semibold">R1.00 ZAR</dd></div>
        <div><dt className="text-slate-500">Provider verification status</dt><dd className="font-semibold">{verification.status}</dd></div>
        <div><dt className="text-slate-500">Verified at</dt><dd>{verification.verifiedAt ?? "Not verified"}</dd></div>
      </dl>}
      {message && <p role="status" aria-live="polite" className="mt-5 rounded-xl border border-slate-200 p-4 text-sm">{message}</p>}
    </section>
  );
}
