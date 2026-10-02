import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendEmailProvider } from "@/lib/notifications/providers";

const message = { destination: "recipient@example.test", subject: "Verification", body: "A private code", idempotencyKey: "security:one-delivery" };

describe("Resend HTTP provider contract", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("puts the stable retry key on the API request, never the email content", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "provider-email-1" }));
    vi.stubGlobal("fetch", fetcher);
    const provider = new ResendEmailProvider("test-only-key", "KT Couriers <sender@example.test>");
    await expect(provider.send(message)).resolves.toEqual({ accepted: true, providerMessageReference: "provider-email-1" });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe(message.idempotencyKey);
    expect(JSON.parse(init.body)).not.toHaveProperty("headers");
  });
  it("does not report acceptance without a provider message reference", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    await expect(new ResendEmailProvider("test-only-key", "sender@example.test").send(message)).resolves.toMatchObject({ accepted: false, failureClass: "UNKNOWN_PROVIDER_FAILURE" });
  });
  it.each([
    ["invalid_api_key", 401, "AUTHENTICATION_FAILURE"],
    ["missing_api_key", 401, "AUTHENTICATION_FAILURE"],
    ["validation_error", 403, "CONFIGURATION_FAILURE"],
    ["validation_error", 422, "CONTENT_REJECTED"],
    ["rate_limit_exceeded", 429, "PROVIDER_RATE_LIMIT"],
    ["internal_server_error", 500, "PROVIDER_UNAVAILABLE"],
  ])("classifies %s/%s without exposing provider text", async (name, status, failureClass) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ name, statusCode: status, message: "Private provider detail with recipient@example.test and a token" }, { status })));
    const result = await new ResendEmailProvider("test-only-key", "sender@example.test").send(message);
    expect(result).toMatchObject({ accepted: false, failureClass });
    expect(JSON.stringify(result)).not.toContain("Private provider detail");
    expect(JSON.stringify(result)).not.toContain("recipient@example.test");
  });
  it("requires an explicit sender instead of inventing a production address", () => {
    vi.stubEnv("EMAIL_FROM", "");
    expect(() => new ResendEmailProvider("test-only-key")).toThrow();
  });
});
