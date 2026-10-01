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
          : "Deposit submitted. Cash remains in your custody until KT verifies receipt.",
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
    <div className="space-y-8">
      <dl className="grid gap-5 sm:grid-cols-3">
        {Object.entries({
          "Cash collected": summary.totals.collected,
          "Cash remitted": summary.totals.remitted,
          "Cash in your custody": summary.totals.held,
        }).map(([label, amount]) => (
          <div key={label}>
            <dt className="text-sm text-[var(--eo-text-muted)]">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold">R {amount}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-3">
        <h2 className="font-semibold">Deposit instructions</h2>
        {bank ? (
          <>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries({
                Bank: bank.bankName,
                "Account holder": bank.accountName,
                "Account number": bank.accountNumber,
                "Branch code": bank.branchCode,
              }).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[var(--eo-text-muted)]">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p>{bank.referenceHint}</p>
            <p className="text-sm">
              Submit the exact deposited amount and bank reference. KT confirms
              receipt before your cash balance changes.
            </p>
          </>
        ) : (
          <p>
            KT has not configured bank deposit instructions yet. Contact support
            before transferring cash.
          </p>
        )}
      </section>
      <section className="space-y-5">
        <h2 className="font-semibold">Delivery cash records</h2>
        {summary.orders.length ? (
          summary.orders.map((order) => (
            <article
              key={order.orderId}
              className="space-y-4 border-b border-[var(--eo-border)] pb-5"
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
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void send(`deposit:${order.orderId}`, "/api/driver/cash", {
                      orderId: order.orderId,
                      amount: order.cashCollected,
                      bankReference: String(data.get("bankReference") ?? ""),
                    });
                  }}
                >
                  <div className="min-w-60 flex-1">
                    <Label htmlFor={`bank-${order.orderId}`}>
                      Bank deposit reference
                    </Label>
                    <Input
                      id={`bank-${order.orderId}`}
                      name="bankReference"
                      required
                      minLength={4}
                      maxLength={120}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={busy !== null}
                    loading={busy === `deposit:${order.orderId}`}
                  >
                    Submit R {order.cashCollected} deposit
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
                {d.bankReference} ·{" "}
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
