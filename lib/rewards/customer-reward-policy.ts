/**
 * Owner-approved Phase 3 customer incentives. These functions are deterministic
 * policy checks only; they neither post money nor entitle an unverified order.
 *
 * ZAR is represented in integer cents throughout. ProviderPaidZar is the
 * actually captured digital portion, excluding wallet funding already; never
 * subtract wallet again. VAT/refunds are independently excluded.
 */
export type CustomerRewardPolicy = Readonly<{
  pointsPerZar: number;
  conversionPoints: number;
  conversionWalletZar: string;
  referralRewardZar: string;
  firstStoreDiscountZar: string;
  firstStoreValidDays: number;
  firstStoreMinimumZar: string;
}>;

export const DEFAULT_CUSTOMER_REWARD_POLICY: CustomerRewardPolicy = Object.freeze({
  pointsPerZar: 1,
  conversionPoints: 100,
  conversionWalletZar: "2.00",
  referralRewardZar: "5.00",
  firstStoreDiscountZar: "50.00",
  firstStoreValidDays: 7,
  firstStoreMinimumZar: "0.00",
});

const MAX_ZAR_CENTS = 999999999999999999n; // DECIMAL(18,2)

export function zarToCents(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)\.\d{2}$/.test(value)) {
    throw new Error("Commercial ZAR amounts require canonical nonnegative two-decimal notation.");
  }
  const [rand, cents] = value.split(".");
  const total = BigInt(rand) * 100n + BigInt(cents);
  if (total > MAX_ZAR_CENTS) throw new Error("Commercial amount exceeds the supported ZAR limit.");
  return total;
}

export function centsToZar(cents: bigint): string {
  if (cents < 0n || cents > MAX_ZAR_CENTS) {
    throw new Error("Commercial amount is outside the supported ZAR range.");
  }
  return String(cents / 100n) + "." + (cents % 100n).toString().padStart(2, "0");
}

export function validateCustomerRewardPolicy(policy: CustomerRewardPolicy): CustomerRewardPolicy {
  if (!Number.isSafeInteger(policy.pointsPerZar) || policy.pointsPerZar < 0 || policy.pointsPerZar > 1000) {
    throw new Error("Loyalty points per rand must be a nonnegative whole number.");
  }
  if (!Number.isSafeInteger(policy.conversionPoints) || policy.conversionPoints < 1 || policy.conversionPoints > 1000000) {
    throw new Error("Conversion points must be a positive whole number.");
  }
  if (!Number.isSafeInteger(policy.firstStoreValidDays) || policy.firstStoreValidDays < 1 || policy.firstStoreValidDays > 365) {
    throw new Error("First-store offer validity must be a whole number of days.");
  }
  if (zarToCents(policy.conversionWalletZar) > 1000000n
    || zarToCents(policy.referralRewardZar) > 100000n
    || zarToCents(policy.firstStoreDiscountZar) > 10000000n
    || zarToCents(policy.firstStoreMinimumZar) > 100000000n) {
    throw new Error("Commercial policy exceeds its approved range.");
  }
  return Object.freeze({ ...policy });
}

export function earnedCustomerPoints(input: Readonly<{
  /** Captured ZAR from card/EFT, excluding wallet-funded payment. */
  providerPaidZar: string;
  /** VAT charged on the order, which never earns points. */
  vatZar: string;
  /** Refunds already completed against the original external capture. */
  refundedProviderZar: string;
  /** Successful financial completion is independently verified, not self-reported. */
  paymentVerified: boolean;
  /** The order must have reached the business-defined successful completion. */
  orderCompleted: boolean;
  pointsPerZar: number;
}>): bigint {
  if (!Number.isSafeInteger(input.pointsPerZar) || input.pointsPerZar < 0 || input.pointsPerZar > 1000) {
    throw new Error("Invalid loyalty points conversion rate.");
  }
  const paid = zarToCents(input.providerPaidZar);
  const vat = zarToCents(input.vatZar);
  const refunded = zarToCents(input.refundedProviderZar);
  if (vat > paid || refunded > paid || vat + refunded > paid) {
    throw new Error("VAT and refunds exceed verified external funding.");
  }
  if (!input.paymentVerified || !input.orderCompleted) return 0n;
  return ((paid - vat - refunded) / 100n) * BigInt(input.pointsPerZar);
}

export function loyaltyWalletConversion(input: Readonly<{
  availablePoints: bigint;
  requestedPoints: bigint;
  conversionPoints: number;
  conversionWalletZar: string;
}>): Readonly<{ pointsRedeemed: bigint; walletCreditZar: string; remainingPoints: bigint }> {
  if (!Number.isSafeInteger(input.conversionPoints) || input.conversionPoints < 1 || input.conversionPoints > 1000000) {
    throw new Error("Invalid loyalty redemption points rate.");
  }
  if (input.availablePoints < 0n || input.requestedPoints <= 0n || input.requestedPoints > input.availablePoints) {
    throw new Error("Insufficient or invalid points for redemption.");
  }
  const block = BigInt(input.conversionPoints);
  if (input.requestedPoints % block !== 0n) throw new Error("Points must be redeemed in whole conversion blocks.");
  const credit = zarToCents(input.conversionWalletZar) * (input.requestedPoints / block);
  if (credit === 0n) throw new Error("Zero-value conversions are disabled.");
  return Object.freeze({
    pointsRedeemed: input.requestedPoints,
    walletCreditZar: centsToZar(credit),
    remainingPoints: input.availablePoints - input.requestedPoints,
  });
}

export type StoreWelcomeInput = Readonly<{
  orderType: "MARKETPLACE" | "PARCEL";
  customerSignupAt: Date;
  checkedAt: Date;
  successfulStoreOrdersBefore: number;
  priorWelcomeOfferRedemptions: number;
  merchandiseSubtotalZar: string;
  policy: Pick<CustomerRewardPolicy, "firstStoreDiscountZar" | "firstStoreValidDays" | "firstStoreMinimumZar">;
}>;

export function firstStoreWelcomeDiscount(input: StoreWelcomeInput): string | null {
  const value = zarToCents(input.policy.firstStoreDiscountZar);
  const minimum = zarToCents(input.policy.firstStoreMinimumZar);
  const merchandise = zarToCents(input.merchandiseSubtotalZar);
  if (!Number.isSafeInteger(input.policy.firstStoreValidDays) || input.policy.firstStoreValidDays < 1 || input.policy.firstStoreValidDays > 365) {
    throw new Error("Invalid first-store offer validity.");
  }
  if (input.orderType !== "MARKETPLACE"
    || !Number.isSafeInteger(input.successfulStoreOrdersBefore) || input.successfulStoreOrdersBefore !== 0
    || !Number.isSafeInteger(input.priorWelcomeOfferRedemptions) || input.priorWelcomeOfferRedemptions !== 0
    || !Number.isFinite(input.checkedAt.getTime()) || !Number.isFinite(input.customerSignupAt.getTime())
    || input.checkedAt < input.customerSignupAt
    || input.checkedAt.getTime() >= input.customerSignupAt.getTime() + input.policy.firstStoreValidDays * 86400000
    || merchandise < minimum || merchandise === 0n || value === 0n) return null;
  return centsToZar(merchandise < value ? merchandise : value);
}

export function ordinaryReferralReward(input: Readonly<{
  referrerOwnerType: "CUSTOMER" | "STORE" | "PROMOTER" | "DRIVER";
  referrerUserId: string;
  referredUserId: string;
  verifiedFirstPaidOrder: boolean;
  qualifyingPaidOrderCount: number;
  previouslyRewardedReferredUser: boolean;
  rewardZar: string;
}>): string | null {
  const cents = zarToCents(input.rewardZar);
  if (input.referrerOwnerType !== "CUSTOMER" && input.referrerOwnerType !== "STORE") return null;
  if (!input.referrerUserId.trim() || !input.referredUserId.trim()
    || input.referrerUserId === input.referredUserId
    || !input.verifiedFirstPaidOrder || input.qualifyingPaidOrderCount !== 1
    || input.previouslyRewardedReferredUser || cents === 0n) return null;
  return centsToZar(cents);
}
