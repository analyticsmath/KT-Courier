-- Prevent concurrent new-code requests from issuing two active ordinary
-- referral codes for the same verified customer or owned store. This does
-- not affect historical generic or promoter referral-code records.
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCode_ordinary_active_owner_unique"
  ON "ReferralCode" ("ownerType", "ownerId")
  WHERE "isActive" = TRUE
    AND "metadata" ->> 'program' = 'ORDINARY_REFERRAL_V1';
