import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  prisma: { ledgerAccount: { findMany: vi.fn() } },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/ledger-posting.service", () => ({ postLedgerJournal: mocks.post }));

import { transferBetweenLedgerAccounts } from "@/lib/services/ledger-transfer.service";

beforeEach(() => { vi.clearAllMocks(); mocks.post.mockResolvedValue({ id: "journal" }); });

describe("ledger transfer helper", () => {
  it("delegates exact explicit debit/credit semantics to the canonical posting service", async () => {
    await transferBetweenLedgerAccounts({ idempotencyKey: "transfer-1", debitAccountId: "destination", creditAccountId: "source", amount: "5.00", debitLineCode: "DEST", creditLineCode: "SOURCE", actor: { kind: "SYSTEM" } });
    expect(mocks.post).toHaveBeenCalledWith(expect.objectContaining({ type: "ACCOUNT_TRANSFER", currency: "ZAR", entries: [
      expect.objectContaining({ accountId: "destination", direction: "DEBIT", amount: "5.00" }),
      expect.objectContaining({ accountId: "source", direction: "CREDIT", amount: "5.00" }),
    ] }));
  });

  it("rejects self-transfer and purpose mismatches", async () => {
    await expect(transferBetweenLedgerAccounts({ idempotencyKey: "x", debitAccountId: "same", creditAccountId: "same", amount: "1.00", debitLineCode: "D", creditLineCode: "C", actor: { kind: "SYSTEM" } })).rejects.toMatchObject({ code: "LEDGER_DUPLICATE_ACCOUNT_LINE" });
    mocks.prisma.ledgerAccount.findMany.mockResolvedValue([{ id: "a", purpose: "AVAILABLE" }, { id: "b", purpose: "ADJUSTMENT" }]);
    await expect(transferBetweenLedgerAccounts({ idempotencyKey: "x", debitAccountId: "a", creditAccountId: "b", amount: "1.00", debitLineCode: "D", creditLineCode: "C", actor: { kind: "SYSTEM" }, expectedDebitPurpose: "HELD" })).rejects.toMatchObject({ code: "LEDGER_OWNER_INVALID" });
  });
});

