import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import { createCustomerAsset, ledgerPrisma, platformAccounts } from "./ledger-fixtures";

afterAll(async () => ledgerPrisma.$disconnect());

describe("Phase 9 live ledger posting", () => {
  it("posts one balanced journal with exact entries, projections, totals, and versions", async () => {
    const customer = await createCustomerAsset("balanced");
    const result = await postLedgerJournal({
      idempotencyKey: `${customer.tag}:post`, type: "GENERAL", currency: "ZAR", sourceReference: `${customer.tag}:source`, actor: { kind: "SYSTEM" },
      entries: [
        { accountId: customer.account.id, direction: "DEBIT", amount: "25.00", lineCode: "ASSET" },
        { accountId: (await platformAccounts()).adjustment.id, direction: "CREDIT", amount: "25.00", lineCode: "CONTROL" },
      ],
    });
    expect(result).toMatchObject({ totalDebits: "25.00", totalCredits: "25.00", balanced: true });
    expect(await ledgerPrisma.ledgerJournal.count({ where: { idempotencyKey: `${customer.tag}:post` } })).toBe(1);
    expect(await ledgerPrisma.ledgerEntry.count({ where: { journalId: result.id } })).toBe(2);
    const projection = await ledgerPrisma.ledgerAccount.findUniqueOrThrow({ where: { id: customer.account.id } });
    expect(projection.currentBalance.toFixed(2)).toBe("25.00");
    expect(projection.debitTotal.toFixed(2)).toBe("25.00");
    expect(projection.version).toBe(1);
  });

  it("rejects unbalanced input without consuming a journal or projection", async () => {
    const customer = await createCustomerAsset("unbalanced");
    const { adjustment } = await platformAccounts();
    await expect(postLedgerJournal({ idempotencyKey: `${customer.tag}:post`, type: "GENERAL", currency: "ZAR", actor: { kind: "SYSTEM" }, entries: [
      { accountId: customer.account.id, direction: "DEBIT", amount: "1.00", lineCode: "A" },
      { accountId: adjustment.id, direction: "CREDIT", amount: "2.00", lineCode: "B" },
    ] })).rejects.toMatchObject({ code: "LEDGER_UNBALANCED_JOURNAL" });
    expect(await ledgerPrisma.ledgerJournal.count({ where: { idempotencyKey: `${customer.tag}:post` } })).toBe(0);
    expect((await ledgerPrisma.ledgerAccount.findUniqueOrThrow({ where: { id: customer.account.id } })).currentBalance.isZero()).toBe(true);
  });

  it.each(["FROZEN", "CLOSED"] as const)("rejects %s accounts without a journal", async (status) => {
    const customer = await createCustomerAsset(status.toLowerCase());
    const { adjustment } = await platformAccounts();
    await ledgerPrisma.ledgerAccount.update({ where: { id: customer.account.id }, data: { status } });
    const key = `${customer.tag}:post`;
    await expect(postLedgerJournal({ idempotencyKey: key, type: "GENERAL", currency: "ZAR", actor: { kind: "SYSTEM" }, entries: [
      { accountId: customer.account.id, direction: "DEBIT", amount: "1.00", lineCode: "A" },
      { accountId: adjustment.id, direction: "CREDIT", amount: "1.00", lineCode: "B" },
    ] })).rejects.toMatchObject({ code: status === "FROZEN" ? "LEDGER_ACCOUNT_FROZEN" : "LEDGER_ACCOUNT_CLOSED" });
    expect(await ledgerPrisma.ledgerJournal.count({ where: { idempotencyKey: key } })).toBe(0);
  });

  it("rejects an account/wallet currency mismatch", async () => {
    const customer = await createCustomerAsset("currency");
    const { adjustment } = await platformAccounts();
    await ledgerPrisma.wallet.update({ where: { id: customer.wallet.id }, data: { currency: "USD" } });
    try {
      await expect(postLedgerJournal({ idempotencyKey: `${customer.tag}:post`, type: "GENERAL", currency: "ZAR", actor: { kind: "SYSTEM" }, entries: [
        { accountId: customer.account.id, direction: "DEBIT", amount: "1.00", lineCode: "A" },
        { accountId: adjustment.id, direction: "CREDIT", amount: "1.00", lineCode: "B" },
      ] })).rejects.toMatchObject({ code: "LEDGER_ACCOUNT_CURRENCY_MISMATCH" });
    } finally {
      await ledgerPrisma.wallet.update({ where: { id: customer.wallet.id }, data: { currency: "ZAR" } });
    }
  });

  it("rolls back journal and entries when a disposable transaction fails before projection completion", async () => {
    const customer = await createCustomerAsset("rollback");
    const { adjustment } = await platformAccounts();
    const key = `${customer.tag}:${randomUUID()}`;
    await expect(ledgerPrisma.$transaction(async (tx) => {
      const journal = await tx.ledgerJournal.create({ data: { reference: `LJ-${randomUUID()}`, type: "GENERAL", currency: "ZAR", idempotencyKey: key, requestHash: "a".repeat(64), policyVersion: "phase9-v1", totalDebits: "1.00", totalCredits: "1.00" } });
      await tx.ledgerEntry.createMany({ data: [
        { journalId: journal.id, accountId: customer.account.id, sequence: 1, direction: "DEBIT", amount: "1.00", lineCode: "A" },
        { journalId: journal.id, accountId: adjustment.id, sequence: 2, direction: "CREDIT", amount: "1.00", lineCode: "B" },
      ] });
      throw new Error("injected disposable rollback");
    })).rejects.toThrow("injected disposable rollback");
    expect(await ledgerPrisma.ledgerJournal.count({ where: { idempotencyKey: key } })).toBe(0);
    expect((await ledgerPrisma.ledgerAccount.findUniqueOrThrow({ where: { id: customer.account.id } })).currentBalance.isZero()).toBe(true);
  });
});

