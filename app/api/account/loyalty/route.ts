import { SystemSettingType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unauthorized, forbidden, ok, serverError } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { loadCustomerRewardPolicy } from "@/lib/rewards/customer-reward-configuration";

/** Private ledger-backed points, rewards and conversion receipts. Wallet
 * conversion remains OFF until the owner deliberately enables the setting.
 */
export async function GET() {
  const customer = await getCurrentUser();
  if (!customer) return unauthorized();
  if (customer.role !== "CUSTOMER" || customer.status !== "ACTIVE") {
    return forbidden("Loyalty balances are available only to active customer accounts.");
  }
  try {
    const [account, policy, conversionSetting] = await Promise.all([
      prisma.customerLoyaltyAccount.findUnique({
        where: { userId: customer.id },
        include: {
          movements: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 50,
          },
          redemptions: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 50,
          },
        },
      }),
      loadCustomerRewardPolicy(),
      prisma.systemSetting.findUnique({
        where: { key: "loyalty.conversion_enabled" },
        select: { type: true, value: true },
      }),
    ]);
    const response = ok({
      currency: "ZAR",
      availablePoints: (account?.availablePoints ?? 0n).toString(),
      debtPoints: (account?.debtPoints ?? 0n).toString(),
      lifetimeEarnedPoints: (account?.lifetimeEarnedPoints ?? 0n).toString(),
      lifetimeReversedPoints: (account?.lifetimeReversedPoints ?? 0n).toString(),
      pointsPerRand: policy.pointsPerZar,
      conversion: {
        pointsRequired: policy.conversionPoints,
        walletRand: policy.conversionWalletZar,
        enabled: conversionSetting?.type === SystemSettingType.BOOLEAN && conversionSetting.value === true,
      },
      redemptions: (account?.redemptions ?? []).map(redemption => ({
        reference: redemption.id,
        operationId: redemption.operationId,
        pointsRedeemed: redemption.pointsRedeemed.toString(),
        availablePointsAfter: redemption.availablePointsAfter.toString(),
        walletCreditZar: redemption.walletCreditAmount.toFixed(2),
        occurredAt: redemption.createdAt.toISOString(),
      })),
      movements: (account?.movements ?? []).map(movement => ({
        reference: movement.id,
        changePoints: movement.deltaPoints.toString(),
        availablePointsAfter: movement.availablePointsAfter.toString(),
        debtPointsAfter: movement.debtPointsAfter.toString(),
        occurredAt: movement.createdAt.toISOString(),
      })),
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return serverError();
  }
}
