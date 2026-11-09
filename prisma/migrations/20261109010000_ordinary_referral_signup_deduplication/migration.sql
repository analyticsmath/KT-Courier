-- Ordinary customer/store signup referrals are separate from promoter
-- acquisition and must never pay multiple owners for the same new account.
-- Historical referral events with other sources remain unchanged.
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralEvent_ordinary_signup_target_unique"
  ON "ReferralEvent" ("targetUserId")
  WHERE "source" = 'ORDINARY_SIGNUP' AND "targetUserId" IS NOT NULL;
