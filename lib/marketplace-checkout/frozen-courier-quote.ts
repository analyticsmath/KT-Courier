/** Validate the version emitted by the persisted quote authority. A paid
 * quote may have expired after capture; its immutable binding still applies. */
export function isFrozenCourierQuote(input: { quote: { id: string; currency: string; storeId: string | null; calculationVersion: string; ruleSnapshot: unknown }; storeId: string; reference: string; version: string }): boolean {
  const { quote } = input;
  if (quote.id !== input.reference || quote.storeId !== input.storeId || quote.currency !== "ZAR") return false;
  if (quote.calculationVersion === "marketplace-courier-tariff-v1") {
    const rules = quote.ruleSnapshot as { serviceKey?: unknown; serviceVersion?: unknown; serviceDefinitionId?: unknown; policyAuthority?: unknown } | null;
    return rules?.policyAuthority === "existing_courier_tariffs" && typeof rules.serviceKey === "string" && /^CLIENT_[A-Z0-9_]{2,40}$/.test(rules.serviceKey) && typeof rules.serviceDefinitionId === "string" && !!rules.serviceDefinitionId && Number.isSafeInteger(rules.serviceVersion) && Number(rules.serviceVersion) > 0 && input.version === `marketplace-courier:${rules.serviceKey}:${rules.serviceVersion}:${quote.id}`;
  }
  if (quote.calculationVersion === "marketplace-matrix-v1") {
    const rules = quote.ruleSnapshot as { policyVersion?: unknown; policyAuthority?: unknown } | null;
    return rules?.policyAuthority === "marketplace_delivery_matrix" && Number.isSafeInteger(rules.policyVersion) && Number(rules.policyVersion) > 0 && input.version === `marketplace-matrix:${rules.policyVersion}:${quote.id}`;
  }
  return input.version === `phase6:${quote.id}`;
}
