/* eslint-disable @typescript-eslint/no-explicit-any -- isolated Prisma adapter until Phase 30 generation. */
import { createHash } from "node:crypto";
import { assertNotificationProductionReady } from "./production-readiness";

export const NOTIFICATION_PROCESSOR_OPERATIONS = ["preflight", "consume", "fanout", "deliver", "retry", "receipts", "digest", "expire", "stale-endpoints", "reconciliation", "invariants", "integration"] as const;
export type NotificationProcessorOperation = (typeof NOTIFICATION_PROCESSOR_OPERATIONS)[number];

const operationId = (operation: string, referenceValue: string) => `phase27:${operation}:${createHash("sha256").update(`${operation}:${referenceValue}`).digest("hex").slice(0, 24)}`;

export class NotificationProcessorService {
  constructor(private readonly db: any, private readonly services: any) {}
  async run(input: { operation: NotificationProcessorOperation; apply: boolean; limit: number }) {
    if (!NOTIFICATION_PROCESSOR_OPERATIONS.includes(input.operation) || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 1_000) throw new Error("Invalid notification processor request.");
    // Mutations reach the one production lock before touching a business row.
    if (input.apply) assertNotificationProductionReady();
    const candidates = await this.select(input.operation, input.limit);
    if (!input.apply) return { operation: input.operation, apply: false, candidates: candidates.map((candidate: any) => ({ reference: candidate.publicReference ?? candidate.id, operationId: operationId(input.operation, candidate.publicReference ?? candidate.id) })) };
    // This code path is deliberately unreachable until the Phase 30 lock is approved.
    let itemsCompleted = 0;
    for (const candidate of candidates) {
      const completed = await this.apply(input.operation, candidate);
      if (completed) itemsCompleted++;
    }
    return { operation: input.operation, apply: true, processed: candidates.length, itemsCompleted };
  }
  private async select(operation: NotificationProcessorOperation, limit: number) {
    switch (operation) {
      case "consume": return this.db.notificationEventIntent.findMany({ orderBy: { createdAt: "asc" }, take: limit });
      case "fanout": return this.db.notificationSourceReceipt.findMany({ where: { status: "RECEIVED" }, orderBy: { createdAt: "asc" }, take: limit });
      case "deliver": return this.db.notificationDelivery.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: limit });
      case "retry": return this.db.notificationDelivery.findMany({ where: { status: "FAILED_RETRYABLE", nextAttemptAt: { lte: new Date() } }, orderBy: { nextAttemptAt: "asc" }, take: limit });
      case "receipts": return this.db.notificationDelivery.findMany({ where: { status: "PROVIDER_ACCEPTED" }, orderBy: { updatedAt: "asc" }, take: limit });
      case "digest": return this.db.notificationMessage.findMany({ where: { status: "FANOUT_COMPLETED", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "asc" }, take: limit });
      case "expire": return this.db.notificationDelivery.findMany({ where: { expiresAt: { lte: new Date() }, status: { in: ["PENDING", "QUEUED", "FAILED_RETRYABLE", "SENDING"] } }, orderBy: { expiresAt: "asc" }, take: limit });
      case "stale-endpoints": return this.db.notificationEndpoint.findMany({ where: { status: "ACTIVE", lastRefreshedAt: { lte: new Date(Date.now() - 90 * 24 * 60 * 60_000) } }, orderBy: { lastRefreshedAt: "asc" }, take: limit });
      case "reconciliation": return this.db.notificationReconciliationCase.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { lastObservedAt: "asc" }, take: limit });
      case "preflight": case "invariants": case "integration": return this.db.notificationCategory.findMany({ orderBy: { key: "asc" }, take: limit });
    }
  }
  private async resolveDestination(candidate: any): Promise<string | null> {
    if (candidate.destination) return candidate.destination;
    if (candidate.recipientAddress) return candidate.recipientAddress;
    if (candidate.endpoint?.address) return candidate.endpoint.address;
    if (candidate.endpointId) {
      try {
        const ep = await this.db.notificationEndpoint.findUnique({ where: { id: candidate.endpointId }, select: { address: true } });
        if (ep?.address) return ep.address;
      } catch {
        // ignore
      }
    }
    if (candidate.recipientUserId) {
      try {
        const user = await this.db.user.findUnique({ where: { id: candidate.recipientUserId }, select: { email: true, phone: true } });
        if (candidate.channel === "EMAIL" && user?.email) return user.email;
        if (candidate.channel === "SMS" && user?.phone) return user.phone;
      } catch {
        // ignore
      }
    }
    return null;
  }
  private async apply(operation: NotificationProcessorOperation, candidate: any): Promise<boolean> {
    if (operation === "consume") {
      const payload = candidate.safePayload && typeof candidate.safePayload === "object" ? candidate.safePayload : {};
      const received = await this.services.intake.intake({ sourceAuthority: candidate.sourceAuthority, sourceEventId: candidate.operationId, sourceEventType: candidate.eventType, aggregateReference: candidate.aggregateReference, payload });
      if (!received.replay) await this.services.intake.fanout({ receiptId: received.receipt.id, payload });
      return true;
    }
    if (operation === "deliver" || operation === "retry") {
      const destination = await this.resolveDestination(candidate);
      if (!destination) return false;
      const res = await this.services.delivery.deliver({
        deliveryId: candidate.id,
        destination,
        operationId: operationId(operation, candidate.publicReference ?? candidate.id),
      });
      return Boolean(res && (res.status === "PROVIDER_ACCEPTED" || res.status === "DELIVERED"));
    }
    if (operation === "expire") { await this.services.delivery.expire(candidate.id); return true; }
    if (operation === "stale-endpoints") { await this.services.endpoints.markStale(candidate.id); return true; }
    if (operation === "reconciliation") { await this.services.reconciliation.act(candidate.publicReference, "rescan"); return true; }
    return false;
  }
}
