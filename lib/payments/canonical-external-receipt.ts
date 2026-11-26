import { Prisma } from "@prisma/client";

/** Exactly one full-value provider clearing debit and one full-value
 * customer-funds-held credit, with validated canonical account classes.
 * An arbitrary balanced journal or partial held credit is not funding.
 */
export function isCanonicalExternalPaymentReceipt(input: Readonly<{
  amount: Prisma.Decimal;
  isQaIsolated?: boolean;
  entries: readonly Readonly<{
    direction: string;
    amount: Prisma.Decimal;
    account: Readonly<{ code: string; purpose: string; category: string }>;
  }>[];
}>): boolean {
  if (input.entries.length !== 2 || !input.amount.gt(0)) return false;
  const clearingCode = input.isQaIsolated
    ? "PLATFORM-SANDBOX-ACCEPTANCE-CASH-CLEARING-ZAR"
    : "PLATFORM-CASH-CLEARING-ZAR";
  const heldCode = input.isQaIsolated
    ? "PLATFORM-SANDBOX-ACCEPTANCE-FUNDS-HELD-ZAR"
    : "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR";
  const fullValue = (entry: (typeof input.entries)[number], direction: string, code: string, purpose: string, category: string) =>
    entry.direction === direction &&
    entry.amount.equals(input.amount) &&
    entry.account.code === code &&
    entry.account.purpose === purpose &&
    entry.account.category === category;
  return input.entries.some(entry => fullValue(entry, "DEBIT", clearingCode, "CASH_CLEARING", "ASSET"))
    && input.entries.some(entry => fullValue(entry, "CREDIT", heldCode, "HELD", "LIABILITY"));
}
