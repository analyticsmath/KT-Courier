import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readPrismaModel } from "./prisma-source-audit-helpers";

const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");

const expectedPhysicalMappings: Record<string, string[]> = {
  DriverDeliveryResponsibilityReport: ["DriverDeliveryResponsibilityReport_assignmentId_reportType_crea"],
  LegalDocumentAcceptance: ["LegalDocumentAcceptance_documentVersionId_evidenceType_idx"],
  LegalDocumentVersion: ["LegalDocumentVersion_documentType_publicationStatus_effectiveAt"],
  ManagedMarketingBillingEvidence: [
    "ManagedMarketingBillingEvidence_payment_fkey",
    "ManagedMarketingBillingEvidence_receipt_journal_fkey",
    "ManagedMarketingBillingEvidence_request_fkey",
    "ManagedMarketingBillingEvidence_revenue_journal_fkey",
  ],
  ManagedMarketingChannelPlacement: [
    "ManagedMarketingChannelPlacement_advertisingPlacementDefinition",
    "ManagedMarketingChannelPlacement_channelDefinitionId_active_sor",
    "ManagedMarketingChannelPlacement_channelDefinitionId_displayNam",
  ],
  ManagedMarketingPackageChannel: [
    "ManagedMarketingPackageChannel_channel_fkey",
    "ManagedMarketingPackageChannel_package_fkey",
    "ManagedMarketingPackageChannel_package_channel_key",
  ],
  ManagedMarketingPerformanceRecord: [
    "ManagedMarketingPerformanceRecord_request_fkey",
    "ManagedMarketingPerformanceRecord_request_period_idx",
  ],
  ManagedMarketingRequestChannel: [
    "ManagedMarketingRequestChannel_channel_fkey",
    "ManagedMarketingRequestChannel_request_fkey",
    "ManagedMarketingRequestChannel_request_channel_key",
  ],
  ManagedMarketingRequestCreative: [
    "ManagedMarketingRequestCreative_catalogMedia_fkey",
    "ManagedMarketingRequestCreative_privateMedia_fkey",
    "ManagedMarketingRequestCreative_request_fkey",
    "ManagedMarketingRequestCreative_request_catalogMedia_key",
    "ManagedMarketingRequestCreative_request_createdAt_idx",
    "ManagedMarketingRequestCreative_request_privateMedia_key",
  ],
  ManagedMarketingRequestEvent: ["ManagedMarketingRequestEvent_request_fkey"],
  ManagedMarketingRequestPlacement: [
    "ManagedMarketingRequestPlacement_placement_fkey",
    "ManagedMarketingRequestPlacement_requestChannel_fkey",
    "ManagedMarketingRequestPlacement_channel_placement_key",
  ],
  PolicyRuntimeLink: ["PolicyRuntimeLink_legalDocumentVersionId_runtimeDomain_runtimeR"],
  PromoterQualificationEvaluation: [
    "PromoterQualificationEvaluation_period_key",
    "PromoterQualificationEvaluation_period_status_idx",
  ],
  PromoterTeamEdge: ["PromoterTeamEdge_child_active_idx", "PromoterTeamEdge_parent_active_idx"],
  ProviderPrivacyDataClass: ["ProviderPrivacyDataClass_providerGovernanceId_sensitiveDataClas"],
  RetentionExecution: ["RetentionExecution_resourceType_resourceReference_executedAt_id"],
  SensitiveDataResourceMapping: ["SensitiveDataResourceMapping_resourceType_resourceField_sensiti"],
  ShippingPackagePolicyVersion: ["ShippingPackagePolicyVersion_stableKey_status_effectiveFrom_eff"],
};

describe("Phase B Prisma physical-name reconciliation", () => {
  it("maps all 35 name-only objects and both pre-existing legal indexes without formatting-dependent assertions", () => {
    const mappings = Object.entries(expectedPhysicalMappings);
    expect(mappings.flatMap(([, names]) => names)).toHaveLength(37);

    for (const [modelName, names] of mappings) {
      const model = readPrismaModel(schema, modelName);
      for (const name of names) {
        expect(model).toContain(`map: "${name}"`);
      }
    }
  });
});
