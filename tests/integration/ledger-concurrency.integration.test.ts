import { afterAll, describe, expect, it } from "vitest";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import { transferBetweenLedgerAccounts } from "@/lib/services/ledger-transfer.service";
import { createCustomerAsset, fundAsset, ledgerPrisma, ledgerTag, platformAccounts } from "./ledger-fixtures";

afterAll(async () => ledgerPrisma.$disconnect());

describe("Phase 9 live ledger concurrency", () => {
  it("coalesces concurrent same-key/same-payload posting and conflicts on changed payload", async () => {
    const customer = await createCustomerAsset("idem");
    const { adjustment } = await platformAccounts();
    const key = `${customer.tag}:same`;
    const request = { idempotencyKey: key, type: "GENERAL" as const, currency: "ZAR" as const, actor: { kind: "SYSTEM" as const }, entries: [
      { accountId: customer.account.id, direction: "DEBIT" as const, amount: "3.00", lineCode: "A" },
      { accountId: adjustment.id, direction: "CREDIT" as const, amount: "3.00", lineCode: "B" },
    ] };
    const [left, right] = await Promise.all([postLedgerJournal(request), postLedgerJournal(request)]);
    expect(left.id).toBe(right.id);
    expect(await ledgerPrisma.ledgerJournal.count({ where: { idempotencyKey: key } })).toBe(1);
    expect(await ledgerPrisma.ledgerEntry.count({ where: { journalId: left.id } })).toBe(2);

    await expect(postLedgerJournal({ ...request, entries: [
      { ...request.entries[0], amount: "4.00" }, { ...request.entries[1], amount: "4.00" },
    ] })).rejects.toMatchObject({ code: "LEDGER_IDEMPOTENCY_CONFLICT" });
  });

  it("prevents a concurrent double spend", async () => {
    const source = await createCustomerAsset("double-source");
    const destinationA = await createCustomerAsset("double-a");
    const destinationB = await createCustomerAsset("double-b");
    await fundAsset(source.account.id, "10.00", "double-fund");
    const transfers = await Promise.allSettled([
      transferBetweenLedgerAccounts({ idempotencyKey: ledgerTag("spend-a"), debitAccountId: destinationA.account.id, creditAccountId: source.account.id, amount: "8.00", debitLineCode: "DEST-A", creditLineCode: "SOURCE", actor: { kind: "SYSTEM" } }),
      transferBetweenLedgerAccounts({ idempotencyKey: ledgerTag("spend-b"), debitAccountId: destinationB.account.id, creditAccountId: source.account.id, amount: "8.00", debitLineCode: "DEST-B", creditLineCode: "SOURCE", actor: { kind: "SYSTEM" } }),
    ]);
    expect(transfers.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await ledgerPrisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.account.id } })).currentBalance.greaterThanOrEqualTo(0)).toBe(true);
  });

  it("uses deterministic lock order for opposite transfers and allows independent postings", async () => {
    const a = await createCustomerAsset("opposite-a"); const b = await createCustomerAsset("opposite-b");
    await fundAsset(a.account.id, "10.00", "opposite-fund-a"); await fundAsset(b.account.id, "10.00", "opposite-fund-b");
    const opposite = await Promise.all([
      transferBetweenLedgerAccounts({ idempotencyKey: ledgerTag("a-to-b"), debitAccountId: b.account.id, creditAccountId: a.account.id, amount: "2.00", debitLineCode: "B", creditLineCode: "A", actor: { kind: "SYSTEM" } }),
      transferBetweenLedgerAccounts({ idempotencyKey: ledgerTag("b-to-a"), debitAccountId: a.account.id, creditAccountId: b.account.id, amount: "3.00", debitLineCode: "A", creditLineCode: "B", actor: { kind: "SYSTEM" } }),
    ]);
    expect(opposite).toHaveLength(2);

    const sourceC = await createCustomerAsset("independent-source-c"); const destinationC = await createCustomerAsset("independent-destination-c");
    const sourceD = await createCustomerAsset("independent-source-d"); const destinationD = await createCustomerAsset("independent-destination-d");
    await fundAsset(sourceC.account.id, "2.00", "independent-fund-c");
    await fundAsset(sourceD.account.id, "2.00", "independent-fund-d");
    const independent = await Promise.all([
      transferBetweenLedgerAccounts({ idempotencyKey: ledgerTag("independent-c"), debitAccountId: destinationC.account.id, creditAccountId: sourceC.account.id, amount: "1.00", debitLineCode: "DEST-C", creditLineCode: "SOURCE-C", actor: { kind: "SYSTEM" } }),
      transferBetweenLedgerAccounts({ idempotencyKey: ledgerTag("independent-d"), debitAccountId: destinationD.account.id, creditAccountId: sourceD.account.id, amount: "1.00", debitLineCode: "DEST-D", creditLineCode: "SOURCE-D", actor: { kind: "SYSTEM" } }),
    ]);
    expect(independent.every((journal) => journal.balanced)).toBe(true);
  });
});
