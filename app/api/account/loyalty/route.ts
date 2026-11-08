import { getCurrentUser } from "@/lib/auth/current-user";
import { unauthorized, forbidden, ok, serverError } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { loadCustomerRewardPolicy } from "@/lib/rewards/customer-reward-configuration";

/** Customer-scoped, read-only view of the independently verified point ledger.
 * No wallet payout or points conversion is enabled until a balanced ZAR
 * journal can be committed atomically with the point redemption.
 */
export async function GET() {
  const customer = await getCurrentUser();
  if (!customer) return unauthorized();
  if (customer.role !== "CUSTOMER" || customer.status !== "ACTIVE") {
    return forbidden("Loyalty balances are available only to active customer accounts.");
  }
  try {
    const [account, policy] = await Promise.all([
      prisma.customerLoyaltyAccount.findUnique({
        where: { userId: customer.id },
        include: {
          movements: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 50,
          },
        },
      }),
      loadCustomerRewardPolicy(),
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
        enabled: false,
      },
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
