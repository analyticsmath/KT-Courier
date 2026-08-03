import { afterAll, describe, expect, it } from "vitest";
import { createCustomerAsset, ledgerPrisma } from "./ledger-fixtures";
import { ensureLedgerAccount } from "@/lib/services/wallet-account.service";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";

afterAll(async () => {
  await ledgerPrisma.$disconnect();
});

describe("Phase 9 live ledger categories and boundary projections", () => {
  const categories = [
    { category: "ASSET" as const, normalSide: "DEBIT" as const, oppositeSide: "CREDIT" as const },
    { category: "LIABILITY" as const, normalSide: "CREDIT" as const, oppositeSide: "DEBIT" as const },
    { category: "REVENUE" as const, normalSide: "CREDIT" as const, oppositeSide: "DEBIT" as const },
    { category: "EXPENSE" as const, normalSide: "DEBIT" as const, oppositeSide: "CREDIT" as const },
    { category: "EQUITY" as const, normalSide: "CREDIT" as const, oppositeSide: "DEBIT" as const },
  ];

  for (const { category, normalSide, oppositeSide } of categories) {
    it(`proves category ${category} projection increases on ${normalSide}, decreases on ${oppositeSide}, and rejects negative balances`, async () => {
      const customer = await createCustomerAsset(`cat-${category.toLowerCase()}`);

      // Create test account: purpose is SUSPENSE, allowNegative is false by default
      const account = await ensureLedgerAccount({
        walletId: customer.wallet.id,
        code: `TEST-${category}-${customer.tag}`.slice(0, 79),
        purpose: "SUSPENSE",
        category,
        currency: "ZAR",
      });

      // Create offset account: purpose is OPENING_BALANCE_CONTROL, allowNegative = true to absorb opposite entries
      const offsetAccount = await ensureLedgerAccount({
        walletId: customer.wallet.id,
        code: `OFFSET-${category}-${customer.tag}`.slice(0, 79),
        purpose: "OPENING_BALANCE_CONTROL",
        category: "ASSET",
        currency: "ZAR",
      });
      await ledgerPrisma.ledgerAccount.update({
        where: { id: offsetAccount.id },
        data: { allowNegative: true },
      });

      // Create a separate test account for testing allowNegative = true: purpose is HELD
      const negAccount = await ensureLedgerAccount({
        walletId: customer.wallet.id,
        code: `NEG-${category}-${customer.tag}`.slice(0, 79),
        purpose: "ADJUSTMENT",
        category,
        currency: "ZAR",
      });
      await ledgerPrisma.ledgerAccount.update({
        where: { id: negAccount.id },
        data: { allowNegative: true },
      });

      // 1. Normal side increases balance
      // We increase our test account with 'normalSide', offset with 'oppositeSide'
      await postLedgerJournal({
        idempotencyKey: `${customer.tag}:normal-inc`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `TEST:${customer.tag}:inc`,
        actor: { kind: "SYSTEM" },
        entries: [
          { accountId: account.id, direction: normalSide, amount: "100.00", lineCode: "TEST-LINE-1" },
          { accountId: offsetAccount.id, direction: oppositeSide, amount: "100.00", lineCode: "TEST-LINE-2" },
        ],
      });

      let reloaded = await ledgerPrisma.ledgerAccount.findUniqueOrThrow({ where: { id: account.id } });
      expect(reloaded.currentBalance.toFixed(2)).toBe("100.00");
      if (normalSide === "DEBIT") {
        expect(reloaded.debitTotal.toFixed(2)).toBe("100.00");
        expect(reloaded.creditTotal.toFixed(2)).toBe("0.00");
      } else {
        expect(reloaded.creditTotal.toFixed(2)).toBe("100.00");
        expect(reloaded.debitTotal.toFixed(2)).toBe("0.00");
      }

      // 2. Opposite side decreases balance
      await postLedgerJournal({
        idempotencyKey: `${customer.tag}:opposite-dec`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `TEST:${customer.tag}:dec`,
        actor: { kind: "SYSTEM" },
        entries: [
          { accountId: account.id, direction: oppositeSide, amount: "40.00", lineCode: "TEST-LINE-3" },
          { accountId: offsetAccount.id, direction: normalSide, amount: "40.00", lineCode: "TEST-LINE-4" },
        ],
      });

      reloaded = await ledgerPrisma.ledgerAccount.findUniqueOrThrow({ where: { id: account.id } });
      expect(reloaded.currentBalance.toFixed(2)).toBe("60.00");

      // 3. Exact decrease to zero succeeds
      await postLedgerJournal({
        idempotencyKey: `${customer.tag}:zero-boundary`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `TEST:${customer.tag}:zero`,
        actor: { kind: "SYSTEM" },
        entries: [
          { accountId: account.id, direction: oppositeSide, amount: "60.00", lineCode: "TEST-LINE-5" },
          { accountId: offsetAccount.id, direction: normalSide, amount: "60.00", lineCode: "TEST-LINE-6" },
        ],
      });

      reloaded = await ledgerPrisma.ledgerAccount.findUniqueOrThrow({ where: { id: account.id } });
      expect(reloaded.currentBalance.toFixed(2)).toBe("0.00");

      // 4. One cent below zero is rejected when allowNegative=false
      await expect(
        postLedgerJournal({
          idempotencyKey: `${customer.tag}:neg-fail`,
          type: "GENERAL",
          currency: "ZAR",
          sourceReference: `TEST:${customer.tag}:neg-fail`,
          actor: { kind: "SYSTEM" },
          entries: [
            { accountId: account.id, direction: oppositeSide, amount: "0.01", lineCode: "TEST-LINE-7" },
            { accountId: offsetAccount.id, direction: normalSide, amount: "0.01", lineCode: "TEST-LINE-8" },
          ],
        })
      ).rejects.toMatchObject({ code: "LEDGER_INSUFFICIENT_BALANCE" });

      reloaded = await ledgerPrisma.ledgerAccount.findUniqueOrThrow({ where: { id: account.id } });
      expect(reloaded.currentBalance.toFixed(2)).toBe("0.00");

      // 5. One cent below zero succeeds on negAccount which has allowNegative=true
      await postLedgerJournal({
        idempotencyKey: `${customer.tag}:neg-ok`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `TEST:${customer.tag}:neg-ok`,
        actor: { kind: "SYSTEM" },
        entries: [
          { accountId: negAccount.id, direction: oppositeSide, amount: "0.01", lineCode: "TEST-LINE-9" },
          { accountId: offsetAccount.id, direction: normalSide, amount: "0.01", lineCode: "TEST-LINE-10" },
        ],
      });

      const reloadedNeg = await ledgerPrisma.ledgerAccount.findUniqueOrThrow({ where: { id: negAccount.id } });
      expect(reloadedNeg.currentBalance.toFixed(2)).toBe("-0.01");
    });
  }
});
