import { afterAll, describe, expect, it } from "vitest";
import { applyVerifiedPayfastItn } from "@/lib/services/payfast-itn-application.service";
import { createPhase12Attempt, verifiedEvent } from "./payfast-itn-fixtures";
import { paymentPrisma } from "./payment-fixtures";
afterAll(async () => paymentPrisma.$disconnect());
describe("Payfast receipt ledger integration", () => {
  it("posts gross ZAR as cash-clearing debit and held-liability credit with no fee/revenue line", async () => {
    const { attempt } = await createPhase12Attempt(); const result = await applyVerifiedPayfastItn(verifiedEvent(attempt));
    const journal = await paymentPrisma.ledgerJournal.findUniqueOrThrow({ where: { reference: result.ledgerJournalReference! }, include: { entries: { include: { account: true } } } });
    expect(journal.totalDebits.equals(attempt.amount)).toBe(true); expect(journal.totalCredits.equals(attempt.amount)).toBe(true);
    expect(journal.entries).toEqual(expect.arrayContaining([expect.objectContaining({ direction: "DEBIT", account: expect.objectContaining({ purpose: "CASH_CLEARING", category: "ASSET" }) }), expect.objectContaining({ direction: "CREDIT", account: expect.objectContaining({ purpose: "HELD", category: "LIABILITY" }) })]));
    expect(journal.entries).toHaveLength(2); expect(JSON.stringify(journal)).not.toMatch(/amount_fee|amount_net|PLATFORM_REVENUE/);
  });
});
