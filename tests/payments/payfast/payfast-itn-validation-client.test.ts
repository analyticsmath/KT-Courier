import { describe, expect, it, vi } from "vitest";
import { confirmPayfastItnData, PAYFAST_VALIDATION_ENDPOINTS } from "@/lib/payments/providers/payfast/payfast-itn-validation-client";

const canonicalBody = "a=1&b=two";
describe("Payfast query-validation client", () => {
  it("posts the prebuilt canonical body once to the pinned endpoint and accepts only VALID", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("VALID\n", { status: 200 }));
    await confirmPayfastItnData({ environment: "SANDBOX", canonicalBody, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(PAYFAST_VALIDATION_ENDPOINTS.SANDBOX);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: "POST", redirect: "error", credentials: "omit", cache: "no-store" });
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toBe(canonicalBody);
  });
  it.each([new Response("INVALID", { status: 200 }), new Response("<html>VALID</html>", { status: 200 }), new Response("VALID", { status: 500 }), new Response(null, { status: 302, headers: { location: "https://untrusted.example" } }), new Response("x".repeat(65), { status: 200 })])("rejects invalid, HTML, status, redirect, or oversized responses", async (response) => {
    await expect(confirmPayfastItnData({ environment: "SANDBOX", canonicalBody, fetchImpl: vi.fn().mockResolvedValue(response) })).rejects.toBeInstanceOf(Error);
  });
  it("maps timeout/network failure to one retryable result without internal retry", async () => {
    const fetchImpl = vi.fn((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    await expect(confirmPayfastItnData({ environment: "SANDBOX", canonicalBody, timeoutMs: 1, fetchImpl: fetchImpl as typeof fetch })).rejects.toMatchObject({ code: "PAYFAST_CONFIRMATION_UNAVAILABLE", retryable: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
