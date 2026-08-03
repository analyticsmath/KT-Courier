import { DeterministicRefundProviderAdapter } from "@/lib/refunds/providers/refund-provider-adapter";

export function requireDisposableRefundIntegrationEnvironment(): void {
  if (process.env.KT_REFUND_INTEGRATION_APPROVED !== "true") throw new Error("Refund integration validation was not explicitly approved.");
  const project = process.env.KT_SMOKE_PROJECT_NAME ?? "";
  if (!/^kt-couriers-refund-[a-z0-9-]+$/i.test(project)) throw new Error("Refund integration tests require a uniquely named disposable Compose project.");
  if (!process.env.DATABASE_URL || !/refund|test/i.test(process.env.DATABASE_URL)) throw new Error("Refund integration database identity is not isolated.");
}

export const deterministicRefundAdapter = new DeterministicRefundProviderAdapter("PAYFAST", { status: "SUCCEEDED", providerRefundId: "PF-DETERMINISTIC-REFUND", providerStatusCode: "FIXTURE_SUCCESS", definitive: true }, { status: "SUCCEEDED", providerRefundId: "PF-DETERMINISTIC-REFUND", providerStatusCode: "FIXTURE_QUERY_SUCCESS", definitive: true });
