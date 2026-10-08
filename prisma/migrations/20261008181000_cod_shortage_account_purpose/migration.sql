-- Distinct platform purpose: promotion expenses are never COD suspense.
-- No account, balance, cash or approval is created by this migration.
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'COD_SHORTAGE_SUSPENSE';
CREATE FUNCTION "cod_shortage_account_guard"() RETURNS TRIGGER AS $$
DECLARE owner_wallet "Wallet"%ROWTYPE;
BEGIN
  IF NEW."purpose"::TEXT <> 'COD_SHORTAGE_SUSPENSE' THEN RETURN NEW; END IF;
  SELECT * INTO STRICT owner_wallet FROM "Wallet" WHERE "id" = NEW."walletId";
  IF owner_wallet."ownerType" <> 'PLATFORM' OR owner_wallet."ownerId" <> 'platform' OR owner_wallet."currency" <> 'ZAR'
    OR NEW."code" <> 'PLATFORM-CASH-SHORT-OVER-SUSPENSE-ZAR' OR NEW."category" <> 'EXPENSE' OR NEW."currency" <> 'ZAR' OR NEW."allowNegative"
  THEN RAISE EXCEPTION 'COD shortage suspense account authority is invalid'; END IF;
  IF TG_OP = 'INSERT' AND (NEW."currentBalance" <> 0 OR NEW."debitTotal" <> 0 OR NEW."creditTotal" <> 0)
  THEN RAISE EXCEPTION 'COD shortage suspense account must open at zero'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LedgerAccount_cod_shortage_policy" BEFORE INSERT OR UPDATE ON "LedgerAccount"
FOR EACH ROW EXECUTE FUNCTION "cod_shortage_account_guard"();
