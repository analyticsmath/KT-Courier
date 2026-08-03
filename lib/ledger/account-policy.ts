import { LedgerError } from "./errors";
import type {
  LedgerAccountCategoryCode,
  LedgerAccountPolicySnapshot,
  LedgerEntryDirectionCode,
} from "./types";

export function normalSideForCategory(category: LedgerAccountCategoryCode): LedgerEntryDirectionCode {
  return category === "ASSET" || category === "EXPENSE" ? "DEBIT" : "CREDIT";
}

export function assertAccountCanPost(account: LedgerAccountPolicySnapshot, currency: "ZAR"): void {
  if (account.status === "FROZEN") {
    throw new LedgerError("LEDGER_ACCOUNT_FROZEN", "A frozen ledger account cannot receive new postings.");
  }
  if (account.status === "CLOSED") {
    throw new LedgerError("LEDGER_ACCOUNT_CLOSED", "A closed ledger account cannot receive new postings.");
  }
  if (account.currency !== currency) {
    throw new LedgerError("LEDGER_ACCOUNT_CURRENCY_MISMATCH", "Ledger account currency does not match the journal.");
  }
}

