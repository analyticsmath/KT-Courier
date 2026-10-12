import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect } from "@playwright/test";
import { assertDisposablePaystackAcceptance } from "../../../lib/testing/disposable-paystack-policy";
const execute = promisify(execFile);
export type RefundJournal = { id: string; type: string; currency: string; totalDebits: string; totalCredits: string; entries: Array<{ direction: string; amount: string }> };
export type RefundSnapshot = {
  result: { reference: string } | null;
  payment: { amount: string; reserved: string; refunded: string; status: string };
  accounts: Array<{ purpose: string; balance: string }>;
  refunds: Array<{ id: string; reference: string; amount: string; status: string; method: string; funding: Array<{ amount: string; source: string }>; reserve: RefundJournal; release: RefundJournal | null; completion: RefundJournal | null; history: Array<{ toStatus: string; reason: string; operationId: string | null }>; attempts: Array<{ provider: string; status: string; number: number }>; reconciliation: Array<{ status: string; reason: string }> }>;
  provider: { calls: number } | null;
};
export async function refundControl(reference: string, action = "snapshot", options: Record<string, string> = {}): Promise<RefundSnapshot> {
  assertDisposablePaystackAcceptance();
  const { stdout } = await execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/phase2-refund-control.ts", reference, action, JSON.stringify(options)], { env: process.env, timeout: 45_000, maxBuffer: 2_000_000 });
  const line = stdout.split(/\r?\n/).find(value => value.startsWith("REFUND_SNAPSHOT "));
  if (!line) throw new Error("Canonical refund PostgreSQL snapshot was not produced.");
  return JSON.parse(line.slice("REFUND_SNAPSHOT ".length));
}
export function assertBalancedRefundJournal(journal: RefundJournal | null, type: string, amount: string) {
  expect(journal).not.toBeNull();
  expect(journal).toMatchObject({ type, currency: "ZAR", totalDebits: amount, totalCredits: amount });
  expect(journal!.entries.filter(e => e.direction === "DEBIT").reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0)).toBe(Math.round(Number(amount) * 100));
  expect(journal!.entries.filter(e => e.direction === "CREDIT").reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0)).toBe(Math.round(Number(amount) * 100));
}
export const balance = (snapshot: RefundSnapshot, purpose: string) => snapshot.accounts.find(a => a.purpose === purpose)!.balance;
