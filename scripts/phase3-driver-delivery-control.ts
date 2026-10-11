import { prisma } from "../lib/db/prisma";
import { assertDisposablePaystackAcceptance, assertDisposablePaystackEmail } from "../lib/testing/disposable-paystack-policy";
import { openSecurityPayload } from "../lib/notifications/security-payload-vault";

async function main() {
  assertDisposablePaystackAcceptance();
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  if (identity[0]?.database !== "kt_phase75_e2e" || identity[0]?.role !== "kt_phase75_e2e") throw new Error("Named disposable database required.");
  const [reference, action = "snapshot"] = process.argv.slice(2);
  const store = await prisma.marketplaceStoreOrder.findUniqueOrThrow({ where: { publicReference: reference }, include: { marketplaceOrder: { include: { checkout: { include: { contactSnapshot: true } } } }, deliveryBridge: true } });
  assertDisposablePaystackEmail(store.marketplaceOrder.checkout.contactSnapshot?.email ?? "");
  if (!store.deliveryBridge?.courierOrderId) throw new Error("Canonical courier bridge required.");
  const order = await prisma.order.findUniqueOrThrow({ where: { id: store.deliveryBridge.courierOrderId }, include: { assignments: { orderBy: { createdAt: "desc" }, take: 1 }, dropoffAddress: true, proofOfDelivery: true, deliveryAttempts: true, deliveryOtps: { orderBy: { createdAt: "desc" } } } });
  if (action === "otp") {
    const otp = order.deliveryOtps.find(row => !row.consumedAt && row.expiresAt > new Date());
    if (!otp) throw new Error("Active canonical OTP required.");
    const intent = await prisma.notificationEventIntent.findFirstOrThrow({ where: { aggregateReference: order.id, eventType: "DELIVERY_OTP" }, orderBy: { createdAt: "desc" } });
    const secret = await prisma.notificationSecurePayload.findUniqueOrThrow({ where: { eventIntentId: intent.id } });
    if (!secret.expiresAt || secret.expiresAt <= new Date()) throw new Error("Encrypted OTP outbox expired.");
    console.log(`DISPOSABLE_DELIVERY_OTP ${JSON.stringify({ code: openSecurityPayload(secret.encryptedPayload, intent.operationId).otp })}`);
    return;
  }
  if (action !== "snapshot") throw new Error("Unsupported driver control action.");
  const assignment = order.assignments[0];
  const proof = assignment ? await prisma.deliveryProofEvidence.findMany({ where: { assignmentId: assignment.id }, select: { publicReference: true, status: true, usedAt: true, privateVisibility: true, contentType: true, byteSize: true } }) : [];
  const commands = assignment ? await prisma.driverOperationCommand.findMany({ where: { assignmentId: assignment.id }, select: { operationId: true, type: true, completedAt: true } }) : [];
  console.log(`DRIVER_DELIVERY_SNAPSHOT ${JSON.stringify({ evidenceClass: "DISPOSABLE_SYNTHETIC_NOT_ON_ROAD_ACCEPTANCE", order: { id: order.id, status: order.status, currentDriverProfileId: order.currentDriverProfileId }, assignment: assignment && { id: assignment.id, version: assignment.version, status: assignment.status, driverProfileId: assignment.driverProfileId }, syntheticDestination: order.dropoffAddress && { latitude: order.dropoffAddress.latitude, longitude: order.dropoffAddress.longitude }, pod: order.proofOfDelivery && { id: order.proofOfDelivery.id, method: order.proofOfDelivery.method, evidenceReference: order.proofOfDelivery.evidenceReference }, proof, commands, attempts: order.deliveryAttempts.map(row => ({ id: row.id, attemptNumber: row.attemptNumber, reason: row.reason, retryable: row.retryable })), otps: order.deliveryOtps.map(row => ({ id: row.id, attempts: row.attempts, consumed: Boolean(row.consumedAt), invalidated: Boolean(row.invalidatedAt) })), locations: assignment ? await prisma.driverLocationEvidence.count({ where: { assignmentId: assignment.id } }) : 0, redeliveries: await prisma.redeliveryRequest.findMany({ where: { orderId: order.id }, select: { publicReference: true, status: true, commercialEvidence: true } }) })}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
