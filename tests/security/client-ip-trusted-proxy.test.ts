import { describe, expect, it } from "vitest";
import { resolveCanonicalClientIp } from "@/lib/security/client-ip";

function mockRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/test", { headers });
}

describe("Canonical Client IP & Trusted Proxy Model", () => {
  it("ignores forwarded headers in direct mode to prevent spoofing", () => {
    const req = mockRequest({
      "x-forwarded-for": "203.0.113.195, 198.51.100.1",
      "x-real-ip": "203.0.113.195",
      "cf-connecting-ip": "203.0.113.195",
    });

    const ip = resolveCanonicalClientIp(req, { mode: "direct" });
    expect(ip).toBeNull();
  });

  it("extracts the rightmost client IP in single_trusted_proxy mode", () => {
    const req = mockRequest({
      "x-forwarded-for": "10.0.0.1, 198.51.100.22, 203.0.113.50",
    });

    const ip = resolveCanonicalClientIp(req, { mode: "single_trusted_proxy" });
    expect(ip).toBe("203.0.113.50");
  });

  it("extracts cf-connecting-ip in cloudflare mode", () => {
    const req = mockRequest({
      "cf-connecting-ip": "198.51.100.99",
      "x-forwarded-for": "10.0.0.1",
    });

    const ip = resolveCanonicalClientIp(req, { mode: "cloudflare" });
    expect(ip).toBe("198.51.100.99");
  });

  it("handles valid IPv6 addresses correctly", () => {
    const req = mockRequest({
      "cf-connecting-ip": "2001:db8:85a3::8a2e:370:7334",
    });

    const ip = resolveCanonicalClientIp(req, { mode: "cloudflare" });
    expect(ip).toBe("2001:db8:85a3::8a2e:370:7334");
  });

  it("strips port numbers from IPv4 strings", () => {
    const req = mockRequest({
      "x-forwarded-for": "198.51.100.4:8080",
    });

    const ip = resolveCanonicalClientIp(req, { mode: "single_trusted_proxy" });
    expect(ip).toBe("198.51.100.4");
  });

  it("rejects malformed IP strings gracefully", () => {
    const req = mockRequest({
      "x-forwarded-for": "not-a-valid-ip, <script>alert(1)</script>",
    });

    const ip = resolveCanonicalClientIp(req, { mode: "single_trusted_proxy" });
    expect(ip).toBeNull();
  });
});
