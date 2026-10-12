/* eslint-disable @typescript-eslint/no-explicit-any -- Partial transactional Prisma doubles exercise the real production authority evaluator. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ db: {} as Record<string, any> }));
vi.mock("@/lib/db/prisma", () => ({ prisma: state.db }));
import { recordDriverDeliveryResponsibility } from "@/lib/services/shipping-obligations.service";
import { requestRedelivery, scheduleRedelivery } from "@/lib/services/shipping-governance.service";

const driverInput = { assignmentId: "assignment", driverProfileId: "driver", driverUserId: "driver-user", assignmentVersion: 4, reportType: "SAFETY_CHECK" as const, operationId: "driver-op", safeNote: "Checked" };
const requestInput = { orderId: "order", requesterUserId: "customer", operationId: "request-op", safeNote: "Retry please" };
const scheduleInput = { actorUserId: "admin", publicReference: "RED-REFERENCE", scheduledFor: new Date("2030-01-02T00:00:00.000Z"), responsibilityCode: "CUSTOMER_REQUEST", operationId: "schedule-op", expectedUpdatedAt: new Date("2030-01-01T00:00:00.000Z") };
let assignment: any;
let request: any;
let actor: any;

beforeEach(() => {
  assignment = { id: "assignment", version: 4, status: "ACCEPTED", driverProfileId: "driver", order: { id: "order", status: "DELIVERY_ATTEMPTED", currentDriverProfileId: "driver" }, driverProfile: { userId: "driver-user", status: "ACTIVE", user: { status: "ACTIVE", role: "DRIVER" } } };
  request = { id: "request", publicReference: "RED-REFERENCE", orderId: "order", priorAttemptId: "attempt", requestedByUserId: "customer", status: "REQUESTED", operationId: "request-op", safeNote: "Retry please", updatedAt: new Date("2030-01-01T00:00:00.000Z"), commercialEvidence: { feeRule: "NO_HARDCODED_REDELIVERY_FEE" } };
  actor = { status: "ACTIVE", role: "SUPER_ADMIN" };
  Object.assign(state.db, {
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(state.db)),
    $executeRaw: vi.fn(async () => 1), $queryRaw: vi.fn(async () => []),
    user: { findUnique: vi.fn(async () => actor) },
    orderAssignment: { findFirst: vi.fn(async () => assignment) },
    order: { findUnique: vi.fn(async () => ({ customerId: "customer", status: "DELIVERY_ATTEMPTED" })) },
    deliveryAttempt: { findFirst: vi.fn(async () => ({ id: "attempt" })) },
    privateMediaObject: { findFirst: vi.fn(async () => ({ id: "media" })) },
    driverDeliveryResponsibilityReport: { findUnique: vi.fn(async () => ({ id: "report", orderId: "order", assignmentId: "assignment", driverProfileId: "driver", reportType: "SAFETY_CHECK", safeNote: "Checked", evidenceReference: null })), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "report", ...data })) },
    orderOperationalEvent: { create: vi.fn(async () => ({ id: "event" })) },
    redeliveryRequest: { findUnique: vi.fn(async () => request), findFirst: vi.fn(async () => null), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "request", ...data })), update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { request = { ...request, ...data, updatedAt: new Date("2030-01-01T00:00:01.000Z") }; return request; }) },
    adminActivityLog: { findFirst: vi.fn(async () => null), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { state.db.adminActivityLog.findFirst.mockResolvedValue({ id: "audit", ...data }); return { id: "audit", ...data }; }) },
    permission: { findUnique: vi.fn(async () => ({ rolePermissions: [{ enabled: true }], userPermissions: [] })), count: vi.fn(async () => 1) },
  });
});

describe("driver shipping responsibility replay checks current canonical authority (T1)", () => {
  it("returns an exact authorized retry without duplicate events", async () => {
    await expect(recordDriverDeliveryResponsibility(driverInput)).resolves.toMatchObject({ id: "report" });
    expect(state.db.driverDeliveryResponsibilityReport.create).not.toHaveBeenCalled();
    expect(state.db.orderOperationalEvent.create).not.toHaveBeenCalled();
  });
  it.each(["version", "reassigned", "disabled-user", "disabled-profile", "terminal", "foreign-user"])("denies %s before reading an existing report", async (failure) => {
    const input = { ...driverInput };
    if (failure === "version") assignment.version = 5;
    if (failure === "reassigned") assignment.order.currentDriverProfileId = "another-driver";
    if (failure === "disabled-user") assignment.driverProfile.user.status = "SUSPENDED";
    if (failure === "disabled-profile") assignment.driverProfile.status = "SUSPENDED";
    if (failure === "terminal") assignment.order.status = "DELIVERED";
    if (failure === "foreign-user") input.driverUserId = "foreign-user";
    await expect(recordDriverDeliveryResponsibility(input)).rejects.toThrow();
    expect(state.db.driverDeliveryResponsibilityReport.findUnique).not.toHaveBeenCalled();
    expect(state.db.orderOperationalEvent.create).not.toHaveBeenCalled();
  });
  it("rejects operation reuse with altered content", async () => {
    await expect(recordDriverDeliveryResponsibility({ ...driverInput, safeNote: "Changed" })).rejects.toMatchObject({ code: "DRIVER_RESPONSIBILITY_OPERATION_CONFLICT" });
  });
  it("requires current private evidence authority even on replay", async () => {
    state.db.privateMediaObject.findFirst.mockResolvedValue(null);
    await expect(recordDriverDeliveryResponsibility({ ...driverInput, evidenceReference: "MEDIA-REVOKED" })).rejects.toMatchObject({ code: "DRIVER_RESPONSIBILITY_EVIDENCE_FORBIDDEN" });
    expect(state.db.driverDeliveryResponsibilityReport.findUnique).not.toHaveBeenCalled();
  });
  it("writes a new report and corresponding event inside the same transaction", async () => {
    state.db.driverDeliveryResponsibilityReport.findUnique.mockResolvedValue(null);
    await expect(recordDriverDeliveryResponsibility(driverInput)).resolves.toMatchObject({ orderId: "order" });
    expect(state.db.orderOperationalEvent.create).toHaveBeenCalledOnce();
    expect(state.db.$transaction).toHaveBeenCalledOnce();
  });
});

describe("customer redelivery replay is bound to current owner and attempt (T1)", () => {
  it("returns the same request for an exact eligible retry", async () => {
    await expect(requestRedelivery(requestInput)).resolves.toMatchObject({ id: "request" });
    expect(state.db.redeliveryRequest.create).not.toHaveBeenCalled();
  });
  it.each(["foreign-owner", "disabled", "delivered"])("denies %s before replay lookup", async (failure) => {
    if (failure === "foreign-owner") state.db.order.findUnique.mockResolvedValue({ customerId: "other", status: "DELIVERY_ATTEMPTED" });
    if (failure === "disabled") actor.status = "SUSPENDED";
    if (failure === "delivered") state.db.order.findUnique.mockResolvedValue({ customerId: "customer", status: "DELIVERED" });
    await expect(requestRedelivery(requestInput)).rejects.toThrow();
    expect(state.db.redeliveryRequest.findUnique).not.toHaveBeenCalled();
  });
  it.each(["changed-note", "foreign-operation", "later-attempt"])("rejects %s operation reuse", async (failure) => {
    const input = { ...requestInput };
    if (failure === "changed-note") input.safeNote = "Changed";
    if (failure === "foreign-operation") request.orderId = "other-order";
    if (failure === "later-attempt") state.db.deliveryAttempt.findFirst.mockResolvedValue({ id: "later-attempt" });
    await expect(requestRedelivery(input)).rejects.toMatchObject({ code: "REDELIVERY_OPERATION_CONFLICT" });
    expect(state.db.redeliveryRequest.create).not.toHaveBeenCalled();
  });
});

describe("redelivery schedule operation receipt and audit (T1)", () => {
  it("commits once and accepts an exact retry with the original version expectation", async () => {
    const first = await scheduleRedelivery(scheduleInput);
    const second = await scheduleRedelivery(scheduleInput);
    expect(second).toEqual(first);
    expect(state.db.redeliveryRequest.update).toHaveBeenCalledOnce();
    expect(state.db.adminActivityLog.create).toHaveBeenCalledOnce();
    expect(first.commercialEvidence).toMatchObject({ feeRule: "NO_HARDCODED_REDELIVERY_FEE", scheduleReceipt: { operationId: "schedule-op" } });
  });
  it.each(["actor", "date", "code", "reference", "expectation"])("rejects %s changes under an existing operation", async (field) => {
    await scheduleRedelivery(scheduleInput);
    const input = { ...scheduleInput };
    if (field === "actor") input.actorUserId = "other-admin";
    if (field === "date") input.scheduledFor = new Date("2030-01-03T00:00:00.000Z");
    if (field === "code") input.responsibilityCode = "CHANGED";
    if (field === "reference") { input.publicReference = "RED-OTHER"; request = { ...request, id: "other-request", commercialEvidence: {} }; }
    if (field === "expectation") input.expectedUpdatedAt = new Date("2030-01-01T00:00:01.000Z");
    await expect(scheduleRedelivery(input)).rejects.toMatchObject({ code: "REDELIVERY_OPERATION_CONFLICT" });
    expect(state.db.adminActivityLog.create).toHaveBeenCalledOnce();
  });
  it.each(["disabled", "customer", "revoked-permission"])("denies %s on an exact previously successful retry", async (failure) => {
    await scheduleRedelivery(scheduleInput);
    if (failure === "disabled") actor.status = "SUSPENDED";
    if (failure === "customer") actor.role = "CUSTOMER";
    if (failure === "revoked-permission") { actor.role = "ADMIN"; state.db.permission.findUnique.mockResolvedValue({ rolePermissions: [{ enabled: true }], userPermissions: [{ effect: "DENY" }] }); }
    await expect(scheduleRedelivery(scheduleInput)).rejects.toMatchObject({ code: "REDELIVERY_SCHEDULE_FORBIDDEN" });
    expect(state.db.adminActivityLog.create).toHaveBeenCalledOnce();
  });
  it("rejects a stale expected version before changing state or writing audit", async () => {
    await expect(scheduleRedelivery({ ...scheduleInput, expectedUpdatedAt: new Date("2029-01-01T00:00:00.000Z") })).rejects.toMatchObject({ code: "REDELIVERY_VERSION_CONFLICT" });
    expect(state.db.redeliveryRequest.update).not.toHaveBeenCalled();
    expect(state.db.adminActivityLog.create).not.toHaveBeenCalled();
  });
  it("keeps the existing no-expectation API compatible with a row-bound compare and swap", async () => {
    await scheduleRedelivery({ ...scheduleInput, expectedUpdatedAt: undefined });
    expect(state.db.redeliveryRequest.update.mock.calls[0][0].where).toMatchObject({ id: "request", updatedAt: scheduleInput.expectedUpdatedAt });
  });
  it("propagates audit failure from the same transaction instead of swallowing it", async () => {
    state.db.adminActivityLog.create.mockRejectedValue(new Error("audit unavailable"));
    await expect(scheduleRedelivery(scheduleInput)).rejects.toThrow("audit unavailable");
    expect(state.db.$transaction).toHaveBeenCalledOnce();
  });
});
