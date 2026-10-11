import { describe, expect, it } from "vitest";
import { UserStatus } from "@/types/db";
import { createSession, findSessionWithUser, isUserStatusAllowedForSession, revokeSessionByToken } from "@/lib/auth/session";
import { createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";
import { verifyAccountEmail } from "@/lib/services/account-email-verification.service";
import { hashOtp } from "@/lib/auth/otp";

describe("Phase 7.5 live session controls", () => {
  it("consumes one real verification code and issues exactly one session under concurrent requests", async () => {
    const user = await createUser(uniqueTag("auth-verification"), "CUSTOMER", UserStatus.PENDING_VERIFICATION);
    const otp = await integrationPrisma.otpCode.create({ data: { userId: user.id, email: user.email, codeHash: hashOtp("129384"), purpose: "EMAIL_VERIFICATION", expiresAt: new Date(Date.now() + 60_000) } });
    const results = await Promise.all([verifyAccountEmail(user.email, "129384"), verifyAccountEmail(user.email, "129384")]);
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(results.filter(result => !result.ok)).toMatchObject([{ status: 400 }]);
    expect(await integrationPrisma.session.count({ where: { userId: user.id } })).toBe(1);
    expect((await integrationPrisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } })).consumedAt).not.toBeNull();
    expect((await integrationPrisma.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("ACTIVE");
    expect((await verifyAccountEmail(user.email, "129384")).ok).toBe(false);
    expect(await integrationPrisma.session.count({ where: { userId: user.id } })).toBe(1);
  });
  it("preserves suspended and disabled accounts and refuses wrong or expired verification codes without sessions", async () => {
    for (const status of [UserStatus.SUSPENDED, UserStatus.DISABLED, UserStatus.PENDING_VERIFICATION]) {
      const user = await createUser(uniqueTag("auth-ineligible-verification"), "CUSTOMER", status);
      const otp = await integrationPrisma.otpCode.create({ data: { userId: user.id, email: user.email, codeHash: hashOtp("129384"), purpose: "EMAIL_VERIFICATION", expiresAt: new Date(status === UserStatus.PENDING_VERIFICATION ? 0 : Date.now() + 60_000) } });
      expect((await verifyAccountEmail(user.email, "129384")).ok).toBe(false);
      expect((await verifyAccountEmail(user.email, "999999")).ok).toBe(false);
      expect(await integrationPrisma.session.count({ where: { userId: user.id } })).toBe(0);
      expect((await integrationPrisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } })).consumedAt).toBeNull();
      expect((await integrationPrisma.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe(status);
    }
  });
  it("rejects revoked and expired sessions and excludes inactive users", async () => {
    const active = await createUser(uniqueTag("auth-active"), "CUSTOMER");
    const token = await createSession(active.id);
    expect((await findSessionWithUser(token))?.user.id).toBe(active.id);

    await revokeSessionByToken({ rawToken: token, reason: "PHASE7_5_TEST" });
    expect(await findSessionWithUser(token)).toBeNull();

    const expiredToken = await createSession(active.id);
    await integrationPrisma.session.updateMany({
      where: { userId: active.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect(await findSessionWithUser(expiredToken)).toBeNull();
    expect(isUserStatusAllowedForSession(UserStatus.SUSPENDED)).toBe(false);
    expect(isUserStatusAllowedForSession(UserStatus.DISABLED)).toBe(false);
  });
});
