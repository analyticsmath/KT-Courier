import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db/prisma";
import { evaluateDispatchComplianceEvidence } from "../lib/services/vehicle-compliance.service";

export const REQUIRED_PROTECTED_AUDIT_TABLES = [
  "User",
  "Store",
  "Address",
  "Order",
  "Payment",
  "PaymentAttempt",
  "PaymentRefund",
  "PaymentWebhookEvent",
  "PaymentVerifiedEventIntent",
  "PaymentReconciliationCase",
  "PaymentReleaseProvenance",
  "PaystackSandboxVerification",
  "PaystackLiveVerification",
  "MarketplaceOrder",
  "MarketplaceStoreOrder",
  "CashOnDelivery",
  "DriverCashDeposit",
  "PrivateMediaObject",
  "StoreEarning",
  "DriverEarning",
  "WithdrawalRequest",
  "CommissionAccrual",
  "LedgerAccount",
  "LedgerJournal",
  "LedgerEntry",
  "Wallet",
  "WalletTransaction",
  "DriverProfile",
  "CatalogProduct",
  "CatalogProductVariant",
  "CatalogCategory",
  "CatalogMediaAsset",
  "StorefrontProductDocument",
  "PaymentMethodPolicy",
  "CommissionPlan",
  "StoreOrderOperationalPolicy",
  "RetentionPolicyVersion",
] as const;

const VOLATILE_OR_EXCLUDED_TABLES = new Set(["_prisma_migrations", "Session", "VerificationToken"]);
const AUDIT_CHUNK_SIZE = 500;

export type TableAuditSummary = Readonly<{
  count: number;
  hash: string;
}>;

export type PrivilegeCheckInput = Readonly<{
  role: string;
  transactionReadOnly: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  writableTables: readonly string[];
}>;

export function evaluatePostgreSqlLeastPrivilege(input: PrivilegeCheckInput): Readonly<{
  leastPrivilegeVerified: boolean;
  findings: readonly string[];
}> {
  const findings: string[] = [];
  if (input.transactionReadOnly !== "on") {
    findings.push("Transaction is not enforced read-only.");
  }
  if (input.rolsuper) {
    findings.push(`Role '${input.role}' has SUPERUSER privileges (SET TRANSACTION READ ONLY alone does not make this a least-privilege role).`);
  }
  if (input.rolbypassrls) {
    findings.push(`Role '${input.role}' has BYPASSRLS privileges.`);
  }
  if (input.writableTables.length > 0) {
    findings.push(
      `Role '${input.role}' holds DML/TRUNCATE privileges on ${input.writableTables.length} audited table(s): ${input.writableTables.slice(0, 6).join(", ")}${input.writableTables.length > 6 ? "..." : ""}.`,
    );
  }
  return Object.freeze({
    leastPrivilegeVerified: findings.length === 0,
    findings: Object.freeze(findings),
  });
}

export function resolveDiscoverableProtectedTables(discoveredPublicTables: readonly string[]): string[] {
  const discoveredSet = new Set(discoveredPublicTables.filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)));
  const selected = new Set<string>();
  for (const required of REQUIRED_PROTECTED_AUDIT_TABLES) {
    if (discoveredSet.has(required)) {
      selected.add(required);
    }
  }
  for (const table of discoveredSet) {
    if (VOLATILE_OR_EXCLUDED_TABLES.has(table)) continue;
    if (
      /^(User|Store|Address|Order|Payment|Marketplace|Cash|Driver|PrivateMedia|StoreEarning|DriverEarning|Withdrawal|Commission|Ledger|Wallet|Catalog|Storefront|Retention|Legal|CompanyProfile|Delivery|Notification|Paystack)/.test(
        table,
      )
    ) {
      selected.add(table);
    }
  }
  return [...selected].sort();
}

export function buildAuditReceiptDigest(input: {
  at: string;
  releaseSha: string | null;
  migrationCount: number | null;
  latestMigration: string | null;
  protected: Record<string, TableAuditSummary>;
}): string {
  const orderedTables = Object.keys(input.protected)
    .sort()
    .map((key) => [key, input.protected[key].count, input.protected[key].hash]);
  return createHash("sha256")
    .update(
      JSON.stringify({
        at: input.at,
        releaseSha: input.releaseSha,
        migrationCount: input.migrationCount,
        latestMigration: input.latestMigration,
        tables: orderedTables,
      }),
    )
    .digest("hex");
}

export function sanitizeAuditOutputForConsole<T extends Record<string, unknown>>(report: T): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...report };
  delete clone.storesRestricted;
  delete clone.stores;
  delete clone.storeCollectionReadiness;
  return clone;
}

export type AuditDiffSnapshot = Readonly<{
  releaseSha?: string | null;
  migrationCount?: number | null;
  latestMigration?: string | null;
  protected: Record<string, TableAuditSummary>;
}>;

export function compareProtectedRowAudits(
  before: AuditDiffSnapshot | null | undefined,
  after: AuditDiffSnapshot,
): Readonly<{
  unchanged: boolean;
  changedTables: readonly string[];
  addedTables: readonly string[];
  removedTables: readonly string[];
  commerceActivityDetected: boolean;
  limitations: readonly string[];
}> {
  if (!before || !before.protected) {
    return Object.freeze({
      unchanged: false,
      changedTables: Object.freeze([]),
      addedTables: Object.freeze(Object.keys(after.protected).sort()),
      removedTables: Object.freeze([]),
      commerceActivityDetected: false,
      limitations: Object.freeze(["PRE_DEPLOYMENT_BASELINE_ABSENT"]),
    });
  }

  const beforeKeys = new Set(Object.keys(before.protected));
  const afterKeys = new Set(Object.keys(after.protected));
  const addedTables = [...afterKeys].filter((k) => !beforeKeys.has(k)).sort();
  const removedTables = [...beforeKeys].filter((k) => !afterKeys.has(k)).sort();
  const changedTables: string[] = [];

  for (const key of [...afterKeys].filter((k) => beforeKeys.has(k)).sort()) {
    const b = before.protected[key];
    const a = after.protected[key];
    if (b.count !== a.count || b.hash !== a.hash) {
      changedTables.push(key);
    }
  }

  const commerceTables = new Set([
    "Order",
    "Payment",
    "PaymentAttempt",
    "PaymentRefund",
    "MarketplaceOrder",
    "MarketplaceStoreOrder",
    "LedgerJournal",
    "LedgerEntry",
    "CashOnDelivery",
    "DriverCashDeposit",
  ]);
  const commerceActivityDetected = changedTables.some((table) => commerceTables.has(table));

  return Object.freeze({
    unchanged: changedTables.length === 0 && addedTables.length === 0 && removedTables.length === 0,
    changedTables: Object.freeze(changedTables),
    addedTables: Object.freeze(addedTables),
    removedTables: Object.freeze(removedTables),
    commerceActivityDetected,
    limitations: Object.freeze([]),
  });
}

async function computeDeterministicBoundedTableHash(
  tx: Prisma.TransactionClient,
  tableName: string,
  hasIdColumn: boolean,
): Promise<TableAuditSummary> {
  const quotedTable = `"${tableName.replace(/"/g, "\"\"")}"`;
  const [{ count }] = await tx.$queryRawUnsafe<Array<{ count: number }>>(`SELECT count(*)::int AS count FROM ${quotedTable}`);
  if (count === 0) {
    return {
      count: 0,
      hash: createHash("sha256").update("").digest("hex"),
    };
  }

  const hasher = createHash("sha256");
  let firstRow = true;

  if (hasIdColumn) {
    let lastId: string | null = null;
    while (true) {
      const batch: Array<{ id: string; row_json: string }> =
        lastId === null
          ? await tx.$queryRawUnsafe<Array<{ id: string; row_json: string }>>(
              `SELECT "id"::text AS id, to_jsonb(t)::text AS row_json FROM ${quotedTable} t ORDER BY "id" ASC LIMIT $1`,
              AUDIT_CHUNK_SIZE,
            )
          : await tx.$queryRawUnsafe<Array<{ id: string; row_json: string }>>(
              `SELECT "id"::text AS id, to_jsonb(t)::text AS row_json FROM ${quotedTable} t WHERE "id"::text > $1 ORDER BY "id" ASC LIMIT $2`,
              lastId,
              AUDIT_CHUNK_SIZE,
            );
      if (batch.length === 0) break;
      for (const row of batch) {
        if (!firstRow) hasher.update("\n");
        hasher.update(row.row_json, "utf8");
        firstRow = false;
        lastId = row.id;
      }
      if (batch.length < AUDIT_CHUNK_SIZE) break;
    }
  } else {
    let offset = 0;
    while (true) {
      const batch: Array<{ row_json: string }> = await tx.$queryRawUnsafe<Array<{ row_json: string }>>(
        `SELECT to_jsonb(t)::text AS row_json FROM ${quotedTable} t ORDER BY to_jsonb(t)::text ASC LIMIT $1 OFFSET $2`,
        AUDIT_CHUNK_SIZE,
        offset,
      );
      if (batch.length === 0) break;
      for (const row of batch) {
        if (!firstRow) hasher.update("\n");
        hasher.update(row.row_json, "utf8");
        firstRow = false;
      }
      offset += batch.length;
      if (batch.length < AUDIT_CHUNK_SIZE) break;
    }
  }

  return {
    count,
    hash: hasher.digest("hex"),
  };
}

export async function reviewedProtectedRowAudit(options?: {
  includeRestrictedDetails?: boolean;
  env?: Record<string, string | undefined>;
}) {
  const env = options?.env ?? process.env;
  const nowIso = new Date().toISOString();
  const releaseSha = (env.RAILWAY_GIT_COMMIT_SHA ?? env.VERCEL_GIT_COMMIT_SHA ?? "").trim() || null;

  let databaseMeta: Record<string, unknown> = {};
  let driverReadiness: Record<string, unknown> = {};
  let activeStoreCount = 0;
  let readyStoreCount = 0;
  let migrationCount = 0;
  let latestMigration: string | null = null;
  let protectedRows: Record<string, TableAuditSummary> = {};
  let storesRestricted: Array<{ id: string; status: string; collectionAddressPresent: boolean; collectionAddressComplete: boolean }> = [];
  let policies: unknown = [];
  let company: unknown = [];
  let parcels: unknown = [];
  let services: unknown = [];
  let processorRuns: unknown = [];
  const pendingConfigurationCounts: Record<string, number> = {};
  let customerNotificationConfiguration: Record<string, unknown> = {};

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5000ms'");

      const identity = await tx.$queryRaw<
        Array<{
          database: string;
          role: string;
          transactionReadOnly: string;
          rolsuper: boolean;
          rolbypassrls: boolean;
        }>
      >`
        SELECT
          current_database() AS database,
          current_user AS role,
          current_setting('transaction_read_only') AS "transactionReadOnly",
          COALESCE(r.rolsuper, false) AS rolsuper,
          COALESCE(r.rolbypassrls, false) AS rolbypassrls
        FROM pg_roles r
        WHERE r.rolname = current_user
      `;
      const dbIdentity = identity[0];

      const tableRows = await tx.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC
      `;
      const discoveredTables = resolveDiscoverableProtectedTables(tableRows.map((r) => r.table_name));

      const idColRows = await tx.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'id'
      `;
      const tablesWithId = new Set(idColRows.map((r) => r.table_name));

      const writableTableRows = await tx.$queryRaw<Array<{ table_name: string }>>`
        SELECT t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND (
            has_table_privilege(current_user, quote_ident(t.table_name), 'INSERT')
            OR has_table_privilege(current_user, quote_ident(t.table_name), 'UPDATE')
            OR has_table_privilege(current_user, quote_ident(t.table_name), 'DELETE')
            OR has_table_privilege(current_user, quote_ident(t.table_name), 'TRUNCATE')
          )
        ORDER BY t.table_name ASC
      `;
      const writableAuditTables = writableTableRows
        .map((r) => r.table_name)
        .filter((t) => discoveredTables.includes(t));

      const privilegeEval = evaluatePostgreSqlLeastPrivilege({
        role: dbIdentity?.role ?? "unknown",
        transactionReadOnly: dbIdentity?.transactionReadOnly ?? "off",
        rolsuper: Boolean(dbIdentity?.rolsuper),
        rolbypassrls: Boolean(dbIdentity?.rolbypassrls),
        writableTables: writableAuditTables,
      });

      databaseMeta = {
        database: dbIdentity?.database,
        role: dbIdentity?.role,
        transactionReadOnly: dbIdentity?.transactionReadOnly,
        leastPrivilegeVerified: privilegeEval.leastPrivilegeVerified,
        privilegeFindings: [...privilegeEval.findings],
      };

      try {
        const migrations = await tx.$queryRaw<Array<{ migration_name: string }>>`
          SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name ASC
        `;
        migrationCount = migrations.length;
        latestMigration = migrations.at(-1)?.migration_name ?? null;
      } catch {
        migrationCount = 0;
        latestMigration = null;
      }

      const drivers = await tx.driverProfile.findMany({
        select: {
          status: true,
          availability: true,
          user: { select: { role: true, status: true } },
          serviceRegions: { select: { deliveryRegionId: true } },
          documents: { select: { documentType: true, status: true, expiresAt: true } },
          vehicles: {
            where: { status: "APPROVED", archivedAt: null },
            select: { id: true, documents: { select: { documentType: true, status: true, expiresAt: true } } },
          },
        },
      });
      const blockers: Record<string, number> = {};
      const profileStatuses: Record<string, number> = {};
      const availabilityStates: Record<string, number> = {};
      let readyBeforeCapacity = 0;
      for (const driver of drivers) {
        profileStatuses[driver.status] = (profileStatuses[driver.status] ?? 0) + 1;
        availabilityStates[driver.availability] = (availabilityStates[driver.availability] ?? 0) + 1;
        const compliance = evaluateDispatchComplianceEvidence({ driverDocuments: driver.documents, vehicles: driver.vehicles });
        const reasons = [...compliance.reasons];
        if (driver.status !== "ACTIVE") reasons.push("DRIVER_PROFILE_INACTIVE");
        if (driver.user.status !== "ACTIVE" || driver.user.role !== "DRIVER") reasons.push("DRIVER_USER_INACTIVE");
        if (driver.availability !== "AVAILABLE") reasons.push("DRIVER_UNAVAILABLE");
        if (!driver.serviceRegions.length) reasons.push("NO_SERVICE_REGIONS");
        if (!reasons.length) readyBeforeCapacity++;
        for (const reason of reasons) blockers[reason] = (blockers[reason] ?? 0) + 1;
      }
      driverReadiness = { profileCount: drivers.length, readyBeforeCapacity, profileStatuses, availabilityStates, blockers };

      const stores = await tx.store.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          status: true,
          defaultPickupAddress: { select: { line1: true, city: true, province: true } },
          savedAddresses: { select: { type: true, isDefault: true, line1: true, city: true, province: true } },
        },
        orderBy: { id: "asc" },
      });

      activeStoreCount = stores.length;
      storesRestricted = stores.map((store) => {
        const pickup = store.defaultPickupAddress ?? store.savedAddresses.find((address) => address.type === "PICKUP" || address.isDefault);
        const collectionAddressPresent = Boolean(pickup);
        const collectionAddressComplete = Boolean(pickup?.line1 && pickup.city && pickup.province);
        if (collectionAddressComplete) readyStoreCount += 1;
        return {
          id: store.id,
          status: store.status,
          collectionAddressPresent,
          collectionAddressComplete,
        };
      });

      const computed: Record<string, TableAuditSummary> = {};
      for (const tableName of discoveredTables) {
        computed[tableName] = await computeDeterministicBoundedTableHash(tx, tableName, tablesWithId.has(tableName));
      }
      protectedRows = computed;

      policies = await tx.legalDocumentVersion.findMany({
        select: { documentType: true, version: true, publicationStatus: true, contentHash: true, effectiveAt: true },
      });
      company = await tx.companyProfileVersion.findMany({ select: { versionNumber: true, status: true } });
      parcels = await tx.parcelProfileVersion.findMany({ select: { stableKey: true, versionNumber: true, status: true } });
      services = await tx.deliveryServiceDefinition.findMany({
        select: { stableKey: true, versionNumber: true, status: true, pricingPolicy: true },
      });
      processorRuns = await tx.operationalProcessorRun.findMany({
        select: { jobName: true, status: true, itemsCompleted: true, itemsRetried: true, startedAt: true },
        orderBy: { startedAt: "desc" },
        take: 12,
      });
      for (const name of [
        "CommissionPlan",
        "PaymentMethodPolicy",
        "StoreOrderOperationalPolicy",
        "SubscriptionPlanVersion",
        "NotificationEventRouteVersion",
        "NotificationTemplateVersion",
      ]) {
        const rows = await tx.$queryRawUnsafe<Array<{ count: number }>>(`SELECT count(*)::int AS count FROM "${name}"`);
        pendingConfigurationCounts[name] = rows[0].count;
      }
      customerNotificationConfiguration = {
        templates: await tx.notificationTemplateVersion.findMany({ select: { status: true, versionNumber: true } }),
        recipientPolicies: await tx.notificationRecipientPolicyVersion.findMany({ select: { key: true, status: true, versionNumber: true } }),
        routes: await tx.notificationEventRouteVersion.findMany({ select: { status: true, versionNumber: true, activatedAt: true } }),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60_000 },
  );

  const receiptDigest = buildAuditReceiptDigest({
    at: nowIso,
    releaseSha,
    migrationCount,
    latestMigration,
    protected: protectedRows,
  });

  return {
    schemaVersion: 2,
    event: "kt_reviewed_production_evidence",
    at: nowIso,
    readOnly: true,
    releaseSha,
    migrationCount,
    latestMigration,
    database: databaseMeta,
    driverReadiness,
    storeCollectionSummary: { activeStoreCount, readyStoreCount },
    ...(options?.includeRestrictedDetails ? { storesRestricted } : {}),
    protected: protectedRows,
    policies,
    company,
    parcels,
    services,
    processorRuns,
    pendingConfigurationCounts,
    customerNotificationConfiguration,
    receiptDigest,
  };
}

if (/(?:^|[\\/])audit-reviewed-production\.ts$/.test(process.argv[1] ?? "") && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outArgIndex = process.argv.indexOf("--out");
  const outPath = outArgIndex >= 0 ? process.argv[outArgIndex + 1] : null;
  reviewedProtectedRowAudit()
    .then((report) => {
      const safeConsole = sanitizeAuditOutputForConsole(report);
      const formatted = JSON.stringify(safeConsole, null, 2);
      if (outPath) writeFileSync(outPath, `${formatted}\n`, "utf8");
      console.log(formatted);
    })
    .catch(() => {
      console.error("Read-only production evidence failed.");
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
