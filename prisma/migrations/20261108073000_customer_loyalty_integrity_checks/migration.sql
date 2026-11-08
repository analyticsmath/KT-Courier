-- Non-monetary points integrity: no simultaneous spendable balance and debt.
-- Future wallet conversions may only debit points alongside a balanced ZAR journal.
ALTER TABLE "CustomerLoyaltyAccount"
  ADD CONSTRAINT "CustomerLoyaltyAccount_debt_exclusivity_check"
  CHECK ("availablePoints" = 0 OR "debtPoints" = 0);
ALTER TABLE "CustomerLoyaltyEarning"
  ADD CONSTRAINT "CustomerLoyaltyEarning_source_values_check"
  CHECK ("pointsPerZar" <= 1000 AND "eligibleBasisAmount" >= 0 AND "vatAmount" >= 0 AND "refundedAmount" >= 0);
