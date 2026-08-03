import { describe, expect, it } from "vitest";
import { encryptNotificationEndpoint } from "@/lib/notifications/endpoint-vault";

describe("Phase 27 encrypted endpoint boundary", () => {
  it("uses deterministic fingerprints with randomized encrypted storage and never returns a raw endpoint", () => {
    const prior = process.env.NOTIFICATION_ENDPOINT_ENCRYPTION_KEY;
    process.env.NOTIFICATION_ENDPOINT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      const raw = "https://push.example.test/subscriptions/user-private-token";
      const first = encryptNotificationEndpoint(raw); const second = encryptNotificationEndpoint(raw);
      expect(first.fingerprint).toBe(second.fingerprint); expect(first.encrypted).not.toBe(second.encrypted);
      expect(first.encrypted).toMatch(/^nendpoint:v1:/); expect(first.encrypted).not.toContain(raw); expect(first.masked).not.toContain(raw); expect(first.masked).toMatch(/^endpoint••••[a-f0-9]{6}$/);
    } finally {
      if (prior === undefined) delete process.env.NOTIFICATION_ENDPOINT_ENCRYPTION_KEY; else process.env.NOTIFICATION_ENDPOINT_ENCRYPTION_KEY = prior;
    }
  });

  it("fails closed when no valid endpoint encryption key is configured", () => {
    const prior = process.env.NOTIFICATION_ENDPOINT_ENCRYPTION_KEY; delete process.env.NOTIFICATION_ENDPOINT_ENCRYPTION_KEY;
    try { expect(() => encryptNotificationEndpoint("https://push.example.test/subscriptions/user-private-token")).toThrow("NOTIFICATION_ENDPOINT_ENCRYPTION_UNAVAILABLE"); }
    finally { if (prior === undefined) delete process.env.NOTIFICATION_ENDPOINT_ENCRYPTION_KEY; else process.env.NOTIFICATION_ENDPOINT_ENCRYPTION_KEY = prior; }
  });
});
