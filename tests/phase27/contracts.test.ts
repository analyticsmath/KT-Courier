import { describe, expect, it } from "vitest";
import { NotificationPolicyError, assertNotificationContent, deliveryEligible, nextRetryAt, signMarketingUnsubscribe, verifyMarketingUnsubscribe } from "@/lib/notifications/contracts";
import { renderNotificationTemplate } from "@/lib/notifications/template-renderer";

describe("Phase 27 policy contracts", () => {
  it("requires channel-specific marketing consent and verified destinations", () => {
    expect(deliveryEligible({ purpose: "MARKETING", channel: "EMAIL", consent: "REVOKED", verifiedDestination: true }).reason).toBe("USER_OPTED_OUT");
    expect(deliveryEligible({ purpose: "MARKETING", channel: "EMAIL", consent: "NOT_REQUESTED", verifiedDestination: true }).reason).toBe("CONSENT_REQUIRED");
    expect(deliveryEligible({ purpose: "TRANSACTIONAL", channel: "SMS", verifiedDestination: false }).reason).toBe("VERIFIED_NOTIFICATION_DESTINATION_REQUIRED");
    expect(deliveryEligible({ purpose: "SECURITY", channel: "IN_APP" }).eligible).toBe(true);
  });

  it("prevents unsafe external restricted content and action URLs", () => {
    expect(() => assertNotificationContent({ sensitivity: "RESTRICTED", channel: "EMAIL", body: "private check evidence", actionRoute: "/account" })).toThrow("UNSAFE_NOTIFICATION_CONTENT");
    expect(() => assertNotificationContent({ sensitivity: "ACCOUNT", channel: "IN_APP", body: "safe", actionRoute: "https://attacker.example" })).toThrow("UNSAFE_NOTIFICATION_CONTENT");
  });

  it("renders strictly and escapes html", () => {
    expect(renderNotificationTemplate({ template: "Hello {{name}}", variables: [{ name: "name", type: "TEXT", required: true, maximumLength: 30, sensitivity: "ACCOUNT", allowedChannels: ["EMAIL"] }], values: { name: "<Sam>" }, channel: "EMAIL", sensitivity: "ACCOUNT", html: true })).toBe("Hello &lt;Sam&gt;");
    expect(() => renderNotificationTemplate({ template: "{{unknown}}", variables: [], values: {}, channel: "IN_APP", sensitivity: "ACCOUNT" })).toThrow(NotificationPolicyError);
  });

  it("bounds retry and never retries configuration failure", () => {
    expect(nextRetryAt({ failure: "CONFIGURATION_FAILURE", attemptNumber: 1 })).toBeNull();
    expect(nextRetryAt({ failure: "TRANSIENT_NETWORK", attemptNumber: 5 })).toBeNull();
    expect(nextRetryAt({ failure: "TRANSIENT_NETWORK", attemptNumber: 1, now: new Date("2026-01-01T00:00:00Z") })?.toISOString()).toBe("2026-01-01T00:00:30.000Z");
  });

  it("makes marketing unsubscribe opaque, signed, channel-bound and expiring", () => {
    const token = signMarketingUnsubscribe({ subjectId: "usr_123", channel: "EMAIL", expiresAt: new Date(Date.now() + 60_000) }, "test-secret");
    expect(token).not.toContain("usr_123");
    expect(verifyMarketingUnsubscribe(token, "test-secret")).toEqual({ subjectId: "usr_123", channel: "EMAIL" });
    expect(() => verifyMarketingUnsubscribe(`${token}x`, "test-secret")).toThrow("INVALID_UNSUBSCRIBE_TOKEN");
  });
});
