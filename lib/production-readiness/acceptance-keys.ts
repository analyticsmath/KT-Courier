export const FINANCIAL_LIVE_ACCEPTANCE_KEYS = new Set<string>([
  "payment_integration_acceptance",
  "settlement_acceptance",
  "refund_acceptance",
  "payout_acceptance",
]);

export const NON_FINANCIAL_LIVE_ACCEPTANCE_KEYS = new Set<string>([
  "vendor_onboarding_acceptance",
  "driver_onboarding_acceptance",
  "driver_gps_acceptance",
  "pod_otp_acceptance",
]);

export function requiresFinancialAuthorizationReference(key: string): boolean {
  return FINANCIAL_LIVE_ACCEPTANCE_KEYS.has(key);
}

export const acceptanceKeys = [
  "vendor_onboarding_acceptance",
  "driver_onboarding_acceptance",
  "driver_gps_acceptance",
  "pod_otp_acceptance",
  "payment_integration_acceptance",
  "settlement_acceptance",
  "refund_acceptance",
  "payout_acceptance",
  "current_ci_certification",
  "production_deployment_sha_parity",
] as const;

export type AcceptanceKey = (typeof acceptanceKeys)[number];

export const qaFunctionalKeys = [
  "qa_vendor_onboarding_workflow",
  "qa_driver_onboarding_workflow",
  "qa_driver_simulated_gps_workflow",
  "qa_pod_otp_pdf_workflow",
  "qa_marketplace_checkout_sandbox_workflow",
  "qa_isolated_settlement_workflow",
] as const;

export type QaFunctionalKey = (typeof qaFunctionalKeys)[number];
