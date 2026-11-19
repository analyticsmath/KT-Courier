/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  processResendWebhook,
  recoverPendingResendWebhooks,
  ResendWebhookError,
  verifyResendSvixSignature,
} from "@/lib/notifications/resend-webhook.service";

const testSecret = "whsec_" + Buffer.from("test-secret-key-1234567890123456").toString("base64");

function signPayload(svixId: string, timestamp: string, body: string, secret = testSecret): string {
  const rawKey = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const keyBytes = Buffer.from(rawKey, "base64");
  const sig = createHmac("sha256", keyBytes)
    .update(`${svixId}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${sig}`;
}

function createMockDatabase() {
  const auditEvents = new Map<string, any>();
  const deliveries = new Map<string, any>();
  const providerReceipts = new Map<string, any>();
  const intents = new Map<string, any>();
  const reconciliationCases = new Map<string, any>();

  const db: any = {
    notificationAuditEvent: {
      findUnique: vi.fn(async ({ where }: { where: { publicReference: string } }) => {
        return auditEvents.get(where.publicReference) ?? null;
      }),
      findMany: vi.fn(async ({ where }: { where?: any } = {}) => {
        let results = Array.from(auditEvents.values());
        if (where?.eventType?.in) {
          results = results.filter((r) => where.eventType.in.includes(r.eventType));
        }
        return results;
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        if (auditEvents.has(data.publicReference)) {
          const err = new Error("Unique constraint failed");
          (err as any).code = "P2002";
          throw err;
        }
        const row = { id: "aud_" + randomBytes(4).toString("hex"), createdAt: new Date(), ...data };
        auditEvents.set(data.publicReference, row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: any; data: any }) => {
        const row = auditEvents.get(where.publicReference);
        if (!row) return { count: 0 };
        if (where.eventType && row.eventType !== where.eventType) return { count: 0 };
        if (where.safeEvidence?.path && row.safeEvidence?.[where.safeEvidence.path[0]] !== where.safeEvidence.equals) return { count: 0 };
        if (where.safeEvidence?.equals && !where.safeEvidence?.path && JSON.stringify(row.safeEvidence) !== JSON.stringify(where.safeEvidence.equals)) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    notificationDelivery: {
      findMany: vi.fn(async ({ where }: { where: any }) => {
        return Array.from(deliveries.values()).filter(
          (d) =>
            (!where.channel || d.channel === where.channel) &&
            (!where.provider || d.provider === where.provider) &&
            (!where.providerMessageReference || d.providerMessageReference === where.providerMessageReference),
        );
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const d = deliveries.get(where.id);
        if (!d) throw new Error("Delivery not found: " + where.id);
        return d;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const d = deliveries.get(where.id);
        if (d) Object.assign(d, data);
        return d;
      }),
    },
    notificationProviderReceipt: {
      findUnique: vi.fn(async ({ where }: { where: any }) => {
        const key = `${where.provider_providerReceiptId.provider}:${where.provider_providerReceiptId.providerReceiptId}`;
        return providerReceipts.get(key) ?? null;
      }),
      upsert: vi.fn(async ({ where, create }: { where: any; create: any }) => {
        const key = `${where.provider_providerReceiptId.provider}:${where.provider_providerReceiptId.providerReceiptId}`;
        const existing = providerReceipts.get(key);
        if (existing) return existing;
        const npr = { id: "npr_" + randomBytes(4).toString("hex"), ...create };
        providerReceipts.set(key, npr);
        return npr;
      }),
    },
    notificationEventIntent: {
      findMany: vi.fn(async ({ where }: { where: any }) => {
        const ref = where?.safePayload?.equals;
        return Array.from(intents.values()).filter((i) => {
          if (where?.sourceAuthority && i.sourceAuthority !== where.sourceAuthority) return false;
          if (ref && i.safePayload?.providerMessageReference !== ref) return false;
          return true;
        });
      }),
      update: vi.fn(async ({ where, data }: { where: { id?: string; operationId?: string }; data: any }) => {
        const item = Array.from(intents.values()).find(
          (i) => (where.id && i.id === where.id) || (where.operationId && i.operationId === where.operationId),
        );
        if (item) Object.assign(item, data);
        return item;
      }),
    },
    emailLog: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async ({ data }) => data),
    },
    notificationReconciliationCase: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = where.publicReference;
        const existing = reconciliationCases.get(key);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = { id: "rec_" + randomBytes(4).toString("hex"), ...create };
        reconciliationCases.set(key, created);
        return created;
      }),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (ops: any) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      if (typeof ops === "function") return ops(db);
      return ops;
    }),
  };

  return {
    db,
    auditEvents,
    deliveries,
    providerReceipts,
    intents,
    reconciliationCases,
  };
}

describe("Resend webhook inbox durability, recoverability, and idempotency", () => {
  it("(a) recovers safely after crash following inbox insert before customer fanout", async () => {
    const { db, deliveries } = createMockDatabase();
    deliveries.set("del_1", {
      id: "del_1",
      channel: "EMAIL",
      provider: "RESEND_EMAIL",
      providerMessageReference: "re_crash_a",
      status: "PROVIDER_ACCEPTED",
    });

    const svixId = "msg_crash_a_" + Date.now();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: "re_crash_a" },
    });
    const sig = signPayload(svixId, timestamp, rawBody);

    // Inject failure on first call during customer delivery lookup
    const origFindMany = db.notificationDelivery.findMany;
    let failed = false;
    db.notificationDelivery.findMany = vi.fn(async (...args: any[]) => {
      if (!failed) {
        failed = true;
        throw new Error("Simulated worker crash before customer fanout");
      }
      return origFindMany.apply(db.notificationDelivery, args);
    });

    // Attempt 1 fails
    await expect(
      processResendWebhook({
        rawBody,
        svixId,
        svixTimestamp: timestamp,
        svixSignature: sig,
        secret: testSecret,
        db,
      }),
    ).rejects.toThrow("Simulated worker crash before customer fanout");

    // Attempt 2 succeeds: does not treat as replayed/completed; applies delivery
    const outcome = await processResendWebhook({
      rawBody,
      svixId,
      svixTimestamp: timestamp,
      svixSignature: sig,
      secret: testSecret,
      db,
    });

    expect(outcome.replayed).toBe(false);
    expect(outcome.customerDeliveriesUpdated).toBe(1);
    expect(deliveries.get("del_1")?.status).toBe("DELIVERED");

    // Attempt 3: genuine duplicate after FULLY_APPLIED
    const dup = await processResendWebhook({
      rawBody,
      svixId,
      svixTimestamp: timestamp,
      svixSignature: sig,
      secret: testSecret,
      db,
    });
    expect(dup.replayed).toBe(true);
    expect(dup.customerDeliveriesUpdated).toBe(0);
  });

  it("(b) recovers after customer fanout before admin update without duplicating customer projection", async () => {
    const { db, deliveries, intents } = createMockDatabase();
    deliveries.set("del_cust", {
      id: "del_cust",
      channel: "EMAIL",
      provider: "RESEND_EMAIL",
      providerMessageReference: "re_crash_b",
      status: "PROVIDER_ACCEPTED",
    });
    intents.set("intent_admin", {
      id: "intent_admin",
      sourceAuthority: "ADMIN_ALERT",
      operationId: "admin-alert-delivery:intent_admin",
      safePayload: {
        providerMessageReference: "re_crash_b",
        deliveryStatus: "PROVIDER_ACCEPTED",
      },
    });

    const svixId = "msg_crash_b_" + Date.now();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: "re_crash_b" },
    });
    const sig = signPayload(svixId, timestamp, rawBody);

    // Fail during admin alert application on attempt 1 (after customer deliveries applied)
    let failAdmin = true;
    const origIntentUpdate = db.notificationEventIntent.update;
    db.notificationEventIntent.update = vi.fn(async (...args: any[]) => {
      if (failAdmin) {
        failAdmin = false;
        throw new Error("Simulated worker crash during admin alert update");
      }
      return origIntentUpdate.apply(db.notificationEventIntent, args);
    });

    await expect(
      processResendWebhook({
        rawBody,
        svixId,
        svixTimestamp: timestamp,
        svixSignature: sig,
        secret: testSecret,
        db,
      }),
    ).rejects.toThrow("Simulated worker crash during admin alert update");

    // Customer delivery was already applied in attempt 1
    expect(deliveries.get("del_cust")?.status).toBe("DELIVERED");

    // Attempt 2 recovers: does not fail on duplicate provider receipt, updates admin alert
    const outcome = await processResendWebhook({
      rawBody,
      svixId,
      svixTimestamp: timestamp,
      svixSignature: sig,
      secret: testSecret,
      db,
    });

    expect(outcome.replayed).toBe(false);
    expect(outcome.status).toBe("FULLY_APPLIED");
    expect(intents.get("intent_admin")?.safePayload?.deliveryStatus).toBe("DELIVERED");
  });

  it("(c) handles concurrent signed duplicate requests deterministically", async () => {
    const { db, deliveries } = createMockDatabase();
    deliveries.set("del_conc", {
      id: "del_conc",
      channel: "EMAIL",
      provider: "RESEND_EMAIL",
      providerMessageReference: "re_concurrent",
      status: "PROVIDER_ACCEPTED",
    });

    const svixId = "msg_conc_" + Date.now();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: "re_concurrent" },
    });
    const sig = signPayload(svixId, timestamp, rawBody);

    // Launch two concurrent requests with identical body and signature
    const [res1, res2] = await Promise.all([
      processResendWebhook({ rawBody, svixId, svixTimestamp: timestamp, svixSignature: sig, secret: testSecret, db }),
      processResendWebhook({ rawBody, svixId, svixTimestamp: timestamp, svixSignature: sig, secret: testSecret, db }),
    ]);

    // Exactly one executes initial application, the other is recognized as replayed/duplicate
    const executed = [res1, res2].filter((r) => !r.replayed);
    const replayed = [res1, res2].filter((r) => r.replayed);

    expect(executed.length).toBe(1);
    expect(replayed.length).toBe(1);
    expect(deliveries.get("del_conc")?.status).toBe("DELIVERED");
  });

  it("(d) unmatched provider ID becomes available later and reconciles cleanly", async () => {
    const { db, deliveries } = createMockDatabase();
    const emailId = "re_late_arrival_" + Date.now();
    const svixId = "msg_late_" + Date.now();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: emailId },
    });
    const sig = signPayload(svixId, timestamp, rawBody);

    // 1. Webhook arrives BEFORE local email delivery record is visible
    const initialOutcome = await processResendWebhook({
      rawBody,
      svixId,
      svixTimestamp: timestamp,
      svixSignature: sig,
      secret: testSecret,
      db,
    });

    expect(initialOutcome.replayed).toBe(false);
    expect(initialOutcome.status).toBe("UNMATCHED_PENDING");
    expect(initialOutcome.customerDeliveriesUpdated).toBe(0);

    // 2. Local delivery row appears in database
    deliveries.set("del_late", {
      id: "del_late",
      channel: "EMAIL",
      provider: "RESEND_EMAIL",
      providerMessageReference: emailId,
      status: "PROVIDER_ACCEPTED",
    });

    // 3. Background recovery processor runs when retry window is due
    const recovery = await recoverPendingResendWebhooks({ db, limit: 10, now: new Date(Date.now() + 20_000) });
    expect(recovery.reconciled).toBe(1);
    expect(deliveries.get("del_late")?.status).toBe("DELIVERED");

    // 4. Subsequent webhook check reports FULLY_APPLIED duplicate
    const check = await processResendWebhook({
      rawBody,
      svixId,
      svixTimestamp: timestamp,
      svixSignature: sig,
      secret: testSecret,
      db,
    });
    expect(check.replayed).toBe(true);
  });

  it("(e) rejects conflicting replay body with identical svix-id", async () => {
    const { db, deliveries } = createMockDatabase();
    deliveries.set("del_orig", {
      id: "del_orig",
      channel: "EMAIL",
      provider: "RESEND_EMAIL",
      providerMessageReference: "re_orig",
      status: "PROVIDER_ACCEPTED",
    });

    const svixId = "msg_conflict_" + Date.now();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body1 = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: "re_orig" },
    });
    const sig1 = signPayload(svixId, timestamp, body1);

    await processResendWebhook({
      rawBody: body1,
      svixId,
      svixTimestamp: timestamp,
      svixSignature: sig1,
      secret: testSecret,
      db,
    });

    // Conflicting body with different event type or content using the same svixId
    const body2 = JSON.stringify({
      type: "email.bounced",
      created_at: new Date().toISOString(),
      data: { email_id: "re_orig" },
    });
    const sig2 = signPayload(svixId, timestamp, body2);

    await expect(
      processResendWebhook({
        rawBody: body2,
        svixId,
        svixTimestamp: timestamp,
        svixSignature: sig2,
        secret: testSecret,
        db,
      }),
    ).rejects.toThrowError(ResendWebhookError);
  });

  it("(f) preserves terminal state precedence: out-of-order delayed/accepted does not roll back DELIVERED or BOUNCED", async () => {
    const { db, deliveries } = createMockDatabase();
    deliveries.set("del_terminal", {
      id: "del_terminal",
      channel: "EMAIL",
      provider: "RESEND_EMAIL",
      providerMessageReference: "re_terminal",
      status: "DELIVERED",
    });

    const svixId = "msg_out_of_order_" + Date.now();
    const timestamp = String(Math.floor(Date.now() / 1000));
    // An out-of-order "email.sent" (ACCEPTED) or "email.delivery_delayed" (DEFERRED)
    const rawBody = JSON.stringify({
      type: "email.sent",
      created_at: new Date().toISOString(),
      data: { email_id: "re_terminal" },
    });
    const sig = signPayload(svixId, timestamp, rawBody);

    const outcome = await processResendWebhook({
      rawBody,
      svixId,
      svixTimestamp: timestamp,
      svixSignature: sig,
      secret: testSecret,
      db,
    });

    expect(outcome.status).toBe("FULLY_APPLIED");
    // Status must remain DELIVERED, never rolled back to PROVIDER_ACCEPTED
    expect(deliveries.get("del_terminal")?.status).toBe("DELIVERED");
  });

  it("(g) returns replayed: true on genuine duplicate after FULLY_APPLIED", async () => {
    const { db, deliveries } = createMockDatabase();
    deliveries.set("del_dup", {
      id: "del_dup",
      channel: "EMAIL",
      provider: "RESEND_EMAIL",
      providerMessageReference: "re_dup",
      status: "PROVIDER_ACCEPTED",
    });

    const svixId = "msg_dup_" + Date.now();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: "re_dup" },
    });
    const sig = signPayload(svixId, timestamp, rawBody);

    const first = await processResendWebhook({ rawBody, svixId, svixTimestamp: timestamp, svixSignature: sig, secret: testSecret, db });
    expect(first.replayed).toBe(false);
    expect(first.customerDeliveriesUpdated).toBe(1);

    const second = await processResendWebhook({ rawBody, svixId, svixTimestamp: timestamp, svixSignature: sig, secret: testSecret, db });
    expect(second.replayed).toBe(true);
    expect(second.customerDeliveriesUpdated).toBe(0);
  });

  it("(h) rejects invalid and stale signatures fail-closed", () => {
    const svixId = "msg_sig_test";
    const nowSec = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify({ type: "email.delivered", data: { email_id: "re_1" } });

    // Invalid signature
    expect(() =>
      verifyResendSvixSignature({
        rawBody,
        svixId,
        svixTimestamp: String(nowSec),
        svixSignature: "v1,invalidBase64Sig",
        secret: testSecret,
      }),
    ).toThrowError(ResendWebhookError);

    // Stale timestamp (> 300s)
    const oldSec = nowSec - 600;
    const oldSig = signPayload(svixId, String(oldSec), rawBody);
    expect(() =>
      verifyResendSvixSignature({
        rawBody,
        svixId,
        svixTimestamp: String(oldSec),
        svixSignature: oldSig,
        secret: testSecret,
      }),
    ).toThrowError(ResendWebhookError);

    // Missing signature headers
    expect(() =>
      verifyResendSvixSignature({
        rawBody,
        svixId: null,
        svixTimestamp: null,
        svixSignature: null,
        secret: testSecret,
      }),
    ).toThrowError(ResendWebhookError);
  });
});
