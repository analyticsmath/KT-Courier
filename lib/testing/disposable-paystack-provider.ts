import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertDisposablePaystackAcceptance, assertDisposablePaystackEmail, disposablePaystackKey } from "./disposable-paystack-policy";

export type DisposablePaystackTransaction = {
  reference: string; email: string; amount: number; currency: string; id: number;
  status: string; initializeCalls: number; verifyCalls: number;
};

/** Persisted provider facts are separate from webhook facts and financial rows.
 * This adapter never marks a Payment, journal, reservation or order successful.
 * Unsupported operations fail before fetch; refunds/transfers have no test lane.
 */
export async function requestDisposablePaystack(path: string, method: string, body: unknown, secretKey: string) {
  assertDisposablePaystackAcceptance();
  if (secretKey !== process.env.PAYSTACK_SECRET_KEY) throw new Error("Unexpected offline provider credential.");
  const verify = /^\/transaction\/verify\/([^/]+)$/.exec(path);
  if (method === "GET" && verify) {
    const reference = decodeURIComponent(verify[1]);
    return prisma.$transaction(async tx => {
      const key = disposablePaystackKey(reference);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SystemSetting" WHERE "key" = ${key} FOR UPDATE`);
      const row = await tx.systemSetting.findUnique({ where: { key } });
      if (!row) throw new Error("Synthetic provider transaction not found.");
      const record = row.value as unknown as DisposablePaystackTransaction;
      assertDisposablePaystackEmail(record.email);
      const updated = { ...record, verifyCalls: record.verifyCalls + 1 };
      await tx.systemSetting.update({ where: { key }, data: { value: updated } });
      return { status: true, message: "Disposable provider verification", data: {
        ...updated, domain: "test", message: null, gateway_response: "Disposable provider record",
        paid_at: updated.status === "success" ? new Date().toISOString() : null,
        created_at: new Date().toISOString(), channel: "card", ip_address: null,
        customer: { id: updated.id, email: updated.email },
      } };
    });
  }
  if (method !== "POST" || path !== "/transaction/initialize" || !body || typeof body !== "object") {
    throw new Error("Operation excluded from offline Paystack acceptance.");
  }
  const input = body as { reference: string; email: string; amount: number; currency: string; callback_url: string };
  assertDisposablePaystackEmail(input.email);
  const callback = new URL(input.callback_url);
  if (callback.origin !== new URL(process.env.PAYMENT_APP_ORIGIN!).origin) throw new Error("Offline callback must remain local.");
  const attempt = await prisma.paymentAttempt.findUnique({ where: { merchantReference: input.reference }, include: { payment: { include: { marketplaceCheckout: { include: { contactSnapshot: true } } } } } });
  if (!attempt || attempt.provider !== "PAYSTACK" || attempt.payment.subjectType !== "MARKETPLACE_CHECKOUT" ||
      attempt.payment.marketplaceCheckout?.contactSnapshot?.email !== input.email || input.currency !== "ZAR" ||
      !Number.isSafeInteger(input.amount) || input.amount <= 0 ||
      !attempt.amount.mul(100).equals(input.amount)) throw new Error("Offline initialization must match canonical payment facts.");
  const key = disposablePaystackKey(input.reference);
  const record: DisposablePaystackTransaction = { reference: input.reference, email: input.email, amount: input.amount, currency: "ZAR",
    id: parseInt(createHash("sha256").update(input.reference).digest("hex").slice(0, 10), 16), status: "pending", initializeCalls: 1, verifyCalls: 0 };
  const row = await prisma.systemSetting.upsert({ where: { key }, update: {}, create: { key, label: "Disposable Paystack provider record", type: "JSON", value: record } });
  const existing = row.value as unknown as DisposablePaystackTransaction;
  if (existing.amount !== input.amount || existing.email !== input.email) throw new Error("Synthetic provider identity conflict.");
  return { status: true, message: "Disposable provider initialization", data: {
    reference: input.reference, access_code: "disposable-only", authorization_url: `https://checkout.paystack.com/disposable-${existing.id}`,
  } };
}
