"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { driverCashSummary } from "@/lib/client-platform/driver-cash.service";
type Summary = Awaited<ReturnType<typeof driverCashSummary>>;
export function DriverCash({ summary }: { summary: Summary }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const operations = useRef(new Map<string, { payload: string; id: string }>());
  const [remittanceChoice, setRemittanceChoice] = useState<Record<string, "BANK_DEPOSIT" | "IN_PERSON">>({});
  const [copied, setCopied] = useState("");
  async function send(
    key: string,
    url: string,
    payload: Record<string, string>,
  ) {
    setBusy(key);
    setError("");
    setNotice("");
    const encoded = JSON.stringify(payload);
    let op = operations.current.get(key);
    if (!op || op.payload !== encoded) {
      op = { payload: encoded, id: crypto.randomUUID() };
      operations.current.set(key, op);
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, operationId: op.id }),
      });
      const body = await response.json();
      if (!response.ok)
        throw Error(body.error ?? "The cash operation could not be saved.");
      operations.current.delete(key);
      setNotice(
        key.startsWith("collect")
          ? "Cash collection recorded."
          : payload.remittanceMethod === "IN_PERSON"
            ? "Cash handover requested. The cash remains your responsibility until KT Couriers confirms it was physically received."
            : "Deposit submitted. Cash remains in your custody until KT verifies bank receipt.",
      );
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The cash operation could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  }
  const bank = summary.bankInstructions;
  return (
    <div className="space-y-9">
      <dl className="grid gap-3 sm:grid-cols-3">
        {Object.entries({
          "Cash collected": summary.totals.collected,
          "Cash remitted": summary.totals.remitted,
          "Cash in your custody": summary.totals.held,
        }).map(([label, amount]) => (
          <div key={label} className="rounded-xl border border-[var(--kt-border)] bg-white p-5">
            <dt className="text-sm text-[var(--kt-text-soft)]">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold tracking-tight text-[var(--kt-brand-navy)]">R {amount}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-[var(--kt-brand-navy)]">Return collected cash to KT Couriers</h2>
        {bank ? (
          <div className="space-y-5 rounded-xl border border-[var(--kt-border)] bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-[var(--kt-brand-navy)]">Official KT Couriers banking details</p><p className="text-sm text-[var(--kt-text-soft)]">Secure instructions · version {bank.expectedVersion}</p></div><Button type="button" variant="secondary" size="sm" onClick={() => { void navigator.clipboard.writeText([bank.bankName, bank.accountName, bank.accountNumber, bank.branchCode, bank.referenceHint].join("\n")).then(() => setCopied("Bank details copied"), () => setCopied("Copy failed — please use the details below")); }}>Copy bank details</Button></div>
            {copied && <p role="status" className="text-sm">{copied}</p>}
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {Object.entries({
                Bank: bank.bankName,
                "Account holder": bank.accountName,
                "Account number": bank.accountNumber,
                "Branch code": bank.branchCode,
              }).map(([label, value]) => (
                <div key={label} className="border-b border-[var(--kt-border)] pb-3">
                  <dt className="text-[var(--kt-text-soft)]">{label}</dt>
                  <dd className="mt-1 break-all font-semibold text-[var(--kt-brand-navy)]">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="rounded-lg bg-[var(--kt-surface-muted)] p-4 text-sm"><strong>Deposit reference instructions:</strong> {bank.referenceHint}</div>
            <p className="text-sm leading-6 text-[var(--kt-text-soft)]">Submit the exact deposited amount and real bank reference. KT Couriers must confirm receipt before your cash custody decreases.</p>
            {summary.handoverEnabled && <p className="rounded-lg border border-[var(--kt-border)] p-4 text-sm leading-6"><strong>Prefer to return cash directly?</strong> Select in-person handover on a cash order below. The administrator must physically count and confirm it.</p>}
          </div>
        ) : (
          <p>
            KT has not configured bank deposit instructions yet. Contact support
            before transferring cash.
          </p>
        )}
      </section>
      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-[var(--kt-brand-navy)]">Delivery cash records</h2>
        {summary.hasMoreActionableOrders && <p role="status" className="rounded-lg border border-[var(--kt-border)] bg-[var(--kt-surface-muted)] p-4 text-sm leading-6">More than 100 cash-collection actions require attention. This screen shows the oldest outstanding actions first alongside recent orders. Complete or reconcile these records to reveal the remaining backlog. The cash totals above cover your full account, not just visible rows.</p>}
        {summary.orders.length ? (
          summary.orders.map((order) => (
            <article
              key={order.orderId}
              className="space-y-5 rounded-xl border border-[var(--kt-border)] bg-white p-5 sm:p-6"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="font-medium">{order.orderNumber}</h3>
                <p className="text-sm">{order.status.replaceAll("_", " ")}</p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-4">
                {Object.entries({
                  "Delivery total": order.total,
                  "Online paid": order.digitalPaid,
                  "Cash required": order.cashRequired,
                  "Cash deposited": order.cashDeposited,
                }).map(([label, amount]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd className="mt-1 font-medium">R {amount}</dd>
                  </div>
                ))}
              </dl>
              {order.canCollect && (
                <Button
                  disabled={busy !== null}
                  loading={busy === `collect:${order.orderId}`}
                  onClick={() =>
                    void send(
                      `collect:${order.orderId}`,
                      `/api/driver/orders/${order.orderId}/cod/collection`,
                      { amount: order.cashRequired },
                    )
                  }
                >
                  I received R {order.cashRequired} in cash
                </Button>
              )}
              {order.canDeposit && bank && (
                <form
                  className="space-y-4 rounded-lg bg-[var(--kt-surface-muted)] p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void send(`deposit:${order.orderId}`, "/api/driver/cash", {
                      orderId: order.orderId,
                      amount: order.cashCollected,
                      bankReference: String(data.get("bankReference") ?? ""),
                      remittanceMethod: remittanceChoice[order.orderId] ?? "BANK_DEPOSIT",
                    });
                  }}
                >
                  <fieldset className="space-y-2"><legend className="text-sm font-semibold text-[var(--kt-brand-navy)]">How will you return this cash?</legend><div className="flex flex-wrap gap-3">
                    {(["BANK_DEPOSIT", ...(summary.handoverEnabled ? ["IN_PERSON"] : [])] as Array<"BANK_DEPOSIT" | "IN_PERSON">).map((method) => (
                      <label key={method} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--kt-border)] bg-white px-4 py-3 text-sm font-medium">
                        <input type="radio" name={`remittance-${order.orderId}`} checked={(remittanceChoice[order.orderId] ?? "BANK_DEPOSIT") === method} onChange={() => setRemittanceChoice((current) => ({ ...current, [order.orderId]: method }))}/>{method === "IN_PERSON" ? "Hand cash directly to KT" : "Bank deposit"}
                      </label>
                    ))}
                  </div></fieldset>
                  <div className="max-w-xl">
                    <Label htmlFor={`bank-${order.orderId}`}>
                      {(remittanceChoice[order.orderId] ?? "BANK_DEPOSIT") === "IN_PERSON" ? "Cash handover reference" : "Bank deposit reference"}
                    </Label>
                    <Input
                      id={`bank-${order.orderId}`}
                      name="bankReference"
                      required
                      minLength={4}
                      maxLength={120}
                    />
                  </div>
                  <p className="text-sm leading-6 text-[var(--kt-text-soft)]">{(remittanceChoice[order.orderId] ?? "BANK_DEPOSIT") === "IN_PERSON" ? "Enter an agreed handover reference. Your cash remains in custody until an authorised administrator physically receives and confirms it." : "Use the real bank transaction reference. Your cash remains in custody until KT Couriers verifies bank receipt."}</p>
                  <Button type="submit" disabled={busy !== null} loading={busy === `deposit:${order.orderId}`}>
                    {(remittanceChoice[order.orderId] ?? "BANK_DEPOSIT") === "IN_PERSON" ? `Request handover of R ${order.cashCollected}` : `Submit R ${order.cashCollected} deposit`}
                  </Button>
                </form>
              )}
            </article>
          ))
        ) : (
          <p>No cash collection obligations yet.</p>
        )}
      </section>
      <section className="space-y-4">
        <h2 className="font-semibold">Deposit history</h2>
        {summary.deposits.length ? (
          summary.deposits.map((d) => (
            <article
              key={d.id}
              className="border-b border-[var(--eo-border)] pb-3"
            >
              <p className="font-medium">
                R {d.amount} · {d.status.replaceAll("_", " ")}
              </p>
              <p className="text-sm">
                {d.remittanceMethod === "IN_PERSON" ? "In-person handover" : "Bank deposit"} · {d.bankReference} ·{" "}
                <time dateTime={d.createdAt}>
                  {new Date(d.createdAt).toLocaleDateString()}
                </time>
              </p>
              {d.reviewNote && <p className="mt-2 text-sm">{d.reviewNote}</p>}
            </article>
          ))
        ) : (
          <p>No deposits submitted yet.</p>
        )}
      </section>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
