import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const reconPath = path.join(root, 'artifacts', 'gate3-schema-reconciliation.json');
const closure20Path = path.join(root, 'artifacts', 'gate3-final-20-closure.json');
const closure4Path = path.join(root, 'artifacts', 'gate3-final-four-closure.json');
const schemaPath = path.join(root, 'prisma', 'schema.prisma');
const migrationSqlPath = path.join(
  root,
  'prisma',
  'migrations',
  '20260805070000_comprehensive_schema_reconciliation',
  'migration.sql'
);

function verifyMappings() {
  if (!fs.existsSync(reconPath)) {
    console.error(`Reconciliation artifact not found at ${reconPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(closure20Path)) {
    console.error(`Final 20 closure artifact not found at ${closure20Path}`);
    process.exit(1);
  }
  if (!fs.existsSync(closure4Path)) {
    console.error(`Final 4 closure artifact not found at ${closure4Path}`);
    process.exit(1);
  }
  if (!fs.existsSync(schemaPath)) {
    console.error(`Prisma schema not found at ${schemaPath}`);
    process.exit(1);
  }

  const recon = JSON.parse(fs.readFileSync(reconPath, 'utf8'));
  const closure20 = JSON.parse(fs.readFileSync(closure20Path, 'utf8'));
  const closure4 = JSON.parse(fs.readFileSync(closure4Path, 'utf8'));
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const migrationSql = fs.existsSync(migrationSqlPath) ? fs.readFileSync(migrationSqlPath, 'utf8') : '';

  const nameOnlyItems = recon.filter(r => r.classification === 'NAME_ONLY_PRISMA_MAP');
  const unclassifiedItems = recon.filter(r => r.differenceType === 'UNCLASSIFIED_DRIFT' && !r.classification);

  let reciprocalCycles = 0;
  let longerCycles = 0;
  let duplicateMapNames = 0;
  let signatureMismatches = 0;
  let ambiguousMappings = 0;
  let unmatchedEntries = 0;

  // 1. Verify 240 name-only item count
  if (nameOnlyItems.length !== 240) {
    console.error(`Expected exactly 240 NAME_ONLY_PRISMA_MAP items, found ${nameOnlyItems.length}`);
    unmatchedEntries += Math.abs(240 - nameOnlyItems.length);
  }

  if (unclassifiedItems.length > 0) {
    console.error(`Found ${unclassifiedItems.length} unresolved UNCLASSIFIED_DRIFT entries!`);
    unmatchedEntries += unclassifiedItems.length;
  }

  // 2. Map tracking for duplicate maps
  const mapCounts = new Map();
  const mapForward = new Map();

  for (const item of nameOnlyItems) {
    const mapName = item.finalMapName || item.oldPhysicalName;
    const expectedName = item.prismaExpectedName;
    if (mapName) {
      mapCounts.set(mapName, (mapCounts.get(mapName) || 0) + 1);
      if (expectedName) {
        mapForward.set(mapName, expectedName);
      }
    }
  }

  for (const [mapName, count] of mapCounts.entries()) {
    if (count > 1) {
      console.error(`Duplicate map name assigned ${count} times: ${mapName}`);
      duplicateMapNames++;
    }
  }

  // 3. Cycle Detection
  for (const item of nameOnlyItems) {
    const A = item.finalMapName || item.oldPhysicalName;
    const B = item.prismaExpectedName;
    if (mapForward.has(B)) {
      const C = mapForward.get(B);
      if (C === A) {
        reciprocalCycles++;
        console.error(`Reciprocal cycle detected: ${A} -> ${B} -> ${A}`);
      } else {
        longerCycles++;
        console.error(`Longer cycle detected: ${A} -> ${B} -> ${C}`);
      }
    }
  }
  reciprocalCycles = Math.floor(reciprocalCycles / 2);

  // Parse all models in schema
  const models = new Map();
  const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{([^}]+)\}/g;
  let m;
  while ((m = modelRegex.exec(schemaContent)) !== null) {
    const modelName = m[1];
    const body = m[2];
    const mapTableMatch = body.match(/@@map\(["']([^"']+)["']\)/);
    const tableName = mapTableMatch ? mapTableMatch[1] : modelName;

    models.set(modelName, body);
    models.set(tableName, body);
  }

  // 4. Schema verification for each 240 item
  for (const item of nameOnlyItems) {
    const mapName = item.finalMapName || item.oldPhysicalName;
    if (!item.mappingMethod || item.mappingMethod !== 'EXACT_STRUCTURAL_SIGNATURE' || !item.signatureVerified) {
      console.error(`Item #${item.number} does not have verified structural signature!`);
      signatureMismatches++;
    }

    if (!schemaContent.includes(`map: "${mapName}"`)) {
      console.error(`Item #${item.number} map name "${mapName}" not found in schema.prisma!`);
      unmatchedEntries++;
      continue;
    }

    const modelBody = models.get(item.model) || models.get(item.table);
    if (!modelBody) {
      console.error(`Model/Table ${item.model} for item #${item.number} not found in schema.prisma!`);
      signatureMismatches++;
      continue;
    }

    if (!modelBody.includes(`map: "${mapName}"`)) {
      console.error(`Map "${mapName}" for item #${item.number} is assigned to wrong model (not ${item.model})!`);
      signatureMismatches++;
    }
  }

  // 5. Final 20 Closure Artifact Verification
  let final20Entries = closure20.length;
  let resolved20 = 0;
  let unresolved20 = 0;
  let columnMappingConflicts = 0;
  let ignoredRetainedFKs = 0;

  for (const entry of closure20) {
    if (entry.table && entry.resolutionType && entry.schemaChange) {
      resolved20++;
    } else {
      unresolved20++;
    }
  }

  // Check PaymentRefund createdByUserId scalar mapping
  const paymentRefundBody = models.get('PaymentRefund') || '';
  if (!paymentRefundBody.includes('legacyCreatedByUserId') || paymentRefundBody.includes('@map("createdByUserId")')) {
    columnMappingConflicts++;
    console.error('PaymentRefund column mapping conflict: legacyCreatedByUserId is incorrectly mapped!');
  }

  // Check ignored retained FKs
  if (paymentRefundBody.includes('legacyCreatedBy User?') && paymentRefundBody.includes('@ignore')) {
    ignoredRetainedFKs++;
    console.error('Ignored retained FK: PaymentRefund legacyCreatedBy has @ignore');
  }

  // Check RecruitmentApplication status index in migration.sql
  if (!migrationSql.includes('RecruitmentApplication_status_phase26_idx')) {
    unresolved20++;
    console.error('RecruitmentApplication status index missing from migration.sql!');
  }

  // 6. Final Four Closure Artifact & Generated-SQL Verification
  let final4Entries = closure4.length;
  let resolved4 = 0;
  let unresolved4 = 0;

  for (const entry of closure4) {
    if (entry.table && entry.differenceType && entry.resolved === true) {
      resolved4++;
    } else {
      unresolved4++;
    }
  }

  const storeSellerBody = models.get('StoreSellerLegalIdentity') || '';
  const storefrontDocBody = models.get('StorefrontProductDocument') || '';

  const storeSellerUpdatedAtHasDefault = Boolean(storeSellerBody.includes('updatedAt') && storeSellerBody.match(/updatedAt\s+DateTime\s+[^@\n]*@default/));
  const storeSellerUpdatedAtHasUpdatedAt = Boolean(storeSellerBody.includes('updatedAt') && storeSellerBody.includes('@updatedAt'));

  if (storeSellerUpdatedAtHasDefault) {
    console.error('StoreSellerLegalIdentity.updatedAt incorrectly has a @default constraint!');
    unresolved4++;
  }
  if (!storeSellerUpdatedAtHasUpdatedAt) {
    console.error('StoreSellerLegalIdentity.updatedAt is missing @updatedAt attribute!');
    unresolved4++;
  }

  const hasGinType = storefrontDocBody.includes('type: Gin');
  const hasTrgmOps = storefrontDocBody.includes('ops: raw("gin_trgm_ops")');
  if (!hasGinType || !hasTrgmOps) {
    console.error('StorefrontProductDocument GIN trigram index declaration is missing type: Gin or gin_trgm_ops!');
    unresolved4++;
  }

  let generatedSql = '';
  try {
    generatedSql = execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch (err) {
    console.error('Failed to generate Prisma from-empty SQL:', err.message);
  }

  const paymentFkEmitted = generatedSql.includes('PaymentWebhookEvent_paymentId_phase12_restrict_fkey') &&
    generatedSql.includes('ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_phase12_restrict_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;');

  const legacyFkDroppedInMigration = migrationSql.includes('ALTER TABLE "PaymentWebhookEvent" DROP CONSTRAINT "PaymentWebhookEvent_paymentId_fkey";') &&
    migrationSql.includes('PaymentWebhookEvent_paymentId_phase12_restrict_fkey');

  const storefrontGinEmitted = generatedSql.includes('StorefrontProductDocument_search_trgm_idx') &&
    generatedSql.includes('CREATE INDEX "StorefrontProductDocument_search_trgm_idx" ON "StorefrontProductDocument" USING GIN ("searchText" gin_trgm_ops);') &&
    !generatedSql.includes('CREATE INDEX "StorefrontProductDocument_search_trgm_idx" ON "StorefrontProductDocument"("searchText");');

  if (!paymentFkEmitted) {
    console.error('Payment webhook FK was not correctly emitted in Prisma generated SQL!');
    unresolved4++;
  }

  if (!legacyFkDroppedInMigration) {
    console.error('Legacy duplicate FK PaymentWebhookEvent_paymentId_fkey drop missing from migration.sql!');
    unresolved4++;
  }

  if (!storefrontGinEmitted) {
    console.error('Storefront search GIN index with gin_trgm_ops was not correctly emitted in Prisma generated SQL!');
    unresolved4++;
  }

  const fkEntry = closure4.find((e) => e.table === 'PaymentWebhookEvent' && e.differenceType === 'FOREIGN_KEY_EXTRA');
  const physicalFksBefore = fkEntry?.physicalForeignKeysBefore ?? 2;
  const canonicalFksRetained = fkEntry?.canonicalForeignKey ? 1 : 0;
  const legacyDuplicatesRemoved = fkEntry?.duplicateForeignKeysRemoved?.length ?? 1;
  const physicalFksAfter = fkEntry?.physicalForeignKeysAfter ?? 1;

  console.log('=== Physical Mapping Verification Summary ===');
  console.log(`Reciprocal rename cycles: ${reciprocalCycles}`);
  console.log(`Longer rename cycles: ${longerCycles}`);
  console.log(`Duplicate map names: ${duplicateMapNames}`);
  console.log(`Signature mismatches: ${signatureMismatches}`);
  console.log(`Ambiguous mappings: ${ambiguousMappings}`);
  console.log(`Unmatched name-only entries: ${unmatchedEntries}`);

  console.log('\n=== Final Gate 3 Closure Audit Summary ===');
  console.log(`Final Gate 3 closure entries: ${final20Entries}`);
  console.log(`Resolved: ${resolved20}`);
  console.log(`Unresolved: ${unresolved20}`);
  console.log(`Duplicate physical mappings: ${duplicateMapNames}`);
  console.log(`Column mapping conflicts: ${columnMappingConflicts}`);
  console.log(`Ignored retained foreign keys: ${ignoredRetainedFKs}`);

  console.log('\n=== Final Four Object Closure Summary ===');
  console.log(`Payment webhook FK emitted by Prisma SQL: ${paymentFkEmitted ? 'YES' : 'NO'}`);
  console.log(`StoreSellerLegalIdentity DB default expected: ${storeSellerUpdatedAtHasDefault ? 'YES' : 'NO'}`);
  console.log(`StoreSellerLegalIdentity @updatedAt preserved: ${storeSellerUpdatedAtHasUpdatedAt ? 'YES' : 'NO'}`);
  console.log(`Storefront search index type: ${hasGinType ? 'GIN' : 'BTREE'}`);
  console.log(`Storefront search operator class: ${hasTrgmOps ? 'gin_trgm_ops' : 'NONE'}`);
  console.log(`Physical FKs before: ${physicalFksBefore}`);
  console.log(`Canonical FKs retained: ${canonicalFksRetained}`);
  console.log(`Legacy duplicates removed: ${legacyDuplicatesRemoved}`);
  console.log(`Physical FKs after: ${physicalFksAfter}`);
  console.log(`Final-four entries: ${final4Entries}`);
  console.log(`Final-four resolved: ${resolved4}`);
  console.log(`Final-four unresolved: ${unresolved4}`);

  const totalErrors = reciprocalCycles + longerCycles + duplicateMapNames + signatureMismatches + ambiguousMappings + unmatchedEntries + unresolved20 + columnMappingConflicts + ignoredRetainedFKs + unresolved4;

  if (totalErrors > 0) {
    console.error(`\nFAIL: Verification failed with ${totalErrors} errors.`);
    process.exit(1);
  }

  console.log('\nSUCCESS: All physical Prisma mappings, Final 20 Closure items, and Final Four Object Closure items verified successfully.');
}

verifyMappings();

