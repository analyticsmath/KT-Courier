import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { sameReferralPhone } from "./ordinary-referral-phone";

export const ORDINARY_REFERRAL_PROGRAM = "ORDINARY_REFERRAL_V1";
export const ORDINARY_REFERRAL_SOURCE = "ORDINARY_SIGNUP";
const CODE_PATTERN = /^KTR-[A-F0-9]{24}$/;

export type OrdinaryReferralOwner = Readonly<{
  userId: string;
  ownerType: "CUSTOMER" | "STORE";
  storeId?: string;
}>;

export class OrdinaryReferralError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "OrdinaryReferralError";
  }
}

export function normalizeOrdinaryReferralCode(raw: string): string {
  const code = raw.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    throw new OrdinaryReferralError("INVALID_CODE", "Referral code is invalid.");
  }
  return code;
}

function isOrdinaryCode(metadata: unknown): boolean {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata)
    && (metadata as Record<string, unknown>).program === ORDINARY_REFERRAL_PROGRAM);
}

type Db = Prisma.TransactionClient;

async function resolveOwner(db: Db, input: OrdinaryReferralOwner) {
  if (!input.userId || !["CUSTOMER", "STORE"].includes(input.ownerType)) {
    throw new OrdinaryReferralError("FORBIDDEN", "Referral accounts are unavailable.");
  }
  if (input.ownerType === "CUSTOMER") {
    const user = await db.user.findFirst({
      where: { id: input.userId, role: "CUSTOMER", status: "ACTIVE" },
      select: { id: true },
    });
    if (!user) throw new OrdinaryReferralError("FORBIDDEN", "An active customer is required.");
    return { ownerType: "CUSTOMER" as const, ownerId: user.id };
  }
  if (!input.storeId) throw new OrdinaryReferralError("FORBIDDEN", "An owned store is required.");
  const store = await db.store.findFirst({
    where: {
      id: input.storeId, ownerUserId: input.userId, status: "ACTIVE",
      ownerUser: { role: "STORE", status: "ACTIVE" },
    },
    select: { id: true },
  });
  if (!store) throw new OrdinaryReferralError("FORBIDDEN", "Only an active owned store can issue a referral.");
  return { ownerType: "STORE" as const, ownerId: store.id };
}

export async function getOrdinaryReferralCode(owner: OrdinaryReferralOwner) {
  const resolved = await prisma.$transaction(db => resolveOwner(db, owner));
  const code = await prisma.referralCode.findFirst({
    where: {
      ownerType: resolved.ownerType, ownerId: resolved.ownerId,
      isActive: true, metadata: { path: ["program"], equals: ORDINARY_REFERRAL_PROGRAM },
    },
    select: { id: true, code: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (!code) return null;
  const counts = await prisma.referralEvent.groupBy({
    by: ["status"],
    where: { referralCodeId: code.id, source: ORDINARY_REFERRAL_SOURCE },
    _count: { _all: true },
  });
  return {
    code: code.code, createdAt: code.createdAt.toISOString(),
    referralsPending: counts.find(row => row.status === "PENDING")?._count._all ?? 0,
    referralsRewarded: counts.find(row => row.status === "REWARDED")?._count._all ?? 0,
  };
}

/** Code creation is serialized for one owner, never for an arbitrary referrer
 * supplied by the HTTP caller. Promoter programme codes are not touched.
 */
export async function createOrdinaryReferralCode(owner: OrdinaryReferralOwner) {
  try {
    return await withLedgerRetry(() => prisma.$transaction(async db => {
    const resolved = await resolveOwner(db, owner);
    const lock = 'ordinary-referral:' + resolved.ownerType + ':' + resolved.ownerId;
    await db.$queryRawUnsafe("SELECT 1::integer AS locked FROM pg_advisory_xact_lock(hashtextextended($1, 0))", lock);
    const existing = await db.referralCode.findFirst({
      where: {
        ownerType: resolved.ownerType, ownerId: resolved.ownerId,
        isActive: true, metadata: { path: ["program"], equals: ORDINARY_REFERRAL_PROGRAM },
      },
      select: { code: true }, orderBy: { createdAt: "asc" },
    });
    if (existing) return { code: existing.code, replayed: true };
    const code = 'KTR-' + randomBytes(12).toString('hex').toUpperCase();
    const created = await db.referralCode.create({
      data: {
        ownerType: resolved.ownerType, ownerId: resolved.ownerId, code,
        isActive: true, metadata: { program: ORDINARY_REFERRAL_PROGRAM },
      },
      select: { code: true },
    });
    return { code: created.code, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  } catch (error) {
    // The unique owner/program index is authoritative if another transaction
    // wins after our snapshot was taken. Resolve its code using a FRESH read,
    // never reusing the failed serializable transaction's stale snapshot.
    if ((error as { code?: string })?.code !== "P2002") throw error;
    const winner = await getOrdinaryReferralCode(owner);
    if (!winner) throw error;
    return { code: winner.code, replayed: true };
  }
}

/** Call only inside creation of the NEW target User's signup transaction.
 * An invalid supplied code rejects the entire signup. No reward is posted
 * here: only verified first paid orders may produce a financial liability.
 */
export async function bindOrdinaryReferralAtSignup(
  db: Db,
  input: Readonly<{ code: string; targetUserId: string; targetType: "CUSTOMER" | "STORE" }>,
) {
  const code = normalizeOrdinaryReferralCode(input.code);
  const target = await db.user.findUnique({
    where: { id: input.targetUserId }, select: { id: true, email: true, phone: true, role: true },
  });
  if (!target || target.role !== input.targetType) {
    throw new OrdinaryReferralError("INVALID_TARGET", "Referral signup identity is invalid.");
  }
  const referral = await db.referralCode.findUnique({
    where: { code }, select: {
      id: true, isActive: true, ownerType: true, ownerId: true, metadata: true,
    },
  });
  if (!referral || !referral.isActive || !isOrdinaryCode(referral.metadata) ||
      !["CUSTOMER", "STORE"].includes(referral.ownerType)) {
    throw new OrdinaryReferralError("INVALID_CODE", "Referral code is unavailable.");
  }
  const referrer = referral.ownerType === "CUSTOMER"
    ? await db.user.findFirst({
        where: { id: referral.ownerId, role: "CUSTOMER", status: "ACTIVE" },
        select: { id: true, email: true, phone: true },
      })
    : await db.store.findFirst({
        where: {
          id: referral.ownerId, status: "ACTIVE",
          ownerUser: { role: "STORE", status: "ACTIVE" },
        },
        select: { ownerUser: { select: { id: true, email: true, phone: true } } },
      }).then(row => row?.ownerUser ?? null);
  if (!referrer || referrer.id === target.id ||
      referrer.email.toLowerCase() === target.email.toLowerCase() ||
      sameReferralPhone(target.phone, referrer.phone)) {
    throw new OrdinaryReferralError("SELF_REFERRAL", "Referral attribution is not eligible.");
  }
  const previous = await db.referralEvent.findFirst({
    where: { targetUserId: input.targetUserId, source: ORDINARY_REFERRAL_SOURCE },
    select: { id: true },
  });
  if (previous) throw new OrdinaryReferralError("ALREADY_ATTRIBUTED", "Only one signup referral is permitted.");
  return db.referralEvent.create({
    data: {
      referralCodeId: referral.id, targetType: input.targetType,
      targetUserId: input.targetUserId, source: ORDINARY_REFERRAL_SOURCE,
      status: "PENDING", metadata: { program: ORDINARY_REFERRAL_PROGRAM },
    },
    select: { id: true, status: true },
  });
}
