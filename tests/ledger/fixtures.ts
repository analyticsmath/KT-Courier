import type { PostLedgerJournalInput } from "@/lib/ledger/types";

export function postingInput(overrides: Partial<PostLedgerJournalInput> = {}): PostLedgerJournalInput {
  return {
    idempotencyKey: "ledger-test-command-1",
    type: "GENERAL",
    currency: "ZAR",
    sourceReference: "test:source-1",
    correlationId: "correlation-1",
    memo: "Test journal",
    metadata: { fixture: "ledger", nested: { safe: true } },
    actor: { kind: "SYSTEM" },
    entries: [
      { accountId: "account-asset", direction: "DEBIT", amount: "100.00", lineCode: "ASSET" },
      { accountId: "account-equity", direction: "CREDIT", amount: "100.00", lineCode: "EQUITY" },
    ],
    ...overrides,
  };
}

