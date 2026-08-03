import { LedgerMoney } from "./money";
import type { LedgerAccountPolicySnapshot } from "./types";

export function toLedgerAccountPolicySnapshot(account: {
  id: string;
  category: LedgerAccountPolicySnapshot["category"];
  currency: LedgerAccountPolicySnapshot["currency"];
  status: LedgerAccountPolicySnapshot["status"];
  allowNegative: boolean;
  currentBalance: Parameters<typeof LedgerMoney.fromDecimal>[0];
  debitTotal: Parameters<typeof LedgerMoney.fromDecimal>[0];
  creditTotal: Parameters<typeof LedgerMoney.fromDecimal>[0];
  version: number;
}): LedgerAccountPolicySnapshot {
  return Object.freeze({
    id: account.id,
    category: account.category,
    currency: account.currency,
    status: account.status,
    allowNegative: account.allowNegative,
    currentBalance: LedgerMoney.fromDecimal(account.currentBalance),
    debitTotal: LedgerMoney.fromDecimal(account.debitTotal),
    creditTotal: LedgerMoney.fromDecimal(account.creditTotal),
    version: account.version,
  });
}
