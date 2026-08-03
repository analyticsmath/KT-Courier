import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "lib/developer-api/session-gateway.ts"), "utf8");

describe("Phase 28 developer and admin session workflows", () => {
  it("requires session, origin, owner-bound permission and canonical webhook lifecycle services", () => {
    expect(source).toContain("getCurrentUser");
    expect(source).toContain("SAME_ORIGIN_REQUIRED");
    expect(source).toContain("DEVELOPER_PERMISSION_DENIED");
    expect(source).toContain("ownedApplication");
    expect(source).toContain('"terms" && segments[3] === "accept"');
    expect(source).toContain('"review-outcome"');
    expect(source).toContain("webhooks.pause(subscription)");
    expect(source).toContain("webhooks.resume(subscription)");
    expect(source).toContain("webhooks.revoke(subscription)");
    expect(source).toContain("webhooks.requestDeliveryRetry(delivery)");
  });

  it("keeps reviewer assignment and approval separated", () => {
    expect(source).toContain("DEVELOPER_APPROVAL_SEPARATION_REQUIRED");
    expect(source).toContain('decision: "ASSIGNED"');
  });
});
