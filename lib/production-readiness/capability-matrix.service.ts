import type { AcceptanceRecord } from "./evidence";
import type { Capability } from "./contracts";
import type { SafeProviderConfigurationState } from "@/lib/payments/providers/provider-config";
import { REFUND_PRODUCTION_READINESS, REFUND_PRODUCTION_VALIDATION_APPROVED } from "@/lib/refunds/refund-production-readiness";
import { WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED } from "@/lib/withdrawals/withdrawal-production-readiness";
import { PROMOTIONS_PRODUCTION_VALIDATION_APPROVED } from "@/lib/promotions/production-lock";
import { SUBSCRIPTIONS_PRODUCTION_VALIDATION_APPROVED } from "@/lib/subscriptions/production-lock";
import { PROMOTERS_PRODUCTION_VALIDATION_APPROVED } from "@/lib/promoters/production-readiness";
import { ADVERTISING_PRODUCTION_VALIDATION_APPROVED } from "@/lib/advertising/production-lock";
import { REPORTING_PRODUCTION_VALIDATION_APPROVED } from "@/lib/reporting/production-readiness";
import { DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED } from "@/lib/developer-api/production-readiness";
import { DELEGATED_COMPOSITE_PROCESSORS, productionProcessors } from "@/lib/processors/production-loop";
import { PROCESSOR_REGISTRY } from "@/lib/processors/processor-registry";
import { isDisposableBrowserValidationAllowed, isLocalCheckoutValidationAllowed, isLocalFullFlowAllowed } from "@/lib/testing/safe-postgres-validator";

export type CapabilityMatrixKey =
  | "PAYSTACK_CARD"
  | "PAYSTACK_EFT"
  | "PAYSTACK_REFUNDS_AND_TRANSFERS"
  | "COD_DEPOSIT_AND_CASH"
  | "STORE_CHECKOUT"
  | "STORE_GO_LIVE_CERTIFICATION"
  | "PROMOTIONS"
  | "LOYALTY_AND_REFERRALS"
  | "NOTIFICATIONS_AND_EMAIL"
  | "GOOGLE_MAPS"
  | "PROCESSOR_LOOP"
  | "SUBSCRIPTIONS"
  | "PROMOTERS"
  | "ADVERTISING"
  | "REPORTING"
  | "DEVELOPER_API"
  | "PRIVACY_AND_RETENTION";

export interface CapabilityMatrixEntry {
  readonly key: CapabilityMatrixKey;
  readonly label: string;
  readonly sourceImplemented: boolean;
  readonly isolatedTestPassSha: string | null;
  readonly runtimeConfigured: boolean;
  readonly externalEntitlementApproved: boolean;
  readonly adminPolicyEffective: boolean;
  readonly schedulerRegisteredAndHealthy: boolean | null;
  readonly eligibleForLiveUse: boolean;
  readonly lastBlockerCode: string | null;
}

export interface CapabilityMatrixInputs {
  readonly now: Date;
  readonly releaseSha: string | null;
  readonly capabilities: readonly Capability[];
  readonly paystack: SafeProviderConfigurationState;
  readonly acceptanceRecords: readonly AcceptanceRecord[];
  readonly heartbeat?: {
    observedAt?: string;
    healthy?: boolean;
    readinessBlockers?: string[];
    processors?: Array<{ name: string; status: string; itemsRetried?: number; activationState?: string; blockerCode?: string | null }>;
  } | null;
  readonly storeOrderPolicyActive?: boolean;
  readonly activePrivacyPolicyCount?: number;
  readonly referralRewardIssuingEnabled?: boolean;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

function findCapability(capabilities: readonly Capability[], key: string): Capability | undefined {
  return capabilities.find((item) => item.key === key);
}

function isReadyCapability(capabilities: readonly Capability[], key: string): boolean {
  return findCapability(capabilities, key)?.status === "READY";
}

function isHeartbeatHealthy(
  heartbeat: CapabilityMatrixInputs["heartbeat"],
  now: Date,
  requiredProcessors: readonly string[],
): boolean {
  if (!heartbeat?.observedAt || heartbeat.healthy !== true) return false;
  const age = now.getTime() - new Date(heartbeat.observedAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age >= 420_000) return false;
  if ((heartbeat.readinessBlockers ?? []).length > 0) return false;
  const map = new Map((heartbeat.processors ?? []).map((p) => [p.name, p]));
  return requiredProcessors.every((name) => {
    const entry = map.get(name);
    return !!entry && ["COMPLETED", "IDLE", "PEER_LEASE"].includes(entry.status) && (entry.itemsRetried ?? 0) === 0;
  });
}

function resolveIsolatedTestPassSha(
  acceptanceRecords: readonly AcceptanceRecord[],
  releaseSha: string | null,
): string | null {
  const ci = acceptanceRecords.find(
    (record) => record.evidence.key === "current_ci_certification" && record.status === "APPROVED" && !!record.approverId && record.approverId !== record.authorId,
  );
  if (!ci) return null;
  if (releaseSha && ci.evidence.releaseSha !== releaseSha) return null;
  return ci.evidence.releaseSha;
}

function buildRow(row: Omit<CapabilityMatrixEntry, "eligibleForLiveUse">): CapabilityMatrixEntry {
  const eligibleForLiveUse =
    row.sourceImplemented &&
    row.runtimeConfigured &&
    row.externalEntitlementApproved &&
    row.adminPolicyEffective &&
    row.schedulerRegisteredAndHealthy !== false &&
    row.lastBlockerCode === null;
  return Object.freeze({ ...row, eligibleForLiveUse });
}

export function buildCapabilityMatrix(inputs: CapabilityMatrixInputs): readonly CapabilityMatrixEntry[] {
  const env = inputs.env ?? process.env;
  const caps = inputs.capabilities;
  const isolatedSha = resolveIsolatedTestPassSha(inputs.acceptanceRecords, inputs.releaseSha);
  const eftChannelApproved = env.PAYSTACK_EFT_CHANNEL_ENABLED?.trim().toLowerCase() === "true";
  const paystackLiveConfigured = inputs.paystack.configured && inputs.paystack.active;
  const paystackLiveProd = paystackLiveConfigured && inputs.paystack.environment === "production";
  const checkoutAllowedByFlag =
    isLocalFullFlowAllowed(env as NodeJS.ProcessEnv) ||
    isDisposableBrowserValidationAllowed(env as NodeJS.ProcessEnv) ||
    isLocalCheckoutValidationAllowed(env as NodeJS.ProcessEnv) ||
    env.CHECKOUT_PUBLIC_ENABLED === "true";
  const checkoutGate =
    paystackLiveConfigured && checkoutAllowedByFlag
      ? { enabled: true, blockReason: null as string | null }
      : {
          enabled: false,
          blockReason: !checkoutAllowedByFlag
            ? "CHECKOUT_PUBLIC_DISABLED"
            : (inputs.paystack.blockReason ?? "PAYSTACK_DISABLED"),
        };

  const databaseReady = isReadyCapability(caps, "database");
  const redisReady = isReadyCapability(caps, "redis");
  const paymentAccepted = isReadyCapability(caps, "payment_integration_acceptance");
  const settlementAccepted = isReadyCapability(caps, "settlement_acceptance");
  const refundAccepted = isReadyCapability(caps, "refund_acceptance");
  const payoutAccepted = isReadyCapability(caps, "payout_acceptance");
  const vendorAccepted = isReadyCapability(caps, "vendor_onboarding_acceptance");

  const webhookHealthy = isReadyCapability(caps, "paystack_webhook_processing");
  const eventProcessorHealthy = isReadyCapability(caps, "payment_event_processor");
  const emailProviderReady = isReadyCapability(caps, "email_provider");
  const googleMapsReady = isReadyCapability(caps, "google_maps_browser") && isReadyCapability(caps, "google_maps_server");
  const courierServicesReady = isReadyCapability(caps, "courier_services");
  const coverageReady = isReadyCapability(caps, "operational_coverage");
  const parcelProfilesReady = isReadyCapability(caps, "parcel_profiles");
  const commissionReady = isReadyCapability(caps, "approved_commission_plan");
  const marketplaceDeliveryReady = isReadyCapability(caps, "marketplace_delivery_fee_matrix");
  const codPolicyReady = isReadyCapability(caps, "cod_policy");
  const codRemittanceReady = isReadyCapability(caps, "cod_remittance");
  const notificationGovReady =
    isReadyCapability(caps, "notification_templates") &&
    isReadyCapability(caps, "notification_recipient_policy") &&
    isReadyCapability(caps, "notification_routes") &&
    isReadyCapability(caps, "notification_domain_engineering");
  const totalRegisteredCheck =
    new Set([...productionProcessors, ...Object.keys(DELEGATED_COMPOSITE_PROCESSORS)]).size ===
    Object.keys(PROCESSOR_REGISTRY).length;

  const coreLoopHealthy = isHeartbeatHealthy(inputs.heartbeat, inputs.now, [
    "apply-paystack-webhook-events",
    "consume-verified-payment-events",
    "deliver-notifications",
    "scan-payment-reconciliation",
  ]);

  const cardBlocker = !paystackLiveConfigured
    ? (inputs.paystack.blockReason ?? "PAYSTACK_DISABLED")
    : !checkoutGate.enabled
      ? (checkoutGate.blockReason ?? "CHECKOUT_PUBLIC_DISABLED")
      : !paystackLiveProd
        ? "PAYSTACK_NOT_IN_PRODUCTION_MODE"
        : !paymentAccepted
          ? "PAYMENT_INTEGRATION_ACCEPTANCE_REQUIRED"
          : !(webhookHealthy && eventProcessorHealthy)
            ? "PAYMENT_PROCESSORS_NOT_HEALTHY"
            : null;

  const eftBlocker = !paystackLiveConfigured
    ? (inputs.paystack.blockReason ?? "PAYSTACK_DISABLED")
    : !eftChannelApproved
      ? "PAYSTACK_EFT_CHANNEL_UNAPPROVED"
      : !paystackLiveProd
        ? "PAYSTACK_NOT_IN_PRODUCTION_MODE"
        : !paymentAccepted
          ? "PAYMENT_INTEGRATION_ACCEPTANCE_REQUIRED"
          : !(webhookHealthy && eventProcessorHealthy)
            ? "PAYMENT_PROCESSORS_NOT_HEALTHY"
            : null;

  const refundBlocker = !REFUND_PRODUCTION_VALIDATION_APPROVED
    ? REFUND_PRODUCTION_READINESS.blockReason
    : !WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED
      ? "WITHDRAWAL_CONSOLIDATED_VALIDATION_NOT_APPROVED"
      : !paystackLiveProd
        ? "PAYSTACK_NOT_IN_PRODUCTION_MODE"
        : !(refundAccepted && payoutAccepted)
          ? "REFUND_AND_PAYOUT_ACCEPTANCE_REQUIRED"
          : null;

  const codBlocker = !codPolicyReady
    ? (findCapability(caps, "cod_policy")?.reasonCode ?? "COD_APPROVED_SCOPE_MISSING")
    : !codRemittanceReady
      ? (findCapability(caps, "cod_remittance")?.reasonCode ?? "COD_REMITTANCE_APPROVAL_REQUIRED")
      : !settlementAccepted
        ? "SETTLEMENT_ACCEPTANCE_REQUIRED"
        : null;

  const storeCheckoutBlocker = !databaseReady || !redisReady
    ? "INFRASTRUCTURE_UNREADY"
    : !paystackLiveConfigured
      ? (inputs.paystack.blockReason ?? "PAYSTACK_DISABLED")
      : !checkoutGate.enabled
        ? (checkoutGate.blockReason ?? "CHECKOUT_PUBLIC_DISABLED")
        : !marketplaceDeliveryReady
          ? (findCapability(caps, "marketplace_delivery_fee_matrix")?.reasonCode ?? "MARKETPLACE_DELIVERY_UNREADY")
          : !commissionReady
            ? "NO_APPROVED_COMMERCIAL_CONFIGURATION"
            : !inputs.storeOrderPolicyActive
              ? "STORE_ORDER_OPERATIONAL_POLICY_REQUIRED"
              : !paystackLiveProd
                ? "PAYSTACK_NOT_IN_PRODUCTION_MODE"
                : !paymentAccepted
                  ? "PAYMENT_INTEGRATION_ACCEPTANCE_REQUIRED"
                  : !coreLoopHealthy
                    ? "PROCESSOR_LOOP_NOT_HEALTHY"
                    : null;

  const storeLiveBlocker = !courierServicesReady
    ? "NO_ACTIVE_SERVICE"
    : !coverageReady
      ? (findCapability(caps, "operational_coverage")?.reasonCode ?? "COVERAGE_INCOMPLETE")
      : !parcelProfilesReady
        ? "PARCEL_OPERATIONAL_APPROVAL_REQUIRED"
        : !isReadyCapability(caps, "google_maps_server")
          ? "GOOGLE_MAPS_SERVER_UNCONFIGURED"
          : !vendorAccepted
            ? "VENDOR_ONBOARDING_ACCEPTANCE_REQUIRED"
            : null;

  const loyaltyBlocker = !(env.KT_ORDINARY_REFERRAL_WORKER_AUTHORIZED === "true")
    ? "ORDINARY_REFERRAL_WORKER_UNAUTHORIZED"
    : !inputs.referralRewardIssuingEnabled
      ? "REFERRAL_REWARD_ISSUING_DISABLED"
      : null;

  const notificationBlocker = !emailProviderReady
    ? "EMAIL_PROVIDER_UNCONFIGURED"
    : !notificationGovReady
      ? (findCapability(caps, "notification_domain_engineering")?.reasonCode ?? "NOTIFICATION_GOVERNANCE_PENDING")
      : !coreLoopHealthy
        ? "NOTIFICATION_WORKER_NOT_HEALTHY"
        : null;

  return Object.freeze([
    buildRow({
      key: "PAYSTACK_CARD",
      label: "Paystack Card Checkout",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: paystackLiveConfigured && checkoutGate.enabled,
      externalEntitlementApproved: paystackLiveProd && paymentAccepted,
      adminPolicyEffective: courierServicesReady && coverageReady,
      schedulerRegisteredAndHealthy: webhookHealthy && eventProcessorHealthy,
      lastBlockerCode: cardBlocker,
    }),
    buildRow({
      key: "PAYSTACK_EFT",
      label: "Paystack Hosted EFT Channel",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: paystackLiveConfigured && eftChannelApproved,
      externalEntitlementApproved: paystackLiveProd && eftChannelApproved && paymentAccepted,
      adminPolicyEffective: courierServicesReady && coverageReady && eftChannelApproved,
      schedulerRegisteredAndHealthy: webhookHealthy && eventProcessorHealthy,
      lastBlockerCode: eftBlocker,
    }),
    buildRow({
      key: "PAYSTACK_REFUNDS_AND_TRANSFERS",
      label: "Paystack Refunds & Transfers",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: paystackLiveConfigured,
      externalEntitlementApproved: REFUND_PRODUCTION_VALIDATION_APPROVED && WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED && paystackLiveProd && refundAccepted && payoutAccepted,
      adminPolicyEffective: REFUND_PRODUCTION_VALIDATION_APPROVED && WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED,
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["scan-refund-reconciliation", "scan-withdrawal-reconciliation", "scan-paystack-transfer-reconciliation"]),
      lastBlockerCode: refundBlocker,
    }),
    buildRow({
      key: "COD_DEPOSIT_AND_CASH",
      label: "COD 50/50 & Driver Cash Custody",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: databaseReady && codRemittanceReady,
      externalEntitlementApproved: codPolicyReady && codRemittanceReady && settlementAccepted,
      adminPolicyEffective: codPolicyReady,
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["process-earning-lifecycle"]),
      lastBlockerCode: codBlocker,
    }),
    buildRow({
      key: "STORE_CHECKOUT",
      label: "Marketplace Store Checkout",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: databaseReady && redisReady && paystackLiveConfigured && checkoutGate.enabled,
      externalEntitlementApproved: paystackLiveProd && paymentAccepted,
      adminPolicyEffective: marketplaceDeliveryReady && commissionReady && Boolean(inputs.storeOrderPolicyActive),
      schedulerRegisteredAndHealthy: coreLoopHealthy,
      lastBlockerCode: storeCheckoutBlocker,
    }),
    buildRow({
      key: "STORE_GO_LIVE_CERTIFICATION",
      label: "Store Two-Reviewer Go-Live",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: databaseReady && isReadyCapability(caps, "google_maps_server"),
      externalEntitlementApproved: vendorAccepted,
      adminPolicyEffective: courierServicesReady && coverageReady && parcelProfilesReady,
      schedulerRegisteredAndHealthy: null,
      lastBlockerCode: storeLiveBlocker,
    }),
    buildRow({
      key: "PROMOTIONS",
      label: "Welcome R50, Coupons & Cashback",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: databaseReady,
      externalEntitlementApproved: PROMOTIONS_PRODUCTION_VALIDATION_APPROVED,
      adminPolicyEffective: PROMOTIONS_PRODUCTION_VALIDATION_APPROVED && env.KT_PROMOTION_EXPIRY_WORKER_ENABLED === "true",
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["end-expired-promotions"]),
      lastBlockerCode: PROMOTIONS_PRODUCTION_VALIDATION_APPROVED ? null : "CONSOLIDATED_VALIDATION_NOT_APPROVED",
    }),
    buildRow({
      key: "LOYALTY_AND_REFERRALS",
      label: "Loyalty 100→R2 & R5 Referrals",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: databaseReady,
      externalEntitlementApproved: env.KT_ORDINARY_REFERRAL_WORKER_AUTHORIZED === "true",
      adminPolicyEffective: Boolean(inputs.referralRewardIssuingEnabled),
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["reconcile-customer-parcel-loyalty", "process-ordinary-referral-awards"]),
      lastBlockerCode: loyaltyBlocker,
    }),
    buildRow({
      key: "NOTIFICATIONS_AND_EMAIL",
      label: "Notifications & Multi-Owner Alerts",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: emailProviderReady,
      externalEntitlementApproved: env.NOTIFICATION_PRODUCTION_VALIDATION_APPROVED === "true",
      adminPolicyEffective: notificationGovReady,
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["deliver-notifications"]),
      lastBlockerCode: notificationBlocker,
    }),
    buildRow({
      key: "GOOGLE_MAPS",
      label: "Google Maps Geocoding & Routing",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: googleMapsReady,
      externalEntitlementApproved: googleMapsReady,
      adminPolicyEffective: coverageReady,
      schedulerRegisteredAndHealthy: null,
      lastBlockerCode: !googleMapsReady ? "GOOGLE_MAPS_CONFIGURATION_MISSING" : !coverageReady ? "OPERATIONAL_COVERAGE_INCOMPLETE" : null,
    }),
    buildRow({
      key: "PROCESSOR_LOOP",
      label: "29-Processor Worker Loop",
      sourceImplemented: totalRegisteredCheck,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: totalRegisteredCheck,
      externalEntitlementApproved: true,
      adminPolicyEffective: (inputs.heartbeat?.readinessBlockers ?? []).length === 0,
      schedulerRegisteredAndHealthy: totalRegisteredCheck && coreLoopHealthy,
      lastBlockerCode: !totalRegisteredCheck
        ? "PROCESSOR_REGISTRY_LOOP_DRIFT"
        : !coreLoopHealthy
          ? (inputs.heartbeat?.readinessBlockers?.[0] ?? "PROCESSOR_HEARTBEAT_STALE_OR_UNHEALTHY")
          : null,
    }),
    buildRow({
      key: "SUBSCRIPTIONS",
      label: "Merchant Subscriptions",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: databaseReady && paystackLiveConfigured,
      externalEntitlementApproved: SUBSCRIPTIONS_PRODUCTION_VALIDATION_APPROVED,
      adminPolicyEffective: SUBSCRIPTIONS_PRODUCTION_VALIDATION_APPROVED,
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["process-subscription-renewals"]),
      lastBlockerCode: SUBSCRIPTIONS_PRODUCTION_VALIDATION_APPROVED ? null : "SUBSCRIPTIONS_CONSOLIDATED_VALIDATION_NOT_APPROVED",
    }),
    buildRow({
      key: "PROMOTERS",
      label: "Promoter / KT50 Hierarchy",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: databaseReady,
      externalEntitlementApproved: PROMOTERS_PRODUCTION_VALIDATION_APPROVED,
      adminPolicyEffective: PROMOTERS_PRODUCTION_VALIDATION_APPROVED,
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["process-promoter-qualifications"]),
      lastBlockerCode: PROMOTERS_PRODUCTION_VALIDATION_APPROVED ? null : "PROMOTERS_CONSOLIDATED_VALIDATION_NOT_APPROVED",
    }),
    buildRow({
      key: "ADVERTISING",
      label: "Advertising Clicks & Managed Marketing",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: databaseReady,
      externalEntitlementApproved: ADVERTISING_PRODUCTION_VALIDATION_APPROVED,
      adminPolicyEffective: ADVERTISING_PRODUCTION_VALIDATION_APPROVED,
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["process-valid-click-charges", "process-managed-marketing-lifecycle"]),
      lastBlockerCode: ADVERTISING_PRODUCTION_VALIDATION_APPROVED ? null : "ADVERTISING_CONSOLIDATED_VALIDATION_NOT_APPROVED",
    }),
    buildRow({
      key: "REPORTING",
      label: "Periodic Reports & CSV Exports",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: isReadyCapability(caps, "report_artifact_storage"),
      externalEntitlementApproved: REPORTING_PRODUCTION_VALIDATION_APPROVED,
      adminPolicyEffective: REPORTING_PRODUCTION_VALIDATION_APPROVED,
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["generate-report-jobs", "expire-report-artifacts"]),
      lastBlockerCode: !REPORTING_PRODUCTION_VALIDATION_APPROVED
        ? "REPORTING_CONSOLIDATED_VALIDATION_NOT_APPROVED"
        : !isReadyCapability(caps, "report_artifact_storage")
          ? "REPORT_ARTIFACT_STORAGE_UNCONFIGURED"
          : null,
    }),
    buildRow({
      key: "DEVELOPER_API",
      label: "Developer API & Outbound Webhooks",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: databaseReady,
      externalEntitlementApproved: DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED,
      adminPolicyEffective: DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED,
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["deliver-developer-webhooks", "expire-developer-api-credentials"]),
      lastBlockerCode: DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED ? null : "DEVELOPER_API_CONSOLIDATED_VALIDATION_NOT_APPROVED",
    }),
    buildRow({
      key: "PRIVACY_AND_RETENTION",
      label: "POPIA Privacy & Retention Legal Holds",
      sourceImplemented: true,
      isolatedTestPassSha: isolatedSha,
      runtimeConfigured: isReadyCapability(caps, "private_media_storage"),
      externalEntitlementApproved: true,
      adminPolicyEffective: (inputs.activePrivacyPolicyCount ?? 0) > 0,
      schedulerRegisteredAndHealthy: isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["process-privacy-requests", "process-data-retention"]),
      lastBlockerCode: !isReadyCapability(caps, "private_media_storage")
        ? "PRIVATE_MEDIA_STORAGE_UNCONFIGURED"
        : (inputs.activePrivacyPolicyCount ?? 0) === 0
          ? "ACTIVE_PRIVATE_MEDIA_RETENTION_POLICY_REQUIRED"
          : !isHeartbeatHealthy(inputs.heartbeat, inputs.now, ["process-privacy-requests", "process-data-retention"])
            ? "PRIVACY_RETENTION_WORKERS_UNHEALTHY"
            : null,
    }),
  ]);
}
