import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { beforeAll, expect, it } from "vitest";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { processResendWebhook, recoverPendingResendWebhooks } from "@/lib/notifications/resend-webhook.service";
import { prisma } from "@/lib/db/prisma";

beforeAll(() => requireDisposableStoreSettlementDatabase());

it("allows only one worker to take over the same expired processing lease", async () => {
  const id = randomUUID(), publicReference = `resend-wh:${id}`, emailId = `race-${id}`;
  const now = new Date();
  await prisma.notificationAuditEvent.create({ data: { publicReference, eventType: "RESEND_WEBHOOK_PROCESSING", entityReference: emailId, safeEvidence: { svixId: id, emailId, webhookEventType: "email.delivered", receiptType: "DELIVERED", occurredAt: now.toISOString(), payloadHash: "a".repeat(64), leaseToken: "expired-owner", leaseExpiresAt: new Date(now.getTime() - 60_000).toISOString(), attemptCount: 1, customerDeliveriesUpdated: 0, adminAlertsUpdated: 0 } } });
  const first = new PrismaClient(), second = new PrismaClient();
  let readers = 0, writers = 0;
  let releaseReaders!: () => void, releaseWriters!: () => void;
  const allRead = new Promise<void>(resolve => { releaseReaders = resolve; });
  const allWrote = new Promise<void>(resolve => { releaseWriters = resolve; });
  const claims: number[] = [];
  const wrap = (client: PrismaClient) => new Proxy(client, { get(target, property) {
    if (property !== "notificationAuditEvent") return Reflect.get(target, property);
    return new Proxy(target.notificationAuditEvent, { get(delegate, method) {
      if (method === "findMany") return async (args: Parameters<typeof delegate.findMany>[0]) => {
        const rows = await delegate.findMany({ ...args, where: { ...args?.where, publicReference } });
        if (++readers === 2) releaseReaders();
        await allRead;
        return rows;
      };
      if (method === "updateMany") return async (args: Parameters<typeof delegate.updateMany>[0]) => {
        const result = await delegate.updateMany(args);
        if (args.data.eventType === "RESEND_WEBHOOK_PROCESSING") {
          claims.push(result.count);
          if (++writers === 2) releaseWriters();
          await allWrote;
        }
        return result;
      };
      return Reflect.get(delegate, method);
    } });
  } });
  try {
    await Promise.all([first.$connect(), second.$connect()]);
    await Promise.all([recoverPendingResendWebhooks({ db: wrap(first) as typeof prisma, now }), recoverPendingResendWebhooks({ db: wrap(second) as typeof prisma, now })]);
    expect(claims.reduce((sum, count) => sum + count, 0)).toBe(1);
  } finally {
    await Promise.all([first.$disconnect(), second.$disconnect()]);
    await prisma.notificationAuditEvent.deleteMany({ where: { publicReference } });
  }
}, 30_000);

it("does not clear a replacement lease when an earlier signed request fails", async () => {
  const id = randomUUID(), publicReference = `resend-wh:${id}`, now = Date.now(), timestamp = String(Math.floor(now / 1000));
  const secretBytes = Buffer.alloc(32, 5), secret = `whsec_${secretBytes.toString("base64")}`;
  const rawBody = JSON.stringify({ type: "email.delivered", data: { email_id: `stale-request-${id}` } });
  const signature = `v1,${createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${rawBody}`).digest("base64")}`;
  const client = new PrismaClient();
  let entered!: () => void, resume!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; }), release = new Promise<void>(resolve => { resume = resolve; });
  const wrapped = new Proxy(client, { get(target, property) {
    if (property === "$transaction") return async (work: Parameters<typeof target.$transaction>[0], options?: unknown) => { entered(); await release; return target.$transaction(work as never, options as never); };
    return Reflect.get(target, property);
  } });
  try {
    await client.$connect();
    const task = processResendWebhook({ rawBody, svixId: id, svixTimestamp: timestamp, svixSignature: signature, secret, nowMs: now, db: wrapped as typeof prisma });
    await waiting;
    const old = await prisma.notificationAuditEvent.findUniqueOrThrow({ where: { publicReference } });
    const replacement = { ...(old.safeEvidence as Record<string, unknown>), leaseToken: "replacement-owner", leaseExpiresAt: new Date(now + 60_000).toISOString() };
    await prisma.notificationAuditEvent.update({ where: { publicReference }, data: { safeEvidence: replacement as never } });
    resume();
    await expect(task).rejects.toMatchObject({ code: "WEBHOOK_IN_PROGRESS", httpStatus: 503 });
    expect((await prisma.notificationAuditEvent.findUniqueOrThrow({ where: { publicReference } })).safeEvidence).toMatchObject({ leaseToken: "replacement-owner" });
  } finally {
    resume();
    await client.$disconnect();
    await prisma.notificationAuditEvent.deleteMany({ where: { publicReference } });
  }
}, 30_000);

it("does not let an old worker complete or clear a replacement lease", async () => {
  const id = randomUUID(), publicReference = `resend-wh:${id}`, emailId = `stale-${id}`, now = new Date();
  const oldEvidence = { svixId: id, emailId, webhookEventType: "email.delivered", receiptType: "DELIVERED", occurredAt: now.toISOString(), payloadHash: "b".repeat(64), leaseToken: "expired-owner", leaseExpiresAt: new Date(now.getTime() - 60_000).toISOString(), attemptCount: 1, customerDeliveriesUpdated: 0, adminAlertsUpdated: 0 };
  await prisma.notificationAuditEvent.create({ data: { publicReference, eventType: "RESEND_WEBHOOK_PROCESSING", entityReference: emailId, safeEvidence: oldEvidence } });
  const client = new PrismaClient();
  let entered!: () => void, resume!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; }), release = new Promise<void>(resolve => { resume = resolve; });
  const wrapped = new Proxy(client, { get(target, property) {
    if (property === "$transaction") return async (work: Parameters<typeof target.$transaction>[0], options?: unknown) => {
      entered(); await release;
      return target.$transaction(work as never, options as never);
    };
    if (property === "notificationAuditEvent") return new Proxy(target.notificationAuditEvent, { get(delegate, method) {
      if (method === "findMany") return (args: Parameters<typeof delegate.findMany>[0]) => delegate.findMany({ ...args, where: { ...args?.where, publicReference } });
      return Reflect.get(delegate, method);
    } });
    return Reflect.get(target, property);
  } });
  try {
    await client.$connect();
    const task = recoverPendingResendWebhooks({ db: wrapped as typeof prisma, now });
    await waiting;
    const replacement = { ...oldEvidence, leaseToken: "new-owner", leaseExpiresAt: new Date(now.getTime() + 60_000).toISOString(), attemptCount: 3 };
    await prisma.notificationAuditEvent.update({ where: { publicReference }, data: { safeEvidence: replacement } });
    resume();
    expect(await task).toMatchObject({ reconciled: 0, failed: 1 });
    const current = await prisma.notificationAuditEvent.findUniqueOrThrow({ where: { publicReference } });
    expect(current.eventType).toBe("RESEND_WEBHOOK_PROCESSING");
    expect(current.safeEvidence).toMatchObject({ leaseToken: "new-owner" });
  } finally {
    resume();
    await client.$disconnect();
    await prisma.notificationAuditEvent.deleteMany({ where: { publicReference } });
  }
}, 30_000);

it("finds due work behind older events with active leases", async () => {
  const prefix = `resend-starvation-${randomUUID()}`;
  const now = new Date();
  const references = Array.from({ length: 4 }, (_, i) => `resend-wh:${prefix}-${i}`);
  try {
    for (let i = 0; i < references.length; i++) {
      await prisma.notificationAuditEvent.create({ data: {
        publicReference: references[i], eventType: "RESEND_WEBHOOK_PROCESSING", entityReference: `${prefix}-${i}`,
        createdAt: new Date(now.getTime() - (references.length - i) * 1000),
        safeEvidence: { svixId: `${prefix}-${i}`, emailId: `${prefix}-${i}`, webhookEventType: "email.delivered", receiptType: "DELIVERED", occurredAt: now.toISOString(), payloadHash: "c".repeat(64), leaseToken: "old-owner", leaseExpiresAt: new Date(now.getTime() + (i === 3 ? -60_000 : 60_000)).toISOString(), attemptCount: 1, customerDeliveriesUpdated: 0, adminAlertsUpdated: 0 },
      } });
    }
    const client = new PrismaClient();
    const wrapped = new Proxy(client, { get(target, property) {
      if (property !== "notificationAuditEvent") return Reflect.get(target, property);
      return new Proxy(target.notificationAuditEvent, { get(delegate, method) {
        if (method === "findMany") return (args: Parameters<typeof delegate.findMany>[0]) => delegate.findMany({ ...args, where: { ...args?.where, publicReference: { in: references } } });
        return Reflect.get(delegate, method);
      } });
    } });
    try {
      expect(await recoverPendingResendWebhooks({ db: wrapped as typeof prisma, now, limit: 1 })).toMatchObject({ examined: 1 });
      const due = await prisma.notificationAuditEvent.findUniqueOrThrow({ where: { publicReference: references[3] } });
      expect(due.safeEvidence).toMatchObject({ attemptCount: 2 });
    } finally { await client.$disconnect(); }
  } finally {
    await prisma.notificationAuditEvent.deleteMany({ where: { publicReference: { in: references } } });
  }
}, 30_000);
