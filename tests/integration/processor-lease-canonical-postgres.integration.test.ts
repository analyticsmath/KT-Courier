import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { acquireProcessorLease, completeProcessorRun, heartbeatProcessorLease } from "@/lib/processors/lease-authority";
import { assertPrivacyDisposableDatabase as assertClosureDisposableDatabase } from "../phase-b/privacy-disposable-guard";

beforeAll(assertClosureDisposableDatabase);
const command = () => ({ jobName: "deliver-notifications", partition: `disposable-${randomUUID()}`, operationId: randomUUID(), leaseOwner: `synthetic-${randomUUID()}`, leaseDurationSeconds: 300 });
const read = (operationId: string) => prisma.operationalProcessorRun.findUniqueOrThrow({ where: { operationId } });

describe("canonical disposable operations lease authority", () => {
  it("allows one competing worker and persists one active partition lease", async () => {
    const first = command(), second = { ...first, operationId: randomUUID(), leaseOwner: `synthetic-${randomUUID()}` };
    const results = await Promise.all([acquireProcessorLease(first), acquireProcessorLease(second)]);
    expect(results.filter(row => row.acquired)).toHaveLength(1);
    expect(results.filter(row => !row.acquired)).toHaveLength(1);
    const rows = await prisma.operationalProcessorRun.findMany({ where: { jobName: first.jobName, partition: first.partition } });
    expect(rows).toHaveLength(1); expect(rows[0].status).toBe("LEASE_ACQUIRED");
    expect(await heartbeatProcessorLease(rows[0].operationId, rows[0].leaseOwner!, 300)).toBe(true);
    expect(await completeProcessorRun({ operationId: rows[0].operationId, leaseOwner: rows[0].leaseOwner!, status: "CANCELLED" })).toBe(true);
  });
  it("rejects expired heartbeats and preserves reclaimed history and the successor lease", async () => {
    const first = command(); expect((await acquireProcessorLease(first)).acquired).toBe(true);
    // A synthetic clock input on our own operational run, not fabricated money,
    // provider settlement, notification delivery or a production worker record.
    await prisma.operationalProcessorRun.update({ where: { operationId: first.operationId }, data: { leaseExpiresAt: new Date(0) } });
    const expired = await read(first.operationId);
    expect(await heartbeatProcessorLease(first.operationId, first.leaseOwner)).toBe(false);
    expect(await read(first.operationId)).toEqual(expired);
    const second = { ...first, operationId: randomUUID(), leaseOwner: `synthetic-${randomUUID()}` };
    expect((await acquireProcessorLease(second)).acquired).toBe(true);
    const lost = await read(first.operationId), successor = await read(second.operationId);
    expect(lost.status).toBe("LEASE_LOST");
    expect(await heartbeatProcessorLease(first.operationId, first.leaseOwner)).toBe(false);
    expect(await completeProcessorRun({ operationId: first.operationId, leaseOwner: first.leaseOwner, status: "APPLY_COMPLETED", itemsCompleted: 99 })).toBe(false);
    expect(await read(first.operationId)).toEqual(lost); expect(await read(second.operationId)).toEqual(successor);
    expect(await completeProcessorRun({ operationId: second.operationId, leaseOwner: second.leaseOwner, status: "CANCELLED" })).toBe(true);
  });
  it("rejects foreign ownership and preserves completed metrics on repeated completion", async () => {
    const c = command(); expect((await acquireProcessorLease(c)).acquired).toBe(true);
    const initial = await read(c.operationId);
    expect(await heartbeatProcessorLease(c.operationId, "foreign-worker")).toBe(false);
    await expect(completeProcessorRun({ operationId: c.operationId, leaseOwner: "foreign-worker", status: "APPLY_COMPLETED" })).rejects.toThrow("Stale lease owner");
    expect(await read(c.operationId)).toEqual(initial);
    expect(await completeProcessorRun({ operationId: c.operationId, leaseOwner: c.leaseOwner, status: "APPLY_COMPLETED", itemsClaimed: 2, itemsCompleted: 1, itemsRetried: 1, safeSummary: "Synthetic operational counters only" })).toBe(true);
    const completed = await read(c.operationId);
    expect(completed).toMatchObject({ status: "APPLY_COMPLETED", leaseExpiresAt: null, itemsClaimed: 2, itemsCompleted: 1, itemsRetried: 1 });
    expect(await completeProcessorRun({ operationId: c.operationId, leaseOwner: c.leaseOwner, status: "FAILED", itemsCompleted: 0 })).toBe(false);
    expect(await heartbeatProcessorLease(c.operationId, c.leaseOwner)).toBe(false);
    expect(await read(c.operationId)).toEqual(completed);
  });
  it("cannot revive a terminal run when heartbeat and completion compete", async () => {
    const c = command(); expect((await acquireProcessorLease(c)).acquired).toBe(true);
    const [, completed] = await Promise.all([heartbeatProcessorLease(c.operationId, c.leaseOwner, 300), completeProcessorRun({ operationId: c.operationId, leaseOwner: c.leaseOwner, status: "CANCELLED" })]);
    expect(completed).toBe(true);
    const terminal = await read(c.operationId); expect(terminal.status).toBe("CANCELLED"); expect(terminal.leaseExpiresAt).toBeNull();
    expect(await heartbeatProcessorLease(c.operationId, c.leaseOwner)).toBe(false);
    expect(await read(c.operationId)).toEqual(terminal);
  });
});
