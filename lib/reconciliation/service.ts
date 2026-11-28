import { domainAdapters } from "./adapters/domain-adapters";
import type {
  NormalizedCaseDetail,
  NormalizedReconciliationCase,
  PermittedRecoveryAction,
  ReconciliationDomain,
  ReconciliationSourceAdapter,
  RecoveryExecutionParams,
  RecoveryExecutionResult,
  UnifiedReconciliationQuery,
} from "./types";
import { getEffectivePermissionKeysForUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { safeOperationalText } from "@/lib/operations/phase5-repository";
import type { UserRole } from "@/types/db";
import crypto from "node:crypto";
import {
  ReconciliationAuthorizationError,
  ReconciliationConflictError,
} from "./errors";

export { ReconciliationAuthorizationError, ReconciliationConflictError };

export async function resolveActorReconciliationPermissions(actor: {
  userId: string;
  role: UserRole;
}): Promise<Set<string>> {
  const keys = await getEffectivePermissionKeysForUser({
    userId: actor.userId,
    role: actor.role,
  });
  return new Set(keys);
}

/**
 * Projects backend recovery actions against the actor's canonical permission set
 * so unauthorized actions are explicitly flagged and cannot appear executable.
 */
export function projectPermittedActionsForActor(
  adapter: Pick<ReconciliationSourceAdapter, "requiredRecoveryPermissions" | "requiredViewPermission">,
  actions: readonly PermittedRecoveryAction[],
  actorPermissionKeys: Set<string>,
): PermittedRecoveryAction[] {
  return actions.map((action) => {
    const requiredPermission =
      adapter.requiredRecoveryPermissions[action.actionKey] ??
      action.requiredPermission ??
      adapter.requiredViewPermission;
    const authorized = actorPermissionKeys.has(requiredPermission);

    if (!authorized) {
      const baseBlocker = action.readinessBlocker ? `; ${action.readinessBlocker}` : "";
      return {
        ...action,
        requiredPermission,
        authorized: false,
        availabilityStatus: "UNAVAILABLE_PERMISSION",
        readinessState: "BLOCKED",
        readinessBlocker: `Unavailable: missing required permission '${requiredPermission}'${baseBlocker}`,
      };
    }

    if (action.readinessState === "BLOCKED") {
      return {
        ...action,
        requiredPermission,
        authorized: true,
        availabilityStatus: "BLOCKED",
      };
    }

    return {
      ...action,
      requiredPermission,
      authorized: true,
      availabilityStatus: "EXECUTABLE",
      readinessState: "READY",
    };
  });
}

async function findReplayedRecoveryResult(params: {
  domain: ReconciliationDomain;
  reference: string;
  actionKey: string;
  operationId: string;
}): Promise<RecoveryExecutionResult | null> {
  const delegate = (
    prisma as unknown as {
      adminActivityLog?: { findMany?: (args: Record<string, unknown>) => Promise<Array<{ metadata: unknown; createdAt: Date }>> };
    } | undefined
  )?.adminActivityLog;
  if (typeof delegate?.findMany !== "function") {
    return null;
  }

  const recentLogs = await Promise.resolve(
    delegate.findMany({
      where: {
        entityType: "ReconciliationCase",
        action: "STATUS_CHANGE",
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { metadata: true, createdAt: true },
    }),
  ).catch(() => []);

  for (const row of recentLogs) {
    const meta = (row.metadata ?? null) as {
      operationId?: unknown;
      domain?: unknown;
      reference?: unknown;
      actionKey?: unknown;
      success?: unknown;
      updatedStatus?: unknown;
      safeOutcome?: unknown;
      recoveryResult?: RecoveryExecutionResult;
    } | null;
    if (!meta || meta.operationId !== params.operationId) continue;

    if (
      meta.domain !== params.domain ||
      meta.reference !== params.reference ||
      meta.actionKey !== params.actionKey
    ) {
      throw new ReconciliationConflictError(
        `Operation ID '${params.operationId}' has already been used for a different reconciliation recovery target or action.`,
      );
    }

    if (meta.recoveryResult && typeof meta.recoveryResult === "object") {
      return {
        ...meta.recoveryResult,
        idempotentReplay: true,
      };
    }

    return {
      success: Boolean(meta.success),
      operationId: params.operationId,
      domain: params.domain,
      reference: params.reference,
      actionKey: params.actionKey,
      executedAt: row.createdAt.toISOString(),
      safeOutcome:
        typeof meta.safeOutcome === "string"
          ? meta.safeOutcome
          : safeOperationalText(`Idempotent replay of action '${params.actionKey}' for ${params.domain} case ${params.reference}.`),
      updatedStatus:
        meta.updatedStatus === "CONVERGED" ||
        meta.updatedStatus === "RESOLVED" ||
        meta.updatedStatus === "FAILED" ||
        meta.updatedStatus === "IN_PROGRESS" ||
        meta.updatedStatus === "OPEN"
          ? meta.updatedStatus
          : meta.updatedStatus === "MONITORING"
            ? "IN_PROGRESS"
            : meta.success
              ? "CONVERGED"
              : "OPEN",
      idempotentReplay: true,
    };
  }

  return null;
}

export async function listUnifiedReconciliationCases(
  actorPermissionKeys: Set<string>,
  query: UnifiedReconciliationQuery,
): Promise<{ cases: NormalizedReconciliationCase[]; totalReturned: number; hasMore: boolean; nextCursor?: string }> {
  const targetDomains: ReconciliationDomain[] = query.domain
    ? [query.domain]
    : (Object.keys(domainAdapters) as ReconciliationDomain[]);

  // Filter adapters by actor's view permission
  const authorizedDomains = targetDomains.filter((domainKey) => {
    const adapter = domainAdapters[domainKey];
    return adapter && actorPermissionKeys.has(adapter.requiredViewPermission);
  });

  if (authorizedDomains.length === 0) {
    return { cases: [], totalReturned: 0, hasMore: false };
  }

  // Retrieve cases from authorized adapters and project recovery actions with actor permissions
  const perDomainLimit = Math.max(5, Math.floor((query.limit ?? 50) / authorizedDomains.length));
  const results = await Promise.all(
    authorizedDomains.map(async (d) => {
      const adapter = domainAdapters[d];
      const cases = await adapter
        .listCases({ ...query, limit: perDomainLimit })
        .catch(() => [] as NormalizedReconciliationCase[]);
      return cases.map((item) => ({
        ...item,
        permittedActions: projectPermittedActionsForActor(adapter, item.permittedActions, actorPermissionKeys),
      }));
    }),
  );

  let mergedCases = results.flat();

  // Apply filters
  if (query.severity) {
    mergedCases = mergedCases.filter((c) => c.severity === query.severity);
  }
  if (query.status) {
    mergedCases = mergedCases.filter((c) => c.canonicalStatus === query.status);
  }
  if (query.isBlocking !== undefined) {
    mergedCases = mergedCases.filter((c) => c.isBlocking === query.isBlocking);
  }
  if (query.searchReference) {
    const search = query.searchReference.toLowerCase();
    mergedCases = mergedCases.filter(
      (c) =>
        c.publicReference.toLowerCase().includes(search) ||
        c.relatedResourceReference.toLowerCase().includes(search) ||
        c.safeSummary.toLowerCase().includes(search),
    );
  }

  // Deterministic stable sorting: createdAt desc, domain asc, reference asc
  mergedCases.sort((a, b) => {
    const timeCompare = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (timeCompare !== 0) return timeCompare;
    const domainCompare = a.domain.localeCompare(b.domain);
    if (domainCompare !== 0) return domainCompare;
    return a.publicReference.localeCompare(b.publicReference);
  });

  const limit = Math.min(query.limit ?? 50, 100);
  const paginated = mergedCases.slice(0, limit);
  const hasMore = mergedCases.length > limit;
  const nextCursor = hasMore ? Buffer.from(paginated[paginated.length - 1].publicReference).toString("base64") : undefined;

  return {
    cases: paginated,
    totalReturned: paginated.length,
    hasMore,
    nextCursor,
  };
}

export async function getUnifiedReconciliationCase(
  actorPermissionKeys: Set<string>,
  domain: ReconciliationDomain,
  reference: string,
): Promise<NormalizedCaseDetail | null> {
  const adapter = domainAdapters[domain];
  if (!adapter) throw new Error(`Unknown reconciliation domain: ${domain}`);
  if (!actorPermissionKeys.has(adapter.requiredViewPermission)) {
    throw new ReconciliationAuthorizationError(
      "Unauthorized to view reconciliation cases in this domain.",
      adapter.requiredViewPermission,
    );
  }
  const detail = await adapter.getCase(reference);
  if (!detail) return null;
  return {
    ...detail,
    permittedActions: projectPermittedActionsForActor(adapter, detail.permittedActions, actorPermissionKeys),
  };
}

export async function executeUnifiedRecoveryCommand(
  actorUserId: string,
  actorPermissionKeys: Set<string>,
  params: RecoveryExecutionParams,
): Promise<RecoveryExecutionResult> {
  const adapter = domainAdapters[params.domain];
  if (!adapter) throw new Error(`Unknown reconciliation domain: ${params.domain}`);

  // Required permission for recovery action
  const requiredPermission = adapter.requiredRecoveryPermissions[params.actionKey] ?? adapter.requiredViewPermission;
  if (!actorPermissionKeys.has(requiredPermission)) {
    throw new ReconciliationAuthorizationError(
      `Unauthorized to execute recovery action '${params.actionKey}' in domain '${params.domain}'.`,
      requiredPermission,
    );
  }

  const replayed = await findReplayedRecoveryResult({
    domain: params.domain,
    reference: params.reference,
    actionKey: params.actionKey,
    operationId: params.operationId,
  });
  if (replayed) {
    return replayed;
  }

  // Execute recovery via canonical domain adapter
  const result = await adapter.executeRecovery({
    ...params,
    actorUserId,
  });

  // Record audit evidence with replay metadata
  await recordAdminActivity({
    actorUserId,
    action: "STATUS_CHANGE",
    entityType: "ReconciliationCase",
    entityId: `${params.domain}:${params.reference}`,
    message: `Executed recovery action '${params.actionKey}' for ${params.domain} case ${params.reference}`,
    metadata: {
      operationId: params.operationId,
      domain: params.domain,
      reference: params.reference,
      actionKey: params.actionKey,
      reasonCode: params.reasonCode,
      success: result.success,
      updatedStatus: result.updatedStatus,
      safeOutcome: result.safeOutcome,
      recoveryResult: result,
    },
  });

  return result;
}

export async function executeUnifiedBulkRecovery(
  actorUserId: string,
  actorPermissionKeys: Set<string>,
  domain: ReconciliationDomain,
  caseType: string,
  actionKey: string,
  references: string[],
  operationIdPrefix: string,
): Promise<{ batchSize: number; successCount: number; failureCount: number; results: RecoveryExecutionResult[] }> {
  if (references.length > 50) {
    throw new Error("Bulk recovery exceeds maximum permitted batch size of 50.");
  }

  const adapter = domainAdapters[domain];
  if (!adapter) throw new Error(`Unknown reconciliation domain: ${domain}`);
  const requiredPermission = adapter.requiredRecoveryPermissions[actionKey];
  if (requiredPermission && !actorPermissionKeys.has(requiredPermission)) {
    throw new ReconciliationAuthorizationError(
      `Unauthorized for bulk recovery action '${actionKey}'.`,
      requiredPermission,
    );
  }

  const results: RecoveryExecutionResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const ref of references) {
    const opId = `${operationIdPrefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    try {
      const res = await adapter.executeRecovery({
        domain,
        reference: ref,
        actionKey,
        actorUserId,
        operationId: opId,
        reasonCode: "BULK_RECOVERY_EXECUTION",
      });
      results.push(res);
      if (res.success) successCount++;
      else failureCount++;
    } catch (err) {
      failureCount++;
      results.push({
        success: false,
        operationId: opId,
        domain,
        reference: ref,
        actionKey,
        executedAt: new Date().toISOString(),
        safeOutcome: safeOperationalText(err instanceof Error ? err.message : "Bulk item recovery failed"),
        updatedStatus: "FAILED",
      });
    }
  }

  return { batchSize: references.length, successCount, failureCount, results };
}
