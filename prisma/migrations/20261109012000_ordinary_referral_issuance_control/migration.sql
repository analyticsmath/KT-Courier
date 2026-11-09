-- Store referral rewards are nonwithdrawable wallet liabilities, not sales payouts.
-- Adding a purpose cannot retroactively move or relabel an earning account.
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'STORE_REFERRAL_WALLET_AVAILABLE';
-- A migration provides the OFF switch even on an unseeded Railway database.
-- No historical referral is funded or rewritten by this migration.
INSERT INTO "SystemSetting" ("id", "key", "label", "type", "value", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'referral.reward_issuing_enabled',
        'Enable controlled, verified ordinary referral wallet awards',
        'BOOLEAN', 'false'::jsonb, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
