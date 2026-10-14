import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { prisma } from "../lib/db/prisma";
import { activateCompanyProfile } from "../lib/services/company-profile.service";
import { createLegalDocumentDraft, publishLegalDocumentVersion } from "../lib/services/legal-documents.service";
import { DeliveryConfigurationSchema } from "../lib/client-platform/contracts";
import { INITIAL_CLIENT_PARCEL_DRAFTS } from "../lib/commercial/initial-client-parcel-drafts";
import { OWNER_PARCEL_LIMITS_APPROVAL, activateOwnerApprovedInitialParcelProfiles } from "../lib/commercial/owner-approved-initial-parcels";
import { OWNER_GAUTENG_COVERAGE_APPROVAL, activateOwnerApprovedGautengCoverage } from "../lib/commercial/owner-approved-gauteng-coverage";
import { saveDeliveryConfiguration } from "../lib/client-platform/delivery.service";
import { OWNER_COURIER_TARIFF_APPROVAL, activateOwnerSelectedCourierTariffs } from "../lib/marketplace-checkout/courier-tariff-policy";
import { OWNER_COMMISSION_DEFAULTS_APPROVAL, prepareOwnerSelectedCommissionDefaults } from "../lib/commercial/owner-selected-commission-defaults";
import { prepareCustomerOrderNotifications } from "../lib/notifications/customer-order-configuration";
import { prepareRequiredDomainNotifications } from "../lib/notifications/required-domain-configuration";

type Policy = { documentType: string; version: string; content: string; contentHash: string; sourceSha256: string };
const source = "CLIENT_REVIEW_2026_10_06";

async function main() {
  const payload = JSON.parse(await readFile("docs/client-authority/2026-10/public-policies.json", "utf8")) as { policies: Policy[] };
  if (payload.policies.length !== 4 || new Set(payload.policies.map((p) => p.documentType)).size !== 4) throw new Error("Expected four distinct reviewed policies.");
  for (const policy of payload.policies) {
    if (createHash("sha256").update(policy.content).digest("hex") !== policy.contentHash) throw new Error("Reviewed policy integrity check failed.");
  }
  const actor = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", status: "ACTIVE" }, select: { id: true } });
  if (!actor) throw new Error("Active superuser required for audited initialization.");

  if (!await prisma.companyProfileVersion.findFirst({ select: { id: true } })) {
    const company = await activateCompanyProfile(actor.id, {
      legalName: "KT Couriers (Pty) Ltd", tradingName: "KT Couriers",
      registrationNumber: "2024/475266/07", vatNumber: "4120307386",
      supportEmail: "support@ktcouriers.com", businessEmail: "info@ktcouriers.com",
      telephoneNumbers: ["067 815 5245", "075 019 2265"], website: "https://www.ktcouriers.com",
      physicalAddress: null, publicMetadata: { source, walkInOffice: false, onboarding: "ONLINE" },
    });
    await prisma.adminActivityLog.create({ data: { actorUserId: actor.id, action: "CREATE", entityType: "CompanyProfileVersion", entityId: company.id, message: "Initialised supplied company identity; registered physical address remains pending.", metadata: { source, authorizedMaintenance: true } } });
    console.log(JSON.stringify({ event: "client_launch.company_initialized", version: company.versionNumber }));
  }

  // Client-supplied measurements are EXAMPLES. Use canonical SMALL/MEDIUM/LARGE
  // keys so the existing admin editor can find them, but never auto-activate.
  // Earlier CLIENT_SMALL/... drafts, if present, are intentionally left intact.
  for (const [index, draft] of INITIAL_CLIENT_PARCEL_DRAFTS.entries()) {
    const stableKey = draft.stableKey;
    if (await prisma.parcelProfileVersion.findFirst({ where: { stableKey }, select: { id: true } })) continue;
    const row = await prisma.parcelProfileVersion.create({ data: { ...draft, versionNumber: 1, status: "DRAFT", sortOrder: index, effectiveFrom: new Date(), createdByUserId: actor.id } });
    await prisma.adminActivityLog.create({ data: { actorUserId: actor.id, action: "CREATE", entityType: "ParcelProfileVersion", entityId: row.id, message: "Initialised editable client example as DRAFT, not an approved operating limit.", metadata: { source, authorizedMaintenance: true, priorLegacyKey: "CLIENT_" + stableKey, activationApproved: false } } });
  }

  // Owner-approved limits are opt-in on the production service. Without the
  // exact approval flag, prior client examples remain DRAFT and unchargeable.
  // This operation creates new auditable versions; it never deletes prior ones.
  if (process.env.KT_OWNER_APPROVED_PARCEL_LIMITS === OWNER_PARCEL_LIMITS_APPROVAL) {
    const result = await activateOwnerApprovedInitialParcelProfiles(actor.id);
    console.log(JSON.stringify({
      event: "client_launch.owner_approved_parcels",
      approvalDate: "2026-10-13",
      ...result,
    }));
  }

  if (process.env.KT_OWNER_APPROVED_GAUTENG_COVERAGE === OWNER_GAUTENG_COVERAGE_APPROVAL) {
    const result = await activateOwnerApprovedGautengCoverage(actor.id);
    console.log(JSON.stringify({ event: "client_launch.owner_approved_gauteng_coverage", approvalReference: OWNER_GAUTENG_COVERAGE_APPROVAL, ...result }));
  }

  if (process.env.KT_OWNER_SELECTED_MARKETPLACE_COURIER_TARIFFS === OWNER_COURIER_TARIFF_APPROVAL) {
    const result = await activateOwnerSelectedCourierTariffs(actor.id);
    console.log(JSON.stringify({ event: "client_launch.owner_selected_marketplace_courier_tariffs", approvalReference: OWNER_COURIER_TARIFF_APPROVAL, ...result }));
  }

  if (process.env.KT_OWNER_SELECTED_COMMISSION_DEFAULTS === OWNER_COMMISSION_DEFAULTS_APPROVAL) {
    const result = await prepareOwnerSelectedCommissionDefaults(actor.id);
    console.log(JSON.stringify({ event: "client_launch.owner_selected_commission_defaults", approvalReference: OWNER_COMMISSION_DEFAULTS_APPROVAL, ...result }));
  }

  const express = await prisma.deliveryServiceDefinition.findFirst({ where: { stableKey: "CLIENT_EXPRESS" }, orderBy: { versionNumber: "desc" } });
  if (express?.versionNumber === 1 && express.status === "DRAFT") {
    const configuration = DeliveryConfigurationSchema.parse(express.pricingPolicy);
    // Never overwrite an operator's changed tariff. Only the previous unchanged
    // pending placeholder can receive this explicitly confirmed initial formula.
    if (!Object.values(configuration.tariffs).every((t) => t.baseFee === "0.00" && t.perKmRate === "5.50")) throw new Error("Express tariff changed; reviewed initialization cannot replace it.");
    await saveDeliveryConfiguration(actor.id, {
      ...configuration, active: true, expectedVersion: express.versionNumber,
      reason: "User-confirmed R5.50/km plus fixed parcel fees: Small R5.50, Medium R8.50, Large R13.00. Client-defined coverage remains pending.",
      tariffs: {
        SMALL: { ...configuration.tariffs.SMALL, baseFee: "5.50", perKmRate: "5.50" },
        MEDIUM: { ...configuration.tariffs.MEDIUM, baseFee: "8.50", perKmRate: "5.50" },
        LARGE: { ...configuration.tariffs.LARGE, baseFee: "13.00", perKmRate: "5.50" },
      },
    });
    console.log(JSON.stringify({ event: "client_launch.express_configured", formula: "DISTANCE_PLUS_PARCEL_FEE" }));
  }

  for (const policy of payload.policies) {
    let record = await prisma.legalDocumentVersion.findUnique({ where: { documentType_version_jurisdiction: { documentType: policy.documentType, version: policy.version, jurisdiction: "ZA" } } });
    if (record && record.contentHash !== policy.contentHash) throw new Error("Existing policy version differs from its reviewed source.");
    if (!record) {
      await createLegalDocumentDraft({ actorUserId: actor.id, documentType: policy.documentType, version: policy.version, jurisdiction: "ZA", content: policy.content, contentHash: policy.contentHash, contentReference: `client-source-sha256:${policy.sourceSha256}`, acceptancePolicy: "CURRENT_VERSION_REQUIRED" });
      record = await prisma.legalDocumentVersion.findUniqueOrThrow({ where: { documentType_version_jurisdiction: { documentType: policy.documentType, version: policy.version, jurisdiction: "ZA" } } });
    }
    if (record?.publicationStatus === "DRAFT") {
      await publishLegalDocumentVersion({ actorUserId: actor.id, publicReference: String(record.publicReference), operationId: `${source}:${policy.documentType}` });
      console.log(JSON.stringify({ event: "client_launch.policy_published", type: policy.documentType, contentHash: policy.contentHash }));
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('client-customer-notification-preparation')::bigint)`;
    await prepareCustomerOrderNotifications(tx);
    await prepareRequiredDomainNotifications(tx);
  });
  console.log(JSON.stringify({ event: "client_launch.notification_drafts_prepared", publicationApprovalRequired: true }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Reviewed client initialization failed.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
