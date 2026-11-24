import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/db/prisma";
import { evaluateDispatchComplianceEvidence } from "../lib/services/vehicle-compliance.service";
import {
  AUDIT_RECEIPT_SCHEMA_VERSION,
  REQUIRED_PROTECTED_AUDIT_TABLES,
  computeAuditReceiptDigest,
  computeProtectedSnapshotDigest,
  evaluateAuditComparison,
  hashAuditHost,
  verifyAuditReceipt,
} from "../services/release-authority/src/audit-receipt.mjs";

export { REQUIRED_PROTECTED_AUDIT_TABLES };

const VOLATILE_OR_EXCLUDED_TABLES = new Set(["_prisma_migrations", "Session", "VerificationToken"]);
const AUDIT_CHUNK_SIZE = 500;
const TABLE_IDENT_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
  schemaCreatePrivilege?: boolean;
  missingRequiredTables?: readonly string[];
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
  if (input.schemaCreatePrivilege) {
    findings.push(`Role '${input.role}' holds CREATE privilege on schema public.`);
  }
  if (input.writableTables.length > 0) {
    findings.push(
      `Role '${input.role}' holds DML/TRUNCATE privileges on ${input.writableTables.length} audited table(s): ${input.writableTables.slice(0, 6).join(", ")}${input.writableTables.length > 6 ? "..." : ""}.`,
    );
  }
  if (input.missingRequiredTables && input.missingRequiredTables.length > 0) {
    findings.push(
      `Audited inventory is incomplete; missing ${input.missingRequiredTables.length} required table(s): ${input.missingRequiredTables.slice(0, 6).join(", ")}${input.missingRequiredTables.length > 6 ? "..." : ""}.`,
    );
  }
  return Object.freeze({
    leastPrivilegeVerified: findings.length === 0,
    findings: Object.freeze(findings),
  });
}

export function resolveDiscoverableProtectedTables(discoveredPublicTables: readonly string[]): string[] {
  const discoveredSet = new Set(discoveredPublicTables.filter((name) => TABLE_IDENT_REGEX.test(name)));
  const selected = new Set<string>();
  for (const required of REQUIRED_PROTECTED_AUDIT_TABLES) {
    if (discoveredSet.has(required)) {
      selected.add(required);
    }
  }
  for (const table of discoveredSet) {
    if (VOLATILE_OR_EXCLUDED_TABLES.has(table)) continue;
    if (
      /^(User|Store|Address|Order|Payment|Marketplace|Cash|Driver|PrivateMedia|StoreEarning|DriverEarning|Withdrawal|Commission|Ledger|Wallet|Catalog|Storefront|Retention|Legal|CompanyProfile|Delivery|Notification|Paystack|OperationalProcessorRun|SystemSetting)/.test(
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
  const evaluation = evaluateAuditComparison(before?.protected ?? null, after.protected);
  return Object.freeze({
    unchanged: evaluation.unchanged,
    changedTables: Object.freeze([...evaluation.changedTables]),
    addedTables: Object.freeze([...evaluation.addedTables]),
    removedTables: Object.freeze([...evaluation.removedTables]),
    commerceActivityDetected: evaluation.commerceActivityDetected,
    limitations: Object.freeze([...evaluation.limitations]),
  });
}

type SqlQueryFn = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

async function computeDeterministicBoundedTableHashWithQuery(
  query: SqlQueryFn,
  tableName: string,
  hasIdColumn: boolean,
): Promise<TableAuditSummary> {
  const quotedTable = `"public"."${tableName.replace(/"/g, "\"\"")}"`;
  const [{ count }] = await query<{ count: number }>(`SELECT count(*)::int AS count FROM ${quotedTable}`);
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
          ? await query<{ id: string; row_json: string }>(
              `SELECT "id"::text AS id, to_jsonb(t)::text AS row_json FROM ${quotedTable} t ORDER BY "id" ASC LIMIT $1`,
              [AUDIT_CHUNK_SIZE],
            )
          : await query<{ id: string; row_json: string }>(
              `SELECT "id"::text AS id, to_jsonb(t)::text AS row_json FROM ${quotedTable} t WHERE "id"::text > $1 ORDER BY "id" ASC LIMIT $2`,
              [lastId, AUDIT_CHUNK_SIZE],
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
      const batch: Array<{ row_json: string }> = await query<{ row_json: string }>(
        `SELECT to_jsonb(t)::text AS row_json FROM ${quotedTable} t ORDER BY to_jsonb(t)::text ASC LIMIT $1 OFFSET $2`,
        [AUDIT_CHUNK_SIZE, offset],
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

export type ReadOnlySqlExecutor = Readonly<{
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}>;

export type ProtectedAuditReceipt = ReturnType<typeof verifyAuditReceipt>;

async function runCoreReadOnlyIntrospection(
  query: SqlQueryFn,
  options?: { asRole?: string },
) {
  await query("SET TRANSACTION READ ONLY");
  await query("SET LOCAL statement_timeout = '5000ms'");
  if (options?.asRole) {
    if (!TABLE_IDENT_REGEX.test(options.asRole)) {
      throw new Error("Invalid PostgreSQL audit role identifier.");
    }
    await query(`SET LOCAL ROLE "${options.asRole}"`);
  }

  const identity = await query<{
    database: string;
    role: string;
    transactionReadOnly: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
    schemaCreatePrivilege: boolean;
  }>(
    `SELECT
       current_database() AS database,
       current_user AS role,
       current_setting('transaction_read_only') AS "transactionReadOnly",
       COALESCE(r.rolsuper, false) AS rolsuper,
       COALESCE(r.rolbypassrls, false) AS rolbypassrls,
       has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreatePrivilege"
     FROM pg_roles r
     WHERE r.rolname = current_user`,
  );
  const dbIdentity = identity[0];

  const tableRows = await query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name ASC`,
  );
  const discoveredTables = resolveDiscoverableProtectedTables(tableRows.map((r) => r.table_name));
  const discoveredSet = new Set(discoveredTables);
  const missingRequiredTables = REQUIRED_PROTECTED_AUDIT_TABLES.filter((table) => !discoveredSet.has(table));

  const idColRows = await query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'id'`,
  );
  const tablesWithId = new Set(idColRows.map((r) => r.table_name));

  const writableTableRows = await query<{ table_name: string }>(
    `SELECT c.relname AS table_name
     FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE CASE
       WHEN n.nspname = 'public' AND c.relkind IN ('r', 'p') THEN (
         has_table_privilege(current_user, c.oid, 'INSERT')
         OR has_table_privilege(current_user, c.oid, 'UPDATE')
         OR has_table_privilege(current_user, c.oid, 'DELETE')
         OR has_table_privilege(current_user, c.oid, 'TRUNCATE')
       )
       ELSE false
     END
     ORDER BY c.relname ASC`,
  );
  const writableAuditTables = writableTableRows
    .map((r) => r.table_name)
    .filter((t) => discoveredSet.has(t));

  const privilegeEval = evaluatePostgreSqlLeastPrivilege({
    role: dbIdentity?.role ?? "unknown",
    transactionReadOnly: dbIdentity?.transactionReadOnly ?? "off",
    rolsuper: Boolean(dbIdentity?.rolsuper),
    rolbypassrls: Boolean(dbIdentity?.rolbypassrls),
    writableTables: writableAuditTables,
    schemaCreatePrivilege: Boolean(dbIdentity?.schemaCreatePrivilege),
    missingRequiredTables,
  });

  let migrationCount = 0;
  let latestMigration: string | null = null;
  try {
    const migrations = await query<{ migration_name: string }>(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name ASC`,
    );
    migrationCount = migrations.length;
    latestMigration = migrations.at(-1)?.migration_name ?? null;
  } catch {
    migrationCount = 0;
    latestMigration = null;
  }

  const protectedRows: Record<string, TableAuditSummary> = {};
  for (const tableName of discoveredTables) {
    protectedRows[tableName] = await computeDeterministicBoundedTableHashWithQuery(
      query,
      tableName,
      tablesWithId.has(tableName),
    );
  }

  return {
    databaseMeta: {
      database: dbIdentity?.database ?? "unknown",
      role: dbIdentity?.role ?? "unknown",
      transactionReadOnly: dbIdentity?.transactionReadOnly === "on" ? ("on" as const) : ("off" as const),
      rolsuper: Boolean(dbIdentity?.rolsuper),
      rolbypassrls: Boolean(dbIdentity?.rolbypassrls),
      writableTables: writableAuditTables,
      schemaCreatePrivilege: Boolean(dbIdentity?.schemaCreatePrivilege),
      leastPrivilegeVerified: privilegeEval.leastPrivilegeVerified,
      privilegeFindings: [...privilegeEval.findings],
    },
    inventory: {
      requiredTablesCount: REQUIRED_PROTECTED_AUDIT_TABLES.length,
      auditedTablesCount: Object.keys(protectedRows).length,
      missingRequiredTables,
      inventoryComplete: missingRequiredTables.length === 0,
      migrationCount,
      latestMigration,
    },
    protectedRows,
  };
}

/**
 * Legacy-compatible read-only production audit helper. Uses explicit readOnlyDatabaseUrl
 * if supplied; otherwise falls back to application prisma ONLY for direct closure diagnostics
 * and local tests (never treated as standalone parity certification provenance).
 */
export async function reviewedProtectedRowAudit(options?: {
  includeRestrictedDetails?: boolean;
  env?: Record<string, string | undefined>;
  readOnlyDatabaseUrl?: string;
}) {
  const env = options?.env ?? process.env;
  const nowIso = new Date().toISOString();
  const releaseSha = (env.RAILWAY_GIT_COMMIT_SHA ?? env.VERCEL_GIT_COMMIT_SHA ?? "").trim() || null;

  const customUrl = options?.readOnlyDatabaseUrl?.trim();
  const dbClient = customUrl ? new PrismaClient({ datasourceUrl: customUrl }) : prisma;

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

  try {
    await dbClient.$transaction(
      async (tx) => {
        const core = await runCoreReadOnlyIntrospection(
          <T>(sql: string, params: unknown[] = []) => tx.$queryRawUnsafe<T[]>(sql, ...params),
        );
        databaseMeta = {
          database: core.databaseMeta.database,
          role: core.databaseMeta.role,
          transactionReadOnly: core.databaseMeta.transactionReadOnly,
          leastPrivilegeVerified: core.databaseMeta.leastPrivilegeVerified,
          privilegeFindings: core.databaseMeta.privilegeFindings,
        };
        migrationCount = core.inventory.migrationCount;
        latestMigration = core.inventory.latestMigration;
        protectedRows = core.protectedRows;

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
  } finally {
    if (customUrl) {
      await dbClient.$disconnect();
    }
  }

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

/**
 * Authoritative release-parity audit capture. Must receive EITHER a dedicated read-only
 * PostgreSQL URL (KT_AUDIT_READONLY_DATABASE_URL, strictly separate from writable DATABASE_URL)
 * OR an injected test SQL executor. Never falls back to app writable DATABASE_URL.
 */
export async function captureProtectedRowAuditReceipt(options: {
  releaseSha: string;
  receiptReference?: string;
  readOnlyDatabaseUrl?: string;
  executor?: ReadOnlySqlExecutor;
  asRole?: string;
  env?: Record<string, string | undefined>;
  classification?: "production" | "isolated_test";
  baselineReceipt?: ProtectedAuditReceipt | null;
  deployments: {
    vercelDeploymentId: string;
    webDeploymentId: string;
    operationsDeploymentId: string;
    queryDeploymentId: string;
  };
  auditorPrincipal: string;
  reviewerPrincipal?: string | null;
  documentedOperationalChanges?: readonly string[];
  documentedChangeReference?: string | null;
  documentedChangeReason?: string | null;
  ttlMinutes?: number;
  now?: Date;
}) {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  if (!/^[a-f0-9]{40}$/.test(options.releaseSha)) {
    throw new Error("AUDIT_RECEIPT_INVALID: 40-character releaseSha is required.");
  }

  let verifiedBaseline: ProtectedAuditReceipt | null = null;
  if (options.baselineReceipt) {
    verifiedBaseline = verifyAuditReceipt(options.baselineReceipt, {
      requireParityEligibility: false,
      enforceFreshness: false,
    });
  }

  let hostDigest = hashAuditHost("injected-executor");
  let core: Awaited<ReturnType<typeof runCoreReadOnlyIntrospection>>;

  if (options.executor) {
    const exec = options.executor;
    await exec.query("BEGIN");
    try {
      core = await runCoreReadOnlyIntrospection(
        async <T>(sql: string, params: unknown[] = []) => (await exec.query(sql, params)).rows as T[],
        { asRole: options.asRole },
      );
      await exec.query("COMMIT");
    } catch (error) {
      await exec.query("ROLLBACK").catch(() => {});
      throw error;
    }
  } else {
    const roUrl = (options.readOnlyDatabaseUrl ?? env.KT_AUDIT_READONLY_DATABASE_URL ?? "").trim();
    const appUrl = (env.DATABASE_URL ?? "").trim();
    if (!roUrl) {
      throw new Error("AUDIT_READONLY_URL_REQUIRED: Separate KT_AUDIT_READONLY_DATABASE_URL is required; refusing application DATABASE_URL.");
    }
    if (appUrl && roUrl === appUrl) {
      throw new Error("AUDIT_SEPARATE_CREDENTIAL_REQUIRED: Audit connection URL must be strictly distinct from application writable DATABASE_URL.");
    }
    let parsedHost = "unknown";
    try {
      parsedHost = new URL(roUrl).host;
    } catch {
      throw new Error("AUDIT_READONLY_URL_INVALID: Malformed read-only audit database URL.");
    }
    hostDigest = hashAuditHost(parsedHost);

    const roPrisma = new PrismaClient({ datasourceUrl: roUrl });
    try {
      core = await roPrisma.$transaction(
        async (tx) =>
          runCoreReadOnlyIntrospection(
            <T>(sql: string, params: unknown[] = []) => tx.$queryRawUnsafe<T[]>(sql, ...params),
            { asRole: options.asRole },
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60_000 },
      );
    } finally {
      await roPrisma.$disconnect();
    }
  }

  const resolvedClassification: "production" | "isolated_test" =
    options.classification ??
    (env.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase() === "production" ? "production" : "isolated_test");

  const observedAt = now.toISOString();
  const ttlMinutes = Math.max(5, Math.min(24 * 60, options.ttlMinutes ?? 180));
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000).toISOString();
  const receiptReference =
    options.receiptReference?.trim() ||
    `audit-${options.releaseSha.slice(0, 8)}-${observedAt.replace(/[-:T.Z]/g, "").slice(0, 14)}`;

  const baselineProtected = verifiedBaseline ? verifiedBaseline.snapshots.candidateProtected : null;
  const documentedChangesAuthorized = Boolean(
    options.documentedChangeReference &&
      options.documentedChangeReason &&
      options.reviewerPrincipal &&
      options.reviewerPrincipal !== options.auditorPrincipal,
  );
  const comparison = evaluateAuditComparison(baselineProtected, core.protectedRows, {
    documentedOperationalChanges: options.documentedOperationalChanges ?? [],
    documentedChangeReference: options.documentedChangeReference ?? null,
    documentedChangeReason: options.documentedChangeReason ?? null,
    documentedChangesAuthorized,
  });

  const body = {
    schemaVersion: AUDIT_RECEIPT_SCHEMA_VERSION,
    receiptReference,
    releaseSha: options.releaseSha,
    baselineReference: verifiedBaseline ? verifiedBaseline.receiptReference : null,
    baselineSha: verifiedBaseline ? verifiedBaseline.releaseSha : null,
    baselineAt: verifiedBaseline ? verifiedBaseline.observedAt : null,
    observedAt,
    expiresAt,
    window: {
      captureMode: verifiedBaseline ? ("BEFORE_AND_AFTER_COMPARISON" as const) : ("BASELINE_CAPTURE_ONLY" as const),
      windowStart: verifiedBaseline ? verifiedBaseline.observedAt : observedAt,
      windowEnd: observedAt,
    },
    deployments: {
      vercelDeploymentId: options.deployments.vercelDeploymentId,
      webDeploymentId: options.deployments.webDeploymentId,
      operationsDeploymentId: options.deployments.operationsDeploymentId,
      queryDeploymentId: options.deployments.queryDeploymentId,
    },
    databaseIdentity: {
      database: core.databaseMeta.database,
      role: core.databaseMeta.role,
      classification: resolvedClassification,
      hostDigest,
      transactionReadOnly: core.databaseMeta.transactionReadOnly,
      rolsuper: core.databaseMeta.rolsuper,
      rolbypassrls: core.databaseMeta.rolbypassrls,
      writableTables: core.databaseMeta.writableTables,
      leastPrivilegeVerified: core.databaseMeta.leastPrivilegeVerified,
      privilegeFindings: core.databaseMeta.privilegeFindings,
    },
    inventory: {
      requiredTablesCount: core.inventory.requiredTablesCount,
      auditedTablesCount: core.inventory.auditedTablesCount,
      missingRequiredTables: core.inventory.missingRequiredTables,
      inventoryComplete: core.inventory.inventoryComplete,
      migrationCount: core.inventory.migrationCount,
      latestMigration: core.inventory.latestMigration,
    },
    snapshots: {
      baselineDigest: verifiedBaseline ? verifiedBaseline.snapshots.candidateDigest : null,
      candidateDigest: computeProtectedSnapshotDigest(core.protectedRows),
      baselineProtected,
      candidateProtected: core.protectedRows,
    },
    comparison,
    provenance: {
      auditorPrincipal: options.auditorPrincipal,
      reviewerPrincipal: options.reviewerPrincipal ?? null,
      captureSource: "DEDICATED_READONLY_CLI" as const,
    },
  };

  return {
    ...body,
    receiptDigest: computeAuditReceiptDigest(body),
  };
}

function readCliFlag(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

if (/(?:^|[\\/])audit-reviewed-production\.ts$/.test(process.argv[1] ?? "") && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const captureMode = process.argv.includes("--capture-receipt");
  const outPath = readCliFlag("--out");

  if (captureMode) {
    const releaseSha = readCliFlag("--release-sha") ?? (process.env.RELEASE_SHA ?? "").trim();
    const baselinePath = readCliFlag("--baseline");
    const baselineReceipt = baselinePath
      ? (JSON.parse(readFileSync(baselinePath, "utf8")) as ProtectedAuditReceipt)
      : null;
    const roUrlEnvName = readCliFlag("--readonly-url-env") ?? "KT_AUDIT_READONLY_DATABASE_URL";
    const documentedRaw = readCliFlag("--documented-changes");

    captureProtectedRowAuditReceipt({
      releaseSha,
      receiptReference: readCliFlag("--ref"),
      readOnlyDatabaseUrl: (process.env[roUrlEnvName] ?? "").trim(),
      baselineReceipt,
      classification: (readCliFlag("--classification") as "production" | "isolated_test" | undefined) ?? undefined,
      deployments: {
        vercelDeploymentId: readCliFlag("--vercel-id") ?? "",
        webDeploymentId: readCliFlag("--web-id") ?? "",
        operationsDeploymentId: readCliFlag("--operations-id") ?? "",
        queryDeploymentId: readCliFlag("--query-id") ?? "",
      },
      auditorPrincipal: readCliFlag("--auditor") ?? "ops-auditor",
      reviewerPrincipal: readCliFlag("--reviewer") ?? null,
      documentedOperationalChanges: documentedRaw ? documentedRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      documentedChangeReference: readCliFlag("--documented-ref") ?? null,
      documentedChangeReason: readCliFlag("--documented-reason") ?? null,
    })
      .then((receipt) => {
        if (outPath) {
          writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
        }
        console.log(
          JSON.stringify({
            receiptReference: receipt.receiptReference,
            receiptDigest: receipt.receiptDigest,
            releaseSha: receipt.releaseSha,
            captureMode: receipt.window.captureMode,
            leastPrivilegeVerified: receipt.databaseIdentity.leastPrivilegeVerified,
            inventoryComplete: receipt.inventory.inventoryComplete,
            baselinePresent: receipt.comparison.baselinePresent,
            unchanged: receipt.comparison.unchanged,
            eligibleForParity: receipt.comparison.eligibleForParity,
            changedTables: receipt.comparison.changedTables,
          }),
        );
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : "Read-only audit receipt capture failed.");
        process.exitCode = 1;
      });
  } else {
    reviewedProtectedRowAudit()
      .then((report) => {
        const safeConsole = sanitizeAuditOutputForConsole(report);
        const formatted = JSON.stringify(safeConsole, null, 2);
        if (outPath) writeFileSync(outPath, `${formatted}\n`, "utf8");
        console.log(JSON.stringify(safeConsole));
      })
      .catch(() => {
        console.error("Read-only production evidence failed.");
        process.exitCode = 1;
      })
      .finally(() => prisma.$disconnect());
  }
}
