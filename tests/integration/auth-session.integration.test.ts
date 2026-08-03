import { describe, expect, it } from "vitest";
import { UserStatus } from "@/types/db";
import { createSession, findSessionWithUser, isUserStatusAllowedForSession, revokeSessionByToken } from "@/lib/auth/session";
import { createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";

describe("Phase 7.5 live session controls", () => {
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
