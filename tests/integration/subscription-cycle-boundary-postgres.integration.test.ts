import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createPrismaSubscriptionRenewalLifecycleRepository } from "@/lib/subscriptions/subscription-renewal-lifecycle.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

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
