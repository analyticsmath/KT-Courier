import { describe, expect, it } from "vitest";
import { refundRouteSource } from "./refund-api-source";
import { RefundCreateSchema } from "@/lib/validation/refunds";

describe("customer refunds API", () => {
  const source = refundRouteSource("refunds");
  it("protects mutations with origin, rate, media/body and strict schema controls", () => { for (const token of ["enforceSameOriginRequest", "checkIpRateLimit", "validateRefundJsonRequest", "RefundCreateSchema.safeParse"]) expect(source).toContain(token); });
  it("requires operation ID and exact string money", () => { expect(RefundCreateSchema.safeParse({ paymentPublicReference: "PAY-12345678", amount: "10.01", method: "CUSTOMER_WALLET", reasonCode: "SERVICE_FAILURE", operationId: "12345678-1234-4234-8234-123456789012" }).success).toBe(true); expect(RefundCreateSchema.safeParse({ paymentPublicReference: "PAY-12345678", amount: 10.01, method: "CUSTOMER_WALLET", reasonCode: "SERVICE_FAILURE", operationId: "12345678-1234-4234-8234-123456789012" }).success).toBe(false); });
  it("does not accept accounting or provider authority fields", () => { const payload = { paymentPublicReference: "PAY-12345678", amount: "10.01", method: "CUSTOMER_WALLET", reasonCode: "SERVICE_FAILURE", operationId: "12345678-1234-4234-8234-123456789012", ledgerAccountId: "x", providerStatus: "SUCCEEDED" }; expect(RefundCreateSchema.safeParse(payload).success).toBe(false); });
  it("returns exact string amounts", () => expect(source).toMatch(/amount:\s*refund\.amount\.toFixed\(2\)/));
  it("rejects zero, negative and fractional-cent amounts before financial execution", () => {
    const payload = { paymentPublicReference: "PAY-12345678", method: "CUSTOMER_WALLET", reasonCode: "SERVICE_FAILURE", operationId: "12345678-1234-4234-8234-123456789012" };
    for (const amount of ["0", "0.00", "-1.00", "25.001"]) expect(RefundCreateSchema.safeParse({ ...payload, amount }).success).toBe(false);
    for (const amount of ["0.01", "25.00"]) expect(RefundCreateSchema.safeParse({ ...payload, amount }).success).toBe(true);
  });
});
