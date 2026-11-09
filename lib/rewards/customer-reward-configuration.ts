import { Prisma, SystemSettingType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { validateSettingValue } from "@/lib/validation/admin-settings";
import {
  type CustomerRewardPolicy, validateCustomerRewardPolicy,
} from "@/lib/rewards/customer-reward-policy";

const VALUES = {
  "loyalty.points_per_zar": "pointsPerZar",
  "loyalty.conversion_points": "conversionPoints",
  "loyalty.conversion_wallet_zar": "conversionWalletZar",
  "referral.reward_zar": "referralRewardZar",
  "welcome.store.discount_zar": "firstStoreDiscountZar",
  "welcome.store.valid_days": "firstStoreValidDays",
  "welcome.store.minimum_order_zar": "firstStoreMinimumZar",
} as const;

type CustomerRewardSettingsDb = Pick<Prisma.TransactionClient, "systemSetting">;

export async function loadCustomerRewardPolicy(db: CustomerRewardSettingsDb = prisma): Promise<CustomerRewardPolicy> {
  const keys = Object.keys(VALUES) as (keyof typeof VALUES)[];
  const rows = await db.systemSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, type: true, value: true },
  });
  // No automatic financial rewards until ALL approved rates are present and
  // valid. The additive migration creates the initial owner-provided defaults.
  if (rows.length !== keys.length) throw new Error("Customer reward policy has not been fully configured.");
  const mapped: Record<string, unknown> = {};
  for (const row of rows) {
    const key = row.key as keyof typeof VALUES;
    const property = VALUES[key];
    if (!property || row.type !== SystemSettingType.NUMBER) {
      throw new Error("Customer reward policy is not correctly typed.");
    }
    const validated = validateSettingValue(row.type, row.value, row.key);
    if (!validated.ok) throw new Error("Customer reward policy contains an invalid rate.");
    const moneyFields = new Set([
      "conversionWalletZar", "referralRewardZar",
      "firstStoreDiscountZar", "firstStoreMinimumZar",
    ]);
    mapped[property] = moneyFields.has(property)
      ? new Prisma.Decimal(String(validated.value)).toFixed(2)
      : validated.value;
  }
  return validateCustomerRewardPolicy(mapped as CustomerRewardPolicy);
}
