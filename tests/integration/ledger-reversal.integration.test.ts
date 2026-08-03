import { afterAll, describe, expect, it } from "vitest";
import { reverseLedgerJournal } from "@/lib/services/ledger-reversal.service";
import { transferBetweenLedgerAccounts } from "@/lib/services/ledger-transfer.service";
import { createCustomerAsset, fundAsset, ledgerPrisma, ledgerTag } from "./ledger-fixtures";

afterAll(async () => ledgerPrisma.$disconnect());

describe("Phase 9 live ledger reversals", () => {
  it("creates one inverse journal, preserves the original, and restores projections", async () => {
    const customer = await createCustomerAsset("reversal");
    const original = await fundAsset(customer.account.id, "7.00", "reversal-fund");
    const before = await ledgerPrisma.ledgerJournal.findUniqueOrThrow({ where: { id: original.id }, include: { entries: true } });
    const reversal = await reverseLedgerJournal({ originalJournalId: original.id, idempotencyKey: ledgerTag("reverse"), actor: { kind: "SYSTEM" } });
    expect(reversal.reversalOfJournal).toMatchObject({ id: original.id });
    expect((await ledgerPrisma.ledgerAccount.findUniqueOrThrow({ where: { id: customer.account.id } })).currentBalance.toFixed(2)).toBe("0.00");
    expect(await ledgerPrisma.ledgerJournal.findUniqueOrThrow({ where: { id: original.id }, include: { entries: true } })).toEqual(before);
    await expect(reverseLedgerJournal({ originalJournalId: reversal.id, idempotencyKey: ledgerTag("reverse-reversal"), actor: { kind: "SYSTEM" } })).rejects.toMatchObject({ code: "LEDGER_REVERSAL_NOT_ALLOWED" });
  });

  it("coalesces concurrent same-key reversal and prevents a second direct reversal", async () => {
    const customer = await createCustomerAsset("concurrent-reversal");
    const original = await fundAsset(customer.account.id, "5.00", "concurrent-reversal-fund");
    const key = ledgerTag("same-reversal");
    const [left, right] = await Promise.all([
      reverseLedgerJournal({ originalJournalId: original.id, idempotencyKey: key, actor: { kind: "SYSTEM" } }),
      reverseLedgerJournal({ originalJournalId: original.id, idempotencyKey: key, actor: { kind: "SYSTEM" } }),
    ]);
    expect(left.id).toBe(right.id);
    await expect(reverseLedgerJournal({ originalJournalId: original.id, idempotencyKey: ledgerTag("second-reversal"), actor: { kind: "SYSTEM" } })).rejects.toMatchObject({ code: "LEDGER_JOURNAL_ALREADY_REVERSED" });
  });

  it("enforces non-negative policy on reversal", async () => {
    const source = await createCustomerAsset("reversal-spent"); const destination = await createCustomerAsset("reversal-destination");
    const funding = await fundAsset(source.account.id, "4.00", "reversal-spent-fund");
    await transferBetweenLedgerAccounts({ idempotencyKey: ledgerTag("spend-before-reversal"), debitAccountId: destination.account.id, creditAccountId: source.account.id, amount: "4.00", debitLineCode: "DEST", creditLineCode: "SOURCE", actor: { kind: "SYSTEM" } });
    await expect(reverseLedgerJournal({ originalJournalId: funding.id, idempotencyKey: ledgerTag("blocked-reversal"), actor: { kind: "SYSTEM" } })).rejects.toMatchObject({ code: "LEDGER_INSUFFICIENT_BALANCE" });
  });
});

