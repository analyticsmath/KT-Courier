import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({ commands: [] as Row[], otps: [] as Row[], intents: [] as Row[], failAt: "", retries: 0, transactions: 0, tail: Promise.resolve() }));
const collaborators = vi.hoisted(() => ({ authority: vi.fn(), recipient: vi.fn() }));
vi.mock("@/lib/driver-operations/authority", () => ({ assertAcceptedCurrentDriver: collaborators.authority }));
vi.mock("@/lib/services/delivery-recipient.service", () => ({ resolveDeliveryOtpRecipient: collaborators.recipient }));
vi.mock("@/lib/auth/otp", () => ({ generateOtpCode: () => "573190", hashOtp: (code: string) => `hash-${code}` }));
vi.mock("@/lib/notifications/security-delivery", () => ({ queueSecurityNotification: async (_input: unknown, tx: { recordIntent: () => void }) => { tx.recordIntent(); if (state.failAt === "queue") throw new Error("injected queue failure"); } }));
vi.mock("@/lib/db/prisma", () => {
  const tx = {
    $queryRaw: async () => [],
    order: { findUniqueOrThrow: async () => ({ id: "order", orderNumber: "KT-1" }) },
    orderAssignment: { findFirst: async () => ({ id: "assignment" }) },
    driverOperationCommand: {
      findUnique: async ({ where }: { where: { operationId: string } }) => state.commands.find(row => row.operationId === where.operationId) ?? null,
      create: async ({ data }: { data: Row }) => { state.commands.push({ ...data }); return data; },
      update: async ({ where, data }: { where: { operationId: string }; data: Row }) => { if (state.failAt === "receipt") throw new Error("injected receipt failure"); const row = state.commands.find(row => row.operationId === where.operationId)!; Object.assign(row, data); return row; },
    },
    deliveryOtp: {
      findFirst: async () => state.otps.find(row => !row.consumedAt) ?? null,
      count: async () => state.otps.length,
      updateMany: async ({ data }: { data: Row }) => { for (const row of state.otps) if (!row.consumedAt) Object.assign(row, data); return { count: state.otps.length }; },
      create: async ({ data }: { data: Row }) => { const row = { id: `otp-${state.otps.length + 1}`, ...data }; state.otps.push(row); return row; },
    },
    recordIntent: () => { state.intents.push({ encryptedPayload: "opaque-encrypted-value" }); },
  };
  return { prisma: { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => {
    const previous = state.tail; let release!: () => void; state.tail = new Promise<void>(resolve => { release = resolve; }); await previous;
    state.transactions++;
    const snapshot = structuredClone({ commands: state.commands, otps: state.otps, intents: state.intents });
    try {
      if (state.retries-- > 0) throw { code: "P2034" };
      const result = await work(tx);
      if (state.failAt === "commit") throw new Error("injected commit failure");
      return result;
    } catch (error) { Object.assign(state, snapshot); throw error; }
    finally { release(); }
  } } };
});
import { generateAndSendDeliveryOtp } from "@/lib/services/delivery-otp.service";

describe("atomic delivery OTP issuance and safe operation replay", () => {
  const input = { operationId: "123e4567-e89b-12d3-a456-426614174000", assignmentVersion: 2 };
  const issue = (command = input, assignmentId = "assignment") => generateAndSendDeliveryOtp(assignmentId, "driver", "driver-user", command);
  beforeEach(() => {
    Object.assign(state, { commands: [], otps: [], intents: [], failAt: "", retries: 0, transactions: 0, tail: Promise.resolve() });
    collaborators.authority.mockResolvedValue({ orderId: "order", driverUserId: "driver-user", assignmentStatus: "ACCEPTED", orderStatus: "IN_TRANSIT" });
    collaborators.recipient.mockResolvedValue({ kind: "SHIPMENT_RECIPIENT", subjectUserId: "recipient-subject", email: "recipient@example.test", name: "Receiver" });
  });
  it("commits the OTP, encrypted intent and receipt once across concurrent retries", async () => {
    const [first, replay] = await Promise.all([issue(), issue()]);
    expect(first).toMatchObject({ ok: true, replay: false }); expect(replay).toMatchObject({ ok: true, replay: true });
    expect(replay).toMatchObject({ expiresAt: first.ok ? first.expiresAt : null });
    expect(state.commands).toHaveLength(1); expect(state.otps).toHaveLength(1); expect(state.intents).toHaveLength(1);
    expect(JSON.stringify(state.commands)).not.toContain("573190"); expect(first).not.toHaveProperty("plainCode");
    expect(collaborators.authority.mock.calls[0][3]).toHaveProperty("recordIntent"); expect(collaborators.recipient.mock.calls[0][1]).toHaveProperty("recordIntent");
  });
  it.each(["queue", "receipt", "commit"])("rolls back replacement, intent and receipt after %s failure, then safely retries", async (failAt) => {
    state.otps.push({ id: "older-otp", lastSentAt: new Date(Date.now() - 120_000), consumedAt: null }); state.failAt = failAt;
    await expect(issue()).rejects.toThrow(`injected ${failAt} failure`);
    expect(state.commands).toHaveLength(0); expect(state.intents).toHaveLength(0); expect(state.otps).toEqual([expect.objectContaining({ id: "older-otp", consumedAt: null })]);
    state.failAt = ""; expect(await issue()).toMatchObject({ ok: true, replay: false });
    expect(state.commands).toHaveLength(1); expect(state.otps).toHaveLength(2); expect(state.intents).toHaveLength(1);
  });
  it("rejects changed request data or another assignment on receipt replay", async () => {
    await issue();
    expect(await issue({ ...input, assignmentVersion: 3 })).toMatchObject({ ok: false, error: expect.stringContaining("different request") });
    expect(await issue(input, "other-assignment")).toMatchObject({ ok: false, error: expect.stringContaining("another assignment") });
    expect(state.otps).toHaveLength(1);
  });
  it("serializes distinct resend commands so cooldown cannot be bypassed in parallel", async () => {
    const results = await Promise.all([issue(), issue({ ...input, operationId: "123e4567-e89b-12d3-a456-426614174001" })]);
    expect(results.filter(result => result.ok)).toHaveLength(1); expect(results.filter(result => !result.ok)).toHaveLength(1);
    expect(state.commands).toHaveLength(1); expect(state.otps).toHaveLength(1);
  });
  it("retries serialization conflicts before returning one committed result", async () => {
    state.retries = 2; expect(await issue()).toMatchObject({ ok: true }); expect(state.transactions).toBe(3); expect(state.otps).toHaveLength(1);
  });
});
