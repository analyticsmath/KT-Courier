import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db/prisma";
import { assertDisposablePaystackAcceptance, assertDisposablePaystackEmail } from "../lib/testing/disposable-paystack-policy";
import { prepareRequiredDomainNotifications, reviewRequiredDomainNotification } from "../lib/notifications/required-domain-configuration";
import { requiredDomainNotificationDefinitions } from "../lib/notifications/required-domain-definitions";
import { appendRequiredDomainNotificationIntents } from "../lib/notifications/required-domain-intake";
import { publishCustomerOrderIntent } from "../lib/notifications/customer-order-publication";
import { hasPermission } from "../lib/auth/permissions";
import { customerOrderReviewPermissions } from "../lib/notifications/customer-order-review";

/** CLI-only named offline composition; no HTTP runtime unlock and no delivery
 * provider. All source receipts are reconstructed from canonical paid history. */
async function main() {
  assertDisposablePaystackAcceptance();
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  if (identity[0]?.database !== "kt_phase75_e2e" || identity[0]?.role !== "kt_phase75_e2e") throw new Error("Named disposable notification database required.");
  const [action, reference] = process.argv.slice(2);
  if (action === "prepare") {
    const reviewer = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" } });
    const publisher = await prisma.user.findUniqueOrThrow({ where: { email: "e2e-editorial-reviewer@ktcouriers.local" } });
    if (reviewer.id === publisher.id || reviewer.status !== "ACTIVE" || publisher.status !== "ACTIVE" || reviewer.role !== "SUPER_ADMIN" || publisher.role !== "SUPER_ADMIN") throw new Error("Distinct independent synthetic governance actors required.");
    for (const [step, permissionKey] of Object.entries(customerOrderReviewPermissions)) {
      const actor = ["PUBLISH_TEMPLATE", "ACTIVATE_ROUTE"].includes(step) ? publisher : reviewer;
      if (!await hasPermission({ userId: actor.id, role: actor.role, permissionKey })) throw new Error("Synthetic governance actor lacks the required current permission.");
    }
    await prisma.$transaction(prepareRequiredDomainNotifications);
    for (const definition of requiredDomainNotificationDefinitions.filter(d => d.sourceAuthority !== "LEGACY_ORDER")) {
      const route = await prisma.notificationEventRoute.findUniqueOrThrow({ where: { key: definition.routeKey } });
      if (await prisma.notificationEventRouteVersion.findFirst({ where: { routeId: route.id, status: "ACTIVE" } })) continue;
      const policy = await prisma.notificationRecipientPolicyVersion.findFirstOrThrow({ where: { key: definition.recipientPolicyKey }, orderBy: { versionNumber: "desc" } });
      if (policy.status !== "APPROVED") await prisma.$transaction(tx => reviewRequiredDomainNotification(tx, definition.eventType, "APPROVE_RECIPIENT_POLICY", reviewer.id));
      for (const step of ["APPROVE_TEMPLATE", "PUBLISH_TEMPLATE", "PREPARE_ROUTE", "APPROVE_ROUTE", "ACTIVATE_ROUTE"] as const) {
        await prisma.$transaction(tx => reviewRequiredDomainNotification(tx, definition.eventType, step, ["PUBLISH_TEMPLATE", "ACTIVATE_ROUTE"].includes(step) ? publisher.id : reviewer.id));
      }
    }
    console.log("NOTIFICATION_PREPARED independent synthetic fixture review only; no live delivery enabled"); return;
  }
  if (!["consume", "snapshot"].includes(action)) throw new Error("Unsupported notification control action.");
  const checkout = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { publicReference: reference }, include: { contactSnapshot: true, marketplaceOrder: { include: { storeOrders: { select: { id: true, publicReference: true, store: { select: { ownerUserId: true } } } } } } } });
  assertDisposablePaystackEmail(checkout.contactSnapshot?.email ?? "");
  if (!/^e2e-paystack-wallet-(301440|30390)@ktcouriers\.local$/.test(checkout.contactSnapshot!.email) || !checkout.customerUserId || !checkout.marketplaceOrder) throw new Error("Independent paid notification namespace required.");
  const payment = await prisma.payment.findFirstOrThrow({ where: { marketplaceCheckoutId: checkout.id }, include: { successWebhookEvent: true } });
  if (payment.status !== "SUCCEEDED" || !payment.successLedgerJournalId || payment.successWebhookEvent?.processingStatus !== "APPLIED" || !payment.successWebhookEvent.providerDataVerified || !payment.successWebhookEvent.signatureVerified) throw new Error("Actual signed independently verified payment required.");
  const refunds = await prisma.paymentRefund.findMany({ where: { paymentId: payment.id }, select: { id: true } });
  const aggregates = [payment.publicReference, checkout.marketplaceOrder.id, ...checkout.marketplaceOrder.storeOrders.map(o => o.id), ...refunds.map(r => r.id)];
  if (action === "consume") {
    await prisma.$transaction(tx => appendRequiredDomainNotificationIntents(tx, 200));
    const intents = await prisma.notificationEventIntent.findMany({ where: { aggregateReference: { in: aggregates } }, select: { id: true }, orderBy: { createdAt: "asc" } });
    for (const intent of intents) await prisma.$transaction(async tx => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${intent.id})::bigint)`);
      await publishCustomerOrderIntent(tx, intent.id);
    }, { timeout: 15_000 });
  }
  const users = [checkout.customerUserId, ...checkout.marketplaceOrder.storeOrders.map(o => o.store.ownerUserId).filter((id): id is string => Boolean(id))];
  const receipts = await prisma.notificationSourceReceipt.findMany({ where: { aggregateReference: { in: aggregates } }, select: { id: true, sourceEventType: true, status: true } });
  const messages = await prisma.notificationMessage.findMany({ where: { recipientUserId: { in: users }, sourceReceiptId: { in: receipts.map(r => r.id) } }, select: { id: true, recipientUserId: true, sourceReceiptId: true }, orderBy: { createdAt: "asc" } });
  const evidence = await Promise.all(messages.map(async m => {
    const receipt = receipts.find(r => r.id === m.sourceReceiptId)!;
    const [deliveries, inbox] = await Promise.all([prisma.notificationDelivery.findMany({ where: { messageId: m.id }, select: { channel: true, status: true, eligibilityReason: true } }), prisma.notificationInboxItem.findUnique({ where: { messageId: m.id }, select: { publicReference: true, state: true, title: true, body: true } })]);
    return { audience: m.recipientUserId === checkout.customerUserId ? "CUSTOMER" : "STORE", eventType: receipt.sourceEventType, receiptStatus: receipt.status, deliveries, inbox };
  }));
  // No address, token, storage key or provider payload enters the receipt.
  console.log(`NOTIFICATION_SNAPSHOT ${JSON.stringify({ messages: evidence, payment: { amount: payment.amount.toFixed(2), reserved: payment.totalRefundReservedAmount.toFixed(2), refunded: payment.totalRefundedAmount.toFixed(2) } })}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
