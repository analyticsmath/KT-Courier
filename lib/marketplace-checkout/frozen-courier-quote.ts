/** Validate the version emitted by the persisted quote authority. A paid
 * quote may have expired after capture; its immutable binding still applies. */
export function isFrozenCourierQuote(input: { quote: { id: string; currency: string; storeId: string | null; calculationVersion: string; ruleSnapshot: unknown }; storeId: string; reference: string; version: string }): boolean {
  const { quote } = input;
  if (quote.id !== input.reference || quote.storeId !== input.storeId || quote.currency !== "ZAR") return false;
  if (quote.calculationVersion === "marketplace-matrix-v1") {
    const rules = quote.ruleSnapshot as { policyVersion?: unknown; policyAuthority?: unknown } | null;
    return rules?.policyAuthority === "marketplace_delivery_matrix" && Number.isSafeInteger(rules.policyVersion) && Number(rules.policyVersion) > 0 && input.version === `marketplace-matrix:${rules.policyVersion}:${quote.id}`;
  }
  return input.version === `phase6:${quote.id}`;
}
