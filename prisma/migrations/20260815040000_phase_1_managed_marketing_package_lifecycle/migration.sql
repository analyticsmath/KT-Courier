-- Phase 1 Forward Migration: Allow ACTIVE -> RETIRED lifecycle transition while enforcing immutability of commercial terms
CREATE OR REPLACE FUNCTION "managed_marketing_package_immutable"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'ACTIVE') THEN
      RETURN NEW;
    END IF;
    IF OLD."status" = 'ACTIVE' AND NEW."status" = 'RETIRED' THEN
      IF NEW."code" = OLD."code"
        AND NEW."versionNumber" = OLD."versionNumber"
        AND NEW."channel" = OLD."channel"
        AND NEW."priceAmount" = OLD."priceAmount"
        AND NEW."taxRate" = OLD."taxRate"
        AND NEW."currency" = OLD."currency"
        AND NEW."packageTerms" = OLD."packageTerms"
        AND NEW."effectiveAt" = OLD."effectiveAt" THEN
        RETURN NEW;
      ELSE
        RAISE EXCEPTION 'commercial terms of active managed marketing package versions are immutable';
      END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'managed marketing package versions are immutable outside DRAFT';
END;
$$ LANGUAGE plpgsql;
