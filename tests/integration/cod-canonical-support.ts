import { createHmac, randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertDisposablePaystackAcceptance, disposablePaystackKey } from "@/lib/testing/disposable-paystack-policy";
import { createPricingQuote } from "@/lib/services/pricing-quote.service";
import { createOrder } from "@/lib/services/orders.service";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { applyPaystackWebhookEventsBatch } from "@/lib/services/paystack-webhook-application.service";
import { offerAssignment, acceptDispatchAssignment } from "@/lib/services/dispatch-assignment.service";
import { completePickup } from "@/lib/services/pickup-custody.service";
import { startDelivery } from "@/lib/services/delivery-execution.service";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import type { AuthenticatedUser } from "@/types/domain";

export async function codBooking(page: Page, suffix: string) {
  assertDisposablePaystackAcceptance();
  expect(await prisma.$queryRaw`SELECT current_database() AS database, current_user AS role`).toEqual([{ database: "kt_phase75_e2e", role: "kt_phase75_e2e" }]);
  const seed = await prisma.user.findUniqueOrThrow({ where: { email: "e2e-store@ktcouriers.local" } });
  const user = await prisma.user.create({ data: { email: `e2e-paystack-cod-${randomUUID()}@ktcouriers.local`, name: "Disposable COD business", role: "STORE", status: "ACTIVE", emailVerifiedAt: new Date(), passwordHash: seed.passwordHash } });
  const store = await prisma.store.create({ data: { ownerUserId: user.id, name: "Disposable COD business", slug: `cod-${randomUUID()}`, status: "ACTIVE" } });
  const policy = await prisma.paymentMethodPolicy.create({ data: { storeId: store.id, orderType: "SAME_DAY", provinceScope: ["Gauteng"], versionNumber: 1, status: "ACTIVE", mode: "DEPOSIT_PLUS_COD", depositPercent: "0.5", maximumCodAmount: "10000.00", effectiveFrom: new Date("2026-01-01"), createdByUserId: user.id, policyEvidence: { fixture: "NAMED_DISPOSABLE_CONFIGURATION_ONLY_NOT_HUMAN_APPROVAL" } } });
  const address = { line1: "Synthetic courier booking", city: "Johannesburg", province: "Gauteng", country: "South Africa", latitude: -26.2041, longitude: 28.0473 };
  const input = { deliveryType: "SAME_DAY" as const, pickupAddress: address, dropoffAddress: { ...address, line1: "Synthetic courier destination", latitude: -26.2051 }, recipientName: "Disposable recipient", recipientPhone: "+27820000000", parcelCount: 1, paymentMethod: "DEPOSIT_PLUS_COD" as const };
  const quote = await createPricingQuote(user, { deliveryType: input.deliveryType, pickupAddress: input.pickupAddress, dropoffAddress: input.dropoffAddress });
  const order = await createOrder(user, { ...input, pricingQuoteId: quote.id });
  const before = await codState(order.id);
  expect(before.cod.status).toBe("PENDING"); expect(before.cod.digitalPaid.isZero()).toBe(true);
  expect(before.cod.digitalRequired.equals(new Prisma.Decimal(quote.total).mul("0.5").toDecimalPlaces(2))).toBe(true);
  expect(before.cod.digitalRequired.add(before.cod.cashObligation).toFixed(2)).toBe(quote.total);
  expect(before.cod.events.map(event => event.eventType)).toEqual(["COMMITTED"]);
  const driver = await prisma.driverProfile.findUniqueOrThrow({ where: { userId: (await prisma.user.findUniqueOrThrow({ where: { email: `e2e-handoff-driver-cod-${suffix}@ktcouriers.local` } })).id }, include: { user: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" } });
  return { user, store, policy, input, quote, order, driver, admin, before };
}

export async function verifyCodDeposit(page: Page, f: Awaited<ReturnType<typeof codBooking>>) {
  const prepared = await prepareOrderPayment(f.user, { orderId: f.order.id, idempotencyKey: randomUUID() });
  const payment = await prisma.payment.findUniqueOrThrow({ where: { publicReference: prepared.publicReference } });
  expect(payment.amount.equals(f.before.cod.digitalRequired)).toBe(true);
  await createProviderCheckoutSession(f.user, { paymentId: payment.id, provider: "PAYSTACK", idempotencyKey: randomUUID() });
  const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { paymentId: payment.id } });
  const key = disposablePaystackKey(attempt.merchantReference);
  const row = await prisma.systemSetting.findUniqueOrThrow({ where: { key } });
  const facts = row.value as { id: number; amount: number; verifyCalls: number; status: string };
  expect(facts.status).toBe("pending"); expect(facts.verifyCalls).toBe(0);
  // Provider facts are independent of the signed ingress. No canonical money,
  // payment, deposit, custody or order status is patched by this fixture.
  await prisma.systemSetting.update({ where: { key }, data: { value: { ...(row.value as object), status: "success" } } });
  const raw = JSON.stringify({ event: "charge.success", data: { id: facts.id, domain: "test", status: "success", reference: attempt.merchantReference, amount: facts.amount, currency: "ZAR" } });
  const post = () => page.request.post("/api/payments/paystack/webhook", { data: raw, headers: { "content-type": "application/json", "x-paystack-signature": createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(raw).digest("hex") } });
  expect((await post()).status()).toBe(200); await applyPaystackWebhookEventsBatch();
  const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { successLedgerJournal: { include: { entries: true } } } });
  expect(paid.status).toBe("SUCCEEDED"); expect(paid.successLedgerJournal!.totalDebits.equals(payment.amount)).toBe(true); expect(paid.successLedgerJournal!.totalCredits.equals(payment.amount)).toBe(true); expect(paid.successLedgerJournal!.entries).toHaveLength(2);
  const deposit = await codState(f.order.id); expect(deposit.cod.status).toBe("READY_FOR_COLLECTION"); expect(deposit.cod.digitalPaid.equals(deposit.cod.digitalRequired)).toBe(true); expect(deposit.cod.cashCollected.isZero()).toBe(true);
  expect(deposit.cod.events.filter(event => event.eventType === "DEPOSIT_VERIFIED")).toHaveLength(1);
  expect((await post()).status()).toBe(200); await applyPaystackWebhookEventsBatch(); expect(await codState(f.order.id)).toEqual(deposit);
  expect((await prisma.systemSetting.findUniqueOrThrow({ where: { key } })).value).toMatchObject({ verifyCalls: 1 });
  return paid;
}

export async function codTransit(f: Awaited<ReturnType<typeof codBooking>>) {
  await prisma.$transaction(tx => transitionOrderStatusInTx(tx, { orderId: f.order.id, toStatus: "CONFIRMED", actorRole: "SUPER_ADMIN", actorUserId: f.admin.id, source: "DISPOSABLE_COD_CANONICAL_BOOKING_CONFIRMATION" }));
  const offered = await offerAssignment(f.admin.id, f.order.id, { driverProfileId: f.driver.id, reasonCode: "DISPOSABLE_COD_CUSTODY" });
  const accepted = await acceptDispatchAssignment(f.driver.id, offered.id, { expectedVersion: offered.version });
  expect(await completePickup(accepted.id, f.driver.id, f.driver.userId, { operationId: randomUUID(), assignmentVersion: accepted.version, parcelCount: 1, parcelCondition: "GOOD", confirmPickup: true })).toMatchObject({ ok: true });
  const current = await prisma.orderAssignment.findUniqueOrThrow({ where: { id: accepted.id } });
  expect(await startDelivery(current.id, f.driver.id, f.driver.userId, { operationId: randomUUID(), assignmentVersion: current.version })).toMatchObject({ ok: true });
  expect((await codState(f.order.id)).order.status).toBe("IN_TRANSIT");
}

export async function codState(orderId: string) {
  const cod = await prisma.cashOnDelivery.findUniqueOrThrow({ where: { orderId }, include: { events: { orderBy: { id: "asc" } }, reconciliations: { orderBy: { id: "asc" } } } });
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, currentDriverProfileId: true } });
  const deposits = await prisma.driverCashDeposit.findMany({ where: { orderId }, orderBy: { id: "asc" } });
  const journals = await prisma.ledgerJournal.findMany({ where: { correlationId: cod.publicReference }, include: { entries: true }, orderBy: { id: "asc" } });
  return { cod, order, deposits, journals };
}

export async function codReviewer(deny = false): Promise<AuthenticatedUser> {
  const user = await prisma.user.create({ data: { email: `cod-finance-${randomUUID()}@example.test`, role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() } });
  const permission = await prisma.permission.findUniqueOrThrow({ where: { key: "cod_operations.manage" } });
  await prisma.userPermission.create({ data: { userId: user.id, permissionId: permission.id, effect: deny ? "DENY" : "ALLOW" } });
  return user;
}
