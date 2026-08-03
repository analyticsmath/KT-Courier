export type StoreCommissionEntitlementRepository = Readonly<{
  findEligibility(input: Readonly<{ storeId: string; at: Date }>): Promise<Readonly<{ contractReference: string; billingCycleReference: string; grantReference: string; benefitReference: string; sourceVersion: string; approvedCommissionPlanReference: string; approvedCommissionPlanVersion: number }> | null>;
}>;

/** Returns only frozen eligibility for the existing Phase 14 plan resolver. */
export async function resolveStoreSubscriptionCommissionEligibility(repository: StoreCommissionEntitlementRepository, input: Readonly<{ storeId: string; at: Date }>) {
  const eligibility = await repository.findEligibility(input);
  return eligibility ? Object.freeze(eligibility) : null;
}
