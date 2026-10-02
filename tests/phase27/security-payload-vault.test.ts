import { createCipheriv, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openSecurityPayload, sealSecurityPayload, securityPayloadKey } from "@/lib/notifications/security-payload-vault";

describe("security notification payload vault", () => {
  beforeEach(() => vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64")));
  it("round trips a private code without exposing it in the envelope", () => {
    const values = { otp: "123456", name: "Recipient", expiresMinutes: 15 };
    const sealed = sealSecurityPayload(values, "verification:one");
    expect(sealed).not.toContain("123456");
    expect(sealed).not.toContain("Recipient");
    expect(openSecurityPayload(sealed, "verification:one")).toEqual(values);
    expect(sealSecurityPayload(values, "verification:one")).not.toBe(sealed);
  });
  it("rejects a ciphertext moved to another operation", () => {
    const sealed = sealSecurityPayload({ otp: "123456" }, "verification:one");
    expect(() => openSecurityPayload(sealed, "verification:two")).toThrow("NOTIFICATION_SECURITY_PAYLOAD_INVALID");
  });
  it("rejects a corrupted ciphertext without returning decrypted content", () => {
    const sealed = sealSecurityPayload({ resetUrl: "https://example.test/reset?token=private" }, "reset:one");
    const body = Buffer.from(sealed.slice("nsecurity:v2:".length), "base64url");
    body[body.length - 1] ^= 1;
    expect(() => openSecurityPayload("nsecurity:v2:" + body.toString("base64url"), "reset:one")).toThrow("NOTIFICATION_SECURITY_PAYLOAD_INVALID");
  });
  it("can read the previous authenticated envelope during rollout", () => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", securityPayloadKey(), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify({ otp: "123456" }), "utf8"), cipher.final()]);
    const legacy = "nsecurity:v1:" + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
    expect(openSecurityPayload(legacy, "legacy:one")).toEqual({ otp: "123456" });
  });
  it("rejects permissively decoded keys and nested or excessive payloads", () => {
    expect(() => securityPayloadKey({ NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64") + "!" })).toThrow("NOTIFICATION_SECURITY_ENCRYPTION_UNAVAILABLE");
    expect(() => sealSecurityPayload({ nested: { otp: "123456" } }, "one")).toThrow("INVALID_SECURITY_NOTIFICATION_VALUES");
    expect(() => sealSecurityPayload({ oversized: "x".repeat(16_385) }, "one")).toThrow("INVALID_SECURITY_NOTIFICATION_VALUES");
  });
});
