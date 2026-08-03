import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  session: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  findSessionWithUser,
  isUserStatusAllowedForSession,
  revokeAllUserSessions,
} from "@/lib/auth/session";
import { UserStatus } from "@/types/db";

describe("session helpers", () => {
  beforeEach(() => {
    prismaMock.session.create.mockReset();
    prismaMock.session.findFirst.mockReset();
    prismaMock.session.findUnique.mockReset();
    prismaMock.session.updateMany.mockReset();
    prismaMock.session.deleteMany.mockReset();
  });

  it("queries only unrevoked, unexpired sessions with user data", async () => {
    prismaMock.session.findFirst.mockResolvedValue(null);

    await findSessionWithUser("raw-session-token");

    expect(prismaMock.session.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: expect.any(String),
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      include: { user: true },
    });
  });

  it("revokes active sessions and can exclude the current session", async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      revokeAllUserSessions({
        userId: "user-1",
        reason: "USER_STATUS_CHANGED",
        revokedByUserId: "admin-1",
        excludeSessionId: "session-keep",
      })
    ).resolves.toBe(2);

    expect(prismaMock.session.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
        id: { not: "session-keep" },
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: "USER_STATUS_CHANGED",
        revokedByUserId: "admin-1",
      },
    });
  });

  it("allows only active users to keep sessions", () => {
    expect(isUserStatusAllowedForSession(UserStatus.ACTIVE)).toBe(true);
    expect(isUserStatusAllowedForSession(UserStatus.PENDING_VERIFICATION)).toBe(false);
    expect(isUserStatusAllowedForSession(UserStatus.SUSPENDED)).toBe(false);
    expect(isUserStatusAllowedForSession(UserStatus.DISABLED)).toBe(false);
  });
});
