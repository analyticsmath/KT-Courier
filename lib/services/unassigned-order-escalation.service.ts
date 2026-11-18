import { prisma } from "@/lib/db/prisma";
import { dispatchAdminAlertsForEvent } from "@/lib/notifications/admin-alert-dispatch.service";
import { listCourierPaymentReadiness } from "./courier-payment-readiness.service";

const DEFAULT_THRESHOLD_MINUTES = 15;
const ESCALATION_WINDOW_MS = 30 * 60 * 1000;

export function resolveUnassignedOrderEscalationMinutes(): number {
  const raw = process.env.UNASSIGNED_ORDER_ESCALATION_MINUTES?.trim();
  if (!raw) return DEFAULT_THRESHOLD_MINUTES;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1440) {
    return DEFAULT_THRESHOLD_MINUTES;
  }
  return parsed;
}

export type UnassignedOrderEscalationScanResult = Readonly<{
  itemsExamined: number;
  itemsEligible: number;
  itemsClaimed: number;
  itemsCompleted: number;
  itemsSkipped: number;
  itemsRetried: number;
  itemsReconciled: number;
  escalatedCount: number;
  safeSummary: string;
}>;

/**
 * Escalates confirmed/dispatch-ready orders that remain without an active
 * driver assignment past the threshold SLA. Only payment-ready orders
 * (`listCourierPaymentReadiness(...).dispatchEligible`) and approved
 * marketplace-ready orders are escalated, using bounded 30-minute idempotent
 * alert windows with zero customer PII.
 */
export async function scanUnassignedCourierOrdersBatch(input?: {
  mode?: "DRY_RUN" | "APPLY";
  batchSize?: number;
  now?: Date;
  thresholdMinutes?: number;
}): Promise<UnassignedOrderEscalationScanResult> {
  const mode = input?.mode ?? "APPLY";
  const now = input?.now ?? new Date();
  const limit = Math.min(Math.max(input?.batchSize ?? 100, 1), 500);
  const thresholdMinutes =
    input?.thresholdMinutes ?? resolveUnassignedOrderEscalationMinutes();
  const cutoff = new Date(now.getTime() - thresholdMinutes * 60 * 1000);

  const candidates = await prisma.order.findMany({
    where: {
      status: { in: ["CONFIRMED", "PICKUP_SCHEDULED"] },
      currentDriverProfileId: null,
      updatedAt: { lte: cutoff },
      assignments: {
        none: {
          status: { in: ["ASSIGNED", "ACCEPTED"] },
          OR: [
            { status: "ACCEPTED" },
            { status: "ASSIGNED", expiresAt: { gt: now } },
            { status: "ASSIGNED", expiresAt: null },
          ],
        },
      },
      OR: [
        { marketplaceStoreOrderBridge: null },
        {
          marketplaceStoreOrderBridge: {
            is: {
              storeOrder: {
                acceptanceStatus: "ACCEPTED",
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      marketplaceStoreOrderBridge: { select: { id: true } },
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  if (candidates.length === 0) {
    return {
      itemsExamined: 0,
      itemsEligible: 0,
      itemsClaimed: 0,
      itemsCompleted: 0,
      itemsSkipped: 0,
      itemsRetried: 0,
      itemsReconciled: 0,
      escalatedCount: 0,
      safeSummary: "No stalled unassigned courier orders found.",
    };
  }

  const readinessMap = await listCourierPaymentReadiness(
    candidates.map((order) => order.id),
  );
  const readyCandidates = candidates.filter(
    (order) => readinessMap.get(order.id)?.dispatchEligible === true,
  );

  if (mode === "DRY_RUN" || readyCandidates.length === 0) {
    return {
      itemsExamined: candidates.length,
      itemsEligible: readyCandidates.length,
      itemsClaimed: 0,
      itemsCompleted: 0,
      itemsSkipped: candidates.length,
      itemsRetried: 0,
      itemsReconciled: 0,
      escalatedCount: 0,
      safeSummary:
        mode === "DRY_RUN"
          ? `[DRY_RUN] Examined ${candidates.length} unassigned candidate(s); ${readyCandidates.length} payment-ready for escalation.`
          : `Examined ${candidates.length} unassigned order(s); 0 payment-ready for escalation.`,
    };
  }

  const windowBucket = Math.floor(now.getTime() / ESCALATION_WINDOW_MS);
  let escalatedCount = 0;

  for (const order of readyCandidates) {
    const minutesUnassigned = Math.max(
      thresholdMinutes,
      Math.floor((now.getTime() - order.updatedAt.getTime()) / 60_000),
    );
    const domainLabel = order.marketplaceStoreOrderBridge
      ? "Marketplace delivery"
      : "Parcel order";

    await dispatchAdminAlertsForEvent({
      eventType: "UNASSIGNED_ORDER_ESCALATED",
      aggregateReference: `unassigned-order:${order.id}:w${windowBucket}`,
      adminPath: "/admin/dispatch",
      relatedOrderId: order.id,
      title: `Unassigned order SLA alert (${order.orderNumber} · ${minutesUnassigned}m)`,
      summary: `${domainLabel} ${order.orderNumber} (${order.status}) has remained unassigned for ${minutesUnassigned} minute(s). Assign a driver in dispatch.`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        orderDomain: order.marketplaceStoreOrderBridge ? "MARKETPLACE" : "PARCEL",
        minutesUnassigned,
        thresholdMinutes,
        windowBucket,
      },
    });
    escalatedCount += 1;
  }

  return {
    itemsExamined: candidates.length,
    itemsEligible: readyCandidates.length,
    itemsClaimed: readyCandidates.length,
    itemsCompleted: escalatedCount,
    itemsSkipped: candidates.length - readyCandidates.length,
    itemsRetried: 0,
    itemsReconciled: 0,
    escalatedCount,
    safeSummary: `Escalated ${escalatedCount} payment-ready unassigned courier order(s) beyond ${thresholdMinutes} minute(s).`,
  };
}
