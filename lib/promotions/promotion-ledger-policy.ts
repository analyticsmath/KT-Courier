import { Decimal } from "@prisma/client/runtime/library";

export const PROMOTION_JOURNAL_TYPE = "PROMOTION_SUBSIDY" as const;

export const PROMOTION_ACCOUNT_CODES = {
  PLATFORM_EXPENSE: "PLATFORM_PROMOTION_EXPENSE",
  CUSTOMER_FUNDS_HELD: "CUSTOMER_FUNDS_HELD",
} as const;

export const PROMOTION_LINE_CODES = {
  EXPENSE: "PLATFORM_PROMO_EXPENSE",
  CREDIT: "CUSTOMER_FUNDS_PROMO_CREDIT",
} as const;

export interface PromotionJournalIntent {
  journalType: typeof PROMOTION_JOURNAL_TYPE;
  referenceId: string; // redemptionId
  lines: {
    accountCode: string;
    lineCode: string;
    amount: Decimal;
    direction: "DEBIT" | "CREDIT";
  }[];
}

export function createPlatformSubsidyJournal(
  redemptionId: string,
  platformFundingAmount: Decimal
): PromotionJournalIntent {
  return {
    journalType: PROMOTION_JOURNAL_TYPE,
    referenceId: redemptionId,
    lines: [
      {
        accountCode: PROMOTION_ACCOUNT_CODES.PLATFORM_EXPENSE,
        lineCode: PROMOTION_LINE_CODES.EXPENSE,
        amount: platformFundingAmount,
        direction: "DEBIT",
      },
      {
        accountCode: PROMOTION_ACCOUNT_CODES.CUSTOMER_FUNDS_HELD,
        lineCode: PROMOTION_LINE_CODES.CREDIT,
        amount: platformFundingAmount,
        direction: "CREDIT",
      },
    ],
  };
}
