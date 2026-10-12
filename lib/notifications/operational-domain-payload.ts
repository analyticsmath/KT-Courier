import type { Prisma } from "@prisma/client";
import { NotificationPolicyError } from "./contracts";

const invalid = (): never => { throw new NotificationPolicyError("CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID"); };
type Intent = { sourceAuthority: string; eventType: string; aggregateReference: string; operationId: string; safePayload: unknown };
const statusText = (status: string) => status.replaceAll("_", " ").toLowerCase();

async function owner(db: Prisma.TransactionClient, type: "STORE" | "DRIVER", id: string) {
  const store = type === "STORE" ? await db.store.findUnique({ where: { id }, select: { ownerUserId: true, status: true } }) : null;
  const driver = type === "DRIVER" ? await db.driverProfile.findUnique({ where: { id }, select: { userId: true, status: true, active: true } }) : null;
  const userId = store?.status === "ACTIVE" ? store.ownerUserId : driver?.status === "ACTIVE" && driver.active ? driver.userId : null;
  if (!userId) return invalid();
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
  if (user?.status !== "ACTIVE" || user.role !== type) return invalid();
  return type === "STORE" ? { storeOwnerUserId: userId } : { driverUserId: userId };
}

/** No monetary mutation or browser-supplied amount, bank detail or recipient is used. */
export async function resolveOperationalDomainPayload(db: Prisma.TransactionClient, intent: Intent): Promise<Record<string, unknown>> {
  const raw = intent.safePayload && typeof intent.safePayload === "object" && !Array.isArray(intent.safePayload) ? intent.safePayload as Record<string, unknown> : {};
  const sourceId = typeof raw.sourceEventId === "string" ? raw.sourceEventId : "";
  if (!sourceId) return invalid();
  if (intent.sourceAuthority === "DISPATCH") {
    if (intent.eventType !== "DRIVER_ASSIGNMENT_STATUS_CHANGED" || intent.operationId !== `driver-assignment-notification:${sourceId}`) return invalid();
    const event = await db.orderAssignmentEvent.findUnique({ where: { id: sourceId } });
    const assignment = await db.orderAssignment.findUnique({ where: { id: intent.aggregateReference }, select: { orderId: true, driverProfileId: true, order: { select: { orderNumber: true } } } });
    if (!event?.newStatus || !assignment || event.assignmentId !== intent.aggregateReference || event.orderId !== assignment.orderId || event.driverProfileId !== assignment.driverProfileId) return invalid();
    return { ...await owner(db, "DRIVER", assignment.driverProfileId), reference: assignment.order.orderNumber, status: statusText(event.newStatus) };
  }
  if (intent.sourceAuthority === "WITHDRAWAL") {
    if (intent.operationId !== `withdrawal-status-notification:${sourceId}`) return invalid();
    const history = await db.withdrawalStatusHistory.findUnique({ where: { id: sourceId } });
    const withdrawal = await db.withdrawalRequest.findUnique({ where: { id: intent.aggregateReference }, include: { wallet: { select: { ownerType: true, ownerId: true } } } });
    if (!history || !withdrawal || history.withdrawalId !== withdrawal.id || !["STORE", "DRIVER"].includes(withdrawal.ownerType) ||
        intent.eventType !== `${withdrawal.ownerType}_WITHDRAWAL_STATUS_CHANGED` || withdrawal.wallet.ownerType !== withdrawal.ownerType || withdrawal.wallet.ownerId !== withdrawal.ownerId ||
        !withdrawal.reserveLedgerJournalId || (!history.fromStatus && history.reasonCode !== "WITHDRAWAL_REQUESTED") || history.fromStatus === history.toStatus) return invalid();
    if (history.toStatus === "PAID" && (withdrawal.status !== "PAID" || !withdrawal.completedAt || !withdrawal.payoutLedgerJournalId)) return invalid();
    return { ...await owner(db, withdrawal.ownerType as "STORE" | "DRIVER", withdrawal.ownerId), reference: withdrawal.publicReference, status: statusText(history.toStatus) };
  }
  const type = intent.sourceAuthority === "STORE_EARNINGS" ? "STORE" : intent.sourceAuthority === "DRIVER_EARNINGS" ? "DRIVER" : null;
  if (!type || intent.eventType !== `${type}_EARNING_STATUS_CHANGED` || intent.operationId !== `${type.toLowerCase()}-earning-notification:${sourceId}`) return invalid();
  const storeHistory = type === "STORE" ? await db.storeEarningStatusHistory.findUnique({ where: { id: sourceId } }) : null;
  const driverHistory = type === "DRIVER" ? await db.driverEarningStatusHistory.findUnique({ where: { id: sourceId } }) : null;
  const storeEarning = type === "STORE" ? await db.storeEarning.findUnique({ where: { id: intent.aggregateReference }, include: { wallet: { select: { ownerType: true, ownerId: true } } } }) : null;
  const driverEarning = type === "DRIVER" ? await db.driverEarning.findUnique({ where: { id: intent.aggregateReference }, include: { wallet: { select: { ownerType: true, ownerId: true } } } }) : null;
  const history = storeHistory ?? driverHistory, earning = storeEarning ?? driverEarning;
  const ownerId = storeEarning?.storeId ?? driverEarning?.driverId;
  if (!history || !earning || !ownerId || (storeHistory?.storeEarningId ?? driverHistory?.driverEarningId) !== earning.id || history.fromStatus === history.toStatus ||
      earning.wallet.ownerType !== type || earning.wallet.ownerId !== ownerId || !earning.accrualLedgerJournalId) return invalid();
  if (history.toStatus === "RELEASED" && (!earning.releaseLedgerJournalId || !earning.releasedAt)) return invalid();
  if (history.toStatus === "REVERSED" && (!earning.reversalLedgerJournalId || !earning.reversedAt)) return invalid();
  return { ...await owner(db, type, ownerId), reference: earning.publicReference, status: statusText(history.toStatus) };
}
