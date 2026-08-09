import { domainAdapters } from "./adapters/domain-adapters";
import type {
  NormalizedCaseDetail,
  NormalizedReconciliationCase,
  ReconciliationDomain,
  RecoveryExecutionParams,
  RecoveryExecutionResult,
  UnifiedReconciliationQuery,
} from "./types";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { safeOperationalText } from "@/lib/operations/phase5-repository";
import crypto from "node:crypto";

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

  // Retrieve cases from authorized adapters
  const perDomainLimit = Math.max(5, Math.floor((query.limit ?? 50) / authorizedDomains.length));
  const results = await Promise.all(
    authorizedDomains.map((d) =>
      domainAdapters[d].listCases({ ...query, limit: perDomainLimit }).catch(() => [] as NormalizedReconciliationCase[]),
    ),
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
    throw new Error("Unauthorized to view reconciliation cases in this domain.");
  }
  return adapter.getCase(reference);
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
    throw new Error(`Unauthorized to execute recovery action '${params.actionKey}' in domain '${params.domain}'.`);
  }

  // Execute recovery via canonical domain adapter
  const result = await adapter.executeRecovery({
    ...params,
    actorUserId,
  });

  // Record audit evidence
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
    throw new Error(`Unauthorized for bulk recovery action '${actionKey}'.`);
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
