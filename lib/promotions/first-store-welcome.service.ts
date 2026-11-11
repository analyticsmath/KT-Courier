import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { promotionsProductionReady } from "@/lib/promotions/production-lock";
import { loadCustomerRewardPolicy } from "@/lib/rewards/customer-reward-configuration";
import {
  type CustomerRewardPolicy,
  firstStoreWelcomeDiscount,
} from "@/lib/rewards/customer-reward-policy";

export class WelcomeEligibilityLockUnavailableError extends Error {
  readonly code = "WELCOME_ELIGIBILITY_LOCK_UNAVAILABLE" as const;
  constructor(message = "Customer lock unavailable for welcome eligibility review.") {
    super(message);
    this.name = "WelcomeEligibilityLockUnavailableError";
  }
}

export type FirstStoreWelcomeEligibility = Readonly<{
  eligible: boolean;
  discountAmountZar: string;
  reason?: string;
  customerSignupAt?: Date;
  expiresAt?: Date;
}>;

export type FirstStoreWelcomeDependencies = Readonly<{
  policyLoader?: (db: Prisma.TransactionClient) => Promise<CustomerRewardPolicy>;
  policy?: CustomerRewardPolicy;
  lockAdapter?: (db: Prisma.TransactionClient, userId: string) => Promise<void>;
}>;

export async function checkFirstStoreWelcomeEligibility(
  customerUserId: string,
  merchandiseSubtotalZar: string,
  now: Date = new Date(),
  db: Prisma.TransactionClient = prisma,
  checkoutId?: string,
  dependencies?: FirstStoreWelcomeDependencies,
): Promise<FirstStoreWelcomeEligibility> {
  if (!promotionsProductionReady(process.env)) {
    return { eligible: false, discountAmountZar: "0.00", reason: "PROMOTIONS_NOT_ACTIVATED" };
  }

  if (!customerUserId) {
    return { eligible: false, discountAmountZar: "0.00", reason: "GUEST_NOT_ELIGIBLE" };
  }

  if (dependencies?.lockAdapter) {
    await dependencies.lockAdapter(db, customerUserId);
  } else if ("$queryRaw" in db && typeof db.$queryRaw === "function") {
    try {
      await db.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${customerUserId} FOR UPDATE`);
    } catch (error) {
      throw new WelcomeEligibilityLockUnavailableError(
        error instanceof Error ? error.message : "Customer lock unavailable for welcome eligibility review."
      );
    }
  }

  const customer = await db.user.findUnique({
    where: { id: customerUserId },
    select: { id: true, role: true, status: true, createdAt: true },
  });

  if (!customer || customer.role !== "CUSTOMER" || customer.status !== "ACTIVE") {
    return { eligible: false, discountAmountZar: "0.00", reason: "CUSTOMER_NOT_ELIGIBLE" };
  }

  let policy: CustomerRewardPolicy;
  try {
    if (dependencies?.policy) {
      policy = dependencies.policy;
    } else if (dependencies?.policyLoader) {
      policy = await dependencies.policyLoader(db);
    } else {
      policy = await loadCustomerRewardPolicy(db);
    }
  } catch {
    return {
      eligible: false,
      discountAmountZar: "0.00",
      reason: "POLICY_UNAVAILABLE",
    };
  }
  const expiresAt = new Date(customer.createdAt.getTime() + policy.firstStoreValidDays * 86_400_000);
  if (now.getTime() >= expiresAt.getTime()) {
    return {
      eligible: false,
      discountAmountZar: "0.00",
      reason: "WELCOME_OFFER_EXPIRED",
      customerSignupAt: customer.createdAt,
      expiresAt,
    };
  }

  const successfulStoreOrdersBefore = await db.marketplaceOrder.count({
    where: {
      customerUserId,
      status: { notIn: ["CANCELLED"] },
    },
  });

  const priorWelcomeOfferRedemptions = await db.promotionRedemption.count({
    where: {
      customerUserId,
      status: { in: ["COMMITTED", "PARTIALLY_REVERSED"] },
      campaignVersion: {
        campaign: {
          internalCode: "FIRST_STORE_WELCOME",
        },
      },
    },
  });

  const priorWelcomeCheckouts = db.marketplaceCheckout
    ? await db.marketplaceCheckout.count({
        where: {
          customerUserId,
          status: { in: ["RESERVED", "PAYMENT_PENDING", "PAYMENT_CONFIRMED", "COMPLETING", "COMPLETED"] },
          promotionDiscount: { gt: 0 },
          ...(checkoutId ? { id: { not: checkoutId } } : {}),
        },
      })
    : 0;

  if (priorWelcomeCheckouts > 0) {
    return {
      eligible: false,
      discountAmountZar: "0.00",
      reason: "WELCOME_OFFER_ALREADY_RESERVED",
      customerSignupAt: customer.createdAt,
      expiresAt,
    };
  }

  const discountZar = firstStoreWelcomeDiscount({
    orderType: "MARKETPLACE",
    customerSignupAt: customer.createdAt,
    checkedAt: now,
    successfulStoreOrdersBefore,
    priorWelcomeOfferRedemptions,
    merchandiseSubtotalZar,
    policy,
  });

  if (!discountZar || discountZar === "0.00") {
    return {
      eligible: false,
      discountAmountZar: "0.00",
      reason: successfulStoreOrdersBefore > 0 ? "NOT_FIRST_ORDER" : "POLICY_INELIGIBLE",
      customerSignupAt: customer.createdAt,
      expiresAt,
    };
  }

  return {
    eligible: true,
    discountAmountZar: discountZar,
    customerSignupAt: customer.createdAt,
    expiresAt,
  };
}
