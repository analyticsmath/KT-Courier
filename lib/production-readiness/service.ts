import { prisma } from "@/lib/db/prisma";
import { evaluateCodPolicyReadiness } from "@/lib/production-readiness/cod-readiness";
import { applyReleaseAndParityGuardsToEntries } from "@/lib/production-readiness/readiness-guards";
import { reconcileBoardWithCapabilityMatrix } from "@/lib/production-readiness/reconciliation";

export { reconcileBoardWithCapabilityMatrix };
import { checkReadiness } from "@/lib/health/checks";
import { getIntegrationRegistry } from "@/lib/security/integration-registry";
import { regionBoundaryIssues } from "@/lib/maps/region-boundaries";
import { evaluateCoverageEvidence } from "./coverage-evidence";
import { getActiveParcelProfiles } from "@/lib/commercial/configuration.service";
import { usableParcelProfiles } from "@/lib/commercial/parcel-profiles";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import { BankInstructionsSchema, readBankInstructions } from "@/lib/client-platform/driver-cash.service";
import {
  PRODUCTION_READINESS_REPAIR_LINKS,
  capability,
  configurationCapability,
  type Capability,
} from "./contracts";
import { marketplaceCourierTariffPolicy } from "@/lib/marketplace-checkout/courier-tariff-policy";
import { listDeliveryMatrices } from "@/lib/marketplace-checkout/delivery-policy-configuration";
import { acceptanceKeys, listAcceptanceEvidence, evidenceIsCurrent } from "./evidence";
import { requiredDomainNotificationDefinitions } from "@/lib/notifications/required-domain-definitions";
import { evaluateProcessorEvidence } from "./processor-evidence";
import { buildCapabilityMatrix } from "./capability-matrix.service";
import { evaluateCommissionPlanCoverage } from "./commission-plan-coverage";
import { evaluateRequiredNotificationGovernance } from "./notification-governance";
import { verifyEnvironmentSchema } from "@/lib/runtime/env-schema-verifier";
import { evaluateCommerceActivation } from "@/lib/runtime/commerce-activation";
import type { AcceptanceRecord } from "./evidence";

const processorJobs = ["apply-paystack-webhook-events", "consume-verified-payment-events"] as const;

export async function getProductionReadiness() {
  const now = new Date();
  const health = await checkReadiness();
  const entries: Capability[] = [
    configurationCapability("database", health.database === "reachable", "Database reachability probe.", "ENGINEERING"),
    configurationCapability("redis", health.redis.configured && health.redis.connected, "Distributed controls connectivity probe.", "ENGINEERING"),
  ];
  const paystack = resolvePaystackConfiguration().state;
  entries.push(configurationCapability("payment_provider", paystack.configured && paystack.active && paystack.environment === "production", "Active live Paystack configuration; configuration does not certify a live charge.", "FINANCE"));
  const providers = getIntegrationRegistry();
  for (const [key, id] of [["email_provider", "resend-email"], ["google_maps_browser", "google-maps-browser"], ["google_maps_server", "google-maps-server"], ["private_media_storage", "object-storage"]]) {
    const provider = providers.find((p) => p.id === id);
    entries.push(configurationCapability(key, provider?.readiness === "LIVE_READY", "Provider configuration must be eligible for this production runtime."));
  }
  entries.push(configurationCapability("cloudinary_media", process.env.CATALOG_MEDIA_DELIVERY === "cloudinary" && ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].every((key) => !!process.env[key]?.trim()), "Cloudinary delivery and write configuration."));
  const { reportingRuntimeStorageStatus } = await import("@/lib/reporting/activation");
  entries.push(configurationCapability("report_artifact_storage", reportingRuntimeStorageStatus().configured, "Persistent S3-compatible or Cloudinary private report artifact configuration."));

  async function probe(key: string, fn: () => Promise<Capability>) {
    try { entries.push(await fn()); }
    catch { entries.push(capability(key, "BLOCKED_CONFIGURATION", "READINESS_PROBE_FAILED", "Evidence could not be read. Investigate database/schema or configuration availability.", "ENGINEERING")); }
  }
  for (const [key, job] of [["paystack_webhook_processing", processorJobs[0]], ["payment_event_processor", processorJobs[1]]] as const) {
    await probe(key, async () => {
      const run = await prisma.operationalProcessorRun.findFirst({ where: { jobName: job }, orderBy: { startedAt: "desc" }, select: { status: true, completedAt: true, startedAt: true, itemsRetried: true, itemsReconciled: true } });
      const row = await prisma.systemSetting.findUnique({ where: { key: "production_processor_heartbeat" }, select: { value: true } });
      const heartbeat = row?.value as Parameters<typeof evaluateProcessorEvidence>[0];
      const result = evaluateProcessorEvidence(heartbeat, job, now);
      const summary = result.reason === "PROCESSOR_WORKER_BLOCKED"
        ? "This processor completed its recent cycle, but the operations worker has unresolved readiness blockers. Review the worker blockers and store-order reconciliation before launch."
        : "Processor cycle must have a recent successful durable run without pending retries.";
      return capability(key, result.healthy ? "READY" : "BLOCKED_CONFIGURATION", result.reason, summary, "ENGINEERING", { status: run?.status ?? "NO_RUN", cycleStatus: result.cycleStatus, recent: result.fresh, workerBlockers: result.blockers, retryCount: run?.itemsRetried ?? 0, reconciliationCount: run?.itemsReconciled ?? 0 });
    });
  }
  await probe("courier_services", async () => {
    const count = await prisma.deliveryServiceDefinition.count({ where: { status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] } });
    return capability("courier_services", count ? "READY" : "BLOCKED_CONFIGURATION", count ? "ACTIVE_SERVICES" : "NO_ACTIVE_SERVICE", "Current effective courier service definitions.", "OPERATIONS", { activeCount: count });
  });
  await probe("operational_coverage", async () => {
    const regions = await prisma.deliveryRegion.findMany({ where: { active: true, pricingEnabled: true }, select: { id: true, coverageMode: true, province: true, centerLat: true, centerLng: true, coverageRadiusKm: true, maxDistanceKm: true } });
    const coverage = evaluateCoverageEvidence(regions);
    return capability("operational_coverage", coverage.ready ? "READY" : "BLOCKED_EXTERNAL_INPUT", coverage.ready ? "BOUNDARIES_CONFIGURED" : regions.length ? "REGION_BOUNDARIES_INCOMPLETE" : "NO_OPERATIONAL_REGION", "Every active province requires a usable pricing region. Incomplete overlapping regions remain visible for operations review.", "OPERATIONS", { activeCount: regions.length, usableCount: coverage.usable.length, unavailableProvinces: coverage.unavailableProvinces, incompleteRegionIds: coverage.incomplete.map((r) => r.id), missingFields: coverage.incomplete.map((r) => `${r.id}: ${regionBoundaryIssues(r).join(", ")}`) });
  });
  await probe("parcel_profiles", async () => {
    const profiles = usableParcelProfiles(await getActiveParcelProfiles(now));
    const missing = ["SMALL", "MEDIUM", "LARGE"].filter((size) => !profiles.some((p) => p.stableKey === size));
    return capability("parcel_profiles", missing.length ? "BLOCKED_HUMAN_APPROVAL" : "READY", missing.length ? "PARCEL_OPERATIONAL_APPROVAL_REQUIRED" : "ACTIVE_PARCEL_PROFILES", "Draft examples are not production acceptance limits.", "OPERATIONS", { missingSizes: missing });
  });
  await probe("approved_commission_plan", async () => {
    const activeStores = await prisma.store.findMany({ where: { status: "ACTIVE", isQaAcceptance: false }, select: { id: true } });
    const activeStoreIds = activeStores.map((store) => store.id);
    const plans = await prisma.commissionPlan.findMany({
      where: {
        currency: "ZAR",
        status: "ACTIVE",
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
        AND: [{ OR: [
          { subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER" },
          ...(activeStoreIds.length ? [{ subjectType: "MARKETPLACE_STORE_ORDER" as const, scopeKey: { in: activeStoreIds.map((id) => `STORE:${id}`) } }] : []),
        ] }],
      },
      select: {
        subjectType: true,
        scopeKey: true,
        currency: true,
        status: true,
        basisType: true,
        effectiveFrom: true,
        effectiveUntil: true,
        calculationVersion: true,
        createdByUserId: true,
        approvedByUserId: true,
        approvedAt: true,
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
    });
    const coverage = evaluateCommissionPlanCoverage({ now, activeStoreIds, plans });
    return capability(
      "approved_commission_plan",
      coverage.ready ? "READY" : "BLOCKED_EXTERNAL_INPUT",
      coverage.reasonCode,
      coverage.summary,
      "FINANCE",
      coverage.evidence,
    );
  });

  // Launch scope policy: Subscriptions, promoter recruitment, and paid advertising
  // are out of initial launch scope per client authority decision record (2026-10-16).
  for (const [key, load, programLabel] of [
    ["store_subscription_configuration", () => prisma.subscriptionPlanVersion.count({ where: { status: "ACTIVE", approvedAt: { not: null }, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] } }), "Store subscription program"],
    ["promoter_commercial_configuration", () => prisma.promoterProgramVersion.count({ where: { status: "ACTIVE", approvedAt: { not: null }, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } }), "Promoter recruitment and payouts"],
    ["advertising_package_configuration", () => prisma.advertisingRateCardVersion.count({ where: { status: "ACTIVE", approvedAt: { not: null }, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] } }), "Paid advertising rate cards"],
  ] as const) {
    await probe(key, async () => {
      const count = await load();
      if (count > 0) {
        return capability(
          key,
          "BLOCKED_CONFIGURATION",
          "COMMERCIAL_SCOPE_CONFLICT",
          `${programLabel} has ${count} active version(s) configured in the database, but this program is excluded from launch scope by policy. Either retire the active versions or formally update the launch scope.`,
          "CLIENT",
          { approvedEffectiveCount: count, launchScope: "EXCLUDED_BY_POLICY_v1" }
        );
      }
      return capability(
        key,
        "DISABLED_BY_POLICY",
        "COMMERCIAL_PROGRAM_INACTIVE_BY_POLICY",
        `${programLabel} is an inactive optional commercial program outside initial delivery and marketplace launch scope.`,
        "CLIENT",
        { approvedEffectiveCount: 0, launchScope: "EXCLUDED_BY_POLICY_v1" }
      );
    });
  }

  await probe("cod_policy", async () => {
    // The owner-approved initial COD model is a 50% digital deposit plus 50%
    // driver cash on explicitly scoped personal parcel routes. Store-specific
    // legacy drafts and full-COD policies do not satisfy this launch gate.
    const rows = await prisma.paymentMethodPolicy.findMany({ where: {
      status: "ACTIVE", mode: "DEPOSIT_PLUS_COD", storeId: null, orderType: "PARCEL_DOCUMENT",
      effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    } });
    const bank = await prisma.systemSetting.findUnique({ where: { key: "client_cash_deposit_bank" }, select: { value: true, updatedAt: true } });
    const bankParsed = bank ? BankInstructionsSchema.safeParse(bank.value) : null;
    const bankValid = !!bankParsed?.success;
    const [services, regions] = await Promise.all([
      prisma.deliveryServiceDefinition.findMany({
        where: { status: "ACTIVE" },
        select: { stableKey: true, status: true, effectiveFrom: true, effectiveTo: true },
      }),
      prisma.deliveryRegion.findMany({
        select: {
          id: true,
          active: true,
          pricingEnabled: true,
          province: true,
          coverageMode: true,
          centerLat: true,
          centerLng: true,
          coverageRadiusKm: true,
          maxDistanceKm: true,
        },
      }),
    ]);
    const activeServicesByKey = new Map(services.map((s) => [s.stableKey, s]));
    const regionsById = new Map(regions.map((r) => [r.id, r]));
    const bankMeta = (bank?.value && typeof bank.value === "object" ? bank.value : null) as { updatedByUserId?: string } | null;
    const { eligible, rejectedReasons } = evaluateCodPolicyReadiness(rows, {
      activeServicesByKey,
      regionsById,
      bank: {
        valid: bankValid,
        updatedAtIso: bank?.updatedAt.toISOString() ?? null,
        updatedByUserId: typeof bankMeta?.updatedByUserId === "string" ? bankMeta.updatedByUserId : null,
      },
      now,
    });
    return capability("cod_policy", eligible.length ? "READY" : "BLOCKED_EXTERNAL_INPUT", eligible.length ? "COD_SCOPED_APPROVAL_CURRENT" : "COD_APPROVED_SCOPE_MISSING", "Eligible personal parcel cash requires the owner-approved 50% digital deposit and 50% driver cash, an independently approved service, area, cash limit and unchanged remittance instructions. Full COD and store-specific policies do not satisfy this launch gate.", "FINANCE", { scopedPolicyCount: eligible.length, rejectedPolicyCount: rejectedReasons.length, rejectedPolicyReasons: rejectedReasons.map((r) => r.reason) });
  });
  await probe("cod_remittance", async () => {
    const configured = !!await readBankInstructions(); const approved = entries.find((e) => e.key === "cod_policy")?.status === "READY";
    return capability("cod_remittance", configured && approved ? "READY" : configured ? "BLOCKED_HUMAN_APPROVAL" : "BLOCKED_EXTERNAL_INPUT", configured && approved ? "COD_REMITTANCE_CURRENT" : "COD_REMITTANCE_APPROVAL_REQUIRED", "Secure banking instructions and settlement timing require finance approval; no bank details are displayed.", "FINANCE");
  });
  await probe("notification_governance", async () => {
    const required = requiredDomainNotificationDefinitions;
    const [routes, routeVersions, templateRoots, templateVersions, policies] = await Promise.all([
      prisma.notificationEventRoute.findMany(),
      prisma.notificationEventRouteVersion.findMany({ where: { status: "ACTIVE" } }),
      prisma.notificationTemplate.findMany(),
      prisma.notificationTemplateVersion.findMany(),
      prisma.notificationRecipientPolicyVersion.findMany(),
    ]);
    const governance = evaluateRequiredNotificationGovernance({
      required,
      routes,
      routeVersions,
      templateRoots,
      templateVersions,
      recipientPolicyVersions: policies,
    });
    const notificationGateSpecs = [
      ["notification_templates", governance.missingTemplates, "NOTIFICATION_TEMPLATE_PUBLICATION_REQUIRED", "Every required notification domain needs a current approved and published template."],
      ["notification_recipient_policy", governance.missingRecipientPolicies, "NOTIFICATION_RECIPIENT_POLICY_APPROVAL_REQUIRED", "Every required notification domain needs a current independently governed recipient policy."],
      ["notification_routes", governance.missingRoutes, "NOTIFICATION_ROUTE_ACTIVATION_REQUIRED", "Every required notification domain needs one active route referencing its current approved template and recipient policy."],
    ] as const;
    for (const [key, missing, reasonCode, summary] of notificationGateSpecs) {
      entries.push(capability(key, missing.length ? "BLOCKED_HUMAN_APPROVAL" : "READY", missing.length ? reasonCode : "ACTIVE_DOMAIN_GOVERNANCE", summary, "ADMIN_REVIEW", { missingDomains: missing }));
    }

    // Precise checks for payment, refund, and marketplace notification routes and delivery adapters
    const coreDomains = ["PAYMENT", "REFUND", "MARKETPLACE", "STORE_ORDERS"];
    const missingCoreDomainRoutes = required
      .filter((e) => coreDomains.includes(e.sourceAuthority) && governance.missingDomains.includes(`${e.sourceAuthority}:${e.eventType}`))
      .map((e) => `${e.sourceAuthority}:${e.eventType}`);

    const emailProviderReady = entries.find((e) => e.key === "email_provider")?.status === "READY";
    const notificationApproved = process.env.NOTIFICATION_PRODUCTION_VALIDATION_APPROVED === "true";

    if (missingCoreDomainRoutes.length > 0) {
      return capability(
        "notification_domain_engineering",
        "BLOCKED_CONFIGURATION",
        "NOTIFICATION_DOMAIN_ROUTES_MISSING",
        `Active routes with published templates are missing for core transactional domains: ${missingCoreDomainRoutes.slice(0, 3).join(", ")}${missingCoreDomainRoutes.length > 3 ? "..." : ""}`,
        "ENGINEERING",
        { missingCoreDomains: missingCoreDomainRoutes, emailProviderReady }
      );
    }

    if (!emailProviderReady) {
      return capability(
        "notification_domain_engineering",
        "BLOCKED_CONFIGURATION",
        "NOTIFICATION_EMAIL_PROVIDER_UNCONFIGURED",
        "Email delivery provider (Resend) credentials and sender domain are not fully verified in this runtime.",
        "ENGINEERING",
        { emailProviderReady: false }
      );
    }

    if (!notificationApproved) {
      return capability(
        "notification_domain_engineering",
        "BLOCKED_LIVE_ACCEPTANCE",
        "NOTIFICATION_PRODUCTION_VALIDATION_REQUIRED",
        "Payment, refund, and marketplace notification adapters and route governance are complete; live delivery remains fail-closed until live provider credential validation.",
        "ENGINEERING",
        { emailProviderReady: true, missingCoreDomainsCount: 0 }
      );
    }

    return capability(
      "notification_domain_engineering",
      "READY",
      "NOTIFICATION_DOMAINS_ACTIVE",
      "Payment, refund, and marketplace notification routes, templates, and delivery adapters are active.",
      "ENGINEERING",
      { emailProviderReady: true, missingCoreDomainsCount: 0 }
    );
  });
  await probe("marketplace_delivery_fee_matrix", async () => {
    const courierPolicy = await marketplaceCourierTariffPolicy();
    if (courierPolicy) {
      const service = await prisma.deliveryServiceDefinition.findFirst({ where: { stableKey: courierPolicy.defaultServiceKey, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, select: { id: true } });
      return capability("marketplace_delivery_fee_matrix", service ? "READY" : "BLOCKED_CONFIGURATION", service ? "APPROVED_MARKETPLACE_COURIER_TARIFFS" : "MARKETPLACE_COURIER_SERVICE_UNAVAILABLE", "Marketplace uses the configured existing courier tariffs; a separate fee matrix is not required for this pricing model.", "OPERATIONS", { pricingModel: "COURIER_TARIFFS", serviceKey: courierPolicy.defaultServiceKey });
    }
    const matrices = await listDeliveryMatrices();
    const current = matrices.find((m) => m.status === "ACTIVE" && m.approvedByUserId && m.approvedByUserId !== m.createdByUserId && m.approvedAt && new Date(m.effectiveFrom) <= now && (!m.effectiveTo || new Date(m.effectiveTo) > now));
    return capability("marketplace_delivery_fee_matrix", current ? "READY" : "BLOCKED_EXTERNAL_INPUT", current ? "APPROVED_MARKETPLACE_MATRIX" : "APPROVED_MARKETPLACE_MATRIX_REQUIRED", "Marketplace delivery uses explicit approved tariff bands. Missing parcel classification permits only an explicitly authored ANY-size rule.", "CLIENT", { activeVersion: current?.version ?? null });
  });
  const releaseSha = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA;
  let acceptanceRecords: readonly AcceptanceRecord[] = [];
  await probe("acceptance_evidence", async () => {
    const records = await listAcceptanceEvidence();
    acceptanceRecords = records;
    for (const key of acceptanceKeys) {
      const record = records.find((r) => r.evidence.key === key);
      const current = evidenceIsCurrent(record, releaseSha, now);
      const sameReleaseDraft = record?.status === "DRAFT" && !!releaseSha && record.evidence.releaseSha === releaseSha &&
        new Date(record.evidence.observedAt) <= now && new Date(record.evidence.expiresAt) > now;
      const engineering = ["current_ci_certification", "production_deployment_sha_parity"].includes(key);
      const status = current ? "READY" : sameReleaseDraft ? "BLOCKED_HUMAN_APPROVAL" : engineering ? "BLOCKED_CONFIGURATION" : "BLOCKED_LIVE_ACCEPTANCE";
      const reasonCode = current ? "CURRENT_APPROVED_EVIDENCE"
        : sameReleaseDraft ? "INDEPENDENT_REVIEW_REQUIRED"
          : key === "production_deployment_sha_parity" && !record ? "PROTECTED_DATA_AUDIT_REQUIRED"
            : key === "current_ci_certification" && !record ? "CURRENT_SHA_CI_CERTIFICATION_REQUIRED"
          : record?.status === "REVOKED" ? "EVIDENCE_REVOKED"
            : record && releaseSha && record.evidence.releaseSha !== releaseSha ? "EVIDENCE_RELEASE_SHA_MISMATCH"
              : record && new Date(record.evidence.expiresAt) <= now ? "EVIDENCE_EXPIRED"
                : "RELEASE_BOUND_EVIDENCE_REQUIRED";
      const summary = current
        ? "Independent approval is current for this release."
        : sameReleaseDraft
          ? "A current-release draft is saved; a different authorized administrator must review the linked evidence."
          : key === "production_deployment_sha_parity" && !record
            ? "Verify the exact Vercel, Railway web and operations SHAs, then attach a fresh protected-row audit and obtain independent review."
            : key === "current_ci_certification" && !record
              ? "Run the current exact-SHA certification, record the successful workflow evidence and obtain independent review."
          : key === "payment_integration_acceptance"
            ? "Verified provider sandbox transactions qualify for payment integration acceptance; no real-money test charge is required. Evidence must match this release and be independently reviewed."
            : record?.status === "APPROVED" && record.evidence.releaseSha !== releaseSha
              ? "The approved evidence is tied to a different release. Record and independently review evidence for the deployed SHA."
              : "Record genuine evidence for this release, then obtain independent review. Expired or different-release evidence cannot unblock launch.";
      entries.push(capability(key, status, reasonCode, summary, engineering ? "ENGINEERING" : key.includes("driver") || key === "pod_otp_acceptance" ? "OPERATIONS" : "FINANCE", { version: record?.version ?? 0, evidenceStatus: record?.status ?? "MISSING", currentRelease: !!releaseSha && record?.evidence.releaseSha === releaseSha }));
    }
    return capability("acceptance_evidence", "READY", "EVIDENCE_STORE_READABLE", "Evidence register is readable; each release acceptance gate is evaluated separately.", "ADMIN_REVIEW");
  });
  for (const key of [...acceptanceKeys, "notification_templates", "notification_recipient_policy", "notification_routes"]) {
    if (!entries.some((e) => e.key === key)) entries.push(capability(key, "BLOCKED_CONFIGURATION", "READINESS_PROBE_FAILED", "Required evidence could not be read; investigate schema and configuration availability.", "ENGINEERING"));
  }
  const [heartbeatRow, referralSettingRow, storeOrderPolicyRow, activePrivacyPolicyRows, reportingActivation, developerApiActivation] = await Promise.all([
    prisma.systemSetting?.findUnique?.({ where: { key: "production_processor_heartbeat" }, select: { value: true } }).catch(() => null) ?? null,
    prisma.systemSetting?.findUnique?.({ where: { key: "referral.reward_issuing_enabled" }, select: { type: true, value: true } }).catch(() => null) ?? null,
    (prisma as unknown as { storeOrderOperationalPolicy?: { findFirst?: (args: unknown) => Promise<{ id: string } | null> } }).storeOrderOperationalPolicy?.findFirst?.({
      where: { status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
      select: { id: true },
    }).catch(() => null) ?? null,
    prisma.retentionPolicyVersion.findMany({
      where: {
        dataClass: "PRIVATE_MEDIA",
        status: "ACTIVE",
        action: "DELETE",
        legalReviewStatus: "APPROVED",
        retentionDays: { not: null },
        effectiveAt: { lte: now },
        legalReviewReference: { not: null },
        legalReviewReason: { not: null },
        legalReviewedByUserId: { not: null },
        legalReviewedAt: { not: null },
        activatedByUserId: { not: null },
      },
      select: { createdByUserId: true, legalReviewedByUserId: true, activatedByUserId: true, retentionDays: true },
    }).catch(() => []),
    import("@/lib/reporting/activation").then((m) => m.resolveReportingActivationState({ db: prisma, now })).catch(() => null),
    import("@/lib/developer-api/activation").then((m) => m.resolveDeveloperApiActivationState({ db: prisma, now })).catch(() => null),
  ]);
  const activePrivacyPolicyCount = Array.isArray(activePrivacyPolicyRows)
    ? activePrivacyPolicyRows.filter((policy) =>
      typeof policy.createdByUserId === "string"
      && typeof policy.legalReviewedByUserId === "string"
      && typeof policy.activatedByUserId === "string"
      && typeof policy.retentionDays === "number"
      && Number.isInteger(policy.retentionDays)
      && policy.retentionDays >= 0
      && policy.retentionDays <= 36500
      && policy.createdByUserId !== policy.legalReviewedByUserId
      && policy.activatedByUserId !== policy.legalReviewedByUserId
    ).length
    : 0;

  const guardedEntries = await applyReleaseAndParityGuardsToEntries(entries, { now });
  const guardedStatusByKey = new Map(guardedEntries.map((entry) => [entry.key, entry.status]));
  const effectiveAcceptanceRecords = acceptanceRecords.filter((record) => {
    const guardedStatus = guardedStatusByKey.get(record.evidence.key);
    return guardedStatus === undefined || guardedStatus === "READY";
  });

  const capabilityMatrix = buildCapabilityMatrix({
    now,
    releaseSha: releaseSha ?? null,
    capabilities: guardedEntries,
    paystack,
    acceptanceRecords: effectiveAcceptanceRecords,
    heartbeat: (heartbeatRow?.value as Parameters<typeof buildCapabilityMatrix>[0]["heartbeat"]) ?? null,
    storeOrderPolicyActive: Boolean(storeOrderPolicyRow),
    activePrivacyPolicyCount: typeof activePrivacyPolicyCount === "number" ? activePrivacyPolicyCount : 0,
    referralRewardIssuingEnabled: referralSettingRow?.type === "BOOLEAN" && referralSettingRow.value === true,
    reportingActivation,
    developerApiActivation,
  });

  const envSchema = verifyEnvironmentSchema(process.env);
  const commerceActivation = evaluateCommerceActivation(process.env, { paystackStateOverride: paystack });

  const safePrisma = prisma as unknown as {
    store?: { count?: (args?: unknown) => Promise<number> };
    driverProfile?: { count?: (args?: unknown) => Promise<number> };
  };
  const [totalStoresCount, activeStoresCount, approvedDriversCount] = await Promise.all([
    safePrisma.store?.count?.({ where: { isQaAcceptance: false } }).catch(() => null) ?? null,
    safePrisma.store?.count?.({ where: { status: "ACTIVE", isQaAcceptance: false } }).catch(() => null) ?? null,
    safePrisma.driverProfile?.count?.({ where: { active: true, status: "ACTIVE", onboardingStatus: "APPROVED", isQaAcceptance: false } }).catch(() => null) ?? null,
  ]);

  const codeCapabilities = capabilityMatrix.map((entry) => ({
    key: entry.key,
    label: entry.label,
    sourceImplemented: entry.sourceImplemented,
    codeStatus: !entry.sourceImplemented
      ? ("CODE_GAP" as const)
      : entry.isolatedTestPassSha
        ? ("IMPLEMENTED_AND_VERIFIED" as const)
        : ("IMPLEMENTED_IN_SOURCE" as const),
    isolatedTestPassSha: entry.isolatedTestPassSha,
  }));

  const entityConfigurationStatus = {
    storefrontStoresTotal: typeof totalStoresCount === "number" ? totalStoresCount : null,
    storefrontStoresActive: typeof activeStoresCount === "number" ? activeStoresCount : null,
    approvedDriversActive: typeof approvedDriversCount === "number" ? approvedDriversCount : null,
    paymentProviderConfigured: paystack.configured && paystack.active,
    paymentProviderEnvironment: paystack.environment,
    repairLinks: PRODUCTION_READINESS_REPAIR_LINKS,
  };

  const matrixReconciliation = reconcileBoardWithCapabilityMatrix(guardedEntries, capabilityMatrix);
  return {
    generatedAt: now.toISOString(),
    status: matrixReconciliation.overallStatus,
    capabilities: guardedEntries,
    capabilityMatrix,
    matrixReconciliation,
    moduleActivations: {
      reporting: reportingActivation,
      developerApi: developerApiActivation,
    },
    envSchema,
    commerceActivation,
    codeCapabilities,
    entityConfigurationStatus,
  };
}
