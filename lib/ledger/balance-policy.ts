import { normalSideForCategory } from "./account-policy";
import { LedgerError } from "./errors";
import { LedgerMoney, sumLedgerMoney } from "./money";
import type {
  LedgerAccountPolicySnapshot,
  LedgerEntryDirectionCode,
  NormalizedLedgerEntry,
} from "./types";

export type AccountProjectionChange = Readonly<{
  accountId: string;
  currentBalance: LedgerMoney;
  debitTotal: LedgerMoney;
  creditTotal: LedgerMoney;
  debitDelta: LedgerMoney;
  creditDelta: LedgerMoney;
  balanceDelta: LedgerMoney;
  expectedVersion: number;
}>;

export function balanceDeltaForEntry(
  category: LedgerAccountPolicySnapshot["category"],
  direction: LedgerEntryDirectionCode,
  amount: LedgerMoney
): LedgerMoney {
  return direction === normalSideForCategory(category) ? amount : amount.negate();
}

export function calculateAccountProjection(
  account: LedgerAccountPolicySnapshot,
  entries: readonly NormalizedLedgerEntry[]
): AccountProjectionChange {
  const accountEntries = entries.filter((entry) => entry.accountId === account.id);
  const debitDelta = sumLedgerMoney(
    accountEntries.filter((entry) => entry.direction === "DEBIT").map((entry) => entry.amount)
  );
  const creditDelta = sumLedgerMoney(
    accountEntries.filter((entry) => entry.direction === "CREDIT").map((entry) => entry.amount)
  );
  const balanceDelta = accountEntries.reduce(
    (total, entry) => total.add(balanceDeltaForEntry(account.category, entry.direction, entry.amount)),
    LedgerMoney.zero()
  );
  const currentBalance = account.currentBalance.add(balanceDelta);

  if (!account.allowNegative && currentBalance.lessThan(LedgerMoney.zero())) {
    throw new LedgerError("LEDGER_INSUFFICIENT_BALANCE", "Posting would make a non-negative ledger account negative.");
  }

  return Object.freeze({
    accountId: account.id,
    currentBalance,
    debitTotal: account.debitTotal.add(debitDelta),
    creditTotal: account.creditTotal.add(creditDelta),
    debitDelta,
    creditDelta,
    balanceDelta,
    expectedVersion: account.version,
  });
}

