import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { parsePrismaDrift } from '../../scripts/verify-database-schema.mjs';

describe('Gate 3 Schema Reconciliation Suite', () => {
  const root = process.cwd();
  const artifactPath = path.join(root, 'artifacts', 'gate3-schema-reconciliation.json');
  const schemaPath = path.join(root, 'prisma', 'schema.prisma');
  const migrationSqlPath = path.join(
    root,
    'prisma',
    'migrations',
    '20260805070000_comprehensive_schema_reconciliation',
    'migration.sql'
  );

  it('verifies that gate3-schema-reconciliation.json artifact contains exactly 388 entries with proper classification totals', () => {
    expect(fs.existsSync(artifactPath)).toBe(true);
    const content = fs.readFileSync(artifactPath, 'utf8');
    const records = JSON.parse(content);

    expect(records.length).toBe(388);

    const counts: Record<string, number> = {
      NAME_ONLY_PRISMA_MAP: 0,
      MISSING_INDEX_OR_UNIQUE: 0,
      REMAINING_STRUCTURAL: 0,
    };

    records.forEach((r: Record<string, string | number | undefined>) => {
      expect(r).toHaveProperty('number');
      expect(r).toHaveProperty('table');
      expect(r).toHaveProperty('differenceType');
      expect(r).toHaveProperty('originalPrismaOutput');
      expect(r).toHaveProperty('classification');
      expect(r).toHaveProperty('resolution');
      expect(r).toHaveProperty('schemaChange');
      expect(r).toHaveProperty('migrationChange');
      expect(r).toHaveProperty('domainJustification');
      expect(r).toHaveProperty('riskLevel');

      const classification = r.classification as string;
      if (counts[classification] !== undefined) {
        counts[classification]++;
      }
    });

    expect(counts.NAME_ONLY_PRISMA_MAP).toBe(240);
    expect(counts.MISSING_INDEX_OR_UNIQUE).toBe(120);
    expect(counts.REMAINING_STRUCTURAL).toBe(28);
    expect(counts.NAME_ONLY_PRISMA_MAP + counts.MISSING_INDEX_OR_UNIQUE + counts.REMAINING_STRUCTURAL).toBe(388);
  });

  it('verifies schema.prisma contains required physical index and constraint mappings', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // SOPolicyHistory primary key mapping
    expect(schema).toContain('@id(map: "SOPolicyHistory_pkey")');

    // FK mappings
    expect(schema).toContain('map: "RecruitmentApplication_userId_fkey"');
    expect(schema).toContain('map: "RecruitmentApplication_vacancyId_fkey"');
    expect(schema).toContain('map: "Vacancy_createdByUserId_fkey"');

    // Idempotency unique constraints
    expect(schema).toContain('map: "PaymentWebhookEvent_provider_providerEventId_key"');
    expect(schema).toContain('map: "PromoterQualification_evidenceFingerprint_key"');

    // Missing unique indexes
    expect(schema).toContain('@@unique([scope, sourceStoreId, slug]');
    expect(schema).toContain('@@unique([productId, variantId, assetId, role])');

    // Missing promoter FKs
    expect(schema).toContain('map: "PromoterAccount_userId_fkey"');
    expect(schema).toContain('map: "PromoterAgreementVersion_approvedByUserId_fkey"');
    expect(schema).toContain('map: "PromoterProgramVersion_approvedByUserId_fkey"');
  });

  it('verifies 20260805070000_comprehensive_schema_reconciliation/migration.sql structure and preflight guards', () => {
    expect(fs.existsSync(migrationSqlPath)).toBe(true);
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');

    // Preflight checks
    expect(sql).toContain('CatalogProduct');
    expect(sql).toContain('CatalogProductMedia');
    expect(sql).toContain('PromoterAccount');
    expect(sql).toContain('PromoterAgreementVersion');
    expect(sql).toContain('PromoterProgramVersion');

    // Unique indexes
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "CatalogProduct_scope_sourceStoreId_slug_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "CatalogProductMedia_productId_variantId_assetId_role_key"');

    // FK additions
    expect(sql).toContain('ALTER TABLE "PromoterAccount"');
    expect(sql).toContain('ALTER TABLE "PromoterAgreementVersion"');
    expect(sql).toContain('ALTER TABLE "PromoterProgramVersion"');

    // Notification default
    expect(sql).toContain('NotificationPreference');
    expect(sql).toContain('quietHoursDays');
  });

  it('verifies drift parser completeness guard against raw output lines', () => {
    const rawDrift = fs.readFileSync(path.join(root, 'artifacts', 'gate3-complete-schema-drift.txt'), 'utf16le');
    const report = parsePrismaDrift(rawDrift);
    expect(report.differences.length).toBe(388);
    expect(report.structuralLineCount).toBe(388);
  });

  it('verifies upgraded reconciliation artifact contains exact structural signature metadata for all 240 name-only items', () => {
    const content = fs.readFileSync(artifactPath, 'utf8');
    const records = JSON.parse(content);
    const nameOnly = records.filter((r: Record<string, unknown>) => r.classification === 'NAME_ONLY_PRISMA_MAP');

    expect(nameOnly.length).toBe(240);
    nameOnly.forEach((item: Record<string, unknown>) => {
      expect(item).toHaveProperty('oldPhysicalName');
      expect(item).toHaveProperty('prismaExpectedName');
      expect(item).toHaveProperty('model');
      expect(item).toHaveProperty('objectType');
      expect(item).toHaveProperty('orderedColumns');
      expect(item).toHaveProperty('matchedSchemaDeclaration');
      expect(item).toHaveProperty('finalMapName');
      expect(item.mappingMethod).toBe('EXACT_STRUCTURAL_SIGNATURE');
      expect(item.signatureVerified).toBe(true);
    });
  });

  it('verifies explicit repairs for CatalogAuditHistory, CatalogInventoryMovement, and CatalogOperationReceipt', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // CatalogAuditHistory
    expect(schema).toMatch(/@@index\(\[aggregateType,\s*aggregateReference,\s*createdAt\],[^)]*map:\s*"CatalogAuditHistory_aggregateType_aggregateReference_createdAt_"\)/);
    expect(schema).toMatch(/@@unique\(\[aggregateType,\s*aggregateReference,\s*aggregateVersion,\s*action\],[^)]*map:\s*"CatalogAuditHistory_aggregate_version_action_key"\)/);

    // CatalogInventoryMovement
    expect(schema).toMatch(/@@index\(\[inventoryItemId,\s*locationId,\s*createdAt\],[^)]*map:\s*"CatalogInventoryMovement_item_location_created_idx"\)/);
    expect(schema).toMatch(/@@unique\(\[inventoryItemId,\s*operationId\],[^)]*map:\s*"CatalogInventoryMovement_item_operation_key"\)/);

    // CatalogOperationReceipt indexes
    expect(schema).toMatch(/@@index\(\[aggregateReference\],[^)]*map:\s*"CatalogOperationReceipt_aggregate_idx"\)/);
    expect(schema).toMatch(/@@index\(\[storeId,\s*createdAt\],[^)]*map:\s*"CatalogOperationReceipt_store_created_idx"\)/);

    // CatalogOperationReceipt foreign keys
    expect(schema).toContain('map: "CatalogOperationReceipt_actor_fkey"');
    expect(schema).toContain('map: "CatalogOperationReceipt_store_fkey"');
  });

  it('verifies all 9 retained extra foreign keys are fully declared in schema.prisma', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');

    const retainedFKs = [
      'CatalogOperationReceipt_actor_fkey',
      'CatalogOperationReceipt_store_fkey',
      'SubscriptionInvoice_paymentId_fkey',
      'PaymentRefund_createdByUserId_fkey',
      'PaymentWebhookEvent_paymentId_phase12_restrict_fkey',
      'SubscriptionRefundAdjustment_journal_fkey',
      'SubscriptionRenewalApplication_invoice_fkey',
      'SubscriptionRenewalApplication_payment_fkey',
      'WithdrawalRequest_reviewedByUserId_fkey',
    ];

    retainedFKs.forEach((fkMap) => {
      expect(schema).toContain(`map: "${fkMap}"`);
    });
  });

  it('detects and rejects reciprocal rename cycles in test fixtures', () => {
    const detectCycles = (pairs: Array<{ oldPhysicalName: string; prismaExpectedName: string }>) => {
      const mapForward = new Map<string, string>();
      pairs.forEach((p) => mapForward.set(p.oldPhysicalName, p.prismaExpectedName));

      let reciprocalCount = 0;
      pairs.forEach((p) => {
        const A = p.oldPhysicalName;
        const B = p.prismaExpectedName;
        if (mapForward.has(B) && mapForward.get(B) === A) {
          reciprocalCount++;
        }
      });
      return Math.floor(reciprocalCount / 2);
    };

    // Fixture with reciprocal cycle: A -> B and B -> A
    const cyclicFixture = [
      { oldPhysicalName: 'CatalogAuditHistory_aggregateType_createdAt_', prismaExpectedName: 'CatalogAuditHistory_aggregate_key' },
      { oldPhysicalName: 'CatalogAuditHistory_aggregate_key', prismaExpectedName: 'CatalogAuditHistory_aggregateType_createdAt_' },
    ];
    expect(detectCycles(cyclicFixture)).toBe(1);

    // Fixture with valid non-cyclic mappings
    const validFixture = [
      { oldPhysicalName: 'Index_A_old', prismaExpectedName: 'Index_A_expected' },
      { oldPhysicalName: 'Index_B_old', prismaExpectedName: 'Index_B_expected' },
    ];
    expect(detectCycles(validFixture)).toBe(0);
  });

  it('verifies final-20 closure artifact structure and 20 resolved entries', () => {
    const closurePath = path.join(root, 'artifacts', 'gate3-final-20-closure.json');
    expect(fs.existsSync(closurePath)).toBe(true);
    const records = JSON.parse(fs.readFileSync(closurePath, 'utf8'));

    expect(records.length).toBe(20);
    records.forEach((entry: Record<string, string | number | undefined>) => {
      expect(entry).toHaveProperty('number');
      expect(entry).toHaveProperty('table');
      expect(entry).toHaveProperty('differenceType');
      expect(entry).toHaveProperty('resolutionType');
      expect(entry).toHaveProperty('schemaChange');
      expect(entry).toHaveProperty('migrationChange');
      expect(entry).toHaveProperty('invariantPreserved');
      expect(entry).toHaveProperty('verification');
    });
  });

  it('verifies explicit closure repairs across all six models in schema.prisma and migration.sql', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // PaymentRefund
    expect(schema).toMatch(/legacyCreatedByUserId\s+String\?\s+@map\("legacyCreatedByUserId"\)/);
    expect(schema).toContain('map: "PaymentRefund_createdByUserId_fkey"');
    expect(schema).not.toContain('legacyCreatedByUserId   String?        @map("createdByUserId")');
    expect(schema).toContain('@@index([createdAt], map: "PaymentRefund_createdAt_idx")');
    expect(schema).toContain('@@index([legacyCreatedByUserId], map: "PaymentRefund_createdByUserId_idx")');
    expect(schema).toContain('@@index([paymentId], map: "PaymentRefund_paymentId_idx")');
    expect(schema).toContain('@@index([legacyPaymentStatus], map: "PaymentRefund_status_idx")');
    expect(schema).toMatch(/legacyCurrency\s+String\s+@default\("ZAR"\)\s+@map\("legacyCurrency"\)/);
    expect(schema).toMatch(/legacyPaymentStatus\s+PaymentStatus\s+@default\(PENDING\)\s+@map\("legacyPaymentStatus"\)/);

    // PaymentWebhookEvent
    expect(schema).toContain('map: "PaymentWebhookEvent_paymentId_phase12_restrict_fkey"');
    expect(schema).toContain('@@index([legacyEventType], map: "PaymentWebhookEvent_eventType_idx")');
    expect(schema).toContain('@@index([legacyProcessingStatus], map: "PaymentWebhookEvent_processingStatus_idx")');
    expect(schema).toContain('updatedAt             DateTime                       @default(now()) @updatedAt');

    // RecruitmentApplication
    expect(schema).toContain('@@index([status], map: "RecruitmentApplication_status_phase26_idx")');
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');
    expect(sql).toContain('RecruitmentApplication_status_phase26_idx');

    // StorefrontProductDocument
    expect(schema).toContain('@@index([searchText(ops: raw("gin_trgm_ops"))], type: Gin, map: "StorefrontProductDocument_search_trgm_idx")');

    // SubscriptionPlanVersionStatusHistory
    expect(schema).toContain('map: "SubscriptionPlanVersionStatusHistory_planVersionId_createdAt_id"');

    // WithdrawalRequest
    expect(schema).toContain('@@index([createdAt], map: "WithdrawalRequest_requestedAt_idx")');
    expect(schema).toContain('@@index([legacyReviewedByUserId], map: "WithdrawalRequest_reviewedByUserId_idx")');
    expect(schema).toContain('@@index([status], map: "WithdrawalRequest_status_idx")');
  });

  it('verifies gate3-final-four-closure.json artifact structure and 4 resolved entries', () => {
    const closure4Path = path.join(root, 'artifacts', 'gate3-final-four-closure.json');
    expect(fs.existsSync(closure4Path)).toBe(true);
    const records = JSON.parse(fs.readFileSync(closure4Path, 'utf8'));

    expect(records.length).toBe(4);
    records.forEach((entry: Record<string, unknown>) => {
      expect(entry).toHaveProperty('entry');
      expect(entry).toHaveProperty('differenceType');
      expect(entry).toHaveProperty('table');
      expect(entry).toHaveProperty('columns');
      expect(entry).toHaveProperty('rootCause');
      expect(entry).toHaveProperty('schemaResolution');
      expect(entry).toHaveProperty('physicalObjectPreserved');
      expect(entry).toHaveProperty('generatedSqlEvidence');
      expect(entry.resolved).toBe(true);
    });
  });

  it('verifies final four schema representation and generated SQL assertions', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // 1. PaymentWebhookEvent paymentId foreign key
    expect(schema).toContain('onUpdate: Cascade, map: "PaymentWebhookEvent_paymentId_phase12_restrict_fkey"');
    expect(schema).toContain('webhooks                               PaymentWebhookEvent[]                   @relation("PaymentWebhookEvents")');
    expect(schema).not.toMatch(/paymentId\s+String\?[^@\n]*@ignore/);

    // 2. StoreSellerLegalIdentity updatedAt timestamp policy
    const storeSellerMatch = schema.match(/model StoreSellerLegalIdentity\s*\{([^}]+)\}/);
    expect(storeSellerMatch).not.toBeNull();
    const storeSellerBody = storeSellerMatch![1];
    const updatedAtLine = storeSellerBody.split('\n').find((line) => line.includes('updatedAt')) || '';
    expect(updatedAtLine).toContain('@updatedAt');
    expect(updatedAtLine).not.toContain('@default');

    // 3 & 4. StorefrontProductDocument GIN trigram index
    expect(schema).toContain('@@index([searchText(ops: raw("gin_trgm_ops"))], type: Gin, map: "StorefrontProductDocument_search_trgm_idx")');
    expect(schema).not.toContain('@@index([searchText], map: "StorefrontProductDocument_search_trgm_idx")');
  });

  it('verifies duplicate payment webhook foreign key elimination logic in migration.sql', () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');

    // Canonical constraint check
    expect(sql).toContain('PaymentWebhookEvent_paymentId_phase12_restrict_fkey');
    expect(sql).toContain("RAISE EXCEPTION 'Preflight failed: Canonical constraint PaymentWebhookEvent_paymentId_phase12_restrict_fkey not found on PaymentWebhookEvent.'");

    // Exact drop of legacy duplicate constraint without CASCADE
    expect(sql).toContain('ALTER TABLE "PaymentWebhookEvent" DROP CONSTRAINT "PaymentWebhookEvent_paymentId_fkey";');
    expect(sql).not.toContain('DROP CONSTRAINT "PaymentWebhookEvent_paymentId_phase12_restrict_fkey"');
    expect(sql).not.toContain('DROP CONSTRAINT "PaymentWebhookEvent_paymentId_fkey" CASCADE');

    // Postflight assertion of exactly 1 FK
    expect(sql).toContain("RAISE EXCEPTION 'Postflight failed: Expected exactly 1 foreign key on PaymentWebhookEvent(paymentId), found %.'");
  });

  it('verifies final-four closure artifact contains complete FK count metadata', () => {
    const closure4Path = path.join(root, 'artifacts', 'gate3-final-four-closure.json');
    const records = JSON.parse(fs.readFileSync(closure4Path, 'utf8'));

    const fkRecord = records.find(
      (r: Record<string, unknown>) => r.table === 'PaymentWebhookEvent' && r.differenceType === 'FOREIGN_KEY_EXTRA'
    );
    expect(fkRecord).toBeDefined();
    expect(fkRecord.physicalForeignKeysBefore).toBe(2);
    expect(fkRecord.canonicalForeignKey).toBe('PaymentWebhookEvent_paymentId_phase12_restrict_fkey');
    expect(fkRecord.duplicateForeignKeysRemoved).toEqual(['PaymentWebhookEvent_paymentId_fkey']);
    expect(fkRecord.physicalForeignKeysAfter).toBe(1);
    expect(fkRecord.resolved).toBe(true);
  });
});




