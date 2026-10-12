import { prisma } from "@/lib/db/prisma";
import { checkReadiness } from "@/lib/health/checks";
import { getIntegrationRegistry } from "@/lib/security/integration-registry";
import { regionBoundaryIssues } from "@/lib/maps/region-boundaries";
import { getActiveParcelProfiles } from "@/lib/commercial/configuration.service";
import { usableParcelProfiles } from "@/lib/commercial/parcel-profiles";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import { readBankInstructions } from "@/lib/client-platform/driver-cash.service";
import { capability, configurationCapability, type Capability } from "./contracts";
import { listDeliveryMatrices } from "@/lib/marketplace-checkout/delivery-policy-configuration";
import { acceptanceKeys, listAcceptanceEvidence, evidenceIsCurrent } from "./evidence";
import { requiredDomainNotificationDefinitions } from "@/lib/notifications/required-domain-definitions";

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
  entries.push(configurationCapability("report_artifact_storage", process.env.REPORT_ARTIFACT_STORAGE === "s3" && ["REPORT_ARTIFACT_S3_ENDPOINT", "REPORT_ARTIFACT_S3_BUCKET", "REPORT_ARTIFACT_S3_ACCESS_KEY_ID", "REPORT_ARTIFACT_S3_SECRET_ACCESS_KEY"].every((key) => !!process.env[key]?.trim()), "Persistent report artifact configuration."));

  async function probe(key: string, fn: () => Promise<Capability>) {
    try { entries.push(await fn()); }
    catch { entries.push(capability(key, "BLOCKED_CONFIGURATION", "READINESS_PROBE_FAILED", "Evidence could not be read. Investigate database/schema or configuration availability.", "ENGINEERING")); }
  }
  for (const [key, job] of [["paystack_webhook_processing", processorJobs[0]], ["payment_event_processor", processorJobs[1]]] as const) {
    await probe(key, async () => {
      const run = await prisma.operationalProcessorRun.findFirst({ where: { jobName: job }, orderBy: { startedAt: "desc" }, select: { status: true, completedAt: true, startedAt: true, itemsRetried: true, itemsReconciled: true } });
      const row = await prisma.systemSetting.findUnique({ where: { key: "production_processor_heartbeat" }, select: { value: true } });
      const heartbeat = row?.value as { observedAt?: string; healthy?: boolean; processors?: { name: string; status: string }[] } | undefined;
      const age = heartbeat?.observedAt ? now.getTime() - new Date(heartbeat.observedAt).getTime() : Infinity;
      const fresh = age >= 0 && age < 420000;
      const result = heartbeat?.processors?.find((r) => r.name === job);
      const healthy = fresh && heartbeat?.healthy === true && !!result && ["COMPLETED", "IDLE", "PEER_LEASE"].includes(result.status);
      return capability(key, healthy ? "READY" : "BLOCKED_CONFIGURATION", healthy ? "PROCESSOR_HEALTHY" : "PROCESSOR_STALE_OR_FAILED", "Processor cycle must have a recent successful durable run.", "ENGINEERING", { status: run?.status ?? "NO_RUN", recent: fresh, retryCount: run?.itemsRetried ?? 0, reconciliationCount: run?.itemsReconciled ?? 0 });
    });
  }
  await probe("courier_services", async () => {
    const count = await prisma.deliveryServiceDefinition.count({ where: { status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] } });
    return capability("courier_services", count ? "READY" : "BLOCKED_CONFIGURATION", count ? "ACTIVE_SERVICES" : "NO_ACTIVE_SERVICE", "Current effective courier service definitions.", "OPERATIONS", { activeCount: count });
  });
  await probe("operational_coverage", async () => {
    const regions = await prisma.deliveryRegion.findMany({ where: { active: true, pricingEnabled: true }, select: { id: true, province: true, centerLat: true, centerLng: true, coverageRadiusKm: true, maxDistanceKm: true } });
    const invalid = regions.filter((r) => regionBoundaryIssues(r).length);
    return capability("operational_coverage", regions.length && !invalid.length ? "READY" : "BLOCKED_EXTERNAL_INPUT", invalid.length ? "REGION_BOUNDARIES_INCOMPLETE" : regions.length ? "BOUNDARIES_CONFIGURED" : "NO_OPERATIONAL_REGION", "Operations must supply complete boundaries for active pricing regions.", "OPERATIONS", { activeCount: regions.length, incompleteRegionIds: invalid.map((r) => r.id), missingFields: invalid.map((r) => `${r.id}: ${regionBoundaryIssues(r).join(", ")}`) });
  });
  await probe("parcel_profiles", async () => {
    const profiles = usableParcelProfiles(await getActiveParcelProfiles(now));
    const missing = ["SMALL", "MEDIUM", "LARGE"].filter((size) => !profiles.some((p) => p.stableKey === size));
    return capability("parcel_profiles", missing.length ? "BLOCKED_HUMAN_APPROVAL" : "READY", missing.length ? "PARCEL_OPERATIONAL_APPROVAL_REQUIRED" : "ACTIVE_PARCEL_PROFILES", "Draft examples are not production acceptance limits.", "OPERATIONS", { missingSizes: missing });
  });
  for (const [key, load, owner] of [
    ["approved_commission_plan", () => prisma.commissionPlan.count({ where: { status: "ACTIVE", approvedAt: { not: null }, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] } }), "FINANCE"],
    ["store_subscription_configuration", () => prisma.subscriptionPlanVersion.count({ where: { status: "ACTIVE", approvedAt: { not: null }, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] } }), "CLIENT"],
    ["promoter_commercial_configuration", () => prisma.promoterProgramVersion.count({ where: { status: "ACTIVE", approvedAt: { not: null }, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } }), "CLIENT"],
    ["advertising_package_configuration", () => prisma.advertisingRateCardVersion.count({ where: { status: "ACTIVE", approvedAt: { not: null }, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] } }), "CLIENT"],
  ] as const) {
    await probe(key, async () => {
      const count = await load();
      return capability(key, count ? "BLOCKED_CONFIGURATION" : "BLOCKED_EXTERNAL_INPUT", count ? "SCOPED_ENGINE_ACTIVATION_REVIEW_REQUIRED" : "NO_APPROVED_COMMERCIAL_CONFIGURATION", count ? "Approved configuration exists; confirm scoped engine readiness and explicit processor activation." : "Supply real commercial values through the versioned admin workflow.", owner, { approvedEffectiveCount: count });
    });
  }
  await probe("cod_policy", async () => {
    const rows = await prisma.paymentMethodPolicy.findMany({ where: { status: "ACTIVE", mode: "DEPOSIT_PLUS_COD", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] } });
    const bank = await prisma.systemSetting.findUnique({ where: { key: "client_cash_deposit_bank" }, select: { updatedAt: true } });
    const eligible = rows.filter((r) => {
      const evidence = r.policyEvidence as { approvedByUserId?: string; approvedAt?: string; remittanceApproved?: boolean; remittanceUpdatedAt?: string; settlementTiming?: string } | null;
      return r.storeId && r.deliveryServiceId && (r.regionId || (Array.isArray(r.provinceScope) && r.provinceScope.length)) && Number(r.maximumCodAmount) > 0 && Number(r.depositPercent) === 0.5 && evidence?.approvedByUserId && evidence.approvedByUserId !== r.createdByUserId && evidence.approvedAt && evidence.remittanceApproved && evidence.settlementTiming && bank?.updatedAt.toISOString() === evidence.remittanceUpdatedAt;
    });
    return capability("cod_policy", eligible.length ? "READY" : "BLOCKED_EXTERNAL_INPUT", eligible.length ? "COD_SCOPED_APPROVAL_CURRENT" : "COD_APPROVED_SCOPE_MISSING", "COD availability remains specific to independently approved stores, services, regions and cash limits.", "FINANCE", { scopedPolicyCount: eligible.length });
  });
  await probe("cod_remittance", async () => {
    const configured = !!await readBankInstructions(); const approved = entries.find((e) => e.key === "cod_policy")?.status === "READY";
    return capability("cod_remittance", configured && approved ? "READY" : configured ? "BLOCKED_HUMAN_APPROVAL" : "BLOCKED_EXTERNAL_INPUT", configured && approved ? "COD_REMITTANCE_CURRENT" : "COD_REMITTANCE_APPROVAL_REQUIRED", "Secure banking instructions and settlement timing require finance approval; no bank details are displayed.", "FINANCE");
  });
  await probe("notification_governance", async () => {
    const required = requiredDomainNotificationDefinitions;
    const [routes, versions, templates, policies] = await Promise.all([prisma.notificationEventRoute.findMany(), prisma.notificationEventRouteVersion.findMany({ where: { status: "ACTIVE", approvedAt: { not: null }, activatedAt: { not: null } } }), prisma.notificationTemplateVersion.findMany({ where: { status: "PUBLISHED", approvedAt: { not: null } } }), prisma.notificationRecipientPolicyVersion.findMany({ where: { status: "APPROVED", approvedAt: { not: null } } })]);
    const missing = required.filter((e) => !versions.some((v) => routes.some((r) => r.id === v.routeId && r.sourceAuthority === e.sourceAuthority && r.sourceEventType === e.eventType) && templates.some((t) => t.id === v.templateVersionId) && policies.some((p) => p.id === v.recipientPolicyVersionId))).map((e) => `${e.sourceAuthority}:${e.eventType}`);
    for (const key of ["notification_templates", "notification_recipient_policy", "notification_routes"]) entries.push(capability(key, missing.length ? "BLOCKED_HUMAN_APPROVAL" : "READY", missing.length ? "DOMAIN_GOVERNANCE_APPROVAL_REQUIRED" : "ACTIVE_DOMAIN_GOVERNANCE", "Required registered domains must have published templates, approved recipient policies and active routes.", "ADMIN_REVIEW", { missingDomains: missing }));
    return capability("notification_domain_engineering", "BLOCKED_CONFIGURATION", "NOTIFICATION_DOMAIN_CERTIFICATION_REQUIRED", "Payment, refund and guest marketplace notification adapters and functional acceptance require certification beyond registered courier routes.", "ENGINEERING");
  });
  await probe("marketplace_delivery_fee_matrix", async () => {
    const matrices = await listDeliveryMatrices();
    const current = matrices.find((m) => m.status === "ACTIVE" && m.approvedByUserId && m.approvedByUserId !== m.createdByUserId && m.approvedAt && new Date(m.effectiveFrom) <= now && (!m.effectiveTo || new Date(m.effectiveTo) > now));
    return capability("marketplace_delivery_fee_matrix", current ? "READY" : "BLOCKED_EXTERNAL_INPUT", current ? "APPROVED_MARKETPLACE_MATRIX" : "APPROVED_MARKETPLACE_MATRIX_REQUIRED", "Marketplace delivery uses explicit approved tariff bands. Missing parcel classification permits only an explicitly authored ANY-size rule.", "CLIENT", { activeVersion: current?.version ?? null });
  });
  const releaseSha = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA;
  await probe("acceptance_evidence", async () => {
    const records = await listAcceptanceEvidence();
    for (const key of acceptanceKeys) {
      const record = records.find((r) => r.evidence.key === key); const current = evidenceIsCurrent(record, releaseSha, now);
      const engineering = ["current_ci_certification", "production_deployment_sha_parity"].includes(key);
      entries.push(capability(key, current ? "READY" : engineering ? "BLOCKED_CONFIGURATION" : "BLOCKED_LIVE_ACCEPTANCE", current ? "CURRENT_APPROVED_EVIDENCE" : "RELEASE_BOUND_EVIDENCE_REQUIRED", "Record genuine evidence for this release, then obtain independent review. Expired or different-release evidence cannot unblock launch.", engineering ? "ENGINEERING" : key.includes("driver") || key === "pod_otp_acceptance" ? "OPERATIONS" : "FINANCE", { version: record?.version ?? 0, evidenceStatus: record?.status ?? "MISSING", currentRelease: !!releaseSha }));
    }
    return capability("acceptance_evidence", "READY", "EVIDENCE_STORE_READABLE", "Acceptance evidence is audited and independently reviewed.", "ADMIN_REVIEW");
  });
  for (const key of [...acceptanceKeys, "notification_templates", "notification_recipient_policy", "notification_routes"]) {
    if (!entries.some((e) => e.key === key)) entries.push(capability(key, "BLOCKED_CONFIGURATION", "READINESS_PROBE_FAILED", "Required evidence could not be read; investigate schema and configuration availability.", "ENGINEERING"));
  }
  return { generatedAt: now.toISOString(), status: entries.every((e) => e.status === "READY" || e.status === "DISABLED_BY_POLICY") ? "READY" : "BLOCKED", capabilities: entries };
}
