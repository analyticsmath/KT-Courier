import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { verifyPassword } from "@/lib/auth/password";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { hashOtp } from "@/lib/auth/otp";
import { queueSecurityNotification, type SecurityNotificationInput } from "@/lib/notifications/security-delivery";
import { openSecurityPayload } from "@/lib/notifications/security-payload-vault";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as resendOtp } from "@/app/api/auth/resend-otp/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";

const nonce = randomUUID();
const userId = `security_outbox_${nonce}`;
const operationPrefix = `security-outbox:${nonce}:`;
const key = Buffer.alloc(32, 7).toString("base64");
const expiry = new Date(Date.now() + 60 * 60_000);
const emailPrefix = `outbox-${nonce}`;
let databaseValidated = false;
const input = (suffix: string): SecurityNotificationInput => ({ eventType: "EMAIL_VERIFICATION_OTP", subjectUserId: userId, operationId: operationPrefix + suffix, aggregateReference: userId, expiresAt: expiry, allowUnverifiedBootstrapEmail: true, values: { otp: "123456", name: "Test recipient", expiresMinutes: 15 } });
const request = (path: string, data: Record<string, unknown>) => new NextRequest(`http://localhost:3000/api/auth/${path}`, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify(data) });
const rejectSecureInserts = async () => {
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_security_outbox_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic outbox persistence failure'; RETURN NEW; END; $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER test_security_outbox_reject BEFORE INSERT ON "NotificationSecurePayload" FOR EACH ROW EXECUTE FUNCTION test_security_outbox_reject()`);
};
const removeRejectTrigger = async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_security_outbox_reject ON "NotificationSecurePayload"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_security_outbox_reject()`);
};

describe("real PostgreSQL security notification outbox", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/kt_courier_(?:test|ci)/.test(url.pathname)) throw new Error("This suite requires a disposable local test database.");
    databaseValidated = true;
    await removeRejectTrigger();
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", key);
    await prisma.user.create({ data: { id: userId, email: `${emailPrefix}@example.test`, passwordHash: "test-only-not-a-login", name: "Test recipient", role: "CUSTOMER", status: "PENDING_VERIFICATION" } });
  });
  beforeEach(() => {
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", key);
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "test-only-not-a-provider-key");
    vi.stubEnv("EMAIL_FROM", "sender@example.test");
  });
  afterEach(async () => { if (databaseValidated) await removeRejectTrigger(); });
  afterAll(async () => {
    if (!databaseValidated) return;
    const users = await prisma.user.findMany({ where: { email: { startsWith: emailPrefix } }, select: { id: true } });
    const userIds = users.map((user) => user.id);
    const intents = await prisma.notificationEventIntent.findMany({ where: { OR: [{ operationId: { startsWith: operationPrefix } }, ...userIds.map((id) => ({ safePayload: { path: ["subjectUserId"], equals: id } }))] }, select: { id: true } });
    const intentIds = intents.map((intent) => intent.id);
    await prisma.notificationSecurePayload.deleteMany({ where: { eventIntentId: { in: intentIds } } });
    await prisma.notificationEventIntent.deleteMany({ where: { id: { in: intentIds } } });
    await prisma.otpCode.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.securityEvent.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });

  it("writes exactly one intent and encrypted payload across concurrent retries", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => queueSecurityNotification(input("concurrent"))));
    expect(results.filter((result) => !result.replay)).toHaveLength(1);
    const intents = await prisma.notificationEventIntent.findMany({ where: { operationId: input("concurrent").operationId } });
    expect(intents).toHaveLength(1);
    expect(JSON.stringify(intents)).not.toContain("123456");
    const payload = await prisma.notificationSecurePayload.findUniqueOrThrow({ where: { eventIntentId: intents[0].id } });
    expect(openSecurityPayload(payload.encryptedPayload, input("concurrent").operationId)).toEqual(input("concurrent").values);
  });

  it("rejects changing a token, event or aggregate on replay", async () => {
    const original = input("conflict");
    await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE", emailVerifiedAt: new Date() } });
    try {
      await queueSecurityNotification(original);
      for (const alteration of [{ values: { otp: "654321" } }, { eventType: "PASSWORD_CHANGED" as const }, { aggregateReference: "another-aggregate" }]) {
        await expect(queueSecurityNotification({ ...original, ...alteration })).rejects.toMatchObject({ code: "NOTIFICATION_SOURCE_EVENT_PAYLOAD_CONFLICT" });
      }
      expect(await prisma.notificationEventIntent.count({ where: { operationId: original.operationId } })).toBe(1);
    } finally {
      await prisma.user.update({ where: { id: userId }, data: { status: "PENDING_VERIFICATION", emailVerifiedAt: null } });
    }
  });

  it("rolls back token replacement and the intent when payload persistence fails", async () => {
    const old = await prisma.otpCode.create({ data: { userId, email: `${emailPrefix}@example.test`, codeHash: hashOtp("111111"), purpose: "EMAIL_VERIFICATION", expiresAt: expiry } });
    await expect(prisma.$transaction(async (tx) => {
      await tx.otpCode.update({ where: { id: old.id }, data: { consumedAt: new Date() } });
      await queueSecurityNotification(input("rollback"), tx);
      throw new Error("Simulated failure after secure payload insert");
    })).rejects.toThrow("Simulated failure");
    expect((await prisma.otpCode.findUniqueOrThrow({ where: { id: old.id } })).consumedAt).toBeNull();
    expect(await prisma.notificationEventIntent.count({ where: { operationId: input("rollback").operationId } })).toBe(0);
  });

  it("does not leave an intent when encryption is unavailable", async () => {
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", "");
    await expect(queueSecurityNotification(input("key-failure"))).rejects.toMatchObject({ code: "NOTIFICATION_SECURITY_ENCRYPTION_UNAVAILABLE" });
    expect(await prisma.notificationEventIntent.count({ where: { operationId: input("key-failure").operationId } })).toBe(0);
  });

  it("does not allow the bootstrap flag to send other events to an unverified account", async () => {
    await expect(queueSecurityNotification({ ...input("unverified-reset"), eventType: "PASSWORD_RESET" })).rejects.toMatchObject({ code: "VERIFIED_NOTIFICATION_DESTINATION_REQUIRED" });
    expect(await prisma.notificationEventIntent.count({ where: { operationId: input("unverified-reset").operationId } })).toBe(0);
  });

  it("rolls back a real signup if the encrypted email insert fails", async () => {
    const email = `${emailPrefix}-failed-signup@example.test`;
    await rejectSecureInserts();
    const response = await signup(request("signup", { accountType: "CUSTOMER", fullName: "Test customer", email, password: "TestOnly-SecurePassword42!", confirmPassword: "TestOnly-SecurePassword42!" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "ACCOUNT_EMAIL_UNAVAILABLE" });
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect(await prisma.otpCode.count({ where: { email } })).toBe(0);
  });

  it("commits a signup with an expiring encrypted intent and preserves its old OTP on a failed resend", async () => {
    const email = `${emailPrefix}-signup@example.test`;
    const response = await signup(request("signup", { accountType: "CUSTOMER", fullName: "Test customer", email, password: "TestOnly-SecurePassword42!", confirmPassword: "TestOnly-SecurePassword42!" }));
    expect(response.status).toBe(201);
    const otp = await prisma.otpCode.findFirstOrThrow({ where: { email, consumedAt: null } });
    const intent = await prisma.notificationEventIntent.findUniqueOrThrow({ where: { operationId: `email-verification:${otp.id}` } });
    const secure = await prisma.notificationSecurePayload.findUniqueOrThrow({ where: { eventIntentId: intent.id } });
    expect(secure.expiresAt).toEqual(otp.expiresAt);
    expect(intent.safePayload).toMatchObject({ subjectUserId: otp.userId, bootstrap: true });
    await rejectSecureInserts();
    expect((await resendOtp(request("resend-otp", { email }))).status).toBe(503);
    expect((await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } })).consumedAt).toBeNull();
    expect(await prisma.otpCode.count({ where: { email } })).toBe(1);
  });

  it("does not claim password recovery when its durable email cannot be written", async () => {
    await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE", emailVerifiedAt: new Date() } });
    await rejectSecureInserts();
    const response = await forgotPassword(request("forgot-password", { email: `${emailPrefix}@example.test` }));
    expect(response.status).toBe(503);
    expect(await prisma.passwordResetToken.count({ where: { userId } })).toBe(0);
  });
  async function resetFixture(suffix: string) {
    const user = await prisma.user.create({ data: { email: `${emailPrefix}-${suffix}@example.test`, passwordHash: "unchanged-password", name: "Reset recipient", role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() } });
    const rawToken = `reset-${nonce}-${suffix}`;
    const token = await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: expiry } });
    const siblingRawToken = `sibling-${nonce}-${suffix}`;
    const sibling = await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(siblingRawToken), expiresAt: expiry } });
    const session = await prisma.session.create({ data: { userId: user.id, tokenHash: hashToken(`session-${nonce}-${suffix}`), expiresAt: expiry } });
    return { user, rawToken, token, siblingRawToken, sibling, session };
  }
  const resetRequest = (token: string, password: string) => request("reset-password", { token, password, confirmPassword: password });

  it("rolls back password, links and session revocation if the password-change email cannot be persisted", async () => {
    const fixture = await resetFixture("rollback-reset");
    await rejectSecureInserts();
    const response = await resetPassword(resetRequest(fixture.rawToken, "ResetOnly-SecurePassword42!"));
    expect(response.status).toBe(503);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).passwordHash).toBe("unchanged-password");
    expect(await prisma.passwordResetToken.count({ where: { userId: fixture.user.id, usedAt: null } })).toBe(2);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: fixture.session.id } })).revokedAt).toBeNull();
    expect(await prisma.notificationEventIntent.count({ where: { operationId: `password-changed:${fixture.token.id}` } })).toBe(0);
  });

  for (const separateLinks of [false, true]) it(`allows one concurrent password reset using ${separateLinks ? "different" : "the same"} links and revokes sessions atomically`, async () => {
    const fixture = await resetFixture(separateLinks ? "different-links" : "same-link");
    const passwords = ["ResetWinner-OnePassword42!", "ResetWinner-TwoPassword42!"];
    const responses = await Promise.all([
      resetPassword(resetRequest(fixture.rawToken, passwords[0])),
      resetPassword(resetRequest(separateLinks ? fixture.siblingRawToken : fixture.rawToken, passwords[1])),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
    if (!saved.passwordHash) throw new Error("Password reset did not persist a password hash.");
    expect(await verifyPassword(passwords[responses.findIndex((response) => response.status === 200)], saved.passwordHash)).toBe(true);
    expect(await prisma.passwordResetToken.count({ where: { userId: fixture.user.id, usedAt: null } })).toBe(0);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: fixture.session.id } })).revokedReason).toBe("PASSWORD_RESET");
    const intents = await prisma.notificationEventIntent.findMany({ where: { operationId: { in: [`password-changed:${fixture.token.id}`, `password-changed:${fixture.sibling.id}`] } } });
    expect(intents).toHaveLength(1);
    expect(await resetPassword(resetRequest(fixture.siblingRawToken, passwords[1]))).toMatchObject({ status: 400 });
  });
});
