import { Prisma } from "@prisma/client";

/** Exactly one full-value provider clearing debit and one full-value
 * customer-funds-held credit, with validated canonical account classes.
 * An arbitrary balanced journal or partial held credit is not funding.
 */
export function isCanonicalExternalPaymentReceipt(input: Readonly<{
  amount: Prisma.Decimal;
  entries: readonly Readonly<{
    direction: string;
    amount: Prisma.Decimal;
    account: Readonly<{ code: string; purpose: string; category: string }>;
  }>[];
}>): boolean {
  if (input.entries.length !== 2 || !input.amount.gt(0)) return false;
  const fullValue = (entry: (typeof input.entries)[number], direction: string, code: string, purpose: string, category: string) =>
    entry.direction === direction &&
    entry.amount.equals(input.amount) &&
    entry.account.code === code &&
    entry.account.purpose === purpose &&
    entry.account.category === category;
  return input.entries.some(entry => fullValue(entry, "DEBIT", "PLATFORM-CASH-CLEARING-ZAR", "CASH_CLEARING", "ASSET"))
    && input.entries.some(entry => fullValue(entry, "CREDIT", "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", "HELD", "LIABILITY"));
}
