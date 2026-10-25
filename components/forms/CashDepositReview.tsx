"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type {
  listCashDeposits,
  readBankInstructions,
} from "@/lib/client-platform/driver-cash.service";
type Deposit = Awaited<ReturnType<typeof listCashDeposits>>[number];
type Bank = Awaited<ReturnType<typeof readBankInstructions>>;
export function CashDepositReview({
  deposits,
  bank,
}: {
  deposits: Deposit[];
  bank: Bank;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function send(key: string, url: string, payload: unknown) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await r.json();
      if (!r.ok)
        throw Error(b.error ?? "The operation could not be completed.");
      setNotice(key === "bank" ? "Bank details saved and shared with active drivers. Cash policies must be reapproved after changes." : "Cash review recorded and reconciled where applicable.");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The operation could not be completed.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--kt-border)] pb-5">
          <div><h2 className="text-xl font-semibold tracking-tight text-[var(--kt-brand-navy)]">KT Couriers banking details</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--kt-text-soft)]">Manage the official account securely shared with active drivers in their Cash collections dashboard. Saving changes creates an audit entry and requires renewed independent COD policy approval.</p></div>
          <span className="rounded-full border border-[var(--kt-border)] bg-white px-4 py-2 text-xs font-semibold">{bank ? `Configured · version ${bank.expectedVersion}` : "Not configured"}</span>
        </div>
        <p className="text-sm">
          Enter the verified business bank account drivers should use. Changes
          are recorded in the activity log.
        </p>
        <form
          className="grid gap-5 rounded-xl border border-[var(--kt-border)] bg-white p-5 sm:grid-cols-2 sm:p-7"
          key={bank?.expectedVersion ?? 0}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void send("bank", "/api/admin/cash-deposit-bank", {
              bankName: f.get("bankName"),
              accountName: f.get("accountName"),
              accountNumber: f.get("accountNumber"),
              branchCode: f.get("branchCode"),
              referenceHint: f.get("referenceHint"),
              handoverEnabled: f.get("handoverEnabled") === "yes",
              expectedVersion: bank?.expectedVersion ?? 0,
            });
          }}
        >
          {(
            [
              ["bankName", "Bank", bank?.bankName],
              ["accountName", "Account holder", bank?.accountName],
              ["accountNumber", "Account number", bank?.accountNumber],
              ["branchCode", "Branch code", bank?.branchCode],
              [
                "referenceHint",
                "Deposit reference instructions",
                bank?.referenceHint,
              ],
            ] as const
          ).map(([name, label, value]) => (
            <div key={name}>
              <Label htmlFor={name}>{label}</Label>
              <Input
                id={name}
                name={name}
                defaultValue={value ?? ""}
                required
                maxLength={
                  name === "accountNumber"
                    ? 30
                    : name === "branchCode"
                      ? 12
                      : 150
                }
                pattern={
                  name === "accountNumber"
                    ? "[0-9]{6,30}"
                    : name === "branchCode"
                      ? "[0-9]{4,12}"
                      : undefined
                }
              />
            </div>
          ))}
          <div className="sm:col-span-2 space-y-5 border-t border-[var(--kt-border)] pt-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[var(--kt-surface-muted)] p-4 text-sm"><input type="checkbox" name="handoverEnabled" value="yes" defaultChecked={bank?.handoverEnabled ?? false} className="mt-1 h-4 w-4 accent-[var(--kt-brand-blue)]"/><span><strong className="block text-[var(--kt-brand-navy)]">Allow physical cash handover to KT Couriers</strong><span className="mt-1 block leading-6 text-[var(--kt-text-soft)]">Let drivers request direct cash handover to an authorised administrator. Only actual counted and verified cash clears their custody; scheduling or requesting a handover does not.</span></span></label>
            <Button
              type="submit"
              disabled={busy !== null}
              loading={busy === "bank"}
            >
              Save and share instructions
            </Button>
          </div>
        </form>
      </section>
      <section className="space-y-6">
        <div className="border-b border-[var(--kt-border)] pb-4"><h2 className="text-xl font-semibold text-[var(--kt-brand-navy)]">Driver cash remittances</h2><p className="mt-1 text-sm text-[var(--kt-text-soft)]">Confirm cleared bank deposits or cash physically counted and received in person.</p></div>
        {deposits.length ? (
          deposits.map((d) => (
            <article
              key={d.id}
              className="space-y-4 rounded-xl border border-[var(--kt-border)] bg-white p-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="font-medium">
                  {d.driverName} · {d.orderNumber}
                </h3>
                <p>{d.status.replaceAll("_", " ")}</p>
              </div>
              <p>
                <strong className="text-lg">R {d.amount}</strong> · {d.remittanceMethod === "IN_PERSON" ? "In-person cash handover" : "Bank deposit"} · Reference: {d.bankReference}
              </p>
              <time className="text-sm" dateTime={d.createdAt}>
                {new Date(d.createdAt).toLocaleString()}
              </time>
              {d.note && <p>{d.note}</p>}
              {["PENDING", "PROCESSING"].includes(d.status) && (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const native = e.nativeEvent as SubmitEvent;
                    const decision = (native.submitter as HTMLButtonElement)
                      ?.value;
                    if (decision !== "CONFIRM" && decision !== "REJECT") return;
                    void send(d.id, `/api/admin/cash-deposits/${d.id}/review`, {
                      decision,
                      note: f.get("note"),
                      bankReceiptVerified: d.remittanceMethod !== "IN_PERSON" && f.get("verified") === "on",
                      handoverReceived: d.remittanceMethod === "IN_PERSON" && f.get("verified") === "on",
                    });
                  }}
                >
                  <Label htmlFor={`note-${d.id}`}>
                    Verification or rejection note
                  </Label>
                  <Input
                    id={`note-${d.id}`}
                    name="note"
                    required
                    minLength={10}
                    maxLength={500}
                  />
                  <label className="flex gap-3 items-start text-sm">
                    <input name="verified" type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--kt-brand-blue)]" />
                    <span>{d.remittanceMethod === "IN_PERSON"
                      ? `I personally received and counted R ${d.amount} cash from this driver and recorded the actual handover.`
                      : `I independently verified R ${d.amount} cleared into the KT Couriers bank account against this reference.`}</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="submit"
                      name="decision"
                      value="CONFIRM"
                      disabled={busy !== null}
                      loading={busy === d.id}
                    >
                      Confirm receipt
                    </Button>
                    {d.status === "PENDING" && (
                      <Button
                        variant="secondary"
                        type="submit"
                        name="decision"
                        value="REJECT"
                        disabled={busy !== null}
                      >
                        Reject evidence
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--kt-border)] p-8 text-center text-sm text-[var(--kt-text-soft)]">No bank deposits or cash handovers submitted yet.</p>
        )}
      </section>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
