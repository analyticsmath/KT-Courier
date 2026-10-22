import { describe, expect, it } from "vitest";
import { attestDecodedManifest, decodedManifestAttested } from "@/lib/migrations/legacy-6ammart/media-attestation";

describe("legacy full-decode attestation", () => {
  it("accepts only the exact independently decoded manifest and protected key", () => {
    const key = "a".repeat(64), manifest = JSON.stringify({ assets: [{ checksum: "b".repeat(64), full_decode_verified: true }] });
    const receipt = attestDecodedManifest(manifest, key);
    expect(decodedManifestAttested(manifest, key, receipt)).toBe(true);
    expect(decodedManifestAttested(manifest + " ", key, receipt)).toBe(false);
    expect(decodedManifestAttested(manifest, "c".repeat(64), receipt)).toBe(false);
    expect(decodedManifestAttested(manifest.replace("true", "false"), key, receipt)).toBe(false);
  });
  it("does not treat missing or malformed receipts as proof of full decoding", () => {
    expect(decodedManifestAttested("{}", undefined, undefined)).toBe(false);
    expect(decodedManifestAttested("{}", "a".repeat(64), "invalid")).toBe(false);
    expect(() => attestDecodedManifest("{}", "short-key")).toThrow(/32-byte/);
  });
});
