import { describe, expect, it, vi, beforeEach } from "vitest";
import { PaymentError } from "@/lib/payments/errors";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), apply: vi.fn(), record: vi.fn(), begin: vi.fn(() => vi.fn()), observe: vi.fn() }));
vi.mock("@/lib/payments/providers/payfast/payfast-itn-rate-limit", () => ({ beginPayfastItnRequest: mocks.begin }));
vi.mock("@/lib/payments/providers/payfast/payfast-itn-observability", () => ({ observePayfastItn: mocks.observe }));
vi.mock("@/lib/services/payfast-itn-verification.service", async (original) => ({ ...(await original()), verifyPayfastItn: mocks.verify }));
vi.mock("@/lib/services/payfast-itn-application.service", () => ({ applyVerifiedPayfastItn: mocks.apply, recordPayfastVerificationFailure: mocks.record }));
import * as route from "@/app/api/payments/payfast/itn/route";

const request = (body: BodyInit = "safe", contentType = "application/x-www-form-urlencoded") => new Request("https://app.example.test/api/payments/payfast/itn", { method: "POST", headers: { "content-type": contentType }, body });
describe("public Payfast ITN route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.begin.mockReturnValue(vi.fn()); mocks.verify.mockResolvedValue({ kind: "VERIFIED", receipt: { environment: "SANDBOX", normalizedStatus: "COMPLETE" } }); mocks.apply.mockResolvedValue({ outcome: "APPLIED", eventPublicReference: "pwe_safe" }); });
  it("exports POST only, never redirects, and acknowledges verified application", async () => { expect(route).not.toHaveProperty("GET"); const response = await route.POST(request()); expect(response.status).toBe(200); expect(await response.text()).toBe("OK"); expect(response.headers.get("location")).toBeNull(); expect(response.headers.get("cache-control")).toContain("no-store"); });
  it("acknowledges exact duplicate without application", async () => { mocks.verify.mockResolvedValue({ kind: "EXISTING", eventId: "event", processingStatus: "APPLIED" }); const response = await route.POST(request()); expect(response.status).toBe(200); expect(mocks.apply).not.toHaveBeenCalled(); });
  it.each([["PAYFAST_SOURCE_NOT_ALLOWED", 403], ["PAYFAST_ITN_SIGNATURE_INVALID", 400], ["PAYFAST_ITN_FORM_INVALID", 400], ["PAYFAST_AMOUNT_MISMATCH", 422], ["PAYFAST_CONFIRMATION_UNAVAILABLE", 503], ["PAYFAST_EVENT_CONFLICT", 409]] as const)("returns controlled status for %s", async (code, status) => { mocks.verify.mockRejectedValue(new PaymentError(code, "sensitive detail", code.endsWith("UNAVAILABLE"))); const response = await route.POST(request()); expect(response.status).toBe(status); expect(await response.text()).not.toContain("sensitive detail"); expect(response.headers.get("location")).toBeNull(); });
  it("rejects invalid content type before verification", async () => { const response = await route.POST(request("safe", "application/json")); expect(response.status).toBe(400); expect(mocks.verify).not.toHaveBeenCalled(); });
  it("rejects a declared body over 32 KiB", async () => { const response = await route.POST(new Request("https://app.example.test/api/payments/payfast/itn", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "content-length": "32769" }, body: "safe" })); expect(response.status).toBe(400); expect(mocks.verify).not.toHaveBeenCalled(); });
  it("rejects streaming overflow before verification", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(32 * 1024 + 1)); controller.close(); } });
    const overflow = new Request("https://app.example.test/api/payments/payfast/itn", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: stream, duplex: "half" } as RequestInit & { duplex: "half" });
    const response = await route.POST(overflow);
    expect(response.status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("has no browser session or same-origin dependency", () => expect(route.POST.toString()).not.toMatch(/getCurrentUser|requireAuth|requireRequestOrigin/));
});
