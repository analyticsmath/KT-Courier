"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ConfirmedGrant = Readonly<{
  journalReference: string;
  amount: string;
  availableBalanceAfter: string;
  status: "CREDITED" | "REPLAYED";
}>;

/** Grants remain platform-funded, nonwithdrawable and audit-logged. The
 * client cannot decide whether funds were posted; only the server receipt can.
 */
export function AdminCustomerWalletGrantForm({ customerUserId }: { customerUserId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("50.00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ConfirmedGrant | null>(null);
  const operation = useRef<{ fingerprint: string; id: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const payload = { amount, reason: reason.trim() };
    const fingerprint = JSON.stringify(payload);
    if (!operation.current || operation.current.fingerprint !== fingerprint) {
      operation.current = { fingerprint, id: crypto.randomUUID() };
    }
    const operationId = operation.current.id;
    setBusy(true);
    setError("");
    setReceipt(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(customerUserId)}/wallet-credit`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, operationId }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data &&
          typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : "Wallet credit could not be confirmed. Retry without changing the grant details.";
        throw new Error(message);
      }
      const credit = data && typeof data === "object" && "credit" in data
        ? (data as { credit: unknown }).credit
        : null;
      if (!credit || typeof credit !== "object" ||
          !("journalReference" in credit) || typeof credit.journalReference !== "string" ||
          !("amount" in credit) || typeof credit.amount !== "string" ||
          !("availableBalanceAfter" in credit) || typeof credit.availableBalanceAfter !== "string" ||
          !("status" in credit) || !["CREDITED", "REPLAYED"].includes(String(credit.status))) {
        throw new Error("Wallet credit receipt was not confirmed. Retry with the same details.");
      }
      operation.current = null;
      setReceipt(credit as ConfirmedGrant);
      router.refresh();
    } catch (cause) {
      // A lost network response is an unknown financial outcome. Preserving
      // operationId ensures retry cannot create a second R50 credit.
      setError(cause instanceof Error ? cause.message : "Wallet credit could not be confirmed. Retry with the same details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={event => void submit(event)} className="space-y-5" aria-label="Superuser-funded customer wallet grant">
      <p className="text-sm leading-6 text-[var(--kt-text-soft)]">
        This is a platform-funded marketing credit, not a bank deposit or refund. It increases the customer&apos;s
        nonwithdrawable wallet balance. The ledger records the amount, owner and audit reason.
        Wallet spending remains disabled until checkout authorization is certified.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="wallet-grant-amount" className="mb-2 block text-sm font-semibold">Amount (ZAR)</label>
          <input id="wallet-grant-amount" name="amount" type="number" inputMode="decimal"
            min="0.01" max="5000" step="0.01" required value={amount}
            onChange={event => setAmount(event.target.value)}
            className="w-full rounded-lg border border-[var(--kt-border)] bg-white p-3 text-sm"/>
        </div>
        <div>
          <label htmlFor="wallet-grant-reason" className="mb-2 block text-sm font-semibold">Financial audit reason</label>
          <textarea id="wallet-grant-reason" name="reason" required minLength={12} maxLength={220}
            rows={3} value={reason} onChange={event => setReason(event.target.value)}
            placeholder="Explain why this customer receives a platform-funded credit"
            className="w-full rounded-lg border border-[var(--kt-border)] bg-white p-3 text-sm"/>
        </div>
      </div>
      <button type="submit" disabled={busy || reason.trim().length < 12}
        className="min-h-11 rounded-lg bg-[var(--kt-brand-navy)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Confirming credit…" : "Confirm and credit wallet"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {receipt && <p role="status" aria-live="polite" className="text-sm font-semibold">
        {receipt.status === "REPLAYED" ? "Previously confirmed" : "Credited"} R{receipt.amount}.
        Wallet balance: R{receipt.availableBalanceAfter}. Audit journal: {receipt.journalReference}.
      </p>}
    </form>
  );
}
