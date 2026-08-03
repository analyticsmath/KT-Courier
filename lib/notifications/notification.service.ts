/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Client generation is deferred to Phase 30. */
import { createHash } from "node:crypto";
import { deliveryEligible, type ConsentStatus, type NotificationChannel, type NotificationPurpose, type NotificationSensitivity, type PreferenceMode, NotificationPolicyError } from "./contracts";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ref = (prefix: string, value: string) => `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;

export class NotificationService {
  constructor(private readonly db: any) {}

  async createLogicalMessage(input: { sourceReceiptId: string; recipientUserId: string; categoryKey: string; routeVersionId: string; templateVersionId: string; recipientPolicyVersionId: string; purpose: NotificationPurpose; priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"; sensitivity: NotificationSensitivity; renderVariables: Record<string, unknown>; expiresAt?: Date | null }) {
    const renderVariablesHash = hash(input.renderVariables);
    const existing = await this.db.notificationMessage.findFirst({ where: { sourceReceiptId: input.sourceReceiptId, recipientUserId: input.recipientUserId } });
    if (existing) {
      if (existing.renderVariablesHash !== renderVariablesHash) throw new NotificationPolicyError("NOTIFICATION_SOURCE_EVENT_PAYLOAD_CONFLICT");
      return { message: existing, replay: true };
    }
    const dedupeKey = hash({ sourceReceiptId: input.sourceReceiptId, recipientUserId: input.recipientUserId, categoryKey: input.categoryKey, routeVersionId: input.routeVersionId, templateVersionId: input.templateVersionId, renderVariablesHash });
    const message = await this.db.notificationMessage.create({ data: { publicReference: ref("nmsg", dedupeKey), dedupeKey, sourceReceiptId: input.sourceReceiptId, recipientUserId: input.recipientUserId, categoryKey: input.categoryKey, routeVersionId: input.routeVersionId, templateVersionId: input.templateVersionId, recipientPolicyVersionId: input.recipientPolicyVersionId, purpose: input.purpose, priority: input.priority, sensitivity: input.sensitivity, renderVariablesHash, expiresAt: input.expiresAt ?? null, status: "CREATED" } });
    return { message, replay: false };
  }

  async createDelivery(input: { messageId: string; recipientUserId: string; channel: NotificationChannel; purpose: NotificationPurpose; preference?: PreferenceMode; consent?: ConsentStatus; suppressed?: boolean; verifiedDestination?: boolean; endpointId?: string | null; renderedTitle?: string | null; renderedBody: string; actionRoute?: string | null; expiresAt?: Date | null }) {
    const eligibility = deliveryEligible(input);
    const existing = await this.db.notificationDelivery.findUnique({ where: { messageId_channel: { messageId: input.messageId, channel: input.channel } } });
    if (existing) return existing;
    return this.db.notificationDelivery.create({ data: { publicReference: ref("ndel", `${input.messageId}:${input.channel}`), messageId: input.messageId, recipientUserId: input.recipientUserId, channel: input.channel, endpointId: input.endpointId ?? null, status: eligibility.eligible ? (input.channel === "IN_APP" ? "DELIVERED" : "QUEUED") : "ELIGIBILITY_BLOCKED", eligibilityReason: eligibility.reason ?? null, renderedTitle: input.renderedTitle ?? null, renderedBody: input.renderedBody, actionRoute: input.actionRoute ?? null, expiresAt: input.expiresAt ?? null } });
  }

  async createInboxItem(input: { messageId: string; ownerUserId: string; title: string; body: string; actionRoute?: string | null; expiresAt?: Date | null }) {
    return this.db.notificationInboxItem.upsert({ where: { messageId: input.messageId }, update: {}, create: { publicReference: ref("ninbox", input.messageId), messageId: input.messageId, ownerUserId: input.ownerUserId, title: input.title, body: input.body, actionRoute: input.actionRoute ?? null, expiresAt: input.expiresAt ?? null, state: "UNREAD" } });
  }

}
