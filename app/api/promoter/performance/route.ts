import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterRead } from "@/lib/promoters/api-policy";
import { db, promoterJson } from "@/lib/promoters/route-support";

type PromoterEarningAggregate = {
  status: string;
  _sum: { grossAmount: unknown };
  _count: { _all: number };
};

function isPromoterEarningAggregate(value: unknown): value is PromoterEarningAggregate {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.status === "string" &&
    Boolean(row._sum && typeof row._sum === "object") &&
    Boolean(row._count && typeof row._count === "object")
  );
}

export async function GET(request: NextRequest) {
  const auth = await requirePromoterRead(
    PERMISSIONS.PROMOTER_PERFORMANCE_READ_OWN,
    request,
    "/api/promoter/performance"
  );
  if ("response" in auth) return auth.response;

  const groupedEarningsPromise: Promise<unknown> = db.promoterEarning.groupBy({
    by: ["status"],
    where: { promoterAccountId: auth.account.id },
    _sum: { grossAmount: true },
    _count: { _all: true },
  });
  const [visits, validTouches, attributedSubjects, pendingQualifications, qualifiedConversions, groupedEarnings] = await Promise.all([
    db.promoterTouch.count({ where: { promoterAccountId: auth.account.id } }),
    db.promoterTouch.count({ where: { promoterAccountId: auth.account.id, validityStatus: "VALID" } }),
    db.promoterAttribution.count({ where: { promoterAccountId: auth.account.id } }),
    db.promoterQualification.count({ where: { attribution: { promoterAccountId: auth.account.id }, status: { in: ["PENDING", "EVIDENCE_OBSERVED"] } } }),
    db.promoterQualification.count({ where: { attribution: { promoterAccountId: auth.account.id }, status: { in: ["QUALIFIED_HELD", "RELEASABLE", "RELEASED"] } } }),
    groupedEarningsPromise,
  ]);
  const earnings = Array.isArray(groupedEarnings) && groupedEarnings.every(isPromoterEarningAggregate)
    ? groupedEarnings
    : [];

  return promoterJson({
    performance: {
      visits,
      validTouches,
      attributedSubjects,
      pendingQualifications,
      qualifiedConversions,
      heldEarnings: earnings.filter((earning) => earning.status === "ACCRUED_HELD"),
      payableEarnings: earnings.filter((earning) => earning.status === "PAYABLE"),
      withdrawnEarnings: earnings.filter((earning) => earning.status === "WITHDRAWN"),
      reversedEarnings: earnings.filter((earning) => ["REVERSED", "PARTIALLY_REVERSED"].includes(earning.status)),
      earnings,
    },
  });
}
