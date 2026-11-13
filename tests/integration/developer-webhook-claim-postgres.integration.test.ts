import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
vi.mock("@/lib/developer-api/production-readiness", () => ({ assertDeveloperApiProductionReady: vi.fn() }));
import { encryptWebhookSecret } from "@/lib/developer-api/crypto";
import { WebhookExecutionService } from "@/lib/developer-api/services";
import { DEVELOPER_SCOPES } from "@/lib/developer-api/contracts";
import { recoverStaleWebhookClaims } from "@/lib/developer-api/webhook-recovery";

const marker = `webhook-claim-${randomUUID()}`;
let valid = false;
let subscription: Awaited<ReturnType<typeof prisma.developerWebhookSubscription.create>>;
let event: Awaited<ReturnType<typeof prisma.developerWebhookPublicEvent.create>>;
const eventType = "za.co.ktcouriers.payment.succeeded.v1";
beforeAll(async () => {
  requireDisposableStoreSettlementDatabase(); valid = true;
  vi.stubEnv("DEVELOPER_WEBHOOK_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  const owner = await prisma.user.create({ data: { email: `${marker}@example.test`, role: "CUSTOMER", status: "ACTIVE" } });
  const application = await prisma.developerApplication.create({ data: { publicReference: `${marker}-app`, ownerUserId: owner.id, environment: "TEST", approvedEnvironment: "TEST", name: marker, businessPurpose: "Disposable test", status: "ACTIVE", approvedOwnerSnapshot: { ownerUserId: owner.id, storeId: null } } });
  await prisma.developerScopeGrant.create({ data: { publicReference: `${marker}-grant`, applicationId: application.id, version: 1, status: "ACTIVE", ownerUserId: owner.id, environment: "TEST", scopes: [DEVELOPER_SCOPES.PAYMENTS_READ], apiVersion: "v1" } });
  subscription = await prisma.developerWebhookSubscription.create({ data: { publicReference: `${marker}-sub`, applicationId: application.id, environment: "TEST", endpointFingerprint: marker, encryptedEndpoint: encryptWebhookSecret("https://example.test/hook"), maskedEndpoint: "https://example", status: "ACTIVE", verifiedAt: new Date(), eventSelection: [eventType] } });
  event = await prisma.developerWebhookPublicEvent.create({ data: { publicReference: `${marker}-event`, sourceAuthority: "test", sourceEventReference: marker, eventType, subjectReference: marker, ownerUserId: owner.id, payload: {}, payloadHash: marker, occurredAt: new Date() } });
});
afterAll(async () => { vi.unstubAllEnvs(); if (valid) await prisma.$disconnect(); });

it("claims one attempt across concurrent workers and signs a single delivery", async () => {
  const delivery = await prisma.developerWebhookDelivery.create({ data: { publicReference: `${marker}-delivery`, publicEventId: event.id, subscriptionId: subscription.id, endpointVersion: 1, secretVersion: 1 } });
  const send = vi.fn(async (input: { url: string; headers: Record<string, string>; body: Buffer; timeoutMs: number }) => { void input; return { status: 200, headers: new Headers(), body: "ok" }; });
  const service = new WebhookExecutionService(prisma, { secretForDelivery: async () => "test-secret" } as never, { send });
  const results = await Promise.allSettled([service.deliver(delivery, event, subscription), service.deliver(delivery, event, subscription)]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0].headers).toHaveProperty("signature");
  expect(await prisma.developerWebhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).toMatchObject({ status: "SUCCEEDED", attemptCount: 1 });
  expect(await prisma.developerWebhookAttempt.count({ where: { deliveryId: delivery.id, status: "SUCCEEDED" } })).toBe(1);
});

it("refuses an obsolete endpoint version before sending", async () => {
  const source = await prisma.developerWebhookPublicEvent.create({ data: { publicReference: `${marker}-event-2`, sourceAuthority: "test", sourceEventReference: `${marker}-2`, eventType, subjectReference: marker, ownerUserId: event.ownerUserId, payload: {}, payloadHash: marker, occurredAt: new Date() } });
  const delivery = await prisma.developerWebhookDelivery.create({ data: { publicReference: `${marker}-delivery-2`, publicEventId: source.id, subscriptionId: subscription.id, endpointVersion: 99, secretVersion: 1 } });
  const send = vi.fn();
  const service = new WebhookExecutionService(prisma, { secretForDelivery: async () => "test-secret" } as never, { send });
  await expect(service.deliver(delivery, source, subscription)).rejects.toMatchObject({ code: "WEBHOOK_DELIVERY_NOT_ELIGIBLE" });
  expect(send).not.toHaveBeenCalled();
  expect(await prisma.developerWebhookAttempt.count({ where: { deliveryId: delivery.id } })).toBe(0);
  await prisma.developerWebhookDelivery.update({ where: { id: delivery.id }, data: { endpointVersion: 1 } });
  await prisma.developerScopeGrant.updateMany({ where: { applicationId: subscription.applicationId }, data: { status: "RETIRED" } });
  await expect(service.deliver(delivery, source, subscription)).rejects.toMatchObject({ code: "WEBHOOK_DELIVERY_NOT_ELIGIBLE" });
  expect(send).not.toHaveBeenCalled();
  expect(await prisma.developerWebhookAttempt.count({ where: { deliveryId: delivery.id } })).toBe(0);
});

it("fences an interrupted claim once and opens review for the unknown outcome", async () => {
  const source = await prisma.developerWebhookPublicEvent.create({ data: { publicReference: `${marker}-event-3`, sourceAuthority: "test", sourceEventReference: `${marker}-3`, eventType, subjectReference: marker, ownerUserId: event.ownerUserId, payload: {}, payloadHash: marker, occurredAt: new Date() } });
  const delivery = await prisma.developerWebhookDelivery.create({ data: { publicReference: `${marker}-delivery-3`, publicEventId: source.id, subscriptionId: subscription.id, endpointVersion: 1, secretVersion: 1, status: "CLAIMED", attemptCount: 1, lastAttemptedAt: new Date("2020-01-01") } });
  await prisma.developerWebhookAttempt.create({ data: { publicReference: `${marker}-attempt-3`, deliveryId: delivery.id, attemptNumber: 1, operationId: `${marker}-attempt-3`, endpointVersion: 1, secretVersion: 1 } });
  const results = await Promise.all([recoverStaleWebhookClaims(), recoverStaleWebhookClaims()]);
  expect(results.reduce((sum, result) => sum + result.recovered, 0)).toBe(1);
  expect(await prisma.developerWebhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).toMatchObject({ status: "FAILED_PERMANENT", nextAttemptAt: null });
  expect(await prisma.developerWebhookAttempt.findFirstOrThrow({ where: { deliveryId: delivery.id } })).toMatchObject({ status: "FAILED", failureClass: null });
  expect(await prisma.developerApiReconciliationCase.count({ where: { reason: "WEBHOOK_ATTEMPT_STUCK", safeEvidence: { equals: { deliveryReference: delivery.publicReference, attemptNumber: 1 } } } })).toBe(1);
});

it("marks a previously exhausted retry terminal without sending", async () => {
  const source = await prisma.developerWebhookPublicEvent.create({ data: { publicReference: `${marker}-event-4`, sourceAuthority: "test", sourceEventReference: `${marker}-4`, eventType, subjectReference: marker, ownerUserId: event.ownerUserId, payload: {}, payloadHash: marker, occurredAt: new Date() } });
  const delivery = await prisma.developerWebhookDelivery.create({ data: { publicReference: `${marker}-delivery-4`, publicEventId: source.id, subscriptionId: subscription.id, endpointVersion: 1, secretVersion: 1, status: "FAILED_RETRYABLE", attemptCount: 12, nextAttemptAt: new Date("2020-01-01") } });
  const send = vi.fn();
  const service = new WebhookExecutionService(prisma, { secretForDelivery: async () => "test-secret" } as never, { send });
  await expect(service.deliver(delivery, source, subscription)).rejects.toMatchObject({ code: "WEBHOOK_DELIVERY_ATTEMPTS_EXHAUSTED" });
  expect((await prisma.developerWebhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe("FAILED_PERMANENT");
  expect(send).not.toHaveBeenCalled();
});
