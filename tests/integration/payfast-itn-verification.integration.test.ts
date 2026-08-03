import { afterAll, describe, expect, it, vi } from "vitest";
import { verifyPayfastItn } from "@/lib/services/payfast-itn-verification.service";
import { calculatePayfastItnSignature } from "@/lib/payments/providers/payfast/payfast-itn-signature";
import { parsePayfastItnForm } from "@/lib/payments/providers/payfast/payfast-itn-parser";
import { createPhase12Attempt } from "./payfast-itn-fixtures";
import { paymentPrisma } from "./payment-fixtures";
import { payfastIntegrationConfiguration } from "./payfast-fixtures";

afterAll(async () => paymentPrisma.$disconnect());
describe("Payfast ITN verification integration with deterministic dependencies", () => {
  it("verifies source, signature, merchant, exact amount and query validation without mutation", async () => {
    const { attempt } = await createPhase12Attempt();
    const unsigned = `m_payment_id=${encodeURIComponent(attempt.merchantReference)}&pf_payment_id=pf-integration&payment_status=COMPLETE&amount_gross=${attempt.amount.toFixed(2)}&merchant_id=integration-merchant-id`;
    const signature = calculatePayfastItnSignature(parsePayfastItnForm(`${unsigned}&signature=${"0".repeat(32)}`).orderedFields, payfastIntegrationConfiguration.passphrase).toString("hex");
    const bodyText = `${unsigned}&signature=${signature}`;
    const before = await paymentPrisma.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } });
    const result = await verifyPayfastItn({ bodyBytes: new TextEncoder().encode(bodyText), bodyText, headers: new Headers({ "x-kt-source-ip": "196.1.2.3" }) }, { configuration: () => ({ runtime: payfastIntegrationConfiguration, state: {} as never }), proxyMode: "single_trusted_proxy", sourceResolver: { verify: vi.fn().mockResolvedValue(undefined) }, confirm: vi.fn().mockResolvedValue(undefined), findReceipt: vi.fn().mockResolvedValue(null) });
    expect(result).toMatchObject({ kind: "VERIFIED", receipt: { providerDataVerified: true } });
    expect(await paymentPrisma.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).toEqual(before);
    expect(await paymentPrisma.ledgerJournal.count({ where: { correlationId: attempt.payment.publicReference } })).toBe(0);
  });
  it("fails credential mismatch closed without verification, payment success, or ledger posting", async () => {
    const { attempt } = await createPhase12Attempt();
    const unsigned = `m_payment_id=${encodeURIComponent(attempt.merchantReference)}&pf_payment_id=pf-credential&payment_status=COMPLETE&amount_gross=${attempt.amount.toFixed(2)}&merchant_id=integration-merchant-id`;
    const signature = calculatePayfastItnSignature(parsePayfastItnForm(`${unsigned}&signature=${"0".repeat(32)}`).orderedFields, payfastIntegrationConfiguration.passphrase).toString("hex"); const bodyText = `${unsigned}&signature=${signature}`;
    await expect(verifyPayfastItn({ bodyBytes: new TextEncoder().encode(bodyText), bodyText, headers: new Headers({ "x-kt-source-ip": "196.1.2.3" }) }, { configuration: () => ({ runtime: payfastIntegrationConfiguration, state: {} as never }), proxyMode: "single_trusted_proxy", sourceResolver: { verify: vi.fn().mockResolvedValue(undefined) }, resolveAttempt: vi.fn().mockResolvedValue({ ...attempt, providerCredentialVersion: "drained-old-version" }), confirm: vi.fn(), findReceipt: vi.fn().mockResolvedValue(null) })).rejects.toMatchObject({ code: "PAYFAST_CREDENTIAL_VERSION_MISMATCH" });
    expect(await paymentPrisma.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).not.toMatchObject({ status: "SUCCEEDED" });
    expect(await paymentPrisma.ledgerJournal.count({ where: { correlationId: attempt.payment.publicReference } })).toBe(0);
  });
});
