/* eslint-disable @typescript-eslint/no-explicit-any */
import { assertDeveloperApiProductionReady } from "./production-readiness";
import { DeveloperWebhookProjectionService, DeveloperWebhookSourceEventService } from "./webhook-projection";
import { WebhookExecutionService, WebhookSubscriptionService } from "./services";

export const PHASE28_PROCESSOR_OPERATIONS = Object.freeze(["preflight", "expire-credentials", "expire-idempotency", "close-usage", "verify", "project", "deliver", "retry", "disable", "reconciliation", "invariants", "integration"] as const);
export type Phase28ProcessorOperation = (typeof PHASE28_PROCESSOR_OPERATIONS)[number];
export type ProcessorCandidate = Readonly<{ reference: string; kind: string; record: any }>;
const MAX_PROCESSOR_LIMIT = 1000;

export class DeveloperApiMaintenanceService {
  constructor(private readonly db: any) {}
  async expireCredential(record: any) { return this.db.developerApiCredential.update({ where: { id: record.id }, data: { status: "EXPIRED", revokedAt: record.revokedAt ?? new Date() } }); }
  async expireIdempotency(record: any) { return this.db.developerApiIdempotencyRecord.update({ where: { id: record.id }, data: { status: "EXPIRED", responseBody: null } }); }
  async closeUsage(record: any) { return this.db.developerApiAuditEvent.create({ data: { publicReference: `daudit_usage_${record.id}`, eventType: "DEVELOPER_RATE_WINDOW_CLOSED", entityReference: record.id, safeEvidence: { windowStartedAt: record.windowStartedAt.toISOString(), count: record.count } } }); }
  async disableSubscription(record: any) { return this.db.developerWebhookSubscription.update({ where: { id: record.id }, data: { status: "DISABLED", pausedAt: new Date() } }); }
  async rescan(caseRecord: any) { return this.db.developerApiReconciliationCase.update({ where: { id: caseRecord.id }, data: { status: "IN_PROGRESS", lastObservedAt: new Date() } }); }
}

/** Bounded, deterministic selectors for every deployed Phase 28 command. */
export class Phase28ProcessorService {
  constructor(private readonly db: any, private readonly maintenance: DeveloperApiMaintenanceService, private readonly subscriptions: WebhookSubscriptionService, private readonly execution: WebhookExecutionService, private readonly projections: DeveloperWebhookProjectionService, private readonly sources: DeveloperWebhookSourceEventService) {}
  async select(operation: Phase28ProcessorOperation, rawLimit: number): Promise<ProcessorCandidate[]> {
    const limit = this.limit(rawLimit); const now = new Date();
    if (operation === "preflight" || operation === "integration") return this.rows(await this.db.developerApplication.findMany({ where: { status: { in: ["ACTIVE", "APPROVED"] } }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: limit }), operation);
    if (operation === "expire-credentials") return this.rows(await this.db.developerApiCredential.findMany({ where: { status: { in: ["ACTIVE", "EXPIRING"] }, expiresAt: { lte: now } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: limit }), operation);
    if (operation === "expire-idempotency") return this.rows(await this.db.developerApiIdempotencyRecord.findMany({ where: { status: { in: ["RECORDED", "COMPLETED"] }, expiresAt: { lte: now } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: limit }), operation);
    if (operation === "close-usage") return this.rows(await this.db.developerApiRateUsage.findMany({ where: { windowStartedAt: { lte: new Date(now.getTime() - 60_000) } }, orderBy: [{ windowStartedAt: "asc" }, { id: "asc" }], take: limit }), operation);
    if (operation === "verify") return this.rows(await this.db.developerWebhookVerification.findMany({ where: { status: "PENDING", expiresAt: { gt: now }, attempts: { lt: 5 } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit }), operation);
    if (operation === "project") return (await this.sources.select(limit)).map((record) => ({ reference: `${record.authority}:${record.reference}`, kind: operation, record }));
    if (operation === "deliver") return this.rows(await this.db.developerWebhookDelivery.findMany({ where: { status: "PENDING", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit }), operation);
    if (operation === "retry") return this.rows(await this.db.developerWebhookDelivery.findMany({ where: { status: "FAILED_RETRYABLE", nextAttemptAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }], take: limit }), operation);
    if (operation === "disable") return this.rows(await this.db.developerWebhookDelivery.findMany({ where: { status: "ENDPOINT_DISABLED" }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: limit }), operation);
    if (operation === "reconciliation") return this.rows(await this.db.developerApiReconciliationCase.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: [{ openedAt: "asc" }, { id: "asc" }], take: limit }), operation);
    return this.rows(await this.db.developerWebhookDelivery.findMany({ where: { status: "SENDING" }, orderBy: [{ lastAttemptedAt: "asc" }, { id: "asc" }], take: limit }), operation);
  }
  async apply(operation: Phase28ProcessorOperation, candidate: ProcessorCandidate): Promise<unknown> {
    assertDeveloperApiProductionReady();
    if (operation === "expire-credentials") return this.maintenance.expireCredential(candidate.record);
    if (operation === "expire-idempotency") return this.maintenance.expireIdempotency(candidate.record);
    if (operation === "close-usage") return this.maintenance.closeUsage(candidate.record);
    if (operation === "project") return this.projections.project(candidate.record);
    if (operation === "verify") { const subscription = await this.db.developerWebhookSubscription.findUniqueOrThrow({ where: { id: candidate.record.subscriptionId } }); return this.execution.verify(candidate.record, subscription); }
    if (operation === "deliver" || operation === "retry") { const event = await this.db.developerWebhookPublicEvent.findUniqueOrThrow({ where: { id: candidate.record.publicEventId } }); const subscription = await this.db.developerWebhookSubscription.findUniqueOrThrow({ where: { id: candidate.record.subscriptionId } }); return this.execution.deliver(candidate.record, event, subscription); }
    if (operation === "disable") { const subscription = await this.db.developerWebhookSubscription.findUniqueOrThrow({ where: { id: candidate.record.subscriptionId } }); return this.maintenance.disableSubscription(subscription); }
    if (operation === "reconciliation") return this.maintenance.rescan(candidate.record);
    return Object.freeze({ operation, operationId: `phase28:${operation}:${candidate.reference}` });
  }
  private rows(rows: any[], kind: string): ProcessorCandidate[] { return rows.map((record) => ({ reference: record.publicReference ?? record.id, kind, record })); }
  private limit(value: number) { if (!Number.isInteger(value) || value < 1 || value > MAX_PROCESSOR_LIMIT) throw new Error("Processor limit must be an integer between 1 and 1000."); return value; }
}
