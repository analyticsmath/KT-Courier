import { randomUUID, createHash } from "node:crypto";
import { prisma } from "../lib/db/prisma";
import { assertDisposablePaystackAcceptance, assertDisposablePaystackEmail } from "../lib/testing/disposable-paystack-policy";
import { settleMarketplaceStoreOrder } from "../lib/marketplace-checkout/settlement.service";
import { createPrismaMarketplaceSettlementRepository } from "../lib/marketplace-checkout/prisma-marketplace-settlement.repository";
import { createStoreOrderOperationalPolicy, submitStoreOrderOperationalPolicy, approveStoreOrderOperationalPolicy, activateStoreOrderOperationalPolicy } from "../lib/store-orders/operational-policy.service";
import { initializeMarketplaceStoreOrderOperations } from "../lib/store-orders/store-order.service";
import { ensureWalletForOwner } from "../lib/services/wallet-account.service";
import { ensureStoreEarningPayableAccount } from "../lib/services/store-earning-account.service";
import { offerAssignment } from "../lib/services/dispatch-assignment.service";

// CLI-only fixture authority: the provider seam, database and synthetic
// customer are checked before any operation. No paid/settled rows are forged.
async function main() {
  assertDisposablePaystackAcceptance();
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  if (identity[0]?.database !== "kt_phase75_e2e" || identity[0]?.role !== "kt_phase75_e2e") throw new Error("Disposable PostgreSQL identity required.");
  const [reference, action = "snapshot"] = process.argv.slice(2);
  const source = await prisma.marketplaceStoreOrder.findUniqueOrThrow({ where: { publicReference: reference }, include: { marketplaceOrder: { include: { checkout: { include: { contactSnapshot: true } } } } } });
  assertDisposablePaystackEmail(source.marketplaceOrder.checkout.contactSnapshot?.email ?? "");
  if (action === "initialize") {
    await ensureWalletForOwner({ ownerType: "STORE", ownerId: source.storeId, currency: "ZAR" });
    await ensureStoreEarningPayableAccount(source.storeId);
    await settleMarketplaceStoreOrder({ marketplaceStoreOrderReference: reference, operationId: `disposable-settle-${source.id}` }, createPrismaMarketplaceSettlementRepository());
    const active = await prisma.storeOrderOperationalPolicy.findFirst({ where: { status: "ACTIVE" } });
    if (!active) {
      const checker = await prisma.user.findUniqueOrThrow({ where: { email: "disposable-checkout-reviewer@example.test" } });
      const policy = await createStoreOrderOperationalPolicy({ name: "Disposable store-order operational policy", versionNumber: 1, acceptanceWindowSeconds: 3600, customerDecisionWindowSeconds: 3600, maximumPrepMinutes: 120, maximumPrepExtensionMinutes: 60, maximumIssueCount: 10, maximumSubstitutionProposalsPerLine: 3, substitutionMode: "CUSTOMER_APPROVAL_REQUIRED", effectiveFrom: new Date("2026-01-01") });
      await submitStoreOrderOperationalPolicy(policy.publicReference);
      await approveStoreOrderOperationalPolicy({ publicReference: policy.publicReference, approvedByUserId: checker.id });
      await activateStoreOrderOperationalPolicy({ publicReference: policy.publicReference });
    }
    const operationId = `disposable-initialize-${source.id}`;
    await initializeMarketplaceStoreOrderOperations({ storeOrderReference: reference, operationId, requestHash: createHash("sha256").update(operationId).digest("hex") });
  } else if (action === "offer-handoff") {
    const contact = source.marketplaceOrder.checkout.contactSnapshot!.email;
    const suffix = /^e2e-paystack-(store-handoff-(?:1440|390)|pg-store-handoff|driver-delivery-(?:1440|390|pg))@ktcouriers\.local$/.exec(contact)?.[1];
    if (!suffix) throw new Error("Handoff offers require an independently owned custody fixture namespace.");
    const bridge = await prisma.marketplaceStoreOrderDeliveryBridge.findUniqueOrThrow({ where: { marketplaceStoreOrderId: source.id } });
    if (!bridge.courierOrderId) throw new Error("Canonical courier bridge must exist before dispatch.");
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" } });
    const driver = await prisma.driverProfile.findFirstOrThrow({ where: { user: { email: `e2e-handoff-driver-${suffix}@ktcouriers.local` } } });
    await offerAssignment(admin.id, bridge.courierOrderId, { driverProfileId: driver.id, reasonCode: "DISPOSABLE_TWO_PARTY_CUSTODY" });
  } else if (["deny-employee-review", "allow-employee-review"].includes(action)) {
    const width = /^e2e-paystack-store-merchant-(1440|390)@ktcouriers\.local$/.exec(source.marketplaceOrder.checkout.contactSnapshot!.email)?.[1];
    if (!width) throw new Error("Independent merchant employee namespace required.");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: `e2e-order-employee-${width}@ktcouriers.local` } });
    await prisma.storeEmployeeMembership.findFirstOrThrow({ where: { userId: user.id, storeId: source.storeId, status: "ACTIVE" } });
    const permission = await prisma.permission.findUniqueOrThrow({ where: { key: "store_orders.review" } });
    if (action === "deny-employee-review") await prisma.userPermission.upsert({ where: { userId_permissionId: { userId: user.id, permissionId: permission.id } }, create: { userId: user.id, permissionId: permission.id, effect: "DENY" }, update: { effect: "DENY" } });
    else await prisma.userPermission.deleteMany({ where: { userId: user.id, permissionId: permission.id } });
  } else if (action === "expire-review") {
    // Only time is advanced on namespace-owned operational evidence. Money,
    // payment verification, settlement and inventory are never patched.
    await prisma.marketplaceStoreOrder.update({ where: { id: source.id }, data: { reviewDeadlineAt: new Date(0) } });
  } else if (action !== "snapshot") throw new Error(`Unsupported control action ${action}:${randomUUID()}`);
  const row = await prisma.marketplaceStoreOrder.findUniqueOrThrow({ where: { id: source.id }, include: { lines: { include: { fulfilment: true, issues: true } }, operations: true, history: true, cancellationRequests: true, adjustments: true, substitutions: { include: { reservation: true } }, reconciliation: true, settlementSnapshots: true, marketplaceOrder: { include: { payment: true } } } });
  const bridge = await prisma.marketplaceStoreOrderDeliveryBridge.findUnique({ where: { marketplaceStoreOrderId: row.id }, include: { courierOrder: { select: { status: true, assignments: { where: { status: { in: ["ASSIGNED", "ACCEPTED"] } }, select: { id: true, version: true, status: true } } } } } });
  console.log(`STORE_ORDER_CUSTODY ${JSON.stringify({ courierOrderId: bridge?.courierOrderId ?? null, courierStatus: bridge?.courierOrder?.status ?? null, assignment: bridge?.courierOrder?.assignments[0] ?? null })}`);
  const stock = await prisma.catalogInventoryLevel.findMany({ where: { inventoryItem: { offer: { storeId: row.storeId } } }, select: { onHand: true, reserved: true, available: true }, orderBy: { id: "asc" } });
  console.log(`STORE_ORDER_SNAPSHOT ${JSON.stringify({ reference: row.publicReference, status: row.status, acceptanceStatus: row.acceptanceStatus, preparationStatus: row.preparationStatus, resolutionStatus: row.resolutionStatus, financialResolutionStatus: row.financialResolutionStatus, deliveryBridgeStatus: row.deliveryBridgeStatus, lines: row.lines.map(line => ({ id: line.id, quantity: line.quantity, fulfilment: line.fulfilment && { status: line.fulfilment.status, substitutionPreference: line.fulfilment.substitutionPreference, confirmedAvailableQuantity: line.fulfilment.confirmedAvailableQuantity, resolvedFulfilmentQuantity: line.fulfilment.resolvedFulfilmentQuantity }, issues: line.issues.map(issue => ({ publicReference: issue.publicReference, status: issue.status })) })), operations: row.operations.map(operation => ({ operationId: operation.operationId, operationType: operation.operationType })), history: row.history.map(event => ({ operationId: event.operationId, eventType: event.eventType })), cancellations: row.cancellationRequests.map(request => ({ status: request.status, operationId: request.operationId })), adjustments: row.adjustments.map(adjustment => ({ publicReference: adjustment.publicReference, status: adjustment.status, refundAmount: adjustment.refundAmount, financialEvidence: adjustment.financialEvidence })), proposals: row.substitutions.map(proposal => ({ publicReference: proposal.publicReference, status: proposal.status, customerCharge: proposal.customerCharge, reservation: proposal.reservation && { status: proposal.reservation.status } })), reconciliation: row.reconciliation.map(item => ({ reasonCode: item.reasonCode, status: item.status })), settlement: row.settlementSnapshots.map(item => ({ status: item.status, commissionAccrualReference: item.commissionAccrualReference, storeEarningReference: item.storeEarningReference })), payment: { status: row.marketplaceOrder.payment.status, totalRefundedAmount: row.marketplaceOrder.payment.totalRefundedAmount, totalRefundReservedAmount: row.marketplaceOrder.payment.totalRefundReservedAmount }, journalCount: await prisma.ledgerJournal.count({ where: { correlationId: row.marketplaceOrder.payment.publicReference } }), stock })}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
