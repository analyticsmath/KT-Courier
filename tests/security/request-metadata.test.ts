import { describe, expect, it } from "vitest";
import {
  getRequestIp,
  getRequestMetadata,
  getRequestUserAgent,
} from "@/lib/security/request-metadata";

function request(headers: HeadersInit = {}) {
  return new Request("http://localhost/api/test", { headers });
}

describe("request metadata", () => {
  it("uses the first IP-like x-forwarded-for value", () => {
    const req = request({
      "x-forwarded-for": "unknown, 203.0.113.7, 10.0.0.5",
    });

    expect(getRequestIp(req)).toBe("203.0.113.7");
  });

  it("uses x-real-ip when forwarded-for is absent", () => {
    expect(getRequestIp(request({ "x-real-ip": "198.51.100.22" }))).toBe(
      "198.51.100.22"
    );
  });

  it("uses cf-connecting-ip when earlier IP headers are absent", () => {
    expect(getRequestIp(request({ "cf-connecting-ip": "2001:db8::1" }))).toBe(
      "2001:db8::1"
    );
  });

  it("extracts user-agent", () => {
    expect(getRequestUserAgent(request({ "user-agent": "Vitest UA" }))).toBe(
      "Vitest UA"
    );
  });

  it("returns nulls safely when headers are missing", () => {
    expect(getRequestMetadata(request())).toEqual({
      ipAddress: null,
      userAgent: null,
    });
  });

  it("does not crash on malformed IP headers", () => {
    const req = request({
      "x-forwarded-for": "unknown, also-bad",
      "x-real-ip": "not-an-ip",
      "cf-connecting-ip": "bad-value",
    });

    expect(getRequestIp(req)).toBeNull();
  });
});
