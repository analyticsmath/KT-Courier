import { prisma } from "@/lib/db/prisma";
import {
  computeSandboxProvenanceDigest,
  isProductionRuntimeEnv,
  resolveCurrentServerReleaseSha,
} from "@/lib/payments/sandbox-acceptance.service";
import { evaluateCommissionPlanCoverage } from "@/lib/production-readiness/commission-plan-coverage";
import type { Capability } from "@/lib/production-readiness/contracts";
import {
  acceptanceStorageKey,
  parseAcceptanceRecord,
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

  // 2. Enforce SERVER_VERIFIED boundary on CI and PARITY in production runtime
  if (prod && typeof prisma.systemSetting?.findUnique === "function") {
    for (const key of ["current_ci_certification", "production_deployment_sha_parity"] as const) {
      const entry = updated.find((e) => e.key === key);
      if (entry && entry.status === "READY") {
        const row = await prisma.systemSetting.findUnique({ where: { key: acceptanceStorageKey(key) } });
        if (!row) {
          replaceStatus(key, "BLOCKED_LIVE_ACCEPTANCE", "ACCEPTANCE_PROVENANCE_MISSING", "Missing stored acceptance verification record.");
          continue;
        }
        try {
          const parsed = parseAcceptanceRecord(row.value);
          if (parsed.verificationMode !== "SERVER_VERIFIED") {
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
    const [activePlans, activeStores] = await Promise.all([
      prisma.commissionPlan.findMany({
        where: {
          status: "ACTIVE",
          effectiveFrom: { lte: options.now },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: options.now } }],
        },
        include: { rules: { select: { id: true, calculationMethod: true, rateBasisPoints: true, fixedAmount: true, allocationType: true } } },
      }),
      prisma.store.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      }),
    ]);
    const cov = evaluateCommissionPlanCoverage({
      now: options.now,
      activeStoreIds: activeStores.map((s) => s.id),
      plans: activePlans,
    });
    if (!cov.ready) {
      replaceStatus("approved_commission_plan", "BLOCKED_HUMAN_APPROVAL", cov.reasonCode, cov.summary);
    }
  }

  return updated;
}
