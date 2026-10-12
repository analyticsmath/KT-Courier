import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOriginFailureResponse,
  validateSameOriginRequest,
} from "@/lib/security/request-origin";

function request(headers: HeadersInit = {}, url = "http://localhost:3000/api/test") {
  return new Request(url, { headers });
}

describe("request origin validation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only the explicitly configured dynamic loopback ports in a production-mode E2E server", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:46173");
    vi.stubEnv("ALLOWED_ORIGINS", "http://localhost:46173,http://127.0.0.1:46173");
    for (const origin of ["http://localhost:46173", "http://127.0.0.1:46173"]) {
      expect(validateSameOriginRequest(request({ origin }, "http://app:3000/api/test")).ok).toBe(true);
    }
    for (const origin of ["http://localhost:46174", "http://127.0.0.1:46174", "https://unrelated.example"]) {
      expect(validateSameOriginRequest(request({ origin }, "http://app:3000/api/test")).ok).toBe(false);
    }
  });

  it("does not infer E2E origins from runtime flags or spoofed host headers in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KT_RUNTIME_ENV", "e2e");
    for (const key of ["ALLOWED_ORIGINS", "NEXT_PUBLIC_APP_URL", "APP_URL", "VERCEL_URL", "CORS_ALLOW_ORIGIN", "TRUSTED_PROXY_ORIGINS"]) vi.stubEnv(key, "");
    expect(validateSameOriginRequest(request({ origin: "http://localhost:46173", host: "localhost:46173" })).ok).toBe(false);
  });
  it("allows a matching Origin", () => {
    const result = validateSameOriginRequest(
      request({ origin: "http://localhost:3000" })
    );

    expect(result).toMatchObject({ ok: true, status: 200 });
  });

  it("rejects a mismatched Origin", () => {
    const result = validateSameOriginRequest(
      request({ origin: "https://evil.example" })
    );

    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("allows a matching Referer when Origin is absent", () => {
    const result = validateSameOriginRequest(
      request({ referer: "http://localhost:3000/admin" })
    );

    expect(result.ok).toBe(true);
  });

  it("rejects a mismatched Referer when Origin is absent", () => {
    const result = validateSameOriginRequest(
      request({ referer: "https://evil.example/form" })
    );

    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("allows configured local development origins", () => {
    const result = validateSameOriginRequest(
      request({ origin: "http://localhost:3001" })
    );

    expect(result.ok).toBe(true);
  });

  it("allows IPv6 localhost development origin", () => {
    const result = validateSameOriginRequest(
      request({ origin: "http://[::1]:3000" })
    );

    expect(result.ok).toBe(true);
  });

  it("allows origin matching request host header in development", () => {
    const result = validateSameOriginRequest(
      request({ origin: "http://192.168.10.7:3000", host: "192.168.10.7:3000" })
    );

    expect(result.ok).toBe(true);
  });

  it("allows origin configured via ALLOWED_ORIGINS", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "http://custom-dev.local:3000,http://preview.local");
    const result = validateSameOriginRequest(
      request({ origin: "http://custom-dev.local:3000" })
    );

    expect(result.ok).toBe(true);
  });

  it("accepts explicit production website origins behind the Railway proxy", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOWED_ORIGINS", "https://www.ktcouriers.com,https://ktcouriers.com");
    for (const origin of ["https://www.ktcouriers.com", "https://ktcouriers.com"]) {
      expect(validateSameOriginRequest(request(
        { origin, host: "web-production-9f8bb.up.railway.app" },
        "https://web-production-9f8bb.up.railway.app/api/public/delivery-quotes",
      )).ok).toBe(true);
    }
  });

  it("does not trust spoofed proxy headers or website lookalikes in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOWED_ORIGINS", "https://www.ktcouriers.com,https://ktcouriers.com");
    for (const origin of [
      "https://www.ktcouriers.com.attacker.invalid",
      "https://attacker.invalid",
      "http://www.ktcouriers.com",
    ]) {
      expect(validateSameOriginRequest(request({
        origin,
        host: "attacker.invalid",
        "x-forwarded-host": "attacker.invalid",
        "x-forwarded-proto": "https",
      }, "https://attacker.invalid/api/test"))).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("allows missing Origin and Referer for Phase 1 compatibility", () => {
    const result = validateSameOriginRequest(request());

    expect(result.ok).toBe(true);
  });

  it("uses configured app origins without leaking allowed origins in failures", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kt.example");
    const result = validateSameOriginRequest(
      request({ origin: "https://evil.example" }, "https://kt.example/api/test")
    );
    const response = createOriginFailureResponse(result);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Invalid request origin" });
    expect(JSON.stringify(body)).not.toContain("kt.example");
    expect(JSON.stringify(body)).not.toContain("evil.example");
  });
});
