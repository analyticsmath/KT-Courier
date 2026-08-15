import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGetMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());
const findSessionWithUserMock = vi.hoisted(() => vi.fn());
const revokeSessionByTokenHashMock = vi.hoisted(() => vi.fn());
const recordSecurityEventMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE_NAME: "kt_session",
  HOST_SESSION_COOKIE_NAME: "__Host-kt_session",
  extractSessionToken: (store: { get: (name: string) => { value?: string } | undefined }) =>
    store.get("__Host-kt_session")?.value ?? store.get("kt_session")?.value,
  findSessionWithUser: findSessionWithUserMock,
  isUserStatusAllowedForSession: (status: string) => status === "ACTIVE",
  revokeSessionByTokenHash: revokeSessionByTokenHashMock,
}));

vi.mock("@/lib/services/security-events.service", () => ({
  SECURITY_EVENT_TYPES: {
    USER_STATUS_BLOCKED_SESSION: "USER_STATUS_BLOCKED_SESSION",
    SESSION_REVOKED: "SESSION_REVOKED",
  },
  recordSecurityEvent: recordSecurityEventMock,
}));

import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole, UserStatus } from "@/types/db";

function sessionWithUser(status: UserStatus = UserStatus.ACTIVE) {
  return {
    id: "session-1",
    tokenHash: "hashed-token",
    user: {
      id: "user-1",
      email: "admin@example.test",
      name: "Admin User",
      role: UserRole.ADMIN,
      status,
      passwordHash: "secret-password-hash",
    },
  };
}

describe("current user resolution", () => {
  beforeEach(() => {
    cookieGetMock.mockReset();
    cookiesMock.mockReset();
    findSessionWithUserMock.mockReset();
    revokeSessionByTokenHashMock.mockReset();
    recordSecurityEventMock.mockReset();
    cookiesMock.mockResolvedValue({ get: cookieGetMock });
  });

  it("returns null when the session cookie is missing", async () => {
    cookieGetMock.mockReturnValue(undefined);

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(findSessionWithUserMock).not.toHaveBeenCalled();
  });

  it("returns null when the session lookup rejects revoked or expired tokens", async () => {
    cookieGetMock.mockReturnValue({ value: "raw-token" });
    findSessionWithUserMock.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("rejects non-active users and revokes the session", async () => {
    cookieGetMock.mockReturnValue({ value: "raw-token" });
    findSessionWithUserMock.mockResolvedValue(sessionWithUser(UserStatus.SUSPENDED));

    await expect(getCurrentUser()).resolves.toBeNull();

    expect(revokeSessionByTokenHashMock).toHaveBeenCalledWith({
      tokenHash: "hashed-token",
      reason: "USER_STATUS_NOT_ALLOWED",
    });
    expect(recordSecurityEventMock).toHaveBeenCalledTimes(2);
  });

  it("returns a safe authenticated user for a valid active session", async () => {
    cookieGetMock.mockReturnValue({ value: "raw-token" });
    findSessionWithUserMock.mockResolvedValue(sessionWithUser(UserStatus.ACTIVE));

    const user = await getCurrentUser();

    expect(user).toEqual({
      id: "user-1",
      email: "admin@example.test",
      name: "Admin User",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("tokenHash");
  });
});
