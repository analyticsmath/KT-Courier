import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { hashOtp } from "@/lib/auth/otp";
import { generateAndSendDeliveryOtp, getTestIssuedDeliveryOtp } from "@/lib/services/delivery-otp.service";
import { openSecurityPayload } from "@/lib/notifications/security-payload-vault";

describe("atomic delivery OTP issuance on disposable PostgreSQL", () => {
  let validated = false;
  let driverUserId = "", driverId = "", adminId = "", orderId = "", assignmentId = "";
  const command = () => ({ operationId: randomUUID(), assignmentVersion: 1 });
  const issue = (input = command(), actor = driverUserId) => generateAndSendDeliveryOtp(assignmentId, driverId, actor, input);
  const removeTrigger = async () => {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_delivery_otp_receipt_reject ON "DriverOperationCommand"');
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS test_delivery_otp_receipt_reject()");
  };
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || !["/kt_launch_test", "/kt_courier_test"].includes(url.pathname) || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Disposable delivery OTP database required.");
    validated = true;
  });
  beforeEach(async () => {
    await removeTrigger();
    vi.stubEnv("AUTH_OTP_HMAC_KEY", Buffer.alloc(32, 9).toString("base64"));
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const nonce = randomUUID();
    const driver = await prisma.user.create({ data: { email: `otp-driver-${nonce}@example.test`, role: "DRIVER", status: "ACTIVE" } }); driverUserId = driver.id;
    const admin = await prisma.user.create({ data: { email: `otp-admin-${nonce}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } }); adminId = admin.id;
    const profile = await prisma.driverProfile.create({ data: { userId: driverUserId, driverCode: `OTP-${nonce}`, status: "ACTIVE", active: true } }); driverId = profile.id;
    const setup = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({ data: { orderNumber: `OTP-${nonce}`, source: "CUSTOMER", deliveryType: "PARCEL_DOCUMENT", status: "IN_TRANSIT", recipientName: "Unregistered receiver", recipientEmail: `otp-receiver-${nonce}@example.test` } });
      const assignment = await tx.orderAssignment.create({ data: { orderId: order.id, driverProfileId: driverId, assignedByAdminId: adminId, assignedAt: new Date(), acceptedAt: new Date(), status: "ACCEPTED", activeOrderGuard: order.id } });
      await tx.order.update({ where: { id: order.id }, data: { currentDriverProfileId: driverId } });
      return { order, assignment };
    });
    orderId = setup.order.id;
    assignmentId = setup.assignment.id;
  });
  afterEach(async () => {
    if (!validated) return;
    await removeTrigger();
    const intents = await prisma.notificationEventIntent.findMany({ where: { aggregateReference: orderId, eventType: "DELIVERY_OTP" }, select: { id: true } });
    const ids = intents.map(row => row.id);
    await prisma.notificationDelivery.deleteMany({ where: { messageId: { in: ids } } });
    await prisma.notificationSecurePayload.deleteMany({ where: { eventIntentId: { in: ids } } });
    await prisma.notificationEventIntent.deleteMany({ where: { id: { in: ids } } });
    await prisma.driverOperationCommand.deleteMany({ where: { orderId } });
    await prisma.deliveryOtp.deleteMany({ where: { orderId } });
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({ where: { id: orderId }, data: { currentDriverProfileId: null } });
      await tx.orderAssignment.deleteMany({ where: { id: assignmentId } });
    });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.driverProfile.deleteMany({ where: { id: driverId } });
    await prisma.user.deleteMany({ where: { id: { in: [driverUserId, adminId] } } });
  });
  it("commits exactly one valid OTP, encrypted intent and completed receipt across simultaneous retries", async () => {
    const input = command(); const results = await Promise.all(Array.from({ length: 5 }, () => issue(input)));
    expect(results.every(result => result.ok)).toBe(true); expect(results.filter(result => result.ok && !result.replay)).toHaveLength(1);
    expect(await prisma.deliveryOtp.count({ where: { orderId } })).toBe(1);
    expect(await prisma.driverOperationCommand.count({ where: { orderId, completedAt: { not: null } } })).toBe(1);
    const intent = await prisma.notificationEventIntent.findUniqueOrThrow({ where: { operationId: input.operationId } });
    const secure = await prisma.notificationSecurePayload.findUniqueOrThrow({ where: { eventIntentId: intent.id } });
    const otp = await prisma.deliveryOtp.findFirstOrThrow({ where: { orderId } });
    const plainCode = getTestIssuedDeliveryOtp(otp.id);
    expect(openSecurityPayload(secure.encryptedPayload, input.operationId)).toMatchObject({ otp: plainCode });
    expect(otp.codeHash).toBe(hashOtp(plainCode)); expect(JSON.stringify(intent)).not.toContain(plainCode);
    expect(new Set(results.map(result => result.ok ? result.expiresAt.toISOString() : "failed")).size).toBe(1);
  });
  it("rolls back OTP replacement and encrypted notification if completing the receipt fails", async () => {
    const original = await prisma.deliveryOtp.create({ data: { orderId, assignmentId, codeHash: hashOtp("111111"), expiresAt: new Date(Date.now() + 30 * 60_000), lastSentAt: new Date(Date.now() - 120_000), createdByUserId: driverUserId } });
    await prisma.$executeRawUnsafe(`CREATE FUNCTION test_delivery_otp_receipt_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."type" = 'DELIVERY_OTP_REQUEST' THEN RAISE EXCEPTION 'Injected receipt failure'; END IF; RETURN NEW; END; $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER test_delivery_otp_receipt_reject BEFORE UPDATE ON "DriverOperationCommand" FOR EACH ROW EXECUTE FUNCTION test_delivery_otp_receipt_reject()');
    const input = command(); await expect(issue(input)).rejects.toThrow();
    expect(await prisma.deliveryOtp.count({ where: { orderId } })).toBe(1);
    expect((await prisma.deliveryOtp.findUniqueOrThrow({ where: { id: original.id } })).consumedAt).toBeNull();
    expect(await prisma.notificationEventIntent.findUnique({ where: { operationId: input.operationId } })).toBeNull();
    expect(await prisma.driverOperationCommand.findUnique({ where: { operationId: input.operationId } })).toBeNull();
    await removeTrigger(); expect(await issue(input)).toMatchObject({ ok: true, replay: false });
  });
  it("cannot bypass resend cooldown with concurrent different operations", async () => {
    const results = await Promise.all([issue(), issue()]); expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(await prisma.deliveryOtp.count({ where: { orderId } })).toBe(1);
    expect(await prisma.notificationEventIntent.count({ where: { aggregateReference: orderId, eventType: "DELIVERY_OTP" } })).toBe(1);
  });
  it("preserves the actor and request contract on safe replay", async () => {
    const input = command(); expect(await issue(input)).toMatchObject({ ok: true });
    expect(await issue({ ...input, assignmentVersion: 2 })).toMatchObject({ ok: false, error: expect.stringContaining("different request") });
    expect(await issue(input, adminId)).toMatchObject({ ok: false, error: expect.stringContaining("unavailable for this driver") });
    expect(await prisma.deliveryOtp.count({ where: { orderId } })).toBe(1);
  });
});