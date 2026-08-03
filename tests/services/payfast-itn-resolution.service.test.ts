import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixedAttempt, fixedItnConfig } from "../payments/payfast/payfast-itn-test-fixtures";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { paymentAttempt: { findUnique: mocks.findUnique } } }));
import { assertPayfastItnAttemptConfiguration, resolvePayfastItnAttempt } from "@/lib/services/payfast-itn-resolution.service";

describe("Payfast ITN resolution service", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findUnique.mockResolvedValue({ ...fixedAttempt, provider: "PAYFAST" }); });
  it("resolves the exact unique merchant reference with payment evidence", async () => expect(await resolvePayfastItnAttempt(fixedAttempt.merchantReference)).toMatchObject({ id: fixedAttempt.id, paymentId: fixedAttempt.paymentId }));
  it.each([null, { ...fixedAttempt, provider: "STRIPE" }, { ...fixedAttempt, provider: "PAYFAST", providerCredentialVersion: null }])("fails safely for missing, wrong-provider, or unversioned attempt", async (row) => { mocks.findUnique.mockResolvedValueOnce(row); await expect(resolvePayfastItnAttempt(fixedAttempt.merchantReference)).rejects.toMatchObject({ code: "PAYMENT_ATTEMPT_NOT_FOUND" }); });
  it("fails closed for credential or environment mismatch", () => { expect(() => assertPayfastItnAttemptConfiguration({ ...fixedAttempt, providerCredentialVersion: "old" }, fixedItnConfig)).toThrow(); expect(() => assertPayfastItnAttemptConfiguration({ ...fixedAttempt, providerEnvironment: "PRODUCTION" }, fixedItnConfig)).toThrow(); });
});
