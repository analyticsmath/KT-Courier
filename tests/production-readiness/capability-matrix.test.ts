import { describe, expect, it } from "vitest";
import { capability } from "@/lib/production-readiness/contracts";
import { buildCapabilityMatrix } from "@/lib/production-readiness/capability-matrix.service";
import type { AcceptanceRecord } from "@/lib/production-readiness/evidence";
import type { SafeProviderConfigurationState } from "@/lib/payments/providers/provider-config";
import { productionProcessors } from "@/lib/processors/production-loop";

const SHA = "255b94e0998dc1e65ca803a02ae048b18155f959";

function paystackState(overrides: Partial<SafeProviderConfigurationState> = {}): SafeProviderConfigurationState {
  return {
    code: "PAYSTACK",
    configured: false,
    active: false,
    credentialVersionConfigured: false,
    sourceAddressTrustConfigured: true,
    itnVerificationImplemented: true,
    productionValidationApproved: false,
    environment: "not-configured",
    errorCategory: "CONFIGURATION",
    blockReason: "PROVIDER_DISABLED",
    ...overrides,
  };
}

function makeAcceptance(key: AcceptanceRecord["evidence"]["key"]): AcceptanceRecord {
  return {
    version: 1,
    status: "APPROVED",
    authorId: "author-1",
    approverId: "approver-2",
    approvedAt: "2026-11-15T09:00:00.000Z",
    evidence:
      key === "current_ci_certification"
        ? {
            kind: "CI",
            key,
            releaseSha: SHA,
            observedAt: "2026-11-15T08:00:00.000Z",
            expiresAt: "2026-12-15T08:00:00.000Z",
            evidenceReference: "ci-run-43665487349",
            reason: "Exact SHA CI certification passed.",
            runUrl: "https://github.com/analyticsmath/KT-Courier/actions/runs/43665487349",
            conclusion: "SUCCESS",
            skippedCriticalTests: 0,
            testsPassed: 5715,
          }
        : {
            kind: "LIVE",
            key: key as Exclude<typeof key, "current_ci_certification" | "production_deployment_sha_parity">,
            releaseSha: SHA,
            observedAt: "2026-11-15T08:00:00.000Z",
            expiresAt: "2026-12-15T08:00:00.000Z",
            evidenceReference: `live-auth-${key}`,
            reason: "Independent commercial signoff recorded.",
            genuineOperatorAcceptance: true,
            financialAuthorizationReference: `fin-auth-${key}`,
          },
  };
}

describe("Central Read-Only Capability Matrix (F08 / CR-162 / CR-165)", () => {
  it("reports sourceImplemented true while keeping unconfigured/locked capabilities honestly blocked", () => {
    const now = new Date("2026-11-15T10:00:00.000Z");
    const matrix = buildCapabilityMatrix({
      now,
      releaseSha: SHA,
      capabilities: [
        capability("database", "READY", "CONFIGURED", "DB ok", "ENGINEERING"),
        capability("redis", "READY", "CONFIGURED", "Redis ok", "ENGINEERING"),
        capability("email_provider", "BLOCKED_CONFIGURATION", "CONFIGURATION_MISSING", "No email key", "OPERATIONS"),
        capability("google_maps_browser", "BLOCKED_CONFIGURATION", "CONFIGURATION_MISSING", "No browser key", "OPERATIONS"),
        capability("google_maps_server", "BLOCKED_CONFIGURATION", "CONFIGURATION_MISSING", "No server key", "OPERATIONS"),
      ],
      paystack: paystackState(),
      acceptanceRecords: [],
      heartbeat: null,
      storeOrderPolicyActive: false,
      activePrivacyPolicyCount: 0,
      referralRewardIssuingEnabled: false,
      env: { NODE_ENV: "production" },
    });

    expect(matrix.length).toBeGreaterThanOrEqual(17);
    for (const row of matrix) {
      expect(row.sourceImplemented).toBe(true);
      expect(row.eligibleForLiveUse).toBe(false);
    }

    const eft = matrix.find((r) => r.key === "PAYSTACK_EFT");
    expect(eft?.externalEntitlementApproved).toBe(false);
    expect(eft?.lastBlockerCode).toBe("PROVIDER_DISABLED");

    const refunds = matrix.find((r) => r.key === "PAYSTACK_REFUNDS_AND_TRANSFERS");
    expect(refunds?.externalEntitlementApproved).toBe(false);
    expect(refunds?.eligibleForLiveUse).toBe(false);
    expect(refunds?.lastBlockerCode).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");

    const email = matrix.find((r) => r.key === "NOTIFICATIONS_AND_EMAIL");
    expect(email?.runtimeConfigured).toBe(false);
    expect(email?.lastBlockerCode).toBe("EMAIL_PROVIDER_UNCONFIGURED");
  });

  it("distinguishes Card ready vs EFT unapproved on production runtime and preserves locked commercial modules", () => {
    const now = new Date("2026-11-15T10:00:00.000Z");
    const healthyHeartbeat = {
      observedAt: "2026-11-15T09:59:00.000Z",
      healthy: true,
      readinessBlockers: [],
      processors: productionProcessors.map((name) => ({ name, status: "IDLE", itemsRetried: 0 })),
    };
    const matrix = buildCapabilityMatrix({
      now,
      releaseSha: SHA,
      capabilities: [
        capability("database", "READY", "CONFIGURED", "DB ok", "ENGINEERING"),
        capability("redis", "READY", "CONFIGURED", "Redis ok", "ENGINEERING"),
        capability("courier_services", "READY", "ACTIVE_SERVICES", "Services ok", "OPERATIONS"),
        capability("operational_coverage", "READY", "BOUNDARIES_CONFIGURED", "Coverage ok", "OPERATIONS"),
        capability("parcel_profiles", "READY", "ACTIVE_PARCEL_PROFILES", "Profiles ok", "OPERATIONS"),
        capability("approved_commission_plan", "READY", "ACTIVE_COMMISSION_PLAN", "Commission ok", "FINANCE"),
        capability("marketplace_delivery_fee_matrix", "READY", "APPROVED_MARKETPLACE_COURIER_TARIFFS", "Tariffs ok", "OPERATIONS"),
        capability("paystack_webhook_processing", "READY", "PROCESSOR_HEALTHY", "Webhook ok", "ENGINEERING"),
        capability("payment_event_processor", "READY", "PROCESSOR_HEALTHY", "Event proc ok", "ENGINEERING"),
        capability("payment_integration_acceptance", "READY", "CURRENT_APPROVED_EVIDENCE", "Accepted", "FINANCE"),
        capability("vendor_onboarding_acceptance", "READY", "CURRENT_APPROVED_EVIDENCE", "Accepted", "OPERATIONS"),
        capability("google_maps_browser", "READY", "CONFIGURED", "Maps ok", "OPERATIONS"),
        capability("google_maps_server", "READY", "CONFIGURED", "Maps ok", "OPERATIONS"),
      ],
      paystack: paystackState({ configured: true, active: true, environment: "production", blockReason: null, productionValidationApproved: true }),
      acceptanceRecords: [makeAcceptance("current_ci_certification"), makeAcceptance("payment_integration_acceptance")],
      heartbeat: healthyHeartbeat,
      storeOrderPolicyActive: true,
      activePrivacyPolicyCount: 1,
      referralRewardIssuingEnabled: true,
      env: {
        NODE_ENV: "production",
        CHECKOUT_PUBLIC_ENABLED: "true",
        PAYSTACK_MODE: "live",
        PAYSTACK_SECRET_KEY: "sk_live_test_fixture_only",
        PAYSTACK_EFT_CHANNEL_ENABLED: "false",
      },
    });

    const card = matrix.find((r) => r.key === "PAYSTACK_CARD");
    expect(card).toMatchObject({
      sourceImplemented: true,
      isolatedTestPassSha: SHA,
      runtimeConfigured: true,
      externalEntitlementApproved: true,
      adminPolicyEffective: true,
      schedulerRegisteredAndHealthy: true,
      eligibleForLiveUse: true,
      lastBlockerCode: null,
    });

    const eft = matrix.find((r) => r.key === "PAYSTACK_EFT");
    expect(eft).toMatchObject({
      runtimeConfigured: false,
      externalEntitlementApproved: false,
      eligibleForLiveUse: false,
      lastBlockerCode: "PAYSTACK_EFT_CHANNEL_UNAPPROVED",
    });

    const subscriptions = matrix.find((r) => r.key === "SUBSCRIPTIONS");
    expect(subscriptions?.eligibleForLiveUse).toBe(false);
    expect(subscriptions?.lastBlockerCode).toBe("SUBSCRIPTIONS_CONSOLIDATED_VALIDATION_NOT_APPROVED");
  });
});
