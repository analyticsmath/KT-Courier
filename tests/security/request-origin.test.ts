import { describe, expect, it, vi } from "vitest";
import {
  createOriginFailureResponse,
  validateSameOriginRequest,
} from "@/lib/security/request-origin";

function request(headers: HeadersInit = {}, url = "http://localhost:3000/api/test") {
  return new Request(url, { headers });
}

describe("request origin validation", () => {
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
