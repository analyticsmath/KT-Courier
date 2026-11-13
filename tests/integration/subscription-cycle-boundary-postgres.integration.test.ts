import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createPrismaSubscriptionRenewalLifecycleRepository } from "@/lib/subscriptions/subscription-renewal-lifecycle.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
vi.mock("@/lib/subscriptions/production-lock", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/subscriptions/production-lock")>()), assertSubscriptionsProductionReady: vi.fn() }));
import { runSubscriptionRenewalBatch } from "@/lib/subscriptions/subscription-renewal-batch";

const marker = `subscription-cycle-${randomUUID()}`;
let userId = "", programId = "", planId = "", contractId = "";
let validated = false;
beforeAll(async () => {
  requireDisposableStoreSettlementDatabase(); validated = true;
  const user = await prisma.user.create({ data: { email: `${marker}@example.test`, role: "CUSTOMER", status: "ACTIVE" } }); userId = user.id;
  const program = await prisma.subscriptionProgram.create({ data: { publicReference: marker, code: marker, subjectType: "CUSTOMER", name: "Disposable" } }); programId = program.id;
  const plan = await prisma.subscriptionPlanVersion.create({ data: { publicReference: `${marker}-plan`, programId, versionNumber: 1, displayName: "Disposable", shortDescription: "Disposable", fullDescription: "Disposable", contractTermType: "ROLLING_MONTH_TO_MONTH", priceAmount: 10, taxTreatment: "NONE", cancellationPolicyVersion: "v1", renewalPolicyVersion: "v1", dunningPolicyVersion: "v1", entitlementPolicyVersion: "v1", legalDocumentVersion: "v1" } }); planId = plan.id;
  const contract = await prisma.subscriptionContract.create({ data: { publicReference: `${marker}-contract`, programId, planVersionId: planId, subjectType: "CUSTOMER", customerUserId: userId, payerUserId: userId, status: "ACTIVE", contractTermType: "ROLLING_MONTH_TO_MONTH", contractedPrice: 10, taxTreatment: "NONE", commercialFingerprint: marker, termSnapshot: {} } }); contractId = contract.id;
  const cycle = await prisma.subscriptionBillingCycle.create({ data: { publicReference: `${marker}-cycle`, contractId, cycleNumber: 1, periodStart: new Date("2030-02-01"), periodEnd: new Date("2030-03-01"), billingDate: new Date("2030-02-01"), amountDue: 10 } });
  await prisma.subscriptionInvoice.create({ data: { publicReference: `${marker}-invoice`, invoiceNumber: marker, contractId, billingCycleId: cycle.id, payerUserId: userId, subtotal: 10, total: 10, planSnapshot: {}, benefitSnapshot: {}, supplierSnapshot: {}, legalDocumentVersion: "v1", dueAt: cycle.billingDate } });
});
afterAll(async () => {
  if (!validated) return;
  // The disposable database is destroyed by the runner; contractual evidence is append-only.
  await prisma.$disconnect();
});

it("does not create successive future invoices across repeated runs", async () => {
  const repository = createPrismaSubscriptionRenewalLifecycleRepository();
  const input = { contractReference: `${marker}-contract`, operationId: "disposable", at: new Date("2030-01-15") };
  expect((await repository.createNextCycle(input)).outcome).toBe("NOT_DUE");
  expect((await repository.createNextCycle(input)).outcome).toBe("NOT_DUE");
  expect(await prisma.subscriptionBillingCycle.count({ where: { contractId } })).toBe(1);
  expect(await prisma.subscriptionInvoice.count({ where: { contractId } })).toBe(1);
});

it("does not prepare a payment without active provider authority", async () => {
  const authority = await prisma.subscriptionPaymentAuthority.create({ data: { publicReference: `${marker}-authority`, contractId, provider: "PAYSTACK", mode: "PROVIDER_MANAGED_SUBSCRIPTION", status: "PENDING" } });
  const repository = createPrismaSubscriptionRenewalLifecycleRepository();
  expect((await repository.prepareRenewal({ billingCycleReference: `${marker}-cycle`, operationId: `${marker}-prepare` })).outcome).toBe("RECONCILIATION_REQUIRED");
  const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { publicReference: `${marker}-invoice` } });
  expect(await prisma.payment.count({ where: { subscriptionInvoiceId: invoice.id } })).toBe(0);
  await prisma.subscriptionPaymentAuthority.update({ where: { id: authority.id }, data: { status: "CANCELLED" } });
  expect((await repository.prepareRenewal({ billingCycleReference: `${marker}-cycle`, operationId: `${marker}-prepare` })).outcome).toBe("RECONCILIATION_REQUIRED");
  expect(await prisma.payment.count({ where: { subscriptionInvoiceId: invoice.id } })).toBe(0);
  await prisma.subscriptionPaymentAuthority.update({ where: { id: authority.id }, data: { status: "ACTIVE", authorisedAt: new Date() } });
  const prepared = await repository.prepareRenewal({ billingCycleReference: `${marker}-cycle`, operationId: `${marker}-prepare` });
  expect(prepared.outcome).toBe("PREPARED");
  expect((await repository.prepareRenewal({ billingCycleReference: `${marker}-cycle`, operationId: `${marker}-prepare` })).outcome).toBe("REPLAY");
  expect(await prisma.payment.count({ where: { subscriptionInvoiceId: invoice.id } })).toBe(1);
});

it("processes due cycles once and reconciles an inactive payment authority", async () => {
  const authority = await prisma.subscriptionPaymentAuthority.findUniqueOrThrow({ where: { contractId } });
  const makeCycle = async (number: number) => {
    const cycle = await prisma.subscriptionBillingCycle.create({ data: { publicReference: `${marker}-due-${number}`, contractId, cycleNumber: number, periodStart: new Date(Date.UTC(2020, number - 2, 1)), periodEnd: new Date(Date.UTC(2020, number - 1, 1)), billingDate: new Date(Date.UTC(2020, number - 2, 1)), amountDue: 10 } });
    await prisma.subscriptionInvoice.create({ data: { publicReference: `${marker}-due-invoice-${number}`, invoiceNumber: `${marker}-${number}`, contractId, billingCycleId: cycle.id, payerUserId: userId, subtotal: 10, total: 10, planSnapshot: {}, benefitSnapshot: {}, supplierSnapshot: {}, legalDocumentVersion: "v1", issuedAt: new Date("2019-12-01"), dueAt: cycle.billingDate } });
    return cycle;
  };
  await prisma.subscriptionPaymentAuthority.update({ where: { id: authority.id }, data: { status: "PAUSED" } });
  const blocked = await makeCycle(2);
  expect(await runSubscriptionRenewalBatch()).toMatchObject({ examined: 1, reconciled: 1, failed: 0 });
  expect((await prisma.subscriptionBillingCycle.findUniqueOrThrow({ where: { id: blocked.id } })).status).toBe("RECONCILIATION_REQUIRED");
  expect(await prisma.subscriptionReconciliationCase.count({ where: { billingCycleId: blocked.id, status: "OPEN" } })).toBe(1);
  await prisma.subscriptionPaymentAuthority.update({ where: { id: authority.id }, data: { status: "ACTIVE" } });
  const due = await makeCycle(3);
  const results = await Promise.all([runSubscriptionRenewalBatch(), runSubscriptionRenewalBatch()]);
  expect(results.reduce((sum, result) => sum + result.prepared, 0)).toBe(1);
  expect(results.reduce((sum, result) => sum + result.failed, 0)).toBe(0);
  expect((await prisma.subscriptionBillingCycle.findUniqueOrThrow({ where: { id: due.id } })).status).toBe("PAYMENT_PENDING");
  expect(await runSubscriptionRenewalBatch()).toMatchObject({ examined: 0, prepared: 0 });
});
