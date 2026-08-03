import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PayfastRefundAdapter, PAYFAST_REFUND_CAPABILITIES } from "@/lib/refunds/providers/payfast/payfast-refund-adapter";

const config = { merchantId: "10000100", passphrase: "secret", credentialVersion: "v1", apiOrigin: "https://api.payfast.co.za", apiVersion: "v1" } as const;
const input = { refundPublicReference: "R-1", paymentPublicReference: "P-1", providerPaymentId: "PF-P-1", amount: "10.00", currency: "ZAR", reasonCode: "SERVICE_FAILURE", providerOperationKey: "op" } as const;
const context = () => ({ signal: new AbortController().signal, correlationId: "attempt", timeoutMs: 1000 });
describe("Payfast refund adapter", () => {
  it("keeps sandbox and uninjected network execution disabled", async () => {
    expect(PAYFAST_REFUND_CAPABILITIES.supportsSandboxRefunds).toBe(false);
    await expect(new PayfastRefundAdapter(config).createRefund(input, context())).rejects.toThrow(/validation-locked/i);
  });
  it("uses only an injected deterministic transport in tests and rejects redirects", async () => {
    const transport = vi.fn().mockResolvedValue({ status: 200, redirected: true, body: {} });
    const adapter = new PayfastRefundAdapter(config, { transport, amountSerializer: (amount: Prisma.Decimal) => amount.toFixed(2), now: () => new Date("2026-07-18T10:11:12.000Z") });
    await expect(adapter.createRefund(input, context())).rejects.toThrow(/redirects are not permitted/i);
    expect(transport).toHaveBeenCalledOnce();
  });
  it("normalizes injected transport evidence without a real network call", async () => {
    const adapter = new PayfastRefundAdapter(config, { transport: async () => ({ status: 202, redirected: false, body: { id: "PF-R-1", status: "processing" } }), amountSerializer: (amount: Prisma.Decimal) => amount.toFixed(2), now: () => new Date("2026-07-18T10:11:12.000Z") });
    await expect(adapter.createRefund(input, context())).resolves.toEqual(expect.objectContaining({ status: "UNKNOWN", providerRefundId: "PF-R-1", definitive: false }));
  });
});
