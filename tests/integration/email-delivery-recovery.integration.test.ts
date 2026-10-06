import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { claimEmailAttempt, EMAIL_SAFE_REPLAY_MS, EMAIL_SENDING_STALE_MS, finishEmailAttempt, recoverStalledEmailDeliveries } from "@/lib/notifications/email-delivery-recovery";
import { deliverSecurityEmail } from "@/lib/notifications/security-email-delivery";
import { sealSecurityPayload } from "@/lib/notifications/security-payload-vault";

const provider = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/notifications/providers", () => ({ ResendEmailProvider: class { send = provider.send; } }));
vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: () => {} }));
const enabled = process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1";

describe.skipIf(!enabled)("email interruption recovery on isolated PostgreSQL", () => {
  const prefix = `email-recovery-${randomUUID()}`;
  const owned: string[] = [];
  let userId: string | undefined;
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/kt_launch_test") throw new Error("Requires the disposable loopback launch database.");
  });
  afterEach(() => { vi.useRealTimers(); });
  afterAll(async () => {
    await prisma.notificationDeliveryAttempt.deleteMany({ where: { deliveryId: { in: owned } } });
    await prisma.notificationReconciliationCase.deleteMany({ where: { deliveryId: { in: owned } } });
    await prisma.notificationDelivery.deleteMany({ where: { id: { in: owned } } });
    const intents = await prisma.notificationEventIntent.findMany({ where: { operationId: { startsWith: prefix } }, select: { id: true } });
    await prisma.notificationSecurePayload.deleteMany({ where: { eventIntentId: { in: intents.map((row) => row.id) } } });
    await prisma.notificationEventIntent.deleteMany({ where: { id: { in: intents.map((row) => row.id) } } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
  });
  async function delivery(status: "SENDING" | "QUEUED" | "FAILED_RETRYABLE" = "SENDING") {
    const row = await prisma.notificationDelivery.create({ data: { publicReference: `${prefix}-${randomUUID()}`, messageId: randomUUID(), recipientUserId: prefix, channel: "EMAIL", status, renderedBody: "Test only", updatedAt: new Date(Date.now() - EMAIL_SENDING_STALE_MS - 1_000) } });
    owned.push(row.id); return row;
  }
  async function attempt(deliveryId: string, options: { age?: number; accepted?: boolean } = {}) {
    return prisma.notificationDeliveryAttempt.create({ data: { publicReference: `${prefix}-${randomUUID()}`, operationId: `${prefix}-${randomUUID()}`, deliveryId, attemptNumber: 1, provider: "RESEND_EMAIL", status: options.accepted ? "PROVIDER_ACCEPTED" : "STARTED", providerMessageReference: options.accepted ? "accepted-receipt" : null, startedAt: new Date(Date.now() - (options.age ?? EMAIL_SENDING_STALE_MS + 1_000)) } });
  }
  it("recovers one stale attempt once across competing workers", async () => {
    const row = await delivery(); await attempt(row.id);
    const results = await Promise.all(Array.from({ length: 6 }, () => recoverStalledEmailDeliveries(prisma, 50)));
    expect(results.reduce((count, result) => count + result.recovered, 0)).toBe(1);
    expect(await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "FAILED_RETRYABLE" });
    expect(await prisma.notificationDeliveryAttempt.findFirstOrThrow({ where: { deliveryId: row.id } })).toMatchObject({ status: "FAILED", safeProviderCode: "EMAIL_SEND_INTERRUPTED" });
  });
  it("allows only one atomic sender claim and durable attempt", async () => {
    const row = await delivery("QUEUED");
    const claims = await Promise.all(Array.from({ length: 6 }, () => claimEmailAttempt(prisma, { deliveryId: row.id, provider: "RESEND_EMAIL", operationId: `${prefix}-claim` })));
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await prisma.notificationDeliveryAttempt.count({ where: { deliveryId: row.id } })).toBe(1);
  });
  it("rolls back the sending claim if its durable attempt cannot commit", async () => {
    const row = await delivery("QUEUED"), other = await delivery();
    await prisma.notificationDeliveryAttempt.create({ data: { publicReference: `${prefix}-${randomUUID()}`, operationId: `${prefix}-conflict:1`, deliveryId: other.id, attemptNumber: 1, provider: "RESEND_EMAIL" } });
    await expect(claimEmailAttempt(prisma, { deliveryId: row.id, provider: "RESEND_EMAIL", operationId: `${prefix}-conflict` })).rejects.toMatchObject({ code: "P2002" });
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("QUEUED");
    expect(await prisma.notificationDeliveryAttempt.count({ where: { deliveryId: row.id } })).toBe(0);
    await prisma.notificationDelivery.update({ where: { id: other.id }, data: { status: "CANCELLED" } });
  });
  it("restores a committed provider receipt instead of replaying the send", async () => {
    const row = await delivery(); await attempt(row.id, { accepted: true });
    await recoverStalledEmailDeliveries(prisma, 50);
    expect(await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "PROVIDER_ACCEPTED", providerMessageReference: "accepted-receipt" });
  });
  it("requires a durable reconciliation case outside the safe replay window", async () => {
    const row = await delivery(); await attempt(row.id, { age: EMAIL_SAFE_REPLAY_MS + 1_000 });
    await recoverStalledEmailDeliveries(prisma, 50);
    expect(await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "FAILED_PERMANENT", eligibilityReason: "PROVIDER_IDEMPOTENCY_WINDOW_EXCEEDED" });
    expect(await prisma.notificationReconciliationCase.count({ where: { deliveryId: row.id, reason: "DELIVERY_STALLED" } })).toBe(1);
    await recoverStalledEmailDeliveries(prisma, 50);
    expect(await prisma.notificationReconciliationCase.count({ where: { deliveryId: row.id } })).toBe(1);
  });
  it("does not let a late response overwrite a newer attempt", async () => {
    const row = await delivery("QUEUED");
    const old = await claimEmailAttempt(prisma, { deliveryId: row.id, provider: "RESEND_EMAIL", operationId: `${prefix}-old` });
    if (!old) throw new Error("Missing first claim");
    await prisma.notificationDelivery.update({ where: { id: row.id }, data: { updatedAt: new Date(Date.now() - EMAIL_SENDING_STALE_MS - 1_000) } });
    await recoverStalledEmailDeliveries(prisma, 50);
    const newer = await claimEmailAttempt(prisma, { deliveryId: row.id, provider: "RESEND_EMAIL", operationId: `${prefix}-new` });
    if (!newer) throw new Error("Missing recovery claim");
    const late = await finishEmailAttempt(prisma, old, { accepted: true, providerMessageReference: "late-old" });
    expect(late.applied).toBe(false); expect(late.delivery.status).toBe("SENDING");
    const complete = await finishEmailAttempt(prisma, newer, { accepted: true, providerMessageReference: "current-receipt" });
    expect(complete.delivery).toMatchObject({ status: "PROVIDER_ACCEPTED", providerMessageReference: "current-receipt" });
    expect((await prisma.notificationDeliveryAttempt.findUniqueOrThrow({ where: { id: old.attempt.id } })).status).toBe("FAILED");
  });
  it("expires an interrupted token without calling a provider", async () => {
    const row = await delivery(); await attempt(row.id);
    await prisma.notificationDelivery.update({ where: { id: row.id }, data: { expiresAt: new Date(0), updatedAt: row.updatedAt } });
    await recoverStalledEmailDeliveries(prisma, 50);
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("EXPIRED");
  });
  it("rolls back late finalization when two claims share the same clock timestamp", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date());
    const row = await delivery("QUEUED");
    const old = await claimEmailAttempt(prisma, { deliveryId: row.id, provider: "RESEND_EMAIL", operationId: `${prefix}-same-time-old` });
    if (!old) throw new Error("Missing first claim");
    await prisma.notificationDelivery.update({ where: { id: row.id }, data: { updatedAt: new Date(Date.now() - EMAIL_SENDING_STALE_MS - 1_000) } });
    await recoverStalledEmailDeliveries(prisma, 50);
    const newer = await claimEmailAttempt(prisma, { deliveryId: row.id, provider: "RESEND_EMAIL", operationId: `${prefix}-same-time-new` });
    if (!newer) throw new Error("Missing recovered claim");
    expect(newer.claimAt).toEqual(old.claimAt);
    expect(await finishEmailAttempt(prisma, old, { accepted: true, providerMessageReference: "late-duplicate-time" })).toMatchObject({ applied: false, delivery: { status: "SENDING", providerMessageReference: null } });
    expect((await prisma.notificationDeliveryAttempt.findUniqueOrThrow({ where: { id: old.attempt.id } })).status).toBe("FAILED");
    await finishEmailAttempt(prisma, newer, { accepted: true, providerMessageReference: "correct-duplicate-time" });
  });
  it("recovers encrypted security email using the original provider key and no plaintext persisted evidence", async () => {
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const user = await prisma.user.create({ data: { email: `${prefix}@example.test`, role: "CUSTOMER", status: "PENDING_VERIFICATION" } }); userId = user.id;
    const intent = await prisma.notificationEventIntent.create({ data: { sourceAuthority: "AUTHENTICATION_SECURITY", eventType: "EMAIL_VERIFICATION_OTP", aggregateReference: user.id, operationId: `${prefix}-security`, safePayload: { subjectUserId: user.id } } });
    await prisma.notificationSecurePayload.create({ data: { publicReference: `${prefix}-secure`, eventIntentId: intent.id, encryptedPayload: sealSecurityPayload({ otp: "654321", name: "Test", expiresMinutes: 15 }, intent.operationId), keyVersion: "v2", expiresAt: new Date(Date.now() + 60_000) } });
    const row = await delivery(); await attempt(row.id);
    await prisma.notificationDelivery.update({ where: { id: row.id }, data: { messageId: intent.id, recipientUserId: user.id, updatedAt: row.updatedAt } });
    await recoverStalledEmailDeliveries(prisma, 50);
    provider.send.mockResolvedValue({ accepted: true, providerMessageReference: "security-accepted" });
    expect(await deliverSecurityEmail(row.id)).toMatchObject({ accepted: true, status: "PROVIDER_ACCEPTED" });
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: row.publicReference, destination: user.email }));
    const attempts = await prisma.notificationDeliveryAttempt.findMany({ where: { deliveryId: row.id }, orderBy: { attemptNumber: "asc" } });
    expect(attempts.map((item) => item.status)).toEqual(["FAILED", "PROVIDER_ACCEPTED"]);
    expect(JSON.stringify(attempts)).not.toContain("654321");
  });
});
