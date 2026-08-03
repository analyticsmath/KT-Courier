/* eslint-disable @typescript-eslint/no-explicit-any -- the generated promoter delegates are intentionally deferred in this repository. */
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/db";

type DbRow = Record<string, any>;

export type PromoterAccountProjection = {
  id: string;
  publicReference: string;
  displayName: string | null;
  status: string;
  identityStatus: string;
  taxProfileStatus: string;
  payoutReadinessStatus: string;
  agreementStatus: string;
  approvedAt: Date | null;
  activatedAt: Date | null;
  suspendedAt: Date | null;
  createdAt: Date;
};

export type PromoterReferralRecord = {
  id: string;
  publicReference: string;
  status: string;
  attributedAt: Date;
  createdAt: Date;
  expiresAt: Date;
  qualification: null | { publicReference: string; status: string; holdUntil: Date | null; qualifiedAt: Date | null; releasedAt: Date | null; createdAt: Date };
  touch: null | { publicReference: string; occurredAt: Date; destinationType: string };
};

export type PromoterEarningRecord = {
  id: string;
  publicReference: string;
  status: string;
  currency: string;
  grossAmount: unknown;
  payableAmount: unknown;
  reversedAmount: unknown;
  withdrawnAmount: unknown;
  holdUntil: Date;
  accruedAt: Date | null;
  releasedAt: Date | null;
  reversedAt: Date | null;
  createdAt: Date;
  qualificationReference: string | null;
};

export type PromoterWithdrawalRecord = {
  id: string;
  publicReference: string;
  status: string;
  currency: string;
  amount: unknown;
  createdAt: Date;
  completedAt: Date | null;
  destination: string | null;
};

function asAccount(row: DbRow | null): PromoterAccountProjection | null {
  if (!row) return null;
  return {
    id: row.id,
    publicReference: row.publicReference,
    displayName: row.displayName ?? null,
    status: row.status,
    identityStatus: row.identityStatus,
    taxProfileStatus: row.taxProfileStatus,
    payoutReadinessStatus: row.payoutReadinessStatus,
    agreementStatus: row.agreementStatus,
    approvedAt: row.approvedAt ?? null,
    activatedAt: row.activatedAt ?? null,
    suspendedAt: row.suspendedAt ?? null,
    createdAt: row.createdAt,
  };
}

export async function getPromoterAccountProjection(userId: string): Promise<PromoterAccountProjection | null> {
  const row = await (prisma as any).promoterAccount.findFirst({
    where: { userId },
    select: {
      id: true, publicReference: true, displayName: true, status: true,
      identityStatus: true, taxProfileStatus: true, payoutReadinessStatus: true, agreementStatus: true,
      approvedAt: true, activatedAt: true, suspendedAt: true, createdAt: true,
    },
  });
  return asAccount(row);
}

/** Mirrors the existing promoter read-policy boundary before selecting route data. */
export async function getPromoterPresentationContext(args: { userId: string; role: UserRole; permission: string }): Promise<{ account: PromoterAccountProjection | null; canReadRecords: boolean }> {
  const account = await getPromoterAccountProjection(args.userId);
  if (!account || args.role !== "PROMOTER") return { account, canReadRecords: false };
  const permitted = await hasPermission({ userId: args.userId, role: args.role, permissionKey: args.permission });
  return { account, canReadRecords: permitted && !["SUSPENDED", "TERMINATED"].includes(account.status) };
}

export async function getPromoterReferralRecords(accountId: string, take?: number): Promise<PromoterReferralRecord[]> {
  const rows = await (prisma as any).promoterAttribution.findMany({
    where: { promoterAccountId: accountId },
    select: {
      publicReference: true, status: true, attributedAt: true, createdAt: true, expiresAt: true,
      qualifications: { select: { publicReference: true, status: true, holdUntil: true, qualifiedAt: true, releasedAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      touch: { select: { publicReference: true, occurredAt: true, destinationType: true } },
    },
    orderBy: [{ attributedAt: "desc" }, { id: "asc" }],
    ...(take ? { take } : {}),
  });
  return rows.map((row: DbRow) => ({
    id: row.publicReference,
    publicReference: row.publicReference,
    status: row.status,
    attributedAt: row.attributedAt,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    qualification: row.qualifications[0] ?? null,
    touch: row.touch ?? null,
  }));
}

export async function getPromoterReferralRecord(accountId: string, reference: string): Promise<PromoterReferralRecord | null> {
  const row = await (prisma as any).promoterAttribution.findFirst({
    where: { promoterAccountId: accountId, publicReference: reference },
    select: {
      publicReference: true, status: true, attributedAt: true, createdAt: true, expiresAt: true,
      qualifications: { select: { publicReference: true, status: true, holdUntil: true, qualifiedAt: true, releasedAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      touch: { select: { publicReference: true, occurredAt: true, destinationType: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.publicReference, publicReference: row.publicReference, status: row.status,
    attributedAt: row.attributedAt, createdAt: row.createdAt, expiresAt: row.expiresAt,
    qualification: row.qualifications[0] ?? null, touch: row.touch ?? null,
  };
}

export async function getPromoterEarningRecords(accountId: string, take?: number): Promise<PromoterEarningRecord[]> {
  const rows = await (prisma as any).promoterEarning.findMany({
    where: { promoterAccountId: accountId },
    select: {
      publicReference: true, status: true, currency: true, grossAmount: true, payableAmount: true,
      reversedAmount: true, withdrawnAmount: true, holdUntil: true, accruedAt: true, releasedAt: true,
      reversedAt: true, createdAt: true, qualification: { select: { publicReference: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    ...(take ? { take } : {}),
  });
  return rows.map((row: DbRow) => ({
    id: row.publicReference, publicReference: row.publicReference, status: row.status, currency: row.currency,
    grossAmount: row.grossAmount, payableAmount: row.payableAmount, reversedAmount: row.reversedAmount,
    withdrawnAmount: row.withdrawnAmount, holdUntil: row.holdUntil, accruedAt: row.accruedAt ?? null,
    releasedAt: row.releasedAt ?? null, reversedAt: row.reversedAt ?? null, createdAt: row.createdAt,
    qualificationReference: row.qualification?.publicReference ?? null,
  }));
}

export async function getPromoterEarningRecord(accountId: string, reference: string): Promise<PromoterEarningRecord | null> {
  const row = await (prisma as any).promoterEarning.findFirst({
    where: { promoterAccountId: accountId, publicReference: reference },
    select: {
      publicReference: true, status: true, currency: true, grossAmount: true, payableAmount: true,
      reversedAmount: true, withdrawnAmount: true, holdUntil: true, accruedAt: true, releasedAt: true,
      reversedAt: true, createdAt: true, qualification: { select: { publicReference: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.publicReference, publicReference: row.publicReference, status: row.status, currency: row.currency,
    grossAmount: row.grossAmount, payableAmount: row.payableAmount, reversedAmount: row.reversedAmount,
    withdrawnAmount: row.withdrawnAmount, holdUntil: row.holdUntil, accruedAt: row.accruedAt ?? null,
    releasedAt: row.releasedAt ?? null, reversedAt: row.reversedAt ?? null, createdAt: row.createdAt,
    qualificationReference: row.qualification?.publicReference ?? null,
  };
}

export async function getPromoterWithdrawalRecords(accountId: string): Promise<PromoterWithdrawalRecord[]> {
  const rows = await (prisma as any).withdrawalRequest.findMany({
    where: { ownerType: "PROMOTER", ownerId: accountId },
    select: {
      publicReference: true, status: true, currency: true, amount: true, createdAt: true, completedAt: true,
      payoutDestination: { select: { maskedLabel: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return rows.map((row: DbRow) => ({
    id: row.publicReference, publicReference: row.publicReference, status: row.status, currency: row.currency,
    amount: row.amount, createdAt: row.createdAt, completedAt: row.completedAt ?? null,
    destination: row.payoutDestination?.maskedLabel ?? null,
  }));
}

export async function getPromoterWalletProjection(accountId: string): Promise<null | { availableBalance: unknown; pendingBalance: unknown; lockedBalance: unknown; currency: string; status: string }> {
  const wallet = await (prisma as any).wallet.findUnique({
    where: { ownerType_ownerId_currency: { ownerType: "PROMOTER", ownerId: accountId, currency: "ZAR" } },
    select: { availableBalance: true, pendingBalance: true, lockedBalance: true, currency: true, status: true },
  });
  return wallet ?? null;
}

export async function getPromoterOverviewSummary(accountId: string): Promise<{ pendingQualificationCount: number; activeCodeCount: number; heldEarnings: unknown; pendingWithdrawalCount: number }> {
  const [pendingQualificationCount, activeCodeCount, heldEarnings, pendingWithdrawalCount] = await Promise.all([
    (prisma as any).promoterQualification.count({ where: { attribution: { promoterAccountId: accountId }, status: { in: ["PENDING", "EVIDENCE_OBSERVED", "QUALIFIED_HELD", "RELEASABLE"] } } }),
    (prisma as any).promoterReferralCode.count({ where: { promoterAccountId: accountId, status: "ACTIVE" } }),
    (prisma as any).promoterEarning.aggregate({ where: { promoterAccountId: accountId, status: "ACCRUED_HELD" }, _sum: { grossAmount: true } }),
    (prisma as any).withdrawalRequest.count({ where: { ownerType: "PROMOTER", ownerId: accountId, status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"] } } }),
  ]);
  return { pendingQualificationCount, activeCodeCount, heldEarnings: heldEarnings._sum.grossAmount ?? "0", pendingWithdrawalCount };
}

export async function getPromoterReferralCodes(accountId: string): Promise<Array<{ id: string; publicReference: string; maskedDisplay: string; status: string; startsAt: Date | null; expiresAt: Date | null; createdAt: Date; channelName: string | null }>> {
  const rows = await (prisma as any).promoterReferralCode.findMany({
    where: { promoterAccountId: accountId },
    select: { publicReference: true, maskedDisplay: true, status: true, startsAt: true, expiresAt: true, createdAt: true, channel: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return rows.map((row: DbRow) => ({ id: row.publicReference, publicReference: row.publicReference, maskedDisplay: row.maskedDisplay, status: row.status, startsAt: row.startsAt ?? null, expiresAt: row.expiresAt ?? null, createdAt: row.createdAt, channelName: row.channel?.name ?? null }));
}

export async function getPromoterProgramRecords(accountId: string): Promise<Array<{ id: string; publicReference: string; name: string; targetType: string; status: string; enrollmentStatus: string | null; startsAt: Date; endsAt: Date | null }>> {
  const rows = await (prisma as any).promoterProgramVersion.findMany({
    where: { status: "ACTIVE", program: { status: "ACTIVE" } },
    select: { publicReference: true, status: true, startsAt: true, endsAt: true, program: { select: { name: true, targetType: true } }, enrollments: { where: { promoterAccountId: accountId }, select: { status: true }, take: 1 } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return rows.map((row: DbRow) => ({ id: row.publicReference, publicReference: row.publicReference, name: row.program.name, targetType: row.program.targetType, status: row.status, enrollmentStatus: row.enrollments[0]?.status ?? null, startsAt: row.startsAt, endsAt: row.endsAt ?? null }));
}

export async function getPromoterProgramRecord(accountId: string, reference: string) {
  return (await getPromoterProgramRecords(accountId)).find((program) => program.publicReference === reference) ?? null;
}

export async function getPromoterAssets(): Promise<Array<{ id: string; publicReference: string; title: string; description: string | null; status: string; requiredDisclosure: string; approvedAt: Date | null }>> {
  const rows = await (prisma as any).promoterMarketingAsset.findMany({
    where: { status: { in: ["APPROVED", "ACTIVE"] } },
    select: { publicReference: true, title: true, description: true, status: true, requiredDisclosure: true, approvedAt: true },
    orderBy: [{ approvedAt: "desc" }, { id: "asc" }],
  });
  return rows.map((row: DbRow) => ({ id: row.publicReference, publicReference: row.publicReference, title: row.title, description: row.description ?? null, status: row.status, requiredDisclosure: row.requiredDisclosure, approvedAt: row.approvedAt ?? null }));
}

export async function getPromoterDisputes(accountId: string): Promise<Array<{ id: string; publicReference: string; category: string; status: string; safeResolution: string | null; createdAt: Date; updatedAt: Date }>> {
  const rows = await (prisma as any).promoterDispute.findMany({
    where: { promoterAccountId: accountId },
    select: { publicReference: true, category: true, status: true, safeResolution: true, createdAt: true, updatedAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return rows.map((row: DbRow) => ({ id: row.publicReference, publicReference: row.publicReference, category: row.category, status: row.status, safeResolution: row.safeResolution ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt }));
}

export async function getPromoterDispute(accountId: string, reference: string) {
  return (await getPromoterDisputes(accountId)).find((dispute) => dispute.publicReference === reference) ?? null;
}

export async function getPromoterNotifications(userId: string): Promise<Array<{ id: string; title: string; body: string; state: string; createdAt: Date; actionRoute: string | null }>> {
  const rows = await (prisma as any).notificationInboxItem.findMany({
    where: { ownerUserId: userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { publicReference: true, title: true, body: true, state: true, createdAt: true, actionRoute: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 50,
  });
  return rows.map((row: DbRow) => ({ id: row.publicReference, title: row.title, body: row.body, state: row.state, createdAt: row.createdAt, actionRoute: row.actionRoute ?? null }));
}
