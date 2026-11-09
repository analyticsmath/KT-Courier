import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { assertDriverCashCapacityForAssignment, updateDriverCashLimit } from "@/lib/services/driver-cash-capacity.service";
import { submitDriverDeposit, driverCashSummary } from "@/lib/client-platform/driver-cash.service";

const db = new PrismaClient();
const tag = randomUUID();
const ids: string[] = [];
let driverId = "", driverUserId = "", adminId = "", customerId = "";
let bankPrevious: unknown = null;
let bankExisted = false;

describe("Phase 2 bank evidence, cash assignment limit, and ledger hold in isolated PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgresql://localhost/no-db");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || process.env.KT_NETWORK_DISABLED !== "true"
        || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/kt_launch_test") {
      throw new Error("Exact disposable PostgreSQL database is required; never run against customer money.");
    }
    const user = await db.user.create({ data: { email: "p2cash-driver-" + tag + "@example.test", role: "DRIVER", status: "ACTIVE" } });
    driverUserId = user.id;
    const admin = await db.user.create({ data: { email: "p2cash-admin-" + tag + "@example.test", role: "SUPER_ADMIN", status: "ACTIVE" } });
    adminId = admin.id;
    const customer = await db.user.create({ data: { email: "p2cash-customer-" + tag + "@example.test", role: "CUSTOMER", status: "ACTIVE" } });
    customerId = customer.id;
    const driver = await db.driverProfile.create({ data: { userId: user.id, driverCode: "P2CASH" + tag.replaceAll("-", "").slice(0, 14), status: "ACTIVE", active: true } });
    driverId = driver.id;
    const previous = await db.systemSetting.findUnique({ where: { key: "client_cash_deposit_bank" }, select: { value: true } });
    bankPrevious = previous?.value ?? null;
    bankExisted = Boolean(previous);
    await db.systemSetting.upsert({
      where: { key: "client_cash_deposit_bank" },
      create: { key: "client_cash_deposit_bank", label: "Isolated bank instructions", type: "JSON", value: {
        bankName: "Disposable Bank", accountName: "KT Isolated", accountNumber: "1234567890",
        branchCode: "123456", referenceHint: "Disposable reference", expectedVersion: 0, handoverEnabled: false,
      } },
      update: { value: { bankName: "Disposable Bank", accountName: "KT Isolated", accountNumber: "1234567890",
        branchCode: "123456", referenceHint: "Disposable reference", expectedVersion: 0, handoverEnabled: false } },
    });
  });
  afterAll(async () => {
    try {
      await db.driverCashDeposit.deleteMany({ where: { driverProfileId: driverId } });
      await db.adminActivityLog.deleteMany({ where: { actorUserId: { in: [adminId, driverUserId] } } });
      await db.orderAssignment.deleteMany({ where: { orderId: { in: ids } } });
      await db.cashOnDelivery.deleteMany({ where: { orderId: { in: ids } } });
      await db.order.deleteMany({ where: { id: { in: ids } } });
      await db.privateMediaObject.deleteMany({ where: { ownerType: "DRIVER", ownerId: driverId } });
      await db.driverProfile.delete({ where: { id: driverId } });
      await db.user.deleteMany({ where: { id: { in: [driverUserId, adminId, customerId] } } });
      if (bankExisted) await db.systemSetting.update({ where: { key: "client_cash_deposit_bank" }, data: { value: bankPrevious as Prisma.InputJsonValue } });
      else await db.systemSetting.delete({ where: { key: "client_cash_deposit_bank" } });
    } finally { await db.$disconnect(); }
  });
  async function codOrder(value: string, collected = false) {
    const order = await db.order.create({ data: {
      orderNumber: "KT-P2-" + randomUUID().slice(0, 18),
      source: "CUSTOMER", status: "CONFIRMED", deliveryType: "SAME_DAY", currency: "ZAR", customerId,
    } });
    ids.push(order.id);
    await db.cashOnDelivery.create({ data: {
      publicReference: "COD-P2-" + randomUUID(), orderId: order.id, policyMode: "FULL_COD",
      authoritativePayable: value, cashObligation: value, status: collected ? "COLLECTED" : "READY_FOR_COLLECTION",
      cashCollected: collected ? value : "0.00", collectorDriverId: collected ? driverId : null,
    } });
    return order;
  }
  it("tracks cash offered by an existing delivery and rejects a second offer above the R100 cap", async () => {
    const updated = await updateDriverCashLimit(driverId, adminId, "100.00", 0);
    expect(updated).toMatchObject({ amount: "100.00", revision: 1 });
    await expect(updateDriverCashLimit(driverId, adminId, "120.00", 0)).rejects.toThrow(/another administrator/);
    const first = await codOrder("70.00"), second = await codOrder("35.00");
    await db.$transaction(async tx => {
      await assertDriverCashCapacityForAssignment(tx, driverId, first.id);
      await tx.orderAssignment.create({ data: {
        orderId: first.id, driverProfileId: driverId, assignedByAdminId: adminId, assignedAt: new Date(), status: "ASSIGNED", activeOrderGuard: first.id,
      } });
    });
    await expect(db.$transaction(tx => assertDriverCashCapacityForAssignment(tx, driverId, second.id)))
      .rejects.toMatchObject({ code: "DRIVER_CASH_LIMIT_EXCEEDED", held: "0.00", reserved: "70.00", requested: "35.00", limit: "100.00" });
    expect(await db.orderAssignment.count({ where: { driverProfileId: driverId } })).toBe(1);
    const capacity = (await driverCashSummary(driverUserId)).cashCapacity;
    expect(capacity).toMatchObject({
      limit: "100.00", held: "0.00", reserved: "70.00",
      exposure: "70.00", remaining: "30.00", atLimit: false,
    });
  });
  it("rejects forged proof and creates an immutable pending remittance for a genuine private receipt", async () => {
    const collected = await codOrder("25.00", true);
    const forged = await db.privateMediaObject.create({ data: {
      publicReference: "PMO-" + randomUUID(), ownerType: "DRIVER", ownerId: "someone-else",
      purpose: "DRIVER_CASH_DEPOSIT_RECEIPT", status: "READY", storageProvider: "local",
      storageKey: "p2cash-forged-" + tag, originalFileName: "fake.pdf", declaredMimeType: "application/pdf",
      detectedMimeType: "application/pdf", byteSize: 125, checksum: "a".repeat(64), createdByUserId: driverUserId,
    } });
    const original = await db.privateMediaObject.create({ data: {
      publicReference: "PMO-" + randomUUID(), ownerType: "DRIVER", ownerId: driverId,
      purpose: "DRIVER_CASH_DEPOSIT_RECEIPT", status: "READY", storageProvider: "local",
      storageKey: "p2cash-proper-" + tag, originalFileName: "deposit.pdf", declaredMimeType: "application/pdf",
      detectedMimeType: "application/pdf", byteSize: 125, checksum: "b".repeat(64), createdByUserId: driverUserId,
    } });
    const input = {
      orderId: collected.id, amount: "25.00", bankReference: "BANK-ISOLATED-" + tag.slice(0, 6),
      operationId: "p2cash-operation-" + tag.slice(0, 15), remittanceMethod: "BANK_DEPOSIT" as const,
    };
    await expect(submitDriverDeposit(driverUserId, { ...input, privateMediaReference: forged.publicReference }))
      .rejects.toMatchObject({ code: "DEPOSIT_PROOF_NOT_VERIFIED" });
    const receipt = await submitDriverDeposit(driverUserId, { ...input, privateMediaReference: original.publicReference });
    expect(receipt).toMatchObject({ status: "PENDING", replayed: false });
    const row = await db.driverCashDeposit.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(row.privateMediaObjectId).toBe(original.id);
    expect((await db.cashOnDelivery.findUniqueOrThrow({ where: { orderId: collected.id } })).cashReconciled.toFixed(2)).toBe("0.00");
    expect(await submitDriverDeposit(driverUserId, { ...input, privateMediaReference: original.publicReference }))
      .toMatchObject({ replayed: true });
    expect((await db.driverCashDeposit.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe("PENDING");
    const summary = await driverCashSummary(driverUserId);
    expect(summary.deposits.find(d => d.id === receipt.id)?.proofReference).toBe(original.publicReference);
    await db.driverCashDeposit.delete({ where: { id: receipt.id } });
    await db.privateMediaObject.deleteMany({ where: { id: { in: [original.id, forged.id] } } });
  });
});
