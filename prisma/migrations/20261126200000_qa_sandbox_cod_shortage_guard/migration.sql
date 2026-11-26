-- Permit the dedicated isolated QA platform sandbox wallet's COD shortage
-- suspense account alongside the canonical platform COD shortage account,
-- while continuing to forbid non-platform wallets and negative balances.
CREATE OR REPLACE FUNCTION "cod_shortage_account_guard"() RETURNS TRIGGER AS $$
DECLARE owner_wallet "Wallet"%ROWTYPE;
BEGIN
  IF NEW."purpose"::TEXT <> 'COD_SHORTAGE_SUSPENSE' THEN RETURN NEW; END IF;
  SELECT * INTO STRICT owner_wallet FROM "Wallet" WHERE "id" = NEW."walletId";
  IF owner_wallet."ownerType" <> 'PLATFORM' OR owner_wallet."currency" <> 'ZAR'
    OR NEW."category" <> 'EXPENSE' OR NEW."currency" <> 'ZAR' OR NEW."allowNegative"
  THEN
    RAISE EXCEPTION 'COD shortage suspense account authority is invalid';
  END IF;
  IF NOT (
    (
      owner_wallet."ownerId" = 'platform'
      AND NEW."code" = 'PLATFORM-CASH-SHORT-OVER-SUSPENSE-ZAR'
    )
    OR (
      owner_wallet."ownerId" = 'platform-sandbox-acceptance'
      AND owner_wallet."isQaIsolated" = TRUE
      AND NEW."code" = 'PLATFORM-SANDBOX-ACCEPTANCE-CASH-SHORT-OVER-SUSPENSE-ZAR'
    )
  ) THEN
    RAISE EXCEPTION 'COD shortage suspense account authority is invalid';
  END IF;
  IF TG_OP = 'INSERT' AND (NEW."currentBalance" <> 0 OR NEW."debitTotal" <> 0 OR NEW."creditTotal" <> 0)
  THEN RAISE EXCEPTION 'COD shortage suspense account must open at zero'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
