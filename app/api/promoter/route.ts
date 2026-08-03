/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterRead } from "@/lib/promoters/api-policy";
import { db, promoterJson, safeRows } from "@/lib/promoters/route-support";

export async function GET(request: NextRequest) {
  const auth = await requirePromoterRead(PERMISSIONS.PROMOTER_PROFILE_READ_OWN, request, "/api/promoter"); if ("response" in auth) return auth.response;
  const [enrollments, earnings, touches, validTouches, attributions, qualifications, qualifiedConversions, wallet] = await Promise.all([
    db.promoterEnrollment.count({ where: { promoterAccountId: auth.account.id, status: "ACTIVE" } }),
    db.promoterEarning.groupBy({ by: ["status"], where: { promoterAccountId: auth.account.id }, _count: { _all: true } }),
    db.promoterTouch.count({ where: { promoterAccountId: auth.account.id } }),
    db.promoterTouch.count({ where: { promoterAccountId: auth.account.id, validityStatus: "VALID" } }),
    db.promoterAttribution.count({ where: { promoterAccountId: auth.account.id } }),
    db.promoterQualification.count({ where: { attribution: { promoterAccountId: auth.account.id }, status: { in: ["PENDING", "EVIDENCE_OBSERVED"] } } }),
    db.promoterQualification.count({ where: { attribution: { promoterAccountId: auth.account.id }, status: { in: ["QUALIFIED_HELD", "RELEASABLE", "RELEASED"] } } }),
    db.wallet.findUnique({ where: { ownerType_ownerId_currency: { ownerType: "PROMOTER", ownerId: auth.account.id, currency: "ZAR" } }, select: { availableBalance: true } }),
  ]);
  const byStatus = (status: string) => (earnings as any[]).find((earning) => earning.status === status) ?? { status, _count: { _all: 0 } };
  return promoterJson({ account: { ...auth.account }, metrics: { visits: touches, validTouches, attributedSubjects: attributions, pendingQualifications: qualifications, qualifiedConversions, activeEnrollments: enrollments, heldEarnings: byStatus("ACCRUED_HELD"), payableEarnings: byStatus("PAYABLE"), availableFunds: wallet?.availableBalance ?? 0, withdrawnEarnings: byStatus("WITHDRAWN"), reversedEarnings: byStatus("REVERSED"), earnings: safeRows(earnings as any) } });
}
