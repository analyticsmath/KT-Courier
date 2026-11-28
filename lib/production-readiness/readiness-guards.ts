import { prisma } from "@/lib/db/prisma";
import {
  computeSandboxProvenanceDigest,
  isProductionRuntimeEnv,
  resolveCurrentServerReleaseSha,
} from "@/lib/payments/sandbox-acceptance.service";
import {
  evaluateCommissionPlanCoverage,
  loadCommerciallyEligibleMarketplaceStoreIds,
} from "@/lib/production-readiness/commission-plan-coverage";
import type { Capability } from "@/lib/production-readiness/contracts";
import {
  acceptanceStorageKey,
  parseAcceptanceRecord,
  requiresFinancialAuthorizationReference,
} from "@/lib/production-readiness/evidence";

export async function applyReleaseAndParityGuardsToEntries(
  entries: readonly Capability[],
  options: { now: Date; env?: Record<string, string | undefined> },
): Promise<Capability[]> {
  const env = options.env ?? process.env;
  const prod = isProductionRuntimeEnv(env);
  const currentReleaseSha = resolveCurrentServerReleaseSha(env);
  const updated = [...entries];

  const replaceStatus = (
    key: Capability["key"],
    status: "BLOCKED_LIVE_ACCEPTANCE" | "BLOCKED_HUMAN_APPROVAL",
    reasonCode: string,
    safeSummary: string,
  ) => {
    const idx = updated.findIndex((e) => e.key === key);
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], status, reasonCode, safeSummary };
    }
  };

  // 1. Re-verify SANDBOX acceptance against immutable PaymentReleaseProvenance table
  const paymentEntry = updated.find((e) => e.key === "payment_integration_acceptance");
  if (paymentEntry && paymentEntry.status === "READY" && typeof prisma.systemSetting?.findUnique === "function") {
    const rawSetting = await prisma.systemSetting.findUnique({ where: { key: acceptanceStorageKey("payment_integration_acceptance") } });
    if (rawSetting) {
      try {
        const record = parseAcceptanceRecord(rawSetting.value);
        if (record.evidence.kind === "SANDBOX" && typeof prisma.paymentReleaseProvenance?.findUnique === "function") {
          const prov = await prisma.paymentReleaseProvenance.findUnique({ where: { paymentReference: record.evidence.paymentReference } });
          if (
            !prov ||
            prov.releaseSha !== record.evidence.releaseSha ||
            (currentReleaseSha && prov.releaseSha !== currentReleaseSha) ||
            new Date(record.evidence.observedAt).getTime() < prov.providerConfirmedAt.getTime() ||
            computeSandboxProvenanceDigest({
              paymentReference: prov.paymentReference,
              attemptReference: prov.attemptId,
              ledgerJournalId: prov.ledgerJournalId,
              provider: prov.provider,
              providerEnvironment: prov.providerEnvironment,
              subjectType: prov.subjectType,
              subjectNamespace: prov.subjectNamespace,
              amount: prov.amount.toFixed(2),
              currency: prov.currency,
              providerReference: prov.providerReference,
              paymentCreatedAt: prov.paymentCreatedAt,
              providerConfirmedAt: prov.providerConfirmedAt,
              releaseSha: prov.releaseSha,
              deploymentId: prov.deploymentId,
            }) !== prov.resultDigest
          ) {
            replaceStatus(
              "payment_integration_acceptance",
              "BLOCKED_LIVE_ACCEPTANCE",
              "SANDBOX_PAYMENT_PROVENANCE_INVALID",
              "Sandbox payment acceptance lacks valid release-bound provenance or observed timestamp >= provider confirmation.",
            );
          }
        }
      } catch {
        replaceStatus(
          "payment_integration_acceptance",
          "BLOCKED_LIVE_ACCEPTANCE",
          "SANDBOX_PAYMENT_PROVENANCE_INVALID",
          "Acceptance provenance record could not be parsed.",
        );
      }
    }
  }

  // 2. Enforce provenance mode boundaries across CI, PARITY, SANDBOX, and LIVE acceptance in production runtime
  const serverVerifiedAndLiveKeys = [
    "current_ci_certification",
    "production_deployment_sha_parity",
    "payment_integration_acceptance",
    "vendor_onboarding_acceptance",
    "driver_onboarding_acceptance",
    "driver_gps_acceptance",
    "pod_otp_acceptance",
    "settlement_acceptance",
    "refund_acceptance",
    "payout_acceptance",
  ] as const;

  if (prod && typeof prisma.systemSetting?.findUnique === "function") {
    for (const key of serverVerifiedAndLiveKeys) {
      const entry = updated.find((e) => e.key === key);
      if (entry && entry.status === "READY") {
        const row = await prisma.systemSetting.findUnique({ where: { key: acceptanceStorageKey(key) } });
        if (!row) {
          replaceStatus(key, "BLOCKED_LIVE_ACCEPTANCE", "ACCEPTANCE_PROVENANCE_MISSING", "Missing stored acceptance verification record.");
          continue;
        }
        try {
          const parsed = parseAcceptanceRecord(row.value);
          if (parsed.evidence.kind === "LIVE") {
            if (parsed.verificationMode !== "HUMAN_ATTESTED" && parsed.verificationMode !== "SERVER_VERIFIED") {
              replaceStatus(
                key,
                "BLOCKED_LIVE_ACCEPTANCE",
                "ACCEPTANCE_SERVER_VERIFICATION_REQUIRED",
                "Production requires recorded human attestation provenance for live acceptance.",
              );
            } else if (
              requiresFinancialAuthorizationReference(key) &&
              !parsed.evidence.financialAuthorizationReference
            ) {
              replaceStatus(
                key,
                "BLOCKED_LIVE_ACCEPTANCE",
                "FINANCIAL_AUTHORIZATION_REQUIRED",
                "Real-money live acceptance requires an explicit financial authorization reference.",
              );
            }
          } else if (parsed.verificationMode !== "SERVER_VERIFIED") {
            replaceStatus(
              key,
              "BLOCKED_LIVE_ACCEPTANCE",
              "ACCEPTANCE_SERVER_VERIFICATION_REQUIRED",
              "Production requires server-verified provenance rather than self-declared regex input.",
            );
          }
        } catch {
          replaceStatus(key, "BLOCKED_LIVE_ACCEPTANCE", "ACCEPTANCE_PROVENANCE_INVALID", "Invalid acceptance verification record.");
        }
      }
    }
  }

  // 3. Re-verify commission plan ambiguity & maker!=approver & rule rate bounds parity
  const commissionEntry = updated.find((e) => e.key === "approved_commission_plan");
  if (
    commissionEntry &&
    commissionEntry.status === "READY" &&
    typeof prisma.commissionPlan?.findMany === "function" &&
    typeof prisma.store?.findMany === "function"
  ) {
    const [activePlans, storeCoverageScope] = await Promise.all([
      prisma.commissionPlan.findMany({
        where: {
          status: "ACTIVE",
          effectiveFrom: { lte: options.now },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: options.now } }],
        },
        include: {
          rules: {
            select: {
              id: true,
              ruleCode: true,
              allocationType: true,
              beneficiaryType: true,
              calculationMethod: true,
              rateBasisPoints: true,
              fixedAmount: true,
              minimumAmount: true,
              maximumAmount: true,
              priority: true,
              isRequired: true,
            },
          },
        },
      }),
      loadCommerciallyEligibleMarketplaceStoreIds(prisma),
    ]);
    const cov = evaluateCommissionPlanCoverage({
      now: options.now,
      activeStoreIds: storeCoverageScope.commerciallyEligibleStoreIds,
      plans: activePlans,
    });
    if (!cov.ready) {
      replaceStatus("approved_commission_plan", "BLOCKED_HUMAN_APPROVAL", cov.reasonCode, cov.summary);
    }
  }

  return updated;
}
