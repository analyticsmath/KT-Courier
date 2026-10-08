import { strict as assert } from "node:assert";
import { prisma } from "../lib/db/prisma";
import { assertDisposablePaystackAcceptance } from "../lib/testing/disposable-paystack-policy";
import { openSecurityPayload } from "../lib/notifications/security-payload-vault";
import { hashOtp } from "../lib/auth/otp";
import { hashToken } from "../lib/auth/tokens";

/** Test-owned inbox reader; never imported by an application route. */
let stage = "RUNTIME";
async function main() {
  assertDisposablePaystackAcceptance();
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  assert.deepEqual(identity, [{ database: "kt_phase75_e2e", role: "kt_phase75_e2e" }]);
  const [email, action] = process.argv.slice(2);
  assert.match(email ?? "", /^e2e-identity-(1440|390)-[a-f0-9]{8}@ktcouriers\.local$/);
  assert.ok(action === "verification" || action === "reset");
  stage = "OWNER";
  const owner = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true, status: true, emailVerifiedAt: true } });
  assert.equal(owner.role, "CUSTOMER");
  if (action === "reset") { stage = "OWNER_ELIGIBILITY"; assert.equal(owner.status, "ACTIVE"); assert.ok(owner.emailVerifiedAt); }
  stage = "LIVE_SOURCE";
  const source = action === "verification"
    ? await prisma.otpCode.findFirstOrThrow({ where: { userId: owner.id, email, purpose: "EMAIL_VERIFICATION", consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } })
    : await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: owner.id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  const operationId = `${action === "verification" ? "email-verification" : "password-reset"}:${source.id}`;
  stage = "BOUND_INTENT";
  const intent = await prisma.notificationEventIntent.findUniqueOrThrow({ where: { operationId } });
  assert.equal(intent.sourceAuthority, "AUTHENTICATION_SECURITY");
  assert.equal(intent.eventType, action === "verification" ? "EMAIL_VERIFICATION_OTP" : "PASSWORD_RESET");
  assert.equal((intent.safePayload as { subjectUserId: string }).subjectUserId, owner.id);
  stage = "SECURE_ENVELOPE";
  const secure = await prisma.notificationSecurePayload.findUniqueOrThrow({ where: { eventIntentId: intent.id } });
  assert.ok(secure.expiresAt && secure.expiresAt > new Date());
  const values = openSecurityPayload(secure.encryptedPayload, operationId);
  stage = "SECRET_BINDING";
  const secret = action === "verification" ? values.otp : new URL(String(values.resetUrl)).searchParams.get("token");
  assert.ok(typeof secret === "string");
  if (action === "verification") { assert.match(secret, /^\d{6}$/); assert.equal(hashOtp(secret), (source as { codeHash: string }).codeHash); }
  else { assert.match(secret, /^[a-f0-9]{64}$/); assert.equal(hashToken(secret), (source as { tokenHash: string }).tokenHash); }
  // Captured only in the test process pipe. Never attach this secret as evidence.
  process.stdout.write(`IDENTITY_TEST_INBOX ${JSON.stringify({ secret })}\n`);
}
main().catch(() => { console.error(`Owned disposable identity inbox evidence unavailable: ${stage}.`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
