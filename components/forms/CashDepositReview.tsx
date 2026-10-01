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
      setNotice("Saved.");
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
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-semibold">KT bank deposit instructions</h2>
        <p className="text-sm">
          Enter the verified business bank account drivers should use. Changes
          are recorded in the activity log.
        </p>
        <form
          className="grid gap-4 sm:grid-cols-2"
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
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={busy !== null}
              loading={busy === "bank"}
            >
              Save instructions
            </Button>
          </div>
        </form>
      </section>
      <section className="space-y-6">
        <h2 className="font-semibold">Driver deposits</h2>
        {deposits.length ? (
          deposits.map((d) => (
            <article
              key={d.id}
              className="space-y-3 border-b border-[var(--eo-border)] pb-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="font-medium">
                  {d.driverName} · {d.orderNumber}
                </h3>
                <p>{d.status.replaceAll("_", " ")}</p>
              </div>
              <p>
                R {d.amount} · Bank reference: {d.bankReference}
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
                      bankReceiptVerified: f.get("verified") === "on",
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
                    <input name="verified" type="checkbox" className="mt-1" />I
                    verified that R {d.amount} was received in the KT bank
                    account with this reference.
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
          <p>No driver deposits submitted yet.</p>
        )}
      </section>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
