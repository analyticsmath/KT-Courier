import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: vi.fn(async () => null) }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: vi.fn(async () => ({ ok: true })), RATE_LIMITS: { ORDER_ESTIMATE: {} } }));

import { mutation } from "@/lib/client-platform/api";

const bodyRequest = (size: number) => new NextRequest("http://localhost:3000/api/admin/marketplace-trusted-packages", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ evidence: "x".repeat(size) }),
});

describe("bounded administrative trusted-package authoring", () => {
  it("supports a measured multi-product manifest larger than the generic 16 KiB mutation limit", async () => {
    const result = await mutation(bodyRequest(25_000), "trusted-packages:test", 256 * 1024);
    expect("body" in result).toBe(true);
    if ("body" in result) expect((result.body as { evidence: string }).evidence.length).toBe(25_000);
  });
  it("retains the 16 KiB default limit on ordinary mutation endpoints", async () => {
    const result = await mutation(bodyRequest(25_000), "generic:test");
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(413);
  });
  it("rejects oversized privileged policy bodies even when the higher bounded limit is requested", async () => {
    const result = await mutation(bodyRequest(257 * 1024), "trusted-packages:test", 256 * 1024);
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(413);
  });
});
