/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeveloperApiError, WEBHOOK_EVENT_CATALOG } from "./contracts";
import { opaqueReference, sha256 } from "./crypto";

type SourceAuthority = "order-status-history" | "store-order-intent" | "order-assignment-event" | "order-operational-event" | "payment-status-history" | "refund-status-history" | "subscription-event-intent";
type SourceCandidate = Readonly<{ authority: SourceAuthority; reference: string }>;
type Projection = Readonly<{ sourceAuthority: string; sourceEventReference: string; eventType: keyof typeof WEBHOOK_EVENT_CATALOG; subjectReference: string; ownerUserId: string; storeId: string | null; occurredAt: Date; payload: Record<string, unknown> }>;
const EVENT_EXPIRY_MS = 7 * 24 * 60 * 60_000;

function scopes(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function eventForOrderStatus(status: string): keyof typeof WEBHOOK_EVENT_CATALOG { if (status === "CANCELLED") return "za.co.ktcouriers.order.cancelled.v1"; if (status === "PENDING") return "za.co.ktcouriers.order.created.v1"; return "za.co.ktcouriers.order.updated.v1"; }
function reconciliationKey(reason: string, source: string): string { return `${reason}:${source}`.slice(0, 500); }

/**
 * Canonical source-event adapter. It deliberately accepts only durable source
 * records that the application already writes; it never forwards raw outbox or
 * Prisma payloads to a public subscriber.
 */
export class DeveloperWebhookSourceEventService {
  constructor(private readonly db: any) {}

  async select(limit: number): Promise<SourceCandidate[]> {
    const bounded = Math.max(1, Math.min(limit, 1000));
    const take = Math.max(1, Math.ceil(bounded / 7));
    const [orderStatus, storeIntents, assignments, operational, paymentStatus, refundStatus, subscriptionIntents] = await Promise.all([
      this.db.orderStatusHistory.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], take, select: { id: true } }),
      this.db.marketplaceStoreOrderEventIntent.findMany({ where: { publishedAt: { not: null } }, orderBy: [{ publishedAt: "asc" }, { id: "asc" }], take, select: { id: true } }),
      this.db.orderAssignmentEvent.findMany({ where: { eventType: "ASSIGNMENT_CREATED" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take, select: { id: true } }),
      this.db.orderOperationalEvent.findMany({ where: { eventType: { in: ["PICKUP_COMPLETED", "DELIVERY_COMPLETED", "DELIVERY_FAILED"] } }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }], take, select: { id: true } }),
      this.db.paymentStatusHistory?.findMany ? this.db.paymentStatusHistory.findMany({ where: { toStatus: { in: ["SUCCEEDED", "FAILED"] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take, select: { id: true } }) : [],
      this.db.refundStatusHistory?.findMany ? this.db.refundStatusHistory.findMany({ where: { toStatus: "SUCCEEDED" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take, select: { id: true } }) : [],
      this.db.subscriptionEventIntent?.findMany ? this.db.subscriptionEventIntent.findMany({ where: { type: { in: ["SUBSCRIPTION_ACTIVATED", "SUBSCRIPTION_PAYMENT_FAILED", "SUBSCRIPTION_CANCELLED"] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take, select: { id: true } }) : [],
    ]);
    const candidates: SourceCandidate[] = [
      ...orderStatus.map((row: any) => ({ authority: "order-status-history" as const, reference: row.id })),
      ...storeIntents.map((row: any) => ({ authority: "store-order-intent" as const, reference: row.id })),
      ...assignments.map((row: any) => ({ authority: "order-assignment-event" as const, reference: row.id })),
      ...operational.map((row: any) => ({ authority: "order-operational-event" as const, reference: row.id })),
      ...paymentStatus.map((row: any) => ({ authority: "payment-status-history" as const, reference: row.id })),
      ...refundStatus.map((row: any) => ({ authority: "refund-status-history" as const, reference: row.id })),
      ...subscriptionIntents.map((row: any) => ({ authority: "subscription-event-intent" as const, reference: row.id })),
    ];
    const projected = this.db.developerWebhookPublicEvent?.findMany
      ? await this.db.developerWebhookPublicEvent.findMany({ where: { OR: candidates.map((candidate) => ({ sourceAuthority: candidate.authority, sourceEventReference: candidate.reference })) }, select: { sourceAuthority: true, sourceEventReference: true } })
      : [];
    const existing = new Set((projected as any[]).map((item) => `${item.sourceAuthority}:${item.sourceEventReference}`));
    return candidates.filter((candidate) => !existing.has(`${candidate.authority}:${candidate.reference}`)).sort((a, b) => `${a.authority}:${a.reference}`.localeCompare(`${b.authority}:${b.reference}`)).slice(0, bounded);
  }

  async resolve(candidate: SourceCandidate): Promise<Projection | null> {
    if (candidate.authority === "order-status-history") {
      const row = await this.db.orderStatusHistory.findUnique({ where: { id: candidate.reference }, include: { order: true } });
      if (!row?.order || (!row.order.customerId && !row.order.storeId)) return null;
      return Object.freeze({ sourceAuthority: candidate.authority, sourceEventReference: row.id, eventType: eventForOrderStatus(row.status), subjectReference: row.order.orderNumber, ownerUserId: row.order.customerId ?? (await this.storeOwner(row.order.storeId)), storeId: row.order.storeId ?? null, occurredAt: row.createdAt, payload: Object.freeze({ reference: row.order.orderNumber, status: row.status, occurredAt: row.createdAt.toISOString() }) });
    }
    if (candidate.authority === "store-order-intent") {
      const row = await this.db.marketplaceStoreOrderEventIntent.findUnique({ where: { id: candidate.reference }, include: { storeOrder: { include: { store: true } } } });
      if (!row?.storeOrder?.store?.ownerUserId) return null;
      const type = row.eventType.includes("READY") ? "za.co.ktcouriers.store_order.ready.v1" : row.eventType.includes("ACTION") ? "za.co.ktcouriers.store_order.action_required.v1" : null;
      if (!type) return null;
      return Object.freeze({ sourceAuthority: candidate.authority, sourceEventReference: row.id, eventType: type, subjectReference: row.storeOrder.publicReference, ownerUserId: row.storeOrder.store.ownerUserId, storeId: row.storeOrder.storeId, occurredAt: row.createdAt, payload: Object.freeze({ reference: row.storeOrder.publicReference, event: type.endsWith("ready.v1") ? "ready" : "action_required", occurredAt: row.createdAt.toISOString() }) });
    }
    if (candidate.authority === "order-assignment-event") {
      const row = await this.db.orderAssignmentEvent.findUnique({ where: { id: candidate.reference }, include: { assignment: { include: { order: true } } } }); const order = row?.assignment?.order;
      if (!order || (!order.customerId && !order.storeId)) return null;
      return Object.freeze({ sourceAuthority: candidate.authority, sourceEventReference: row.id, eventType: "za.co.ktcouriers.driver.assigned.v1", subjectReference: order.orderNumber, ownerUserId: order.customerId ?? (await this.storeOwner(order.storeId)), storeId: order.storeId ?? null, occurredAt: row.createdAt, payload: Object.freeze({ reference: order.orderNumber, status: "assigned", occurredAt: row.createdAt.toISOString() }) });
    }
    if (candidate.authority === "payment-status-history") {
      const row = await this.db.paymentStatusHistory.findUnique({ where: { id: candidate.reference }, include: { attempt: true, payment: { include: { order: true } } } }); const payment = row?.payment;
      if (!row || !payment || !["SUCCEEDED", "FAILED"].includes(row.toStatus)) return null;
      const owner = await this.paymentOwner(payment);
      if (!owner) return null;
      const eventType = row.toStatus === "SUCCEEDED" ? "za.co.ktcouriers.payment.succeeded.v1" : "za.co.ktcouriers.payment.failed.v1";
      const payload = Object.freeze({ paymentReference: payment.publicReference, orderReference: payment.order?.orderNumber ?? null, status: row.toStatus.toLowerCase(), currency: payment.currency, amount: payment.amount.toFixed(2), occurredAt: row.createdAt.toISOString(), ...(row.toStatus === "FAILED" && row.attempt?.failureCategory ? { failureCategory: row.attempt.failureCategory } : {}) });
      return Object.freeze({ sourceAuthority: candidate.authority, sourceEventReference: row.id, eventType, subjectReference: payment.publicReference, ownerUserId: owner.ownerUserId, storeId: owner.storeId, occurredAt: row.createdAt, payload });
    }
    if (candidate.authority === "refund-status-history") {
      const row = await this.db.refundStatusHistory.findUnique({ where: { id: candidate.reference }, include: { attempt: true, refund: { include: { payment: { include: { order: true } } } } } }); const refund = row?.refund;
      if (!row || !refund || row.toStatus !== "SUCCEEDED") return null;
      const owner = await this.refundOwner(refund);
      if (!owner) return null;
      const payload = Object.freeze({ refundReference: refund.publicReference, paymentReference: refund.payment?.publicReference ?? null, orderReference: refund.payment?.order?.orderNumber ?? null, status: "completed", currency: refund.currency, amount: refund.amount.toFixed(2), completedAt: (refund.completedAt ?? row.createdAt).toISOString() });
      return Object.freeze({ sourceAuthority: candidate.authority, sourceEventReference: row.id, eventType: "za.co.ktcouriers.refund.completed.v1", subjectReference: refund.publicReference, ownerUserId: owner.ownerUserId, storeId: owner.storeId, occurredAt: row.createdAt, payload });
    }
    if (candidate.authority === "subscription-event-intent") {
      const row = await this.db.subscriptionEventIntent.findUnique({ where: { id: candidate.reference }, include: { contract: true } }); const contract = row?.contract;
      if (!row || !contract) return null;
      const eventType = row.type === "SUBSCRIPTION_ACTIVATED" ? "za.co.ktcouriers.subscription.activated.v1" : row.type === "SUBSCRIPTION_PAYMENT_FAILED" ? "za.co.ktcouriers.subscription.renewal_failed.v1" : row.type === "SUBSCRIPTION_CANCELLED" ? "za.co.ktcouriers.subscription.cancelled.v1" : null;
      if (!eventType) return null;
      const owner = await this.subscriptionOwner(contract);
      if (!owner) return null;
      const safePayload = row.safePayload && typeof row.safePayload === "object" && !Array.isArray(row.safePayload) ? row.safePayload as Record<string, unknown> : {};
      const payload = Object.freeze({ subscriptionReference: contract.publicReference, planReference: this.safeReference(safePayload.planReference), status: eventType.endsWith("activated.v1") ? "active" : eventType.endsWith("cancelled.v1") ? "cancelled" : "renewal_failed", effectiveAt: this.safeTimestamp(safePayload.effectiveAt) ?? row.createdAt.toISOString(), ...(eventType.endsWith("renewal_failed.v1") ? { billingState: "payment_failed" } : {}), ...(eventType.endsWith("cancelled.v1") ? { cancellationEffectiveAt: this.safeTimestamp(safePayload.effectiveAt) ?? contract.cancellationEffectiveAt?.toISOString() ?? null } : {}), ...(eventType.endsWith("activated.v1") ? { renewalAt: contract.currentPeriodEnd?.toISOString() ?? null, billingState: "active" } : {}) });
      return Object.freeze({ sourceAuthority: candidate.authority, sourceEventReference: row.id, eventType, subjectReference: contract.publicReference, ownerUserId: owner.ownerUserId, storeId: owner.storeId, occurredAt: row.createdAt, payload });
    }
    const row = await this.db.orderOperationalEvent.findUnique({ where: { id: candidate.reference }, include: { order: true } }); const order = row?.order;
    if (!order || (!order.customerId && !order.storeId)) return null;
    const type = row.eventType === "PICKUP_COMPLETED" ? "za.co.ktcouriers.delivery.picked_up.v1" : row.eventType === "DELIVERY_COMPLETED" ? "za.co.ktcouriers.delivery.completed.v1" : row.eventType === "DELIVERY_FAILED" ? "za.co.ktcouriers.delivery.failed.v1" : null;
    if (!type) return null;
    return Object.freeze({ sourceAuthority: candidate.authority, sourceEventReference: row.id, eventType: type, subjectReference: order.orderNumber, ownerUserId: order.customerId ?? (await this.storeOwner(order.storeId)), storeId: order.storeId ?? null, occurredAt: row.occurredAt, payload: Object.freeze({ reference: order.orderNumber, status: type.split(".").at(-2), occurredAt: row.occurredAt.toISOString() }) });
  }

  private async storeOwner(storeId: string | null): Promise<string> { const store = storeId ? await this.db.store.findUnique({ where: { id: storeId }, select: { ownerUserId: true } }) : null; if (!store?.ownerUserId) throw new DeveloperApiError("WEBHOOK_EVENT_OWNER_UNRESOLVED", 409); return store.ownerUserId; }
  private async paymentOwner(payment: any): Promise<{ ownerUserId: string; storeId: string | null } | null> { if (payment.userId) return { ownerUserId: payment.userId, storeId: null }; if (payment.order?.customerId) return { ownerUserId: payment.order.customerId, storeId: payment.order.storeId ?? null }; if (payment.order?.storeId) return { ownerUserId: await this.storeOwner(payment.order.storeId), storeId: payment.order.storeId }; return null; }
  private async refundOwner(refund: any): Promise<{ ownerUserId: string; storeId: string | null } | null> { if (refund.customerUserId) return { ownerUserId: refund.customerUserId, storeId: null }; return refund.payment ? this.paymentOwner(refund.payment) : null; }
  private async subscriptionOwner(contract: any): Promise<{ ownerUserId: string; storeId: string | null } | null> { if (contract.customerUserId) return { ownerUserId: contract.customerUserId, storeId: null }; if (contract.storeId) return { ownerUserId: await this.storeOwner(contract.storeId), storeId: contract.storeId }; return null; }
  private safeReference(value: unknown): string | null { return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_-]{5,179}$/.test(value) ? value : null; }
  private safeTimestamp(value: unknown): string | null { if (typeof value !== "string") return null; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString(); }
}

/** Owns immutable public event creation and exact subscription fan-out. */
export class DeveloperWebhookProjectionService {
  constructor(private readonly db: any, private readonly sourceEvents: DeveloperWebhookSourceEventService) {}

  async project(candidate: SourceCandidate) {
    let projection: Projection | null;
    try { projection = await this.sourceEvents.resolve(candidate); }
    catch (error) { if (error instanceof DeveloperApiError && error.code === "WEBHOOK_EVENT_OWNER_UNRESOLVED") { await this.reconcile("WEBHOOK_EVENT_OWNER_MISMATCH", `${candidate.authority}:${candidate.reference}`, "The canonical resource owner could not be resolved.", { category: "RESOURCE_OWNER_UNRESOLVED" }); return null; } throw error; }
    if (!projection) { await this.reconcile("WEBHOOK_EVENT_OWNER_MISMATCH", `${candidate.authority}:${candidate.reference}`, "The canonical source resource is missing or does not resolve to a public owner.", { category: "SOURCE_RESOURCE_MISSING" }); return null; }
    const payloadHash = sha256(JSON.stringify(projection.payload));
    const existing = await this.db.developerWebhookPublicEvent.findUnique({ where: { sourceAuthority_sourceEventReference_eventType: { sourceAuthority: projection.sourceAuthority, sourceEventReference: projection.sourceEventReference, eventType: projection.eventType } } });
    if (existing) { if (existing.payloadHash !== payloadHash || existing.ownerUserId !== projection.ownerUserId || existing.storeId !== projection.storeId) throw new DeveloperApiError("WEBHOOK_PUBLIC_EVENT_CONFLICT", 409, "The canonical event projection changed."); return existing; }
    let event: any;
    try { event = await this.db.developerWebhookPublicEvent.create({ data: { publicReference: opaqueReference("dwhe"), sourceAuthority: projection.sourceAuthority, sourceEventReference: projection.sourceEventReference, eventType: projection.eventType, subjectReference: projection.subjectReference, ownerUserId: projection.ownerUserId, storeId: projection.storeId, payload: projection.payload, payloadHash, occurredAt: projection.occurredAt, expiresAt: new Date(projection.occurredAt.getTime() + EVENT_EXPIRY_MS) } }); }
    catch (error: any) { if (error?.code !== "P2002") throw error; return this.db.developerWebhookPublicEvent.findUniqueOrThrow({ where: { sourceAuthority_sourceEventReference_eventType: { sourceAuthority: projection.sourceAuthority, sourceEventReference: projection.sourceEventReference, eventType: projection.eventType } } }); }
    await this.fanOut(event, projection.eventType);
    return event;
  }

  async fanOut(event: any, eventType: keyof typeof WEBHOOK_EVENT_CATALOG) {
    const rule = WEBHOOK_EVENT_CATALOG[eventType]; const applications = await this.db.developerApplication.findMany({ where: { status: "ACTIVE", ownerUserId: event.ownerUserId, storeId: event.storeId }, orderBy: { id: "asc" } });
    for (const application of applications) {
      const snapshot = application.approvedOwnerSnapshot && typeof application.approvedOwnerSnapshot === "object" ? application.approvedOwnerSnapshot as Record<string, unknown> : null;
      if (!snapshot || snapshot.ownerUserId !== event.ownerUserId || (snapshot.storeId ?? null) !== event.storeId) { await this.reconcile("WEBHOOK_EVENT_OWNER_MISMATCH", application.publicReference, "The approved application owner no longer matches the canonical event owner.", { category: "APPLICATION_OWNER_MISMATCH", event: event.publicReference }); continue; }
      const owner = await this.db.user.findUnique({ where: { id: application.ownerUserId }, select: { status: true } }); if (owner?.status !== "ACTIVE") { await this.reconcile("WEBHOOK_ACTIVE_WITHOUT_VALID_CREDENTIAL_OWNER", application.publicReference, "The application owner is not eligible for webhook delivery.", { category: "APPLICATION_OWNER_INACTIVE", event: event.publicReference }); continue; }
      const grants = await this.db.developerScopeGrant.findMany({ where: { applicationId: application.id, status: "ACTIVE", environment: application.environment }, orderBy: { version: "desc" } }); if (!grants.some((grant: any) => scopes(grant.scopes).includes(rule.scope))) { await this.reconcile("WEBHOOK_SUBSCRIPTION_SCOPE_MISMATCH", application.publicReference, "The application has no active same-environment scope grant for this event.", { category: "SCOPE_MISMATCH", event: event.publicReference, scope: rule.scope, environment: application.environment }); continue; }
      const subscriptions = await this.db.developerWebhookSubscription.findMany({ where: { applicationId: application.id, environment: application.environment, status: "ACTIVE", verifiedAt: { not: null } }, orderBy: { id: "asc" } });
      for (const subscription of subscriptions) {
        if (!scopes(subscription.eventSelection).includes(eventType)) { await this.reconcile("WEBHOOK_SUBSCRIPTION_SCOPE_MISMATCH", subscription.publicReference, "The eligible subscription does not select the public event type.", { category: "EVENT_SELECTION_MISMATCH", event: event.publicReference, eventType }); continue; }
        const secret = await this.db.developerWebhookSecret.findFirst({ where: { subscriptionId: subscription.id, status: "CURRENT", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { version: "desc" } }); if (!secret) { await this.reconcile("WEBHOOK_SECRET_VERSION_MISSING", subscription.publicReference, "An active subscription has no current signing secret."); continue; }
        try { await this.db.developerWebhookDelivery.create({ data: { publicReference: opaqueReference("dwhd"), publicEventId: event.id, subscriptionId: subscription.id, endpointVersion: subscription.version, secretVersion: secret.version, expiresAt: event.expiresAt } }); }
        catch (error: any) { if (error?.code !== "P2002") throw error; }
      }
    }
    await this.db.developerWebhookPublicEvent.update({ where: { id: event.id }, data: { status: "DELIVERIES_CREATED" } });
  }

  private async reconcile(reason: string, reference: string, summary: string, evidence: Record<string, unknown> = {}) { const key = reconciliationKey(reason, reference); const existing = await this.db.developerApiReconciliationCase.findFirst({ where: { reason, safeEvidence: { equals: { key } }, status: { in: ["OPEN", "IN_PROGRESS"] } } }); if (!existing) await this.db.developerApiReconciliationCase.create({ data: { publicReference: opaqueReference("drec"), reason, safeSummary: summary, safeEvidence: { key, ...evidence } } }); }
}

export const WEBHOOK_REGISTRY_UNSUPPORTED = Object.freeze({
  "za.co.ktcouriers.refund.failed.v1": "RefundStatus has no FAILED terminal event; provider-attempt failure is not a canonical refund authority.",
  "za.co.ktcouriers.subscription.renewal_succeeded.v1": "Phase 22 has no durable SUBSCRIPTION_RENEWAL_SUCCEEDED event intent.",
  "za.co.ktcouriers.order.accepted.v1": "Courier acceptance lacks a dedicated privacy-reviewed source adapter; store acceptance remains internal to store-order authority.",
  "za.co.ktcouriers.order.rejected.v1": "Courier rejection lacks a dedicated privacy-reviewed source adapter; store rejection remains internal to store-order authority.",
});
