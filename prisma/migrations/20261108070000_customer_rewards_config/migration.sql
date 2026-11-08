-- Initialize client-approved commercial policy rates without changing historical
-- orders, monetary journals or any existing owner-defined settings.
-- This is configuration only. Reward credits require separate activation gates.
INSERT INTO "SystemSetting" ("id", "key", "label", "type", "value", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'loyalty.points_per_zar', 'Loyalty points earned per R1 of eligible paid value', 'NUMBER', '1'::jsonb, NOW(), NOW()),
  (gen_random_uuid()::text, 'loyalty.conversion_points', 'Loyalty points required for one conversion', 'NUMBER', '100'::jsonb, NOW(), NOW()),
  (gen_random_uuid()::text, 'loyalty.conversion_wallet_zar', 'Wallet rand granted per loyalty conversion', 'NUMBER', '2'::jsonb, NOW(), NOW()),
  (gen_random_uuid()::text, 'referral.reward_zar', 'Ordinary customer/store referral reward (R)', 'NUMBER', '5'::jsonb, NOW(), NOW()),
  (gen_random_uuid()::text, 'welcome.store.discount_zar', 'First store purchase discount (R)', 'NUMBER', '50'::jsonb, NOW(), NOW()),
  (gen_random_uuid()::text, 'welcome.store.valid_days', 'First store offer validity from signup (days)', 'NUMBER', '7'::jsonb, NOW(), NOW()),
  (gen_random_uuid()::text, 'welcome.store.minimum_order_zar', 'First store offer minimum order value (R)', 'NUMBER', '0'::jsonb, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
