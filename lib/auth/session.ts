import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken } from "./tokens";
import { UserStatus } from "@/types/db";

export const BASE_SESSION_COOKIE_NAME = "kt_session";
export const HOST_SESSION_COOKIE_NAME = "__Host-kt_session";

export function getSessionCookieName(): string {
  if (process.env.NODE_ENV === "production" && process.env.USE_HOST_COOKIE !== "false") {
    return HOST_SESSION_COOKIE_NAME;
  }
  return BASE_SESSION_COOKIE_NAME;
}

export const SESSION_COOKIE_NAME = BASE_SESSION_COOKIE_NAME;
export const SESSION_DURATION_DAYS = 14;

export function sessionExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DURATION_DAYS);
  return d;
}

export async function createSession(userId: string): Promise<string> {
  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = sessionExpiresAt();

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

  return rawToken;
}

export async function findSessionWithUser(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  return prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
}

export async function findSessionByTokenHash(tokenHash: string) {
  return prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
}

export function getSessionTokenHash(rawToken: string): string {
  return hashToken(rawToken);
}

export function isUserStatusAllowedForSession(status: UserStatus): boolean {
  return status === UserStatus.ACTIVE;
}

export async function revokeSessionByTokenHash(args: {
  tokenHash: string;
  reason: string;
  revokedByUserId?: string | null;
}): Promise<void> {
  await prisma.session.updateMany({
    where: {
      tokenHash: args.tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedReason: args.reason,
      revokedByUserId: args.revokedByUserId ?? null,
    },
  });
}

export async function revokeSessionByToken(args: {
  rawToken: string;
  reason: string;
  revokedByUserId?: string | null;
}): Promise<void> {
  await revokeSessionByTokenHash({
    tokenHash: hashToken(args.rawToken),
    reason: args.reason,
    revokedByUserId: args.revokedByUserId,
  });
}

export async function revokeSessionById(args: {
  sessionId: string;
  userId: string;
  reason: string;
  revokedByUserId?: string | null;
}): Promise<boolean> {
  const result = await prisma.session.updateMany({
    where: { id: args.sessionId, userId: args.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { revokedAt: new Date(), revokedReason: args.reason, revokedByUserId: args.revokedByUserId ?? null },
  });
  return result.count === 1;
}

export async function revokeAllUserSessions(args: {
  userId: string;
  reason: string;
  revokedByUserId?: string | null;
  excludeSessionId?: string | null;
}): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId: args.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...(args.excludeSessionId ? { id: { not: args.excludeSessionId } } : {}),
    },
    data: {
      revokedAt: new Date(),
      revokedReason: args.reason,
      revokedByUserId: args.revokedByUserId ?? null,
    },
  });

  return result.count;
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });

  return result.count;
}

export async function deleteSessionByToken(rawToken: string): Promise<void> {
  await revokeSessionByToken({
    rawToken,
    reason: "LEGACY_DELETE_SESSION_CALL",
  });
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await revokeAllUserSessions({
    userId,
    reason: "LEGACY_DELETE_ALL_USER_SESSIONS_CALL",
  });
}
