import { Prisma } from "@prisma/client";

/**
 * Loyalty is earned only from an independently balanced, full-value provider
 * receipt. Checking that a held-funds credit merely exists is insufficient:
 * a mixed journal (R1 held, R99 transferred elsewhere) must not authorize
 * rewards on R100. The canonical Paystack/PayFast receipt has exactly two
 * entries, one full-value platform clearing debit and one full-value held
 * customer funds credit.
 */
export function isCanonicalCustomerPaymentReceipt(input: Readonly<{
  amount: Prisma.Decimal;
  entries: readonly Readonly<{
    direction: string;
    amount: Prisma.Decimal;
    account: Readonly<{
      code: string;
      purpose: string;
      category: string;
    }>;
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
